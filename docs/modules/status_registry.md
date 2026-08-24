# status_registry — ステータスレジストリ

```yaml
ssot_id: MOD-005
title: ステータスレジストリ(システムモード・保留系・BLOCKER)
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.6
created_at: 2026-07-09
updated_at: 2026-08-23
approved_at: 2026-08-24
approved_by: "direct human authority 2026-08-23 (「全てを許可する。実行」) applied to the 2026-08-24 review batch; independent reviews (WP-6006 data-integrity/security lane, WP-6303/6304 + MOD-008 privacy/medical-safety lane) REQUEST_CHANGES -> findings closed (66e4058, b073f2a, 7f7df40); closure checker PASS for the SSOT batch with condition M5 resolved in 7f7df40"
effective_from: 2026-08-23
effective_to: null
change_log:
  - "2026-08-24 finalization: 独立 review の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手・外部接続・conformance 主張は含まない"
  - "0.1.6 2026-08-24 WP-6303/6304 review A-8/B-6: §2.2 に受付資格確認状態 7 種と確認方式 4 種を登録、BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT の文言を APPROVED 版基準に精緻化。review と human approval まで PROPOSED"
  - "2026-08-23 WP-6001/WP-6101/WP-6202/WP-6203/WP-6302 finalization: 独立 review 2 lane の finding 閉鎖と closure checker PASS、direct human approval により PROPOSED→APPROVED。本文 semantics は review 反映後から不変。実装着手は各 WP の gate に従い、外部接続・conformance 主張は含まない"
  - "0.1.5 2026-08-23 WP-6001: BLOCKER_TYPES に Integration Hub / 監査 / privacy 系 5 種を登録(33→38)。shared-kernel blockers.ts と同期。review と human approval まで PROPOSED"
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W4 metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - 0.1.4 (2026-07-09): ドメインライフサイクル状態の所有権を明記 — 定義の正本は DOM-004、shared-kernel への登録は使用する実装 WP の着地時に DOM-004 と同期して行う(opus4.8 DOM レビューの governance 決着)。
  - 0.1.3 (2026-07-09): WP-3009-BE / API-006 v0.2.0 に基づき、受付キュー専用 `RECEPTION_STATUSES` 4値(WAITING / IN_PROGRESS / COMPLETED / CANCELLED)を追加。処方箋ライフサイクル状態・請求可否判定とは分離。
  - 0.1.2 (2026-07-09): BLOCKER_TYPES に FHIR/連携境界の2種(BLOCKED_OFFICIAL_ADAPTER_BOUNDARY / BLOCKED_FHIR_CONFORMANCE_REVIEW)を追加(opus4.8 FHIR系レビュー指摘 — PRD-007/DOM-005/006 が定義する停止条件の allow-list 登録)
  - 0.1.1 (2026-07-09): isClaimable を deny-list(fail-open)から allow-list(fail-closed)へ転換(opus4.8 指摘・CAL-007 §3.1、実装 WP-1012)。CLAIMABLE_SAFE_STATUSES への追加は本SSOT改版必須と明記
source_refs:
  - 構築プロンプト v0.2.0 §13, §14, §0.13, §0.0.3.3
depends_on:
  - packages/shared-kernel(9ab039e)
  - docs/architecture/offline_mode_matrix.md(ARC-001)
impacts:
  - packages/shared-kernel statuses and mode guards
  - packages/calculation claimability boundary
  - reception queue status consumers
related_work_packages:
  - WP-0012
  - WP-1012
  - WP-0052
  - WP-3009-BE
  - WP-9002-W4
related_tests:
  - packages/shared-kernel/src/kernel.test.ts
  - packages/calculation/src/calculation.test.ts
related_prs: []
evidence_ids: []
open_questions:
  - WP status(DRAFT〜CANCELLED、PRC-002 管理)と本レジストリの関係整理(WP status はプロセス側で管理し本レジストリ対象外とする現方針の確認)
blockers: []
```

**現在の正本は `@yrese/shared-kernel` の実装コードである。** ステータスの追加・変更・削除は本SSOT改版 → fable5+opus4.8 レビュー → 実装の順で行う。ローカル(apps/** や他パッケージ)での同名 const 再定義は check-boundaries.mjs が CI で検出する(`COMMON_MODULE_DUPLICATION_BLOCKED`)。

**ドメインライフサイクル状態(処方・調剤・請求等の業務遷移状態)の定義の正本は DOM-004。**
shared-kernel / 本レジストリへの登録は、当該状態を使用する実装 WP の着地時に DOM-004 と同期して行う
(未実装状態の先行登録をしない。登録時は DOM-004 と本SSOTの両方を改版し一致を保つ)。

## 1. システムモード(SYSTEM_MODES — 5種)

NORMAL / EXTERNAL_DEGRADED / CLOUD_DEGRADED / LOCAL_ONLY / RECOVERY_SYNC

ガード関数(モード別許可・禁止の単一実装 — ローカル再実装禁止、ARC-001 が業務マトリクスの正):

| 関数 | 意味 | 判定 |
|---|---|---|
| canConfirmExternal | 外部公的システムの新規確認を成功扱いできるか | NORMAL / CLOUD_DEGRADED のみ true |
| allowsFinalCalculation | 確定算定を許可するか | LOCAL_ONLY 以外 true(LOCAL_ONLY は仮算定のみ) |
| allowsClaimFinalization | 請求前点検・月次締め・レセプト確定を許可するか | NORMAL のみ true |

## 2. 保留・仮状態(PROVISIONAL_STATUSES — 6種、v0.2.0 §14)

PROVISIONAL_CALCULATION / PENDING_REVERIFY / PENDING_EXTERNAL_SYNC / PENDING_PMH_REVERIFY / LOCAL_ONLY_UNVERIFIED / MANUAL_REVIEW_REQUIRED

- LOCAL_ONLY で生成された計算・帳票・受付には必ずいずれかを付与する
- 復旧同期競合: `CONFLICT_REQUIRES_HUMAN_REVIEW`(自動補正禁止)
- MVP対象外請求: `UNSUPPORTED_CLAIM_STATUSES` = BLOCKED_UNSUPPORTED_CLAIM / MANUAL_REVIEW_REQUIRED / FUTURE_SCOPE_NOT_CLAIMABLE
- **請求可否の単一判定は `isClaimable(statuses)`**: **allow-list 方式(fail-closed)** — 明示的な `CLAIMABLE_SAFE_STATUSES`(初期値: 空)に含まれないステータスが1つでもあれば false。**未知ステータス=請求不可**。`isClaimable([]) === true`(ステータスなし=ブロック要因なし)。請求データ生成経路はこの関数を必ず通す(迂回実装禁止 — PRD-001)
- isClaimable は当初 deny-list 方式(未知ステータス=true の fail-open)だったが、opus4.8 レビュー指摘(CAL-007 §3.1)により WP-1012 で fail-closed へ転換。`CLAIMABLE_SAFE_STATUSES` への追加は**本SSOT改版必須**

## 2.1 受付キュー状態(RECEPTION_STATUSES — 4種、API-006)

WAITING / IN_PROGRESS / COMPLETED / CANCELLED

- 受付キューの業務管理状態であり、DOM-004 の処方箋ライフサイクル状態(RECEIVED_PROVISIONAL 等)とは別概念
- `CANCELLED` はエントリ削除ではなく取消状態として保持する(P-12)。取消理由の記録様式は後続の調剤・会計・監査系 SSOT に委譲
- 受付状態は請求可否判定 `isClaimable()` に関与しない
- 値の正本は `@yrese/shared-kernel` の `RECEPTION_STATUSES`

## 2.2 受付の資格確認状態(RECEPTION_ELIGIBILITY_STATES — 7種、ADP-004 §3)と確認方式(ELIGIBILITY_VERIFICATION_METHODS — 4種)

UNVERIFIED / VERIFIED_MYNA / VERIFIED_CARD / PROVISIONAL_VISUAL / OFFLINE_PROVISIONAL / EXPIRED / MISMATCH
MYNA_ONLINE / CARD_ONLINE / CARD_VISUAL / NONE

- **受付 1 件**に紐づく EligibilitySnapshot から導出する状態。患者要約の `ELIGIBILITY_STATUSES`(§1、API-001)とは別概念で、受付画面の資格表示の正本はこちら
- 確定算定は VERIFIED_MYNA / VERIFIED_CARD のみ、仮算定は加えて PROVISIONAL_VISUAL / OFFLINE_PROVISIONAL。UNVERIFIED / EXPIRED / MISMATCH は算定不可(fail-closed)
- 遷移表は ADP-004 §3 と一致させる。EXPIRED / MISMATCH は受付単位の終端で、復帰は新規受付または evidence を伴う人間 gate
- 確認方式と記録状態の整合(目視 → PROVISIONAL_VISUAL、NONE → OFFLINE_PROVISIONAL 等)は code と DB CHECK の双方で強制する
- 値の正本は `@yrese/shared-kernel` の `RECEPTION_ELIGIBILITY_STATES` / `ELIGIBILITY_VERIFICATION_METHODS`(`check:boundaries` の重複定数検査対象)

## 3. BLOCKER 種別(BLOCKER_TYPES — 38種)

実装統率(§0.13): BLOCKED_NOT_READY / BLOCKED_REGULATORY_REVIEW / BLOCKED_LEGAL_REVIEW / BLOCKED_MEDICAL_SAFETY_REVIEW / BLOCKED_OFFICIAL_ADAPTER_SPEC / BLOCKED_CODE_MAPPING_REVIEW / BLOCKED_UNSUPPORTED_CLAIM / BLOCKED_PMH_REVIEW / BLOCKED_NSIPS_LICENSE / BLOCKED_SECURITY_REVIEW / BLOCKED_PERFORMANCE_SLO / BLOCKED_EDGE_SYNC_DESIGN / BLOCKED_UX_SAFETY / CODEX_CAPABILITY_UNVERIFIED / AGMSG_PROTOCOL_UNVERIFIED

法令・品質: BLOCKED_PMDA_SAMD_REVIEW / BLOCKED_QUALITY_REGULATORY_REVIEW

移行(§9.1): BLOCKED_MIGRATION_MAPPING_UNKNOWN / BLOCKED_CUTOVER_ROLLBACK_UNDEFINED / BLOCKED_LEGACY_RETENTION_UNKNOWN

実装所有・契約(§0.0.2.4): IMPLEMENTATION_OWNERSHIP_BLOCKED / API_CONTRACT_BLOCKED

共通モジュール(§0.0.3.12): COMMON_MODULE_BLOCKED / COMMON_MODULE_DUPLICATION_BLOCKED / COMMON_MODULE_DEPENDENCY_VIOLATION / GENERATED_CODE_DRIFT_BLOCKED

実行モード(§0.0.1): CLAUDE_ULTRACODE_UNAVAILABLE / CODEX_ULTRA_MODE_UNAVAILABLE

マスター(§21): PENDING_MASTER_VALIDATION / コードマッピング(§22): CODE_MAPPING_REVIEW_REQUIRED / SSOT(§0.1.6.17): SSOT_UPDATE_REQUIRED

FHIR/連携境界(PRD-007、DOM-005/006): BLOCKED_OFFICIAL_ADAPTER_BOUNDARY(Official Adapter[オン資・電子処方箋・オンライン請求・PMH・JAHIS]を FHIR で置換しない)/ BLOCKED_FHIR_CONFORMANCE_REVIEW(conformance 未検証での「JP Core 準拠」訴求禁止)

Integration Hub / 監査・保持・privacy(API-008/009〜018、ADP-004、JHS-003): BLOCKED_WRITE_PRODUCER_PREREQUISITES(単一 external write producer の前提未充足)/ BLOCKED_AUDIT_EVENT_REGISTRY_AMENDMENT(MOD-008 の **APPROVED 版**に登録されていない種別の発火禁止。code の `AUDIT_EVENT_TYPES` に存在しても SSOT が PROPOSED の間は発火不可)/ BLOCKED_AUDIT_PAYLOAD_RETENTION_POLICY(保持期間未確定)/ BLOCKED_PRIVACY_REVIEW(privacy review 未完了)/ BLOCKED_JAHIS_SPEC_ACQUISITION(JAHIS 仕様本文未入手)

報告形式は `BlockerReport`(blockerType / workPackageId / blockingQuestion / affectedFiles / risk / recommendedNextStep)— 運用は PRC-006(blocker_triage_policy)。

## 4. 使用実績(先例)

- 空ruleset の算定 → BLOCKED_REGULATORY_REVIEW(@yrese/calculation、テスト固定)
- 複数 CALCULATED ルール → SSOT_UPDATE_REQUIRED(同、レビュー往復で追加された安全ガード)
- 本番での dev 認証スタブ登録 → BLOCKED_SECURITY_REVIEW(apps/api tenant-context、起動拒否)
