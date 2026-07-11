import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import GlobalError from "./global-error";
import Loading from "./loading";
import NotFound from "./not-found";

(globalThis as { React?: typeof React }).React = React;

describe("cross-cutting state files (App Router / 監査 S-01)", () => {
  it("loading.tsx announces the loading state to assistive tech", () => {
    const html = renderToStaticMarkup(<Loading />);
    expect(html).toContain("読み込み中…");
    expect(html).toContain('role="status"');
    expect(html).toContain('aria-busy="true"');
  });

  it("not-found.tsx shows a generic message + next action + recovery links (P-19)", () => {
    const html = renderToStaticMarkup(<NotFound />);
    expect(html).toContain("お探しのページが見つかりません");
    expect(html).toContain("次のアクション:");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/patients"');
    expect(html).toContain('role="alert"');
  });

  it("global-error.tsx renders a self-contained alert without leaking the error message (PHI 非出力)", () => {
    const phiLikeMessage = "患者 ヤマダ タロウ の処理で失敗: patient-secret-001";
    const error = Object.assign(new Error(phiLikeMessage), { digest: "digest-abc" });
    const html = renderToStaticMarkup(<GlobalError error={error} reset={() => undefined} />);

    expect(html).toContain("予期しない重大なエラー");
    expect(html).toContain("次のアクション:");
    expect(html).toContain("参照コード: digest-abc");
    // 致命エラーでも error.message(PHI を含みうる)は画面に出さない
    expect(html).not.toContain(phiLikeMessage);
    expect(html).not.toContain("patient-secret-001");
    // 独自の html/body を持つ(root layout を置換するため)
    expect(html).toContain("<html");
    expect(html).toContain("<body");
  });
});
