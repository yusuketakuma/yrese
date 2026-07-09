CREATE TABLE schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL,
  applied_by TEXT NOT NULL,
  CONSTRAINT schema_migrations_version_non_empty CHECK (length(version) > 0),
  CONSTRAINT schema_migrations_name_non_empty CHECK (length(name) > 0),
  CONSTRAINT schema_migrations_checksum_sha256_format CHECK (checksum_sha256 ~ '^[a-f0-9]{64}$'),
  CONSTRAINT schema_migrations_applied_by_non_empty CHECK (length(applied_by) > 0)
);
