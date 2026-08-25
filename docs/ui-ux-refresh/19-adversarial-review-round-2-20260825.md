# 19 — Operator-first UI/UX 多角的敵対的レビュー Round 2（2026-08-25）

```yaml
document_type: REVIEW_RECORD_NON_SSOT
status: code_remediated_with_open_human_validation
branch: feat/operator-first-ui
review_base_initial: f31d12a139dddb658b1c8af91b2fdf51e4973129
integration_base: 41d6de304d42316a12e850ae8aacd86ee4e47de3
implementation_commits:
  - 82c20d65a2957ca659227d2125390b431d073ac4
  - 9e75af47449a5b9a8a3b5ac11d588d525a5b6489
  - f7da03404640cfff8d21802644ad64266a023227
review_date: 2026-08-25
review_dimensions:
  - patient_safety
  - privacy_and_context_minimization
  - state_truthfulness
  - workflow_efficiency
  - cognitive_load_and_warning_fatigue
  - accessibility_and_keyboard
  - responsive_high_zoom_and_short_viewport
  - implementation_maintainability
independence: self_review_only
approval_effect: none
```

> 本書は実装改善のレビュー記録であり、APPROVED SSOT、医療安全承認、アクセシビリティ適合証明、
> リリース受入を構成しない。maker と同一コンテキストのレビューであるため、独立 checker と
> pharmacist / claim-clerk / accessibility / privacy の人間レビューは別途必要である。

## 1. 結論

共通シェル、業務順ナビゲーション、未接続表示、患者未選択時の処方開始禁止という骨格は維持した。
一方、「利用者が画面の値を実患者の業務事実として信じる」「混雑時に確認文を読み飛ばす」前提で
攻撃すると、以下が重大だった。

1. 実患者文脈の隣に固定の合成処方・合成金額を置くことで、患者固有値へ誤帰属し得る。
2. 患者横断・システム・管理画面にも患者バーを残すことで、画面スコープとPHI表示範囲を誤認し得る。
3. 自然言語ルーティングが弱い単語・複数業務意図を先着一致で解釈し、誤画面へ誘導し得る。
4. 初期化・RP削除が一段操作で、未保存入力を偶発的に失い得る。
5. 月次締めの金額・返戻件数、マスターの旧版番号、管理画面のMFA/弱い認証情報件数が架空の運用状態として表示されていた。
6. 並行実装により、テストが要求するナビゲーショングループとクイックリンクが実装へ未統合のまま、
   未参照の重複stylesheetも残り、カスケードと契約が分岐していた。

Round 2では上記をコードレベルで是正した。全体CI、実ブラウザ200%拡大、screen reader、実利用者による
warning-fatigue評価は未実施であり、リリース可否は主張しない。

## 2. 判定基準

`UIX-001` の優先順位を採用した。

> 患者安全 > 医療安全 > 誤請求防止・監査証跡・法令適合性 > 視認性・説明可能性・業務継続性 >
> 入力効率・キーボード操作 > 見た目

特に P-08（警告疲れ）、P-09（患者取り違え防止）、P-11（破壊操作の二段階確認）、
P-17（根拠のない完了表示禁止）、P-20（色非依存）を直接の判定軸とした。

## 3. 敵対的所見と処置

| ID | 重大度 | 攻撃仮説 / 失敗モード | 処置 | 状態 |
|---|---|---|---|---|
| ADV2-01 | P0 | 患者Aを選択した直後、固定の合成薬剤・過去処方が患者Aの処方に見える | 選択患者画面は空の1行から開始。患者固有過去処方API未接続を明示し、固定薬剤・固定日付をproduction componentから除外 | code_closed / browser_pending |
| ADV2-02 | P0 | 患者Aの会計画面で固定点数・金額・入金履歴を実額と誤認する | 金額・点数・履歴を `—` に置換し、「0円・履歴なし・請求不要を意味しない」と明示 | code_closed / browser_pending |
| ADV2-03 | P0 | 請求前点検・月次締め・管理画面にも患者バーが残り、単一患者業務と誤認またはPHIを過剰露出する | route allowlistを新設し、受付・患者・処方・会計だけに患者文脈を表示。請求前点検は患者横断・バッチ単位と明示 | code_closed |
| ADV2-04 | P0 | 同一薬剤名が複数RPに存在すると差分を縮約し、変更・削除件数を過少評価する | 薬剤名ごとのmultiset比較を純粋関数へ分離し、完全一致を相殺後に変更・追加・削除を分類 | code_closed / pure_runtime_pass |
| ADV2-05 | P1 | 「薬」「エラー」等の弱い語や「患者検索と会計」の複数意図を先着画面へ誘導する | 重み付きbounded resolver、弱一致拒否、第二の強い意図がある場合の棄却、NFKC正規化を追加 | code_closed / pure_runtime_pass |
| ADV2-06 | P1 | 患者名を例示した検索欄がPHI入力を誘発する | placeholder・title・支援技術向け説明を業務名検索へ変更。患者名・薬剤名・処方内容を入力しないよう明示し、80文字上限を設定 | code_closed |
| ADV2-07 | P1 | `Ctrl/Command+K` や `/` が薬剤入力・IME変換を奪う | text entry、IME composition、Alt修飾時を拒否するpure shortcut policyへ分離 | code_closed / pure_runtime_pass |
| ADV2-08 | P1 | 処方全体の初期化・RP行削除で未保存内容を1クリック消失させる | 患者名・行・選択件数を提示する二段階確認を追加。最後の空行は削除不可 | code_closed / interaction_pending |
| ADV2-09 | P1 | native disabledの理由がtitleだけで、キーボード・支援技術から取得しにくい | disabled buttonは維持し、操作名と理由を持つfocusable shellを追加 | code_closed / screen_reader_pending |
| ADV2-10 | P1 | 低い画面・200%拡大でheader、患者バー、右railが入れ子scrollとなりfocusが迷子になる | 短画面ではsticky/max-height/内部scrollを解除。横scroll表へfocus ringとaccessible nameを付与 | code_closed / browser_pending |
| ADV2-11 | P1 | 未取得件数を緑の完了、固定0件、固定日付として誤読する | 未知値を `—`、neutral toneへ変更。固定日付を削除。合成表captionを常時表示 | code_closed |
| ADV2-12 | P1 | 技術的未接続を赤系で濫発し、真の患者安全警告を希釈する | 合成値自体を除去し、技術的未接続はwarning/neutralへ降格。規制BLOCKと患者安全警告を分離 | code_closed / fatigue_human_pending |
| ADV2-13 | P1 | ナビゲーショングループ・クイックリンクのテストと実装が分岐し、CIがredまたはUI契約が曖昧になる | `日次業務 / 請求業務 / 運用・保守` を実装し、bounded quick linksを統合。既存route順を保持 | code_closed / full_ci_pending |
| ADV2-14 | P2 | 未参照の重複stylesheetを将来読み込むと、focus・table・responsive規則が二重化する | 明示カスケードを固定し、未参照の `operator-first-refinement.css` を削除。load-order testで再発を拒否 | code_closed |
| ADV2-15 | P1 | 月次・マスター・管理画面の架空金額、旧版番号、MFA/弱い認証情報件数が実運用アラームに見える | 運用値を `— / 未取得 / 未検知` へ置換し、0件・正常・更新不要を意味しないと明示。未知値のsuccess/danger toneをneutralへ変更 | code_closed / browser_pending |

## 4. 実装差分

### 4.1 患者スコープとデータ帰属

- `components/patient-context-route-policy.ts`
  - 患者文脈を表示してよいrouteをallowlist化。
- `components/patient-context-boundary.tsx`
  - RootLayoutでroute policyを投影。
- `prescriptions/prescription-workspace.tsx`
  - 選択患者へ固定薬剤・固定過去処方・固定日付を表示しない。
  - 空の未保存入力から開始し、患者固有過去処方は未取得として扱う。
- `checkout/page.tsx`
  - 固定金額・点数・支払履歴を除去。
- `claim-check/page.tsx`
  - 単一患者railを除去し、患者横断・バッチ単位を明示。
- `monthly-closing/page.tsx` / `masters/page.tsx` / `admin/page.tsx`
  - 架空の金額・件数・版・ユーザー・セキュリティアラームを除去し、未取得状態へ統一。
- `page.tsx` / `patients/page.tsx` / `components/operator-focus-board.tsx`
  - API配線を稼働成功と表現せず、未知件数の緑・赤表示をneutralへ変更。

### 4.2 誤操作防止とルーティング

- `prescriptions/prescription-replacement.ts`
  - duplicate RPを保持するmultiset差分、空行生成、確認後削除のpure policy。
- `prescriptions/prescription-workspace.tsx`
  - 全体消去とRP削除を二段階確認へ変更。
  - 保存・算定は接続前のため実行不能のまま。
- `components/operator-command-policy.ts`
  - 弱一致・複数意図・入力中shortcutを棄却するpure policy。
- `components/operator-command-bar.tsx`
  - PHIを促さない文言、bounded quick links、route変更時とEscape時の消去を統合。

### 4.3 情報設計・アクセシビリティ・レスポンシブ

- `nav.tsx`
  - route順を変えず `日次業務 / 請求業務 / 運用・保守` へグループ化。
- `components/operator-ui.tsx`
  - metric gridをlabelled list化、右railへaccessible name、disabled理由へ到達可能なshellを追加。
- `operator-adversarial-refinement.css`
  - bounded quick links、短画面、横scroll表、消去確認、forced-colors、reduced-motionを補強。
- `style-load-order.test.ts`
  - `globals → operator-first → operator-ux → navigation → adversarial` を固定。

## 5. 検証結果

| 検証 | 結果 | 射程 |
|---|---|---|
| isolated strict TypeScript check | PASS | 今回変更したTS/TSXと依存stubの型整合 |
| pure policy runtime assertions | PASS | command routing、shortcut、patient route scope、duplicate RP、最終行削除 |
| production-source synthetic-value scan | PASS | 処方・会計・月次・マスター・管理画面に患者/運用事実と誤認する固定値が残っていないこと |
| changed CSS/import-order static scan | PASS | 今回追加したstylesheetの括弧整合、重複stylesheet削除、明示import順 |
| full workspace test / typecheck / build | 未実施 | repository全体依存を取得できる実行環境またはPR CIが必要 |
| browser keyboard-only / 200% zoom / screen reader | 未実施 | 実ブラウザ・支援技術での人間検証が必要 |

上表のPASSをリリース受入、WCAG適合、医療安全承認へ拡大解釈してはならない。

## 6. 残存リスク

1. 未保存入力のNext.js内部route遷移ガードは未実装。患者変更ではstateを破棄するが、離脱前確認は人間検証を含めて別設計が必要。
2. 患者固有過去処方、算定、会計、点検APIは未接続であり、主要workflow完了性は評価できない。
3. 200%拡大・短画面対策は静的レビューのみで、focus順・scroll位置・sticky重なりは未検証。
4. focusable disabled-reason shellは説明到達性を上げる一方、無効操作が多い画面ではtab stopを増やす。実利用者テストで調整する。
5. 警告疲れは1セッション当たりの発生数と見落としを実測しなければ閉鎖できない。
6. 本レビューは独立checkerではない。UAC-01〜12、特にUAC-05・UAC-10〜12はOPENのまま。

## 7. 人間受入条件

- pharmacist: 患者名と画面値の帰属を誤認せず、未接続の臨床判定を安全確認済みと解釈しない。
- claim clerk: 請求前点検が患者横断画面であると説明なしに判別できる。
- keyboard-only: command barが薬剤入力中のshortcutを奪わず、主要導線・無効理由へ到達できる。
- accessibility: 200%拡大、forced-colors、screen readerで主要情報と操作順が失われない。
- warning fatigue: 通常業務シナリオで患者安全警告の見落としゼロを確認する。
