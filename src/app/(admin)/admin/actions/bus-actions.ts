// 승하차 관리 Server Actions — 도메인별 분할 후 barrel re-export.
// 2026-04-22 리뷰 M-09 Phase 1-B (docs/review-2026-04-22/06-bus-redesign.md).
//
// 실제 구현은 `./bus/` 디렉터리 내 도메인 파일에 위치.
// 기존 소비자 경로(`./actions/bus-actions`)를 유지하기 위해 이 파일은 순수 re-export.
// "use server" 선언 없음 — 순수 re-export는 Next.js 16에서 별도 지시자가 필요하지 않다.
export * from "./bus/master-actions";
export * from "./bus/assignment-actions";
export * from "./bus/manifest-actions";
export * from "./bus/board-actions";
export * from "./bus/change-actions";
export * from "./bus/staff-actions";
