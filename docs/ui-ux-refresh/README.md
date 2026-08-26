# ui-ux-refresh — 全画面 UI/UX 監査・SSOT 再構築・実装・検証ワークスペース

このディレクトリは、本システム(調剤用レセプトコンピューター MVP)の全画面 UI/UX 監査、患者安全リスク分析、
デザイン SSOT 再構築、共通基盤からの実装、検証証跡を **追跡可能** に残すための作業領域である。

## Candidate A finalization status(2026-08-26)

direct user instructionでCandidate Aを選択した。review targetは
`docs/uiux/medical_ui_ux_principles.md`のUIX-001 v0.2.0 APPROVED foundationであり、
UIX-002〜007と13号の必要内容を一つのfoundationへ集約する。UIX-008は作成しない。

direct user instructionは、この限定foundation昇格に必要な観点を最終承認した。UIX-002〜007は
UIX-001 §§7〜12へSUPERSEDEDとして統合し、indexとdirect live referencesを同一batchで更新する。
本directoryは引き続きnon-SSOTである。記載済みの未決事項、UNMAPPED、HPKI/legal、RB-003、
未決領域の実装、risk acceptance、external actionは各該当gateに残る。

## 重要: 重複させない方針

本システムには既に規範 SSOT が存在する。**新しい重複文書を作らず、既存 SSOT を正本として参照する。**
本ディレクトリの文書は「監査・分析・証跡」を担い、確定した規範は既存 SSOT 側へ反映する。

| 領域 | 既存の正本(Normative SSOT) |
| --- | --- |
| 医療 UI 原則 | `docs/uiux/medical_ui_ux_principles.md` |
| 体験品質・性能・受入・安定性・導線・画面台帳 | `docs/uiux/medical_ui_ux_principles.md` §§7〜12 |
| 状態(ドメイン) | `packages/shared-kernel/src/{status,system-mode,blockers,permissions}.ts` |
| 状態(表示文言) | `apps/web/app/status/visual-status-registry.ts`。`ELIGIBILITY_LABELS` / `MODE_LABELS`はRegistryを再exportする互換consumer |
| デザイントークン | current declaration anchorは`apps/web/app/globals.css`(`:root` CSS custom properties)。complete L0 authorityはCandidate Aのreconciliation gate待ち |

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
| `12-component-contracts.md` | component契約の統合元(provenance。final authorityではない) | SSOT review |
| `13-ui-component-system-ssot-draft.md` | Candidate Aのcomponent統合元・preservation matrix | SSOT review |
| `14-one-board-direction-decision.md` | 丁「一枚盤面」の選択記録と未決gate | design source |
| `15-workflow-stage-enum-ssot-draft.md` | workflow-stage候補。承認前は実装根拠禁止 | domain source |
| `16-primary-user-research.md` | 主操作者・role仮説の調査記録 | research |
| `17-adversarial-review-and-new-requirements.md` | 14〜16号の反例・追加要求 | review evidence |

12〜17号はすべてnon-SSOTのsource/evidenceである。binding requirementはCandidate AのUIX-001
PROPOSED revisionへ統合し、これらを別authorityとして参照したままfinalizeしない。

## 実行原則(このタスク固有)

- 想定スタック一覧(Next.js 16 / Prisma / TanStack / Zustand / NextAuth-Cognito / Serwist 等)は
  **本リポジトリの実体ではない**。実装は `00-repository-baseline.md` の実スタックに接地する。
- Phase 6 までは監査・研究・計画の文書のみ。プロダクトコードは Phase 7 以降で変更する。
- 実施していない専門家レビュー・ユーザテストを実施済みと記載しない(`Not executed` を明示)。
