# screen_inventory_draft — 画面台帳(ドラフト)

```yaml
ssot_id: UIX-007
title: 画面台帳
domain: uiux
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - security_auditor
  - data_integrity_reviewer
  - privacy_compliance_reviewer
  - medical_safety_reviewer
  - human_product_authority
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-29
approved_at: 2026-07-29
approved_by: direct_user_instruction (human pharmacist/product authority, 2026-07-29); independent_verifier APPROVED; security_auditor APPROVED; data_integrity_reviewer APPROVED; privacy_compliance_reviewer APPROVED; medical_safety_reviewer APPROVED
effective_from: 2026-07-29
effective_to: null
source_refs:
  - docs/spec/construction_prompt_v0.2.0.md §16
  - docs/plan/phase0_plan.md §5
  - docs/uiux/workflow_map.md
  - direct_user_instruction 2026-07-29 (user-facing audit confirmation is unnecessary)
depends_on:
  - UIX-001 medical_ui_ux_principles
  - SEC-007 audit_log_design
  - PRC-007 ssot_governance
impacts:
  - apps/web/app/admin
  - docs/plan/uiux_development_plan.md
related_work_packages:
  - WP-4254
related_tests:
  - pnpm --filter @yrese/web test
  - pnpm --filter @yrese/web typecheck
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-29 SCR-028をactive product screenから廃止。監査イベント生成・権限制御API・append-only保全・改ざん検知はSEC-007境界として維持
  - 0.1.0 2026-07-09 初版をhuman reviewで承認
open_questions:
  - 権限scopeの粒度(疑義照会・会計の専用scope要否)は permission_scope_registry で確定【要確認】
  - 画面統合の可否(SCR-006/007/008 の1画面化等)は Phase 1 設計で判断
blockers: []
```

本台帳は `ux_safety_level` を次のように定義する: U0=UI影響なし / U1=通常UI / U2=業務導線に影響 / U3=医療安全・請求事故に影響 / U4=患者取り違え・薬剤師確認・外部未確認状態・請求確定に影響。構築プロンプト v0.2.0 §16 のUI/UX・患者安全優先事項を、この台帳で実行可能な分類へ具体化したものである。

scope は実装済み `@yrese/shared-kernel` permissions.ts(9ab039e)の `resource:action` 形式。**【要確認】付きは registry 未確定の仮割当**。

| ID | 画面 | 目的 | 主要状態表示 | 権限scope(仮) | U | 実装状態 |
|---|---|---|---|---|---|---|
| SCR-001 | 受付ダッシュボード | 受付キュー・本日の業務起点 | システムモード / 受付状態 | patient:read | U2 | ルート `/` shell 済み(12a5ac2) |
| SCR-002 | 患者検索・患者選択 | 患者特定 | 同姓同名警告 / 類似候補区別 | patient:read | U4 | ルート `/patients` shell 済み(2b195b5) |
| SCR-003 | 患者取り違え防止表示(横断) | 患者文脈の常時明示 | 氏名カナ・生年月日・年齢・性別 | — (横断) | U4 | PatientHeader 実装済み(1acfa3f) |
| SCR-004 | 処方入力 | RP単位の処方登録 | 仮/確定・薬剤師確認前 | prescription:write | U4 | ルート `/prescriptions` shell 済み |
| SCR-005 | 処方箋2次元シンボル読取 | JAHIS 2Dシンボル仮取込 | 仮取込 / 照合未了 / 読取エラー | prescription:write | U4 | 未実装(JAHIS Ver.1.11 evidence 待ち) |
| SCR-006 | 電子処方箋受付 | 引換番号による受付 | 取得状態 / PENDING_EXTERNAL_SYNC | prescription:write | U4 | BLOCKED(ONS: WP-0016) |
| SCR-007 | 患者・保険・公費確認 | 適用保険・公費の確認 | 有効期限 / 負担割合 / 要確認 | insurance:read, public-expense:read | U4 | 未実装 |
| SCR-008 | オンライン資格確認結果 | 資格確認結果の表示・取込 | VERIFIED / PENDING_REVERIFY / 最終確認日時 | insurance:read | U4 | 状態表示のみ PatientHeader に実装済み。画面は BLOCKED(ONS) |
| SCR-009 | PMH確認結果 | 医療費助成確認状態 | PENDING_PMH_REVERIFY | public-expense:read | U3 | BLOCKED(PMH仕様) |
| SCR-010 | 調剤入力 | 調剤内容・変更記録 | 薬剤師確認前 / 残薬調整記録 | dispensing:write | U4 | 未実装 |
| SCR-011 | 算定結果 | 点数・負担金の提示 | 仮算定/確定・警告・BLOCKER | calculation:read | U3 | 未実装(算定エンジン BLOCKED) |
| SCR-012 | calculation_trace 表示 | 金額根拠の説明可能性 | マスター版・ルール版・evidence | calculation:read | U3 | WP-3011aでfixture-only read contract/viewer component実装済み。live endpoint・tenant/permission・route結線はWP-3011b/c待ちでBLOCKED |
| SCR-013 | 警告・エラー・BLOCKER表示(横断) | 重要度別警告(UIX-001 §5) | BLOCKER/CRITICAL/WARNING/INFO | — (横断) | U4 | 未実装 |
| SCR-014 | 薬剤師確認 | 専門的判断の記録 | 確認者・日時・確認前後区別 | dispensing:confirm | U4 | 未実装 |
| SCR-015 | 疑義照会記録 | 照会内容・回答の記録 | 照会中 / 回答済み / 処方訂正 | prescription:write【要確認】 | U3 | 未実装 |
| SCR-016 | 会計 | 一部負担金請求・収納 | 確定額 / 仮精算(LOCAL_ONLY) | calculation:read【要確認】 | U3 | ルート `/checkout` shell 済み |
| SCR-017 | 未収・返金・差額精算 | 差額の管理 | 未収 / 返金 / 差額根拠 | claim:write【要確認】 | U3 | 未実装 |
| SCR-018 | 帳票出力 | 領収証・明細書・薬袋等 | 出力履歴 / 再出力 / 印刷失敗 | report:write | U3 | 未実装 |
| SCR-019 | 請求前点検 | レセプト前の点検 | 点検結果 / 請求不可一覧 | claim:read | U3 | ルート `/claim-check` shell 済み |
| SCR-020 | 月次締め | 請求月の確定・ロック | 締め状態 / RECOVERY_SYNC未了ブロック | claim:finalize | U4 | ルート `/monthly-closing` shell 済み(NORMALのみ許可 = allowsClaimFinalization) |
| SCR-021 | レセプト出力 | 電子レセプト生成・受け渡し | 生成状態 / 検証結果 / ロック | claim:finalize | U4 | BLOCKED(記録条件仕様 evidence — WP-0015 進行中) |
| SCR-022 | 返戻・再請求管理 | 返戻の追跡・再請求 | 返戻理由 / 再請求状態 / 履歴 | claim:write | U3 | 未実装 |
| SCR-023 | マスター更新管理 | 版・有効日・検証状態 | PENDING_MASTER_VALIDATION / 版差異 | master:admin | U3 | ルート `/masters` shell 済み |
| SCR-024 | 外部連携状態 | 各 Adapter の稼働状態 | EXTERNAL_DEGRADED 詳細 | sync:read | U2 | 未実装 |
| SCR-025 | 同期状態 | Cloud/Edge 同期・キュー | バックログ / queue age / 失敗 | sync:read | U2 | ルート `/sync-status` shell 済み |
| SCR-026 | LOCAL_ONLY モード画面 | 可能/不可能操作の明示 | 禁止操作一覧+理由 / 仮状態件数 | — (横断) | U4 | WP-3010aで3 shared guardのfixture-only禁止/未禁止基盤実装済み。全28操作/16禁止・live mode・件数・routeはWP-3010b/c待ちでBLOCKED |
| SCR-027 | RECOVERY_SYNC 画面 | 要再検証一覧・競合解決 | 未解消件数 / CONFLICT_REQUIRES_HUMAN_REVIEW | sync:confirm【要確認】 | U4 | 未実装 |
| SCR-029 | 管理者・権限管理 | ユーザー・ロール・薬局設定 | 権限変更履歴 | user:admin, tenant:admin | U3 | ルート `/admin` shell 済み |

## 廃止済み画面ID

| ID | 旧画面 | 状態 | 保持する境界 |
|---|---|---|---|
| SCR-028 | 監査ログ | RETIRED — 一般業務Webの監査確認画面は提供しない。WP-4254でsource削除・local検証済み(landing未要求)。IDは履歴・既存契約参照の互換用に予約し、再利用しない | SEC-007に従い、監査イベント生成、`audit-log:read`、権限制御された監査API、append-only保存、hash-chain検証を維持する |

## 運用ルール

- U3/U4 画面の実装WPは、AGT-018に従うread-only mapper / pre-plan reviewer / sole maintainer / independent verifierに加え、medical safety・privacy・accessibilityのrelevant reviewerと必要なhuman authorityの事前確認を受ける
- 画面追加・統合は本台帳を更新してから実装する(台帳にない画面の実装禁止)
- 「実装状態」列は実装WP完了時にコミットハッシュ付きで更新する
- 廃止済みIDは再利用しない。SCR-028の互換参照は監査APIの存続を表すだけで、Web閲覧画面の実装根拠にしない
