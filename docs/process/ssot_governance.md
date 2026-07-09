# ssot_governance — SSOT ガバナンス

```yaml
ssot_id: PRC-007
title: SSOT ガバナンス
domain: process
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
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

## 4. 更新フロー(v0.2.0 §0.1.6.17.5 の10段)

1. fable5 が仕様決定または仕様差分を検知 → 2. 該当SSOT特定 → 3. 変更理由・根拠・影響範囲・差分を記録 → 4. 高リスクは opus4.8 レビュー → 5. 必要なら HUMAN_REVIEW_REQUIRED → 6. status を APPROVED へ → 7. WPに ssot_refs/versions 記載 → 8. 実装 → 9. コミットでSSOT反映確認 → 10. テスト・レビュー通過後 IMPLEMENTED / VERIFIED へ。

## 5. Phase 0 ゲート(PROPOSED 文書群の一括人間レビュー)

現段階の全SSOTは PROPOSED である。運用:

- Phase 0 完了時に `ssot_index.md` に全SSOTを列挙し、人間レビュー(薬剤師・請求実務者・法務・経営)を一括実施する(論点は REG-006)。
- 一括レビューで承認された文書を APPROVED に更新し、指摘があるものは DRAFT へ差し戻す。
- **PROPOSED 段階で依存してよい実装**は R0-R2 の「骨格・型・ガード・検査」に限る(実績: shared-kernel/money/date-time/trace/events/contracts/tenant-context/calculation骨格)。R3+ の本実装(算定ルール値・レセプト生成・Official Adapter・本番認証)は該当SSOTの APPROVED + evidence_id 発行まで開始しない。

## 6. 検証済み情報の優先

同一項目について記載が矛盾する場合、一次確認済み文書(REG-007 evidence_verification_log)> 各SSOTの【要確認】記載 の順で優先し、fable5 が旧記載を訂正する(先例: 安全管理GL 7.0 / JAHIS Ver.1.11 の source_registry 訂正)。
