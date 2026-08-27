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
 * 確認は取得時点のスナップショットであるため、必ず確認時刻を併記して
 * 古い確認を現在の状態と誤読させない(受付キューの loadedAt と同じ規律)。
 */

export type CloudHealthState =
  | { readonly kind: "loading" }
  | { readonly kind: "ready"; readonly health: HealthResponse; readonly checkedAt: string }
  | { readonly kind: "error"; readonly checkedAt: string };

/**
 * ヘルス確認1回分の結果を状態へ写像する(表示副作用から分離してテスト可能にする)。
 * abort 済みの確認は状態を変えない(null)。後続の確認を古い結果で上書きしない。
 */
export async function resolveCloudHealthState(
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
  now: () => Date = () => new Date(),
): Promise<CloudHealthState | null> {
  try {
    const health = await fetchAdminHealth(fetchImpl, signal);
    if (signal?.aborted === true) return null;
    return { kind: "ready", health, checkedAt: now().toISOString() };
  } catch {
    if (signal?.aborted === true) return null;
    return { kind: "error", checkedAt: now().toISOString() };
  }
}

/**
 * 取得時刻を運用者のローカル時刻 HH:MM で示す(同期状態画面が共通で使う)。
 * 時刻の無い状態表示は「いつの値か」を失い、古い値が現在値として読まれる。
 */
export function checkedAtLabel(checkedAt: string): string {
  const at = new Date(checkedAt);
  if (Number.isNaN(at.getTime())) return "確認時刻不明";
  const hh = String(at.getHours()).padStart(2, "0");
  const mm = String(at.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}時点`;
}

export function cloudHealthMetric(state: CloudHealthState): {
  readonly value: string;
  readonly detail: string;
  readonly tone: OperatorTone;
} {
  if (state.kind === "ready") {
    return {
      value: "応答あり",
      detail: `${checkedAtLabel(state.checkedAt)}: ${state.health.service} v${state.health.version} が応答(稼働確認のみ。同期状態ではありません)`,
      tone: "info",
    };
  }
  if (state.kind === "error") {
    return {
      value: "未確認",
      detail: `${checkedAtLabel(state.checkedAt)}: ヘルスAPIに到達できません。障害とは断定せず未確認として扱います。`,
      tone: "warning",
    };
  }
  return { value: "確認中", detail: "ヘルスAPIへ問い合わせ中", tone: "info" };
}

export function CloudHealthCard() {
  const [state, setState] = useState<CloudHealthState>({ kind: "loading" });

  useEffect(() => {
    const controller = new AbortController();
    void resolveCloudHealthState(fetch, controller.signal).then((next) => {
      if (next !== null) setState(next);
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
