/**
 * 서버 전용 번역 유틸 — DeepL Free API.
 * DEEPL_API_KEY 환경 변수 필요 (api-free.deepl.com).
 * 번역 실패 시 null 반환 (저장은 정상 진행).
 *
 * preserveNames: 번역하지 않을 고유명사(이름) 목록.
 * DeepL XML ignore_tags 기능으로 <keep>이름</keep> 감싼 후 번역 제외.
 * - ASCII 이름(영어): \b 단어 경계 사용
 * - 비ASCII 이름(한국어): \b가 유니코드에 미작동하므로 단순 일치 사용
 */
export async function translateText(
  text: string,
  target: "ko" | "en",
  preserveNames?: string[]
): Promise<string | null> {
  const trimmed = text.trim();
  if (!trimmed) return null;

  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) {
    console.warn("[translate] DEEPL_API_KEY not set — skipping translation");
    return null;
  }

  const targetLang = target === "ko" ? "KO" : "EN";

  // 고유명사를 <keep>이름</keep>으로 감싸 번역 제외
  const names = (preserveNames ?? []).filter((n) => n.trim().length > 0);
  let processedText = trimmed;
  if (names.length > 0) {
    for (const name of names) {
      // XML 특수문자 이스케이프 (인젝션 방지)
      const xmlSafe = name
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      // ASCII 이름은 \b 단어 경계, 한국어 등 비ASCII는 단순 일치
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const isAscii = /^[\x00-\x7F]+$/.test(name);
      const regex = isAscii
        ? new RegExp(`\\b${escaped}\\b`, "gi")
        : new RegExp(escaped, "g");
      processedText = processedText.replace(regex, `<keep>${xmlSafe}</keep>`);
    }
    console.log(`[translate] preserving names: ${names.join(", ")}`);
  }

  const preview = trimmed.length > 80 ? trimmed.slice(0, 80) + "…" : trimmed;
  console.log(`[translate] → ${targetLang} | "${preview}"`);

  try {
    const body: Record<string, unknown> = {
      text: [processedText],
      target_lang: targetLang,
    };
    if (names.length > 0) {
      body.tag_handling = "xml";
      body.ignore_tags = ["keep"];
    }

    const res = await fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const resBody = await res.text();
      console.error(`[translate] DeepL API error ${res.status}:`, resBody);
      return null;
    }

    const data = await res.json();
    let result: string | undefined = data?.translations?.[0]?.text;

    // <keep>태그</keep> 제거 + XML 이스케이프 복원
    if (result && names.length > 0) {
      result = result
        .replace(/<keep>(.*?)<\/keep>/g, "$1")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
    }

    if (result) {
      const resultPreview = result.length > 80 ? result.slice(0, 80) + "…" : result;
      console.log(`[translate] ✓ "${resultPreview}"`);
    } else {
      console.warn("[translate] DeepL returned empty result", data);
    }
    return result ?? null;
  } catch (err) {
    console.error("[translate] fetch error:", err);
    return null;
  }
}
