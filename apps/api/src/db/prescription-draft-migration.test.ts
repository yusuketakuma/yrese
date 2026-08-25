import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migrationPath = resolve(
  process.cwd(),
  "../../migrations/000013_create_prescription_drafts.sql",
);

describe("000013 prescription draft DDL", () => {
  it("keeps prescription content structured and scoped to the exact reception-patient pair", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("CREATE TABLE prescription_drafts");
    expect(sql).toContain("CREATE TABLE prescription_draft_rows");
    expect(sql).toContain("CREATE TABLE prescription_draft_flags");
    expect(sql).toContain("prescription_drafts_reception_patient_fk");
    expect(sql).toContain(
      "UNIQUE (tenant_id, pharmacy_id, reception_id, patient_id, business_date)",
    );
    expect(sql).toContain(
      "UNIQUE (tenant_id, pharmacy_id, reception_id)",
    );
    expect(sql).not.toMatch(/\bJSONB?\b/i);
  });

  it("bounds draft versions, rows, flags, text, and lifecycle state", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("version BETWEEN 1 AND 2147483647");
    expect(sql).toContain("row_sequence BETWEEN 1 AND 100");
    expect(sql).toContain("char_length(note) <= 2000");
    expect(sql).toContain("lifecycle_status IN ('SERVER_SAVED')");
    expect(sql).toContain("'LEFTOVER_ADJUSTMENT'");
  });

  it("does not backfill, delete, or mutate existing clinical records", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/\bUPDATE\s+(patients|reception_entries)\b/i);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(patients|reception_entries)\b/i);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+(patients|reception_entries)\b/i);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/i);
  });
});
