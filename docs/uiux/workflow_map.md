# workflow_map — 業務導線マップ

```yaml
ssot_id: UIX-006
title: 業務導線マップ
domain: uiux
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
source_refs: 構築プロンプト v0.1.7 §7, §13-16 / docs/plan/phase0_plan.md §5, §9.3
depends_on: [docs/architecture/offline_mode_matrix.md, docs/architecture/recovery_sync_design.md, docs/product/mvp_scope.md]
open_questions:
  - 疑義照会・残薬調整の導線分岐の実務詳細(薬剤師レビュー)【要確認】
  - 電子処方箋受付導線は ONS 資料入手後に確定(WP-0016)【要確認】
```

## 1. 通常導線(NORMAL)

```text
受付
 ├─ 紙処方箋 ──── 2次元シンボル読取(仮取込)─┐
 ├─ 紙処方箋(手入力)───────────────────────┤
 └─ 電子処方箋受付【BLOCKED: ONS】────────────┤
                                              ▼
患者特定(患者検索 / 新規登録)── PatientHeader 常時表示開始
                                              ▼
患者・保険・公費確認 ── オンライン資格確認【境界のみ・BLOCKED: ONS】
                        └─ 資格確認結果 / PMH確認結果(状態表示)
                                              ▼
処方入力(RP単位)── QR仮取込との照合(紙面照合ルール)
 └─ 疑義照会が必要 → 疑義照会記録 → 処方訂正 or 継続
                                              ▼
調剤入力 ──(残薬調整・後発品変更等の記録)
                                              ▼
仮算定(ローカル)── calculation_trace 表示 ── 警告・BLOCKER 表示
 └─ MVP対象外算定を含む → BLOCKED_UNSUPPORTED_CLAIM(請求データ生成禁止)
                                              ▼
薬剤師確認(確認者・日時を記録)← ここまで「確認前」表示を維持
                                              ▼
会計(確定算定 → 一部負担金請求)── 未収・返金・差額精算
                                              ▼
帳票出力(領収証・明細書・薬袋・調剤録 等)── 再出力は履歴付き
                                              ▼
(月次)請求前点検 → 月次締め【claim:finalize 権限・NORMALのみ】
        → 電子レセプト出力【BLOCKED: 記録条件仕様 evidence 待ち】
        → 返戻・再請求管理
```

原則: 各工程の状態(仮/確定/保留/請求不可)は次工程へ進む前に画面上で判別可能であること(UAC-05)。

## 2. LOCAL_ONLY 分岐(仮受付導線)

```text
ネットワーク断/Cloud障害検知(≤10s)→ SystemModeBadge が LOCAL_ONLY 表示
 ▼
仮受付(紙処方箋 / QR仮取込)── 新規オンライン資格確認は不可(禁止表示+理由)
 ▼
最終資格確認スナップショット参照(最終確認日時・PENDING_REVERIFY 表示必須)
 ▼
処方・調剤入力 → 仮算定(PROVISIONAL_CALCULATION)→ 薬剤師確認(可)
 ▼
仮帳票出力(「仮」明示)── 会計は仮精算として記録
 ▼
同期キュー蓄積 + 復旧後再検証リスト登録(自動)
※ 請求前点検・月次締め・レセプト出力・外部送信は全て不可(ARC-001)
```

## 3. RECOVERY_SYNC 分岐(再検証導線)

```text
復旧検知 → RECOVERY_SYNC 表示 → 要再検証一覧(ホームに固定表示)
 ├─ 資格再確認(PENDING_REVERIFY 解消)
 ├─ 外部送信の再送(PENDING_EXTERNAL_SYNC)
 ├─ PMH再確認(PENDING_PMH_REVERIFY)
 ├─ 算定再計算 → 差額検出 → 差額精算導線(会計へ)
 └─ 競合検出 → CONFLICT_REQUIRES_HUMAN_REVIEW(自動補正禁止・人間承認)
 ▼
全件解消+承認 → NORMAL 復帰(完了まで月次締め解禁しない — ARC-002 ゲート)
```

## 4. ロール別ホーム(v0.1.7 §9.9)

| ロール | ホームで最優先表示 |
|---|---|
| 事務(clerk) | 受付キュー・入力中下書き・帳票失敗・未収 |
| 薬剤師(pharmacist) | 薬剤師確認待ち・疑義照会中・CRITICAL警告・要再検証 |
| 管理者(admin) | システムモード・同期状態・マスター版・月次締め状況・監査イベント |
| サポート(support) | (閲覧最小権限)障害状況・診断情報のみ。PHI 非表示 |

## 5. 画面遷移の原則

- 業務順ナビ(BusinessNav 2b195b5)の並びは本マップの工程順と一致させる
- 連続受付(次の患者へ)は会計完了画面から1操作で受付へ戻れる
- どの画面からも現在の患者文脈(PatientHeader)と システムモード(SystemModeBadge)を失わない
