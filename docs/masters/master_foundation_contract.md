# master_foundation_contract — マスター基盤(synthetic 先行)実装分解記録

```yaml
ssot_id: MST-003
title: マスター基盤(synthetic)実装分解記録 — master_versions / medication_items / usage_items と読取 API
domain: masters
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - api_contract_reviewer
  - data_integrity_auditor
  - medical_safety_reviewer
  - human_review_required
version: 0.1.0
created_at: 2026-09-18
updated_at: 2026-09-18
approved_at: 2026-09-18
approved_by: direct_user_instruction (2026-09-18 一括承認); independent read-only review findings applied before finalization
effective_from: 2026-09-18
effective_to: null
source_refs:
  - MST-001(版・有効日・上書き禁止・PENDING_MASTER_VALIDATION)
  - DOM-002 §9(Master 集約の不変条件)
  - DOM-002 §4.2(rp_items の医薬品参照 = master 版 + item ID)
  - MOD-010(金額・点数の表現規則)
  - MOD-011(明示日付入力 — 暗黙の「今日」をサーバーで解決しない)
  - MOD-013(fixture は合成データのみ)
  - DB-003(tenant 分離 DDL 方針)
depends_on: [MST-001, DOM-002, MOD-007, MOD-010, MOD-011, MOD-013, DB-003]
impacts:
  - migrations(000018 予定)
  - packages/contracts
  - apps/api
  - apps/web(医薬品・用法の検索 UI — WP-7302/7304 の前置)
related_work_packages: [WP-7301, WP-7303]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-09-18 finalization: 独立 read-only review の finding(§4.2 参照修正・q 一致規則の明確化)を反映後、direct human approval(一括承認)により PROPOSED→APPROVED"
  - "0.1.0 2026-09-18 WP-7301/WP-7303 初版起案(PROPOSED)。MST-001 の『版・有効日・上書き禁止』だけを synthetic データで先行実装するための実装分解。実データ取込(RB-009・source registry 登録)・24 段パイプライン(WP-7801)は範囲外。review と human approval まで実装根拠にしない"
open_questions:
  - マスター行の tenant/pharmacy 帰属: 本記録は scope 列を必須とするが、tenant 横断共有(グローバル版)の可否は DB-003 の確定待ち。共有化は将来の別 SSOT でのみ行う
  - 公費・保険者・調剤行為等の他マスター種別の追加順序(WP-7301 は medication、WP-7303 は usage のみ)
  - JAHIS 用法コード・YJ/レセ電/HOT コードの実コード列への写像は配布元仕様(WP-6201)【EXT】入手後
blockers:
  - RB-009: 実マスターデータの取込は配布元仕様の evidence_id 発行と source registry 登録まで禁止。本記録は synthetic fixture のみを対象とする
  - 検証未通過版・配布元不明版の使用禁止(MST-001 §5)は実データ経路でも継承する
```

## 1. 目的とスコープ

MST-001 の不変条件 — **版の上書き禁止・有効開始/廃止/経過措置の必須・
当時有効版の解決は(処方日・調剤日・請求月)の明示入力** — を、実データ取込を
待たずに synthetic fixture で先行実装するための分解記録。

対象は次の 2 種別のみ:

- **medication**(WP-7301): 医薬品マスター。Rp 構造化(WP-7302)の
  `rp_items` 参照先、薬袋印字(WP-7504)の品目名供給元。
- **usage**(WP-7303): 用法マスター。Rp の用法参照、薬袋・薬情の用法印字
  (WP-7504)の供給元。JAHIS 用法コードへの写像列は仕様入手まで空。

**範囲外(明記):** 実データ取込・24 段パイプライン(WP-7801)・
staging/本番反映・Edge 配布・コード体系の実値(実 YJ/レセ電/HOT/公費番号は
RB-009 で別途)。

## 2. 集約と不変条件

### MasterVersion

| 項目 | 内容 |
|---|---|
| 識別 | `master_version_id`(サーバー採番) + 業務キー `(masterKind, version)` |
| 項目 | `masterKind`(`'medication' | 'usage'`)、`version`(文字列)、`validFrom`、`validTo`(null = 未廃止)、`transitionNote`(経過措置メモ、nullable)、`distributionState`(`'synthetic'` 固定 — 実配布状態機械は WP-7801) |
| 不変条件 | 同一 `(tenant, pharmacy, masterKind, version)` の行は一意。**上書き禁止**(append-only、UPDATE/DELETE/TRUNCATE は trigger 拒否)。`validTo` 設定済み版を asOf で解決した結果は「当時有効」のまま再現可能 |

### MedicationItem(WP-7301)

| 項目 | 内容 |
|---|---|
| 識別 | `medication_item_id`(サーバー採番)。業務キー `(master_version_id, localCode)` |
| 項目 | `localCode`(自局コード、必須)、`yjCode` / `receiptCode` / `hotCode`(nullable — synthetic では全て null か `SYN-` 接頭辞)、`name`、`unit`(規格単位、例: 錠/mL/g)、`price`(整数、単位 `unit` 当たりの薬価 — MOD-010、nullable。価格未設定品目を許容)、`genericFlag`(後発品区分: `'originator'|'generic'|'unclassified'`)、`genericNameCode`(一般名コード、nullable)、`controlCategory`(麻/向/毒/劇: `'narcotic'|'psychotropic'|'poison'|'powerful'|'none'` の複数可 — bit ではなく配列相当の列設計) |

### UsageItem(WP-7303)

| 項目 | 内容 |
|---|---|
| 識別 | `usage_item_id`(サーバー採番)。業務キー `(master_version_id, localCode)` |
| 項目 | `localCode`(自局用法コード)、`text`(用法文)、`timing` 構造: `timesPerDay`(整数、頓用時 null)、`mealTiming`(`'before'|'after'|'bedtime'|'asNeeded'|'other'`)、`jahisCode`(nullable — WP-6201 まで空) |

### 共通不変条件

- 全テーブル append-only。項目の訂正は**新版 + 新行**で行い、既存行の UPDATE/DELETE 経路を持たない。
- `asOf` 解決は呼び出し側の明示入力(MOD-011)。`validFrom <= asOf` かつ
  (`validTo IS NULL` または `asOf < validTo`)を満たす版の items のみ返す。
- `asOf` に有効な版が存在しない場合は **200 + 空配列 + `masterVersion: null`**
  (0 件と「版なし」を区別する)。廃止日以降の版を参照しようとする書込み側は
  `PENDING_MASTER_VALIDATION` 相当の blocker を表示側へ返す責務を持つ
  (本契約は read のみなので、拒否は consumer 側の責務)。
- fixture は MOD-013 の合成規則(架空名称・`SYN-` コード接頭辞)に従う。

## 3. エンドポイント

### GET /masters/medications?asOf=YYYY-MM-DD&q=…

- scope: `master:read`(MOD-007 既存 resource)。認可なしは 403。
- `asOf` 必須。`q` の一致規則: `localCode` へは**前方一致**、`name` へは**部分一致**(いずれも case-sensitive、`COLLATE "C"` 相当のコードポイント比較 — 既存 text 照合 parity 規則と同じ)。`q` 省略・空文字は全件(asOf 有効版内)。上限は route 側で `q <= 100 chars`、items 応答は版内全件(マスター版の品目数は有限かつ小規模 — synthetic 前提)。
- 応答: `{ masterVersion: { masterVersionId, masterKind, version, validFrom, validTo } | null, items: [...] }`
- マスターデータは PHI を含まないため `no-store` は要求しないが、tenant/pharmacy scope による絞込みは必須。
- エラー: `400 MST-0001`(asOf/query 不正)、`403 AUTH-0003`。

### GET /masters/usages?asOf=YYYY-MM-DD&q=…

- 同上。`master:read`。

### 書込み経路(本 WP では API を公開しない)

synthetic 行の投入は fixture seed(スクリプトまたは開発用 seed)により
repository 経路で行う。`POST /masters/*` の write route は RB-009 解除・
source registry 登録後の WP-7801 でのみ検討する(`master:admin` / `master:write`
の割当は MST-001 open_question の承認者ロール確定に従う)。

## 4. 永続化(migration 000018 予定)

- `master_versions` / `medication_items` / `usage_items`: `tenant_id`・`pharmacy_id`
  を NOT NULL + FK、append-only trigger(eligibility_snapshots / coverage の
  `block_mutation` と同型)、`(tenant, pharmacy, masterKind, version)` 一意。
- 冪等性: read のみのため Idempotency-Key 経路なし。seed の再実行は
  業務キー upsert ではなく「既存 version の存在を確認して skip」とする
  (版の上書き禁止を seed にも適用)。

## 5. 監査

- read は PHI を含まないため read audit は要求しない(MOD-008 の `insurance.viewed`
  型の規則は coverage のような患者紐付き PHI に限定される)。
- seed 実行は `master.applied` 相当の監査対象とするかは WP-7801 の pipeline
  監査に統合する。本 WP の synthetic seed は監査対象外とする
  (開発用 fixture のため)。【要確認 — 監査規範の確定時に再評価】

## 6. エラーコード(実装時に MOD-006 へ bounded amendment で登録)

| code | HTTP | 意味 |
|---|---|---|
| MST-0001 | 400 | asOf/query 不正 |
| MST-0002 | 404 | 指定 master_version_id が scope 内に存在しない(将来の版参照用に予約) |

## 7. 受入条件

- `asOf` 明示入力で版が一意に解決される(validFrom/validTo 半開区間)。
- 版・品目の UPDATE/DELETE は API・DB 双方に経路がない(trigger 拒否テスト)。
- `asOf` に有効版なし → 200 + items 空 + `masterVersion: null`。
- 全 fixture が合成(MOD-013)であること、実コード体系の値を含まないこと。
- cross-tenant/cross-pharmacy の参照は存在非開示で空集合(scope 絞込み)。
