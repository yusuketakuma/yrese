import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  OPERATOR_VIEWS,
  OperatorPreferencesProvider,
  useOptionalOperatorPreferences,
} from "./operator-preferences";

(globalThis as { React?: typeof React }).React = React;

function Projection() {
  const preferences = useOptionalOperatorPreferences();
  return <span>{preferences?.view ?? "none"}</span>;
}

describe("operator display preferences", () => {
  it("defines display projections without implying authorization roles", () => {
    expect(OPERATOR_VIEWS).toEqual(["combined", "clerk", "pharmacist"]);
    const html = renderToStaticMarkup(
      <OperatorPreferencesProvider initialView="pharmacist">
        <Projection />
      </OperatorPreferencesProvider>,
    );
    expect(html).toContain("pharmacist");
    expect(html).not.toContain("permission");
    expect(html).not.toContain("authorized");
  });

  it("is optional for consumers that safely default to the combined projection", () => {
    expect(renderToStaticMarkup(<Projection />)).toContain("none");
  });
});
