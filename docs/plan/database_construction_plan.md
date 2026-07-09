# database_construction_plan — データベース構築計画(Phase DB-0〜DB-5)

```yaml
ssot_id: PLAN-DB-001
title: データベース構築計画
domain: plan
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required(本番インフラ確定時)
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: ユーザー指示 2026-07-09(各種データベースの構築計画立案)
depends_on: [DOM-002, ARC-004, ARC-005, ARC-006, ARC-010, ARC-011, SEC-006, SEC-007, SEC-008, MOD-009, MOD-010, MST-001, API-001, API-006, OPS-005, REG-003]
impacts: [Plans.md WP-5001以降, apps/api(リポジトリ差し替え), packages/events(Outbox永続化)]
open_questions: 保存期間・削除方針の法令要求(BLOCKED_LEGAL_REVIEW)/ 本番リージョン・DR構成(BLOCKED_SECURITY_REVIEW)
```

## 1. 目的と上位制約

現状、全リポジトリは interface + in-memory 実装(API-001 §「DBは未導入」、API-006 同旨)。本計画は yrese の永続化層を種別ごとに定義し、段階導入の順序と停止条件を確定する。

上位制約(本計画は変更しない):
1. **インフラ製品の採用確定は SEC-008 §3 の前提4条件(法令・GL 保存要件の確定 / コスト・運用評価 / Edge 側チェーン維持との整合 / セキュリティレビュー)+ BLOCKED_SECURITY_REVIEW 解除後**。本計画に現れる製品名はすべて既存 SSOT が例示済みの「候補」である
2. **コアは特定インフラを前提にしない**(ARC-004 原則)— ドメイン・算定・契約は DB 技術に依存しない
3. **24-365・夜間バッチ廃止**(ARC-010/011)— 停止を伴うメンテナンス・移行を設計に組み込まない

## 2. データベース種別の台帳(「各種」の定義)

| # | 種別 | 用途 | 正本性 | 主要 SSOT 根拠 | 候補技術(確定しない) |
|---|---|---|---|---|---|
| 1 | 業務 OLTP DB | Cloud Core の患者・保険・受付・処方・調剤の業務データ | 集約の正本(ES 非適用集約) | DOM-002(集約)、SEC-006(テナント分離) | PostgreSQL 系 |
| 2 | イベントストア | 算定・請求ライフサイクル / 会計台帳 / 監査 = ARC-005 の限定適用集約 | **イベントが正本**・投影は使い捨て(ARC-006) | ARC-005/006/007 | PostgreSQL 追記テーブル等 |
| 3 | 監査ログストア | 監査イベントの永続化(append-only + SEC-007 ハッシュチェーン) | 正本(改竄耐性が要件) | SEC-007/008、MOD-008 | DB 追記 + S3 Object Lock は追加防御 |
| 4 | マスターデータベース群 | 外部配布・参照マスターの版管理(**個別台帳は §2.1**) | 配布元が正本・当 DB は検証済み版の保持 | MST-001/002(台帳・検証規定の正本) | PostgreSQL 系(版別イミュータブル) |
| 5 | Edge ローカルストア | Pharmacy Edge Node の投影・キャッシュ(LOCAL_ONLY 稼働の基盤)。**正本を持たない**(ARC-010) | 非正本(再構築可能) | ARC-010、SEC-005 #11(Edge チェーン) | SQLite / 組込 KVS 等 |
| 6 | 同期キューストア | Outbox/Inbox の永続化(dead_letter は理由必須) | 転送状態の正本 | MOD-009(EventEnvelope、Outbox 実装時の deferred 事項を含む) | OLTP DB 内テーブルから開始 |
| 7 | 検索・分析系(将来) | 全文検索・BI | 非正本(投影) | QUA-007 L4(公開 KPI 基盤) | — MVP では作らない(OLTP の検索で足りる。導入は実測の性能課題が根拠) |
| 8 | 帳票・文書ストア | 領収証・明細書の発行履歴と生成物(再発行・出力履歴 = RCP 系)、紙処方箋等スキャンの電子保存 | 記録(発行済み文書は不変) | RCP-001〜006(発行・再発行・番号)、P-12 | object storage 候補。法定保存年限は BLOCKED_LEGAL_REVIEW |
| 9 | 請求成果物ストア | 確定レセプトファイル(記録条件仕様形式)・返戻取込データ | 記録・**確定後 append-only**(ARC-007) | CLM-001 工程7/8/10、ARC-007 | WORM 候補(#3 と近接)。**請求形式の実装自体が BLOCKED_REGULATORY_REVIEW(記録条件仕様の evidence 待ち)** |
| 10 | 外部連携・通信記録ストア | Official Adapter(オン資・電子処方箋・オンライン請求・PMH)送受信記録、PENDING_EXTERNAL_SYNC 永続化、JAHIS 入出力ファイル、Partner API キー・webhook 配信記録 | 記録(証跡) | ADP-001/002(通信仕様は各 Adapter SSOT へ委譲)、WP-0036(Partner 系) | Adapter 実装 WP に従属(単独では作らない)。API キーは認証ストア(#11)と分界 |
| 11 | 認証・認可・テナント管理ストア | ユーザー・ロール・権限付与・セッション/API キー・薬局テナント台帳(現行 dev スタブの本実装) | 正本 | SEC-006、MOD-007(permission)、API-003 | **auth 方式確定まで BLOCKED_SECURITY_REVIEW**。外部 IdP 利用も候補として排除しない |
| 12 | アーカイブ・法定保存階層 | 調剤録・処方箋等の保存期間別ストレージ階層(コールド化) | 記録(正本の長期保管) | SEC-007 open_question(保存階層)、REG-003 | 年限確定は BLOCKED_LEGAL_REVIEW。確定まで「削除しない」側に倒す(§5) |

区分の凡例: **正本**(そこが唯一の真実)/ **記録**(証跡・生成物 — 不変)/ **派生**(投影・キャッシュ — 再構築可能)/ **参照**(外部配布の検証済み複製)。#1〜3・11=正本、#4=参照、#5=派生、#6=転送状態の正本、#7=派生、#8〜10・12=記録。

**明示的な対象外(スコープ混同防止):**

| 対象外 | 理由 |
|---|---|
| 電子薬歴(薬剤服用歴・服薬指導記録の正本) | yrese は保持しない。外部パートナー面(DOM-005 facade / PRD-001 M12 の配信先)。服薬管理指導料の算定要件との関係は算定系 SSOT で扱う |
| 在庫管理 DB | non-MVP(PRD-002 N9 — POS・在庫連携は Integration API 先行) |
| 医薬品安全性 DB(相互作用・禁忌) | §2.1 M10 のとおり BLOCKED — 実装対象外(スキーマも作らない) |

### 2.1 マスターデータベース群の個別台帳

本節は **MST-001(更新パイプライン・24段検証・PENDING_MASTER_VALIDATION)/ MST-002(コードマッピング)の DB 実装計画**であり、マスターの台帳・検証規定そのものは MST 系 SSOT を正本とする(重複定義しない)。配布元・入手経路は source_registry(REG-001)の登録が唯一の根拠 — **現時点で §10.3/10.7 系は全て UNVERIFIED / 【要確認】であり、各マスターの取込実装は配布元仕様の evidence_id 発行が前提**(MST-001 blockers)。外部配布マスターの実体データは再配布禁止(API-005 §3 deny)。

| # | マスター | 用途 | 配布元・入手経路(SSOT 根拠) | 版管理・有効日 | PENDING_MASTER_VALIDATION |
|---|---|---|---|---|---|
| M1 | 医薬品マスター(薬価・レセ電コード) | 調剤・請求の医薬品特定(**請求直結 — evidence 規律対象**) | source_registry §10.3(診療報酬情報提供サービス 医薬品マスター — UNVERIFIED) | 必須(有効日・廃止日・経過措置) | 適用 |
| M2 | 一般名処方マスター | 一般名処方の記載・変換支援 | **source_registry 未登録 — 行追加と検証が DB 化の前提**(推測で配布元を断定しない) | 必須 | 適用 |
| M3 | 調剤報酬点数マスター | 点数・加算の配布数値・コード表。**分界: 適用条件・算定ロジックは CAL-009 の versioned rule data(evidence 裏付けで作成)であり、本マスターはルールが参照する配布値の保持** | source_registry §10.3(基本/調剤行為/コメント各マスター — UNVERIFIED) | 必須(告示版・適用日) | 適用 |
| M4 | 医療機関マスター | 処方元の特定(保険医療機関コード) | source_registry §10.3 系(【要確認】) | 必須(開設・廃止・変更) | 適用 |
| M5 | 医師マスター(処方医) | 処方医の記録(医療機関に従属) | 公的な全国配布の存在自体が【要確認】 — 確認まで処方箋記載に基づく自局登録データとして扱う(配布マスターとしない) | 履歴保持のみ | 対象外(配布物でない間) |
| M6 | 保険者マスター | 保険者番号の検証・名称解決 | source_registry §10.3(支払基金/国保中央会 — 【要確認】) | 必須 | 適用 |
| M7 | 公費負担者マスター | 法別番号・負担者番号。**地方公費(自治体単独)は自治体ごとに入手経路が異なり未確定** — 確定まで該当公費の取込は行わない(fail-closed) | source_registry §10.3(【要確認】)+ 地方公費は経路未登録 | 必須(制度改廃) | 適用 |
| M8 | 用法マスター(JAHIS/JAMI 用法コード) | 用法の標準コード化 | source_registry §10.7(JAHIS — UNVERIFIED)。**JAHIS 頒布条件に従い本文・コード表の転載/再配布禁止**(API-005) | 必須(規約版) | 適用 |
| M9 | 薬局内マスター(自局施設情報・薬剤師/スタッフ) | 自局の参照データ(外部配布なし — OLTP 寄り) | 自局入力(配布元なし) | 版管理不要(変更履歴のみ = P-12) | 対象外 |
| M10 | 医薬品安全性系(相互作用・禁忌等) | 服薬監査の参照(**将来**) | 出典未確定・高リスク → **BLOCKED_MEDICAL_SAFETY_REVIEW + 出典 evidence 確定まで実装しない(参照のみ予定と台帳固定、スキーマも作らない)** | —(実装しない) | —(実装しない) |

共通規律: 全マスターとも (a) 版別イミュータブル(取込済み版は変更せず新版追加)、(b) 処方日・調剤日・請求月に応じた版選択(MST-001 §1)、(c) 検証失敗時は旧版継続、(d) dev/test への実データ投入は配布条件を確認するまで合成データのみ(MOD-013)。

## 3. 横断設計原則(fail-closed)

1. **テナント分離**: アプリ層 deny-by-default(requirePermission + tenant 拘束)が正。DB 層の行レベル分離(RLS 等)は多層防御の**追加**として評価し、アプリ層の代替にしない(SEC-006/SEC-008 §3)
2. **PHI 暗号化**: 全ストアで at-rest 暗号化必須。鍵管理は KMS 候補(製品確定は §5 ゲート)。イベントの PHI≠none→encrypted 実行時不変条件(MOD-009)は永続化後も維持(平文で DB に置かない)
3. **金額・点数の型**: 整数系(bigint / NUMERIC(…,0))のみ。**浮動小数点カラム禁止**(MOD-010 と対。float/double/real を money/points 系に使った時点で CHANGES_REQUESTED)
4. **時刻**: 業務データ(処方日・調剤日・受付時刻・請求月等)に DB の now()/CURRENT_TIMESTAMP を使わない — 値はアプリ層(@yrese/date-time 経由)が供給する(暗黙の現在時刻禁止)。DB 管理メタ(レコード挿入時刻等の技術列)への使用は可とし、業務判定に使わない
5. **append-only**: 会計台帳・監査ログ・確定レセプト・イベントストアは UPDATE/DELETE を発行しない設計とし、DB 権限でも業務ロールから UPDATE/DELETE を GRANT しない(ARC-007 / SEC-008 §2 の DDL/DCL 反映)。訂正は新レコード追記
6. **マイグレーション規律**: 前方一方向のみ(down マイグレーションで本番データを破壊しない — 巻き戻しは新マイグレーション追加で表現)。スキーマ版はリポジトリで版管理し、適用は明示的な運用操作(時刻トリガーの自動適用禁止 — ARC-011)。適用前後の検証手順を必須化
7. **Repository interface 維持**: 既存の interface + in-memory 構成を保ち、DB 実装は差し替え可能な実装として追加(既存テストは合成 fixture のまま維持、DB 実装には別途統合テスト)

## 4. 段階計画

| Phase | WP | 内容 | 発行条件(DoR) |
|---|---|---|---|
| DB-0 | WP-5001 | **DB 設計 SSOT パック起草**: スキーマ設計規約(命名・型・テナント列・§3 原則の DDL 化)/ マイグレーション規律 / テナント分離 DDL 方針 / 保存期間・削除方針(法令確認部分は BLOCKED_LEGAL_REVIEW のまま骨子のみ) | 即時着手可(fable5 起草 → opus4.8 レビュー) |
| DB-1 | WP-5002 | **開発環境 PostgreSQL + マイグレーション基盤**(codex): docker 等の dev 起動、マイグレーションツール選定(dev 用)、Repository の DB 実装差し替え機構、CI での DB 統合テストレーン | WP-5001 APPROVED |
| DB-2 | WP-5003 | **患者・受付の DB 実装差し替え**: API-001/006 の「DB化時」注記の実行(unique index (tenant, pharmacy, idempotency_key) + payload hash 等)。in-memory は dev/test 用に残置 | DB-1 完了 + **DOM-002(data model SSOT)APPROVED**(API-001 §7 の前提) |
| DB-3 | WP-5004 | **監査ログ永続化 + ハッシュチェーン**: WP-2009(canonical 化・entryHash 計算・hydrate 検証)と統合。append-only DDL/DCL、SEC-008 論理層規律の実装 | DB-1 完了 + SEC-007/008 準拠設計の opus4.8 レビュー |
| DB-4 | WP-5005 | **イベントストア + 投影再構築**: ARC-005 の適用集約(算定・請求 / 会計台帳)のみ。投影の決定的再構築(ARC-006)、同期キュー(Outbox)テーブルと MOD-009 deferred 事項(deadLetterReason 必須化・schemaVersion 互換)を同一バッチで | DB-3 完了(監査が先 — 会計・請求イベントは監査前提)+ 該当 CLM/ACC 実装 WP と同期 |
| DB-5 | WP-5006 / WP-5007 | **マスター DB 版管理**(MST-001 パイプラインの永続化: 版別イミュータブル・有効日・PENDING_MASTER_VALIDATION。§2.1 の M1〜M8 は各配布元 evidence 発行が個別前提)/ **Edge ローカルストア設計 SSOT**(投影のみ・正本なし・LOCAL_ONLY 稼働・RECOVERY_SYNC 再構築。実装は同期設計 SSOT 承認後) | DB-2 完了(マスターは業務 DB 稼働後)/ Edge は設計先行のみ |
| 従属 | WP-5008 | **帳票・文書ストア**(#8): 領収証・明細書の発行履歴+生成物保存。RCP 系実装 WP(WP-2202 系)と同期 | 会計・領票実装 WP の発行 |
| 従属 | —(個別 WP なし) | #9 請求成果物は CLM 実装(BLOCKED_REGULATORY_REVIEW 解除後)、#10 外部連携記録は各 Adapter 実装 WP、#11 認証ストアは auth SSOT 承認後(BLOCKED_SECURITY_REVIEW)、#12 アーカイブ階層は年限確定後に、それぞれの WP へ従属して構築する(単独先行しない) | 各親 WP の DoR に従う |

**本番インフラ確定は独立ゲート**: どの Phase とも独立に、SEC-008 §3 の4条件充足 + BLOCKED_SECURITY_REVIEW 解除 + 人間承認で確定する(候補: Aurora PostgreSQL / S3 Object Lock / KMS — いずれも SEC-008 既出の候補)。確定前は開発環境(ローカル PostgreSQL)までとし、本番データを置かない。

## 5. 決定ゲート・停止条件(fail-closed)

- 本番 DB 製品・構成の確定 → **BLOCKED_SECURITY_REVIEW**(SEC-008 §3 の4条件)
- 保存期間・削除・匿名化の確定 → **BLOCKED_LEGAL_REVIEW**(REG-003 と同期。確定まで「削除しない」側に倒す)
- 接続数・レイテンシ・容量等の性能数値 → **BLOCKED_PERFORMANCE_SLO**(OPS-005)
- evidence 未発行の算定・請求構造をスキーマに先行固定 → **SSOT_UPDATE_REQUIRED**(該当 SSOT APPROVED が先)
- 業務ロールへの UPDATE/DELETE 付与(append-only 対象)/ 浮動小数点の金額列 / DB now() の業務使用 → レビューで CHANGES_REQUESTED
- 本番 PHI を開発・テスト DB へ投入 → 禁止(MOD-013 合成データのみ)

## 変更履歴

- 0.1.0 (2026-07-09): 初版起案(ユーザー指示「各種データベースの構築計画立案を開始」による)。
