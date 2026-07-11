# 05 — State Ownership and Data Freshness (Phase 4)

**実装実状に接地**: 本リポジトリに TanStack Query / Zustand / React Hook Form は存在しない。
状態管理は「Server Components(shell)+ Client Components 内の `useState`/`useRef` + 自作 transport + zod 検証」で構成される。
プロンプト §9 のフレームワーク前提はそのまま適用できないため、実在する所有形態のみ記載する。

## 1. 実在する状態カテゴリと所有者

| カテゴリ | 実装での所有 | 具体 |
| --- | --- | --- |
| Server-rendered | RSC(`layout.tsx`, 各 `page.tsx`) | shell・見出し・placeholder。データ取得はまだ RSC 側に無い |
| Client server-state | **各 Client Component の `useState` + 自作 fetch**(TanStack 無し) | `SearchState` / `QueueState`(discriminated union: idle/loading/error/loaded) |
| 契約検証 | `@yrese/contracts` の zod schema | `patientSearchResponseSchema.parse` / `receptionQueueResponseSchema.parse`(クライアントでも契約ドリフト検知) |
| URL state | **ほぼ未使用** | searchParams による検索語/日付/cursor の共有・復元は未実装 |
| Form state | 素の `useState`(RHF 無し) | 検索語 `q`、受付日付 `date`、患者ID `registerPatientId`、`submitting` フラグ |
| Global ephemeral UI | **無し**(グローバルストア無し) | SystemModeBadge は現状 props 既定 NORMAL 固定 |
| Offline state | **ドメインモデル(system-mode)として設計**、クライアント永続層は未実装 | LOCAL_ONLY / RECOVERY_SYNC / PENDING_* / CONFLICT。SW/IndexedDB 等の実体はまだ無い |

## 2. State Ownership Map(主要状態)

| State | Current owner | Intended owner | URL 共有 | サーバ同期 | Freshness | 競合 | Recovery | 監査 | UI 表現 | Test |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 患者検索クエリ `q` | `PatientSearch` useState | **URL searchParams 化推奨**(共有・戻る/再現) | ✗(要改善) | 読取 no-store | 都度取得 | — | — | — | patient-search.test | 
| 検索結果 + cursor | `SearchState.loaded` | 同左(短命でよい) | ✗ | no-store | 都度 | — | stale-response guard(generation) ● | — | 一覧表示 | ● |
| 受付表示日付 `date` | `ReceptionDashboard` useState(JST 既定) | **URL searchParams 化推奨** | ✗(要改善) | — | — | — | — | — | date input | reception-dashboard.test |
| 受付キュー | `QueueState` | 同左 | ✗ | no-store | 明示「表示」操作で更新 | — | generation guard ● | サーバ | table | ● |
| 受付登録(冪等) | createReception + idempotencyKey | 同左 | — | POST | — | 409(二重操作)明示 ● | 一覧再取得 | サーバ | role=status | ● |
| システムモード | props 既定 NORMAL(固定) | **モード検知バックエンド**(未実装) | — | 将来 | 常時可視必須(P-03) | — | — | 監査対象 | SystemModeBadge | ● |
| 資格確認状態 | contracts 由来 → PatientHeader/検索 | サーバ(オン資) | — | 将来 | 最終確認日時併記 ● | — | 再確認導線(未) | 監査 | ラベル必須 ● | ● |

## 3. 検出した所有権上の懸念(§9.2 チェックに対する実測)

| 懸念(§9.2) | 実測結果 |
| --- | --- |
| Query data の Zustand 複製 | **該当なし**(Zustand 不在)。良好 |
| URL に出すべき filter/pagination のローカル閉じ込め | ⚠️ **該当**: 患者検索語・受付日付・cursor が useState のみ。ブラウザ戻る/URL共有/リロードで失われる → 改善候補(P1) |
| RHF と Zustand のフォーム値重複 | 該当なし(両者不在) |
| Server Component と Query cache 不整合 | 該当なし(まだ RSC データ取得無し) |
| ローカル保存とサーバ保存の混同 | 現状クライアント永続層が無いため未発生。ただし将来 LOCAL_ONLY 実装時の**最大リスク**(§07 リスク登録簿参照) |
| stale data を最新と見せる UI | ⚠️ 受付キューは「明示表示操作でのみ更新」。最終取得時刻の可視化が無く、古い一覧を最新と誤認しうる → 改善候補(P2) |
| 競合時の静かな上書き | 設計上 CONFLICT_REQUIRES_HUMAN_REVIEW で自動補正禁止 ●。画面未実装 |
| logout 後に残る患者/認証/キャッシュ | 認証未実装のため未発生。将来設計必須(§07) |
| 患者切替後に残る前患者状態 | ⚠️ 「患者選択→患者文脈確定」の結線が未実装。実装時に**前患者の検索状態/フォームを確実に破棄**する設計が必要(§07 H-06) |

## 4. 方針(Phase 7/8 への申し送り)

1. **フレームワークを増やさない**。URL 状態化は Next.js の `useSearchParams`/`router` で実現(新規依存不要)。
2. 検索語・日付・cursor・タブ等「共有・復元すべき状態」は URL(searchParams)へ。一時 UI 状態は useState のまま。
3. `stale`/`last-updated` を受付キュー等に導入(P-02「外部確認未完了の可視化」と整合)。
4. 患者切替時の状態破棄は、患者文脈結線を実装する WP で**必須の受入基準**にする。
