/**
 * HTML 특수 문자를 이스케이프하여 XSS를 방지합니다.
 * 사용자 입력을 HTML 문자열로 연결할 때 반드시 거쳐야 합니다.
 */
export function escapeHtml(input: string | null | undefined): string {
  if (input == null) return "";
  return String(input)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
