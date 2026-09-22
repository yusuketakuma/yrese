# WP-7500 — 契約保全型全体監査・修復

## 実行境界と受入

2026-09-22 の添付 v4 指示による IMPLEMENT。active_root_writer は `/root`。
H = `5307d3a06c73a0486e8da232ba833407d5dfcd20`。追跡済み B = H、index clean。
元 main の `artifacts/` と `ui-test-tools/` は既存未追跡資産として保全し、
検証入力には複製しない。専用 branch は `codex-sol/wp-7500-contract-audit`、
worktree は `.codex/worktrees/wp-7500`。698 tracked files の hash 一致を確認。

全体 scope は C01–C12 と適用される X01–X08、確定欠陥修復、有限採択した構造改善、
契約・テスト保全、統合検証、独立レビュー、再探索。初回 PASS は完了ではない。
push/PR/deploy/実データ/外部送信なし。既存 APPROVED SSOT と human gate は維持。
baseline manifests、非機密ログ、checkpoint は元 checkout の
`.codex/audits/wp-7500/` に保存する。現時点の coverage は PARTIAL。

## Baseline

- Node 26.6.0 / pnpm 11.18.0。新 worktree へ frozen install、install scripts 無効。
  offline cache 不足後、公開 registry から不足依存だけ取得。env/鍵/実DBはコピーなし。
- workspace tests: 2,860 PASS / API PostgreSQL 149 SKIP、exit 0。
- workspace typecheck / build: exit 0。lint script は workspace に実体なし
  (`--if-present` の exit 0 を lint 検証済みとは呼ばない)。
- boundaries / calculation-purity / SSOT index / OpenAPI / SBOM: exit 0。
- secrets: exit 1、root `.git` の scope failure。P1 の再現根拠。
- scripts: 初回は scratch が親 repo の ignore 範囲内であるため non-git fixture が
  Git 内と判定され失敗。`GIT_CEILING_DIRECTORIES` で fixture 親探索を区切り exit 0。
- CI 固定 PostgreSQL 18.4 digest を取得し、専用 tmpfs container、loopback のみの
  公開ポート、CPU/memory/PID 制限で synthetic DB 検証。API 1,386 PASS / skip 0、
  exit 0。DB検証後 container を停止。既存DBは不使用。
- dependency audit は外部送信を伴うため未実行。公開依存取得と audit payload 送信は区別。

## 有限キュー

### P1 / FIX — 正常な Git worktree での secrets gate failure

- 分類: CONFIRMED_BUG / P2、risk R2 (開発 gate の Git metadata 判定)。
- P: H の `scripts/check-secrets.mjs`, `scripts/check-scripts.mjs`。
- owner/worktree: `/root` / 上記専用 worktree。
- 書込範囲: 上記2 script、当記録、Plans.md の current pointer。
- 依存: Git gitfile resolution、既存 repository-content scope tests。
- 期待挙動: 正常な Git 管理情報を持つ worktree は通常 checkout と同じ対象を検査する。
  現行 code は ignoredDirs の `.git` が regular file だと常に拒否する。
- 保持契約: secrets pattern/allowlist/ログ非漏洩/ignored `.env` 検出/不正 scope の
  fail-closed は不変。任意の `.git` file を許可しない。root かつ Git が検証した
  regular gitfile のみ metadata として扱う。既存 CLI 引数・終了値・通常出力は不変。
- 検証: real linked worktree の clean PASS と synthetic secret FAIL、不正 gitfile と
  metadata symlink FAIL、既存 script regression 全体、実 worktree の secrets check。
- 到達条件: baseline 再現が修正後 PASS、既存 negative assertions 保持、独立 review。
- rollback: 今回差分だけの逆 patch。既存差分・SSOT・DB を変更しない。
- 状態: VERIFIED (局所検証のみ)。`pnpm test:scripts` は追加回帰を baseline 実装で
  実行して exit 1 (正常 worktree と secret 検出 path の2 assertion が失敗)、
  修正後 exit 0。`pnpm check:secrets` と `git diff --check` も exit 0。
  CLI/export 変更なし、既存テスト削除/弱体化なし。script +14 LOC、tests +39 LOC。
  新規 module なし、通常 checkout は追加 Git probe なし、root gitfile 時のみ1 probe。
  P→W snapshot/patch を外部 checkpoint に保存。独立 review 未実施、commit なし。

### F2 — Webhook 応答本文の解放漏れ

CONFIRMED_BUG / P2 (ライブラリ経路。main は外部 sink を未接続)。
`WebhookPartnerSink.publish` は fetch が header を返すと timer/listener を除去し、
body を consume/cancel せず return/throw する。2xx と non-2xx の両経路が該当。
streaming body の資源を回収できない。根拠は
[Node.js Undici の資源管理契約](https://github.com/nodejs/undici#garbage-collection)。
実通信の枯渇は再現していない。安全な injected Response stream で反証可能。
外部連携領域の pre-review と必要 gate を確定してから packet 化する。実装未着手。

### F3 — IPv6 の非公開アドレス判定漏れ

`partner-endpoint-policy.ts` の `isPrivateIpv6` は prefix を文字列の
`fe80` に限定し、非圧縮 loopback も `::1` と等値比較する。
API-010 §2 は private/loopback/link-local を拒否する契約。
[RFC 4291 §2.4/2.5.3](https://www.rfc-editor.org/rfc/rfc4291.html#section-2.4)
は link-local prefix を FE80::/10、loopback を 128-bit 値で定義する。
`fe90::1`, `febf::1`, `0:0:0:0:0:0:0:1` は公開扱いされる source 経路がある。
単一 compiled module、network none、read-only root/mount、scratch-only tmpfs、
空 allowlist env、CPU/memory/PID/file-size/wall-time 制限のローカル container で
純粋判定と injected DNS の結果を確認する。実 DNS/HTTP は実行しない。
production SSRF 成立や egress 層の有無は未検証。main は外部 sink を未接続。
security 修復は R3 pre-review/human gate の成立後に扱い、現時点では変更しない。

## 独立レビュー制約

AGT-018 §3.3 は prompt-only ではなく強制 read-only を要求する。
native subagent API は現状の unrestricted 権限を継承し、権限指定がないため未起動。
未実施 review を自己点検で代替しない。レビュー経路の確認は継続し、成立前の
commit/COMPLETE は行わない。thread なし。現在の model/sandbox 設定は変更しない。

## 構造改善 baseline

全362 TS/TSX/MJS (tests 区分あり) の固定 LOC manifest を保存。
候補は prescription workspace 2,222 LOC、calculation index 2,144 LOC、
PG draft service 1,903 LOC、in-memory draft service 1,686 LOC。
LOC の大きさだけでは採択しない。責務・契約を確認して指標・到達条件・保全指標を
事前固定する。構造改善 packet は未採択、改善達成は未主張。
