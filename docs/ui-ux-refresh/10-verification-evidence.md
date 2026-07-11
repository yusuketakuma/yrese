# 10 — Verification and Validation Evidence (Phase 9)

プロジェクト固有コマンド(package.json scripts)を用いた実測。実行日: 2026-07-11 / ブランチ: main。

## 1. Automated Verification(実行コマンドと結果)

### 1.1 第1次実装(Visual Status Registry 共通層)後

| 検証 | コマンド | 結果 | 備考 |
| --- | --- | --- | --- |
| Unit/Component tests(実装前ベースライン) | `pnpm --filter @yrese/web test` | ✅ 9 files / **99 tests pass**(738ms) | 変更前の基準値 |
| Unit/Component tests(第1次実装後) | `pnpm --filter @yrese/web test` | ✅ 11 files / **120 tests pass** | 既存99 + Registry8 + 横断状態3 + a11y/鮮度/URL/responsive 5 + R-PATCTX 5。**回帰ゼロ** |

### 1.2 第2次実装(残タスク全実装 — 2026-07-11、人間承認により実装レーン拡大)後

| 検証 | コマンド | 結果 | 備考 |
| --- | --- | --- | --- |
| Web Unit/Component tests | `pnpm --filter @yrese/web test` | ✅ 19 files / **171 tests pass** | 120 → 171(+51)。RecordState/PrescriptionChange 7、ClinicalAlert 10、Sync/Offline 9、Auth/Session 7、Dialog 4、FileUpload 3、Audit/Permission 8、PatientContext 3。**回帰ゼロ** |
| shared-kernel tests | `pnpm --filter @yrese/shared-kernel test` | ✅ 2 files / **36 tests pass** | 23 → 36(+13)。新5 enum の guard/helper を網羅 |
| リポジトリ全パッケージ | `pnpm -r --parallel test` | ✅ **全パッケージ pass**(audit182/calc20/contracts86/date-time8/events45/money15/trace37/shared-kernel36/web171/api161·9skip) | 回帰ゼロ |
| Typecheck(全パッケージ) | `pnpm -r --parallel typecheck` | ✅ **TYPECHECK_EXIT=0** | 新5軸の Record<Enum,…> 網羅性を型で担保 |
| Module boundaries | `node scripts/check-boundaries.mjs` | ✅ **Boundary check passed** | 新規 import が境界規則に違反しない |
| Dependency audit | `node scripts/check-deps.mjs` | ✅ **passed(high=0, critical=0)** | 新規依存を追加していない(依存軽量スタック維持) |
| SSOT index | `node scripts/check-ssot-index.mjs` | ✅ **passed(173 docs)** | |
| Production build | `pnpm --filter @yrese/web build` | ✅ **Compiled successfully / 12/12 static pages** | Next.js 15。回帰なし |
| Lint | `pnpm -r --if-present lint` | ⚠️ web に lint script 無し(no-op) | ESLint 個別設定は未整備(既存状況) |

**第2次実装の到達点と限界(正直な明示)**: 追加した shared-kernel enum(record-lifecycle/clinical-alert/sync-status/
prescription-change/session)・Registry 5軸・コンポーネント11種は **UI/ドメイン/表示層** として実装・テスト済み。
**判定ロジック・実データ配線・医療安全/セキュリティ/薬機法(SaMD)レビュー・実薬剤師テストは実装とは独立に依然必要**
(§11)。これらを実施済みと記載しない。

**未実行(理由付き)**:
- E2E(Playwright): **未導入**(依存に無し)。導入是非は別途判断(§00 §1)。捏造しない。
- standalone output 検証: `next.config.ts` に `output:"standalone"` 未設定のため対象外(§00 §7)。

## 2. 実装によるテスト追加内容(`visual-status-registry.test.tsx` 8件)

- 全 shared-kernel enum 値(severity/system-mode/eligibility/reception/provisional)の**網羅性**。
- **色/形状だけで意味を担わない**: 全エントリが非空 label と shape を持つ。
- **直交性**: `eligibility.PENDING_REVERIFY` と `provisional.PENDING_REVERIFY` のラベルが異なる。
- **de-dup(A-02)**: 既存 `MODE_LABELS`/`ELIGIBILITY_LABELS`/`RECEPTION_STATUS_LABELS` が Registry から導出。
- severity 表示順(BLOCKER→…→INFO)。
- **live region の使い分け(§11.4-18)**: CRITICAL/BLOCKER=alert/assertive、WARNING/INFO=status/polite。
- `DomainStatusBadge`: label + aria-hidden shape + data-status、CRITICAL で role=alert/aria-live=assertive。

## 3. Accessibility Verification(コード+テストで確認できた範囲)

| 項目(§14.3) | 状態 | 根拠 |
| --- | --- | --- |
| 色を除いても状態が分かる | ✅(強化) | 全状態に label 必須 + shape 冗長エンコード(registry test) |
| アイコンを隠しても短いラベルで分かる | ✅ | shape は `aria-hidden`、意味は label(DomainStatusBadge/severity-list) |
| グレースケール/forced-colors で判別 | ✅(追加) | `@media (forced-colors: active)` で境界・focus 明示(globals.css) |
| reduced-motion | ✅(追加) | `@media (prefers-reduced-motion: reduce)`(globals.css) |
| 状態変化の支援技術通知の重要度使い分け | ✅ | ariaLive を severity 別に(registry) |
| focus 可視 | ✅(既存 + 強化) | `:focus-visible` + forced-colors で Highlight outline |
| keyboard 操作 | ◐(既存) | 検索/受付は Enter 送信・autoFocus。全導線の網羅は未 |
| 200% zoom / target size 24px / screen reader 実機 | ⏳ Not executed | 実機・E2E 未実施(§11 R-RESPONSIVE / R-PHARMTEST) |

## 4. Browser / Visual Regression

- API 未接続 placeholder が多く、実ブラウザ目視は限定的。主要状態(loading/empty/error/同姓同名/モード可否/
  状態バッジ)は **RTL renderToStaticMarkup テスト(107件)** で回帰検知している(before/after は本ファイル §1 の
  99→107・回帰0 が証跡)。
- 視覚回帰スナップショット基盤(Playwright 等)は未導入。導入は今後の判断(R-CROSSSTATE/R-RESPONSIVE と併せて)。

## 5. 結論

- 本タスクで実装した共通層(Visual Status Registry + DomainStatusBadge + a11y CSS + 既存4マップの集約)は
  **test/typecheck/boundaries/deps/build すべて green**、かつ **既存99テストに回帰なし**。
- 未実装領域(認証・監査・記録ライフサイクル・臨床アラート・オフライン永続・E2E・薬剤師テスト)は
  `11-remaining-risks.md` に計上。**「完了」「準拠」を検証根拠なしに断定しない。**
