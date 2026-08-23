# adapter_registry — Adapter Registry(登録・版・状態)

```yaml
ssot_id: ADP-003
title: Adapter Registry(登録・版・状態)
domain: adapters
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
depends_on: [ADP-001, ADP-002, JHS-003, API-009, API-018, REG-004, REG-001]
impacts: [API-014, API-015, packages]
related_work_packages: [WP-6001, WP-0036]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-08-23 WP-6001 初版起案(PROPOSED)。direct user instruction 2026-08-23(情報連携主軸)と Plans.md §16 Track A に基づく。実装根拠にしない"
open_questions: []
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_SPEC: 公式仕様未登録の adapter は `STUB` を超えて進めない
  - BLOCKED_NSIPS_LICENSE: NSIPS adapter は登録自体を凍結
```

## 1. 目的

ADP-001(Official Adapter 台帳)と JHS-003(JAHIS Adapter 台帳)が定義する adapter を、**実行時に参照できる登録簿**として一元化する。未登録 adapter は Hub(API-009)から呼び出せない。

## 2. レコード

| field | 内容 |
|---|---|
| adapter_id | ADP-A1 等(ADP-001 / JHS-003 の ID をそのまま使う) |
| spec_source_id | REG-001 の `SRC-*` ID。未登録なら `UNREGISTERED` |
| spec_version | 公式仕様の版(source_registry に一致) |
| adapter_version | yrese 側実装の semver |
| state | `STUB`(境界契約のみ)/ `SANDBOX`(公式 sandbox 接続試験中)/ `CERTIFIED`(接続試験合格・human gate 済)/ `SUSPENDED` |
| blockers | REG-004 の RB-ID |
| boundary_ssot | 境界 SSOT(`online_qualification_boundary.md` 等)の ID と status |

## 3. 状態遷移の gate

- `STUB → SANDBOX`: spec_source_id が VERIFIED、境界 SSOT APPROVED、RB 行解除。
- `SANDBOX → CERTIFIED`: 公式接続試験の結果 evidence、security review、human approval。
- `CERTIFIED` でも conformance 主張は別 human gate(JHS-002 / WP-6112 / WP-6210)。

## 4. 初期登録(全件 STUB 未満 = 登録のみ)

ADP-A1(オン資)、ADP-A2(電子処方箋)、ADP-A3(電子レセプト)、ADP-A4(PMH)、JAHIS-2D、JAHIS-YAKUREKI、JAHIS-OKUSURI(JHS-003 の ID を registry の正とし、ADP-001 の ADP-A5 はこの 2 件を束ねる umbrella として registry 行を持たない)。ADP-A6(NSIPS)は登録凍結。

## 共通原則(全 Integration Hub SSOT に適用)

- tenant_id / pharmacy_id / partner_id / scope は認証済み trusted context 由来とし、request body や query の値を authority にしない(DEVELOPMENT_POLICY.md §6)。
- PHI classification(MOD-009 `phiClassification`)を全 payload に付与し、`none` 以外は暗号化・監査・data minimization を必須とする。PHI を URL、key、metric label、log、raw error に含めない。
- 本 SSOT は契約・方針であり、実装 allow-list ではない。実装は contract-first(`packages/contracts` → generated artifact → consumer → test 同期)で、該当 WP と human gate を経る。
- 未知の partner、scope、event、version、署名、状態は fail-closed で拒否する。
- 本文書は standards-conformance、production readiness、external send の authorization を与えない。
