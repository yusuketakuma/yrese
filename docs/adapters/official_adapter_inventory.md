# official_adapter_inventory — Official Adapter 台帳

```yaml
ssot_id: ADP-001
title: Official Adapter 台帳
domain: adapters
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - 構築プロンプト v0.1.7 §12, §19, §23-27, §29
  - docs/plan/phase0_plan.md §10
depends_on:
  - docs/regulatory/source_registry.md
  - docs/regulatory/regulatory_blockers.md
impacts:
  - packages/adapters(将来)
  - apps/api
open_questions:
  - 各公式仕様の版・適用日(source_registry で UNVERIFIED)
  - オンライン請求の公式接続方式(直接送信は禁止のまま)
  - NSIPS 利用許諾の取得要否・時期(人間判断)
blockers:
  - BLOCKED_OFFICIAL_ADAPTER_SPEC(全 Adapter 共通: 公式仕様の一次確認まで実装凍結)
```

Official Adapter は、公式仕様・JAHIS仕様・許諾済NSIPS等に準拠してデータを変換・入出力する境界である(v0.1.7 §12)。
**独自解釈で仕様を模倣してはならない。** 公式仕様が CSV/XML/PDF/固定長/Shift-JIS/特定ファイル命名/特定レコード順/特定通信方式を要求する場合は公式仕様を優先する。
Pharmacy Integration API(独自 OpenAPI/JSON)とは分離し、混同しない。

## Adapter 一覧

### ADP-A1: オンライン資格確認 Adapter

| 項目 | 内容 |
|---|---|
| 責務 | 資格確認端末・オンライン資格確認等システム外部IFとの連携。資格情報・負担割合・限度額情報の取込、資格情報スナップショット生成、請求前資格確認、災害時/障害時モードの状態連携 |
| 責務外 | 資格の有効性判断の代行(表示と記録のみ)、UI表示文言、算定への直接反映 |
| 公式仕様 | オンライン資格確認等システム外部インターフェイス仕様書【要確認 — 医療機関等ONS経由。regulatory_blockers RB-002】 |
| 入出力形式 | 【要確認】(外部IF仕様確認まで想定を記録しない) |
| 実装状態 | **BLOCKED**(BLOCKED_OFFICIAL_ADAPTER_SPEC / BLOCKED_REGULATORY_REVIEW) |
| 解除条件 | ONS アクセス確保 → 外部IF仕様の版・適用日を source_registry へ登録 → evidence_id 発行 → 境界SSOT(online_qualification_boundary.md)APPROVED → opus4.8 事前レビュー |
| オフライン時 | 新規確認は成功扱い禁止。最終確認スナップショット参照のみ(PENDING_REVERIFY 付与) |

### ADP-A2: 電子処方箋 Adapter

| 項目 | 内容 |
|---|---|
| 責務 | 電子処方箋管理サービスとの連携境界: 処方箋引換番号による受付、処方情報取得、調剤結果登録・送信、重複投薬等チェック結果の受領・転記(未加工・出典明示)、HPKI 署名フローの呼び出し境界 |
| 責務外 | 重複投薬・併用禁忌の自機判定(SaMD該当性未判定 — REG-005)、署名鍵の管理実装(設計は edge_node_security_design) |
| 公式仕様 | 電子処方箋管理サービス技術解説書(v0.1.7 指定: 令和8年7月 2.04版以降【要確認】)、記録条件仕様【要確認】、セルフチェックリスト【要確認】 |
| 入出力形式 | 【要確認】 |
| 実装状態 | **BLOCKED**(MVP は境界設計のみ — non_mvp_scope N1) |
| 解除条件 | 技術解説書・記録条件仕様・接続試験(サンドボックス)環境の確認 → 境界SSOT APPROVED → 人間レビュー(MVP昇格判断) |
| オフライン時 | 取得・登録・送信・チェック完了の成功扱い禁止。全て PENDING_EXTERNAL_SYNC / PENDING_REVERIFY |

### ADP-A3: 電子レセプト・オンライン請求 Adapter

| 項目 | 内容 |
|---|---|
| 責務 | レセプト中間モデル→電子レセプトデータ生成、記録条件仕様バリデーション、オンライン請求用端末・公式手順への受け渡しデータ出力、返戻・再請求データの取込 |
| 責務外 | **オンライン請求の直接送信・画面自動操作・非公式API送信(実装禁止 — v0.1.7 §19)** |
| 公式仕様 | 調剤用記録条件仕様【要確認 — RB-001】、電子レセプト作成の手引き【要確認】、オンライン請求接続方式【要確認 — RB-004】 |
| 入出力形式 | 記録条件仕様準拠(固定長/CSV 等は仕様確認まで【要確認】。文字コード含む) |
| 実装状態 | **BLOCKED**(BLOCKED_REGULATORY_REVIEW) |
| 解除条件 | 記録条件仕様の版・適用日確認 → evidence_id 発行 → electronic_receipt_design.md APPROVED → opus4.8 + 請求実務者レビュー |
| オフライン時 | 請求前点検・月次締め・レセプト確定は LOCAL_ONLY で禁止(offline_mode_matrix ARC-001) |

### ADP-A4: PMH Adapter

| 項目 | 内容 |
|---|---|
| 責務 | PMH(Public Medical Hub)医療費助成のオンライン資格確認結果・受給者証情報の取込境界、PMH制度関連マスタの参照、公費按分計算への入力提供 |
| 責務外 | 助成適用可否の自動確定(確認結果の記録と表示。未確認は PENDING_PMH_REVERIFY) |
| 公式仕様 | PMH利用規約・接続要件・制度関連マスタ・事前検証手順【要確認 — RB-005。デジタル庁】 |
| 入出力形式 | 【要確認】 |
| 実装状態 | **BLOCKED**(MVP は状態管理境界のみ — non_mvp_scope N2) |
| 解除条件 | PMH 利用規約・接続要件確認 → pmh_boundary.md APPROVED → 人間レビュー |
| オフライン時 | 医療費助成確認済み扱い禁止(PENDING_PMH_REVERIFY 必須付与) |

### ADP-A5: JAHIS Adapter(2次元シンボル / 薬歴連携)

| 項目 | 内容 |
|---|---|
| 責務 | (a) 院外処方箋2次元シンボル(Prescription2DSymbol)のデコード・バリデーション・仮取込(バージョン判定・分割シンボル・読取順序・文字コード・CSV構造・必須/条件付き項目)。(b) 薬局レセコン⇄電子薬歴の JAHIS 連携仕様準拠の変換 |
| 責務外 | QR読取結果の処方箋原本扱い(紙処方箋または電子処方箋正式データとの照合が必須 — v0.1.7 §26)。薬剤師確認の代行 |
| 公式仕様 | JAHIS 2次元シンボル記録条件規約(公式確認済み最新: Ver.1.10 / 2024-09。v0.1.7 指定の Ver.1.11 は一次未確認【要確認 — REG-002】)、JAHIS 薬歴連携仕様 Ver.1.1以降【要確認】 |
| 入出力形式 | JAHIS 規約準拠 CSV(Shift-JIS 含む)【版確定まで詳細記録しない】 |
| 実装状態 | **BLOCKED**(JAHIS 規約は有償頒布の場合あり — 入手手続きは人間判断) |
| 解除条件 | 規約文書の正規入手 → 版確定 → jahis_boundary.md APPROVED → opus4.8 レビュー。読取仮取込 UI(仮取込→薬剤師確認→確定)は規約入手後に WP 発行 |
| オフライン時 | 仮取込は LOCAL_ONLY 可(LOCAL_ONLY_UNVERIFIED 付与、原本照合と薬剤師確認必須) |

### ADP-A6: NSIPS Adapter(許諾後のみ)

| 項目 | 内容 |
|---|---|
| 責務 | (許諾取得後)単一薬局内の機器・システム連動用途に限定した NSIPS 準拠変換 |
| 責務外 | NSIPS 代替API(Pharmacy Integration API)との混同。NSIPS 仕様の複製・模倣・書き写し(無許諾では設計文書にも記載禁止) |
| 公式仕様 | NSIPS 利用許諾条件【要確認 — RB-006。日本薬剤師会。入会・内部審査手続きは人間対応】 |
| 実装状態 | **BLOCKED**(BLOCKED_NSIPS_LICENSE — 設計自体を凍結) |
| 解除条件 | 正規許諾取得(人間判断・手続き)→ nsips_adapter_policy.md 作成 → 人間レビュー |

## 共通ルール

1. すべての Adapter は `packages/` 配下で Pharmacy Integration API と物理的に分離する(ディレクトリ構成は Phase 1 の bounded_contexts で確定)。
2. Adapter 実装 WP の Definition of Ready には、該当公式仕様の evidence_id と境界SSOT の APPROVED を必須で含める。
3. Adapter の出力には出典(外部システム名・確認日時・結果コード)を必ず保持し、UI は「外部確認済み/未確認」を偽装表示しない。
4. contract test は公式仕様のサンプル・接続試験環境が確認できた Adapter から順に整備する。
5. 公式仕様の版更新は version_watchlist(REG-002)で監視し、版変更時は SSOT 改版 → 回帰テスト → 再レビューの順で反映する。
