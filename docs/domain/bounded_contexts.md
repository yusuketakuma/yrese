# bounded_contexts — 境界づけられたコンテキスト

```yaml
ssot_id: DOM-001
title: 境界づけられたコンテキスト
domain: domain
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
effective_from: null
effective_to: null
source_refs: 構築プロンプト v0.2.0 §2, §12, §17
depends_on: [PRD-001, ADP-002, ARC-001, MOD-001, MOD-003, ACC-001(会計ドメインモデル — C8 の正本)]
impacts: [DOM-002, DOM-003, DOM-004]
related_work_packages: [WP-1101, WP-9002-W5F]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5F metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: 本文【要確認】参照
blockers:
  - BLOCKED_SECURITY_REVIEW: C13 本番認証はsecurity review完了まで未確定
```

## 1. 目的

MVP のドメインを、責務・言語・整合性境界が明確な bounded context に分割し、
実装パッケージ(apps/api のモジュール構成、将来の packages/domain 等)の正とする。
台帳外のコンテキスト新設・責務変更は本SSOTの改版を先行させる(PRC-007)。

## 2. コンテキスト一覧

| # | コンテキスト | 英語識別子 | 主責務 | MVP対応(PRD-001) |
|---|---|---|---|---|
| C1 | 受付 | Reception | 来局受付、処方箋受付(紙・2次元シンボル・電子処方箋境界)、仮受付・仮取込の管理、受付キュー | M1 |
| C2 | 患者 | Patient | 患者基本情報、患者検索、重複患者統合(履歴保持)、取り違え防止情報の提供 | M2 |
| C3 | 保険・公費 | Coverage | 保険情報履歴、負担割合、公費(優先順位・併用)、資格確認スナップショット、PENDING_REVERIFY 管理 | M2, M3 |
| C4 | 処方 | Prescription | 処方内容(RP単位)、由来管理(紙/QR/電子)、原本照合、処方確定ライフサイクル | M1, M4 |
| C5 | 調剤 | Dispensing | 調剤入力、後発品変更・残薬調整の記録、疑義照会記録、薬剤師確認 | M4 |
| C6 | 算定 | Calculation | 調剤報酬算定(純粋関数)、calculation_trace、仮算定/確定算定 | M5 |
| C7 | 請求 | Claim | レセプト中間モデル、電子レセプト生成、記録条件検証、請求前点検、月次締め・ロック、返戻・再請求 | M8 |
| C8 | 会計 | Billing | 一部負担金請求、収納、未収・返金・差額精算 | M6 |
| C9 | 帳票 | Reports | 帳票生成(領収証・調剤明細書・調剤録・薬袋等)、版管理・ハッシュ・再出力、電子保存 | M7 |
| C10 | マスター | Masters | マスター取込24段パイプライン(MST-001)、版・有効日・経過措置、当時有効版解決、CodeMappingRegistry(MST-002) | M9 |
| C11 | 同期 | Sync | Cloud Core⇄Edge の Outbox/Inbox、競合検出、RECOVERY_SYNC 工程(ARC-002)、システムモード管理 | M10 |
| C12 | 監査 | Audit | 監査イベント記録(追記専用・tamper-evident、SEC-007)、証跡照会。イベント種別台帳は MOD-008 が正本 | M11 |
| C13 | テナント・権限 | Identity | テナント・薬局・ユーザー・ロール・PermissionScope、認証境界(本番認証は BLOCKED_SECURITY_REVIEW)。テナント分離設計は SEC-006 が正本 | M11 |
| C14 | 外部連携 | Integration | Official Adapter 6種(ADP-001)と Pharmacy Integration API(M12)。腐敗防止層(ACL)として他コンテキストを外部仕様から隔離 | M3, M12 |

補足: 会計 Billing は v0.2.0 §17 の会計・未収・返金・差額精算に対応するため、指示候補の12個に加えて独立させた。
**C8 Billing は独立コンテキストとして維持を確定**(opus4.8 レビュー裁定 2026-07-09): 会計ドメインは ACC-001〜011 が APPROVED 済みであり、append-only 会計台帳という Claim とは別の整合性境界を持つ。正本は ACC-001 系。

## 3. 共有カーネル

実装済みの共通モジュール(MOD-001 正本)を共有カーネルとする:

- `@yrese/shared-kernel` — branded ID 12種(ReceptionId 含む — MOD-004)、SystemMode、PROVISIONAL_STATUSES、RECEPTION_STATUSES、BLOCKER_TYPES、ErrorCode/PermissionScope 基盤
- `@yrese/money` / `@yrese/date-time` / `@yrese/trace` / `@yrese/events` / `@yrese/contracts` / `@yrese/calculation`(骨格)

全コンテキストは共有カーネルの型を再定義せず import する(COMMON_MODULE_DUPLICATION_BLOCKED)。

## 4. 依存方向(context map)

```text
Identity(C13) ──上流── 全コンテキスト(tenantContext を供給)
Masters(C10) ──上流── Calculation / Claim / Dispensing / Reports(版解決を供給)
Patient(C2), Coverage(C3) ──上流── Reception / Prescription / Calculation / Claim
Reception(C1) → Prescription(C4) → Dispensing(C5) → Calculation(C6) → Billing(C8) / Claim(C7) → Reports(C9)
Sync(C11) ──横断── C1〜C10 のイベントを EventEnvelope で仲介(直接参照しない)
Audit(C12) ──横断── 全コンテキストの購読者(下流のみ。Audit へ依存する業務ロジック禁止)
Integration(C14) ──ACL── External National Systems / Partner Systems と C3/C4/C7 の間
```

原則:

- 算定 C6 は純粋関数であり、DB・外部API・現在時刻・UIに依存しない(実装済み @yrese/calculation が正本)
- 請求 C7 は算定結果(trace付き)を入力とし、算定を再実装しない
- 外部仕様(記録条件・オン資IF等)の形式は C14 内に閉じ込め、内部モデルへ漏らさない(ADP-001)
- 逆方向依存(例: Masters が Calculation に依存)は禁止。違反は COMMON_MODULE_DEPENDENCY_VIOLATION に準じて停止

## 5. コンテキスト間関係の型

| 関係 | パターン |
|---|---|
| C14 ⇄ External National Systems | Anticorruption Layer(公式仕様は Conformist — 独自解釈禁止) |
| C14 ⇄ Partner Systems | Open Host Service + Published Language(OpenAPI 3.1、@yrese/contracts) |
| C6 → C7 | Customer/Supplier(C7 が下流。契約=CalculationResult+trace) |
| C10 → C6 | Supplier(マスター版は入力として明示渡し — 暗黙参照禁止) |
| C11 ⇄ 各コンテキスト | Published Language(EventEnvelope、MOD-009) |

## 6. 【要確認】

- Reception と Prescription の境界(電子処方箋実装解禁後に再評価)
- packages/domain の物理分割単位(Phase 1 の api 実装設計時に確定)

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(C8 Billing の独立維持を確定[ACC-001 系が正本]、branded ID を実装12種へ訂正、C12/C13 に正本 SSOT 参照を追記)。
- 0.1.0 (2026-07-09): 初版起草(WP-1101)。
