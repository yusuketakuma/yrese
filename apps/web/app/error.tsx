"use client";

import { useEffect } from "react";

import { ErrorNotice } from "./components/error-notice";

/**
 * 業務画面共通のエラー境界(WP-3007 / SCR-013)。
 *
 * 予期しない例外でも「何が起きたか・次に何をすべきか」をテキストで表示する。
 * error.message / スタックトレースは PHI・技術詳細を含みうるため画面に出さず、
 * console にも error.name / digest のみを記録する(message は PHI を含みうるため
 * 出力しない — 医療情報の平文ログ禁止)。digest は Next.js が生成する参照コード。
 *
 * severity は ERROR(技術・システム層)。CRITICAL は患者安全事象に温存する(UIX-001 §5)。
 */

export default function RouteError({
  error,
  reset,
}: {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}) {
  useEffect(() => {
    console.error("route error", { name: error.name, digest: error.digest });
  }, [error]);

  return (
    <section className="route-error" aria-label="画面エラー">
      <ErrorNotice
        severity="ERROR"
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
