/**
 * 서버 사이드 로거
 * 구조화된 콘솔 로그를 남깁니다.
 */

type LogContext = Record<string, unknown>;

function fmt(level: string, tag: string, msg: string, ctx?: LogContext) {
  const time = new Date().toISOString();
  const ctxStr = ctx && Object.keys(ctx).length > 0 ? " " + JSON.stringify(ctx) : "";
  return `[${time}] ${level} ${tag} ${msg}${ctxStr}`;
}

export const logger = {
  info(tag: string, msg: string, ctx?: LogContext) {
    console.log(fmt("INFO ", tag, msg, ctx));
  },
  warn(tag: string, msg: string, ctx?: LogContext) {
    console.warn(fmt("WARN ", tag, msg, ctx));
  },
  error(tag: string, msg: string, ctx?: LogContext) {
    console.error(fmt("ERROR", tag, msg, ctx));
  },
};
