import Link from "next/link";

/**
 * 全ルート共通の 404 表示(App Router not-found.tsx / 監査 S-01・P-19)。
 *
 * 存在しないページ・患者・記録に到達した際、真っ白や生の技術エラーではなく、
 * 何が起きたか(業務語)と次のアクションをテキストで示す。
 * PHI(患者ID・氏名等)を URL やメッセージに反映しない(一般化した文言のみ)。
 */
export default function NotFound() {
  return (
    <section className="route-error" aria-label="ページが見つかりません">
      <div className="error-notice" role="alert" data-severity="ERROR">
        <p className="error-notice-message">
          お探しのページが見つかりません。ページが移動または削除されたか、URL が正しくない可能性があります。
        </p>
        <p className="error-notice-next-action">
          次のアクション: 業務メニューから目的の画面へ移動してください。患者を探す場合は患者検索をご利用ください。
        </p>
      </div>
      <p>
        <Link href="/">受付ダッシュボードへ戻る</Link>
        {" ／ "}
        <Link href="/patients">患者検索へ</Link>
      </p>
    </section>
  );
}
