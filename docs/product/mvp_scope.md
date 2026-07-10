# mvp_scope — MVP対象範囲

```yaml
ssot_id: PRD-001
title: MVP対象範囲
domain: product
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - spec_guardian
  - data_integrity_auditor
  - architect
  - test_architect
  - medical_safety_reviewer
  - privacy_compliance_reviewer
  - claims_evidence_specialist
  - security_critic
  - api_contract_reviewer
  - human_review_if_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-11
approved_by: direct_user_instruction (WP-9001 AGT-018 cutover); independent_verifier APPROVED; spec_guardian APPROVED; data_integrity_auditor APPROVED; architect APPROVED; api_contract_reviewer APPROVED; test_architect APPROVED; claims_evidence_specialist APPROVED; security_critic APPROVED; privacy_compliance_reviewer APPROVED; medical_safety_reviewer APPROVED
effective_from: 2026-07-11
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §2, §3, §18, §19 / docs/plan/phase0_plan.md §2.1
  - AGT-018 codex_single_lane_operating_model
  - PRC-007 ssot_governance
depends_on:
  - docs/product/non_mvp_scope.md
  - docs/calculation/calculation_coverage_matrix.md
  - docs/claim/claim_scope_matrix.md
impacts:
  - すべての実装WP
related_work_packages: [WP-0006, WP-0019, WP-0038, WP-9001, WP-9006]
related_tests:
  - packages/shared-kernel/src/kernel.test.ts
related_prs: []
evidence_ids: []
change_log:
  - 0.1.1 (2026-07-11): WP-9006 AGT-018 routing compatibility amendmentを10-role review後にfinalize。M1-M12、claim-stop、open questions、blocker、human product/pharmacist/claims/legal authorityは不変更。0.1.0 human approvalはhistorical provenanceとして保持し、本版のscope承認には流用しない。
  - 0.1.0 (2026-07-09): Phase 0 human reviewで承認。
open_questions:
  - 電子処方箋を「境界設計のみMVP」とする判断の市場妥当性(人間レビュー必須)
  - 公費・地方単独助成のカバー範囲(対象制度の限定リスト)
  - 服薬管理指導料等の薬学管理料をどこまでMVPに含めるか
blockers:
  - 算定項目の最終確定は calculation_coverage_matrix の BLOCKED_REGULATORY_REVIEW 解消後
```

## 原則

- MVPであっても法令適合性・医療安全・請求正確性から逸脱しない(v0.2.0 §2)。
- **MVP対象外の算定・請求を含む処方から保険請求データを生成してはならない**(v0.2.0 §18)。
- 「動くが根拠がないコード」より「根拠不足を正しく検知して止まるコード」を優先する(v0.2.0 §3)。

## MVP対象(phase0_plan §2.1 を正式化)

| # | 領域 | MVP範囲 | 受入条件の枠組み |
|---|---|---|---|
| M1 | 受付 | 紙処方箋受付、JAHIS 2次元シンボル読取(仮取込→薬剤師確認→確定)。電子処方箋は**受付境界の設計のみ** | 仮取込が確定と明確に区別され、原本照合手順が動作する |
| M2 | 患者・保険 | 患者管理、保険情報履歴、負担割合、主要公費登録、資格確認結果スナップショット | 保険者変更・期限切れが検出され、請求前再確認へ導かれる |
| M3 | 資格確認 | 公式外部IF経由の結果取込・表示・請求前資格確認・障害時状態管理(接続実装はONS資料確認後) | 未確認状態が全画面で誤認なく表示される |
| M4 | 処方・調剤入力 | RP単位入力、用法・用量・日数・数量、後発品変更、一般名処方、疑義照会記録、残薬調整記録 | キーボード完結・薬剤師確認前後の状態分離 |
| M5 | 算定 | calculation_coverage_matrix で「MVP」判定の項目のみ。純粋関数+calculation_trace 必須 | golden test + 既知案件照合。evidence_id のない項目は算定不能 |
| M6 | 会計 | 一部負担金請求、未収・返金・差額精算の基本 | 金額根拠(trace)を画面で説明できる |
| M7 | 帳票 | 領収証、調剤明細書、調剤録、薬袋、薬剤情報提供文書、請求前点検リスト(版管理・ハッシュ・再出力) | 出力時点の算定根拠・マスター版が保存される |
| M8 | レセプト | 中間モデル→電子レセプト生成→記録条件検証→請求前点検→月次締め→ロック→公式手順への受け渡し。返戻・再請求管理の基本 | 記録条件仕様バリデーション全件通過が請求可能の前提 |
| M9 | マスター | 医薬品・薬価・調剤行為・コメント・保険者・公費マスターの取込パイプライン、版管理、有効日・経過措置、Edge配布 | 更新前後の回帰テストと承認ゲート |
| M10 | オフライン | LOCAL_ONLY(仮受付・仮算定・仮帳票・ローカル監査ログ)、RECOVERY_SYNC(再検証・競合検出・人間承認) | モード別許可/禁止表(phase0_plan §9.3)どおりに動作 |
| M11 | 基盤 | マルチテナント分離、RBAC(UI+API両面)、監査ログ、AWS無停止更新、Edge同期 | tenant isolation test / 監査ログ欠落テスト通過 |
| M12 | 連携 | Pharmacy Integration API v0(電子薬歴向け処方・調剤イベント配信の最小セット、sandbox、contract test) | contract test 通過、PHI classification 付与 |

## 実装ポリシー(対象外検知)

MVP対象外の要素を含む処方・請求は、`@yrese/shared-kernel` の以下ステータスで停止する(実装済み、コミット 9ab039e):

- `BLOCKED_UNSUPPORTED_CLAIM` — 対象外算定を含み請求不能
- `MANUAL_REVIEW_REQUIRED` — 人間判断で処理継続の可否を決める
- `FUTURE_SCOPE_NOT_CLAIMABLE` — 将来対応予定・現状請求不能

`isClaimable()` がこれらの存在時に請求データ生成を拒否する。この関数を迂回する請求経路を実装してはならない。

## 変更管理

MVP範囲の変更は本SSOTの改版としてCodex rootがcurrent WPを起票し、read-only mapper/pre-plan reviewer → sole maintainer → independent verifier + relevant specialists → required human product/pharmacist/claims/legal authority の順に審査してAPPROVEDとする。実装者が実装中に範囲を拡大・縮小してはならない(SSOT_UPDATE_REQUIREDで返す)。
