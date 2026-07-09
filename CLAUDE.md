# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## プロジェクト

yrese(プロダクト呼称: Fable-Rx)— 日本の保険薬局向け調剤用レセプトコンピューター MVP。
正式仕様は `docs/spec/construction_prompt_baseline.md`(全バージョン収録、**新しいバージョンほど優先・停止条件は緩和不可**)。現行ベースラインは v0.2.0(`docs/spec/construction_prompt_v0.2.0.md`)。
タスク台帳は `Plans.md`、活動ログは `State.md`(コミット単位で更新し、活動単位ごとに commit & push する運用)。

## コマンド

```bash
pnpm install                        # 依存導入(Node >=24, pnpm >=10)
pnpm -r typecheck                   # 全ワークスペース typecheck
pnpm -r test                        # 全テスト(vitest)
pnpm --filter @yrese/calculation test           # 単一パッケージのテスト
pnpm --filter @yrese/api exec vitest run -t "名前"  # 単一テストの実行
pnpm check:boundaries               # 依存方向・循環・重複const検査(違反=停止条件)
pnpm check:secrets / check:deps / check:sbom   # secret / 脆弱性 / SBOM ゲート
pnpm test:scripts                   # scripts/ 自体の回帰ハーネス
pnpm -r build && pnpm clean         # 全ビルド / 生成物削除
pnpm --filter @yrese/api dev        # API 起動(PORT、既定 3001)
pnpm --filter @yrese/web dev        # Web 起動(3000)
```

CI(.github/workflows/ci.yml)は typecheck / test / boundaries / secrets / deps / SBOM / build を全て通す必要がある。

## アーキテクチャ(全体像)

pnpm monorepo。`apps/*` が実行体、`packages/*` が共通モジュール(runtime-neutral・依存軽量)。

- `packages/shared-kernel` — branded ID、SystemMode(NORMAL〜RECOVERY_SYNC)、PENDING系ステータス、BLOCKER種別、エラーコード/権限スコープの**唯一の正**。同名概念のローカル再定義は check:boundaries が拒否する
- `packages/money` / `date-time` — bigint ベースの金額・点数 / 暦日(処方日・調剤日・請求月)。**浮動小数点・暗黙の現在時刻は禁止**
- `packages/trace` — calculation_trace / EvidenceRef。**affectsClaim=true のステップは evidenceRef 必須(実行時強制)**
- `packages/events` — 同期イベントエンベロープ(Outbox/Inbox)。PHI≠none → encrypted 必須
- `packages/contracts` — API 契約の単一正本(zod)。フロントは契約外フィールドを仮定しない(contract-first)
- `packages/calculation` — 純粋関数の算定エンジン。evidence 裏付けルールのみ実装可、copay は evidence 未発行のため BLOCKED
- `packages/audit` — 監査イベント registry(文法 `<domain>.<resource?>.<action>`、台帳外種別は実行時拒否)
- `apps/api` — Fastify 5。deny-by-default 権限(requirePermission)、dev 用テナントスタブは本番起動拒否
- `apps/web` — Next.js 15。NodeNext 形式 import のため webpack `extensionAlias` 設定済み。共通パッケージは `transpilePackages` 経由

依存方向は `packages/* → apps/*` 禁止・循環禁止(`scripts/check-boundaries.mjs` が機械強制)。

## 開発規律(SSOT 駆動・fail-closed)

- **SSOT が先、実装が後**: `docs/` 配下の SSOT(索引: `docs/ssot_index.md`)が APPROVED でない仕様は実装しない。仕様不備はコードで吸収せず SSOT_UPDATE_REQUIRED として返す
- **evidence 規律**: 算定・請求・帳票ロジックは `docs/calculation/evidence_register.md` の evidence_id 裏付けが必須。点数値や法令要件を推測実装しない — 「根拠不足で止まるコード」が正
- **fail-closed**: 未知ステータス=請求不可(isClaimable は allow-list)、空ルール算定=BLOCKED、未入金の領収済み表示禁止、会計台帳は append-only
- **二系統運用**: Claude 側=仕様/SSOT/フロントエンド、Codex 側=バックエンド(agmsg チーム `yrese` で WP_ASSIGN→CODEX_PLAN→実装→WP_HANDOFF→レビュー)。詳細は `docs/agents/`。高リスク領域(算定・請求・監査・会計等)は opus4.8 レビュー必須
- **コードはシンプルに実装する**: 要求を満たす最小の実装を選び、投機的な抽象化・使われないオプション・「ついでの改善」を入れない(改善は新しい WP として提案する)
- **二重実装の禁止**: 同じ概念・enum・status・validation・money/date処理を複数箇所に実装しない。実装前に既存の共通パッケージ(`packages/*`)と SSOT を確認し、あるものは再利用、拡張が必要なら共通側を改版する(重複は `check:boundaries` と COMMON_MODULE_DUPLICATION_BLOCKED の対象)
- コミットメッセージは WP-ID を先頭に(例: `WP-2101b: ...`)。Codex 実装分は `Co-Authored-By: Codex <noreply@openai.com>` を併記
