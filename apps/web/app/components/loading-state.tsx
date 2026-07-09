/**
 * 読込中の標準表示(WP-3006)。
 * aria-busy と aria-live で読込中であることを支援技術にも伝える。
 */
export function LoadingState({ label = "読み込み中…" }: { readonly label?: string }) {
  return (
    <div className="loading-state" role="status" aria-busy="true" aria-live="polite">
      {label}
    </div>
  );
}
