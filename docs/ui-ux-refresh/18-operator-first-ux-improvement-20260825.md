# 18 — operator-first UI/UX 改善計画・実装レビュー（2026-08-25）

> **WORKING RECORD / NON-SSOT** — 本書は `feat/operator-first-ui` の改善計画と実装後レビューを同じ場所に残すための作業記録である。UIX-001 / UIX-004 / Visual Status Registry / shared-kernel を置き換えず、承認・本番投入可否・法令完全準拠を主張しない。

## 1. 対象と基準点

- repository: `yusuketakuma/yrese`
- branch: `feat/operator-first-ui`
- planning base: `ecf1e976cd959bd3f7c969fe59f4db24f342c4b8`
- 対象: `apps/web/app` の共通シェル、患者コンテキスト、自然言語ナビゲーション、処方入力ワークスペース、operator-first視覚層
- 非対象: API・DB・算定・請求・外部送信・認証・音声処理・臨床判定の実接続、SSOT改版、mainへのmerge、production deploy

## 2. 改善目標

1. **真実性**: 未検知・未接続・合成例を、正常・成功・実件数に見せない。
2. **患者安全**: 操作中に業務対象患者を見失わず、過去処方の反映で現在入力を即時上書きしない。
3. **可読性**: 生成モックの密度感は保ちつつ、臨床画面として小さすぎる文字・操作対象を是正する。
4. **到達性**: キーボードで本文と自然言語ナビゲーションへ直行でき、主要ランドマークを識別できる。
5. **縮退**: タブレット・狭幅では3カラムを安全に1〜2カラムへ落とし、警告と患者文脈を消さない。
6. **保守性**: stylesheetの読込順を一意にし、並行実装によるcascade競合を検出可能にする。

## 3. 優先順位と実装計画

### P0-A — 共通シェルの真実性・ランドマーク

- システムモード未接続時の既定表示を `通常稼働・暫定` から `状態未検知 / API未接続` へ変更する。
- 根拠のない通知件数を削除し、Gbrain・UI・操作者の接続状態はテキストで明示する。
- skip link、`main#main-content`、主要業務aside/navのラベルを追加する。
- 自然言語入力は画面候補提示のみとし、音声入力は承認済み境界接続までdisabledを維持する。
- `/`、`Ctrl/Command+K`、`Escape` のキーボード操作を提供し、画面遷移時に入力文字列を残さない。
- 他のinput/textarea/select/contenteditableを編集中は、グローバルshortcutでfocusを奪わない。

### P0-B — 患者文脈の常時可視

- 選択中患者バーをデスクトップでsticky化する。
- stale・資格状態・患者解除をテキストで保持し、色だけに依存しない。
- sticky右レールと重ならないよう、患者バー有無・画面幅に応じてオフセットを変える。
- 処方入力の内部状態は `patientId` 変更時に再生成し、別患者へ持ち越さない。
- テスト目的だけの患者IDをDOM属性へ追加しない。

### P0-C — 過去処方反映の誤操作防止

- 過去処方検索を日付・薬剤名・用法・日数・数量に対する実フィルタとして機能させる。
- `過去処方→現在入力` は即時反映せず、差分確認→明示確定の2段階にする。
- 反映前に対象患者、対象日、追加・削除・内容変更・同一の件数を提示する。
- 現在入力を編集、追加、削除、初期化、再検索した場合は古い反映候補を破棄する。
- 過去行の薬剤名・用法・日数・数量を推測で再構成せず、保存済み合成行をそのまま複製する。
- 同一薬剤名の複数RP行をMapで縮約せず、完全一致行を消し込むmultiset比較にする。
- 合成日付を基準日2026-08-25と整合させる。

### P1 — 可読性・操作対象・レスポンシブ・CSS境界

- operator chromeの本文・説明・表・ボタンの最小表示を引き上げる。
- 主要button/input/selectの最小高さを40px以上、主要導線を44px相当へ寄せる。
- focus-visible、disabled、unknown、warningを非色依存で判別可能にする。
- 既存 `operator-first.css` は直接大改変せず、後段の `operator-ux-refinement.css` で可逆に上書きする。
- `:has()` 非対応環境では広いsticky offsetへ安全側に倒し、狭幅ではstickyを解除する。
- 読込順を `globals.css → legacy.css`、続いてlayoutから `operator-first.css → operator-ux-refinement.css` に固定する。
- 並行追加された未参照 `operator.css` は削除し、読込順契約テストで二重cascadeを拒否する。

## 4. 受入条件

- `SystemModeBadge()` はモード未指定時にNORMALを推測せず、`provisional={false}` でも未検知を迂回できない。
- 共通シェルに本文skip linkと一意のmain landmarkがある。
- 合成通知件数や未接続の操作者を実状態のように表示しない。
- 選択患者バーは広幅画面でスクロール中も可視である。
- 患者変更時に前患者の処方入力状態を持ち越さない。
- 過去処方の選択だけでは現在入力が変化せず、確認操作後にのみ置換される。
- 過去処方フィルタ、差分算出、行複製は純粋関数として単体テスト可能である。
- 同一薬剤名の複数RP行でも、追加・削除・内容変更・同一の件数を縮約しない。
- 患者未選択・臨床判定未接続・算定未接続・同期未検知のfail-closed表示を維持する。
- operator stylesheetを二重に読み込まず、明示した順番以外を契約テストで拒否する。
- TypeScript構文、追加テスト契約、CSS構文を確認し、未実行の全体CIを実行済みと表現しない。

## 5. ロールバック

- シェル・処方UI・追加stylesheetは独立コミットに分ける。
- API・DB・migration・shared-kernel enumは変更しない。
- 問題時は本計画以後のUIコミットをrevertし、planning baseへ戻せる。

## 6. 実装結果

### 6.1 共通シェル

- `SystemModeBadge` の未指定状態を `UNDETECTED` に固定し、明示的なmodeがない限りNORMALを表示しないようにした。
- ヘッダーから合成通知件数と接続済み薬剤師に見える表現を削除し、`Gbrain未接続`、`UIプロトタイプ`、`操作者未接続` を表示した。
- `本文へスキップ`、`main#main-content`、業務メニューlabel、ブランドから受付への導線を追加した。
- 自然言語入力は既存画面へのbounded navigation候補のみを返し、`/` と `Ctrl/Command+K` でfocus、`Escape` で消去、route変更時にも文字列を消去するようにした。
- shortcutは他の臨床入力欄を編集中には発火させず、候補選択後も入力文字列を消去する。
- 音声入力は処理先・保持・リージョンを保証できる承認済み境界がないためdisabledのまま維持した。

### 6.2 患者文脈と画面密度

- 患者コンテキストバーを広幅画面でsticky化し、右レール・過去処方レールの開始位置を下げた。
- 1020px以下ではstickyを解除して1〜2カラムへ縮退し、820px以下では患者バーを通常フローへ戻した。
- 処方入力コンポーネントは選択患者を必須入力とし、親で `key={patient.patientId}` を与えて患者変更時にdraftを破棄する構成にした。
- 患者IDはReact内部のkeyにのみ用い、テスト用DOM data属性は削除した。
- 後段stylesheetでcaption 13px、small 14px、body 15px相当へ引き上げ、主要controlを40px、主要導線を44px相当へ寄せた。

### 6.3 過去処方の再利用

- 左レールの検索を日付・薬剤・用法・日数・数量へ適用した。
- 過去処方は薬剤名だけでなく用法・日数・数量を含む完全行として保持するようにした。
- `差分を確認` では現在入力を変更せず、患者名、過去処方日、追加・削除・内容変更・同一を表示する。
- `確認して反映` の操作後だけ現在入力を置換する。
- 反映時は用法や数量を薬剤名から推測せず、過去行をそのまま複製する。
- 入力編集後に古い差分結果が残らないよう、編集系操作で候補と算定previewを無効化した。
- 同一薬剤名の複数RP行はmultisetとして比較し、完全一致行を消し込んだ後の残行を変更・追加・削除として数える。

### 6.4 CSS・テスト境界

- `globals.css` はbaselineの `legacy.css` だけを読み込む。
- active operator layerはlayoutで `operator-first.css`、`operator-ux-refinement.css` の順に読み込む。
- 並行実装で追加された別命名・重複規則を含む `operator.css` は未参照化後に削除した。
- `style-load-order.test.ts` を追加し、二重importと読込順逆転を拒否する。
- 旧NORMAL既定を期待していた `system-mode-badge.test.tsx` を、UNDETECTED既定の契約へ更新した。

### 6.5 変更していない境界

- API、DB、migration、算定、請求、外部送信、音声処理、臨床判定は未接続のままである。
- `main` へのmerge、PR作成、deployは行っていない。
- SSOT、Visual Status Registry、shared-kernel enumの意味は変更していない。

## 7. 敵対的レビュー

| 観点 | 攻撃仮説 | 判定・対応 |
|---|---|---|
| 状態誤認 | モードAPI未接続でもNORMALと表示できる | **修正済み**。mode未指定は常にUNDETECTED。`provisional=false` では迂回できない。 |
| テスト逆行 | 実装はUNDETECTEDでも旧テストがNORMALを正として固定する | **修正済み**。単独badge testとshell smokeを同じfail-closed契約へ統一した。 |
| 合成状態 | 通知2件・薬剤師・GitHub状態が実状態に見える | **修正済み**。根拠のない件数と接続済み表現を削除した。 |
| 患者取り違え | 患者を切り替えても前患者のdraftが残る | **修正済み**。`patientId` をReact keyとしてdraftを再生成する。将来の永続draftでは患者ID検証と未保存警告が別途必要。 |
| 不要な識別子露出 | テスト用 `data-patient-id` がDOMへ残る | **修正済み**。DOM属性を削除し、患者IDは内部keyに限定した。 |
| 過去処方上書き | 1クリックで現在処方を消去できる | **修正済み**。選択と反映を分離し、対象患者と差分を表示する。 |
| 用法・数量捏造 | 薬剤名から用法や数量を推測して再構成する | **修正済み**。完全行を保存し、そのまま複製する。 |
| 差分偽陰性 | 同一薬剤名なら用法・日数・数量変更を見落とす | **修正済み**。同一薬剤でも行signatureを比較し内容変更として数える。 |
| 重複薬剤行 | 同一薬剤名が複数RPに存在するとMapで1行へ縮約される | **prototype内で修正済み**。multiset比較と重複行テストを追加した。実データ接続前に薬剤名keyを安定薬剤コード+RP identityへ置換する必要は残る。 |
| readonly型破壊 | immutableな結果型を途中更新してstrict compileが落ちる | **修正済み**。内部accumulatorはmutable推論、返却値だけreadonly契約に適合させた。 |
| PHI残留 | 自然言語欄に患者名等を入力し画面遷移後も残る | **部分修正**。route変更・候補選択・Escapeで消去し、送信・telemetry・音声認識には接続していない。肩越し覗き見と将来のtelemetry禁止規則は別途設計が必要。 |
| キーボード競合 | `/` や `Ctrl/Command+K` が処方入力中にも発火する | **修正済み**。input/textarea/select/contenteditable編集中はshortcutを奪わない。実ブラウザE2Eは未実施。 |
| CSS cascade競合 | `operator.css` と `operator-first.css` が同時読込され、画面ごとに規則が競合する | **修正済み**。active cascadeを一意化し、未参照実験CSSを削除、読込順テストを追加した。 |
| sticky重なり | 患者バーと左右レールが重なり警告が見えなくなる | **緩和済み・要実測**。安全側offsetと狭幅解除を実装したが、実ブラウザ・OS文字拡大・200% zoomの確認が必要。 |
| 警告疲れ | 未接続警告が多く重要警告を埋没させる | **OPEN**。現在はprototype境界を優先して明示している。実運用前に薬剤師タスク試験で頻度・前景順位を調整する。 |
| destructive edit | RP削除・初期化でブラウザ内draftを失う | **OPEN**。現在は非永続prototypeだが、実接続前にundoまたは確認、未保存変更ガードが必要。 |
| テスト偽陽性 | static markup testだけで操作性を保証したと誤認する | **OPEN / merge gate**。純粋関数・markup契約だけではfocus、click、responsive、screen readerを保証しない。ブラウザE2Eと手動レビューが必要。 |
| 独立性 | maker自身のレビューを独立checker承認として扱う | **禁止**。本節は自己敵対レビューであり、medical safety / accessibility / privacy / pharmacistの独立承認には数えない。 |

## 8. 検証結果と残るゲート

### 実施済み

- 変更対象TS/TSXのTypeScript `transpileModule` 構文検査: PASS。
- strict / `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` を有効にしたisolated mini project型検査: PASS。
- 最終の過去処方pure helperについて、検索、完全行複製、同一薬剤の内容変更、同一薬剤複数RPのmultiset比較をNodeで実行: PASS。
- strict再点検でreadonly accumulatorのコンパイル不備を検出し、修正後に再実行: PASS。
- `operator-ux-refinement.css` のCSS構文解析: PASS。
- stylesheet読込順契約、SystemModeBadge契約、処方再利用契約のテストを追加・更新した。ただし実Vitest runnerでは未実行。

### 未実施

- `pnpm install --frozen-lockfile`
- workspace全体の `pnpm typecheck`
- Vitest全件
- Next.js production build
- GitHub Actions（現HEADにstatus/check/workflow runなし）
- 実ブラウザE2E、viewport別screenshot比較、200% zoom、keyboard-only、screen reader、axe
- 実薬剤師・事務・管理者によるUAC-01〜12
- API・DB・外部連携・音声・臨床判定との結合試験

### merge前の必須条件

1. Node 26.6.0 / pnpm 11.18.0でinstall、typecheck、test、build、既存checkerを全て通す。
2. 1366px、1024px、820px、狭幅、200% zoomで患者文脈・警告・操作バーが重ならないことを確認する。
3. keyboard-onlyで受付→患者選択→処方入力→過去処方差分確認までfocus喪失なしで到達する。
4. 実データ接続時の差分keyを、表示薬剤名ではなく承認済み安定薬剤コード+RP行identityへ切り替える。
5. RP削除・初期化へundoまたは確認、患者切替・離脱時へ未保存変更ガードを追加する。
6. medical safety、accessibility、privacy、pharmacist workflowの独立レビューを得る。

## 9. 現在判定

**計画策定・P0/P1実装・自己敵対レビュー・isolated検証まで完了。フルCI、実ブラウザ、実薬剤師等の独立レビュー待ちであり、現時点ではmerge-readyまたはrelease-readyとは判定しない。**
