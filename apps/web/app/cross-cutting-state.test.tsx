import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import GlobalError from "./global-error";
import Loading from "./loading";
import NotFound from "./not-found";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useEffect: (effect: React.EffectCallback) => effect(),
  };
});

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

  it("global-error.tsx renders recovery UI without reading untrusted error properties", () => {
    const rawSentinels = [
      "患者 ヤマダ タロウ の処理で失敗: patient-secret-001",
      "PHI-LIKE-NAME patient-secret-name",
      "PHI-LIKE-DIGEST patient-secret-digest",
      "PHI-LIKE-STACK patient-secret-stack",
    ];
    let propertyReads = 0;
    const error = new Error() as Error & { digest?: string };
    Object.defineProperties(error, {
      name: {
        configurable: true,
        get() {
          propertyReads += 1;
          throw new Error(rawSentinels[1]);
        },
      },
      digest: {
        configurable: true,
        get() {
          propertyReads += 1;
          throw new Error(rawSentinels[2]);
        },
      },
      message: {
        configurable: true,
        get() {
          propertyReads += 1;
          throw new Error(rawSentinels[0]);
        },
      },
      stack: {
        configurable: true,
        get() {
          propertyReads += 1;
          throw new Error(rawSentinels[3]);
        },
      },
    });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let html: string;
    try {
      html = renderToStaticMarkup(<GlobalError error={error} reset={() => undefined} />);
      expect(consoleError).toHaveBeenCalledOnce();
      expect(consoleError).toHaveBeenCalledWith("global error");
    } finally {
      consoleError.mockRestore();
    }

    expect(propertyReads).toBe(0);
    expect(html).toContain("予期しない重大なエラー");
    expect(html).toContain("次のアクション:");
    expect(html).not.toContain("参照コード");
    for (const sentinel of rawSentinels) {
      expect(html).not.toContain(sentinel);
    }
    expect(html).toContain('<button type="button"');
    expect(html).toContain("margin-top:1rem");
    expect(html).toContain("再試行</button>");
    // 独自の html/body を持つ(root layout を置換するため)
    expect(html).toContain("<html");
    expect(html).toContain("<body");
  });
});
