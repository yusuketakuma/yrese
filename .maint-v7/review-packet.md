# Frozen review packet (maint-v7 round-2)

- base SHA: `fb601d1` (devin/maint-v7-20260928, = main HEAD)
- candidate SHA: `5b69830`
- diff: `git diff fb601d1..5b69830`, sha256 `7e8a307d03a7dc2909f3b1a668e043363ceab3ff96ffb8142a7254f84ba65bdc`
- changed paths: `.maint-v7/packet-paths.txt` (35 files)
- acceptance: 確定 finding のみ修復。挙動保持リファクタ(createCoverageController 抽出)と
  fail-closed 強化(制御文字/exact shape)を区別して見る。弱体化・検証削除・
  PHI/secret・規約逸脱・破壊的変更があれば報告。
- writer による検証結果(2026-09-28, Node 26.6.0 / pnpm 11.18.0):
  typecheck/lint 全緑、contracts 265 / audit 208 / calculation 121 / money /
  trace / api 1256(PG統合 149 skip=TEST_DATABASE_URL 未提供)/ web 813 PASS、
  test:scripts PASS、build 全緑、clean rebuild で dist に *test-support* 0 件、
  check:openapi/secrets/deps/sbom/boundaries/calculation-purity/ssot-index 全 PASS。
- 未実行ゲート: PG 統合(Docker/pg_isready なし)、browser/Playwright(未整備)。
