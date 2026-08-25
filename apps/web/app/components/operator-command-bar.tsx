"use client";

import Link from "next/link";
import { type ChangeEvent, type FormEvent, useMemo, useState } from "react";

interface CommandIntent {
  readonly label: string;
  readonly href: string;
  readonly rationale: string;
}

const INTENTS: readonly {
  readonly keywords: readonly string[];
  readonly intent: CommandIntent;
}[] = [
  {
    keywords: ["受付", "処方箋", "qr", "電子処方箋", "取り込"],
    intent: { label: "受付を開く", href: "/", rationale: "受付・処方箋取込に関する指示" },
  },
  {
    keywords: ["患者", "検索", "生年月日", "患者番号"],
    intent: { label: "患者検索を開く", href: "/patients", rationale: "患者検索・患者選択に関する指示" },
  },
  {
    keywords: ["処方", "薬", "用法", "用量", "日数", "疑義", "残薬"],
    intent: { label: "処方入力を開く", href: "/prescriptions", rationale: "処方内容の確認・編集に関する指示" },
  },
  {
    keywords: ["会計", "負担金", "領収", "返金", "未収"],
    intent: { label: "会計を開く", href: "/checkout", rationale: "会計・患者負担に関する指示" },
  },
  {
    keywords: ["請求", "レセプト", "点検", "エラー"],
    intent: { label: "請求前点検を開く", href: "/claim-check", rationale: "請求前点検に関する指示" },
  },
  {
    keywords: ["月次", "締め", "返戻", "再請求"],
    intent: { label: "月次締めを開く", href: "/monthly-closing", rationale: "月次締め・返戻に関する指示" },
  },
  {
    keywords: ["マスター", "薬価", "医薬品"],
    intent: { label: "マスターを開く", href: "/masters", rationale: "マスター情報に関する指示" },
  },
  {
    keywords: ["同期", "障害", "連携", "ステータス"],
    intent: { label: "同期状態を開く", href: "/sync-status", rationale: "外部連携・同期状態に関する指示" },
  },
  {
    keywords: ["管理", "ユーザー", "権限", "設定"],
    intent: { label: "管理・設定を開く", href: "/admin", rationale: "管理・設定に関する指示" },
  },
];

export function resolveOperatorIntent(command: string): CommandIntent | null {
  const normalized = command.trim().toLowerCase();
  if (!normalized) return null;

  let best: { score: number; intent: CommandIntent } | null = null;
  for (const candidate of INTENTS) {
    const score = candidate.keywords.reduce(
      (sum, keyword) => sum + (normalized.includes(keyword.toLowerCase()) ? 1 : 0),
      0,
    );
    if (score > 0 && (best === null || score > best.score)) {
      best = { score, intent: candidate.intent };
    }
  }
  return best?.intent ?? null;
}

/**
 * 自然言語は画面候補の提示だけに使い、患者・処方・会計・請求データを変更しない。
 * ブラウザ組込み音声認識は処理先・保持・リージョンを保証できないため、承認済みの
 * 音声処理境界が接続されるまで fail-closed で無効化する。
 */
export function OperatorCommandBar() {
  const [command, setCommand] = useState("");
  const [submittedCommand, setSubmittedCommand] = useState("");
  const intent = useMemo(() => resolveOperatorIntent(submittedCommand), [submittedCommand]);

  function submit(event: FormEvent) {
    event.preventDefault();
    setSubmittedCommand(command.trim());
  }

  return (
    <section className="operator-command" aria-label="自然言語クイック操作">
      <form onSubmit={submit} className="operator-command-form">
        <label htmlFor="operator-command-input" className="operator-command-label">
          自然言語で画面を探す
        </label>
        <div className="operator-command-row">
          <span className="operator-command-search-icon" aria-hidden="true">
            ⌕
          </span>
          <input
            id="operator-command-input"
            value={command}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setCommand(event.target.value)}
            placeholder="自然言語で指示してください（例：山田さんを検索して）"
            autoComplete="off"
          />
          <button type="submit" className="operator-command-submit">
            候補
          </button>
          <button
            type="button"
            className="operator-command-voice"
            disabled
            aria-describedby="operator-voice-status"
            title="承認済み音声処理境界の接続前のため利用できません"
          >
            音声
          </button>
        </div>
        <span id="operator-voice-status" className="visually-hidden">
          音声入力は、処理先・保持・リージョンを確認した承認済み音声処理境界の接続前のため利用できません。
        </span>
      </form>

      {submittedCommand ? (
        <div className="operator-command-preview" aria-live="polite">
          {intent ? (
            <>
              <strong>{intent.rationale}</strong>
              <Link href={intent.href}>{intent.label}</Link>
            </>
          ) : (
            <span>安全に解釈できません。左の業務メニューから対象画面を選択してください。</span>
          )}
          <small>この入力だけで患者・処方・会計・請求データは変更されません。</small>
        </div>
      ) : null}
    </section>
  );
}
