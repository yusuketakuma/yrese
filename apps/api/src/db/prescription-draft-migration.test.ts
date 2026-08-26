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
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*tenant_id,\s*pharmacy_id,\s*reception_id,\s*patient_id,\s*business_date\s*\)/u,
    );
    expect(sql).toMatch(
      /UNIQUE\s*\(\s*tenant_id,\s*pharmacy_id,\s*reception_id\s*\)/u,
    );
    expect(sql).not.toMatch(/\bJSONB?\b/iu);
  });

  it("bounds draft versions, rows, flags, and text", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).toContain("version BETWEEN 1 AND 2147483647");
    expect(sql).toContain("row_sequence BETWEEN 1 AND 100");
    expect(sql).toContain("char_length(note) <= 2000");
    expect(sql).not.toContain("lifecycle_status");
    expect(sql).toContain("'LEFTOVER_ADJUSTMENT'");
  });

  it("does not backfill, delete, or mutate existing clinical records", async () => {
    const sql = await readFile(migrationPath, "utf8");

    expect(sql).not.toMatch(/\bUPDATE\s+(patients|reception_entries)\b/iu);
    expect(sql).not.toMatch(/\bDELETE\s+FROM\s+(patients|reception_entries)\b/iu);
    expect(sql).not.toMatch(/\bINSERT\s+INTO\s+(patients|reception_entries)\b/iu);
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|COLUMN)\b/iu);
  });
});
