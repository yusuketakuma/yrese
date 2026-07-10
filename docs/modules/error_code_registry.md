# error_code_registry — エラーコードレジストリ

```yaml
ssot_id: MOD-006
title: エラーコードレジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.2
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §0.0.3.3, §7(エラー表示原則)
depends_on:
  - packages/shared-kernel error-codes.ts(KERNEL_ERROR_CODES seed)
impacts:
  - packages/shared-kernel error-code registry
  - packages/contracts error response validation and OpenAPI error descriptions
  - apps/api registered error responses
  - apps/web registered error-code display filtering
related_work_packages:
  - WP-0012
  - WP-4015
  - WP-4036
  - WP-4062
  - WP-3009-BE
  - WP-9002-W3
related_tests:
  - packages/shared-kernel/src/kernel.test.ts
  - packages/contracts/src/error.test.ts
  - apps/api/src/server.test.ts
  - apps/web/app/components/error-notice.test.tsx
  - apps/web/app/reception-dashboard.test.tsx
  - pnpm check:openapi
related_prs: []
evidence_ids: []
open_questions:
  - エラーコードとUI表示文言(次に何をすべきか)の対応表の管理場所(UIX-001 と連動)
blockers: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W3 metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - 0.1.2 (2026-07-09): WP-3009-BE / API-006 v0.2.0 に基づき、RECEPTION domain の prefix を RCV と確定し、受付キュー API 用 RCV-0001/0002/0003 を登録。
```

**構造の正本は `@yrese/shared-kernel` error-codes.ts、個別コードの正本は本レジストリである。** コードの新設は本SSOTへの行追加 → レビュー → 実装の順で行い、コード側での無登録コード発行を禁止する。

## 1. 構造(実装済み)

- 形式: `^[A-Z]{2,10}-\d{4}$`(例: CALC-0001)。isValidErrorCode で検証
- severity(5種): INFO / WARNING / ERROR / BLOCKER / CRITICAL
- domain(15種): RECEPTION / PATIENT / INSURANCE / PUBLIC_EXPENSE / PRESCRIPTION / DISPENSING / CALCULATION / CLAIM / REPORT / MASTER / SYNC / EXTERNAL_ADAPTER / AUTH / AUDIT / SYSTEM
- ErrorCodeDef: code / domain / severity / affectsClaimability / requiresHumanReview / description(**PHI禁止**)
- ErrorCodeRegistry クラス: 形式検証+重複登録拒否

## 2. 医療UIとの関係(v0.2.0 §7)

エラーは「何が危険か」「何を確認するか」「請求できるか」を伝える。ErrorCodeDef の affectsClaimability / requiresHumanReview がその機械可読表現であり、UI表示文言そのものは frontend 所有(backend は文言モジュールへ依存しない — MOD-002)。

## 3. 採番規約

- domain 短縮プレフィックス: RCV(RECEPTION) / PAT / INS / PUBEX / RX / DISP / CALC / CLAIM / RPT / MST / SYNC / EXTAD / AUTH / AUDIT / SYS(未登録domainの短縮は初回コード群登録時に確定)
- 0001〜 連番。欠番の再利用禁止。廃止コードは deprecated として本台帳に残す

## 4. 登録済みコード

| code | domain | severity | affectsClaimability | requiresHumanReview | 説明 | 状態 |
|---|---|---|---|---|---|---|
| AUTH-0003 | AUTH | ERROR | false | false | 権限不足・コンテキスト不在(403)。deny-by-default の一律応答 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / apps/api errorResponseSchema) |
| PAT-0001 | PATIENT | ERROR | false | false | 患者検索クエリ不正(400)。q/limit/cursor の契約違反や cursor 境界不一致 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-001 patient search) |
| RCV-0001 | RECEPTION | ERROR | false | false | 受付キューリクエスト不正(400)。date 欠落/形式不正/非実在暦日、patientId 不正、idempotencyKey 欠落/形式不正 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |
| RCV-0002 | RECEPTION | ERROR | false | false | 当該テナント・薬局内で受付対象 patientId が存在しない(404)。テナント越え探索は禁止 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |
| RCV-0003 | RECEPTION | ERROR | false | false | idempotencyKey conflict(同一 key + 異なる patientId)(409)。誤患者の受付エントリを返さず fail-closed | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |

(初期セットは `KERNEL_ERROR_CODES` seed として登録済み。今後の拡充は、各ドメイン実装WPの DoR で「使用するエラーコードが本台帳に登録済みであること」を要求することで行う)

## 5. 変更手順

1. 必要コードの提案(WP の CODEX_PLAN / FRONTEND_PLAN で申告)
2. fable5 が本台帳へ行追加(severity・affectsClaimability・requiresHumanReview を確定)
3. opus4.8 レビュー(affectsClaimability=true または severity≥BLOCKER のコード)
4. 実装(ErrorCodeRegistry へ register)
5. UI 文言対応表(frontend)を UIX-001 原則に沿って整備
