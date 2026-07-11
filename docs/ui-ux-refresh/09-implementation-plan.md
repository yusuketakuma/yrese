# 09 — Implementation Plan (Phase 7-8)

§08 の設計に基づく実装順序。**本タスクで実施した範囲**と**残り**を区別する。

## 実装順序(§13.1 を実在スタックへ接地)

| # | 項目 | 本タスク | 対応 |
| --- | --- | --- | --- |
| 1 | Semantic tokens(attention 追加) | ✅ | globals.css `--color-status-attention-bg` |
| 2 | 基盤スタイル(shape / forced-colors / reduced-motion) | ✅ | globals.css |
| 3 | Visual Status Registry(状態→表示の単一正本) | ✅ | `app/status/visual-status-registry.ts` |
| 4 | 既存ラベルマップの集約(de-dup A-02) | ✅ | system-mode-badge / patient-header / reception-dashboard / severity-list |
| 5 | 状態バッジ(Registry 駆動・安全 variant) | ✅ | `app/components/domain-status-badge.tsx` |
| 6 | ModeCapabilityView の仮状態ラベル化 | ✅ | mode-capability-view.tsx |
| 7 | Registry テスト(網羅・直交・a11y) | ✅ | visual-status-registry.test.tsx(8件) |
| 7b | Registry 実画面ロールアウト(受付キュー状態セル) | ✅ | reception-dashboard.tsx → DomainStatusBadge(A-01 採用) |
| 9 | 横断状態ファイル(not-found/global-error/loading, S-01) | ✅ | loading.tsx / not-found.tsx / global-error.tsx + cross-cutting-state.test.tsx(3件) |
| 9b | 資格確認に冗長 shape(A-03 を全状態族へ展開) | ✅ | patient-header / patient-search + registry |
| 9c | テーブル横スクロール対応(L-02 一部) | ✅ | `.table-scroll`(受付/患者検索) |
| 9d | 一覧の最終取得時刻(S-02 鮮度) | ✅ | reception-dashboard(loadedAt) |
| 10 | URL 状態化(S-03、**日付のみ・PHI除外**) | ✅ | reception `?date=`(parseDateParam)。検索クエリは PHI のため URL 非永続 |
| 8 | 患者文脈横断固定(L-01) | ⏳ 残(業務導線=患者選択→get-by-id API 前提) | R-PATCTX |
| 11 | RecordLifecycle 軸C / PrescriptionChange 軸B(ドメイン enum SSOT 承認後) | ⏳ 残 | R-RECLIFE |
| 12 | 認証・オフライン・ファイル・臨床アラート | ⏳ 残 | R-AUTH/R-OFFLINE/R-CLINALERT |

## Vertical slice の選定(§13.1)

新 SSOT を最初に検証する代表スライスとして「**状態表現の共通層**」を選んだ。理由:
- 監査 P1 所見(A-01/A-02/A-03)の**根本原因(状態表現の単一正本欠如)**を一挙に解消する。
- 実在する2実装画面(受付・患者検索)と横断部品(SystemModeBadge/PatientHeader/SeverityList/ModeCapabilityView)が
  すべてこの層に依存しており、波及効果が最大。
- 新規依存を導入せず(禁止事項遵守)、既存の型安全 SSOT 文化(literal-union + Record 網羅)に自然に接地する。
- 既存99テストに回帰を出さずに導入可能(実際に回帰0で達成)。

業務画面(処方入力・調剤・算定・薬剤師確認等)の本実装は、対応するドメイン enum・API 契約・医療安全レビューが
前提のため本スライスの対象外とし、設計(§08)と残存リスク(§11)へ申し送る(捏造実装をしない)。

## 実装の設計判断(なぜこうしたか)

- **可視ラベルは web 層所有**(shared-kernel に置かない): error-codes.ts の「表示文言は UI 側所有」に従う。
- **discriminated union(StatusQuery)**: ドメインとキーの不正な組合せを型で表現しにくくする(§11.5/§13.4)。
- **shape は aria-hidden**: 支援技術には label(意味の主担)を読ませ、shape は視覚的冗長のみ(§11.4-3)。
- **StatusBadge は非破壊**: 自由 label+tone の従来 API を残し(既存テスト保護)、安全な `DomainStatusBadge` を追加。
