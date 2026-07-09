# fixture_policy — テストフィクスチャポリシー

```yaml
ssot_id: MOD-013
title: テストフィクスチャポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.1.7 §0.0.3.4(本番個人情報のfixtures混入禁止), §36(本番個人情報をテストに使わない), §0.1.6.14
depends_on:
  - docs/testing/test_strategy.md(TST-001)
  - docs/security/privacy_impact_assessment.md(SEC-004)
open_questions:
  - packages/fixtures / packages/test-utils の新設時期(golden test 資産が発生する Phase 1 以降 — MOD-001 §2)
  - 合成患者データの生成規約(実在人名・実在保険者番号との衝突回避規則)
blockers: []
```

## 1. 絶対規則

1. **本番個人情報・復元可能な医療情報を fixture に含めない**(v0.1.7 §0.0.3.4, §36)。患者氏名・生年月日・保険者番号・公費受給者番号・実処方・実レセプトの実データは、マスキング済みであっても fixture 化しない
2. fixture は**合成データのみ**。「合成」とは実在の個人・処方に由来しないことを指す(実データの一部改変は合成ではない)
3. 秘密情報(API key・証明書・接続先情報)を fixture・モックレスポンスに埋め込まない
4. fixtures への PHI 混入検査(fixtures PHI scan — v0.1.7 §0.0.3.11)を CI へ追加する【要整備 — packages/fixtures 新設時】

## 2. 所有と配置

- 現状: 各パッケージのテスト内インライン fixture(55テスト)。パッケージ間で fixture を共有する必要が生じた時点で `packages/fixtures` / `packages/test-utils` を新設する(MOD-001 §2、無秩序な先行新設をしない)
- owner は WP ごとに fable5 が指定する(AGT-009 owner 表: fixtures / test-utils)
- contract fixtures / E2E fixtures は共有・契約領域(ロック必須)

## 3. golden fixture と evidence の連動

- 算定・レセプトの golden test fixture は、**期待値の根拠となる evidence_id(公式資料)を fixture メタデータに持つ**(TST-001 の5則と同一原則)
- 期待値と実装の不一致が出た場合、テスト修正の前に `SSOT_UPDATE_REQUIRED` として fable5 が原因(実装誤り/SSOT誤り/資料改定)を裁定する
- 一次資料ノート(CAL-002 / CLM-002)が人間レビューで承認されるまで、算定 golden fixture は作成しない(根拠なき期待値の禁止)

## 4. 合成データ規約(初期)

- ID 類は明確に合成と分かる接頭辞(例: `test-`)を用いる
- 医薬品コード・保険者番号などの公的コード体系を使う場合は、**実在コードの使用可否を CodeMappingRegistry(MST-002)の review_status に従い判断**する(マスター由来の実在コード自体は個人情報ではないため使用可、ただし患者と紐づく組合せを作らない)
- training mode / demo data(v0.1.7 §9.9)も本ポリシーに従う(本番個人情報の訓練利用禁止)
