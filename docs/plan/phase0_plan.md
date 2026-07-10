# Phase 0 計画案 — 調剤用レセプトコンピューター MVP(構築プロンプト v0.2.0 準拠)

```yaml
ssot_id: PLAN-PHASE0-001
title: Phase 0 計画案
domain: plan
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
impacts:
  - Plans.md
  - all Phase 0 governance
related_work_packages:
  - WP-0001
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.1.1 2026-07-10 direct user instruction (WP-9001) とrequired reviews PASSにより現行routingをAGT-018へ切り替えてAPPROVED化。本文の旧role/model名はPhase 0 provenanceとして保持
  - 0.1.0 2026-07-09 Phase 0初回計画
open_questions: 本書「19. 人間レビューが必要な論点」参照
blockers: 本書「20. 現時点のBLOCKER」参照
```

> [!IMPORTANT]
> **proposed routing (2026-07-10):** 本文に残る旧model名、旧role名、旧lane、旧handoff/lock手順は2026-07-09のPhase 0計画provenanceである。AGT-018と本改版がAPPROVEDになった後、Codex root → read-only mapper → read-only pre-plan reviewer → sole Codex maintainer → independent verifier → relevant specialists → root exact-stage landingを適用する。frontend/backend/shared/SSOTをlane分割しない。UIはsole Codex maintainerが編集し、`frontend_reviewer`・`ui_flow_tester`・`accessibility_ux_reviewer`がread-onlyで確認する。U4は`medical_safety_reviewer`・`privacy_compliance_reviewer`を追加し、既存の薬剤師確認・人間承認gateを維持する。WP-9001自体はdirect user instructionにより同routingで実行中である。

本書は初回出力(Phase 0 計画案)である。コードは含まない。人間レビュー承認後に Phase 0 の調査・成果物作成へ進む。

---

## 1. プロダクト理解

日本の保険薬局向け、AWSクラウド(Cloud Core)+ 薬局内ローカル実行環境(Pharmacy Edge Node)構成の調剤用レセプトコンピューターMVP。本質は「処方入力システム」ではなく、**調剤報酬算定・一部負担金・保険/公費請求・電子レセプト・請求前点検・月次締め・返戻再請求・監査証跡** を、法令根拠(evidence_id / legal_trace / calculation_trace)付きで正しく管理する請求基幹システムである。

- 外部公的システム(オンライン資格確認・電子処方箋・オンライン請求・PMH)とは Official Adapter で分界し、公式仕様準拠でのみ接続する。
- 薬局内 Partner Systems(電子薬歴・監査機器・分包機・POS・在庫)とは独自設計の Pharmacy Integration API(OpenAPI/JSON)で接続し、NSIPSは無許諾で複製・模倣しない。
- Cloud Core 停止時も Edge Node で最低限の業務継続(LOCAL_ONLY)を行い、復旧後は RECOVERY_SYNC で再検証する。外部確認が必要な処理をローカル単独で成功扱いにしない。
- 「動くが根拠がないコード」より「根拠不足を正しく検知して止まるコード」を優先する。

## 2. MVP仮説 / 非MVP仮説

### 2.1 MVP仮説(候補 — 人間レビュー対象)

| 領域 | MVP範囲仮説 |
|---|---|
| 受付 | 紙処方箋受付、JAHIS院外処方箋2次元シンボル読取(仮取込→薬剤師確認→確定)、電子処方箋は受付境界のみ設計(実装可否はONS仕様確認後に判定) |
| 患者・保険 | 患者管理、保険情報、負担割合、主要公費の登録・履歴管理、資格確認結果スナップショット管理 |
| 資格確認 | オンライン資格確認等システムとの連携境界(資格確認端末・外部IF経由)。取得結果の取込・表示・請求前資格確認。災害時/障害時モードの状態管理 |
| 処方・調剤入力 | RP単位入力、用法・用量・日数・数量、後発品変更、一般名処方対応、疑義照会記録、残薬調整記録 |
| 算定 | 薬剤料、調剤技術料(調剤基本料・薬剤調製料等)、薬学管理料の主要項目(服薬管理指導料等)、主要加算、一部負担金、長期収載品選定療養の基本対応。純粋関数算定エンジン+calculation_trace |
| 会計 | 一部負担金請求、領収証・調剤明細書、未収・返金・差額精算の基本 |
| 帳票 | 領収証、調剤明細書、調剤録、薬袋、薬剤情報提供文書、請求前点検リスト(版管理・ハッシュ・再出力) |
| レセプト | レセプト中間モデル→電子レセプト生成→記録条件仕様バリデーション→請求前点検→月次締め→請求データロック→オンライン請求用端末への公式手順受け渡し。返戻・再請求管理の基本 |
| マスター | 医薬品・薬価・調剤行為・コメント・保険者・公費マスターの取込パイプライン、版管理、有効日・経過措置、Edge配布 |
| オフライン | LOCAL_ONLY(仮受付・仮算定・仮帳票・ローカル監査ログ)、RECOVERY_SYNC(再検証・競合検出・人間承認) |
| 基盤 | マルチテナント(tenant_id/pharmacy_id分離)、RBAC、監査ログ、AWS無停止更新、Edge Node同期 |
| 連携 | Pharmacy Integration API v0(電子薬歴向け処方・調剤イベント配信の最小セット、sandbox、contract test) |

### 2.2 非MVP仮説(候補)

- 電子処方箋のフル実装(調剤結果送信・HPKI署名まで)— 境界設計のみMVP、実装はONS仕様・接続試験環境確認後の次期
- PMH医療費助成のフル実装 — 境界設計・状態管理(PENDING_PMH_REVERIFY)のみMVP
- オンライン請求の直接送信自動化(公式接続方式確認まで BLOCKED_REGULATORY_REVIEW)
- 在宅関連の複雑算定、介護保険請求、麻薬帳簿、自家製剤・計量混合の複雑ケース、分割調剤・リフィルの全パターン
- NSIPS Adapter(許諾取得まで凍結)、POS・在庫・分包機との双方向連携フル実装
- 多店舗本部機能、経営分析、レジ・キャッシュレス連携、電子版お薬手帳連携
- 地方単独公費の全国網羅(MVPは主要制度に限定し、対象外は BLOCKED_UNSUPPORTED_CLAIM で請求データ生成を停止)

MVP対象外の算定・請求を含む処方は、保険請求データ生成前に BLOCKED_UNSUPPORTED_CLAIM / MANUAL_REVIEW_REQUIRED / FUTURE_SCOPE_NOT_CLAIMABLE のいずれかで停止する。

## 3. 日本医療システムとしての法令適合性方針

- Phase 0 で `source_registry.md`(Priority A/B/C分類・版・取得日・ハッシュ)と `legal_compliance_matrix.md` を作成し、法令→機能→設計対応→記録→保存期間→監査証跡→人間レビュー要否を traceability で結ぶ。
- 確認対象: 薬剤師法、医薬品医療機器等法、健康保険法、国保法、高確法、薬担規則、療養の給付請求省令、記載要領、e-文書法、電子署名法、個人情報保護法、医療介護個人情報ガイダンス、安全管理GL第7.0版以降、事業者向け安全管理GL第2.0版以降、令和8年度調剤報酬改定、記録条件仕様、オン資・電子処方箋・PMH関連通知、JAHIS標準、NSIPS許諾条件。
- 資料矛盾時の優先順位は法令>通知・疑義解釈>適用日の新しい公式仕様>当時有効仕様>経過措置>審査支払機関仕様>JAHIS>ベンダー資料。解決不能は `BLOCKED_REGULATORY_REVIEW`。
- Priority C(解説記事等)は調査補助のみ。実装根拠にしない。
- 薬機法上のプログラム医療機器(SaMD)該当性を Phase 0 で確認。重複投薬・併用禁忌チェック、監査支援等の臨床判断支援要素は単なる事務機能と扱ってよいか個別確認し、不明なら `BLOCKED_PMDA_SAMD_REVIEW`。
- 薬剤師の専門的判断を置き換えない。薬剤師確認・疑義照会・請求確定は人間責任として画面・監査証跡に明示する。
- evidence_id のない算定・請求・帳票・レセプトロジックの実装を禁止する。

## 4. 医療安全方針

- Phase 0 で `medical_safety_risk_register.md` と `safety_case.md` を作成。hazard→cause→harm→severity→mitigation(UI/技術/運用)→residual risk→test case→evidence_id で管理。
- 最優先リスク: 患者取り違え、保険・公費情報取り違え、オフライン処理のオンライン確認済み誤認、外部送信失敗の成功誤認、マスター版誤り、算定・負担金誤り、復旧時二重登録・競合、監査ログ欠落、権限外操作。
- 対策原則: 仮/確定の厳格な状態分離(PROVISIONAL_CALCULATION、PENDING_REVERIFY、PENDING_EXTERNAL_SYNC、PENDING_PMH_REVERIFY、LOCAL_ONLY_UNVERIFIED、MANUAL_REVIEW_REQUIRED)、色に依存しない状態表示、破壊的操作の二段階確認、UIとAPI両方での権限制御、自動補正禁止(CONFLICT_REQUIRES_HUMAN_REVIEW)。
- 高リスク医療安全事項は opus4.8 レビュー必須、患者安全欠陥は severity critical、請求事故欠陥は severity high 以上。

## 5. 医療システムに相応しいUI/UX方針 + 画面群仮説

- Phase 0 で `medical_ui_ux_principles.md` を作成。設計軸: 患者安全 > 誤請求防止 > 監査性 > 入力効率 > 見た目。装飾・アニメーション・ダークパターン・広告誘導を排除。
- 状態の可視化を最重要とする: システムモード(NORMAL〜RECOVERY_SYNC)、外部確認状態、仮/確定、薬剤師確認前後、請求可否を常時表示するグローバルステータス領域を全画面に置く。
- 誤認防止: 患者ヘッダー(氏名・カナ・生年月日・年齢・保険)を全業務画面に固定表示、類似薬剤名・規格違いの強調表示、仮保存と確定のボタン視覚差別化、危険操作のワンクリック禁止。
- キーボード中心の連続入力導線(受付→入力→算定→会計)を第一級要件とする。
- 画面群仮説(screen_inventory_draft の初期リスト): 受付ダッシュボード / 患者検索・選択(取り違え防止表示付き)/ 処方入力 / 2次元シンボル読取 / 電子処方箋受付(境界)/ 患者・保険・公費確認 / 資格確認結果 / PMH確認結果 / 調剤入力 / 算定結果+calculation_trace表示 / 警告・エラー・BLOCKER表示 / 薬剤師確認 / 疑義照会記録 / 会計 / 未収・返金・差額精算 / 帳票出力 / 請求前点検 / 月次締め / レセプト出力 / 返戻・再請求管理 / マスター更新管理 / 外部連携状態 / 同期状態 / LOCAL_ONLYモード / RECOVERY_SYNC / 監査ログ / 管理者・権限管理。
- UI実装は sonnet5、方針と高リスク画面レビューは fable5 + opus4.8。医療安全に関わるUI文言はUI/UX SSOTで管理する。

## 6. ユーザー体験レベル底上げ方針

Phase 0 で `experience_quality_baseline.md` / `performance_budget.md` / `usability_acceptance_criteria.md` / `stability_slo_policy.md` を作成する。

- **サクサク動く仮説**: Edge Node をローカル読み書きの一次面とし、患者検索・医薬品検索・処方入力・仮算定はローカル完結で p95 200ms 級(候補値)を狙う。重い処理(レセプト生成・月次締め・マスター検証)は非同期+進捗表示。キーボードショートカット・連続入力・画面遷移数削減・帳票プレビュー高速化。速さのために外部確認・薬剤師確認・監査ログ・算定根拠を省略しない。
- **安定している仮説**: 自動保存と入力中データ保護、二重送信防止(Idempotency-Key)、ネットワーク断検知→LOCAL_ONLYへの安全遷移、通信断・端末スリープ・リロード後の入力復元、部分失敗の可視化、帳票再試行、Edge自己診断とバージョン不整合検出。エラーの握りつぶし禁止。
- **マニュアルレス仮説**: 業務順序に沿ったナビゲーション、現場用語ラベル+公式用語の対応、エラーに「何が危険か・何を確認するか・請求できるか」を明記、次アクション提示、文脈ヘルプ、training mode(合成データのみ)。直感性のために制度上必要な確認・危険表示を隠さない。
- 受入基準は §8.4 相当(マニュアルなし主要フロー完了、混雑時連続受付、状態誤認ゼロ、keyboard-only 完走、警告疲れレビュー等)を `usability_acceptance_criteria.md` に落とす。

## 7. 導入移行・並行稼働・カットオーバー・ロールバック方針

- Phase 0 で `implementation_migration_plan.md` / `legacy_rececon_migration_matrix.md` / `parallel_run_and_cutover_plan.md` を作成。
- 既存レセコンからの移行範囲(患者・保険・公費・処方/調剤/請求履歴・未収等)と非移行範囲を明確化。コードマッピングは CodeMappingRegistry 経由とし、コード不明データの自動請求コード割当を禁止。
- 移行照合(件数・金額)、重複患者統合、移行監査ログ、薬剤師・請求実務者レビューを必須とする。
- 並行稼働: 既知処方案件での算定照合・レセプト照合・帳票照合を行い、差分許容範囲を Go/No-Go 基準に含める。
- カットオーバー: 請求月境界に合わせた切替、失敗時の戻し手順(旧システム参照期間・保存義務データの保全)を事前定義。未定義なら `BLOCKED_CUTOVER_ROLLBACK_UNDEFINED`。

## 8. 性能SLO / デバイス / サポート / データガバナンス / 可観測性 / 接続試験・Go/No-Go

- **性能・安定性SLO**: `sla_slo_policy.md` / `performance_capacity_plan.md` で主要操作の p50/p95/p99、error rate、crash-free sessions、sync backlog、RTO/RPO を候補値定義し Phase 1 以降実測調整。月次請求期ピーク(月初)を capacity plan の基準にする。
- **現場デバイス**: `device_compatibility_matrix.md` で A4/領収証/薬袋/ラベルプリンタ、2次元シンボルリーダー、顔認証付きカードリーダー・資格確認端末、HPKI機器等の接続方式・LOCAL_ONLY時可否・二重印刷防止・代替手順を整理。印刷失敗の成功扱いを禁止。
- **サポート・保守**: `support_operations_model.md` で L1/L2/L3、月次請求期の強化体制、リモートサポートの本人確認・PHI最小化・操作監査、リリースノート・メンテ通知、Runbook(薬局向け/サポート向け)を設計。
- **データガバナンス・出口戦略**: `data_governance_policy.md` / `data_portability_exit_plan.md` でデータ所有権、tenant offboarding、閉局・法人変更、エクスポート形式(evidence_id・マスター版込み)、削除と法令保存義務の整理、legal hold、復元テストを設計。解約時に法令保存データへアクセス不能となる設計を禁止。
- **可観測性**: `observability_plan.md` で structured logs、correlation_id/causation_id、PHI classification とログマスキング、監査ログとデバッグログの分離、SLO/同期/外部Adapter/請求バッチ/マスター更新/Edge健全性ダッシュボード、alert routing を設計。PHI平文ログ出力を禁止。
- **接続試験・Go/No-Go**: `go_no_go_checklist.md` にオン資接続確認、電子処方箋接続試験(サンドボックス)、PMH事前検証、記録条件仕様検証、受付・事務点検ASP確認、JAHIS互換確認、並行稼働差分、移行照合、ロールバック手順確認、薬剤師・請求実務者・セキュリティ・医療安全レビュー完了を含める。

## 9. アーキテクチャ仮説

### 9.1 構成仮説

- **Cloud Core**(AWS東京リージョン): ECS Fargate + Aurora PostgreSQL + RDS Proxy + S3 + KMS + EventBridge/SQS + Step Functions。ALB + WAF + CloudFront。CloudTrail/GuardDuty/Security Hub/AWS Backup。IaCはCDKまたはTerraform(Phase 1で決定)。Blue/Green + canary + auto rollback、DB は expand-migrate-contract。マルチテナント(tenant_id/pharmacy_id、暗号鍵分離、tenant isolation test 必須)。
- **Pharmacy Edge Node**: 薬局内LANのローカルサーバー(PostgreSQL local 想定)。ローカルDB暗号化、端末証明書+mTLS、オフライン認証TTL、署名付き更新パッケージ+A/B update+self-test。ローカル算定・ローカル帳票・ローカル監査ログ・同期キュー。
- **同期**: Outbox/Inbox パターン、event envelope(event_id, tenant_id, pharmacy_id, sequence, logical/wall clock, idempotency key, causation/correlation id, schema version, payload hash, PHI classification)。二重送信・順序逆転・重複適用・競合を前提に設計。
- **Official Adapter 層**: オン資 / 電子処方箋 / 電子レセプト・オンライン請求 / PMH / JAHIS(2Dシンボル・薬歴連携)/(許諾後)NSIPS。公式仕様の形式(CSV/XML/固定長/Shift-JIS)を優先。
- **Pharmacy Integration API**: OpenAPI 3.1 + OAuth2 CC + mTLS + Webhook(署名付き)+ Idempotency-Key + sandbox + versioning/deprecation policy。Official Adapter とは分離。
- **リポジトリ**: pnpm monorepo。`apps/web`(Next.js想定・ClaudeCode側所有)/ `apps/api`(Codex側所有)/ `packages/*`(共通モジュール、§14)。フレームワーク最終決定は Phase 1。

### 9.2 境界図(概念)

```text
┌──────────────────────────── External National Systems ───────────────────────────┐
│ オンライン資格確認等システム / 電子処方箋管理サービス / オンライン請求 / PMH      │
└───────────────▲───────────────────────────────────────────────────────────────────┘
                │ Official Adapter(公式仕様準拠のみ・独自解釈禁止)
┌───────────────┴───────────────┐         ┌────────────────────────────────────────┐
│         Cloud Core (AWS)      │◀─sync──▶│        Pharmacy Edge Node(薬局LAN)     │
│ マルチテナント管理/マスター配布│ Outbox/ │ ローカルDB/仮算定/帳票/監査ログ/キュー │
│ 集中監査/バックアップ/請求管理 │  Inbox  │ LOCAL_ONLY業務継続                      │
└───────────────▲───────────────┘         └───────▲────────────────────────────────┘
                │ Pharmacy Integration API(OpenAPI/OAuth2/mTLS/Webhook)│薬局内LAN
┌───────────────┴────────────────────────────────────────────────────┴─────────────┐
│ Partner Systems: 電子薬歴 / 調剤監査 / 分包機 / POS / 在庫 / お薬手帳             │
└───────────────────────────────────────────────────────────────────────────────────┘
```

### 9.3 モード別業務整理(許可・禁止の初期表)

| 操作 | NORMAL | EXTERNAL_DEGRADED | CLOUD_DEGRADED | LOCAL_ONLY | RECOVERY_SYNC |
|---|---|---|---|---|---|
| 患者・保険参照(ローカル保存済) | ○ | ○ | ○ | ○ | ○ |
| 新規オンライン資格確認 | ○ | ×(PENDING_REVERIFY) | 外部可なら○ | ×(成功扱い禁止) | 再確認実行 |
| 紙処方箋仮受付・QR仮取込 | ○ | ○ | ○ | ○ | 再検証対象 |
| 電子処方箋取得・調剤結果送信 | ○(実装時) | ×(PENDING_EXTERNAL_SYNC) | 外部可なら○ | × | 再送・再照合 |
| 薬剤師確認 | ○ | ○ | ○ | ○ | ○(復旧承認) |
| 算定 | 確定算定 | 確定算定(資格未確認は仮) | 確定算定(ローカル版) | 仮算定のみ(PROVISIONAL) | 再計算・差額検出 |
| 会計・帳票 | ○ | ○(状態表示) | ○ | 仮帳票(明示表示) | 差額精算導線 |
| 請求前点検・月次締め・レセプト確定 | ○ | 資格再確認まで不可 | 原則不可(集中管理必要) | × | 完了後に可 |
| オンライン請求受け渡し | ○(公式手順) | × | × | × | 点検後に可 |
| マスター本番反映 | 検証後○ | 検証後○ | ×(保留) | ×(旧版継続) | 版整合確認後 |
| Cloud横断管理・集中バックアップ | ○ | ○ | 保留 | 保留 | 再開・整合確認 |

LOCAL_ONLY の全出力に PROVISIONAL/PENDING 系ステータスを強制付与。復旧後の不一致は自動補正せず CONFLICT_REQUIRES_HUMAN_REVIEW。

## 10. 外部システム責務分界仮説

- **オンライン資格確認**: 資格確認端末+公式外部IF経由の結果取込・スナップショット管理・請求前再確認までを本システムの責務とする。外部IF仕様は医療機関等ONSで確認するまで実装凍結(`BLOCKED_REGULATORY_REVIEW`)。オフライン時は最終確認日時・確認方法・再確認要否を必ず表示。
- **電子処方箋**: MVPでは境界設計(受付・引換番号・処方情報取得・調剤結果送信・HPKI署名の責務分界とデータモデル)まで。技術解説書2.04版以降・記録条件仕様・セルフチェックリスト・接続試験環境の確認後に実装判断。未接続時の取得・送信・チェック完了の成功扱いを禁止。
- **PMH**: 制度関連マスタ・利用規約・対象自治体を確認し、MVPは状態管理(PENDING_PMH_REVERIFY)と公費按分への入力境界のみ。
- **オンライン請求**: レセプト生成・記録条件検証・月次締め・ロックまでが本システム、送信は公式手順(オンライン請求用端末・電子証明書・公式ネットワーク)への受け渡し。直接送信自動化は公式接続方式確認まで `BLOCKED_REGULATORY_REVIEW`。
- **JAHIS**: 2次元シンボル記録条件規約 Ver.1.11以降・薬歴連携仕様 Ver.1.1以降・お薬手帳 Ver.2.6以降の最新版を version_watchlist で監視。QR読取は仮取込とし紙面照合ルールを設計。
- **SaMD該当性**: 重複投薬等チェック・併用禁忌チェック・監査支援機能について、プログラム医療機器該当性ガイドラインと照合し Phase 0 で判定。不明は `BLOCKED_PMDA_SAMD_REVIEW`。

## 11. fable5統率の実装オペレーション方針

- fable5 が唯一の実装指揮者。全作業を work package(WP)化し、owner_side / owner_agent / execution_mode / ssot_refs / allowed_files / reviewer / handoff_channel / implementation_layer / risk_level(R0-R4)/ ambiguity(A0-A4)等を明記して発行。WPなし実装・探索的本番変更は禁止。
- **Definition of Ready**: 公式資料確認済み・該当SSOTがAPPROVED・受入条件テスト可能・allowed/forbidden files明確・ロールバックあり・PHI/PII影響評価済み・高リスクはopus4.8事前レビュー済み。未充足は BLOCKED_NOT_READY。
- **Definition of Done**: CI/typecheck/lint/test/golden/contract/UI workflow/accessibility/performance budget pass、evidence_id・legal_trace あり、監査ログ反映、PHI非出力、ドキュメント・SSOT 更新、agmsgハンドオフ済み、高リスクはopus4.8レビュー済み。
- **SSOT駆動**: 仕様決定→SSOT作成/更新(DRAFT→PROPOSED→APPROVED)→WP発行→実装→IMPLEMENTED/VERIFIED。未承認・STALE・矛盾SSOTでの実装禁止。仕様差分発見時はコードを先に合わせず `SSOT_UPDATE_REQUIRED` で fable5 へ返す。
- **Contract-first**: API関連は SSOT + OpenAPI 確定→CODEX_BACKEND_PLAN→CLAUDE_FRONTEND_PLAN→backend実装+contract test→BACKEND_CONTRACT_READY→frontend実装→FRONTEND_INTEGRATION_READY→統合E2E。契約外フィールドの仮定・UI都合のAPI追加を禁止し、変更は CONTRACT_CHANGE_REQUEST。
- **PR運用**: 小さく保つ、work_package_id・evidence_id・rollback・テスト結果・PHI/PII影響・SSOT参照必須。高リスクPRは opus4.8 承認必須。ブランチは `claude/<wp-id>-*` / `codex-sol/<wp-id>-*` 等。
- **ブロッカー処理**: 定義済みBLOCKER種別で agmsg `blockers` へ。fable5 が triage(追加調査/scope変更/分割/レビュー依頼/人間レビュー/実装禁止/代替案)。

## 12. Claude側 / Codex側 二系統チーム体制方針

- **Claude側**(fable5/opus4.8/sonnet5/haiku4.5): Claude Code `/ultracode` 必須。仕様・法令・医療安全・UI/UX方針・全体統率・レビューゲート・**フロントエンド実装**(`apps/web`、`packages/ui` 等)を所有。
- **Codex側**(Sol中心): Codex `ultraモード` 必須。**バックエンド実装**(`apps/api`、domain/calculation/claim/masters、DB schema/migration、Official Adapter、同期、IaC、CI調査)を所有。規制・請求・医療安全の最終判断者にしない。
- **fable5とSolの責務分界**: fable5=仕様決定権・SSOT承認権・WP発行権・レビューゲート管理権・merge最終判断。Sol=Codex側の実装推進責任者(サブタスク分解・実装・検証・セルフレビュー・ハンドオフ)。SolはBLOCKERを無視せず、仕様不明は CODEX_BLOCKED で返す。
- **実行モード検証**: Phase 0 冒頭で `/ultracode`(Claude側)と Codex `ultraモード` の利用可否を検証し `llm_capability_registry.md` へ記録。不可なら CLAUDE_ULTRACODE_UNAVAILABLE / CODEX_ULTRA_MODE_UNAVAILABLE / CODEX_CAPABILITY_UNVERIFIED で停止・代替判断。現時点は両者とも**未検証**(→BLOCKER)。
- **agmsg相互連絡**: ルーム(lane-control / claude-command / codex-ultra-mode / handoff / cross-review / blockers / ci-investigation / release-gate / incident)と定型メッセージ(WP_ASSIGN / WP_ACK / CODEX_PLAN / CODEX_BLOCKED / WP_HANDOFF / DECISION_REQUIRED / REVIEW_RESULT 等+共通モジュール欄)を `agmsg_cross_lane_protocol.md` で規定。agmsgは連絡手段であり正式証跡ではない。重要決定はADR/SSOT/PRへ転記。PHI/PII・秘密情報・NSIPS本文・ONS制限資料の投稿禁止。
- **WPライフサイクル**: fable5作成→WP_ASSIGN→WP_ACK→(Codex側は)CODEX_PLAN→承認→実装→テスト→WP_HANDOFF→レビュー→(高リスクは)opus4.8→fable5完了判定→正式ドキュメント転記。
- **相互レビュー**: 実装者とレビュー者を分離。Claude側実装は haiku4.5/Codex側が差分確認+高リスクはopus4.8。Codex側実装は sonnet5/haiku4.5レビュー+大規模はfable5+高リスクはopus4.8。自己完了判定禁止。
- **衝突解決**: 法令違反>医療安全>請求事故>PHI漏えいの順で即停止→fable5がDECISION_REQUIRED→opus4.8高リスクレビュー→Sol技術根拠提示→fable5裁定→必要時人間レビュー→ADR転記。解決まで merge 禁止。
- **ファイル競合防止**: WPごとに owner_lane と変更対象ファイルを事前宣言、高リスクファイルは fable5 が編集ロック(`file_ownership_and_lock_policy.md` / `shared_file_lock_policy.md`)。共有・契約領域(openapi.yaml、docs/ssot、packages/shared 等)はロック取得後のみ編集。
- **Codex側データ取扱い**: 渡してよいもの=WP本文・リポジトリ内参照・issue/PR番号・マスク済みログ・合成fixture。禁止=PHI/PII・本番データ・電子証明書・秘密鍵・接続先秘密情報・NSIPS本文・ONS制限資料本文(`codex_data_handling_policy.md`)。

## 13. モデル別役割分担 + agent_assignment_matrix 初期案

- **fable5**: 統率・計画・仕様境界・UI/UX方針・SSOT承認・WP発行・レビューゲート・最終判断。A3以上の曖昧性解消、R3以上のowner。大量実装は抱えない。
- **opus4.8**: 高リスク設計・レビュー専任(算定・レセプト・Official Adapter・AWS無停止・セキュリティ・医療安全・法令)。直接実装は FABLE_CROSS_LANE_APPROVAL 付き限定参考実装のみ。
- **sonnet5**: ClaudeCode側主力フロントエンド実装(UI・画面CRUD・API接続・帳票プレビュー・フロントE2E・体験品質改善)。
- **haiku4.5**: scan/lint/typecheck/差分要約/整合性確認/軽量UX回帰。判断主体にしない。
- **Codex側Sol**: バックエンド主実装+大規模読解・CI調査・性能調査・テスト生成・独立技術レビュー。
- **割当アルゴリズム**: risk_level × ambiguity × size × execution_need × repetition × ux_safety の6軸で分類し、A4/R4は実装禁止(BLOCKER化)、A3+はfable5仕様確定先行、R3+はopus4.8事前レビュー+実装/レビュー分離、S3+/E2 backend→Sol・frontend→sonnet5、P3+→haiku4.5、U3+はfable5 UX方針+opus4.8安全レビュー。
- **agent_assignment_matrix 初期案**(要約 — Phase 0 で正式版作成):

| タスク種類 | layer | 主担当 | 実行モード | レビュー |
|---|---|---|---|---|
| MVP/法令/医療安全/UI-UX SSOT | ssot | fable5 | claude_code_ultracode | opus4.8+人間 |
| 画面・フォーム・オフラインUI | frontend | sonnet5 | claude_code_ultracode | fable5(+U3+はopus4.8) |
| バックエンドAPI/ドメイン/CRUD | backend | Codex側Sol | codex_ultra | fable5(+R3はopus4.8) |
| 算定エンジン/電子レセプト/Adapter | backend | Codex側Sol | codex_ultra | opus4.8必須+人間候補 |
| 算定・レセプト設計/期待値 | ssot/review | opus4.8 | claude_code_ultracode | fable5+人間候補 |
| OpenAPI/contract/共通型 | shared | Codex側Sol | codex_ultra | sonnet5利用側+fable5 |
| UI共通module | frontend/shared | sonnet5 | claude_code_ultracode | fable5 |
| money/date-time/trace型 | shared | Codex側Sol | codex_ultra | opus4.8 |
| Edge同期/AWS・IaC/セキュリティ実装 | backend | Codex側Sol | codex_ultra | opus4.8 |
| scan/secret/依存/整合性検査 | review | haiku4.5 | claude_code_ultracode | fable5 |
| CI失敗調査 | backend/review | Codex側Sol | codex_ultra | UI起因はClaude側へ返却 |
| PR最終承認 | review | fable5 | claude_code_ultracode | opus4.8/人間候補 |

## 14. 共通モジュール方針仮説 + 共通モジュールSSOT作成方針

- 共通モジュールはSSOT確定仕様の実装統制単位。runtime-neutral / dependency-light / testable / tree-shakable を原則とし、ClaudeCode側とCodex側が同じ概念を別々に再実装することを禁止する。
- 初期パッケージ仮説: `packages/contracts`(OpenAPI generated types + DTO + Zod schema)、`packages/shared-kernel`(branded ID、システムモード、PENDING系status、BLOCKER/error/warning code、permission scope、audit event type)、`packages/money`(Decimal・丸め境界)、`packages/date-time`(請求月・処方日・調剤日・TZ)、`packages/trace`(calculation_trace / legal_trace / evidence_id 型)、`packages/events`(sync/Outbox/Inbox envelope)、`packages/api-client`(generated client)、`packages/fixtures` / `packages/test-utils`(合成データのみ・PHI混入禁止)、`packages/ui`(frontend専用)。実構成は fable5 が Phase 1 で確定し、shared の無秩序肥大を禁止。
- 依存方向: `apps/*` → `packages/*` のみ。ui は backend/DB/AWS SDK 禁止、domain/calculation は React/UI/DB/外部API/現在時刻 禁止、contracts/shared-* は apps 依存禁止・循環禁止。違反は COMMON_MODULE_DEPENDENCY_VIOLATION で停止。
- owner: UI共通=sonnet5、contracts/共通型/money/date-time/trace/event=Codex側Sol(opus4.8・fable5レビュー)、fixtures=WPごとにfable5指定。同時編集禁止・ロック必須。
- 共通モジュールSSOT(Phase 0 で骨格作成、Phase 1 で確定): `common_module_inventory.md` / `common_module_boundary.md` / `dependency_direction_policy.md` / `shared_type_registry.md` / `status_registry.md` / `error_code_registry.md` / `permission_scope_registry.md` / `audit_event_registry.md` / `event_envelope_schema.md` / `money_point_policy.md` / `date_time_policy.md` / `validation_schema_policy.md` / `fixture_policy.md` / `generated_code_policy.md`。
- 検査: circular dependency / dependency direction / duplicate enum・status・error code scan / generated code drift / bundle size / import boundary / fixtures PHI scan / Decimal・date-time misuse scan を CI に組み込む(haiku4.5 軽量スキャン+Sol CI 調査)。generated code 手編集禁止。

## 15. 主要リスク(リスク台帳初期項目)

1. 公式仕様(記録条件仕様・オン資/電子処方箋外部IF)がONSアクセス前提で入手未確認 — 実装凍結範囲が大きい
2. 令和8年度改定対応のマスター・点数の版ズレによる算定誤り
3. LOCAL_ONLY⇄RECOVERY_SYNC の競合解決不備による二重登録・二重請求
4. 外部確認未完了の成功誤認(UI/状態設計の失敗)— 医療安全・請求事故直結
5. SaMD該当性判定の見誤り(重複投薬・併用禁忌チェック等)
6. NSIPS許諾未取得のまま既存機器連携要望に引きずられる仕様汚染
7. 公費・地方単独助成の組み合わせ爆発によるMVPスコープ崩壊
8. マルチテナント分離不備(薬局間データ混在=重大事故)
9. 二系統運用での共有ファイル競合・API契約ドリフト
10. Codex側実行環境・権限の未確認による計画前提崩れ
11. 移行データのコードマッピング品質不足による請求事故
12. 月次請求期ピークの性能未達・帳票印刷障害

## 16. 公式資料調査リスト / 仕様版確認リスト / 法令確認リスト

- **公式資料調査リスト**(source_registry 初期対象): プロンプト§11(10.1〜10.9)の全項目。Priority A(法令・告示・通知・疑義解釈、支払基金・国保中央会、診療報酬情報提供サービス、ONS、デジタル庁PMH、個情委)/ B(JAHIS、NSIPS公式、AWS公式、安全管理GL)/ C(解説=補助のみ)で登録。
- **仕様版確認リスト**(version_watchlist 初期対象): 調剤用記録条件仕様(最新版・適用日)、電子処方箋管理サービス技術解説書 2.04版以降、電子処方箋記録条件仕様、オン資外部IF仕様書、JAHIS 2Dシンボル Ver.1.11以降、JAHIS薬歴連携 Ver.1.1以降、お薬手帳 Ver.2.6以降、安全管理GL 第7.0版以降、事業者向けGL 第2.0版以降、令和8年度改定マスター一式、PMH制度関連マスタ、NSIPS最新版・許諾条件。
- **法令確認リスト**: 薬剤師法・同施行規則(調剤録・保存期間)、薬機法(SaMD該当性・薬袋表示)、健保法・国保法・高確法、薬担規則、療養の給付請求省令・記載要領、e-文書法・電子署名法(電子保存3原則)、個人情報保護法・医療介護ガイダンス(要配慮個人情報・委託)、介護保険法(薬局影響範囲)、薬局機能情報提供制度・地域連携薬局。

## 17. Phase 0 作業計画(コードなし・成果物作成のみ)

| # | 作業 | 主担当 | レビュー | 出力 |
|---|---|---|---|---|
| 0 | 実行モード・能力検証(/ultracode・Codex ultra・agmsg 実環境確認) | fable5 | 人間 | llm_capability_registry.md, codex_capability_verification.md |
| 1 | 二系統運用ドキュメント一式 | fable5 | opus4.8 | dual_lane_operating_model.md ほか §0.1.6.15 全部+execution_mode_policy.md, ssot_governance.md |
| 2 | source_registry / version_watchlist 構築(公式資料の所在・版・適用日確認) | fable5 | opus4.8 | source_registry.md, version_watchlist.md |
| 3 | legal_compliance_matrix / regulatory_blockers / SaMD該当性確認 | fable5 | opus4.8+人間 | legal_compliance_matrix.md, regulatory_blockers.md |
| 4 | medical_safety_risk_register / safety_case 骨格 | fable5 | opus4.8+薬剤師候補 | 同名成果物 |
| 5 | mvp_scope / non_mvp_scope / calculation_coverage_matrix / claim_scope_matrix | fable5 | opus4.8+人間 | 同名成果物 |
| 6 | official_adapter_inventory / external_system_boundary / offline_mode_matrix / recovery_sync_design | fable5 | opus4.8 | 同名成果物 |
| 7 | master_update_pipeline / code_mapping_registry_design | fable5 | opus4.8 | 同名成果物 |
| 8 | UI/UX・体験品質SSOT(medical_ui_ux_principles / experience_quality_baseline / performance_budget / usability_acceptance_criteria / stability_slo_policy / workflow_map / screen_inventory_draft) | fable5 | opus4.8 | 同名成果物 |
| 9 | セキュリティ・プライバシー(security_guideline_mapping / provider_…/ privacy_impact_assessment / threat_model / edge_node_security_design / tenant_isolation_design) | fable5 | opus4.8 | 同名成果物 |
| 10 | 実運用・移行・SLO・デバイス・ガバナンス(§7〜8の全成果物+finops_plan / go_no_go_checklist) | fable5 | opus4.8 | 同名成果物 |
| 11 | 実装統率(implementation_workflow / work_package_template / definition_of_ready / agmsg_team_protocol / codex_collaboration_policy / branching_and_pr_policy / review_gate_matrix / blocker_triage_policy / human_review_checklist) | fable5 | opus4.8 | 同名成果物 |
| 12 | 品質(quality_plan / validation_plan / change_control_policy / test_strategy) | fable5 | opus4.8 | 同名成果物 |
| 13 | 共通モジュールSSOT骨格(§14の14文書) | fable5 | opus4.8 | 同名成果物 |
| 14 | ssot_index 整備・Phase 0 完了判定・人間レビュー依頼 | fable5 | 人間 | ssot_index.md, Phase 0 gate報告 |

進め方: #0〜#1 を最初に完了(体制の前提確認)→ #2〜#4(根拠と安全)→ #5〜#7(スコープと境界)→ #8〜#13(設計方針群)→ #14 ゲート。haiku4.5 は各成果物の整合性検査、Codex側は #0 の能力検証応答と既存資料差分検査のみ参加(公式資料の一次解釈はさせない)。

## 18. Phase 1 以降の大まかな進め方

- **Phase 1(設計)**: bounded_contexts / domain_model / data_model / ERD / API設計(openapi.yaml v0)/ event_catalog / aws_architecture / edge_node_architecture / sync_design / screen_inventory 確定 / error_state_design / offline_ui_design / accessibility_policy / audit_log_design / test_strategy 詳細化 / 共通モジュール境界確定。高リスク設計はopus4.8レビュー、Phase 1完了ゲートで人間レビュー。
- **Phase 2以降(実装)**: WP単位で contract-first に実装。順序仮説: ①monorepo scaffold+共通モジュール基盤+CI ②認証認可・テナント分離・監査ログ ③患者・保険・公費管理 ④処方・調剤入力+QR読取 ⑤マスター取込パイプライン ⑥算定エンジン(golden test 先行)⑦会計・帳票 ⑧レセプト生成・請求前点検・月次締め ⑨Edge Node・LOCAL_ONLY・RECOVERY_SYNC ⑩Official Adapter(オン資→電子処方箋境界)⑪Integration API v0 ⑫移行ツール・並行稼働支援。各フェーズ末に Go/No-Go ゲート。
- 実装は Claude側=frontend(/ultracode)、Codex側=backend(ultraモード)固定。高リスク領域は設計レビュー→実装→コードレビュー→結果レビューの三段。

## 19. 人間レビューが必要な論点

1. MVP算定範囲(§2.1 の算定項目リスト、対象外時の停止方針)— 請求実務者・薬剤師レビュー必須
2. 電子処方箋をMVPで境界設計に留める判断の妥当性(市場要件との整合)
3. SaMD該当性の判定結果(重複投薬・併用禁忌チェックの扱い)
4. NSIPS許諾取得の要否・時期
5. 公費・地方単独助成のMVPカバー範囲(対象地域・制度の限定方針)
6. オンライン資格確認の接続構成(資格確認端末連携方式)とONS資料取得の段取り
7. 帳票の保存期間・電子保存(e-文書法)運用管理規程の方針
8. 既存レセコン移行のスコープ(移行元システム・データ範囲)
9. SLO候補値・性能予算の目標水準
10. サポート体制・SLAの事業前提(提供形態・価格・体制)
11. Codex側実行環境(モデル・権限・Cloud利用可否)の確認結果承認
12. Phase 0 成果物の完了判定(Phase 0 gate)

## 20. 現時点のBLOCKER

| 種別 | 内容 | 次アクション |
|---|---|---|
| CODEX_CAPABILITY_UNVERIFIED | Codex側(GPT-5.6 sol max / ultraモード)の実環境・権限・モデル名が未確認 | Phase 0 #0 で codex CLI・agmsg 経由の能力検証を実施し registry へ記録 |
| AGMSG_PROTOCOL_UNVERIFIED | agmsg のルーム・配信方式が実環境で未検証 | Phase 0 #0 で疎通確認 |
| BLOCKED_REGULATORY_REVIEW | 記録条件仕様・オン資/電子処方箋外部IF等、ONSアクセス前提資料が未確認 | source_registry 構築時に入手経路を整理し人間へ依頼 |
| BLOCKED_PMDA_SAMD_REVIEW | プログラム医療機器該当性が未判定 | Phase 0 #3 で該当性整理→人間レビュー |
| BLOCKED_NSIPS_LICENSE | NSIPS利用許諾が未取得 | 許諾方針を人間判断(§19-4) |

---

Phase 0計画案を提示しました。人間レビュー後に次へ進みます。
