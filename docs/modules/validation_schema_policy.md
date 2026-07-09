# validation_schema_policy — バリデーションスキーマポリシー

```yaml
ssot_id: MOD-012
title: バリデーションスキーマポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.1.7 §0.0.2.2(Contract-first), §0.0.3.3
depends_on:
  - packages/contracts(7fa369c)
  - docs/modules/generated_code_policy.md(MOD-014)
open_questions:
  - zod スキーマ→OpenAPI 生成の方式(Phase 1 — MOD-014 と同時確定)
  - 医療安全に関わる入力制約(用量上限等)の検証所在(算定・チェックロジックとの分担 — SaMD評価 REG-005 と連動)
blockers: []
```

## 1. 正本

- **API 契約のバリデーションスキーマは zod v4 で `@yrese/contracts` に置く。これが単一の正本**(実装済み: healthResponseSchema、z.iso.datetime() 使用)
- backend(apps/api)は contracts のスキーマを import して parse する(実装済み)。frontend は同スキーマ由来の型を使い、**契約に存在しないフィールドを仮定しない**(v0.1.7 §0.0.2.2)
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
- エラーメッセージに PHI を含めない(検証失敗ログも同様 — SEC-004)
- 医療安全・請求安全に関わる状態・エラーコードの検証は shared-kernel の registry 型(MOD-005/006)を参照し、zod enum への値の複製をしない(単一ソース化: `z.enum(SYSTEM_MODES)` のように const 配列を直接渡す)

## 4. テスト

- 契約スキーマには accept/reject 双方のテストを必須とする(実装済み先例: health.test.ts — 正常受理/欠落拒否/リテラル不一致拒否)
- 契約変更時は frontend/backend 双方のテスト実行を WP の DoD に含める(contract drift は将来 CI 検査 — MOD-014)
