import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 원더랜드 영어학원",
  description: "원더랜드 영어학원 개인정보처리방침",
};

/**
 * 개인정보처리방침 초안.
 * 【 】 로 표시된 부분(시행일·보호책임자·서버 소재지·정식 등록명 등)은
 * 실제 값으로 채운 뒤 게시해야 한다.
 */
const SECTIONS: { title: string; body: React.ReactNode }[] = [
  {
    title: "제1조 (개인정보의 처리 목적)",
    body: (
      <>
        <p>
          학원은 다음의 목적을 위하여 개인정보를 처리하며, 목적 이외의 용도로는
          이용하지 않습니다.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>반 편성 및 수업 진도 관리</li>
          <li>숙제 수행 및 출결 관리</li>
          <li>통학 차량(정류장) 배정 및 안전관리</li>
          <li>학부모 안내 및 상담</li>
        </ul>
      </>
    ),
  },
  {
    title: "제2조 (처리하는 개인정보의 항목)",
    body: (
      <>
        <p>
          학원은 등록 학원생에 한하여, 법정대리인(학부모)의 동의를 받아 아래
          항목을 처리합니다.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>
            <strong>필수항목:</strong> 성명(한글·영문), 나이
          </li>
          <li>
            <strong>학습·운영 항목:</strong> 통학 차량 탑승 정류장, 수업 진도,
            숙제 수행 여부, 출결 여부
          </li>
        </ul>
        <p className="text-sm text-gray-500">
          ※ 위 항목 외 주민등록번호 등 고유식별정보 및 민감정보는 처리하지
          않습니다.
        </p>
      </>
    ),
  },
  {
    title: "제3조 (만 14세 미만 아동의 개인정보 처리)",
    body: (
      <p>
        학원은 만 14세 미만 아동의 개인정보를 처리하는 경우 그 법정대리인의
        동의를 받습니다. 동의를 확인하기 위하여 법정대리인의 성명·연락처 등
        최소한의 정보를 수집할 수 있으며, 해당 정보는 동의 확인 목적으로만
        이용합니다.
      </p>
    ),
  },
  {
    title: "제4조 (개인정보의 처리 및 보유 기간)",
    body: (
      <p>
        개인정보는 재원(등록) 기간 동안 보유·이용하며, 퇴원 또는 동의 철회 시
        지체 없이 파기합니다. 다만 관계 법령에 별도의 보존 의무가 있는 경우 해당
        기간 동안 보관합니다.
      </p>
    ),
  },
  {
    title: "제5조 (개인정보의 제3자 제공)",
    body: (
      <p>
        학원은 정보주체의 개인정보를 제3자에게 제공하지 않습니다. 다만 법령에
        근거가 있거나 정보주체의 별도 동의가 있는 경우에 한하여 제공할 수
        있습니다.
      </p>
    ),
  },
  {
    title: "제6조 (개인정보 처리의 위탁)",
    body: (
      <>
        <p>
          학원은 안정적인 서비스 제공을 위해 아래와 같이 개인정보 처리업무를
          위탁하고 있습니다.
        </p>
        <ul className="ml-5 list-disc space-y-1">
          <li>수탁자: Supabase Inc. (클라우드 인프라·데이터베이스 호스팅)</li>
          <li>위탁업무: 학원생 관리 데이터의 저장·보관</li>
          <li>
            서버 소재지(국가):{" "}
            <span className="text-gray-500">
              【확인 후 기재 — 국외인 경우 국외이전에 관한 사항 별도 고지】
            </span>
          </li>
        </ul>
      </>
    ),
  },
  {
    title: "제7조 (개인정보의 파기 절차 및 방법)",
    body: (
      <p>
        파기 사유가 발생한 개인정보는 지체 없이 파기합니다. 전자적 파일 형태의
        정보는 복구·재생할 수 없는 방법으로 영구 삭제하며, 종이 출력물은
        분쇄하거나 소각합니다.
      </p>
    ),
  },
  {
    title: "제8조 (정보주체와 법정대리인의 권리·의무 및 행사방법)",
    body: (
      <p>
        정보주체(학원생) 및 법정대리인(학부모)은 언제든지 개인정보의
        열람·정정·삭제·처리정지를 요구할 수 있으며, 학원은 요청을 받은 경우 지체
        없이 필요한 조치를 취합니다.
      </p>
    ),
  },
  {
    title: "제9조 (개인정보의 안전성 확보조치)",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li>로그인 인증을 통한 접근통제 및 접근권한 최소화</li>
        <li>개인정보 취급자 지정 및 최소 인원 운영</li>
        <li>암호화된 통신구간(HTTPS)을 통한 데이터 전송</li>
      </ul>
    ),
  },
  {
    title: "제10조 (개인정보 보호책임자)",
    body: (
      <ul className="ml-5 list-disc space-y-1">
        <li>
          성명: <span className="text-gray-500">【 기재 】</span> / 직책:{" "}
          <span className="text-gray-500">【 기재 】</span>
        </li>
        <li>
          연락처: <span className="text-gray-500">【 전화 】</span> / 이메일:{" "}
          <span className="text-gray-500">【 기재 】</span>
        </li>
      </ul>
    ),
  },
  {
    title: "제11조 (개인정보처리방침의 변경)",
    body: (
      <p>
        이 개인정보처리방침은{" "}
        <span className="text-gray-500">【 시행일: YYYY. MM. DD. 】</span>부터
        적용되며, 내용의 추가·삭제 및 수정이 있는 경우 변경사항을 홈페이지를
        통해 고지합니다.
      </p>
    ),
  },
];

export default function PrivacyPolicyPage() {
  return (
    <section className="bg-white py-16 md:py-24">
      <div className="container mx-auto px-4">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-3xl font-extrabold text-gray-900 md:text-4xl">
            개인정보처리방침
          </h1>
          <p className="mt-6 leading-relaxed text-gray-700">
            원더랜드 영어학원
            <span className="text-gray-500">
              【정식 등록명·주소 기재】
            </span>
            (이하 &ldquo;학원&rdquo;)은 「개인정보 보호법」 제30조에 따라
            정보주체의 개인정보를 보호하고 관련 고충을 신속하게 처리할 수 있도록
            다음과 같이 개인정보처리방침을 수립·공개합니다.
          </p>

          <div className="mt-12 space-y-10">
            {SECTIONS.map((sec) => (
              <div key={sec.title}>
                <h2 className="mb-3 text-lg font-bold text-gray-900 md:text-xl">
                  {sec.title}
                </h2>
                <div className="space-y-3 leading-relaxed text-gray-700">
                  {sec.body}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-12 rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
            ※ 본 문서는 초안입니다. 【 】 로 표시된 항목(정식 등록명·주소, 서버
            소재지, 보호책임자, 시행일)을 실제 값으로 채운 뒤 게시하시고, 최종
            문안은 개인정보보호위원회 표준 양식 및 관할 교육지원청 안내로 한 번 더
            확인하시기 바랍니다.
          </p>
        </div>
      </div>
    </section>
  );
}
