"use client";

import { useEffect, useState } from "react";

import type { HealthResponse } from "@yrese/contracts";

import { fetchAdminHealth } from "../admin/admin-data";
import { MetricCard, type OperatorTone } from "../components/operator-ui";

/**
 * クラウドAPI稼働確認カード(WP-5101)。
 *
 * `GET /health` の実応答だけを表示する。ヘルス応答は「APIプロセスに到達できた」
 * ことの確認であり、同期・外部連携・システムモードの正常性を意味しない
 * (truthfulness 原則 — 応答なしは未確認であり障害断定もしない)。
 */

export type CloudHealthState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly health: HealthResponse }
  | { readonly kind: "error" };

export function cloudHealthMetric(state: CloudHealthState): {
  readonly value: string;
  readonly detail: string;
  readonly tone: OperatorTone;
} {
  if (state.kind === "ready") {
    return {
      value: "応答あり",
      detail: `${state.health.service} v${state.health.version} が応答(稼働確認のみ。同期状態ではありません)`,
      tone: "info",
    };
  }
  if (state.kind === "error") {
    return {
      value: "未確認",
      detail: "ヘルスAPIに到達できません。障害とは断定せず未確認として扱います。",
      tone: "warning",
    };
  }
  return { value: "確認中", detail: "ヘルスAPIへ問い合わせ中", tone: "info" };
}

export function CloudHealthCard() {
  const [state, setState] = useState<CloudHealthState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    fetchAdminHealth(fetch, controller.signal)
      .then((health) => setState({ kind: "ready", health }))
      .catch(() => {
        if (!controller.signal.aborted) setState({ kind: "error" });
      });
    return () => controller.abort();
  }, []);

  const metric = cloudHealthMetric(state);
  return (
    <MetricCard
      label="クラウド（yrese）"
      value={metric.value}
      detail={metric.detail}
      tone={metric.tone}
      icon="雲"
    />
  );
}
