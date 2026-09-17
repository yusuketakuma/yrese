# migration 環境適用 runbook(WP-7102 / C-058 apply gate 実行仕様)

status: DRAFT — 手順の確定のみ。**本記録の存在はいかなる環境への適用を許可しない。**
created: 2026-09-18
scope: yrese API の PostgreSQL migration(000001 以降の全版)の環境適用

---

## 0. 前提と禁止事項

- migration/DDL/DML 適用、production/staging データ・インフラの変更は
  **明示 human gate**(AGENTS.md §Risk and Human gates / PRC-005)。
  本 runbook の実行は対象環境ごとの別途承認が必須。
- 本タスク(WP-7102)では**いかなる環境へも適用しない**。staging/production
  への適用・backfill・deploy は本 runbook 外の人間判断。
- dev 環境(`yrese_dev`)への適用は開発用途として既に随時実施済み
  (runner 管理)。本 runbook は staging/production 等の**永続環境**を対象とする。

## 1. 対象環境の列挙(実行時に確定)

| 環境 | DATABASE_URL 供給元 | 状態 | 備考 |
|---|---|---|---|
| dev(`yrese_dev`) | ローカル | 随時適用済み | 管理外 — runner で随時適用 |
| staging | 未整備(環境未定義) | 未適用 | 環境構築は別 WP |
| production | 未整備(環境未定義) | 未適用 | 同上 |

環境が未定義のまま適用経路を作らない。staging/production のプロビジョニングは
本 runbook 適用の前提条件として別タスクで確立する。

## 2. 適用手順(環境ごと)

前提: 対象環境の `DATABASE_URL` は secrets manager / 1Password 等の
**Git 外の経路**から取得し、コマンドライン・シェル履歴・ログへ残さない
(`env` 変数として直接渡す。`.env` ファイルへの書出し禁止)。

1. **preflight**: `cd apps/api && DATABASE_URL=<env> pnpm db:check`
   - 期待出力: 適用済み版の一覧と「pending: 000xxx…」の差分。
   - `db:check` がエラー(checksum 不一致・不明な手動変更)を返した場合は
     **適用中止**。§4 の失敗処理へ。
2. **適用**: `DATABASE_URL=<env> pnpm db:migrate`
   - runner は pending 版を版順に単一ずつ適用し、checksum 記録を残す。
   - 適用順はファイル名順(000001→…→最新)。途中失敗はその版で停止し、
     それ以前の版は確定済み、以降は未適用のまま残る(forward-fix)。
3. **事後確認**: 再度 `pnpm db:check` — `up_to_date` を確認。
4. **記録**: §5 の運用記録へ追記。

## 3. synthetic master seed(000018 以降のみ)

master 基盤(000018)適用後、synthetic fixture が必要な環境では:

```
DATABASE_URL=<env> \
YRESE_MASTER_SEED_TENANT_ID=<scope tenant> \
YRESE_MASTER_SEED_PHARMACY_ID=<scope pharmacy> \
pnpm db:seed-masters
```

- 冪等(既存 version/localCode は skip)。再実行可。
- synthetic 行のみ。実マスターデータの取込は RB-009 で禁止のまま。
- 監査対象外(MST-003 §5 — fixture のため)。staging での seed 有無は
  環境ポリシー決定事項(未確定 — 適用時に判断)。

## 4. 失敗時の対処(forward-fix 方針)

- **rollback を行わない**。失敗した版を特定し、原因を修正した**新規版**
  (forward-fix migration)を追加して適用を再開する。
- 適用途中の版は runner が tx で巻き戻す(部分適用の残留はない想定だが、
  tx 外 DDL を含む版が失敗した場合は手動で残骸を確認・記録した上で
  forward-fix 版に含める)。
- checksum 不一致(適用済み版とファイル内容の不一致)は**歴史改竄**を意味する。
  ファイルを書き戻さず、不一致の経緯を運用記録に残して調査する。

## 5. 適用記録の置き場

- 適用実績(日時・環境・適用版・実施者・結果・障害記録)は
  **Git 外の運用記録**(運用 log / 課題管理 / 共有 doc)へ残す。
  repository 内に環境 URL・接続情報・適用履歴を commit しない。
- runner の `schema_migrations` テーブル自体が DB 内の正規履歴
  (version・applied_by・applied_at・checksum)。

## 6. 未解決事項

- staging/production 環境そのもののプロビジョニング(別タスク)。
- 環境ごとの `YRESE_MASTER_SEED_*` scope 方針。
- C-058 apply gate の承認記録様式(誰が・どこへ承認を記録するか)。
