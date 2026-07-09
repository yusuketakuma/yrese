# error_code_registry — エラーコードレジストリ

```yaml
ssot_id: MOD-006
title: エラーコードレジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.3, §7(エラー表示原則)
depends_on:
  - packages/shared-kernel error-codes.ts(KERNEL_ERROR_CODES seed)
open_questions:
  - エラーコードとUI表示文言(次に何をすべきか)の対応表の管理場所(UIX-001 と連動)
blockers: []
```

**構造の正本は `@yrese/shared-kernel` error-codes.ts、個別コードの正本は本レジストリである。** コードの新設は本SSOTへの行追加 → レビュー → 実装の順で行い、コード側での無登録コード発行を禁止する。

## 1. 構造(実装済み)

- 形式: `^[A-Z]{2,10}-\d{4}$`(例: CALC-0001)。isValidErrorCode で検証
- severity(5種): INFO / WARNING / ERROR / BLOCKER / CRITICAL
- domain(15種): RECEPTION / PATIENT / INSURANCE / PUBLIC_EXPENSE / PRESCRIPTION / DISPENSING / CALCULATION / CLAIM / REPORT / MASTER / SYNC / EXTERNAL_ADAPTER / AUTH / AUDIT / SYSTEM
- ErrorCodeDef: code / domain / severity / affectsClaimability / requiresHumanReview / description(**PHI禁止**)
- ErrorCodeRegistry クラス: 形式検証+重複登録拒否

## 2. 医療UIとの関係(v0.1.7 §7)

エラーは「何が危険か」「何を確認するか」「請求できるか」を伝える。ErrorCodeDef の affectsClaimability / requiresHumanReview がその機械可読表現であり、UI表示文言そのものは frontend 所有(backend は文言モジュールへ依存しない — MOD-002)。

## 3. 採番規約

- domain 短縮プレフィックス: RCPT / PAT / INS / PUBEX / RX / DISP / CALC / CLAIM / RPT / MST / SYNC / EXTAD / AUTH / AUDIT / SYS(【要確認】— 初回コード群登録時に確定)
- 0001〜 連番。欠番の再利用禁止。廃止コードは deprecated として本台帳に残す

## 4. 登録済みコード

| code | domain | severity | affectsClaimability | requiresHumanReview | 説明 | 状態 |
|---|---|---|---|---|---|---|
| AUTH-0003 | AUTH | ERROR | false | false | 権限不足・コンテキスト不在(403)。deny-by-default の一律応答 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / apps/api errorResponseSchema) |
| PAT-0001 | PATIENT | ERROR | false | false | 患者検索クエリ不正(400)。q/limit/cursor の契約違反や cursor 境界不一致 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-001 patient search) |

(初期セットは `KERNEL_ERROR_CODES` seed として登録済み。今後の拡充は、各ドメイン実装WPの DoR で「使用するエラーコードが本台帳に登録済みであること」を要求することで行う)

## 5. 変更手順

1. 必要コードの提案(WP の CODEX_PLAN / FRONTEND_PLAN で申告)
2. fable5 が本台帳へ行追加(severity・affectsClaimability・requiresHumanReview を確定)
3. opus4.8 レビュー(affectsClaimability=true または severity≥BLOCKER のコード)
4. 実装(ErrorCodeRegistry へ register)
5. UI 文言対応表(frontend)を UIX-001 原則に沿って整備
