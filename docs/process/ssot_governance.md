# ssot_governance — SSOT ガバナンス

```yaml
ssot_id: PRC-007
title: SSOT ガバナンス
domain: process
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.2.0 §0.1.6.17
impacts: 全SSOT・全実装
open_questions:
  - ssot_index.md の自動生成(lint)導入時期
```

## 1. 基本ルール(v0.2.0 §0.1.6.17.1)

- fable5 が仕様決定したら、必ず該当SSOTを作成または更新する。
- 実装者は承認済み(APPROVED)SSOTとWPを読んでから実装する。SSOTにない仕様の独自補完を禁止する。
- 実装中に仕様不備を発見した場合、コード側で解決せず `SSOT_UPDATE_REQUIRED` として fable5 へ返す。
- 高リスク領域のSSOT更新は opus4.8 レビュー必須。法令・請求・外部IF・医療安全に関わる更新は人間レビュー候補として明記する。
- コミット(将来はPR)は `ssot_refs` / `ssot_versions` を記載する。SSOT差分なしに高リスク実装だけが変わる変更を禁止する。
- agmsg・会話ログ・モデル内部計画はSSOTではない。有益な内容は fable5 がSSOTへ転記してから根拠化する。

## 2. ステータス(v0.2.0 §0.1.6.17.2)

`DRAFT`(実装根拠禁止)→ `PROPOSED`(レビュー待ち・実装根拠禁止)→ `APPROVED`(実装根拠可)→ `IMPLEMENTED` → `VERIFIED`。その他: `SUPERSEDED` / `DEPRECATED` / `BLOCKED`(根拠不足・矛盾・法令確認待ち)。

## 3. 共通メタデータ

v0.2.0 §0.1.6.17.3 の yaml ブロック(ssot_id / title / domain / status / owner / reviewers / version / created_at / updated_at / source_refs / depends_on / impacts / open_questions / blockers 等)を全SSOT冒頭に置く。ssot_id の接頭辞: AGT(agents)/ REG(regulatory)/ SAF(safety)/ PRD(product)/ CAL(calculation)/ CLM(claim)/ ADP(adapters)/ ARC(architecture)/ MST(masters)/ UIX(uiux)/ SEC(security)/ PRC(process)/ QUA(quality)/ TST(testing)/ OPS(operations)/ MOD(modules)/ API(api)。

改版予約に用いる任意フィールド `amends`(ADR 側)/ `amended_by` ・ `amendment_status` ・ `amendment_note`(改版予約される対象 SSOT 側)は §7 で定義する。SSOT ではない提案・調査文書を置く `docs/research/` 作業領域は §8 で定義する。

## 4. 更新フロー(v0.2.0 §0.1.6.17.5 の10段)

1. fable5 が仕様決定または仕様差分を検知 → 2. 該当SSOT特定 → 3. 変更理由・根拠・影響範囲・差分を記録 → 4. 高リスクは opus4.8 レビュー → 5. 必要なら HUMAN_REVIEW_REQUIRED → 6. status を APPROVED へ → 7. WPに ssot_refs/versions 記載 → 8. 実装 → 9. コミットでSSOT反映確認 → 10. テスト・レビュー通過後 IMPLEMENTED / VERIFIED へ。

## 5. Phase 0 ゲート(PROPOSED 文書群の一括人間レビュー)

現段階の全SSOTは PROPOSED である。運用:

- Phase 0 完了時に `ssot_index.md` に全SSOTを列挙し、人間レビュー(薬剤師・請求実務者・法務・経営)を一括実施する(論点は REG-006)。
- 一括レビューで承認された文書を APPROVED に更新し、指摘があるものは DRAFT へ差し戻す。
- **PROPOSED 段階で依存してよい実装**は R0-R2 の「骨格・型・ガード・検査」に限る(実績: shared-kernel/money/date-time/trace/events/contracts/tenant-context/calculation骨格)。R3+ の本実装(算定ルール値・レセプト生成・Official Adapter・本番認証)は該当SSOTの APPROVED + evidence_id 発行まで開始しない。

## 6. 検証済み情報の優先

同一項目について記載が矛盾する場合、一次確認済み文書(REG-007 evidence_verification_log)> 各SSOTの【要確認】記載 の順で優先し、fable5 が旧記載を訂正する(先例: 安全管理GL 7.0 / JAHIS Ver.1.11 の source_registry 訂正)。

## 7. 上位方針 ADR による改版予約(`amends`)と暫定権威

上位のアーキテクチャ方針 ADR(例: ARC-008)が既存の APPROVED SSOT の結論を改版する必要がある場合、対象 SSOT 本体の完全改版(§4 の10段)を待たずに ADR を APPROVED にできる。ただし **APPROVED 同士の矛盾(実装者が旧本文を読んで誤実装する fail-closed 事故)** を防ぐため、以下を必須とする。

1. **`amends` 宣言**: ADR の frontmatter に `amends: [対象ssot_id...]` を列挙する。「この ADR が対象 SSOT の該当結論を改版予約している」ことの機械可読な宣言である。
2. **同一バッチの改版予約スタンプ**: ADR を APPROVED に昇格するコミットと**同一バッチで**、各対象 SSOT の frontmatter に次を付与する(version を1段上げる):
   - `amended_by: [ADR の ssot_id]`
   - `amendment_status: PENDING_REVISION`
   - `amendment_note: "<ADR>(APPROVED <date>)により改版予約中。方向は <ADR> が暫定的に優先する。本文の全面改版は §4 の10段フローで実施し本注記を解除する。"`
   この予約スタンプは軽量注記であり、`amendment_note` が変更記録を兼ねる(独立した変更履歴行は対象 SSOT の完全改版時にまとめて記載してよい)。
3. **暫定権威**: `amendment_status: PENDING_REVISION` の対象 SSOT について、当該結論が ADR と矛盾する場合は **ADR(APPROVED)を暫定的に優先**する。旧本文を単独の実装根拠にしない。実装者は対象 SSOT を読む際に `amendment_note` を確認し ADR の該当箇所を参照する。
4. **予約の解除**: 各対象 SSOT を §4 の10段フローで完全改版した時点で、`amendment_status` を解除(フィールド削除)し変更履歴に改版内容を記載する。ADR 側の `amends` からは解除済み対象を落とす(または解除済みと注記する)。
5. **順序担保(fail-closed)**: ADR の APPROVED 昇格・`amends` 宣言・全対象への予約スタンプ付与は**同一バッチ**で行う。個別の実装 WP はこの順序担保が済むまで着手しない。

本節は §4 の10段フローを置換しない。ADR は「方向の予約」を与えるのみで、対象 SSOT 本体の正式な結論は各自の完全改版で確定する。

## 8. 非SSOT作業領域(`docs/research/`)

`docs/research/` は SSOT ではない提案・調査・レビュー用の作業文書の領域である。ここに置く文書は:

- **SSOT index(IDX-001)の追跡対象外**。`ssot_id` 必須・index 登録の規律を適用しない(`check:ssot-index` はこの領域を除外する)。
- **実装の直接根拠にしない**(§1「SSOTにない仕様の独自補完を禁止」と同じ規律)。設計提案は fable5 レビューを経て該当 SSOT へ formalize してから根拠化する。
- frontmatter に `proposal_id` / `status: DRAFT` 等を持ってよいが、APPROVED SSOT の正本性を持たない。SSOT へ昇格する内容は該当ドメインの SSOT を新規作成/改版して移す。

## 変更履歴

- 0.2.0 (2026-07-10): ARC-008 §9 step3 に基づき §7(上位方針 ADR による改版予約 `amends`・暫定権威・予約スタンプ書式・順序担保)と §8(`docs/research/` 非SSOT作業領域)を新設。§3 に予約フィールドと research 領域へのポインタを追加。ARC-008 の APPROVED 昇格・改版カスケードと同一バッチで実施(opus4.8 が承認した ARC-008 §9 の実行)。
- 0.1.0 (2026-07-09): 初版(v0.2.0 §0.1.6.17 を SSOT ガバナンスとして確定)。人間レビュー承認済み。
