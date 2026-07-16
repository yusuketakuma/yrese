"use client";

import { useEffect } from "react";

/**
 * ルートレイアウトを含む致命的エラーの最終境界(App Router global-error.tsx / 監査 S-01)。
 *
 * global-error は root layout を置換するため、独自の <html>/<body> を持ち、
 * globals.css のクラスに依存しない自己完結マークアップで表示する。
 * error object は任意の property に PHI・技術詳細や throwing accessor を含みうるため
 * 参照せず、console には固定signalだけを記録する。
 */
export default function GlobalError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error("global error");
  }, [error]);

  return (
    <html lang="ja">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, padding: "1.5rem" }}>
        <section aria-label="重大な画面エラー">
          <div
            role="alert"
            style={{ border: "2px solid #b91c1c", background: "#f8d7da", padding: "0.75rem 1rem", borderRadius: 3 }}
          >
            <p style={{ margin: 0, fontWeight: 700 }}>
              アプリの表示中に予期しない重大なエラーが発生しました。
            </p>
            <p style={{ margin: "0.25rem 0 0", fontWeight: 600 }}>
              次のアクション: 「再試行」を押してください。解消しない場合はシステム管理者へ連絡してください。
            </p>
          </div>
          <button
            type="button"
            onClick={reset}
            style={{ fontSize: "1rem", marginTop: "1rem", padding: "0.4rem 1.2rem" }}
          >
            再試行
          </button>
        </section>
      </body>
    </html>
  );
}
