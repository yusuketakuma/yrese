"use client";

import { useOptionalOperatorPreferences, type OperatorView } from "./operator-preferences";
import { Panel, StatusPill } from "./operator-ui";

export interface OperatorFocusItem {
  readonly id: string;
  readonly label: string;
  readonly status: "WIRED" | "UNAVAILABLE";
  readonly detail: string;
  readonly href?: string;
}

export interface OperatorFocusGroup {
  readonly id: "clerk" | "pharmacist";
  readonly title: string;
  readonly description: string;
  readonly items: readonly OperatorFocusItem[];
}

const CLERK_GROUP: OperatorFocusGroup = {
  id: "clerk",
  title: "事務フォーカス",
  description: "受付・入力・会計の次作業を前景化します。",
  items: [
    {
      id: "reception-wired",
      label: "受付キュー",
      status: "WIRED",
      detail: "既存API配線あり。稼働状態は実行時応答で確認します。",
      href: "#reception-live-queue",
    },
    {
      id: "drafts",
      label: "入力中の下書き",
      status: "UNAVAILABLE",
      detail: "処方工程API未接続のため、0件とは表示しません。",
    },
    {
      id: "documents",
      label: "帳票失敗",
      status: "UNAVAILABLE",
      detail: "帳票ジョブAPI未接続のため、導出不能です。",
    },
    {
      id: "receivables",
      label: "未収",
      status: "UNAVAILABLE",
      detail: "会計・未収API未接続のため、導出不能です。",
    },
  ],
};

const PHARMACIST_GROUP: OperatorFocusGroup = {
  id: "pharmacist",
  title: "薬剤師フォーカス",
  description: "確認待ち・疑義・要再検証を前景化します。",
  items: [
    {
      id: "confirmation",
      label: "薬剤師確認待ち",
      status: "UNAVAILABLE",
      detail: "薬剤師確認工程が未接続です。空キューではなく導出不能です。",
    },
    {
      id: "inquiry",
      label: "疑義照会中",
      status: "UNAVAILABLE",
      detail: "疑義照会状態API未接続のため、導出不能です。",
    },
    {
      id: "revalidation",
      label: "要再検証",
      status: "UNAVAILABLE",
      detail: "臨床・資格再検証キューは未接続です。",
    },
    {
      id: "critical",
      label: "CRITICAL警告",
      status: "UNAVAILABLE",
      detail: "臨床判定エンジン未接続。警告なしを安全確認済みと解釈しません。",
    },
  ],
};

export function getOperatorFocusGroups(view: OperatorView): readonly OperatorFocusGroup[] {
  if (view === "clerk") return [CLERK_GROUP];
  if (view === "pharmacist") return [PHARMACIST_GROUP];
  return [CLERK_GROUP, PHARMACIST_GROUP];
}

export function OperatorFocusBoard() {
  const view = useOptionalOperatorPreferences()?.view ?? "combined";
  const groups = getOperatorFocusGroups(view);

  return (
    <Panel
      title="今日の作業フォーカス"
      description="業務ビューは表示順だけを変えます。患者安全情報とAPI権限は変わりません。"
      className="operator-focus-board"
    >
      <div className="operator-focus-grid" data-view={view}>
        {groups.map((group) => (
          <section className="operator-focus-group" data-group={group.id} key={group.id}>
            <header>
              <div>
                <h4>{group.title}</h4>
                <p>{group.description}</p>
              </div>
              <StatusPill tone="info">表示プリセット</StatusPill>
            </header>
            <ul>
              {group.items.map((item) => (
                <li key={item.id} data-status={item.status}>
                  <div>
                    <strong>{item.label}</strong>
                    <p>{item.detail}</p>
                  </div>
                  {item.status === "WIRED" && item.href !== undefined ? (
                    <a href={item.href}>キューへ移動</a>
                  ) : (
                    <StatusPill tone="neutral">未接続・件数不明</StatusPill>
                  )}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}
