# 07 — Use-error Risk Register (Phase 5)

主要導線ごとの予見可能な使用ミス。Severity(S)/Probability(P)/Detectability(D)は 1(低)〜5(高)。
"Existing control" は実コードで確認できたもののみ記載。実装が無いものは "Required" 側に置き Residual を高く扱う。

| ID | Hazard | Use scenario | Foreseeable use error | Potential harm | S | P | D | Existing control(実在) | Required UI/system control | Verification | Residual | Review owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| H-01 | 患者取り違え | 同姓同名患者が並ぶ | 生年月日/番号を見ず別患者を選択 | 誤調剤・誤請求 | 5 | 4 | 3 | `duplicateKanaSet` 警告+【同姓同名注意】ラベル+未読込続き警告(patient-search) | 患者確定→PatientHeader 横断固定(L-01)。選択時に生年月日再確認 | RTL + 薬剤師シナリオ(未実施) | 中 | 薬剤師 + opus医療安全 |
| H-02 | 患者文脈喪失 | 患者切替/画面遷移 | 前患者の文脈のまま入力 | 誤記録 | 5 | 3 | 4 | — (PatientHeader は部品のみ、横断固定未結線) | 患者文脈レイアウト固定 + 切替時に前患者の検索/フォーム/選択を破棄(§05 H-06) | 切替テスト(要追加) | **高** | 薬剤師 |
| H-03 | ローカル保存をサーバ保存と誤認 | LOCAL_ONLY 稼働 | 「保存済」を同期完了と誤認 | 記録欠落・二重 | 5 | 4 | 3 | 原則 P-02/P-03、`ModeCapabilityView`「未禁止≠許可」、PROVISIONAL_STATUSES 必須付与ルール | 保存先を文言で特定(「ローカル保存済み/サーバ未保存」)。同じ✓表現を使わない(§11.4-10, §3.3) | 実装+テスト(オフライン層未) | **高** | 薬剤師 + opus |
| H-04 | 仮算定を確定額と誤認 | LOCAL_ONLY / 復旧前 | PROVISIONAL_CALCULATION を確定と誤認 | 誤請求 | 5 | 3 | 3 | `isClaimable` 空 allow-list(請求 fail-closed)、原則 P-04/P-05 | 算定結果画面で仮/確定を形状+ラベル+枠で区別(SCR-011 未実装) | 実装+テスト | **高** | opus医療安全 |
| H-05 | 下書き/確認前を確定済みと誤認 | 薬剤師確認前 | 確認前処方を確定扱い | 患者安全 | 5 | 3 | 3 | 原則 P-06/P-07(確認者・日時表示) | RecordLifecycle 状態を Registry 化(unsaved/draft/pending-review/approved/finalized) | 実装+テスト(SCR-014 未) | **高** | 薬剤師 |
| H-06 | 二重送信 | 受付登録連打 | 同一操作を二重実行 | 二重受付 | 3 | 3 | 2 | idempotencyKey + 409 明示 + submitting disabled(reception-dashboard)● | 維持。他の POST 導線にも同パターン適用 | reception-dashboard.test ● | 低 | — |
| H-07 | 連続検索の結果巻き戻り | 高速連続検索 | 古い応答が最新を上書き | 別患者情報表示 | 4 | 3 | 3 | generation guard(古い応答破棄)● | 維持。全 fetch 導線へ横展開 | patient-search.test ● | 低 | — |
| H-08 | 重大警告の埋没(alert fatigue) | 多数の警告 | CRITICAL を見落とす | 患者安全 | 5 | 3 | 4 | 原則 §5 濫発防止、SeverityList 高重要度順ソート ● | Registry で severity ごとに live region/形状/位置を差別化(A-03/A-05) | 実装+テスト | 中 | 薬剤師 + opus |
| H-09 | 権限不足操作が可能に見える | 権限外ユーザー | 実行不可操作を試行 | 操作不能・混乱 | 3 | 3 | 3 | API deny-by-default(AUTH-0003)+ 403→next action(UI)● | UI でも権限状態を明示(ReadOnly/PermissionState 部品) | 実装+テスト | 中 | セキュリティ |
| H-10 | セッション切れで入力消失 | 認証実装後 | 期限切れで作業喪失 | 再入力負荷・記録漏れ | 4 | 3 | 3 | — (認証未実装 = BLOCKED_SECURITY_REVIEW) | session-expiring 事前警告 + 下書き保持 + 復帰後 元画面 | 認証実装 WP | **高(未着手)** | セキュリティ + 薬剤師 |
| H-11 | 同期競合の静かな上書き | RECOVERY_SYNC | 競合を自動解決したと誤認 | データ損失 | 5 | 2 | 4 | CONFLICT_REQUIRES_HUMAN_REVIEW(自動補正禁止)定義 ● | SCR-027 で差分提示+人間承認 UI | 実装+テスト | 中 | opus医療安全 |
| H-12 | レート制限を一般エラーと混同/連打 | 制限到達 | 連打で悪化 | 業務停滞 | 2 | 3 | 3 | — (UI 表現無し) | 再試行可否・待機時間・入力保持を明示(§13.13) | 実装+テスト | 中 | — |

## リスク低減の方針(説明文追記で済ませない — §3.3, §10.2)

- **H-02/H-03/H-04/H-05/H-08** は「状態の分類・配置・形状・操作フロー」の再設計で対処する。
  その共通基盤が **Visual Status Registry**(記録ライフサイクル・同期・仮/確定・重要度の各軸を
  orthogonal に保持し、色だけ/アイコンだけの表現を型で禁止)である → Phase 6/7 で定義、Phase 8 で実装着手。
- **H-01/H-02** は患者文脈の横断固定(L-01)で対処。
- 既に統制のある **H-06/H-07** は横展開の基準として維持する。

## 未実施の明示

本リスク登録簿の Probability/Detectability は**実薬剤師テスト未実施の見積り**である(§14.5 は Not executed)。
確定にはシナリオ妥当性確認が必要(`11-remaining-risks.md` に計上)。
