# event_envelope_schema — イベントエンベロープスキーマ

```yaml
ssot_id: MOD-009
title: イベントエンベロープスキーマ
domain: modules
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §32(同期設計の必須項目), §0.0.3.3
depends_on:
  - packages/events(85bd3aa)
  - docs/architecture/recovery_sync_design.md(ARC-002)
open_questions:
  - dead_letter 時の deadLetterReason 必須化(WP-1006 レビューノートの deferred 事項 — Outbox 実装時に追加)
  - schemaVersion の互換性ポリシー(minor互換/major非互換の判定基準 — Outbox/Inbox 実装時)
  - payloadHash の正規化規約(ペイロード直列化の canonical form — 実装時に確定)
blockers: []
```

**現在の正本は `@yrese/events` の実装である。** EventEnvelope は Cloud Core / Pharmacy Edge Node 間同期(Outbox/Inbox)の共通封筒であり、監査イベント(MOD-008)の基底でもある。変更は本SSOT改版 → opus4.8 レビュー → 実装。

## 1. フィールド(v0.1.7 §32 対応 — 実装済み)

| フィールド | 型 | 検証(createEventEnvelope) |
|---|---|---|
| eventId / tenantId / pharmacyId | branded ID | 非空 |
| deviceId? / actorId? | branded ID | 指定時のみ非空 |
| aggregateId / aggregateType | string | 非空 |
| sequenceNumber / logicalClock | **bigint** | 非負(aggregate 単位の単調増加は Outbox 実装側の責務) |
| wallClock | string | ISO instant(タイムゾーン付き)必須。**呼び出し側供給 — new Date() 既定値なし** |
| idempotencyKey | string | 非空(二重適用防止) |
| causationId? / correlationId | EventId | correlation 必須・causation 任意 |
| schemaVersion | number | 正の安全整数 |
| payloadHash | string | sha-256 hex 小文字64桁(ハッシュ計算は呼び出し側) |
| phiClassification | 'none'/'phi'/'pii'/'phi_pii' | — |
| encryptionStatus | 'plaintext_forbidden'/'encrypted' | **不変条件: phiClassification≠'none' → 'encrypted' 必須(違反は throw)** |
| syncStatus | 'pending'/'sent'/'acknowledged'/'failed'/'dead_letter' | — |
| retryCount | number | 非負安全整数 |
| deadLetterReason? | string | 指定時のみ非空 |

出力は Object.freeze による immutable。

## 2. 設計原則

- 二重送信・順序逆転・重複適用・部分同期・競合を**前提**とする(§32)。冪等性は idempotencyKey、順序は sequenceNumber/logicalClock、追跡は correlation/causation で担保
- PHI を平文で封筒に載せる経路を型と実行時の双方で遮断(SEC-004 の最小化統制)
- 監査イベント(MOD-008 / SEC-007)は本封筒を基底に auditEventType / targetRef / outcome / prevHash / entryHash を拡張する

## 3. 未実装(本スキーマの消費者)

Outbox / Inbox の永続化・再送・DLQ・競合検出は未実装(ARC-002 の工程 R1〜R6 に従い、Edge Node 設計の Phase で WP 化)。実装時に本SSOTの open_questions(dead_letter 不変条件・canonical form・互換性ポリシー)を確定し改版する。
