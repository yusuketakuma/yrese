# always_on_rececon_architecture — 24/365 常時稼働アーキテクチャ

```yaml
ssot_id: ARC-010
title: 24/365 常時稼働(always-on)アーキテクチャ方針
domain: architecture
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §13・§14・§16, PRD-006 柱3, PRD-009 戦い3]
depends_on: [ARC-001, ARC-002, OPS-005(SLA/SLO), packages/shared-kernel(system-mode)]
impacts: [ARC-011, WP-0044 event-sourcing pack, WP-2203 Integration Hub, apps/api, apps/web]
open_questions:
  - Pharmacy Edge Node の実行形態(常駐プロセス / PWA + ローカルストア / 専用機器)の確定
  - Edge ↔ Cloud の同期プロトコル詳細(EDGE_SYNC_DESIGN — 確定まで BLOCKED_EDGE_SYNC_DESIGN)
```

v0.2.0 の「24時間365日、業務を止めないレセコン」を実装可能なアーキテクチャ方針として確定する。
可用性の具体数値(SLA/SLO)は本書では定めない(OPS-005 に委譲。数値確定まで BLOCKED_PERFORMANCE_SLO)。

## 1. 基本姿勢

既存レセコンの「夜間バッチ前提・営業時間内前提・計画停止あり」を設計レベルで拒否する。
yrese は在宅・救急応需・24時間対応薬局を一級の利用者として扱い、
**「システムの都合で調剤業務が止まる時間帯」を設計上作らない**。

## 2. 構成要素と役割分担

| 構成要素 | 役割 | 停止時の影響 |
|---|---|---|
| Cloud Core | 正本データ(イベントストア)、確定算定、請求前点検、月次締め、外部公的接続、テナント管理 | CLOUD_DEGRADED / LOCAL_ONLY へ降格(業務は継続) |
| Pharmacy Edge Node | 店舗ローカルでの受付・処方入力・仮算定・参照キャッシュ、クラウド断絶時の業務継続 | Edge 障害時は Cloud 直結で NORMAL 継続(Edge は必須経路ではない) |
| 外部公的システム | オン資・電子処方箋・オンライン請求・PMH(Official Adapter 経由) | EXTERNAL_DEGRADED へ降格(PENDING 系ステータスで後続再確認) |

- 正本は常に Cloud Core のイベントストア。Edge は投影・キャッシュ・一時記録であり、正本を持たない。
- Edge で発生した記録は RECOVERY_SYNC(ARC-002)の再検証を経てのみ正本へ昇格する。
- Edge の実行形態は open_question(確定まで Edge 依存の実装は BLOCKED_EDGE_SYNC_DESIGN)。

## 3. SystemMode との対応

モードの正本は `@yrese/shared-kernel`(SYSTEM_MODES と判定関数)、操作可否の正本は ARC-001。
本書はアーキテクチャ上の解釈のみ定め、両者と矛盾する記述をしてはならない。

| モード | 状態 | アーキテクチャ上の意味 |
|---|---|---|
| NORMAL | 全系統健全 | 確定算定・請求確定・外部確認すべて可(`allowsClaimFinalization` が真になる唯一のモード) |
| EXTERNAL_DEGRADED | 外部公的システム断 | 業務継続。外部確認は PENDING 化し復旧後再確認(`canConfirmExternal` 偽) |
| CLOUD_DEGRADED | クラウド一部縮退 | 確定算定は可、外部確認も可。請求確定は不可 |
| LOCAL_ONLY | クラウド断絶・Edge単独 | **仮算定のみ**(`allowsFinalCalculation` 偽)。会計確定・請求系操作は不可 |

- 本書の CLOUD_DEGRADED は、外部接続経路が Edge/別系統で温存される形のクラウド縮退を指す(v0.2.0 §12 の「Cloud Core が利用不能」の字義に対し、外部確認可否は shared-kernel `canConfirmExternal` の実装を正とする解釈を明確化したもの)。
| RECOVERY_SYNC | 復旧後整合回復中 | LOCAL_ONLY 期間の記録を再検証・再算定して正本へ取り込む(ARC-002) |

- モード遷移は自動検知+明示記録とし、遷移イベントは監査対象(モードを偽装した操作を許さない)。
- LOCAL_ONLY の仮算定結果を、RECOVERY_SYNC の再検証なしに確定扱いへ昇格させる実装は禁止(fail-closed)。

## 4. zero planned downtime の定義

- **計画停止を「業務時間外」概念に依存させない**。24時間対応薬局・在宅対応がある以上、「夜間なら止めてよい」時間帯は存在しないものとして設計する。
- リリース・スキーマ変更・基盤保守は、ローリング更新・後方互換マイグレーション・段階的切替で行い、全テナント同時停止を要する設計を持ち込まない。
- 全停止を伴う作業がどうしても必要な場合は例外であり、fable5 起案+人間レビュー承認+全テナント事前告知を必須とする(黙って止めない)。
- 「停止を要しない」ことはデプロイ設計のレビュー項目とする(review_gate_matrix の対象に追加提案 — PRC-005 改版は別WP)。

## 5. 停止条件(fail-closed)

- Edge 同期プロトコル未確定のまま Edge 依存機能を実装 → BLOCKED_EDGE_SYNC_DESIGN
- LOCAL_ONLY の記録を再検証なしで確定昇格 → 実装禁止(SSOT_UPDATE_REQUIRED)
- 全テナント停止を前提とする運用手順・マイグレーションの導入 → 本書 §4 の例外手続なしには不可
- 可用性数値の対外約束 → OPS-005 確定まで BLOCKED_PERFORMANCE_SLO

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(SLA/SLO 委譲先を OPS-005 へ訂正・ARC-011 との循環依存解消・CLOUD_DEGRADED の意味を明確化)。
- 0.1.0 (2026-07-09): 初版起草(WP-0045)。
