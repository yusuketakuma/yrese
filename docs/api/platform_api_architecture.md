# platform_api_architecture — 公開 API 構造方針

```yaml
ssot_id: API-003
title: 公開 API(Open Rececon Platform)の構造方針
domain: api
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §14(API-first)・§5(Open Rececon Platform)・§11(Integration Hub), PRD-006(柱4), PRD-007(§4 facade), PRD-009(戦い4)]
depends_on: [API-002, PRD-007, DOM-005, DOM-006, SEC-004(PIA), OPS-005(SLA/SLO)]
impacts: [API-004, API-005, WP-0036(Integration Hub), packages/contracts, apps/api]
blockers:
  - BLOCKED_PERFORMANCE_SLO: rate limit / quota / 可用性の具体数値は OPS-005 系確定まで定めない
  - BLOCKED_OFFICIAL_ADAPTER_BOUNDARY: 公的接続系を公開 API で代替・再公開しない
```

## 1. 目的とスコープ

外部パートナー(電子薬歴・PHR・BI・在宅・partner SaaS 等)へ提供する公開 API の
構造方針を定める。個別エンドポイントの契約は API-001 と同様に 1 契約 = 1 SSOT で
起案し、本書はその共通土台とする。

**スコープ外**: オン資・電子処方箋・オンライン請求・PMH・JAHIS(DOM-006 §4 の
置換禁止レーン)。公的接続の結果データを公開 API で再公開する場合も、canonical model
経由の投影(DOM-005)としてのみ行い、公式インターフェースの代替を提供しない。

## 2. 認可・テナント境界

1. **deny-by-default**: すべての公開 API は requirePermission 配下。scope 未付与は 403。
   匿名アクセス可能な業務 API を作らない。
2. **テナント境界**: すべてのリクエストはテナント文脈(tenant_id + pharmacy_id)に拘束される。
   ページネーション cursor 等の継続トークンもテナント境界に拘束する(API-001 §5 の一般化)。
3. **PHI**: PHI を含むレスポンスは `Cache-Control: no-store`・平文ログ禁止(SEC-004)。
   パートナーへの PHI 提供は、同意・契約・法令整理(QUA-008 と同系の前提条件)が
   整うまで各契約 SSOT で BLOCKED とする。

## 3. rate limit / quota(方針のみ)

- テナント単位・API キー単位の rate limit / quota を設ける方針とする。
- **具体数値は本書では定めない**(BLOCKED_PERFORMANCE_SLO。OPS-005 系の改版で確定)。
- 超過時は 429 + 明示のエラーコード(error_code_registry へ事前登録)で fail-closed に拒否する。

## 4. バージョニング

1. **破壊的変更は新バージョン**: 既存フィールドの削除・型変更・意味変更は新バージョンの
   契約 SSOT として起案する(DOM-006 §3 の改版規律と同型)。既存バージョンの silent 変更は禁止。
2. **後方互換な追加**(optional フィールド追加等)は同一バージョン内の改版とし、
   契約 SSOT の version を上げて変更履歴に記録する(PRC-007)。
3. **廃止手順**: 旧バージョンの廃止は「非推奨宣言 → 移行期間(パートナー通知)→ 停止」の
   3 段階とし、期間・通知方法は Integration Hub SSOT(WP-0036)で確定する。
   予告なしの停止は行わない(24/365 原則 ARC-010 と整合)。

## 5. 停止条件(fail-closed)

- 契約 SSOT(APPROVED)のないエンドポイント公開 → API_CONTRACT_BLOCKED
- 公的接続系の代替 API 提供 → BLOCKED_OFFICIAL_ADAPTER_BOUNDARY
- rate limit / quota の数値を根拠なく実装へ埋め込む → BLOCKED_PERFORMANCE_SLO
- 既存バージョンの破壊的 silent 変更 → SSOT_UPDATE_REQUIRED

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §14/§5/§11 へ修正)。
- 0.1.0 (2026-07-09): 初版起草(WP-0046)。PRD-007 impacts の前方参照を解消。
