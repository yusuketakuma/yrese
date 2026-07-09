# claim_finalization_immutability_policy — 請求確定後の不変性

```yaml
ssot_id: ARC-007
title: 確定済みレセプト・請求の immutability(append-only・訂正レーン分離)
domain: architecture
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.2.0 §18
  - ARC-005 / ARC-006 / CAL-007(請求可否)/ MOD-008(監査)/ ACC 系(append-only 台帳)
depends_on: [ARC-005, ARC-006, CAL-007, MOD-008, CLM-001]
impacts: [請求確定・返戻再請求の実装WP, QUA-009, WP-0047(WORM)]
open_questions:
  - 返戻・再請求の業務イベント語彙(オンライン請求の公式仕様確認後に確定 — BLOCKED_OFFICIAL_ADAPTER_SPEC)
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_SPEC: 返戻データの受領形式・再請求手続の詳細は公式仕様入手まで確定不可
  - 物理層の WORM(S3 Object Lock 等)・改竄検知は WP-0047 / SEC-007 改版で確定
```

## 1. 目的と結論

請求確定(レセプト確定・月次締め)以降のデータ不変性を確定する。

**結論: 確定済みレセプト・請求データは append-only であり、更新・削除 API を持たない。訂正は「返戻・再請求」等の別レーンの新レコード(新イベント)としてのみ表現する。silent fix は禁止。**

## 2. 確定の意味

1. 請求確定は明示的な業務イベント(確定者・確定日時・対象請求月・使用ルールセット版/マスター版の参照を含む)として記録する(ARC-005 の ES 適用対象)。
2. 確定は NORMAL モードでのみ許可する(shared-kernel `allowsClaimFinalization` が実装済みの正)。他モードでの確定要求は fail-closed に拒否する。
3. 確定前の請求前点検で CAL-007 の請求可否判定(isClaimable = allow-list)を通過しないものは確定対象に含めない。

## 3. 不変性の規律

1. **更新・削除 API を作らない**。確定済みレセプトのレコードに対する UPDATE/DELETE 相当の操作は、アプリケーション層に存在させない(誤操作・不正の経路を構造的に断つ)。
2. **訂正 = 別レーンの新レコード**。返戻への対応・取下げ・再請求は、元の確定レコードを参照する新しい業務イベント(訂正レーン)として追加する。元レコードには「後続イベントあり」の参照が導出できる(投影側で表現 — ARC-006)。
3. **silent fix 禁止**。確定内容の誤りが判明した場合も、修正は必ず訂正レーンのイベントとして記録し、businessReason を必須とする(MOD-008 の cancel/void/adjust 系 businessReason 必須と同じ規律)。
4. **監査イベント必須**。確定・訂正レーンの各操作は MOD-008 の監査イベント(correlationId 必須)を伴う。監査イベントなしの確定・訂正は実装違反。
5. 帳票(領収証等)との整合: 確定済み請求に紐づく発行済み帳票の訂正・再発行は RCP 系 SSOT(再発行・取消ポリシー)に従い、本書はレセプトデータ側の不変性のみを定める。

## 4. 物理層への委譲

論理層(本書)の append-only に加え、物理層の改竄耐性(WORM ストレージ・S3 Object Lock・ハッシュ連鎖・保持期間)は WP-0047(audit_worm_and_tenant_isolation_strategy)と SEC-007 改版で確定する。**物理層の確定を待たずに論理層の規律は先行して有効**とする(実装は本書 APPROVED 後に可能、物理 WORM は後付け強化)。

## 5. 停止条件(fail-closed)

- 確定済みレコードへの更新・削除経路の実装 → 実装禁止(レビューゲートで拒否)
- NORMAL 以外のモードでの請求確定 → 実行時拒否(allowsClaimFinalization)
- businessReason・監査イベントなしの訂正 → 実行時拒否(MOD-008)
- 返戻データ形式の推測実装 → BLOCKED_OFFICIAL_ADAPTER_SPEC
- 訂正レーン語彙の SSOT 未確定のままの実装着手 → SSOT_UPDATE_REQUIRED

## 変更履歴

- 0.1.0 (2026-07-09): 初版起草(WP-0044)。
