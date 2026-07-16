# 06 — UI/UX Audit and Patient Safety Risk Analysis (Phase 5)

実コード監査(2026-07-11)。既存実装は UIX-001 原則に対し**高い整合**を示すが、構造的・横断的な
ギャップが残る。各所見は実ファイル根拠付き。優先度 P0..P3(§10.1 基準)。

## 0. 良好な点(維持すべき既存の強み — 破壊しない)

- 状態は色単独禁止・テキストラベル必須が全部品で徹底(`StatusBadge`/`PatientHeader`/`SystemModeBadge`/`SeverityList`)。
- PHI を message/log/metric に出さない規律(`error.tsx`, `error-notice.tsx`, `patient-header.tsx` コメント + 実装)。
- fail-closed の可視化(同姓同名 `duplicateKanaSet` + 未読込続きの警告、`isClaimable` 空 allow-list、`ModeCapabilityView` の「未禁止≠実行許可」明示)。
- stale-response guard(`createSearchRunner`/`createReceptionQueueRunner` の generation カウンタ)。
- 冪等キー + 409「別患者での操作キー再利用」明示(二重操作/患者取り違え防止)。
- JST 業務日付規律(`todayAsIsoDate`、`toISOString` を避ける)。
- error→nextAction を型で強制(`ErrorNoticeProps` は nextAction 必須)。

## 1. 監査所見(優先度順)

### A11Y / 状態表現(横断)

| ID | 優先 | 対象 | 現状 | 期待 | 患者安全/運用影響 | 提案 | 層 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A-01 | **P1** | `StatusBadge`(status-badge.tsx) | `label`(自由文字列)+`tone`(ok/pending/blocked/neutral)を**呼び出し側が任意指定**。同一ドメイン状態に異なる label/tone を渡せる | ドメイン状態キー→label/tone/severity/aria を**中央 Registry が決定**(§11.4-6, §11.5) | 同一状態が画面ごとに違う語・色になり誤認。P-20/P-17 の一貫性が型で守られない | Visual Status Registry を新設し、`StatusBadge` にキー駆動 variant を追加 | Executable SSOT |
| A-02 | **P1** | 各ラベル写像の分散(§04 De facto) | `ELIGIBILITY_LABELS`/`MODE_LABELS`/`RECEPTION_STATUS_LABELS`/`SEVERITY_LABELS` が別ファイル所有 | 単一 Registry から導出(重複排除) | 文言のドリフト・安全含意の弱い言い換えのリスク | Registry へ集約(既存写像は Registry を参照) | Executable SSOT |
| A-03 | **P1** | `severity-list.tsx` / `error-notice.tsx` | 重要度色は `data-severity` 属性 CSS のみ。**アイコン・形状の冗長エンコードが無い**(色+テキストの2重のみ) | §11.4「色・形状・アイコン・ラベル・位置を冗長化」。CRITICAL/BLOCKER は形状も差別化 | forced-colors / グレースケール時に重要度の一目判別が弱い | Registry に shape/icon-key を持たせ、severity 行頭に形状記号(テキスト由来)を付す | Foundations+Component |
| A-04 | **P2** | `globals.css` | `prefers-reduced-motion` / `forced-colors` / high-contrast の明示対応が無い(アニメーションは元々ほぼ無いが media query 未定義) | §11.4(13,16)。forced-colors で境界・focus・状態が判別可能 | 支援技術・ハイコントラスト利用者の状態誤認 | `@media (forced-colors: active)` と `prefers-reduced-motion` ブロック追加 | Foundations |
| ~~A-05~~ | ~~P2~~ | `error-notice.tsx` の `role` | ✅ **解決(2026-07-11)** | — | Registry の `ariaRole` で重要度別に決定: CRITICAL/BLOCKER/ERROR=alert、WARNING/INFO=status(polite 含意)。警告過多を抑制。test 115 pass | Component |

### レイアウト / 患者コンテキスト

| ID | 優先 | 対象 | 現状 | 期待 | 影響 | 提案 | 層 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L-01 | **P1** | shell(`layout.tsx`) | header に SystemModeBadge は固定。**PatientHeader は shell に無く**、患者文脈のある画面での常時固定表示が結線されていない | P-09/§11.7「患者を扱う全主要画面で一貫位置に PatientHeader 固定」 | 患者切替後の文脈喪失・取り違え(U4) | 患者文脈レイアウト(route group か per-page slot)で PatientHeader を固定表示する枠を用意 | Layout |
| L-02 | **P2** | 受付キュー/検索結果テーブル | `.table-scroll`で患者識別を保持し、患者検索の選択操作は右stickyで狭幅でも到達可能。全tableのカラム優先・カード化は未実装 | §13.6 情報優先度に基づく responsive | 現場タブレットで非操作列の比較に横移動が残る | 実端末検証後に列優先/カード化を判断し、単純縮小・識別情報削除はしない | Foundations+Component |

### 横断状態の欠如

| ID | 優先 | 対象 | 現状 | 期待 | 影響 | 提案 | 層 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| S-01 | **P1** | App Router 特殊ファイル | `not-found.tsx` / `global-error.tsx` / `loading.tsx` が全ルートで無い(§04) | 例外時ほど状態明示(P-19)。共通の 404 / 致命 / 読込体験 | 未定義画面で真っ白・生スタック露出のリスク | 3ファイルを共通部品(ErrorNotice)で追加 | Page shell |
| S-02 | **P2** | stale/last-updated | 受付キューに最終取得時刻の可視化が無い | P-02 の思想(未確認の可視化)を freshness にも適用 | 古い一覧を最新と誤認 | 「最終取得 HH:MM」表示 + 手動更新導線 | Component |
| S-03 | **P2** | URL 状態 | 検索語/日付/cursor が URL 非共有(§05) | 共有・復元すべき状態は URL | 戻る/リロード/共有で作業状態喪失 | `useSearchParams` 化(新規依存不要) | Page |

## 2. Root cause 総括

- 個別画面の品質は高いが、**「状態表現の単一正本(Visual Status Registry)」という共通層が未整備**なため、
  ラベル/色/aria/形状の一貫性が「規律」に依存し「型」で守られていない(A-01/A-02/A-03 の根本原因)。
- shell が SystemMode は固定表示するが **患者文脈(PatientHeader)を横断固定していない**(L-01)。
- 横断状態(not-found/global-error/loading/stale/URL)が後回しになっている(S-01..03)。

→ Phase 7 で **Visual Status Registry**(A-01/02/03/05 を一挙に解消する共通層)を最優先実装候補とする。
そのうえで L-01/S-01 を続く共通層改善とする。個別業務画面(処方入力・調剤・算定等)は設計 SSOT 拡張に留める。

## 3. 監査の限界(正直な明示)

- 認証・オフライン永続・ファイル・レート制限・SES 導線は**実装が無い**ため、これらの UI 監査は
  「設計 SSOT に対する要求整理」に留め、実装欠陥としては報告しない(捏造しない)。
- 実ブラウザ目視は API 未接続 placeholder が多く限定的。主要状態は RTL テスト(99件)で代替検証済み。
