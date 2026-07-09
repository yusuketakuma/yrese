"use client";

import { useEffect } from "react";

import { ErrorNotice } from "./components/error-notice";

/**
 * 業務画面共通のエラー境界(WP-3007 / SCR-013)。
 *
 * 予期しない例外でも「何が起きたか・次に何をすべきか」をテキストで表示する。
 * error.message / スタックトレースは PHI・技術詳細を含みうるため画面に出さない
 * (技術詳細は console のみ。digest は Next.js が生成する参照コードで PHI を含まない)。
 */

export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section className="route-error" aria-label="画面エラー">
      <ErrorNotice
        severity="CRITICAL"
        message="画面の処理中に予期しないエラーが発生しました。"
        nextAction="「再試行」を押してください。解消しない場合はシステム管理者へ連絡してください。"
      />
      {error.digest !== undefined && (
        <p className="route-error-digest">参照コード: {error.digest}</p>
      )}
      <button type="button" onClick={reset}>
        再試行
      </button>
    </section>
  );
}
