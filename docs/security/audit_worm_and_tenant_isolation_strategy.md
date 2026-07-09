# audit_worm_and_tenant_isolation_strategy — 監査WORM・テナント分離戦略

```yaml
ssot_id: SEC-008
title: 監査ログの改竄耐性(WORM)とテナント分離の戦略
domain: security
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.2.0 §15(監査ログ・WORM・マルチテナント)
depends_on:
  - docs/security/audit_log_design.md(SEC-007 — ハッシュチェーンの正本)
  - docs/security/tenant_isolation_design.md(SEC-006)
  - docs/modules/audit_event_registry.md(MOD-008)
  - docs/architecture/claim_finalization_immutability_policy.md(ARC-007)
  - packages/audit(WP-2003、opus4.8 事後レビュー APPROVED)
impacts:
  - WP-2009(audit hash-chain canonicalization / hydrate split)
  - 監査ログ永続化実装(未着手)
open_questions:
  - 物理 WORM の要否判定に用いる法令・GL 要求の確定(REG-003 と同期)
  - 監査ログの保存期間別ストレージ階層(SEC-007 open_question を継承)
blockers:
  - BLOCKED_SECURITY_REVIEW(物理 WORM・KMS・DB 分離方式の確定はセキュリティレビュー完了後)
```

## 1. 目的と位置づけ

監査ログの改竄耐性(tamper-evidence / WORM)とテナント分離を、**論理層の規律**と**物理層の候補構成**に分けて確定する。
ハッシュチェーンの技術定義は SEC-007 が正本であり、本書はそれを変更しない。テナント分離の設計正本は SEC-006 であり、本書は監査ログ観点の戦略を追加する。

## 2. 論理層規律(実装可 — インフラ非依存)

1. **append-only**: 監査ログに更新・削除 API を実装しない(実装しようとした時点で CHANGES_REQUESTED)。訂正が必要な場合も新イベントの追記で表現する(ARC-007 と同型)。
2. **tamper-evident**: SEC-007 の `entryHash = H(prevHash ‖ 正規化ペイロード)` を正とする。canonical 化・entryHash 計算・hydrate 時の検証は WP-2009 が実装する。
3. **偽ハッシュ供給の禁止**(WP-2003 opus4.8 レビュー申し送りの規律化): WP-2009 完了までの間、呼び出し側が任意の hex を prevHash / entryHash に渡して「改竄耐性がある」ように見せる本番配線を作らない。裏付けのない tamper-evidence の訴求は fail-closed で禁止。
4. **tenant-aware**: 全監査イベントに tenant_id / pharmacy_id を必須付帯(SEC-006)。テナント越えの監査ログ検索は当社特権操作とし、それ自体を監査イベントにする。

## 3. 物理層は候補構成(確定しない)

コアは特定インフラを前提にしない(ARC-004 と同型の原則)。以下は候補であり、採用確定は BLOCKED_SECURITY_REVIEW の解除後。

| 層 | 候補 | 位置づけ |
|---|---|---|
| WORM ストレージ | S3 Object Lock(compliance mode)等 | 論理 append-only の**追加防御**。論理層規律の代替にしない |
| 鍵管理 | KMS(テナント別キー or キー階層) | PHI 暗号化(MOD-009 の encrypted 不変条件)の鍵運用候補 |
| DB 行レベル分離 | Aurora PostgreSQL RLS 等 | SEC-006 Phase 1 第一候補の追認。現行の正はアプリ層 deny-by-default であり、RLS は多層防御の追加として評価 |

採用確定の前提条件(全て満たすまで確定しない):
1. 法令・GL 上の保存要件の確定(REG-003 / SEC-007 open_question の解消)
2. コスト・運用(リストア演習含む)の評価
3. LOCAL_ONLY / RECOVERY_SYNC 時の Edge 側チェーン維持(SEC-005 #11)との整合確認
4. セキュリティレビュー(BLOCKED_SECURITY_REVIEW 解除)

## 4. break-glass(緊急アクセス)

- 緊急時のテナント越え・権限外アクセス(break-glass)を行う場合も、**監査イベント必須**・**businessReason 必須**(MOD-008 の cancel/void 系と同水準)・**事後レビュー必須**とする。
  この businessReason 必須は現行 MOD-008 registry では breakglass 系イベントに構造強制されていないため、**MOD-008 の businessReasonRequiredEventTypes へ breakglass 系を追加する改版(WP-2010)で fail-closed に強制する**。改版完了までは本規律を運用ルールとして扱い、break-glass の実装自体を開始しない。
- break-glass 用の恒常的なバックドア権限を作らない。発動は都度・時限とし、発動自体と終了を監査イベントにする。
- 監査イベントを残せない状態での break-glass は実行しない(fail-closed)。

## 5. 停止条件(fail-closed)

- 監査ログの更新・削除 API の実装 → 実装禁止(レビューで自動 CHANGES_REQUESTED)
- 裏付け(WP-2009 の計算・検証)なしの改竄耐性・WORM の対外訴求 → 禁止
- 任意 hex を真正性証跡として受け入れる本番配線 → 禁止(§2-3)
- tenant_id / pharmacy_id を持たない監査イベント → MOD-008 実行時拒否を維持
- 物理 WORM・KMS・RLS の製品確定 → BLOCKED_SECURITY_REVIEW 解除まで BLOCKED

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を現行 v0.2.0 の実節 §15 へ修正、break-glass businessReason の構造強制経路を MOD-008 改版 = WP-2010 として明記)。
- 0.1.0 (2026-07-09): 初版起草(WP-0047)。SEC-007 を正本としたうえで論理/物理の分離、break-glass 監査必須、偽ハッシュ供給禁止を規律化。
