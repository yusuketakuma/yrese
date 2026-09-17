# error_code_registry — エラーコードレジストリ

```yaml
ssot_id: MOD-006
title: エラーコードレジストリ
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.7
created_at: 2026-07-09
updated_at: 2026-09-18
approved_at: 2026-09-17
approved_by: "direct human authority 2026-09-17 (SSOT batch 一括 APPROVE); independent review: Devin in-session primary-source cross-check (Oracle 不使用), findings closed in PROPOSED revisions"
effective_from: 2026-09-17
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
  - WP-7201
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
  - "0.1.6 (2026-09-18): WP-7105 — C-021 queue bound 決定(選択肢 b 防御的 cap、direct human approval)に伴い `RCV-0007`(queue 件数が cap 超過 503 + nextAction)を登録"
  - "0.1.7 (2026-09-18): WP-7301/WP-7303 — MST-003 実装に伴い `MST-0001`(master query 不正 400)を実装済みで登録、`MST-0002`(版参照 404)を予約登録。併せて INS-0001〜0006 の stale『未実装』表記を『実装済み(API-020 / WP-7203)』へ訂正"
  - "0.1.5 (2026-09-17): WP-7202 実装着手時の契約ギャップ解消 — write 系 route の 400(ボディ検証失敗・Idempotency-Key/If-Match ヘッダ欠落・異形)に対応するコードが未登録だったため `PAT-0007` を追加。RCV-0006(0.1.4)と同型の実装期ギャップ訂正"
  - "0.1.3 (2026-09-17): §18 SSOT 起案 batch。WP-7201 / API-006 0.3.0 起案に伴い RCV-0004(不許可遷移 409)/ RCV-0005(受付 version conflict 409)、WP-7204 / API-019 起案に伴い INS-0007〜0010(資格確認 snapshot route の 400/404/409/422)、WP-7203 / API-020 起案に伴い INS-0001〜0006(coverage route の 400/404/409 群)、WP-7202 / API-001 0.3.0 起案に伴い PAT-0003(patientNumber 重複 409)/ PAT-0004(version conflict 412)/ PAT-0005(不変 field 変更 422)/ PAT-0006(idempotency conflict 409)を追加提案。併せて shared-kernel に実装済みで台帳未登録だった PAT-0002 の drift を追記登録。review と human approval まで PROPOSED、実装根拠にしない"
  - "0.1.3 (2026-09-17) finalization: direct human approval(SSOT batch 一括 APPROVE)により PROPOSED→APPROVED。承認範囲はエラーコード台帳の登録のみで、実装完了・production action を含まない"
  - "0.1.4 (2026-09-17): WP-7201 実装着手時の契約ギャップ解消 — transitions の受付不存在 404 に対応するコードが未登録だったため `RCV-0006` を追加。direct human approval(RCV-0006 追加の選択)により APPROVED を維持したまま登録"
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
| PAT-0002 | PATIENT | ERROR | false | false | 対象患者が当該テナント・薬局内に存在しない(404)。テナント越え探索は禁止 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-001 patient get。0.1.3 で台帳 drift を追記登録) |
| PAT-0003 | PATIENT | ERROR | false | false | 患者番号重複(409)。(tenant, pharmacy, patientNumber) 一意性違反 | 実装済み(API-001 0.3.x / WP-7202) |
| PAT-0004 | PATIENT | ERROR | false | false | 患者 version conflict(412)。PUT の If-Match/expectedVersion と現在 version の不一致 | 実装済み(API-001 0.3.x / WP-7202) |
| PAT-0005 | PATIENT | ERROR | false | false | 不変 field(patientNumber 等)の変更試行(422)。訂正は identity history / merge 経路 | 実装済み(API-001 0.3.x / WP-7202) |
| PAT-0006 | PATIENT | ERROR | false | false | idempotencyKey conflict(同一 key + 異なる patient payload)(409) | 実装済み(API-001 0.3.x / WP-7202) |
| PAT-0007 | PATIENT | ERROR | false | false | 患者 write request 不正(400)。POST/PUT ボディ検証失敗、Idempotency-Key / If-Match ヘッダ欠落・異形・body 不一致。検索クエリ 400 は PAT-0001 | 実装済み(API-001 0.3.1 / WP-7202) |
| RCV-0001 | RECEPTION | ERROR | false | false | 受付キューリクエスト不正(400)。date 欠落/形式不正/非実在暦日、patientId 不正、idempotencyKey 欠落/形式不正 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |
| RCV-0002 | RECEPTION | ERROR | false | false | 当該テナント・薬局内で受付対象 patientId が存在しない(404)。テナント越え探索は禁止 | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |
| RCV-0003 | RECEPTION | ERROR | false | false | idempotencyKey conflict(同一 key + 異なる patientId)(409)。誤患者の受付エントリを返さず fail-closed | 実装済み(@yrese/shared-kernel KERNEL_ERROR_CODES seed / API-006 reception queue) |
| RCV-0004 | RECEPTION | ERROR | false | false | 不許可の受付状態遷移(409)。逆行・終端(COMPLETED/CANCELLED)後の遷移・遷移表(DOM-004 §2)にない組合せ | APPROVED(API-006 0.3.x / WP-7201 で実装済み) |
| RCV-0005 | RECEPTION | ERROR | false | false | 受付 version conflict(409)。transitions の expectedVersion / If-Match と現在 version の不一致 | APPROVED(API-006 0.3.x / WP-7201 で実装済み) |
| RCV-0006 | RECEPTION | ERROR | false | false | 受付不存在(404)。transitions の対象 receptionId が当該テナント・薬局内に存在しない。テナント越え探索は禁止(RCV-0002 と同規則) | APPROVED(API-006 0.3.1 / WP-7201) |
| RCV-0007 | RECEPTION | ERROR | false | false | queue 件数が防御的 cap 超過(503 + nextAction)。応答は PHI 非含有、queue.viewed 監査は記録しない(結果非返却) | APPROVED(API-006 0.3.3 / WP-7105) |
| INS-0001 | INSURANCE | ERROR | false | false | coverage request 不正(400)。asOf 欠落/非実在暦日、必須項目欠落、copayRatio 範囲外、Idempotency-Key 不正 | 実装済み(API-020 / WP-7203) |
| INS-0002 | INSURANCE | ERROR | false | false | 対象患者が当該テナント・薬局内に存在しない(404)。非露出規則は PAT-0002 と同型 | 実装済み(API-020 / WP-7203) |
| INS-0003 | INSURANCE | ERROR | false | false | InsuranceCard の有効期間重複(409)。supersede なしの重複登録は拒否 | 実装済み(API-020 / WP-7203) |
| INS-0004 | PUBLIC_EXPENSE | ERROR | false | false | PublicExpense の優先順位重複(409)。同一患者・同期間で priority 重複は拒否 | 実装済み(API-020 / WP-7203) |
| INS-0005 | INSURANCE | ERROR | false | false | supersede 対象不存在または二重 supersede(409) | 実装済み(API-020 / WP-7203) |
| INS-0006 | INSURANCE | ERROR | false | false | idempotencyKey conflict(同一 key + 異なる payload)(409) | 実装済み(API-020 / WP-7203) |
| INS-0007 | INSURANCE | ERROR | false | false | 資格確認スナップショット request 不正(400)。snapshotId/方式/状態/日付形式、method-state 不整合 | APPROVED(API-019 / WP-7204 で実装済み) |
| INS-0008 | INSURANCE | ERROR | false | false | 対象受付が当該テナント・薬局内に存在しない(404)。テナント越え探索は禁止 | APPROVED(API-019 / WP-7204 で実装済み) |
| INS-0009 | INSURANCE | ERROR | false | false | 同一 snapshotId + 異なる payload の conflict(409)。snapshot は append-only | APPROVED(API-019 / WP-7204 で実装済み) |
| INS-0010 | INSURANCE | ERROR | false | false | 手動記録不可の状態/方式(VERIFIED_MYNA 等)または ADP-004 §3 遷移表にない遷移(422) | APPROVED(API-019 / WP-7204 で実装済み) |
| MST-0001 | MASTER | ERROR | false | false | master query 不正(400)。asOf 欠落/非実在暦日、q 上限(100 文字)超過・制御文字 | 実装済み(MST-003 / WP-7301+7303) |
| MST-0002 | MASTER | ERROR | false | false | 指定 master_version_id が scope 内に存在しない(404)。将来の版参照 API 用に予約(現在未配線) | APPROVED(MST-003 — 予約、未実装) |

(初期セットは `KERNEL_ERROR_CODES` seed として登録済み。今後の拡充は、各ドメイン実装WPの DoR で「使用するエラーコードが本台帳に登録済みであること」を要求することで行う)

## 5. 変更手順

1. 必要コードの提案(WP の CODEX_PLAN / FRONTEND_PLAN で申告)
2. fable5 が本台帳へ行追加(severity・affectsClaimability・requiresHumanReview を確定)
3. opus4.8 レビュー(affectsClaimability=true または severity≥BLOCKER のコード)
4. 実装(ErrorCodeRegistry へ register)
5. UI 文言対応表(frontend)を UIX-001 原則に沿って整備
