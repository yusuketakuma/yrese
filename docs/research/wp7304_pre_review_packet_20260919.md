# WP-7304 pre-review packet — 前回 Do(確定済み処方版からの複製起点)

```yaml
packet_id: WP-7304-PRE-REVIEW-20260919
created_at: 2026-09-19
status: DECIDED
base: 7fd3345(main)
scope: POST /prescription-drafts/by-reception/{id}:from-prior(確定済み処方版からの
       新規 draft 生成)、copiedFrom provenance(prescription_drafts 拡張 +
       response)、master 版変更時の再解決・廃止降格(UNRESOLVED_TEXT)、
       migration 000023、in-memory/PG 両実装、fixture parity、OpenAPI
out_of_scope: 前回 Do の Web UI(Plans.md WP-7304 に UI 要件なし)、調剤記録
              (WP-7404)、production/staging 適用、複製元の自動選択
              (patient 単位の処方履歴一覧 API は別 WP 候補)
```

## 1. 背景

PRD-001 0.1.2 APPROVED(M4):「前回Do(確定済み処方版からの複製起点 — コピー元
参照を保持し、マスター版変更時は再解決、廃止品目は UNRESOLVED_TEXT へ降格)」。
Plans.md WP-7304:`POST /prescription-drafts/by-reception/{id}:from-prior`、
PHI read 監査、コピー元参照を draft に保持。依存の WP-7302(Rp 構造化)・
WP-7402(確定版 snapshot)は着地済み。

対象は「同じ患者の過去の確定処方を次回受付の入力起点にする」薬局業務の標準
操作。複製先は editable draft(status NULL)で、確認・確定の通常 guard
(全品目解決済み + 原本 metadata 充足)がそのまま効く。

## 2. route 形状(D-1)

- `POST /prescription-drafts/by-reception/{receptionId}:from-prior`
  - body: `{ patientId, businessDate, sourcePrescriptionId, sourceVersion? }`
  - scope: `prescription:write` + `reception:read` + `patient:read`
    (PUT save と同集合 — draft 作成 + 複製元処方の PHI read を含む)。
  - response: 201 `PrescriptionDraftSaveResponse`(`saveDisposition:"created"`、
    `copiedFrom` 付き)。
- 冪等性: Idempotency-Key は要求しない。複製先は reception 一意
  (`prescription_drafts_reception_unique`)であり、同一再送は 409 conflict で
  fail-closed(retry 後は GET + `copiedFrom` で識別可能)。新規 command 表を
  作らず既存の一意制約に乗せる。

## 3. 複製元の指定(D-2)

- `sourcePrescriptionId` は client 明示指定。**自動選択しない** —
  「最新の確定処方」の暗黙解決は患者・処方意図の誤認リスクがあり、
  前回 Do の対象選択は薬剤師の明示操作とする(過去処方一覧の read API は
  別 WP 候補)。
- `sourceVersion` 省略時は `MAX(version)`(最新確定内容)。指定時はその版を
  使う(旧版からの複製も許可 — 「旧版が読める」は既存 read 面の規則)。
- 複製元は同 scope(tenant+pharmacy)の処方に限る。他 scope の ID は
  `not_found`(存在秘匿 — cross-scope disclosure 禁止)。
- 複製元は `prescription_versions` に指定版が存在すること(= FINALIZED 済み。
  版が存在しない = 未確定で複製不可 → not_found)。

## 4. 生成 content の規則(D-3)

複製するもの:
- `prescriptionType`・`defaultDays`・`flags`・`note` — 処方 regimen の属性。
- `rpGroups` — 再解決(§5)を適用した上でコピー。rpGroupId/rpItemId は
  draft 内一意制約のみで global 参照ではないためそのまま引き継ぐ。
- `rows` — source が legacy free-text のみの場合はそのままコピー
  (保存時 materialize で rpGroups へ読み替わる既存経路に乗せる)。

リセットするもの:
- `sourceMetadata` → `null`。複製は新しい紙処方を前提とし、原本 metadata
  (発行日・有効期限・医療機関・医師)の引き継ぎは事実誤認になる。
  confirm guard(metadata 充足必須)が再入力を強制する。
- `prescriptionDate` → `null`。同じく新原本の発行日であり引き継がない。

保存は `normalizePrescriptionDraftContentForStorage`(materialize + hash)に
通し、既存 draft と同一の保存形状・hash 規則を保つ。

## 5. master 再解決(D-4)

`asOf = businessDate`(複製先受付の業務日)で現行 master 版を解決する。

- medication ref `{masterVersionId, medicationItemId}`:
  1. 旧版の item 行を `medicationItemId` で検索 → `localCode`・`name` を得る
     (MST-001 append-only 前提。行欠落は repository invariant violation で fail)。
  2. `kind=medication` の現行版(asOf)を解決。版なし → 全 resolved を降格。
  3. 現行版に同一 `localCode` の item あり → `{新 masterVersionId,
     新 medicationItemId}` で再解決(版が同一でも item 行を再検証)。
  4. 現行版に `localCode` なし(廃止・削除相当)→ `{kind:"unresolved",
     text: 旧 item の name}` へ降格(UNRESOLVED_TEXT → confirm guard が
     RX-0001 で止める)。
- usage ref `{usageItemId}`: 同規則。`usageItemId` → 旧行の `localCode`/`text` →
  現行版の同 localCode へ再解決、なければ `{kind:"unresolved", text: 旧 text}`。
- `kind:"unresolved"` の ref はそのままコピー。
- master 検索は `MasterRepository` に `findMedicationItemById` /
  `findUsageItemById` を追加(既存 `list` は asOf 版解決専用で、旧 item の
  localCode 取得には使えない)。

## 6. copiedFrom provenance(D-5)

- `prescription_drafts` に `copied_from_prescription_id TEXT`・
  `copied_from_version INTEGER`(migration 000023、両方 NULL or 両方非 NULL の
  CHECK、source 版への複合 FK = `prescription_versions` 参照)。
- response に `copiedFrom: {prescriptionId, version} | null` を additive 追加
  (content 本体には入れない — content hash・immutable 版 snapshot 非影響)。
- 通常 save 経路の draft は常に NULL。amend 版 snapshot にも載せない
  (provenance は draft 行の属性)。

## 7. 監査・トランザクション(D-6)

- 複製元の PHI read → `prescription.draft.viewed`(targetRef = source
  prescriptionId、identifiers のみ)。既存登録の再利用で MOD-008 改版不要。
- 新規 draft → `prescription.created`(targetRef = 新 prescriptionId)。
- PG: 受付検証 + 複製元読取 + draft INSERT + 監査 2 件を 1 tx。
  複製先 INSERT は reception 一意制約で concurrent 二重作成を serialize。
- read 経路(draft GET)は既存 `prescription.draft.viewed` 規則を維持。

## 8. error 写像(D-7)

| 条件 | status | code |
|---|---|---|
| body/params 不正 | 400 | RX-0005 相当(validation) |
| 受付なし・非 editable(WAITING/IN_PROGRESS 以外)・patient 不一致 | 404 | — |
| source prescription 不存在 or 指定版なし(=未確定) | 404 | — |
| 複製先 reception に draft 既存 | 409 | — |
| scope 不足 | 401/403 | 既存 middleware |

## 9. 実装範囲と検証(D-8)

- contracts: `prescriptionDraftFromPriorRequestSchema`、response に
  `copiedFrom` additive、OpenAPI 1 path。
- service: `createFromPrior`(in-memory + PG)、master 再解決 helper、
  `MasterRepository` へ item-by-id lookup 2 件追加(両実装)。
- migration `000023`(copied_from_* + CHECK + FK)。fixture migrationState 更新。
- test: unit(再解決・降格・no master 版・guard 各種)、route、PG integration
  (FK/CHECK・単一 tx rollback)、contracts schema、in-memory/PG parity。

## 10. 決定記録

| ID | 決定 | 根拠 |
|---|---|---|
| D-1 | route 形状 §2 | Plans.md WP-7304 記載通り |
| D-2 | sourcePrescriptionId 明示・自動選択なし | §3 誤複製リスク |
| D-3 | sourceMetadata/prescriptionDate を reset | §4 新原本前提 |
| D-4 | localCode で再解決・廃止は UNRESOLVED_TEXT 降格 | PRD-001 M4 |
| D-5 | copiedFrom を prescription_drafts 列で保持 | §6 provenance |
| D-6 | viewed+created 監査 reuse、単一 tx | §7 |
| D-7 | Idempotency-Key 不要、reception 一意で fail-closed | §2 |
| D-8 | Web UI 対象外 | WP 受入に UI 要件なし |

承認根拠: direct user instruction(「残タスクをそのまま実装」+ 継続する一括許可)。
本 packet は R2 の required pre-review record として扱う。

## 11. 実装状況

**実装完了(2026-09-19)**

- route: `POST /prescription-drafts/by-reception/:receptionId/from-prior`(find-my-way が `:param:suffix` を単一 param 名として解釈するため static `/from-prior` セグメントに変更 — §2 の `:from-prior` サフィックス記法からの意図的逸脱として記録)。
- contracts: `prescriptionDraftFromPriorRequestSchema`、`prescriptionCopiedFromSchema`、response へ必須 nullable `copiedFrom` 追加(通常 save/load 経路は `null`)。
- MasterRepository: `findMedicationItemById`/`findUsageItemById` を in-memory/PG 両方に追加。copy helper は旧 resolved item ID → 旧 `localCode` → 現行 asOf version で再解決。旧 resolved item が append-only master storage から見つからない場合は fail-closed throw。
- migration `000023`: `copied_from_prescription_id`/`copied_from_version` + 両 null/両非 null(version ≥1)CHECK + (tenant, pharmacy, source prescription, source version) → `prescription_versions` 複合 FK(scope 跨ぎ・不存在 version を拒否)。
- in-memory/PG `createFromPrior`: reception 検証(editable + patient/date 一致)→ target draft 一意(409)→ source version(latest/指定、scope 内、不存在 404)→ 再解決 → draft 挿入 + `prescription.draft.viewed`(source)+ `prescription.created`(new)監査。PG は単一 tx。
- `prescriptionDate`/`sourceMetadata` は `null` リセット、未解決 ref はそのまま、stale resolved ref は旧 display text で `unresolved` 降格。
- main.ts: in-memory/PG 両 branch に masterRepository 注入。未注入時は fail-closed throw。
- OpenAPI: `createPrescriptionDraftFromPrior` + `docs/api/openapi.yaml` 再生成済み。
- web test mocks 4 件へ `copiedFrom: null` 追加(response schema 必須化の追随)。

**検証(全実行済み、記録時点)**
- API 1,332 PASS(実 PG・skip 0、PG integration 39 件含む)、workspace 全 package PASS、typecheck 全緑。
- check:openapi(drift)、check:ssot-index(190 docs)、check:boundaries+secrets、check:deps(high=0/critical=0)、check:sbom(249)、check:calculation-purity、test:scripts — 全 PASS。

**独立 review(fresh-context read-only reviewer、frozen diff、R1 hash 47847b4 / R2 hash 7a3562d)**

- R1 **FAIL(1M/4L)**:
  - M-1(修正):PG `createFromPrior` が tx client 保持中に `PostgresMasterRepository` 経由で pool 追加借用 → ≥5 並行で枯渇 stall、`YRESE_DB_POOL_MAX=1` で常時 timeout。→ `MasterReadRepository`(read subset)導入、`listMastersOn`/`find*On` を client 束縛へ抽出、`masterReadRepositoryForClient(client)` factory で tx 内 read を同一 client へ固定。回帰 test: poolMax=1 で copy 完走を固定。
  - L-1(修正):masterRepository 未注入の guard 順を in-memory も先頭へ揃え parity。
  - L-2/L-3/L-4(不採用・根拠):in-memory audit-before-state は WP-7402 evidence-first 規則で維持 / 複製元は同 scope のみ要求(§3、同一患者は §1 narrative の範囲で非必須)/ 409 文言 reuse は cosmetic。
- R2 **PASS**(hash 7a3562d):M-1 解消確認(client 束縛・pool 再借用経路なし・pool 経路は REPEATABLE READ+COMMIT 維持・append-only のため tx 内 SET 省略安全)、回帰 test 有効性確認、fresh sweep で新規欠陥 0。

**残記録**: commit。migration 000023 は `yrese_dev` 適用済み、production/staging 適用は【HG】fail-closed 維持。
