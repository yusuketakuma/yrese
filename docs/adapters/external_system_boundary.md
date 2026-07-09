# external_system_boundary — 外部システム責務分界

```yaml
ssot_id: ADP-002
title: 外部システム責務分界
domain: adapters
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs:
  - 構築プロンプト v0.1.7 §12, §2, §23-28
  - docs/plan/phase0_plan.md §9.2, §10
depends_on:
  - docs/adapters/official_adapter_inventory.md
impacts:
  - docs/architecture/offline_mode_matrix.md
  - docs/architecture/recovery_sync_design.md
open_questions:
  - 資格確認端末とEdge Node間の接続方式(外部IF仕様確認後)
  - オンライン請求用端末への受け渡し媒体・手順(公式手順確認後)
```

## 1. 構成要素の定義(v0.1.7 §12 準拠)

| 要素 | 定義 | 信頼レベル |
|---|---|---|
| Cloud Core | AWS上の中枢SaaS。全薬局横断の管理・同期・バックアップ・監査・マスター配布・外部連携制御・テナント管理 | 自社管理(テナント分離必須) |
| Pharmacy Edge Node | 薬局内LANのローカル実行環境。ローカルDB/キュー/監査ログ/帳票/算定/薬局内連携 | 自社管理(物理アクセスリスクあり) |
| External National Systems | オン資システム/電子処方箋管理サービス/オンライン請求/PMH/支払基金・国保連 | 外部公的(結果の捏造・成功扱い禁止) |
| Partner Systems | 電子薬歴/調剤監査/散剤・錠剤監査/分包機/POS/在庫/お薬手帳 | 外部私的(Integration API 契約で防御) |

## 2. 境界図

```text
                    【信頼境界 T3: 公的網】
┌──────────────────────────────────────────────────────────────────┐
│ External National Systems                                         │
│ オン資システム / 電子処方箋管理サービス / オンライン請求 / PMH     │
└──────▲───────────────▲──────────────────────▲────────────────────┘
       │ADP-A1         │ADP-A2                │ADP-A3(受け渡しのみ)/A4
       │(端末経由)     │                      │
┌──────┴───────────────┴──────┐      ┌────────┴───────────────────┐
│ Pharmacy Edge Node(薬局LAN) │◀sync▶│ Cloud Core(AWS東京)        │
│ 受付/入力/仮算定/帳票/監査   │ T1   │ テナント管理/マスター配布/  │
│ ローカルDB/Outbox/Inbox      │      │ 集中監査/バックアップ/請求  │
└──────▲───────────────────────┘      └────────▲───────────────────┘
       │ Integration API(OAuth2+mTLS)          │ Integration API(外部SaaS薬歴等)
【信頼境界 T2: 薬局内LAN】                      【信頼境界 T2': インターネット】
┌──────┴────────────────────────────────────────┴──────────────────┐
│ Partner Systems: 電子薬歴 / 監査機器 / 分包機 / POS / 在庫 / 手帳 │
└──────────────────────────────────────────────────────────────────┘
```

## 3. 境界ごとの責務・データフロー・障害時挙動

### T1: Cloud Core ⇄ Pharmacy Edge Node(同期境界)

- プロトコル: Outbox/Inbox パターン、@yrese/events の EventEnvelope(実装済み: PHI≠none→encrypted 必須、idempotency key、sequence/logical clock)
- データ: 患者・処方・調剤・算定・帳票メタ・監査ログ・マスター配布・設定
- 障害時: Cloud 停止 → Edge は CLOUD_DEGRADED/LOCAL_ONLY へ遷移(offline_mode_matrix 準拠)。同期はキューに蓄積し、復旧後 RECOVERY_SYNC(ARC-002)
- 禁止: ローカルデータで Cloud 確定データを無条件上書き(競合は CONFLICT_REQUIRES_HUMAN_REVIEW)

### T2: Edge Node ⇄ 薬局内 Partner Systems

- プロトコル: Pharmacy Integration API(OpenAPI 3.1 / OAuth2 CC / mTLS / 署名付き Webhook / Idempotency-Key)
- データ: 処方・調剤イベント配信、監査結果受領、在庫・POS連携(MVP は電子薬歴向け最小セット — mvp_scope M12)
- 障害時: 配信失敗はリトライ+DLQ。Partner 停止が調剤業務を停止させない(疎結合)
- 禁止: NSIPS 仕様の模倣による接続(RB-006)

### T3: Adapter ⇄ External National Systems

- プロトコル: 各公式仕様のみ(official_adapter_inventory 参照。全て BLOCKED)
- 障害時: EXTERNAL_DEGRADED へ遷移。新規確認・送信・登録は成功扱い禁止、PENDING_* 付与、保留キュー蓄積
- 禁止: 公式接続仕様外の自動化(画面スクレイピング・非公式API)

### T2': Cloud Core ⇄ 外部SaaS Partner Systems

- T2 と同一契約(Integration API)。テナント別 scope、data minimization、PHI classification を適用

## 4. データ所在の原則

| データ | 正本 | 複製 |
|---|---|---|
| 患者・保険・公費 | Cloud Core | Edge(暗号化ローカルDB) |
| 処方・調剤(進行中) | Edge(入力現場) | Cloud(同期後) |
| 算定確定・請求データ | Cloud Core | Edge(参照用) |
| 監査ログ | 両方(各発生元で改ざん検知付き保存 → Cloud 集中) | — |
| マスター | Cloud Core(配布元) | Edge(版管理付き配布先) |
| 資格確認スナップショット | Edge(取得現場)→ Cloud | — |

## 5. 障害モードとの対応

システムモード(NORMAL / EXTERNAL_DEGRADED / CLOUD_DEGRADED / LOCAL_ONLY / RECOVERY_SYNC)ごとの操作可否は offline_mode_matrix(ARC-001)を正本とする。本書は境界の責務のみを定義する。
