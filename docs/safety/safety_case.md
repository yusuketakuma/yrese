# safety_case — セーフティケース(骨格)

```yaml
ssot_id: SAF-002
title: セーフティケース
domain: safety
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §6, §12(Safety Case 定義)
depends_on:
  - docs/safety/medical_safety_risk_register.md
impacts:
  - docs/quality/*(validation_plan 等、未作成)
open_questions:
  - SaMD該当性判定の結果により主張構造(特に G3)の再構成が必要
  - 薬剤師レビュー・請求実務者レビューの実施記録の様式
blockers:
  - 本書は骨格である。各機能実装前に該当ゴールの論拠・証拠を更新し、Go/No-Go 時に完全性を確認する
```

## 目的

患者安全・医療安全・請求安全に関するリスク、対策、残余リスク、テスト、レビュー結果を
主張(Goal)- 論拠(Argument)- 証拠(Evidence)構造で維持する(v0.1.7 §12)。
本書は Go/No-Go 判定(phase0_plan §8)の必須入力である。

## 最上位主張

**G0: 本システムは、保険薬局の調剤・請求業務において、患者安全・医療安全・請求安全を
損なわない設計・実装・運用統制を備えている。**

現時点の判定: **未達(骨格段階)**。以下のサブゴールの充足をもって段階的に主張する。

## サブゴールと現状

### G1: 患者・処方の取り違えが防止されている

- 論拠: 取り違えリスク(MSR-001〜007)は UI 常時表示 + 型レベル分離 + 薬剤師確認手順の三層で緩和される。
- 証拠(実装済み):
  - E1-1: `apps/web/app/components/patient-header.tsx` — 氏名カナ・生年月日・年齢・資格確認状態の常時表示(コミット 1acfa3f)
  - E1-2: `@yrese/shared-kernel` branded ID 型(PatientId/PrescriptionId 等の相互代入をコンパイル時拒否、コミット 9ab039e)
- 証拠(未達): 患者検索・処方入力・薬剤師確認画面の実装とユーザビリティテスト。類似名称警告。
- 状態: **部分達成(基盤のみ)**

### G2: 外部確認未完了の処理が「確認済み」と誤認されない

- 論拠: システムモードと保留ステータスを型で強制し、UI は色非依存のテキストラベルで常時表示する(MSR-016〜022)。
- 証拠(実装済み):
  - E2-1: `@yrese/shared-kernel` SYSTEM_MODES / canConfirmExternal / allowsFinalCalculation / allowsClaimFinalization(LOCAL_ONLY での新規外部確認・確定算定・請求確定を関数レベルで拒否)
  - E2-2: PROVISIONAL_STATUSES 6種と `isClaimable()`(保留ステータス存在時に請求データ生成不可)
  - E2-3: `SystemModeBadge`(全画面シェルに常時表示、data-mode 別視覚+日本語ラベル)
- 証拠(未達): モード検知バックエンド、RECOVERY_SYNC 画面、オフラインUXテスト。
- 状態: **部分達成(型・表示基盤のみ)**

### G3: 算定・請求が根拠なく行われない

- 論拠: evidence_id のない算定ロジックを実行時に拒否し、金額計算から浮動小数点を排除する(MSR-012〜015)。
- 証拠(実装済み):
  - E3-1: `@yrese/trace` createCalculationTrace — affectsClaim=true のステップに evidenceRef が無い場合 RangeError(コミット ddc06a1)
  - E3-2: `@yrese/money` — bigint ScaledDecimal、丸め政策値のハードコード禁止(JSDoc で BLOCKED_REGULATORY_REVIEW 明記、コミット 533f89a)
  - E3-3: `@yrese/date-time` — 処方日・調剤日・請求月の明示入力(現在時刻への暗黙依存なし)
- 証拠(未達): 算定エンジン本体(公式資料確認まで BLOCKED_REGULATORY_REVIEW)、golden test、請求前点検。
- 状態: **統制基盤のみ達成。算定本体は意図的に未実装(根拠不足で止まる設計)**

### G4: 記録・監査証跡が保全される

- 論拠: 監査ログ・帳票・調剤録は真正性・見読性・保存性を満たし、欠落・改ざんを検知できる(MSR-023〜025, 031〜033)。
- 証拠(実装済み): E4-1: trace inputsSummary の型設計による PHI 排除(ログ・trace への氏名混入をコンパイル時抑止)
- 証拠(未達): 監査ログ実装(WP-2003)、帳票版管理、tamper-evident 設計、e-文書法対応の運用管理規程。
- 状態: **未達(設計待ち)**

### G5: 障害・復旧時に安全側へ倒れる

- 論拠: 復旧同期は冪等性・競合検出を備え、不一致は自動補正せず人間レビューへ回す(MSR-026〜028)。
- 証拠(実装済み): E5-1: CONFLICT_REQUIRES_HUMAN_REVIEW 定義、E5-2: EventEnvelope(idempotencyKey / payloadHash / PHI未暗号化拒否 — WP-1006 実装中)
- 証拠(未達): 同期実装・競合解決画面・障害訓練。
- 状態: **未達(型基盤のみ)**

### G6: 権限外操作・情報漏えいが防止される

- 論拠: 権限は UI と API の両方で強制し、サポートアクセスも監査する(MSR-029〜031)。
- 証拠(実装済み): PermissionScope 型基盤のみ。
- 証拠(未達): API 側権限強制(WP-2002)、監査、オフライン認証TTL。
- 状態: **未達**

## 証跡運用

- 各 WP の PR は、対応する MSR 行と本書のゴール番号を記載する。
- severity critical の MSR に対応する実装は、opus4.8 レビュー + 人間レビュー完了の記録を本書へ追記する。
- Go/No-Go 時、全ゴールの状態が「達成」または「残余リスク受容(人間承認記録付き)」であることを条件とする。
