import { containsKorean, koreanToEnglish } from "./korean-to-english";

const EMAIL_DOMAIN =
  process.env.NEXT_PUBLIC_EMAIL_DOMAIN ?? "scwonderland.com";

export function normalizeEmail(raw: string): string {
  const s = raw.trim();
  if (!s) return "";
  // 한글 입력 → 영타 키보드 매핑 자동 변환
  const converted = containsKorean(s) ? koreanToEnglish(s) : s;
  return converted.includes("@") ? converted : `${converted}@${EMAIL_DOMAIN}`;
}

export function getAuthErrorMessage(err: {
  message?: string;
  code?: string;
}): string {
  const code = (err as { code?: string }).code;
  const msg = (err.message ?? "").toLowerCase();

  if (
    code === "invalid_credentials" ||
    msg.includes("invalid login credentials")
  ) {
    return "아이디 또는 비밀번호가 올바르지 않습니다.";
  }
  if (code === "email_not_confirmed" || msg.includes("email not confirmed")) {
    return "이메일 인증이 완료되지 않았습니다. 메일함을 확인해 주세요.";
  }
  if (code === "user_banned" || msg.includes("banned")) {
    return "해당 계정은 이용이 제한되었습니다.";
  }
  if (
    code === "over_request_rate_limit" ||
    msg.includes("rate limit") ||
    msg.includes("too many")
  ) {
    return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  }
  if (
    code === "email_provider_disabled" ||
    msg.includes("signups are disabled")
  ) {
    return "이메일 로그인이 비활성화되어 있습니다.";
  }
  if (msg.includes("network") || msg.includes("fetch")) {
    return "네트워크 연결을 확인한 뒤 다시 시도해 주세요.";
  }

  return err.message ?? "로그인에 실패했습니다. 다시 시도해 주세요.";
}
