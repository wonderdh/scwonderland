// PostgREST max_rows(1000) 대응: range 페이지네이션으로 전체 행 조회.
// 1,000행을 넘을 수 있는 select 는 반드시 이걸 거칠 것.
// 호출부는 반드시 유일한 ORDER BY 를 줄 것 (LIMIT/OFFSET 페이지네이션 안정성).
export async function fetchAllRows<T>(
  query: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await query(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }
  return all;
}
