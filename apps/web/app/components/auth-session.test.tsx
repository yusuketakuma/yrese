import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LoginForm,
  SessionExpiryWarning,
  computeSessionStatus,
} from "./auth-session";

(globalThis as { React?: typeof React }).React = React;

describe("computeSessionStatus (R-AUTH)", () => {
  const now = 1_000_000;
  it("is ACTIVE when far from expiry", () => {
    expect(computeSessionStatus(now + 10 * 60_000, now)).toBe("ACTIVE");
  });
  it("is EXPIRING_SOON within the warn window", () => {
    expect(computeSessionStatus(now + 60_000, now)).toBe("EXPIRING_SOON");
  });
  it("is EXPIRED at or past expiry", () => {
    expect(computeSessionStatus(now, now)).toBe("EXPIRED");
    expect(computeSessionStatus(now - 1, now)).toBe("EXPIRED");
  });
});

describe("SessionExpiryWarning (H-10 セッション切れで入力消失)", () => {
  it("renders nothing while ACTIVE", () => {
    expect(renderToStaticMarkup(<SessionExpiryWarning status="ACTIVE" />)).toBe("");
  });

  it("warns before expiry with extend guidance and preserves unsaved work", () => {
    const html = renderToStaticMarkup(
      <SessionExpiryWarning status="EXPIRING_SOON" remainingLabel="あと1分" hasUnsavedWork />,
    );
    expect(html).toContain("まもなく失効");
    expect(html).toContain("あと1分");
    expect(html).toContain("下書きとして保全されます");
    expect(html).toContain("延長");
  });

  it("uses alert role and reauth guidance when expired", () => {
    const html = renderToStaticMarkup(<SessionExpiryWarning status="EXPIRED" />);
    expect(html).toContain('role="alert"');
    expect(html).toContain("再度サインイン");
  });
});

describe("LoginForm", () => {
  it("renders username/password fields without leaking credentials in errors", () => {
    const html = renderToStaticMarkup(
      <LoginForm action="/api/auth/login" errorMessage="サインインに失敗しました" />,
    );
    expect(html).toContain('name="staffId"');
    expect(html).toContain('type="password"');
    expect(html).toContain('autoComplete="current-password"');
    expect(html).toContain("サインインに失敗しました");
    expect(html).toContain('role="alert"');
  });
});
