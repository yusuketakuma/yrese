# idempotency_policy — 横断 Idempotency 方針

```yaml
ssot_id: API-013
title: 横断 Idempotency 方針
domain: api
status: PROPOSED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - security_critic
  - privacy_compliance_reviewer
  - human_review_required
version: 0.1.0
created_at: 2026-08-23
updated_at: 2026-08-23
approved_at: null
approved_by: null
effective_from: null
effective_to: null
source_refs: [構築プロンプト v0.2.0 §11(Integration Hub / Partner API / JAHIS)・§14(API-first)・§18(データ主権), PRD-001 M12, API-002, API-003, API-005]
depends_on: [API-006, API-008, API-012, MOD-009, DB-005]
impacts: [apps/api, packages/contracts, packages/events]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_WRITE_PRODUCER_PREREQUISITES: partner からの FHIR create の冪等は単一 producer 前提の解除後に実装する(Inbox は非 authority 提出のみ)
  - BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY: key と応答 fingerprint の保持期間は retention policy 確定まで未定
```

## 1. 原則(DEVELOPMENT_POLICY.md §6 を横断規則化)

- retryable な create は **安定した `Idempotency-Key`** を持ち、expected version を要求しない。
- update / correction は **`If-Match`(expected version)** を必須とし、retryable なら `Idempotency-Key` も持つ。
- 同一 key + 同一 body fingerprint → 初回と同じ応答(201/200 等価)。同一 key + 異なる body → `409` conflict。key 不在 → `400`。
- key の scope は `(tenant, pharmacy, partner_or_actor, operation)`。partner 間で key 空間を共有しない。
- `Idempotency-Key` は opaque とし `[A-Za-z0-9_-]{16,128}` で検証する。非適合は `400`。key と応答 fingerprint を log・metric label・raw error に出さない(PHI を key に入れる client を構造的に拒否する)。
- 保存する応答は元 resource と同じ PHI classification・暗号化・tenant scope を継承する(応答再生は PHI キャッシュである)。

## 2. 適用面

| 面 | 既存 | 本方針での扱い |
|---|---|---|
| `POST /reception` | API-006(BUG-4260 で再試行間の key 安定化済み) | 本方針の基準実装 |
| FHIR create/update | API-008 §4 | 同一規則。`If-None-Exist` は採用しない |
| Inbox 受信(非 authority 提出のみ) | なし | FHIR create と同一規則(`Idempotency-Key`)。署名 event_id は replay 検知に使うが冪等鍵ではない。重複は受理済み応答を返し副作用なし |
| Webhook 配送 | なし | event_id を受信側の冪等鍵とする。再送は同一 event_id |
| Export/Import | なし | import dry-run は job_id で冪等 |

## 3. 保持

- key と応答 fingerprint の保持期間は retention policy(BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY と同じ枠)で決める。保持期限切れ後の再送は新規として扱われうることを contract に明記する。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
