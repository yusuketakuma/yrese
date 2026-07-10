# human_review_checklist — 人間レビューチェックリスト

```yaml
ssot_id: REG-006
title: 人間レビューチェックリスト
domain: regulatory
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - privacy_compliance_reviewer
  - security_critic
  - human_review_required
version: 0.2.0
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-10
approved_by: direct_user_instruction (WP-9001); independent_verifier APPROVED; spec_guardian APPROVED; medical_safety_reviewer APPROVED; privacy_compliance_reviewer APPROVED; security_critic APPROVED
effective_from: 2026-07-10
effective_to: null
source_refs:
  - docs/plan/phase0_plan.md §19
  - docs/spec/construction_prompt_v0.2.0.md §4, §42
  - docs/agents/codex_single_lane_operating_model.md
depends_on:
  - AGT-018 codex_single_lane_operating_model
impacts:
  - all human-gated Work Packages
  - production and external operations
related_work_packages:
  - WP-9001
related_tests:
  - pnpm check:ssot-index
related_prs: []
evidence_ids: []
change_log:
  - 0.2.0 2026-07-10 WP-9001とrequired reviews PASSによりrepository-local synthetic-only Codex運用承認と、Cloud/PHI/external/privilege human gateを分離
  - 0.1.0 2026-07-09 初版。Phase 0 human reviewで承認
open_questions:
  - 各レビュー担当(薬剤師・請求実務者・法務・経営)の実在アサイン
blockers: []
```

## 運用ルール

- 各論点は「担当種別」「判断材料」「判断期限の目安」「未決時の影響」を持つ。
- 論点の判断結果は本書に追記し、影響するSSOTへ反映(SSOT_UPDATE_REQUIRED)する。
- 論点が未決の間、依存する実装は該当BLOCKERで停止する。
- Codex specialist reviewは人間authorityの判断材料であり、法令・薬学・請求・患者安全・production security・data handling・risk acceptanceの人間承認を代替しない。
- WP-9001のユーザー指示は、repository-localかつsynthetic/de-identified dataだけを扱うCodex単一レーンの計画・編集・検証・landing routingを承認する。Cloud利用、production PHI/PII・production data取扱い、外部serviceへの送信、権限拡張、secret access、deploy、migration適用、production DML/batch/bulk操作の承認を含まない。

## チェックリスト

| # | 論点 | 担当種別 | 判断材料 | 未決時の影響 |
|---|---|---|---|---|
| 1 | MVP算定範囲(mvp_scope / calculation_coverage_matrix の対象・対象外) | 薬剤師+請求実務者 | calculation_coverage_matrix、対象外時の停止方針(BLOCKED_UNSUPPORTED_CLAIM) | 算定エンジン実装(RB-008)が開始不能 |
| 2 | 電子処方箋をMVPで境界設計に留める判断 | 経営+薬剤師 | 市場要件(導入薬局の期待)、ONS資料入手時期、接続試験リードタイム | 受付フローの画面設計に影響 |
| 3 | SaMD該当性判定結果の承認 | 法務(+PMDA相談) | samd_applicability_assessment(REG-005) | チェック機能の実装凍結が継続 |
| 4 | NSIPS許諾取得の要否・時期 | 経営 | NSIPS入会条件・費用、既存機器連携の必要性、Pharmacy Integration API での代替可能性 | 分包機等の既存機器連携方式が未確定 |
| 5 | 公費・地方単独助成のMVPカバー範囲 | 請求実務者+経営 | 対象自治体・制度リスト、按分計算の複雑性、PMH対象範囲 | 公費請求機能の範囲が未確定 |
| 6 | オンライン資格確認の接続構成とONS資料取得手続き | 経営+システム | ベンダー登録・ONSアクセス要件、資格確認端末の連携方式 | RB-002/003 が解除不能(外部連携全般の停止継続) |
| 7 | 帳票の保存期間・電子保存運用管理規程の方針 | 法務+薬剤師 | legal_compliance_matrix 行1/6、e-文書法要件 | 帳票・調剤録の保存設計が確定しない |
| 8 | 既存レセコン移行のスコープ(移行元・データ範囲) | 経営+請求実務者 | legacy_rececon_migration_matrix(WP-0010)、対象顧客の現行システム | 移行ツール設計が開始不能 |
| 9 | SLO候補値・性能予算の目標水準 | 経営+現場 | performance_budget 案、現場の混雑実態 | 受入基準が仮のまま |
| 10 | サポート体制・SLAの事業前提 | 経営 | support_operations_model 案、提供価格・体制 | サービス提供条件が未確定 |
| 11a | repository-local synthetic-only Codex単一レーン | ユーザー/経営(開発運用) | WP-9001、AGT-018、maker/checker分離、secret/PHI禁止、local validation記録 | WP-9001の指示によりroutingは承認済み。ただしAGT-018改版はindependent verification後にAPPROVED化する |
| 11b | Cloud・production PHI/PII・外部送信・権限拡張・secret access | 経営(データ取扱い)+privacy/security authority | 対象service、送信先、データ分類、目的、retention、encryption、tenant boundary、権限、audit、rollback | 個別の明示human approvalがない限りBLOCKED。11aの承認を流用不可 |
| 12 | Phase 0 成果物の完了判定(Phase 0 gate) | 全担当 | ssot_index、本チェックリストの消化状況 | Phase 1 設計ゲートが開かない |

## レビュー記録

(判断が下り次第、「日付 / # / 判断内容 / 判断者 / 反映先SSOT」を追記)

- 2026-07-09 / (先行記録) / 実装開始の承認・fable5への全権委任・公式資料Web調査の許可 / ユーザー / State.md 15:30 エントリ参照
- 2026-07-10 / #11a / Codex単一レーンでrepository-local synthetic-only作業を行う指示。Cloud/PHI/external/privilege/production actionは承認範囲外 / ユーザー / WP-9001、AGT-018(PROPOSED)
