# nsips_quarantine_architecture — NSIPS 境界隔離アーキテクチャ

```yaml
ssot_id: ARC-003
title: NSIPS 境界隔離(Anti-Corruption Layer)アーキテクチャ
domain: architecture
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-11
effective_from: null
effective_to: null
source_refs: [構築プロンプト v0.2.0 §5・§6・§28, PRD-006 柱1, PRD-008 D5, PRD-009 戦い1]
depends_on: []
impacts: [ARC-004, WP-0042 FHIR canonical, packages/shared-kernel(LEGACY_DEPENDENCY), Integration Hub SSOT]
related_work_packages: [WP-0041, WP-9002-W5B]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5B metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - LEGACY_DEPENDENCY marker implementation form is deferred to the Adapter implementation WP
blockers:
  - BLOCKED_NSIPS_LICENSE
```

v0.2.0 §6「NSIPS境界隔離」を実装可能なアーキテクチャ方針として確定する。
本書は境界と方針のみを定め、NSIPS 仕様の具体的内容(レコード形式・項目定義等)は
記載しない(許諾上の清潔さを守るため、許諾取得後も本書には転載しない)。

## 基本姿勢

NSIPS は攻撃も無断模倣もしない。ただし yrese のコア設計に浸食させない。
NSIPS は互換性確保の翻訳機であり、yrese の進化速度を縛らせない。

## 境界構造

```
[NSIPS対応機器・システム] ⇄ [NSIPS Legacy Adapter(境界アダプタ層 = ACL)] ⇄ [yrese コア]
                                     ↑ここで正規化・検証・監査・変換・ステータス付与
```

- NSIPS Legacy Adapter は DDD の Anti-Corruption Layer として扱い、境界アダプタ層に閉じ込める。
- コアは FHIR/JP Core Ready な Canonical Clinical/Dispensing Model(WP-0042 で確定)で設計する。
- コアのイベント・API・算定・請求・監査ログは NSIPS 仕様に依存しない。

## 禁止事項(停止条件に連動)

1. **概念浸食の禁止**: NSIPS 由来の CSV・共有フォルダ・ファイル連携・レガシー状態表現を内部モデルへ持ち込まない。NSIPS の概念が Canonical Model へ浸食していれば停止(v0.2.0 §28)。
2. **コアロジック化の禁止**: NSIPS ファイル連携をコアロジックとして扱えば停止(同上)。
3. **推測互換の禁止**: NSIPS 仕様を知らない状態で互換実装を推測しない。仕様本文の無許諾複製・模倣・再配布をしない。
4. **情報境界**: NSIPS 仕様本文を agmsg・Codex・公開文書へ渡さない(v0.2.0 §16・§26)。

## ライセンスゲート(fail-closed)

- NSIPS 正規許諾が未取得の間、NSIPS Legacy Adapter に関わる一切の実装 WP は
  `BLOCKED_NSIPS_LICENSE`(packages/shared-kernel BLOCKER_TYPES 定義済み)で停止する。
- 許諾取得は人間(ユーザー)のみが実行できる前提条件であり、fable5 / codex は代行しない。
- 許諾取得後も、Adapter の提供範囲は単一薬局内連動に限定する(PRD-006 柱1)。

## 通過条件(NSIPS 由来データがコアへ入る唯一の経路)

NSIPS 由来データは以下を**すべて**通過してからコアへ入れる:

1. 正規化(Canonical Model への変換 — マッピングは WP-0042 の fhir_mapping_registry で管理)
2. 検証(スキーマ・整合性。失敗は fail-closed で PENDING/BLOCKED)
3. 監査(変換の入出力を audit イベントとして記録。PHI 分類の暗号化必須が適用される)
4. ステータス付与(未検証データが検証済みと同格に流れない)

## LEGACY_DEPENDENCY 追跡

- NSIPS 依存機能には `LEGACY_DEPENDENCY` マーカーを付与し、将来移行候補として追跡する。
- マーカーの実装形態(コード注釈 / registry)は Adapter 実装 WP の設計時に確定する。

## 変更履歴

- 0.1.0 (2026-07-09): WP-0041 により起案(PROPOSED)。
