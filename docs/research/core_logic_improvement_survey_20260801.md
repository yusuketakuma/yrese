# コアロジック改善調査 — 安定性・動作速度・基本設計(2026-08-01)

```yaml
proposal_id: RES-CORE-20260801
status: DRAFT
author: fable5
scope: 調査のみ。実装根拠にしない
```

> **位置づけ**: 本書は `docs/research/` の非SSOT作業文書である(PRC-007 §8)。
> SSOT index の追跡対象外であり、**実装の直接根拠にしない**。ここでの指摘を
> 実装へ移す場合は、該当 SSOT の改版(PRC-007 §4)と WP 起票を経る。
> 既に SSOT/blocker として記録済みの事項は、その旨を明示して重複起票を避ける。

## 0. 調査方法と、断定していないこと

live code の実測に限定した。ベンチマークは実行していないため、性能の**桁の
主張はしない**。計算量とデータの増え方という構造の話に留める。

実測したもの: ファイル規模、export 数、route 数、`pnpm build` / `pnpm -r test`
の実時間、空 catch の実体サンプル、SQL の LIMIT 有無、依存の向き。

## 1. 開発ループの速度 — 問題なし(実測)

| 対象 | 実測 |
|---|---|
| `pnpm build` | 8.4s(user 14.9s / 208% CPU) |
| `pnpm -r --parallel test` | 3.9s(user 17.8s / 556% CPU、1,838 tests) |

**改善対象ではない。** したがって以下の「速度」は全て**実行時**の話である。

## 2. 実行時スケール — 最大の構造的課題

### 2.1 監査ログ閲覧が O(全チェーン)で、時間もメモリも無制限に増える

`apps/api/src/server.ts:1340-1400` の監査閲覧経路は次の順で動く。

1. `auditRepository.list(scope)` — **`apps/api/src/db/audit-repository.ts:143` の
   `list` に `LIMIT` / `OFFSET` がない**。当該 tenant+pharmacy の
   チェーン全件をメモリへ載せる。実 SQL は次のとおりで、要約を信用せずとも
   確認できる。

   ```sql
   SELECT event_body
     FROM audit_events
    WHERE tenant_id = $1 AND pharmacy_id = $2
    ORDER BY sequence_number ASC
   ```

   in-memory 実装(`apps/api/src/audit-repository.ts:112-114`)も
   `return [...(this.chains.get(scopeKey(scope)) ?? [])]` でチェーン全体を
   複製して返す。**両実装とも上限を持たない**。
2. 全件に対する scope 検査(`events.some(...)`)。
3. `verifyAuditHashChain(events)` — `packages/audit/src/index.ts:592` で genesis から
   全件を線形走査。
4. 全件から `eventId` の Set を構築して重複検査。
5. **その後に** 最大200件の表示窓を切る。

`server.ts:1386` のコメントが「保存されている全イベントに対する hash chain 検証
(返却分だけではない)」と明記しているとおり、全件検証は**意図した完全性保証**で
あって実装ミスではない。問題は、監査イベントが append-only・物理削除禁止・法定
保存であり、**全 PHI 読取ごとに 1 件増える**ことである。増加は単調で上限がない。

- 影響は「遅くなる」だけでなく**メモリ**にも出る。1リクエストで全チェーンを
  配列として保持する。
- 監査閲覧は障害時・調査時にこそ使う機能であり、**最も壊れてほしくない時に
  最も重くなる**。

**既存の記録との関係**: DB-005 §6.3 がチェーン成長と segment 化の検討を挙げ、
`State.md` も "bounded chain verification" を production compliance/release blocker
として挙げている。**本調査はそれをコード実測で裏付けたものであり、新規の
未知課題ではない。** ただし記録は設計側にあり、**現行実装が実際に全件経路である
ことの証跡**は本書が初出である。

考えられる方向(いずれも SSOT 改版が要る。ここでは採否を決めない):
segment + アンカー連結による有界検証、検証結果のチェックポイント化、
表示窓と検証範囲の分離(ただし「返却分だけ検証」への後退は完全性を落とすため
単純採用は不可)。

### 2.2 患者検索の全件走査(合成データ経路)

`apps/api/src/patient-repository.ts:375-401` は tenant/pharmacy で filter → 全件に
`normalizeSearchText` を適用して部分一致 → sort → slice。正規化を**リクエストの
たびに全レコード×3フィールド**再計算する。

合成データ用の in-memory 実装なので現状の実害は小さい。**実データ経路の
スケール問題は既に `BLOCKED_PATIENT_SEARCH_SCALE_BOUND` として凍結済み**
(DB-005 §3.4 が候補集合フェッチ・復号の実測 bound と非PHI粗インデックス代替を
要求している)。重複起票しない。

## 3. 基本設計 — 3点

### 3.1 依存の向きが逆になっている(新規指摘)

`apps/api/src/db/reception-repository.ts:12` が、業務規則
`businessDateFromAcceptedAt` を **`apps/api/src/reception-repository.ts:319`**
(合成データ用 in-memory 実装)から import している。

規則自体は1箇所定義で二重化していない点は健全である。しかし
**PostgreSQL アダプタが dev scaffolding に依存する向き**になっており、
in-memory 実装を撤去・整理した瞬間に本番経路が壊れる。JST 業務日という規則は
ドメイン規則であり、`@yrese/date-time` か domain 層へ置くのが自然である。

低リスクな整理であり、SSOT 改版を伴わない(実装配置の話)。

### 3.2 `server.ts` にハンドラ本体が溜まっている

1,473 行に対して route は 7 本、トップレベル宣言 24。**1 ハンドラあたり約 200 行**。
監査ルートだけでも scope 検査・敵対的 descriptor 対策・hash 検証・重複検査・
表示投影・監査記録がインラインに並ぶ。

正しさは test で担保されている(api 855 tests)が、**変更時の影響範囲が読みにくい**。
2.1 の有界化に着手するなら、その前に監査ルートを切り出しておくと差分が
レビュー可能な大きさに収まる。

### 3.3 `packages/calculation/src/index.ts` が 1,861 行の単一モジュール

再エクスポート行は 1 行のみで、**実装 export が 63 個**。バレルではなく実体である。
同パッケージには `formulas.ts`(330 行)が既に分離されており、分割の型は
できているのに本体が肥大している。算定ロジックは今後 R3 領域(診療報酬改定)で
最も変更頻度が高くなる場所であり、分割の costs は先に払うほど安い。

## 4. 安定性 — 現状はむしろ良好(正直な評価)

改善点を探した結果、**問題として挙げるべきものが見つからなかった**箇所も記録する。

- **空 catch 55 件は欠陥ではない。** 実体を 3 件抽出したところ、いずれも
  意図的な fail-closed 変換だった: `instant.ts:13`(不正 timestamp → invalid 値)、
  `reception-repository.ts:252`(branded ID 生成失敗 → invariant error)、
  `patient-search-cursor.ts:125`(cursor 復号失敗 → undefined)。
  例外を握り潰して処理を続ける形は見つからなかった。
- 監査は intent→fact 収束、`eventId` 単位の冪等、hash chain、
  record-before-HTTP-200 と、設計・実装とも堅い。
- ingress は branded ID factory を通し、失敗を context 未確立(403)へ倒す
  fail-closed。`#` を含む ID の拒否は WP-4256 で test に固定済み。

## 5. 優先度の提案(採否は人間判断)

| # | 項目 | 効果 | 前提 |
|---|---|---|---|
| 1 | 監査チェーン検証の有界化(2.1) | 唯一の**上限なし**の劣化要因を止める | SSOT 改版(DB-005 §6.3)+ 完全性を落とさない設計。既存 blocker と同領域 |
| 2 | 業務規則の配置是正(3.1) | 本番経路が dev scaffolding に依存する状態を解消 | 実装配置のみ。SSOT 改版不要 |
| 3 | 監査ルートの切り出し(3.2) | 1 の差分をレビュー可能な大きさにする | 1 の前段として実施すると効果的 |
| 4 | calculation の分割(3.3) | 改定対応の変更コストを下げる | 挙動不変のリファクタとして単独実施可 |

2 と 4 は挙動不変で SSOT に触れないため、単独の WP として着手できる。
1 は登録済み blocker と同領域であり、**現行の凍結状態を解除しないまま**設計を
先に固める順序になる。
