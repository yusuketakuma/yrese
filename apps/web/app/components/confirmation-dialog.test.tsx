import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ConfirmationDialog, DestructiveActionDialog } from "./confirmation-dialog";

(globalThis as { React?: typeof React }).React = React;

describe("ConfirmationDialog (P-11 二段階確認)", () => {
  it("renders nothing when closed", () => {
    expect(
      renderToStaticMarkup(
        <ConfirmationDialog open={false} title="確定" message="よろしいですか" />,
      ),
    ).toBe("");
  });

  it("re-presents the patient and provides explicit confirm/cancel (取り違え防止)", () => {
    const html = renderToStaticMarkup(
      <ConfirmationDialog
        open
        title="薬歴を確定します"
        message="この操作後は訂正扱いになります"
        patientLabel="ヤマダ タロウ(1980-01-01)"
        confirmLabel="確定する"
      />,
    );
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("対象患者: ヤマダ タロウ(1980-01-01)");
    expect(html).toContain("確定する");
    expect(html).toContain("キャンセル");
  });
});

describe("DestructiveActionDialog", () => {
  it("uses alertdialog role, shows impact and severity tone", () => {
    const html = renderToStaticMarkup(
      <DestructiveActionDialog
        open
        title="記録を削除します"
        message="この操作は取り消せません"
        impact="関連する調剤録も参照できなくなります"
        severity="CRITICAL"
        patientLabel="サトウ ハナコ"
      />,
    );
    expect(html).toContain('role="alertdialog"');
    expect(html).toContain('data-severity="CRITICAL"');
    expect(html).toContain("影響: 関連する調剤録も参照できなくなります");
    expect(html).toContain("対象患者: サトウ ハナコ");
  });

  it("defaults severity to WARNING", () => {
    const html = renderToStaticMarkup(
      <DestructiveActionDialog open title="取消" message="戻します" impact="下書きが消えます" />,
    );
    expect(html).toContain('data-severity="WARNING"');
  });
});
