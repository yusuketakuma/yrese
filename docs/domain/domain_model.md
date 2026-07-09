# domain_model — ドメインモデル(集約・不変条件)

```yaml
ssot_id: DOM-002
title: ドメインモデル(集約・不変条件)
domain: domain
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.2.0 §12, §17, §18
depends_on: [DOM-001, PRD-001, SAF-001, MOD-004, MOD-005]
impacts: [DOM-004]
open_questions: 本文【要確認】参照
```

## 0. 原則

- 実装済み共有カーネル型(MOD-004)が正本。本書の集約はそれらを組み合わせる。
- 金額・点数は @yrese/money、日付は @yrese/date-time、根拠は @yrese/trace の型のみを使う。
- **PHI を含む集約は、ログ・trace・agmsg・イベント平文へ出さない**(SEC-004)。
- 集約IDは branded ID(TenantId / PharmacyId / PatientId / PrescriptionId / DispensingId / ClaimId / EventId / DeviceId / UserId)を使い、生 string を禁止する。
- 全集約は tenant_id + pharmacy_id を保持し、クエリ境界で強制する(SEC-006)。

## 1. Patient(患者)集約 — C2

| 要素 | 内容 |
|---|---|
| ルート | Patient(PatientId) |
| 主要属性 | 氏名、**カナ(必須)**、生年月日(CalendarDate)、性別、連絡先、患者番号(薬局内) |
| 値オブジェクト | PatientName(漢字+カナ対)、PatientIdentitySummary(取り違え防止表示用: カナ・生年月日・年齢・性別 — PatientHeader の props に対応) |
| 不変条件 | カナなしで確定登録不可 / 生年月日は実在日付(CalendarDate が強制)/ 統合(マージ)は旧レコードを削除せず履歴保持+監査イベント必須 |
| 医療安全 | SAF-001「患者取り違え」対策の情報源。同姓同名・類似カナの警告表示は Patient 検索サービスの責務 |

## 2. Coverage(保険・公費)集約 — C3

| 要素 | 内容 |
|---|---|
| ルート | CoverageProfile(患者ごと) |
| 構成 | InsuranceCard 履歴(保険者番号・記号番号・負担割合・有効期間)、PublicExpense 履歴(負担者番号・受給者番号・優先順位)、**EligibilitySnapshot**(資格確認スナップショット) |
| EligibilitySnapshot | 不変(immutable)。確認日時・確認方法(オン資/目視/災害時)・結果・有効期限を保持。@yrese/calculation の InsuranceSnapshotRef はこのIDを指す |
| 不変条件 | スナップショットの上書き禁止(新規追加のみ)/ 期限切れ・保険者変更検出時は PENDING_REVERIFY を付与 / PENDING_REVERIFY が残る限り isClaimable=false(実装済みガードに委譲)/ LOCAL_ONLY 中の新規確認は LOCAL_ONLY_UNVERIFIED のみ(canConfirmExternal) |
| 公費 | 優先順位・併用の組合せは算定入力。順位決定ロジックの根拠は evidence_id 必須【要確認: 主要公費のMVP対象リスト】 |

## 3. Prescription(処方)集約 — C4

| 要素 | 内容 |
|---|---|
| ルート | Prescription(PrescriptionId) |
| 主要属性 | 由来(PAPER / QR_SYMBOL / E_PRESCRIPTION境界)、処方日(PrescriptionDate)、医療機関・医師参照、RP明細(Rp)コレクション |
| Rp(RP単位) | 医薬品参照(マスター版付きコード — CodeMappingRegistry 経由)、用法、用量、日数/回数、数量、一般名処方フラグ、後発品変更可否 |
| 状態 | DOM-004 の処方ライフサイクルに従う(仮受付→仮取込→薬剤師確認→確定) |
| 不変条件 | **確定は薬剤師確認後のみ**(scope: prescription:confirm)/ QR由来は原本照合記録なしに確定不可 / 確定後の変更は訂正版の新規作成+履歴保持のみ(無履歴変更禁止)/ コード変換の曖昧一致は CODE_MAPPING_REVIEW_REQUIRED で停止 |

## 4. Dispensing(調剤)集約 — C5

| 要素 | 内容 |
|---|---|
| ルート | DispensingRecord(DispensingId) |
| 主要属性 | 対象 PrescriptionId、調剤日(DispensingDate)、調剤内容(Rpごとの実施記録)、後発品変更記録、残薬調整記録、疑義照会記録参照、薬剤師確認記録 |
| 不変条件 | 薬剤師確認(dispensing:confirm)前の確定禁止 / 疑義照会による処方変更は Prescription の訂正版を経由(Dispensing 側での書き換え禁止)/ 調剤録の保存要件(REG-003【要確認: 保存期間】)に従い削除禁止 |

## 5. CalculationResult(算定結果)— C6

| 要素 | 内容 |
|---|---|
| 実体 | @yrese/calculation の CalculationResult(判別union: BLOCKED / CALCULATED)が正本 |
| 区分 | 仮算定(PROVISIONAL_CALCULATION — LOCAL_ONLY 等)と確定算定を厳格分離 |
| 不変条件 | calculation_trace なしの結果は存在しない(型で強制)/ affectsClaim ステップは evidenceRefs>=1(実行時強制済み)/ 確定算定は allowsFinalCalculation(mode) が真のときのみ / 入力(マスター版・ルール版・各日付)を trace に保存し再現可能にする |

## 6. Claim(請求)集約 — C7

| 要素 | 内容 |
|---|---|
| ルート | Claim(ClaimId)、請求月(ClaimMonth)単位の ClaimBatch |
| 構成 | レセプト中間モデル、電子レセプトデータ参照(生成後)、記録条件検証結果、点検結果、返戻・再請求履歴 |
| 状態 | DOM-004 の請求ライフサイクル(生成→検証→点検→締め→ロック→受渡→返戻→再請求) |
| 不変条件 | **isClaimable=false のデータから生成不可**(実装済みガード)/ 記録条件検証全件通過が「請求可能」の前提(M8)/ 月次締め・ロックは NORMAL モードのみ(allowsClaimFinalization)/ ロック後の変更禁止 — 訂正は返戻・再請求フローの新版のみ / 生成時のマスター版・算定ルール版・trace を保存(帳票・監査から参照可能) |

## 7. Report(帳票)— C9

| 要素 | 内容 |
|---|---|
| 実体 | ReportInstance(帳票種別・版・出力日時・出力者・ハッシュ・出力時点の算定根拠/マスター版参照) |
| 不変条件 | 出力済み帳票の内容改変禁止(再出力は新インスタンス+履歴)/ ハッシュによる改ざん検知(e-文書法 真正性)/ 患者交付済みフラグの取消は監査イベント必須 |

## 8. Master(マスター)— C10

| 要素 | 内容 |
|---|---|
| 実体 | MasterVersion(マスター種別・版・有効開始日・廃止日・経過措置・配布状態) |
| 不変条件 | 版の上書き禁止(新版追加のみ)/ 当時有効版の解決は(処方日・調剤日・請求月)を明示入力(MST-001)/ 検証未通過版の本番適用禁止(PENDING_MASTER_VALIDATION) |

## 9. 横断: SyncEvent / AuditEvent / Identity

- **SyncEvent**: @yrese/events EventEnvelope が正本(MOD-009)。集約の状態変更は Outbox 経由で発信し、直接RPC しない。
- **AuditEvent**: 追記専用・削除不可・ハッシュチェーン(SEC-007)。業務集約から Audit への依存は「発行」のみ。
- **Identity**: TenantId / PharmacyId / UserId / RoleName / PermissionScope(実装済み)。集約操作の権限は API 側 requirePermission で強制(UIのみの制御禁止)。

## 10. 【要確認】

- 主要公費のMVP対象リストと優先順位規則の evidence_id(REG-004 RB-系と連動)
- 調剤録・帳票の法定保存期間(REG-003 の確認結果を反映)
- 返戻・再請求の状態細分(審査支払機関の運用確認後)
- Patient 統合の操作権限(専用 scope 要否 — MOD-007 open_questions と同期)
