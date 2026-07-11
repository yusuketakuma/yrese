# 08 — Target Design Direction & Visual Status Language (Phase 6-7)

既存 `docs/uiux/medical_ui_ux_principles.md`(UIX-001)を**上位正本**とし、本書はそれを実装可能な
「視覚的状態言語」へ具体化する。原則そのものは再定義しない(UIX-001 P-01..P-20 を参照)。

## 1. Product-specific 原則(UIX-001 に追記する実装レベル方針)

UIX-001 の原則を、本タスクで実装する共通層の設計判断として具体化する:

1. **状態表現は単一正本から導出する**(A-01/A-02 の恒久対策)。画面側は「意味的状態キー」を渡し、
   ラベル・トーン・重要度・形状・ARIA は **Visual Status Registry** が決定する。画面側に任意の
   色・severity・アイコンを選ばせない(§11.4-6)。
2. **冗長エンコード必須**: 色 + テキストラベル + 形状(+将来アイコン)。色単独・アイコン単独禁止。
   グレースケール/forced-colors でも重要度と種別が判別できること。
3. **直交する状態軸を混同しない**(§11.3)。既存ドメインに実在する軸のみ実装し、未実在軸は
   「予約(reserved)」として設計に記し、ドメイン SSOT 承認まで実装しない(捏造しない)。
4. 患者コンテキストを操作中に失わせない(L-01: PatientHeader 横断固定)。
5. ローカル保存/サーバ保存/同期/確定を同じ成功表現にしない(H-03/H-04/H-05)。

## 2. 三段階コミュニケーション(§11.2)を Registry で担保

- **Level 1(一目)**: tone(補助色)+ shape(形状記号)+ placement。
- **Level 2(一読)**: `label`(必須・日本語・UIX-001 準拠の確定文言)。
- **Level 3(根拠)**: `description`(状態の意味)+ 画面側が付す最終確認日時・対象・次アクション。

## 3. 直交状態軸と実装可否(§11.3 を実在ドメインへ写像)

| 軸 | §11.3 | 実在するドメイン正本 | 本タスクで実装 |
| --- | --- | --- | --- |
| A. Clinical/Message Severity | informational..blocking | `ErrorSeverity`(INFO/WARNING/ERROR/BLOCKER/CRITICAL, error-codes.ts) | ✅ 実装 |
| F. System / Auth mode | normal..emergency | `SystemMode`(system-mode.ts) | ✅ 実装 |
| — 資格確認 | — | `EligibilityStatus`(status.ts) | ✅ 実装 |
| E. Workflow(受付) | not-started..cancelled | `ReceptionStatus`(status.ts) | ✅ 実装 |
| D. Synchronization(仮状態) | queued/syncing/stale.. | `ProvisionalStatus`(status.ts) | ✅ 実装 |
| B. Prescription Change | unchanged..route-changed | **ドメイン enum 未存在** | ⏸ 予約(設計のみ・要 SSOT) |
| C. Record Lifecycle | unsaved..superseded | 部分(PROVISIONAL のみ)。完全 enum 未存在 | ⏸ 予約(設計のみ・要 SSOT) |
| G. File Processing | selected..cancelled | 未存在 | ⏸ 予約(機能未実装) |

**重要**: B/C/G は魅力的だが、対応するドメイン状態が `shared-kernel` に無い。UI だけ先行して状態を
発明すると「UI とデータモデルの乖離」(§3.3 禁止)になる。よって設計に記すが実装しない。
実装は各ドメイン enum の SSOT 承認後に本 Registry へ追加する(governance §6)。

## 4. Visual Status Matrix(実装対象=実在ドメインのみ)

tone: `ok|pending|blocked|attention|neutral`(既存 `StatusTone` を `attention` 拡張)。
shape: 形状記号(テキスト由来・非絵文字・forced-colors 耐性)。ariaLive: severity に応じ使い分け。

### A. Message Severity(domain=`severity`)
| key | label | tone | shape | ariaRole | ariaLive |
| --- | --- | --- | --- | --- | --- |
| CRITICAL | 重大 | blocked | ◆(塗り菱形) | alert | assertive |
| BLOCKER | 停止 | blocked | ■(塗り四角) | alert | assertive |
| ERROR | エラー | attention | ▲(塗り三角) | alert | polite |
| WARNING | 警告 | pending | △(白三角) | status | polite |
| INFO | 情報 | neutral | ・(中点) | status | polite |

### F. System Mode(domain=`system-mode`)
| key | label | tone | shape |
| --- | --- | --- | --- |
| NORMAL | 通常稼働 | ok | ● |
| EXTERNAL_DEGRADED | 外部システム障害 | pending | ▲ |
| CLOUD_DEGRADED | クラウド障害 | pending | ▲ |
| LOCAL_ONLY | ローカル単独稼働(外部確認不可) | blocked | ■ |
| RECOVERY_SYNC | 復旧同期中(要再検証) | pending | ↻ |

### 資格確認(domain=`eligibility`)
| key | label | tone | shape |
| --- | --- | --- | --- |
| VERIFIED | 資格確認済み | ok | ● |
| PENDING_REVERIFY | 資格再確認待ち(請求前に再確認必須) | pending | ↻ |
| LOCAL_ONLY_UNVERIFIED | ローカル参照のみ(オンライン未確認) | blocked | ■ |
| NOT_CHECKED | 資格未確認 | attention | △ |

### E. 受付ワークフロー(domain=`reception`)
| key | label | tone | shape |
| --- | --- | --- | --- |
| WAITING | 待機中 | neutral | ○ |
| IN_PROGRESS | 対応中 | pending | ↻ |
| COMPLETED | 完了 | ok | ● |
| CANCELLED | 取消済み | neutral | ✕ |

### D. 仮状態(domain=`provisional`)
| key | label | tone | shape |
| --- | --- | --- | --- |
| PROVISIONAL_CALCULATION | 仮算定(未確定) | pending | ↻ |
| PENDING_REVERIFY | 再確認待ち | pending | ↻ |
| PENDING_EXTERNAL_SYNC | 外部同期待ち | pending | ↻ |
| PENDING_PMH_REVERIFY | 医療費助成 再確認待ち | pending | ↻ |
| LOCAL_ONLY_UNVERIFIED | ローカルのみ(未確認) | blocked | ■ |
| MANUAL_REVIEW_REQUIRED | 手動確認要 | attention | △ |

**確定文言は既存の写像を正とする**(`MODE_LABELS`/`ELIGIBILITY_LABELS`/`RECEPTION_STATUS_LABELS`/
`SEVERITY_LABELS`)。Registry はこれらを**単一正本へ集約**し、既存写像は Registry の投影として維持する
(文言変更なし=既存テスト不変)。仮状態ラベルは新規(現状 raw enum 表示の `ModeCapabilityView` を改善)。

## 5. Executable SSOT 設計(Phase 8 で実装)

- 追加: `apps/web/app/status/visual-status-registry.ts`
  - `type StatusDomain = "severity" | "system-mode" | "eligibility" | "reception" | "provisional"`
  - discriminated union で「domain と key の不正な組合せ」を型で表現しにくくする(§11.5, §13.4)。
  - `resolveStatus(domain, key) => { key, label, tone, shape, ariaRole, ariaLive, description? }`
  - 各ドメインの全 enum 値を網羅(**exhaustiveness をテストで保証**)。
- 集約: 既存 `MODE_LABELS`/`ELIGIBILITY_LABELS`/`RECEPTION_STATUS_LABELS`/`SEVERITY_LABELS` を
  Registry から導出(重複排除)。**可視ラベルは web 層所有**を維持(shared-kernel には置かない=境界尊重)。
- 拡張: `StatusBadge` に安全な variant を追加(domain+key 指定で presentation 自動導出)。既存の自由 label+tone は互換維持。
- `globals.css`: `attention` トーン、shape 表示、`@media (forced-colors: active)`/`prefers-reduced-motion` を追加(A-03/A-04)。

## 6. Governance(Registry 追加条件)

- 新しい状態キーの追加は、対応するドメイン enum が `shared-kernel`(または contracts)に
  **APPROVED で存在すること**を前提とする。UI だけで状態を発明しない。
- tone/shape の追加は本 Matrix を更新してから実装。exhaustiveness テストが未網羅を検出する。
- 文言変更は UIX-001 と本書の同時更新 + 医療安全レビュー(重要度・安全含意に関わるため)。
