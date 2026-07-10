# date_time_policy — 日付・時刻ポリシー

```yaml
ssot_id: MOD-011
title: 日付・時刻ポリシー
domain: modules
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-10
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §3(処方日・調剤日・受付日・請求月・マスター版の明示), §18, §0.0.3.3
depends_on:
  - packages/date-time(ab234fe)
  - packages/events(85bd3aa — wallClock)
impacts:
  - packages/date-time
  - packages/events wallClock/instant boundary
  - apps/api reception business-date derivation
  - apps/web reception date/time presentation
related_work_packages:
  - WP-0012
  - WP-4053
  - WP-9002-W2
related_tests:
  - packages/date-time/src/date-time.test.ts
  - apps/api/src/server.test.ts
  - apps/api/src/db/postgres-repositories.integration.test.ts
  - apps/web/app/reception-dashboard.test.tsx
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-10 WP-9002-W2 metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - 深夜営業(日付跨ぎ)時の受付日確定ルール(薬局実務レビュー)
  - 請求月の締め境界(月末調剤・月初請求の当時有効版選択)— REG-002 の当時有効版ルールと統合
  - 和暦表示の要否と変換層(帳票要件確定時)
blockers: []
```

## 1. 基本方針

- **診療系日付は wall-clock date semantics**(壁時計上の暦日)として扱う。正本実装は `@yrese/date-time` — CalendarDate は 'YYYY-MM-DD' または {year,month,day} からのみ構築し、実カレンダー検証(うるう年含む)を行う
- **`@yrese/date-time` はタイムゾーン変換を行わない**。日本の薬局業務の暦日は JST の壁時計を前提とし、UTC 変換を挟まない(変換により暦日がずれる事故を構造的に防ぐ)
- **現在時刻への暗黙依存禁止**(v0.2.0 §18): Date.now() / new Date() を既定値として使う API を共通モジュールに置かない。「今日」を必要とする層(UI・受付処理)が明示的に値を注入する
- **業務日付は薬局ロケールの暦日として扱う**。MVP では薬局ロケールを `Asia/Tokyo` 固定とし、instant から受付日等の業務日付を導出する場合は JST の暦日を使う。`toISOString().slice(0, 10)` 等の UTC 日付を業務日付へ流用してはならない

## 2. 診療系日付型の使い分け

| 型 | 用途 |
|---|---|
| PrescriptionDate(処方日) | 処方箋の交付日。適用ルール版選択の入力 |
| DispensingDate(調剤日) | 調剤を行った日。算定の基準日 |
| ReceptionDate(受付日) | 薬局での受付日 |
| ClaimMonth(請求月) | 'YYYY-MM'。月次締め・レセプト単位。next()/prev() で連続処理 |

算定関数(@yrese/calculation)はこれら+masterVersion+calculationRuleVersion を**明示入力**として受け取る(同一入力→同一出力の決定性、実装・テスト済み)。処方日・調剤日・請求月に対応する「当時有効版」の選択は MST-001 / REG-002 のルールに従う。

## 3. 機械時刻(タイムスタンプ)との分離

- イベント・監査の時刻は `@yrese/events` の wallClock(タイムゾーン付き ISO instant、呼び出し側供給)+ logicalClock / sequenceNumber で扱う。**診療系日付(暦日)と機械時刻(instant)を型で分離**し、相互の暗黙変換をしない
- clock drift は RECOVERY_SYNC(ARC-002 R1)で検証する。Edge/端末の時刻ずれを暦日確定に直接使わない

## 4. タイムゾーン変換を行う層

- UI 表示・API 入出力で instant→JST 暦日の変換が必要になる場合、変換は **apps 層(UI/API境界)に限定**し、共通モジュールへ持ち込まない。MVP では `Asia/Tokyo` 固定、DST なしとして扱う。変換ヘルパーを共通化する場合は本SSOTを再改版し、変換規約と所有境界を明記してから実装する
- サーバ・DB・Edge の内部タイムスタンプは UTC instant で保持し、診療系暦日フィールドとは別カラム・別型で持つ(Phase 1 data_model で確定)

## 変更履歴

- 0.1.1 (2026-07-09): WP-4053 — 業務日付は薬局ロケール(MVPではAsia/Tokyo固定)の暦日とし、UTC日付の流用禁止を明記。
- 0.1.0 (2026-07-09): 初版承認。
