# ui-ux-refresh — 全画面 UI/UX 監査・SSOT 再構築・実装・検証ワークスペース

このディレクトリは、本システム(調剤用レセプトコンピューター MVP)の全画面 UI/UX 監査、患者安全リスク分析、
デザイン SSOT 再構築、共通基盤からの実装、検証証跡を **追跡可能** に残すための作業領域である。

## 重要: 重複させない方針

本システムには既に規範 SSOT が存在する。**新しい重複文書を作らず、既存 SSOT を正本として参照する。**
本ディレクトリの文書は「監査・分析・証跡」を担い、確定した規範は既存 SSOT 側へ反映する。

| 領域 | 既存の正本(Normative SSOT) |
| --- | --- |
| 医療 UI 原則 | `docs/uiux/medical_ui_ux_principles.md` |
| 体験品質ベースライン | `docs/uiux/experience_quality_baseline.md` |
| 業務導線マップ | `docs/uiux/workflow_map.md` |
| 画面台帳(ドラフト) | `docs/uiux/screen_inventory_draft.md` |
| 性能予算 | `docs/uiux/performance_budget.md` |
| 安定性 SLO | `docs/uiux/stability_slo_policy.md` |
| ユーザビリティ受入基準 | `docs/uiux/usability_acceptance_criteria.md` |
| 状態(ドメイン) | `packages/shared-kernel/src/{status,system-mode,blockers,permissions}.ts` |
| 状態(表示文言) | `apps/web/app/components/patient-header.tsx`(ELIGIBILITY_LABELS)、`apps/web/app/system-mode-badge.tsx`(MODE_LABELS) |
| デザイントークン | `apps/web/app/globals.css`(`:root` CSS custom properties) |

## 文書構成

| ファイル | 役割 | Phase |
| --- | --- | --- |
| `PROGRESS.md` | フェーズ×タスクの進捗・証跡台帳 | 全 |
| `00-repository-baseline.md` | 実スタック・アーキ・状態管理・テスト/build 基準 | 0 |
| `01-scope-and-users.md` | 対象業務・ロール・患者安全高リスク操作 | 1 |
| `02-compliance-applicability.md` | ガイドライン適用性・トレーサビリティ | 1 |
| `03-external-benchmark.md` | 公開情報ベースの競合研究 | 2 |
| `04-screen-and-state-inventory.md` | 全ルート・全状態・全導線棚卸し | 3 |
| `05-state-ownership.md` | UI 状態の所有権整理 | 4 |
| `06-ui-ux-audit.md` | UI/UX 監査 + 患者安全リスク分析 | 5 |
| `07-use-error-risk-register.md` | 使用エラーリスク登録簿 | 5 |
| `08-target-design-direction.md` | 目標デザイン方針・視覚的状態言語 | 6 |
| `09-implementation-plan.md` | 実装順序・vertical slice | 7-8 |
| `10-verification-evidence.md` | 検証コマンド・結果・証跡 | 9 |
| `11-remaining-risks.md` | 未解決リスク・専門家レビュー要 | 全 |

## 実行原則(このタスク固有)

- 想定スタック一覧(Next.js 16 / Prisma / TanStack / Zustand / NextAuth-Cognito / Serwist 等)は
  **本リポジトリの実体ではない**。実装は `00-repository-baseline.md` の実スタックに接地する。
- Phase 6 までは監査・研究・計画の文書のみ。プロダクトコードは Phase 7 以降で変更する。
- 実施していない専門家レビュー・ユーザテストを実施済みと記載しない(`Not executed` を明示)。
