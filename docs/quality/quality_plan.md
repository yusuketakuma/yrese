# quality_plan — 品質保証計画

```yaml
ssot_id: QUA-001
title: 品質保証計画
domain: quality
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §10
depends_on:
  - REG-005 samd_applicability_assessment
  - TST-001 test_strategy
  - QUA-003 change_control_policy
blockers:
  - BLOCKED_QUALITY_REGULATORY_REVIEW(規格該当性が未判定の間、品質体系の最終形を確定しない)
open_questions:
  - ISO 14971 / IEC 62366-1 / ISO 13485 / JIS X 8341-3 相当の適用要否(SaMD判定と連動)
```

## 1. 必須方針(v0.1.7 §10 全項目)

- 要件→設計→実装→テスト→リリースの traceability を持つ(WP・ssot_refs・evidence_id・テストの連鎖で担保)。
- 高リスク変更は change control board 相当のレビューを通す(QUA-003)。
- 法令・調剤報酬・マスター・外部IF・JAHIS・PMH・電子処方箋・オン資の変更を version_watchlist(REG-002)で監視する。
- リリース前に必ず実施: regression test / 算定 golden test / レセプト golden test / UI workflow test / 体験品質テスト / security scan / rollback rehearsal。
- リリース後に監視し、異常時は即時ロールバック可能にする(post_release_monitoring は Phase 1 で作成)。
- **本番データでテストしない**(訓練環境含む。fixtures は合成データのみ — MOD 系 fixture_policy と連動)。
- 本番障害・請求事故・医療安全インシデントは incident として扱う。
- 欠陥 severity: **請求事故につながる欠陥は high 以上、患者安全につながる欠陥は critical**。

## 2. 規格該当性(判定は REG-005 と連動)

| 規格 | 対象 | 現状 |
|---|---|---|
| ISO 14971 相当(リスクマネジメント) | SaMD 該当時必須、非該当でも SAF-001 を準用 | 【未判定】BLOCKED_QUALITY_REGULATORY_REVIEW |
| IEC 62366-1 / JIS T 62366-1 相当(ユーザビリティ) | SaMD 該当時 | 【未判定】同上 |
| ISO 13485 / JIS Q 13485 相当(QMS) | SaMD 該当時 | 【未判定】同上 |
| JIS X 8341-3 / WCAG(アクセシビリティ) | 全UI(適用レベルは UIX-004 open_question) | 方針採用済み・レベル未確定 |

該当性が不明な間は推測で体系を簡略化せず、SAF-001(リスク台帳)・SAF-002(safety case)・本計画の運用で ISO 14971 相当の実質を先行させる。

## 3. 品質ゲートの現状実装

| ゲート | 実装状態 |
|---|---|
| 型・テスト・境界検査 CI | 稼働中(typecheck / test / check:boundaries / build) |
| 実装者とレビュー者の分離 | 稼働中(codex実装→claudeレビュー) |
| 根拠なき算定の遮断 | 稼働中(trace の evidenceRef 必須強制、算定骨格の空ruleset→BLOCKED) |
| 請求データ生成の遮断 | 稼働中(isClaimable) |
| golden test | 未着手(evidence_id 発行後、期待値はSSOT由来のみ — TST-001) |
| security scan / SBOM | 未着手(Phase 1 で CI へ追加) |

## 4. 欠陥管理・インシデント(骨格)

- 欠陥は WP と同様に台帳管理し、severity(critical / high / medium / low)と患者安全・請求影響を必須記載する。
- critical(患者安全)・high(請求事故)は修正完了まで該当機能のリリースを禁止する。
- defect_management_policy / incident_management_policy / post_release_monitoring の詳細版は Phase 1 で作成する(v0.1.7 §10 の成果物リスト残)。
