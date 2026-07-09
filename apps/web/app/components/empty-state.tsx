/**
 * 空状態の標準表示(WP-3006)。
 * 「データがない」ことを空白ではなく明示のテキストで伝える(誤読防止)。
 */
export function EmptyState({ message }: { readonly message: string }) {
  return (
    <div className="empty-state" role="status">
      {message}
    </div>
  );
}
