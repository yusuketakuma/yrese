# claimability_status_policy — 候補/確定分離と請求可否ステータス

```yaml
ssot_id: CAL-007
title: 算定候補/確定分離ステータスと請求可否ポリシー
domain: calculation
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs:
  - ユーザー提供レセコン調査(2026-07-09)§5.4, §9.3(薬歴未記載チェック — PHC Pharnes 公開機能由来の要件抽出)
  - CAL-004 §4(POINTS_ONLY_COPAY_BLOCKED / ホワイトリスト規律)
depends_on: [MOD-005(status_registry), CAL-004, CAL-005]
impacts: [packages/shared-kernel(status追加 = WP-2105), packages/calculation, 請求前点検(WP-0031)]
open_questions:
  - REQUIRES_RECORD の「必要記録」の法的根拠列挙(薬歴記載義務の条文)【要確認 — REG-003 同期】
  - 電子薬歴連携APIの記録存在確認プロトコル(WP-2107 契約設計で確定)
blockers:
  - 新ステータスの shared-kernel 実装は本SSOT承認+MOD-005 改版後(WP-2105)。それまで実装コードへの追加禁止
```

## 1. 目的

算定エンジンが**勝手に確定しない**ための状態体系を定める。薬学管理料・一部の加算は、記録・説明・同意・服薬指導・薬剤師確認が要件であり、機械が要件を検証できない段階で「算定済み」に見せることは誤請求(不正請求リスク)に直結する。

## 2. 項目レベルステータス(候補/確定分離)

算定**項目ごと**(fee item 単位)に以下を付与する。

| ステータス | 意味 | 請求可否への影響 |
|---|---|---|
| AUTO_CALCULATED | 機械検証可能な要件をすべて満たし自動確定 | 請求可(他項目・全体条件が満たされる場合) |
| SUGGESTED_REQUIRES_CONFIRMATION | 候補として提示。人の確認で確定 | 確認完了まで**請求不可** |
| REQUIRES_PHARMACIST_CONFIRMATION | 薬剤師の専門的確認が必須(v0.1.7: 薬剤師の判断を置き換えない) | 薬剤師確認完了まで**請求不可** |
| REQUIRES_RECORD | 必要記録(薬歴等)の存在確認が未了 | 記録確認完了まで**請求不可** |
| BLOCKED_MISSING_EVIDENCE | ルールの根拠 evidence が未発行/失効 | **請求不可**(実装も禁止 — CAL-004 §5) |
| BLOCKED_UNSUPPORTED_CLAIM | MVP対象外項目を含む | **請求不可**(shared-kernel 実装済み。請求データ生成前に停止 — PRD-001) |

遷移: `SUGGESTED_* / REQUIRES_*` → (人の確認・記録確認) → `AUTO_CALCULATED` 相当の確定状態。逆方向(確定→候補)は訂正操作としてのみ許可し、履歴を残す(DOM-004 の無履歴変更禁止)。

## 3. 既存体系との整合(重複定義禁止)

| 既存(正本) | 所在 | 本ポリシーとの関係 |
|---|---|---|
| PROVISIONAL_STATUSES 6種(PENDING_REVERIFY 等) | shared-kernel(実装済み) | **文書・外部確認レベル**の保留。項目レベルの本体系とは直交(両方付与されうる) |
| BLOCKED_UNSUPPORTED_CLAIM / MANUAL_REVIEW_REQUIRED / FUTURE_SCOPE_NOT_CLAIMABLE | shared-kernel UNSUPPORTED_CLAIM_STATUSES | 本体系の BLOCKED_UNSUPPORTED_CLAIM はこれを**参照**(再定義しない) |
| isClaimable() | shared-kernel | 最終請求可否の必須通過点。本体系の非確定ステータスが1件でも残る fee item を含む場合、請求データ生成不可となるよう WP-2105 で接続 |
| POINTS_ONLY_COPAY_BLOCKED(claimable:false) | packages/calculation(実装済み) | **結果レベル**のステータス。項目レベル(本体系)とレイヤーが異なる。ホワイトリスト規律(=== 'CALCULATED' のみ請求可)は CAL-004 §4 を維持 |
| BLOCKER_TYPES 31種 | shared-kernel | BLOCKED_MISSING_EVIDENCE は新規 BLOCKER 候補。追加は MOD-005/blockers 改版+WP-2105 で行う |

**実装規律**: 新ステータス・新BLOCKERの追加は「本SSOT承認 → MOD-005(status_registry)改版 → WP-2105 で shared-kernel に一元追加」。packages/calculation 等でのローカル定義は COMMON_MODULE_DUPLICATION_BLOCKED。

## 4. 薬学管理料 × 薬歴未記載チェック(請求前点検連携)

不正請求防止の必須フロー(ベンダー公開機能からの要件抽出 — 実装は独自):

```text
薬学管理料(服薬管理指導料等)を候補算定
  → 項目ステータス = REQUIRES_RECORD + REQUIRES_PHARMACIST_CONFIRMATION
  → 電子薬歴連携API(WP-2107)へ記録存在確認
  → 記録なし: 請求前点検(pre_claim_check)で BLOCKER として列挙(「算定済みだが薬歴未記載」リスト)
  → 記録あり+薬剤師確認済み: 確定へ遷移
  → 未解決のまま月次締めへ進むことは不可(isClaimable 接続)
```

- 記録存在確認は**外部システム(電子薬歴)の応答**に依存するため、LOCAL_ONLY / EXTERNAL_DEGRADED では確認完了扱いにしない(PENDING_EXTERNAL_SYNC を併用 — v0.1.7 §15)。
- 「薬歴未記載リスト」は請求前点検画面(SCR請求前点検)の必須表示項目とする(UIX-007 改版時に反映)。

## 5. 変更履歴

- 0.1.0 (2026-07-09): 初版。
