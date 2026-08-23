# data_sharing_policy — Data Sharing 方針(同意・最小化・目的)

```yaml
ssot_id: API-017
title: Data Sharing 方針(同意・最小化・目的)
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
depends_on: [API-010, API-011, SEC-004, SEC-007, REG-003, MOD-009]
impacts: [API-012, API-016, API-018]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_PRIVACY_REVIEW: 第三者提供・委託・本人同意の法的整理(個人情報保護法・医療ガイダンス)は privacy/legal review 後に確定
  - BLOCKED_LEGAL_REVIEW
  - BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT: consent.* 監査種別
```

## 1. 原則

- 共有は **目的 × 相手 × データ分類 × 法的根拠** の 4 つ組で定義し、定義にない共有は行わない。
- data minimization: event は識別子のみ、本文は scope 付き read。read 応答も要求 scope の分類を超えない。
- 本人同意が必要な共有(マイナ保険証経由の薬剤情報・特定健診情報の閲覧、患者アプリ連携等)は同意記録を前提とし、同意の有無・範囲・撤回を監査する(WP-6305)。
- 共有先での二次利用・再共有は契約で禁止し、契約のない partner を `ACTIVE` にしない。
- 共有ごとに共有先での保持上限と、撤回時の停止範囲(以後の read/配送停止・DLQ 破棄・共有先への削除要請)を定義に含める。同意記録・撤回の監査は `consent.*` 種別の MOD-008 登録が前提。

## 2. 共有クラス(候補)

| クラス | 例 | 法的根拠の候補(privacy review で確定) | 同意 |
|---|---|---|---|
| 委託(処理の外部化) | 電子薬歴 SaaS、処方監査 API | 委託契約 | 不要(委託先監督)※要配慮個人情報の取得局面の同意とは別問題。privacy review 論点 |
| 第三者提供 | 医療機関へのトレーシングレポート | 本人同意 or 法令 | 要 |
| 本人提供 | 電子版お薬手帳 export、患者 export | 本人の求め | 本人操作 |
| 公的基盤 | オン資・電子処方箋・PMH | 法令・制度 | 制度に従う |

## 3. 禁止

- 本番 PHI の sandbox・fixture・subagent・外部 model への送出。
- 目的外の結合(例: 在庫向け projection に患者識別子を含める)。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
