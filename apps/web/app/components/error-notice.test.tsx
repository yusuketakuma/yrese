import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import RouteError from "../error";
import { registeredErrorCodeOrUndefined } from "./error-code";
import { ErrorNotice } from "./error-notice";

(globalThis as { React?: typeof React }).React = React;

describe("cross-screen error display (WP-3007 / SCR-013)", () => {
  it("ErrorNotice pairs error code with next action as alert", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        errorCode="AUTH-0003"
        message="権限がありません。"
        nextAction="管理者に権限の付与状況を確認してください。"
      />,
    );

    expect(html).toContain('role="alert"');
    expect(html).toContain('data-error-code="AUTH-0003"');
    expect(html).toContain("権限がありません。(エラーコード: AUTH-0003)");
    expect(html).toContain("次のアクション: 管理者に権限の付与状況を確認してください。");
    expect(html).toContain("[エラー(ERROR)]");
  });

  it("ErrorNotice without registered code renders no error-code attribute", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        severity="WARNING"
        message="検索語が入力されていません。"
        nextAction="氏名・カナ・患者番号のいずれかを入力してください。"
      />,
    );

    expect(html).not.toContain("data-error-code");
    expect(html).not.toContain("エラーコード:");
    expect(html).toContain("[警告(WARNING)]");
    expect(html).toContain("次のアクション: 氏名・カナ・患者番号のいずれかを入力してください。");
  });

  it("filters API error codes to registered shared-kernel values", () => {
    expect(registeredErrorCodeOrUndefined("AUTH-0003")).toBe("AUTH-0003");
    expect(registeredErrorCodeOrUndefined("SYSTEM-9999")).toBeUndefined();
    expect(registeredErrorCodeOrUndefined("<script>alert(1)</script>")).toBeUndefined();
    expect(registeredErrorCodeOrUndefined(403)).toBeUndefined();
  });

  it("ErrorNotice renders BLOCKER severity with text label", () => {
    const html = renderToStaticMarkup(
      <ErrorNotice
        severity="BLOCKER"
        message="この操作は根拠不足のため停止しています。"
        nextAction="SSOT の改版を依頼してください。"
      />,
    );

    expect(html).toContain('data-severity="BLOCKER"');
    expect(html).toContain("[停止(BLOCKER)]");
    expect(html).toContain("次のアクション: SSOT の改版を依頼してください。");
  });

  it("uses a polite status role for WARNING/INFO but an assertive alert role for ERROR/BLOCKER (§11.4-18)", () => {
    const warning = renderToStaticMarkup(
      <ErrorNotice severity="WARNING" message="確認してください。" nextAction="確認する。" />,
    );
    const info = renderToStaticMarkup(
      <ErrorNotice severity="INFO" message="参考情報です。" nextAction="なし。" />,
    );
    const error = renderToStaticMarkup(
      <ErrorNotice severity="ERROR" message="失敗しました。" nextAction="再試行。" />,
    );
    const blocker = renderToStaticMarkup(
      <ErrorNotice severity="BLOCKER" message="停止中です。" nextAction="SSOT 改版。" />,
    );

    // 警告過多を避けるため WARNING/INFO は status(polite 含意)
    expect(warning).toContain('role="status"');
    expect(warning).not.toContain('role="alert"');
    expect(info).toContain('role="status"');
    // 重大側は alert(assertive 含意)で埋没させない
    expect(error).toContain('role="alert"');
    expect(blocker).toContain('role="alert"');
  });

  it("RouteError never leaks error.message or stack to the screen", () => {
    const error = Object.assign(new Error("PHI-LIKE-SECRET 山田太郎"), {
      digest: "abc123",
    });
    const html = renderToStaticMarkup(<RouteError error={error} reset={() => {}} />);

    expect(html).not.toContain("PHI-LIKE-SECRET");
    expect(html).not.toContain("山田太郎");
    expect(html).toContain("予期しないエラーが発生しました");
    expect(html).toContain("次のアクション:");
    expect(html).toContain("参照コード: abc123");
    expect(html).toContain("再試行");
    // 技術例外は ERROR(CRITICAL は患者安全事象に温存 — UIX-001 §5)
    expect(html).toContain("[エラー(ERROR)]");
    expect(html).not.toContain("CRITICAL");
  });
});
