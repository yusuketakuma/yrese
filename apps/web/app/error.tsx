"use client";

import { useEffect } from "react";

import { ErrorNotice } from "./components/error-notice";

/**
 * 業務画面共通のエラー境界(WP-3007 / SCR-013)。
 *
 * 予期しない例外でも「何が起きたか・次に何をすべきか」をテキストで表示する。
 * error object は message / stack に限らず任意の property に PHI・技術詳細や
 * throwing accessor を含みうるため参照しない。console には固定signalだけを記録する。
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
    console.error("route error");
  }, [error]);

  return (
    <section className="route-error" aria-label="画面エラー">
      <ErrorNotice
        severity="ERROR"
        message="画面の処理中に予期しないエラーが発生しました。"
        nextAction="「再試行」を押してください。解消しない場合はシステム管理者へ連絡してください。"
      />
      <button type="button" onClick={reset} style={{ marginTop: "var(--space-3)" }}>
        再試行
      </button>
    </section>
  );
}
