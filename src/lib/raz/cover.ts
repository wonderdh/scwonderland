// 표지 URL은 DB에 저장하지 않고 book id 로 조합 (클라이언트에서도 사용 가능).
export function razCoverUrl(bookId: number): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/raz-covers/covers/${bookId}.webp`;
}
