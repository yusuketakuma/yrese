# medical_safety_risk_register — 医療安全リスク台帳

```yaml
ssot_id: SAF-001
title: 医療安全リスク台帳
domain: safety
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: 構築プロンプト v0.1.7 §6
depends_on:
  - docs/plan/phase0_plan.md §4
impacts:
  - docs/safety/safety_case.md
  - docs/calculation/calculation_coverage_matrix.md
  - docs/claim/claim_scope_matrix.md
open_questions:
  - probability / detectability は現段階の暫定見積もり(実測・薬剤師レビュー前)
  - evidence_id は source_registry 未整備のため全件【要確認】
  - 薬剤師レビュー・請求実務者レビューの実施体制
blockers:
  - 高リスク項目(severity critical/high)は opus4.8 レビューおよび人間レビュー完了まで対応設計を確定しない
```

## 運用ルール

- severity 原則: **患者安全に直結 = critical、請求事故に直結 = high 以上**(v0.1.7 §10)。
- probability / detectability は low / medium / high の3段階。現段階はすべて【暫定】。
- mitigation は UI(画面設計)/ Tech(技術的統制)/ Ops(運用的統制)に分けて記載する。
- 「実装済み統制」列は現リポジトリに存在する技術的統制のみを記載する(希望的記載の禁止)。
- 新リスク発見時は本台帳へ追記し、severity high 以上は fable5 + opus4.8 レビューを経る。

## リスク台帳

### A. 取り違え系(患者安全直結)

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-001 | 患者取り違え | 同姓同名・検索誤選択・受付混雑 | 誤調剤・誤投薬 | critical | med | med | UI: 全業務画面に氏名カナ・生年月日・年齢常時表示、類似患者警告 / Tech: PatientId branded型で混入防止 / Ops: 声かけ照合手順 | PatientHeader(カナ+生年月日+年齢常時表示)、PatientId branded型 | 薬剤師 | 患者選択→全画面ヘッダー一致検証 | 【要確認】 |
| MSR-002 | 保険情報取り違え | 資格確認結果の誤紐付け・旧保険残存 | 誤請求・患者負担誤り | high | med | med | UI: 資格確認状態と最終確認日時の常時表示 / Tech: 資格スナップショット版管理 / Ops: 請求前資格確認 | PatientHeader資格確認状態表示(PENDING_REVERIFY等) | 請求実務者 | 保険者変更シナリオテスト | 【要確認】 |
| MSR-003 | 公費情報取り違え | 受給者証期限切れ・優先順位誤り | 公費按分誤り・誤請求 | high | med | low | UI: 公費有効期限・優先順位の明示 / Tech: 有効日管理・組み合わせ検証 / Ops: 受給者証原本確認手順 | なし(未実装領域) | 請求実務者 | 公費組み合わせテスト | 【要確認】 |
| MSR-004 | PMH情報取り違え | PMH確認結果の誤紐付け | 助成誤適用・患者負担誤り | high | low | low | UI: PMH確認状態表示 / Tech: PENDING_PMH_REVERIFY強制 / Ops: 受給者証照合 | PENDING_PMH_REVERIFY status定義(shared-kernel) | 請求実務者 | PMH組み合わせテスト | 【要確認】 |
| MSR-005 | 処方箋取り違え | 複数患者同時受付・紙処方箋の混在 | 誤調剤 | critical | med | med | UI: 処方箋と患者の紐付け確認画面 / Tech: PrescriptionId branded型 / Ops: 監査時の原本照合 | PrescriptionId branded型 | 薬剤師 | 複数受付並行シナリオ | 【要確認】 |
| MSR-006 | 医薬品取り違え | 類似名称・規格違い選択誤り | 誤調剤・健康被害 | critical | med | med | UI: 類似名称・規格違いの強調表示、選択確認 / Tech: コード照合 / Ops: 監査機器連携・薬剤師監査 | なし(処方入力未実装) | 薬剤師 | 類似名称選択テスト | 【要確認】 |
| MSR-007 | 規格・剤形・用量・日数・数量の取り違え | 入力ミス・単位誤認 | 過量/過少投与 | critical | med | med | UI: 単位明示・異常値警告 / Tech: 用量範囲チェック(SaMD該当性確認後)/ Ops: 薬剤師確認必須 | なし | 薬剤師+SaMD該当性確認 | 境界値入力テスト | 【要確認】 |

### B. 読取・変換・マスター系

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-008 | QR読取誤り | 分割シンボル欠落・破損・版差異 | 誤取込→誤調剤・誤請求 | high | med | med | UI: 仮取込→薬剤師確認→確定の2段階 / Tech: JAHIS規約バリデーション・紙面照合ルール / Ops: 原本照合手順 | なし(QR未実装) | 薬剤師 | JAHIS Ver別読取テスト | 【要確認】(JAHIS Ver.1.11以降) |
| MSR-009 | コード変換誤り | 曖昧マッピング・版ずれ | 誤請求・誤薬歴 | high | med | low | Tech: CodeMappingRegistry(confidence・review_status必須)、曖昧一致での請求コード決定禁止 / Ops: CODE_MAPPING_REVIEW_REQUIRED運用 | CODE_MAPPING_REVIEW_REQUIRED status定義 | 請求実務者 | マッピング回帰テスト | 【要確認】 |
| MSR-010 | マスター版誤り | 有効日・経過措置の適用誤り | 算定誤り・返戻 | high | med | med | Tech: 処方日/調剤日/請求月に応じた版選択の明示入力、更新前後回帰テスト / Ops: PENDING_MASTER_VALIDATION時は旧版継続 | PENDING_MASTER_VALIDATION status定義、date-time明示日付型 | 請求実務者 | マスター有効日テスト | 【要確認】 |
| MSR-011 | 薬価誤り | マスター取込不備・改定時期ずれ | 金額誤り・誤請求 | high | low | med | Tech: 取込パイプラインの署名/スキーマ/差分検証、薬価はDecimalのみ / Ops: 更新承認ゲート | @yrese/money(float禁止) | 請求実務者 | 薬価改定境界テスト | 【要確認】 |

### C. 算定・請求系(請求事故直結)

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-012 | 算定誤り | ルール解釈誤り・根拠なき実装 | 誤請求・返戻・指導対象 | high | med | med | Tech: 算定エンジン純粋関数+calculation_trace+golden test、evidence_idなき算定ロジック禁止 / Ops: 既知案件照合 | @yrese/trace(affectsClaim step は evidenceRef 必須を実行時強制) | 請求実務者+薬剤師 | 算定golden test | 【要確認】 |
| MSR-013 | 一部負担金誤り | 負担割合・限度額・丸め誤り | 患者過不足徴収 | high | med | med | Tech: Decimal計算・丸め政策値はevidence_id確認後のみ配線 / UI: 金額根拠(trace)表示 / Ops: 会計時確認 | @yrese/money(丸め政策値ハードコード禁止) | 請求実務者 | 負担割合・丸めテスト | 【要確認】 |
| MSR-014 | 公費按分誤り | 優先順位・上限管理誤り | 誤請求・患者負担誤り | high | med | low | Tech: 公費組み合わせの明示入力+trace / Ops: 公費案件の人間確認 | なし | 請求実務者 | 公費按分テスト | 【要確認】 |
| MSR-015 | レセプト誤請求 | 記録条件仕様違反・点検漏れ | 返戻・過誤請求 | high | med | med | Tech: 記録条件バリデーション・請求前点検・請求月ロック / Ops: 点検リスト運用 | isClaimable(保留status存在時に請求データ生成不可) | 請求実務者 | レセプトgolden test | 【要確認】(記録条件仕様未入手) |

### D. 外部確認の誤認系(オフライン安全)

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-016 | 電子処方箋取得失敗の誤認 | 障害時のUI誤表示 | 未取得のまま調剤進行 | critical | low | med | UI: PENDING_EXTERNAL_SYNC明示・成功扱い禁止 / Tech: canConfirmExternal による状態遷移制御 | canConfirmExternal、PENDING_EXTERNAL_SYNC定義 | 薬剤師 | 外部障害シナリオUIテスト | 【要確認】 |
| MSR-017 | 調剤結果送信失敗の誤認 | 送信キュー失敗の握りつぶし | 管理サービス未登録 | high | med | med | Tech: Outbox+リトライ+dead letter可視化 / UI: 未送信一覧 | events envelope(WP-1006実装中) | 薬剤師 | 送信失敗再現テスト | 【要確認】 |
| MSR-018 | オンライン資格確認未実施の誤認 | ローカル参照を確認済み表示 | 資格過誤・返戻 | high | med | med | UI: LOCAL_ONLY_UNVERIFIED/最終確認日時表示 / Tech: 請求前再確認必須化 | PatientHeader(LOCAL_ONLY_UNVERIFIED表示)、isClaimable | 請求実務者 | オフラインUXテスト | 【要確認】 |
| MSR-019 | PMH未確認の誤認 | 障害時の状態曖昧表示 | 助成誤適用 | high | low | low | UI: PENDING_PMH_REVERIFY明示 / Tech: 成功扱い禁止 | PENDING_PMH_REVERIFY定義 | 請求実務者 | PMH障害シナリオ | 【要確認】 |
| MSR-020 | オフライン処理のオンライン確認済み誤認 | モード表示不備 | 未確認データで請求 | critical | med | med | UI: SystemModeBadge全画面常時表示(色非依存)/ Tech: allowsFinalCalculation/isClaimableで仮算定・請求を制御 | SystemModeBadge、allowsFinalCalculation、isClaimable | 薬剤師+請求実務者 | LOCAL_ONLY切替テスト | 【要確認】 |
| MSR-021 | 重複投薬等チェック未実施の誤認 | チェック結果と実施状態の混同 | 重複投薬見逃し | critical | low | med | UI: 「未実施」と「実施済み・問題なし」の明確な区別表示 / Ops: 薬剤師判断の記録 | なし(未実装。SaMD該当性確認前) | 薬剤師+SaMD確認 | チェック状態表示テスト | 【要確認】 |
| MSR-022 | 併用禁忌チェック未実施の誤認 | 同上 | 禁忌見逃し・健康被害 | critical | low | med | 同上 | なし(同上) | 薬剤師+SaMD確認 | 同上 | 【要確認】 |

### E. 記録・保存・監査系

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-023 | 帳票出力誤り | テンプレート版ずれ・二重印刷 | 誤交付・説明責任不能 | high | med | med | Tech: 帳票版管理・出力時点の算定根拠/マスター版保存・ハッシュ / Ops: 再出力履歴 | なし(帳票未実装) | 請求実務者 | 帳票照合テスト | 【要確認】 |
| MSR-024 | 調剤録保存不備 | 保存期間・記載事項不足 | 法令違反 | high | low | low | Tech: e-文書法3原則(真正性・見読性・保存性)対応設計 / Ops: 運用管理規程 | なし | 法令レビュー | 保存性テスト | 【要確認】(薬剤師法・施行規則) |
| MSR-025 | 監査ログ欠落 | 例外時の書き込み失敗 | 追跡不能・改ざん検知不能 | high | med | low | Tech: 監査ログの同期書き込み・欠落検知・tamper-evident / Ops: 定期監査 | なし(WP-2003予定) | セキュリティ | 監査ログ欠落テスト | 【要確認】 |

### F. 障害・復旧・同期系

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-026 | 障害復旧時の二重登録 | 再送・冪等性欠如 | 二重請求・二重調剤記録 | high | med | med | Tech: idempotencyKey・重複排除・冪等性チェック / Ops: RECOVERY_SYNCレポート確認 | events envelope(idempotencyKey、WP-1006) | 請求実務者 | 二重送信テスト | 【要確認】 |
| MSR-027 | 復旧後同期の競合 | ローカル/クラウド並行更新 | データ不整合・誤請求 | high | med | med | Tech: 競合検出・自動補正禁止 / Ops: CONFLICT_REQUIRES_HUMAN_REVIEW運用 | CONFLICT_REQUIRES_HUMAN_REVIEW定義 | 薬剤師/請求実務者 | 競合解決テスト | 【要確認】 |
| MSR-028 | 古いEdge Node利用 | 更新失敗・版不整合 | 旧マスター・旧ルールで業務 | high | low | med | Tech: version compliance check・強制更新条件 / Ops: 更新失敗時手順 | なし(Edge未実装) | 運用レビュー | 版不整合検出テスト | 【要確認】 |

### G. 権限・セキュリティ系

| ID | hazard | cause(主) | harm | Sev | Prob | Det | mitigation | 実装済み統制 | 人間レビュー | test case | evidence_id |
|---|---|---|---|---|---|---|---|---|---|---|---|
| MSR-029 | 退職者アカウントによるオフライン操作 | オフライン認証TTL内の失効未反映 | 不正操作・情報漏えい | high | low | low | Tech: オフライン認証TTL・復旧後再検証 / Ops: 退職時手順・監査 | なし | セキュリティ | 失効アカウントテスト | 【要確認】 |
| MSR-030 | 権限外操作 | UIのみの権限制御 | 不正確定・改ざん | high | med | med | Tech: API側権限制御必須(UIだけで制御しない)/ Ops: 権限棚卸し | PermissionScope型基盤(API強制はWP-2002予定) | セキュリティ | cross-role操作テスト | 【要確認】 |
| MSR-031 | 個人情報漏えい | ログ平文出力・過剰アクセス | 法令違反・患者被害 | critical | med | low | Tech: PHI非ログ出力・trace型のPHI排除設計・ログマスキング / Ops: サポートアクセス監査 | trace inputsSummary(型設計でPHI排除) | セキュリティ+法令 | ログPHIスキャン | 【要確認】 |
| MSR-032 | 医療情報改ざん | 監査証跡の不備 | 真正性喪失 | critical | low | low | Tech: tamper-evident log・ハッシュ連鎖 / Ops: 定期検証 | payloadHash(events、WP-1006) | セキュリティ | 改ざん検知テスト | 【要確認】 |
| MSR-033 | 請求データ改ざん | ロック不備・権限過剰 | 不正請求 | critical | low | low | Tech: 請求月ロック・変更履歴・claim:finalize権限分離 / Ops: 締め後変更の承認フロー | permissionScope("claim","finalize")定義 | セキュリティ+請求実務者 | ロック後変更テスト | 【要確認】 |

## 集計

- critical: 9件(MSR-001, 005, 006, 007, 016, 020, 021, 022, 031, 032, 033 のうち患者安全直結)
- high: 残り大半。low なし(医療システムの性質上、本台帳掲載時点で medium 未満は原則掲載しない)
- 実装済み統制が存在する行: 13件(いずれも部分的統制であり、residual risk は「未実装領域が広い」)

## residual risk 総括

現段階は基盤実装のみであり、**全リスクの residual risk は high**(業務機能未実装のため)。
各機能実装 WP の Definition of Done に、本台帳の該当行の mitigation 実装とテストを含めること。
