# WP-7302 pre-review packet(R3 実装前 human decision 材料)

```yaml
document_kind: human_pre_review_packet
status: PROPOSED
work_packages: [WP-7302]
created_at: 2026-09-18
decided_at: null
decided_by: null
risk_class: R3 (prescription draft 構造化 — DOM-002 改版実装 + migration)
prepared_by: devin active_root_writer (maker — 本packetは判断材料であり、makerの自己承認ではない)
oracle_used: false (user instruction 2026-09-17: oracleは使用しない)
implementation_authority: none yet — 本packetの human 決定記録が揃うまで実装しない
decisions_required: 5
decisions_resolved: 0
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

## 6. 人間への決定事項

| # | 論点 | 推奨 |
|---|---|---|
| D-1 | UNRESOLVED_TEXT と master 参照行の混在許可 | APPROVE |
| D-2 | 用法・品目参照の discriminated union 形式 | APPROVE |
| D-3 | 構造化行を content JSONB 内に保持(正規化表は確定段階で別途) | APPROVE |
| D-4 | 上限値案(rp_groups ≤50 / rp_items ≤200 / text ≤500) | APPROVE |
| D-5 | CODE_MAPPING_REVIEW_REQUIRED の MOD-006 新規登録(RX-0001 系) | APPROVE |

いずれか REJECT/AMEND の場合は該当節を修正して再提出する。
全項目 APPROVE の場合は status を DECIDED_ALL_APPROVED に更新し、
WP-7302 を実装可能キューへ移す。

## 7. 検証計画(実装時)

- contract: 構造化行 schema の parse 単体テスト(混在・上限・union 分岐)
- repository: content hash が新構造全体を覆うこと、旧 hash 受理の互換
- route: UNRESOLVED_TEXT 含有 draft が確認経路で CODE_MAPPING_REVIEW_REQUIRED
  を返すこと(WP-7402 route が未実装なら guard 関数単位で検証)
- PG 統合: migration 000019 の適用・append-only trigger・既存行の無改変
- 非目標の確認: 用量計算が発生しないこと(calculation-purity gate)
