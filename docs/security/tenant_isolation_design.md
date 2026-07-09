# tenant_isolation_design — テナント分離設計

```yaml
ssot_id: SEC-006
title: マルチテナント / 薬局単位分離設計
domain: security
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.2.0 §33(全項目)
depends_on:
  - docs/security/threat_model.md(SEC-003)
impacts:
  - apps/api(WP-2002 tenant-context 以降の全バックエンド実装)
open_questions:
  - single-tenant option の提供条件(大手法人向け)— 経営判断
  - DB 分離方式の最終決定(Phase 1: 行レベル分離 + RLS を第一候補、テナント別スキーマ/DB は要件次第)
  - data_residency 属性の粒度(現時点は東京リージョン固定で単一値)
blockers: []
```

## 原則

**薬局間・法人間のデータ混在は重大事故として扱う(v0.2.0 §33)。**
分離は「アプリ層の注意」ではなく、型・API・DB・鍵・バックアップ・監査・サポートの各層で強制する。

## 分離の各層(§33 必須項目対応)

| 層 | 設計 | 実装状態 |
|---|---|---|
| 型(コード) | `TenantId` / `PharmacyId` は branded type — 素の string と混用不可 | ◎ `@yrese/shared-kernel`(9ab039e) |
| リクエストコンテキスト | 全 API リクエストに tenantId + pharmacyId + actorId + scopes を必須付帯。コンテキスト不在は deny-by-default で 403 | ○ 開発スタブ実装済み(WP-2002/WP-4066 — 実認証は BLOCKED_SECURITY_REVIEW) |
| クエリ層 | repository は tenant_id / pharmacy_id を必須引数とし、無条件全件クエリを型で禁止(Phase 1 設計) | 未実装 |
| DB | Aurora PostgreSQL: 全テーブルに tenant_id + pharmacy_id、RLS(行レベルセキュリティ)を第一候補【Phase 1 決定】 | 未実装 |
| 暗号鍵 | KMS: テナント別 CMK または鍵階層で暗号鍵分離(§33 encryption key separation) | 未実装 |
| バックアップ | テナント単位で復元可能な構造(backup tenant separation)。他テナント混入なしを restore テストで検証 | 未実装 |
| 監査 | 監査ログに tenant_id / pharmacy_id を必須付帯(tenant-aware audit log)。テナント越え検索は当社特権+監査対象 | 設計(SEC-007) |
| サポートアクセス | tenant-aware support access: サポートは対象テナントに限定したセッションで、全操作監査(§9.2) | 未着手 |
| Edge Node | Edge は単一薬局(pharmacy_id 固定)にプロビジョニング。他薬局データを保持しない | 設計(ADP-002) |
| 請求 | claim_owner / facility_basis_version をテナント文脈で管理(§33) | 未実装 |
| 解約 | tenant offboarding: データ返却→削除→削除証跡(data_portability_exit_plan, WP-0010) | 未着手 |

## テストによる強制(§33 / §36)

1. **tenant isolation test**: テナントAの資格情報でテナントBのリソース ID を直接指定 → 全 API で 404/403 になることを網羅的に検証(存在秘匿のため 404 を第一候補)
2. **cross-tenant access test**: 検索・一覧・集計・帳票・エクスポート・Webhook 配信でテナント越え結果が混入しないこと
3. **backup separation test**: テナント単位リストアで他テナントデータが含まれないこと
4. **audit separation test**: テナント管理者が閲覧できる監査ログが自テナント分に限られること
5. これらを CI(統合テスト層)の必須ゲートとし、失敗時はリリース不可(release_gate_policy)

## 実装ルール(バックエンド WP への適用)

- 新規テーブル・新規 API・新規クエリは、tenant_id / pharmacy_id を持たない設計を **レビューで自動 CHANGES_REQUESTED** とする
- 「システム全体」を対象とする操作(マスター配布・監視)は明示的に `scope: system` の特権 API に分離し、通常テナント API と混在させない
- テナント越えバグは severity critical(医療安全リスク台帳 SAF-001 と連動)

### 開発用テナントコンテキスト・スタブの起動条件(WP-4066)

本番/未知環境で呼び出し側供給の `x-dev-*` ヘッダから `TenantContext` を作らせないため、開発用スタブは **明示 opt-in の allow-list** でのみ起動する(deny-by-default)。テナント権限は常に trusted な認可コンテキストから取得し、呼び出し側 payload/ヘッダを権限の根拠にしない、という本書の原則の具体的強制点である。

- **環境設定起動の 4 条件(`main.ts` → `resolveTenantContextMode`・すべて AND)**: `YRESE_ALLOW_DEV_TENANT_STUB=true`(完全一致)/ `NODE_ENV` が `development` または `test`(完全一致)/ 解決済み repositoryMode が `in_memory` / `DATABASE_URL` 不在。**環境からの通常起動**ではこの4条件成立時のみ `dev_headers` mode が解決され `x-dev-*` から `TenantContext` を構成する(4条件の完全な allow-list はこの起動経路で強制する)。
- **既定は無効**: flag 未設定/完全一致 `false` は**環境・ストレージに関わらず静かに無効**(protected route は `tenantContext` 不在で deny-by-default=403)。**stub 有効化を試みた場合のみ**(flag が未設定/完全一致 `false` 以外)、malformed 値または unsafe combination(`NODE_ENV` が development/test 以外・repositoryMode が非 in_memory・`DATABASE_URL` 有)を**固定の値非露出 startup error で loud に停止**する。
- **合成不能の構造化 + composition guard**: `postgres + dev_headers` は server 構築前に不能(config resolver が throw)。plugin は policy-free(環境判定を持たない・明示 mode option のみ)。auth と persistence の決定は単一解決で `buildServer` へ渡り drift しない。`buildServer` の `tenantContextMode` は既定 `disabled`(default-closed)であり、直接 `buildServer` 呼び出し(テスト等)で `dev_headers` を渡す場合も少なくとも `repositoryMode` が `in_memory` でなければ構築前に throw する(persistent repo + dev-header の合成を composition 層でも遮断)。完全な4条件は環境起動経路で強制し、直接 `buildServer` は in_memory 再チェックに留まる(テストは合成 in_memory only の明示 helper 経由)。
- **回帰の証明**: 攻撃者供給ヘッダは default-closed server で 403 かつ **repository 呼び出し 0 回**(data 層未到達)をテストで固定する。本番認証は BLOCKED_SECURITY_REVIEW 継続。
- 実装/検証は apps/api の `resolveTenantContextMode` / tenant-context plugin / `buildServer`(WP-4066・commit 137315d・CI green・opus4.8 レビュー APPROVED)。

## 変更履歴

- 0.1.1 (2026-07-10): 「実装ルール」に開発用テナントコンテキスト・スタブの起動 4 条件 allow-list(WP-4066)を記録。本書の「テナント権限は trusted 認可コンテキストからのみ取得し呼び出し側 payload/ヘッダを根拠にしない」原則の具体的強制点。設計変更でなく、landing 済み・opus4.8 レビュー済み(commit 137315d)の制御の文書化。
- 0.1.0 (2026-07-09): 初版(構築プロンプト v0.2.0 §33)。人間レビュー承認済み。
