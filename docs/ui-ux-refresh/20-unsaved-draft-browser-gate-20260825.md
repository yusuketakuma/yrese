# 20 — 未保存下書き保護・ブラウザ検証ゲート（2026-08-25）

```yaml
document_type: IMPLEMENTATION_AND_REVIEW_RECORD_NON_SSOT
status: code_implemented_browser_ci_pending
branch: feat/operator-first-ui
base_commit: d97ef36a25edb99b7483f97a1a5da6574a399137
scope:
  - unsaved_prescription_draft
  - patient_context_switch_guard
  - disabled_action_focus_order
  - keyboard_accessibility
  - browser_reflow_and_visual_evidence
approval_effect: none
independence: self_review_only
```

> 本書は作業記録であり、APPROVED SSOT、医療安全承認、アクセシビリティ適合証明、
> release admissionを構成しない。実利用者による独立評価は別途必要である。

## 1. 実装方針

### 1.1 未保存処方下書き

- 下書きはRootLayout配下のReactメモリだけに保持する。
- `localStorage`、`sessionStorage`、IndexedDB、URL、history stateへPHIを保存しない。
- 同一タブ内のApp Router遷移・戻る操作では下書きを復元する。
- 未保存下書きがある患者から別患者へ切り替える場合、同期確認を必須化する。
- 確認を取り消した場合は患者文脈と下書きを維持する。
- 確認して切り替えた場合は旧患者の下書きを破棄し、新患者へ持ち越さない。
- 患者が404で参照不能になった場合は、患者文脈と同患者下書きをfail-closedで破棄する。
- 再読込・タブ終了・外部ページ遷移は`beforeunload`で警告する。続行した場合はメモリ下書きが消失する。

この方針は、復元性よりもPHIのブラウザ永続化回避を優先した暫定境界である。永続下書きを導入する場合は、認証、tenant、patient identity、暗号化、TTL、監査、同時編集、削除、災害復旧を含む別Admissionが必要である。

### 1.2 無効操作

- プロトタイプ操作はnative `disabled`のまま維持する。
- 無効理由は画面上の常時可視テキストとして隣接表示する。
- 説明取得のためだけのfocusable wrapperは廃止し、無効操作数に比例したtab stop増加を防ぐ。
- 支援技術のbrowse modeでは、無効ボタン名と隣接理由を読める構造とする。

### 1.3 ブラウザ検証

GitHub Actionsに独立した`UI browser gate`を追加し、次を自動確認する。

- 主要9routeのHTTP 2xx、main landmark、page-level横overflowなし
- axe-coreによるWCAG A/AAのcritical/serious違反なし
- skip link、`/`コマンドショートカット
- 患者検索→患者選択→処方入力
- route移動後のタブ内下書き復元
- `beforeunload`登録
- 患者切替の取消・確認
- 旧患者下書きの新患者への漏洩なし
- 1366px、1024px、820px、683px（200% reflow相当）、390px
- forced-colors screenshot
- route別・viewport別screenshotと結果JSONのartifact保存

テストデータは`ui-fixture-api.mjs`が提供する合成患者のみを使用する。

## 2. 受入条件

1. 未保存処方を入力して別画面へ移動し、処方画面へ戻ると同じタブ内で復元される。
2. 未保存処方がある状態で患者切替を取り消すと、患者と下書きが維持される。
3. 患者切替を承認すると旧患者下書きが破棄され、新患者では空入力から始まる。
4. 未保存下書きがある間だけdocument unload guardが有効になる。
5. ブラウザ永続ストレージへ処方内容を保存しない。
6. PrototypeActionの理由表示のためのtab stopが存在しない。
7. full CIとUI browser gateが成功するまでmerge-readyを主張しない。
8. 薬剤師・請求事務・アクセシビリティ・privacyの独立評価完了までrelease-readyを主張しない。

## 3. 人間受入プロトコル

合成データのみで、薬剤師・請求事務・アクセシビリティ担当が別々に実施する。

### 薬剤師

1. 患者Aを選択し、複数RP、用法、日数、数量、メモを入力する。
2. 会計画面へ移動後、処方画面へ戻り、入力の完全一致を確認する。
3. 患者Bを選択し、取消時に患者Aが維持されることを確認する。
4. 再度患者Bを選択し、承認後に患者Aの内容が表示されないことを確認する。
5. 重大警告と技術的未接続表示の優先順位を判定する。

合格条件: 患者取り違え、旧患者処方の漏洩、意図しない破棄、重大警告見落としが0件。

### 請求事務

1. キーボードのみで受付→患者検索→処方→会計→請求前点検へ移動する。
2. `—`を0件・0円・正常と誤認しないことを確認する。
3. 無効操作の理由をマウスhoverなしで理解できることを確認する。

合格条件: focus喪失0、状態誤認0、無効理由の説明失敗0。

### アクセシビリティ

1. 200%拡大、390px幅、短いviewportでreflowを確認する。
2. keyboard-onlyでskip link、業務ナビ、入力、確認UIを操作する。
3. NVDAまたはVoiceOverでlandmark、状態、無効理由、警告を確認する。
4. forced-colorsで選択・警告・未検知を識別する。

合格条件: 重大違反0、focus不可視0、患者安全情報の到達不能0。

### Privacy

1. DevToolsでlocalStorage、sessionStorage、IndexedDB、URL、history stateを確認する。
2. route移動時に下書きがネットワーク送信されないことを確認する。
3. 患者切替後に旧患者の下書きがメモリ状態・画面へ残らないことを確認する。

合格条件: PHI永続化0、未承認送信0、患者間漏洩0。

## 4. 残る非コード項目

- 実薬局の混雑条件でのwarning fatigue実測
- screen reader利用者または専門担当による独立確認
- 永続下書きが必要かどうかの製品・privacy判断
- 本番認証・権限・保存API接続後の再検証
- release Admission

これらは実装者の自己レビューで代替しない。
