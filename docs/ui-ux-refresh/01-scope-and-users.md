# 01 — Product Scope, Users, Medical Context (Phase 1)

コード・文書・DB・テストから確定した事実と、推測(Assumption)・要レビュー(Review required)を分離して記す。

## 1. システムスコープ(Evidence 付き)

| 項目 | 内容 | Evidence |
| --- | --- | --- |
| 対象組織 | 保険薬局 | package.json `description`「調剤用レセプトコンピューター MVP」/ 各画面文言 |
| 提供形態 | Cloud Core + Pharmacy Edge Node のハイブリッド | package.json / system-mode.ts / workflow_map |
| 対象業務 | 受付・患者/保険/公費確認・処方入力・調剤・算定・薬剤師確認・会計・帳票・請求前点検・月次締め・レセプト・返戻再請求・マスター・同期・監査 | UIX-007(29画面)/ UIX-006 導線 |
| 利用ロール | pharmacist / clerk / admin / support | shared-kernel `ROLE_NAMES` / workflow_map §4 |
| 利用環境/デバイス | 現場PC + タブレット想定(現時点で responsive 実装は限定) | globals.css / UIX-001 §1(現場デバイス対応) |
| 患者情報の範囲(PHI) | 氏名・カナ・生年月日・年齢・性別・患者番号・資格確認状態・薬歴・処方・調剤・会計 | patient-header.tsx / contracts patient-search |
| 記録の流れ | 受付→確認→入力→仮/確定算定→薬剤師確認→会計→請求前点検→月次締め(確定は NORMAL のみ) | UIX-006 / system-mode allowsClaimFinalization |
| 外部連携 | オンライン資格確認・電子処方箋・オンライン請求・PMH(いずれも境界のみ/BLOCKED) | UIX-007 SCR-006/008/009/021 |
| 非常時継続 | LOCAL_ONLY(仮受付・仮算定)/ RECOVERY_SYNC(再検証)モデル | system-mode.ts / workflow_map §2,§3 |

## 2. 患者安全へ直接影響しうる機能(高リスク=U3/U4)

UIX-007 の U4(患者取り違え・薬剤師確認・外部未確認・請求確定)を最重要とする:
患者検索/選択(SCR-002)、患者文脈表示(SCR-003)、処方入力(SCR-004)、調剤入力(SCR-010)、
薬剤師確認(SCR-014)、月次締め(SCR-020)、レセプト出力(SCR-021)、LOCAL_ONLY(SCR-026)、RECOVERY_SYNC(SCR-027)。
→ `07-use-error-risk-register.md` の H-01..H-12 に対応。

## 3. 医療機器プログラム(SaMD)該当性 — 重要

**Phase 2 研究(一次資料 PDF 確認済み)による整理**:
- 本システムの**中核(レセプト作成・保険請求・調剤事務・会計・薬歴の記録/閲覧)は医療機器プログラムに非該当**。
  根拠: 厚労省「プログラムの医療機器該当性に関するガイドライン」の非該当典型事例(2)②
  「受付・会計業務等 院内業務支援を目的とするプログラム」および ①「健康記録等の記録・閲覧・転送」。
- ただし **相互作用チェック・用量チェック・処方監査・診断/治療支援など臨床判断支援機能を追加する場合**は、
  「機能単位で該当性評価」が必須で、グレーな場合はリリース前に**厚労省/PMDA の該当性相談**で確定させるのが安全側。
- **Assumption / Review required**: 現 MVP 実装(受付・患者検索)は非該当側。今後 clinical alert(SCR-013)等を
  実装する WP では SaMD 該当性を**設計判断の前提レビュー項目**に組み込む(`11-remaining-risks.md` R-SAMD)。

## 4. 専門家レビューが必要な領域(Review required)

- 疑義照会の必須記録項目(薬剤師実務レビュー)— UIX-001 §6 未確認。
- 高齢患者向け表示(文字サイズ切替等)の対象範囲(薬剤師レビュー)。
- 臨床アラート(相互作用・禁忌・重複・ハイリスク薬)の内容と SaMD 該当性(医療安全 + 薬機法レビュー)。
- 権限 scope 粒度の確定(permission_scope_registry)。
- 法令「完全準拠」の断定は行わない(§3.3)。適用性は §02 のマトリクスで要求・実装・証跡として追跡する。
