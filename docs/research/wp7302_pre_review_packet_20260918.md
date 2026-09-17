# WP-7302 pre-review packet(R3 実装前 human decision 材料)

```yaml
document_kind: human_pre_review_packet
status: DECIDED_ALL_APPROVED
work_packages: [WP-7302]
created_at: 2026-09-18
decided_at: 2026-09-19
decided_by: "direct human authority「次に進んで」(2026-09-19) — 直前 report の残決定事項 1 として D-1〜D-5 の approve が実装着手条件と提示されていた経緯から、推奨案どおりの全項目 APPROVE と解釈"
risk_class: R3 (prescription draft 構造化 — DOM-002 改版実装 + migration)
prepared_by: devin active_root_writer (maker — 本packetは判断材料であり、makerの自己承認ではない)
oracle_used: false (user instruction 2026-09-17: oracleは使用しない)
implementation_authority: WP-7302 scope approved (migration 適用・production action は引き続き別 gate)
decisions_required: 5
decisions_resolved: 5
```

## 1. 目的

PRC-003 DoR #10 / AGT-018: R3 実装は「required specialist review に加えて該当する
human authority の事前 review record」が揃うまで開始しない。本 packet は WP-7302
(処方 draft の Rp 構造化行)の判断材料を凍結したものである。

前提依存: WP-7301(master 基盤 — rp_items が参照する `master_versions`)は
本 packet 作成時点で実装済み(MST-003 APPROVED / migration 000018)。

## 2. 承認済み根拠(すべて APPROVED)

- **DOM-002 §4.2(b)**(0.1.4、2026-09-17 一括 APPROVE): rp_groups / rp_items 構造、
  UNRESOLVED_TEXT 移行規則、CODE_MAPPING_REVIEW_REQUIRED guard、
  §4.1 不変条件(version/CAS/content hash)の継承、用量計算は行わない。
- **API-007 系**(prescription draft route 契約): draft save の versioned CAS・
  content hash・read audit は既存経路を継承。行 schema の拡張は additive
  contract amendment として行う(既存 free-text draft との後方互換)。
- **MST-003**: rp_items が参照する `master_versions` は実装済み
  (migration 000018 / GET /masters/*)。
- **MOD-006**: CODE_MAPPING_REVIEW_REQUIRED 相当の新規コード(仮称 `RX-0001`
  系)の登録は本 packet の承認を受けて行う(台帳は改訂承認先行)。

## 3. scope 案

| in | out(明示非目標) |
|---|---|
| `rp_groups`(剤形区分・用法参照・日数/回数)+`rp_items`(master 版+item ID 参照 **または** UNRESOLVED_TEXT、1回量/1日量/総量/単位、一般名 flag、後発品変更可否)の draft content 構造化 | 用量・用法の妥当性計算(DOM-002 §4.2 明示非目標) |
| migration 000019(構造化行を格納する列/表 — 旧 `prescription_draft_rows` は読み専用で残す) | migration 適用(【HG】環境適用は WP-7102 runbook 経由の別承認) |
| 既存 free-text 行の UNRESOLVED_TEXT 保持(読み替えで内容を失わない) | free-text 行の自動コード解決(候補提示すらしない — 別 WP) |
| UNRESOLVED_TEXT 含有 draft の薬剤師確認ブロック(CODE_MAPPING_REVIEW_REQUIRED、DOM-004 §1 遷移 2 ガード) | 薬剤師確認 route そのもの(WP-7402 の範囲) |
| content hash は新構造を含む全体を覆う(§4.2 継承) | MedicationRequest 投影(BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP 維持) |
| Web: Rp 行の構造化入力 UI(用法は自局コード選択または自由記載) | 算定・添文書チェック |

## 4. 主要な実装判断(承認対象)

- **D-1 行の混在可否**: draft 内で `UNRESOLVED_TEXT` 行と master 参照行の混在を
  許可するか — 推奨: 許可(DOM-002 §4.2 の「既存 free-text 行は UNRESOLVED_TEXT
  として保持」の移行規則が混在を前提にしている)。混在 draft は guard で確認へ進めない。
- **D-2 用法参照の形式**: rp_groups の用法は「`usage_items` 参照コード」と
  「未解決自由記載」の2値(医薬品側の UNRESOLVED_TEXT と同型の2値構造) —
  推奨: `{ kind: 'resolved', usageItemId }` | `{ kind: 'unresolved', text }` の
  discriminated union(品目行も `{ kind: 'resolved', masterVersionId, medicationItemId }`
  | `{ kind: 'unresolved', text }`)。
- **D-3 格納形**: `prescription_drafts` の content JSONB 内に新構造を保持するか、
  正規化した別表(rp_groups/rp_items)にするか — 推奨: **content JSONB 内保持**。
  理由: draft は未確定の作業領域であり、§4.1 の content hash が「draft 全体」を
  覆う設計と一致。正規化表は確定(WP-7402 以降)の段階で切る。別表化すると
  content hash の対象分裂・CAS 意味論が複雑化する。
- **D-4 上限値**: 行数・文字数の上限は contracts 層の定数で確定(§4.2)。案:
  rp_groups ≤ 50、rp_items ≤ 200/draft、text ≤ 500 文字(既存 free-text 上限に揃え)。
- **D-5 CODE_MAPPING_REVIEW_REQUIRED の code 番号**: MOD-006 に RX-0001 系で
  新規登録する(仮称 — 台帳改版は承認後)。

## 5. リスクと対応

- **PHI**: 処方内容は臨床 PHI。draft content は既存の no-store・監査規律を継承。
  UNRESOLVED_TEXT の自由記載は入力されたまま保持し、ログ・監査へは行数のみ。
- **後方互換**: 既存 draft(free-text rows)は読み込み時に UNRESOLVED_TEXT へ
  写し替える(変換は read path で行い、永続行は書き換えない)。content hash の
  旧形式は legacy hash として受理(WP-7205 の sourceMetadata と同型の互換規則)。
- **master 参照の安定性**: rp_items が参照する `master_versions` は
  append-only で不変。参照先の版廃止は参照を壊さない(版は履歴として残る)。
  retired master を参照する draft 行は `PENDING_MASTER_VALIDATION` 扱いで
  確認へ進めない(MST-003 §6 と整合)。
- **双方向同期なし**: MedicationRequest との関係は ownership 未解決のまま
  (BLOCKED_MEDICATIONREQUEST_PRESCRIPTION_OWNERSHIP) — 本 WP は FHIR 投影を行わない。

## 6. 人間への決定事項 — 決定記録(2026-09-19)

| # | 論点 | 推奨 | 決定 |
|---|---|---|---|
| D-1 | UNRESOLVED_TEXT と master 参照行の混在許可 | APPROVE | **APPROVED** |
| D-2 | 用法・品目参照の discriminated union 形式 | APPROVE | **APPROVED** |
| D-3 | 構造化行を content JSONB 内に保持(正規化表は確定段階で別途) | APPROVE | **APPROVED** |
| D-4 | 上限値案(rp_groups ≤50 / rp_items ≤200 / text ≤500) | APPROVE | **APPROVED** |
| D-5 | CODE_MAPPING_REVIEW_REQUIRED の MOD-006 新規登録(RX-0001 系) | APPROVE | **APPROVED** |

決定者: direct human authority「次に進んで」(2026-09-19)。packet 提示の
推奨案どおりの全項目 APPROVE。D-3 により migration 000019 は
「構造化行を content JSONB 内に保持するため新規テーブルは不要」
となる — `prescription_drafts` への additive 列(`content_format`
discriminator)のみに留める。

## 7. 検証計画(実装時)

- contract: 構造化行 schema の parse 単体テスト(混在・上限・union 分岐)
- repository: content hash が新構造全体を覆うこと、旧 hash 受理の互換
- route: UNRESOLVED_TEXT 含有 draft が確認経路で CODE_MAPPING_REVIEW_REQUIRED
  を返すこと(WP-7402 route が未実装なら guard 関数単位で検証)
- PG 統合: migration 000019 の適用・append-only trigger・既存行の無改変
- 非目標の確認: 用量計算が発生しないこと(calculation-purity gate)

## 8. 実装状況記録(2026-09-19)

`status: DECIDED_ALL_APPROVED` のまま、実装完了・検証状況を追記する。

実装済み:

- contracts: `rpGroups`/`rpItems` schema(剤形区分 enum、用法・品目参照の
  discriminated union resolved/unresolved)、groups ≤50 / items ≤200 /
  text ≤500 / dose ≤64、連番・ID 一意性、rows/rpGroups 同時指定は 400、
  `deriveRpGroupsFromLegacyRows`(UNRESOLVED_TEXT 決定的読み替え、
  content-hash 安定性のため sequence 由来 UUID 形 ID)、
  `prescriptionDraftUnresolvedCounts`/`HasUnresolvedMedicationItems` guard。
- shared-kernel: `RX-0001 CODE_MAPPING_REVIEW_REQUIRED`(PRESCRIPTION /
  BLOCKER / affectsClaimability / requiresHumanReview)登録、MOD-006 0.1.8。
- migration `000019`: `prescription_drafts.rp_groups JSONB NOT NULL
  DEFAULT '[]'` + JSONB 形状/サイズ検証 + `prescription_draft_rows`
  INSERT/UPDATE/TRUNCATE 拒否 trigger(旧構造 read-only 化)。
- API: save 時 materialize(rows-only 入力→構造化→rows:[] で保持)、
  read は永続 rpGroups 優先・無ければ legacy rows から導出、
  content hash は現行・pre-rpGroups・pre-sourceMetadata の3形式を受理、
  CAS/監査/no-store/404 非開示は不変。
- Web: 構造化 Rp エディタ(剤形 select、薬剤/用法のコード選択 or 自由記載、
  1回量/1日量/総量/単位、一般名・後発品)、master picker
  (GET /masters/{medications,usages}、asOf=業務日、明示検索のみ)、
  resolved 参照の表示名 hydrate、RX-0001 未解決バッジと rail 表示
  (未解決品目の残る draft を「確認可能」と表示しない)。

D-3 記録との差異(明示): 決定記録では `content_format discriminator` 列を
想定していたが、実装は `rp_groups` 列そのものを保持する形とした
(新規テーブルなし・JSONB 内保持の趣旨は同一)。discriminator は
rows/rpGroups の空判定で同義に判定できるため別途不要と判断。

検証(実行済みのみ):

- contracts 12 tests、API service/route 21 tests、web 117 tests、
  PG 統合(prescription-draft 15 tests、実 `yrese_dev` への 000019 適用 +
  trigger 拒否 + legacy 行無改変読取)全 PASS。
- WP-7402 route は未実装のため guard は関数単位で検証済み
  (packet §7 の代替条件どおり)。

残る gate(全て人間): production/staging への 000019 適用(runbook 経路)、
WP-7402 route 実装時の RX-0001 応答結線。

## 9. R3 独立 review 記録(2026-09-19)

Round 1(6 MEDIUM / 6 LOW)→ 全件修正:

- M1 group 共通 field が非先頭行編集で消失 → `applyDraftRowPatch` 抽出 +
  rpGroupId 伝播(unit test 付き)。
- M2 空行が phantom UNRESOLVED 品目を永続化 → `isDraftRowEmpty` フィルタ +
  全空 draft 拒否(専用メッセージ、contract エラーより後置)。
- M3/M4 checkout/launch route の `rows.length` 0 表示 →
  `prescriptionDraftEffectiveRpGroups` の items 総数へ。
- M5 master lookup 無限待機 → 10s timeout + AbortSignal.any 合成、
  caller signal 結線。
- M6 新規 Rp text field に制御文字拒否(`normalizedRpText`)。
- L 系: 比較正規化(flags canonical sort・persist 済み正規形で比較)、
  LIKE メタ文字エスケープ、版一致 label hydrate、
  UPDATE/TRUNCATE trigger 実実行テスト、WP-7205 中間 hash 統合テスト。

Round 2(2 MEDIUM / 8 LOW)→ 修正:

- M1 `rowToRpItem` エラーが常に RP1 → groupSequence 渡し。
- M2 モード切替の orphan 参照が phantom unresolved 品目化 →
  toggle 時に参照クリア + `isDraftRowEmpty` で mode 不整合 id を orphan 扱い。
- L: dead empty check 除去・superRefine issue → 専用メッセージ、
  hydrate 後 abort 再確認、json() → INVALID_RESPONSE、
  版一致 label 適用(applyMasterLabels)、flag canonical sort、
  LIKE 回帰テスト、applyDraftRowPatch 単体テスト。
  LOW-10(dirty の行数非対称)は既存仕様(行追加=未保存)優先で wontfix。

Round 3(1 LOW + informational)→ 修正:

- `["rpGroups"]` path の issue 混同(上限超過時に「1行入力」を表示)→
  `code === "custom"` で superRefine 由来のみ専用メッセージ。
- テスト追加: 全空拒否メッセージ、flag 順非依存 snapshotsEqual、
  orphan-id `isDraftRowEmpty` 分岐。

Round 4(1 LOW)→ 修正:

- 同 signature を持つ itemCount>200 superRefine issue との残存混同 →
  `candidate.rpGroups.length === 0` も条件に追加し、materialize が
  実際に空の場合のみ専用メッセージ(上限超過は「RP構造を確認して
  ください」へ正しく落ちる)。

Frozen diff: base `2464bf6`、sha256 `769fba012d45c7fcac5cc532086a0bc0faf4c5d6085297f52d8df9b5e8fa13b0`(36 files)。

最終検証(実行済みのみ): contracts 231 / web 121+796 / api 1,249
(実 PG 統合: prescription-draft 16・master 8 tests 含む)全 PASS、
typecheck・lint・OpenAPI drift・SSOT index(189)・boundaries・secrets・
calculation-purity・deps・sbom・`git diff --check` 全 PASS。
