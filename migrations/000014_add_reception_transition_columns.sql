-- WP-7201 / API-006 0.3.x: 受付状態遷移(transitions)の CAS・監査列。
-- reception_status CHECK は 000002 で既に4値を包含するため変更しない。
-- version は遷移ごとに単調増加し expectedVersion+If-Match の CAS 対象となる。
-- cancel_reason は MOD-008 構造化理由コード(自由記述禁止)を保持し、
-- CANCELLED と非 CANCELLED で NULL 制約を相互排他にする。

ALTER TABLE reception_entries
  ADD COLUMN version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN status_changed_at TIMESTAMPTZ,
  ADD COLUMN cancel_reason TEXT;

ALTER TABLE reception_entries
  ADD CONSTRAINT reception_entries_version_positive CHECK (version >= 1);

ALTER TABLE reception_entries
  ADD CONSTRAINT reception_entries_cancel_reason_exclusive CHECK (
    (reception_status = 'CANCELLED') = (cancel_reason IS NOT NULL)
  );
