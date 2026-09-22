# UIX-001 改版提案 — SCR-014/SCR-015 画面台帳行の実態同期

- 作成: 2026-09-19
- 対象 SSOT: `docs/uiux/medical_ui_ux_principles.md`(UIX-001、APPROVED 0.2.2)
- 由来: WP-7406 packet `wp7406_pre_review_packet_20260919.md` P-5
- 種別: 改版提案【HG】— 本書は提案であり、UIX-001 本体は改版承認まで不変

## 1. 提案の理由

UIX-001 §12 画面台帳の SCR-014/SCR-015 行が実装状態と乖離している:

| 行 | 現在の記載 | 実態 |
|---|---|---|
| SCR-014 薬剤師確認 | scope `dispensing:confirm`、未実装 | WP-7402 で `POST /prescriptions/{id}/confirm` + `/finalize` 実装済み。scope は `prescription:confirm`(SEC-010 資格判定を存在判定より先に評価、deny 監査)。不足は確認待ちの横断集計 read API のみ |
| SCR-015 疑義照会 | `prescription:write`【要確認】、未実装 | WP-7403 で `POST /prescriptions/{id}/inquiries` + `/inquiries/{id}/answer` + `GET` 2 本実装済み(処方単位)。不足は滞留の横断集計 API のみ |

この drift が UI 側 stale 文言(`operator-focus-board` の「薬剤師確認API
(dispensing:confirm)が未実装」等、WP-7406 で 8 箇所修正済み)の由来と推定される。
画面台帳が正本として残る限り同型 drift が再発し得るため、行の同期を提案する。

## 2. 提案する変更(diff 案)

UIX-001 §12 台帳(現行行は `medical_ui_ux_principles.md` 463-464 行目):

```diff
-| SCR-014 | 薬剤師確認 | 確認者・日時・前後 | dispensing:confirm | U4 | 未実装 |
-| SCR-015 | 疑義照会 | 照会中/回答/訂正 | prescription:write【要確認】 | U3 | 未実装 |
+| SCR-014 | 薬剤師確認 | 確認者・日時・前後 | prescription:confirm | U4 | confirm/finalize コマンド接続済み(WP-7402)。確認待ち横断キュー API は未提供 |
+| SCR-015 | 疑義照会 | 照会中/回答/訂正 | prescription:write | U3 | 処方単位の照会 route 実装済み(WP-7403)。滞留横断集計 API は未提供 |
```

- `prescription:write` の【要確認】は WP-7403 で scope 確定済みのため除去。
- SCR-010 調剤入力(`dispensing:write`、未実装)は WP-7404 で API 実装済みだが
  調剤 UI(SCR-010 画面)は WP-5113【REF】統合待ち — 行の「未実装」は
  画面非存在として正しいため本提案の対象外とする(判定を仰ぐ)。
- 付随して `docs/uiux/screen_inventory_draft.md`(UIX-007 SUPERSEDED)は
  改版対象外、docs/ui-ux-refresh/ の時点調査 doc も対象外。

## 3. 影響範囲

- 行為変更なし(ドキュメント truthfulness のみ)。コード・契約・API に影響しない。
- 改版に伴う UIX-001 version bump・改版記録・ssot_index 件数/版更新は
  承認後の同一 batch で実施する(UIX-001 §16.3 の規定どおり)。
- 改版 review は PRC-007 に従う(maker/checker 分離 + frozen diff)。

## 4. 根拠 evidence

- route 実装: `apps/api/src/prescription-lifecycle-routes.ts`
  (`prescription:confirm`)、`prescription-amendment-routes.ts`
  (`prescription:write`)、`dispensing-routes.ts`(`dispensing:confirm` は
  SCR-010 系調剤確定 — SCR-014 とは別 scope)。
- 着地記録: Plans.md WP-7402/WP-7403/WP-7404 行、State.md ACTIVE SNAPSHOT。
- UI 側修正(WP-7406 commit `5307d3a`): `operator-focus-board.tsx`、
  `prescription-launch-route.tsx`、`prescription-reception-boundary.tsx`、
  `prescription-workspace.tsx`、`prescriptions/README.md`、
  `north-star-journey.test.ts` docstring。

## 5. 承認を仰ぐ事項

1. §2 の diff 案どおり SCR-014/SCR-015 行を改版してよいか。
2. SCR-010 行の扱い(API 実装済み・画面非存在をどう記述するか)を本改版に
   含めるか、別提案へ送るか。
3. 改版実施の version(0.2.3 案)と同一 batch 範囲。
