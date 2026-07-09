# validation_schema_policy — バリデーションスキーマポリシー

```yaml
ssot_id: MOD-012
title: バリデーションスキーマポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.3
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
change_log:
  - 0.1.3 (2026-07-09): WP-4046 — `@yrese/contracts` の ID wire field(patient/search、whoami、reception queue)を shared-kernel branded ID factory 由来の共通 refine へ統一。wire 型は string 維持。
  - 0.1.2 (2026-07-09): WP-4049 実装状態 drift 整備。`@yrese/contracts` の受付キュー契約(API-006 / WP-3009-BE/93aefa1)と現行 contract test 数を反映(検証分担・規約は不変更)。
  - 0.1.1 (2026-07-09): WP-4043 実装状態 drift 整備。`@yrese/contracts` の実装済み契約(health/error/patients/search/whoami)と OpenAPI drift 検査実装を現行状態へ同期(検証分担・規約は不変更)。
source_refs:
  - 構築プロンプト v0.2.0 §0.0.2.2(Contract-first), §0.0.3.3
depends_on:
  - packages/contracts(WP-1007/7fa369c, WP-2008+2005/bb3d237, WP-4019/3dd1daa, WP-4042/1b1bff5, WP-3009-BE/93aefa1)
  - docs/modules/generated_code_policy.md(MOD-014)
open_questions:
  - 医療安全に関わる入力制約(用量上限等)の検証所在(算定・チェックロジックとの分担 — SaMD評価 REG-005 と連動)
blockers: []
```

## 1. 正本

- **API 契約のバリデーションスキーマは zod v4 で `@yrese/contracts` に置く。これが単一の正本**(実装済み: health / error / patients/search / whoami / reception queue。OpenAPI生成は MOD-014)
- backend(apps/api)は contracts のスキーマを import して parse する(実装済み)。frontend は同スキーマ由来の型を使い、**契約に存在しないフィールドを仮定しない**(v0.2.0 §0.0.2.2)
- 契約変更は `CONTRACT_CHANGE_REQUEST` → fable5 → contracts 更新 → 両側追随(agmsg 合意のみでの変更禁止)

## 2. 三層の分担

| 層 | 所在 | 責務 | 禁止 |
|---|---|---|---|
| 契約検証(構造) | @yrese/contracts(zod) | API入出力の構造・型・形式 | UI都合のフィールド追加 |
| ドメイン不変条件 | 各共通モジュール/将来 packages/domain | branded ID 検証、PHI暗号化不変条件、evidence 必須、isClaimable 等(実装済みの実行時強制) | zod への重複実装(二重定義) |
| UI表示用検証 | apps/web(フォーム) | 入力途中の即時フィードバック、文言、フォーカス誘導 | **UIだけの制御**(API側検証の省略)、契約と異なる制約の独自追加 |

UI検証は契約検証の**部分集合または同等**でなければならない(UIが通してAPIが拒否する不一致は許容されるが、逆は契約違反)。制約を強めたい場合は CONTRACT_CHANGE_REQUEST で契約側を更新する。

## 3. 規約

- zod v4 の記法を正とする(z.iso.datetime() 等 — 旧 z.string().datetime() は使わない。WP-1007 で移行済み)
- スキーマからの型導出は z.infer を用い、手書きの重複 interface を作らない
- API wire の ID field は原則として素の string を維持する。ただし契約層で shared-kernel の branded ID factory 由来 refine を再利用し、非空・空白のみ拒否・制御文字拒否・最大128文字を fail-closed に拒否する(WP-4046)。contracts ローカルに制御文字正規表現等の ID 規則を再発明しない。
- エラーメッセージに PHI を含めない(検証失敗ログも同様 — SEC-004)
- 医療安全・請求安全に関わる状態・エラーコードの検証は shared-kernel の registry 型(MOD-005/006)を参照し、zod enum への値の複製をしない(単一ソース化: `z.enum(SYSTEM_MODES)` のように const 配列を直接渡す)

## 4. テスト

- 契約スキーマには accept/reject 双方のテストを必須とする(実装済み先例: health/error/patient-search/whoami/reception-queue 各テスト、現行66 tests)
- 契約変更時は frontend/backend 双方のテスト実行を WP の DoD に含める(OpenAPI drift は `pnpm check:openapi` で検査 — MOD-014/WP-4019)
