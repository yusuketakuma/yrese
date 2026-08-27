"use client";

import { useOptionalOperatorPreferences, type OperatorView } from "./operator-preferences";
import { Panel, StatusPill, TableScroll } from "./operator-ui";

export interface OperatorFocusItem {
  readonly id: string;
  readonly label: string;
  readonly status: "WIRED" | "UNAVAILABLE";
  /**
   * 未取得の理由。UNAVAILABLE の項目は「どの API / どのゲートで止まっているか」を
   * 必ず名指しする(件数を 0 と読ませないため)。
   */
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
      detail:
        "GET /reception/queue に配線済み。件数は下の受付キューの実データから集計します。",
      href: "#reception-live-queue",
    },
    {
      id: "drafts",
      label: "入力中の下書き",
      status: "UNAVAILABLE",
      detail:
        "処方下書きは受付ID単位の GET /prescription-drafts/by-reception/:receptionId のみで、横断集計APIが未提供です。0件ではなく導出不能です。",
    },
    {
      id: "documents",
      label: "帳票失敗",
      status: "UNAVAILABLE",
      detail:
        "帳票ジョブAPI(SCR-018 report:read / report:write)が未実装です。0件ではなく導出不能です。",
    },
    {
      id: "receivables",
      label: "未収",
      status: "UNAVAILABLE",
      detail:
        "未収・返金・差額API(SCR-017)が未実装です。0件ではなく導出不能です。",
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
      detail:
        "薬剤師確認API(SCR-014 dispensing:confirm)が未実装です。空キューではなく導出不能です。",
    },
    {
      id: "inquiry",
      label: "疑義照会中",
      status: "UNAVAILABLE",
      detail: "疑義照会API(SCR-015)が未実装です。0件ではなく導出不能です。",
    },
    {
      id: "revalidation",
      label: "要再検証",
      status: "UNAVAILABLE",
      detail:
        "資格再検証はオンライン資格確認の接続(REG-004 RB-002 BLOCKED_REGULATORY_REVIEW)で停止中です。0件ではなく導出不能です。",
    },
    {
      id: "critical",
      label: "CRITICAL警告",
      status: "UNAVAILABLE",
      detail:
        "臨床判定エンジン(SCR-013)が未接続です。警告が表示されないことは安全確認済みを意味しません。",
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
      description="業務ビューは表示順だけを変えます。患者安全情報とAPI権限は変わりません。件数が出ない行は0件ではなく導出不能です。"
      className="operator-focus-board"
    >
      <div
        className={
          groups.length > 1
            ? "operator-focus-grid operator-two-column"
            : "operator-focus-grid operator-stack"
        }
        data-view={view}
      >
        {groups.map((group) => (
          <section
            className="operator-focus-group operator-stack"
            data-group={group.id}
            key={group.id}
          >
            <h4>{group.title}</h4>
            <TableScroll label={`${group.title}の対象一覧。横方向にスクロールできます`}>
              <table className="operator-table operator-table-dense">
                <caption className="operator-table-caption">
                  {group.description}
                </caption>
                <thead>
                  <tr>
                    <th scope="col">対象</th>
                    <th scope="col">件数・導線</th>
                    <th scope="col">根拠</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} data-status={item.status}>
                      <th scope="row">{item.label}</th>
                      <td>
                        {item.status === "WIRED" && item.href !== undefined ? (
                          <a
                            className="operator-button"
                            data-kind="secondary"
                            href={item.href}
                          >
                            キューへ移動
                          </a>
                        ) : (
                          <>
                            <span aria-hidden="true">—</span>
                            <StatusPill tone="warning">未接続・件数不明</StatusPill>
                          </>
                        )}
                      </td>
                      <td>{item.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroll>
          </section>
        ))}
      </div>
    </Panel>
  );
}
