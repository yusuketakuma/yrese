# WP-7402 pre-review packet — 処方確認・確定 command

```yaml
packet_id: WP-7402-PRE-REVIEW-20260919
created_at: 2026-09-19
status: DECIDED
base: fcc0878(main)
scope: POST /prescriptions/{id}/confirm + /finalize、immutable prescription_versions、
       actor_qualifications 資格ゲート、audit/outbox event、migration 000020
out_of_scope: 訂正版(WP-7403)、調剤記録(WP-7404)、資格 evidence 管理 route(本 packet §4)、
              production/staging 適用、外部配送 worker 有効化
```

## 1. 背景

WP-7302 で構造化 Rp draft と `RX-0001` 未解決ブロッカーが着地した。WP-7402 は
DOM-004 §1 の「仮受付/仮取込 → 薬剤師確認済み → 処方確定」遷移を API/DB に実装する。
Plans.md の WP-7402 記述・SEC-010(資格境界、APPROVED 済)・DOM-004 §1・C-061/C-063 が
実装根拠である。

## 2. 状態の置き場(D-1)

処方ライフサイクル状態をどこに持つか。

- **(a) `prescription_drafts.status` 列追加【推奨】** — draft は confirm 前の作業記録、
  status は `PHARMACIST_CONFIRMED` / `PRESCRIPTION_FINALIZED` の遷移先のみを保持
  (未確認 = status NULL または draft 相当の既定値)。単一 writer・単一行の CAS を維持。
  CHECK 制約 + 更新時遷移検証で fail-closed。
- (b) 別 `prescription_status` 表 — 状態の単一性が表間整合に依存し、
  draft 書込みガードが 2 表結合になる。採用しない。

決定: **(a)**。列値は DOM-004 §1 の英語識別子に揃え、draft 状態は NULL
(ライフサイクル未開始 = draft 編集可能)とする。

## 3. route 形状(D-2)

- **(a) `POST /prescriptions/{prescriptionId}/confirm`・`…/finalize`【推奨】** —
  ライフサイクル command は draft 編集 surface(`PUT /prescription-drafts/…`)と
  別 resource として露出し、契約上の責務分離を明確化。
- (b) draft route へ sub-action 追加 — 既存 PUT 系と冪等・CAS 規則が混在し混乱する。

決定: **(a)**。`{prescriptionId}` は `prescription_drafts.prescription_id`。
Idempotency-Key 必須は他 command route と同規則(同一再送 200、別 payload 409)。
confirm/finalize は副作用のある command なので POST。

## 4. 資格ゲート(D-3)

SEC-010 §3 は「scope + ACTIVE 資格 evidence の実行時判定」を要求し、
WP-7402 受入は「非資格 actor 403」を含む。evidence 永続化が未存在のため:

- **(a) `actor_qualifications` 表を migration 000020 に含め、read 側ガードのみ実装
  【推奨】** — 登録/取消の管理 route は本 WP に含めず後続 WP へ
  (SEC-010 §2 の不変条件を DDL で固定: append-only、status CHECK、PHI 列なし)。
  dev/test は fixture/seed で ACTIVE 資格を供給し、postgres では evidence 無しに
  confirm できないことを fail-closed で保証。
- (b) evidence 管理 route まで実装 — user:admin 権限管理 surface が増え、
  WP-7402 の固有範囲(confirm/finalize)を超過。

決定: **(a)**。`actor_qualifications` は登録経路を持たない read-only 参照表として
DDL 化し、登録経路 WP を Plans に追記する。

## 5. ガード集合(D-4)

| 操作 | ガード(すべて同一 tx で評価・拒否は fail-closed) |
|---|---|
| confirm | 認証+`prescription:confirm` scope + ACTIVE 薬剤師資格(SEC-010)/ draft 存在(404)/ status NULL(再 confirm・逆行 409)/ 受付 IN_PROGRESS(409)/ 全 Rp 解決済み(unresolved>0 → 409 `RX-0001`)/ 原本 metadata 必須項目(prescriptionType・prescriptionDate・defaultDays 充足、409) |
| finalize | 認証+`prescription:confirm` scope + ACTIVE 資格 / status=`PHARMACIST_CONFIRMED`(409)/ 未解決・metadata 再検証(confirm 後の改変検出)/ `prescription_versions` version=1 immutable snapshot + content hash 一致 |

- **確定後の draft PUT は 409**(受入条件)。confirm 後の編集について:
  - **(a) PHARMACIST_CONFIRMED 以降も PUT 拒否【推奨】** — 確認対象 content が
    不変であることを構造的に保証(確認済み後に内容が変わると確認行為が無効化される)。
    訂正は WP-7403 の新版経路のみ。
  - (b) FINALIZED のみ拒否、CONFIRMED では編集可(編集したら status を NULL へ戻す)
    — 自動逆行は DOM-004「逆行なし」と矛盾し、監査上も確認済み表示の信頼を損なう。

決定: **(a)**。status NULL 以外の PUT を 409。受入の「確定後 PUT 409」は
その包含として満たされる。

## 6. 監査・outbox(D-5)

- audit(MOD-008 へ追加): `prescription.confirmed` / `prescription.finalized`
  (outcome=success)と deny 時 `prescription.confirm.denied` /
  `prescription.finalize.denied`(outcome=denied、SEC-010 §4)。
  payload は prescriptionId + actorId のみ(PHI なし、免許情報禁止)。
- outbox(API-012/MOD-009 へ追加): `prescription.finalized` —
  payload は eventId/occurredAt/auditEventId/aggregate{type:prescription,id}+version。
  patient_ref 禁止の既規則に従う。`PARTNER_EVENT_TYPES` 第 2 event として追加。
  公開 event 名は catalog 表と 1:1。
- confirm は outbox 対象外(catalog 未登録のため)。

決定: 上記のとおり。audit/outbox/状態遷移/snapshot は**同一 DB tx**で原子化し、
監査失敗は遷移全体を失敗させる(SEC-007)。

## 7. スナップショット(D-6)

`prescription_versions`: 確定時点の不変版。列は
tenant/pharmacy/prescription_id + version + content(rp_groups+sourceMetadata の
正規形 JSONB)+ content_hash + confirmed_by/at + finalized_by/at + created_at。
- version=1 が finalize で生成。`content_hash` は draft の現行 hash と一致を検証
  (不一致 = confirm 後改変 → 409)。
- append-only: UPDATE/DELETE/TRUNCATE 拒否 trigger(000016 系パターン)。

## 8. Web(D-7)

確認画面(UIX-001 誤操作防止 + confirmation-dialog 規約):
- 「差分なし(保存済み content = 表示中 content)」「未解決 0」「原本 metadata 完備」
  の 3 条件を確認者へ表示してから confirm 可能。
- 確定は別の明示 dialog(薬剤師責任の文言 + 確定者 actor 表示)。
- 非資格・未解決・受付終端は route の 403/409 を notice 表示。
- status ≠ NULL の draft は編集不可表示(read-only)。

## 9. 決定記録

| # | 論点 | 決定 | 根拠 |
|---|---|---|---|
| D-1 | 状態の置き場 | (a) `prescription_drafts.status` 列 | §2 |
| D-2 | route 形状 | (a) `/prescriptions/{id}/{confirm,finalize}` | §3 |
| D-3 | 資格ゲート | (a) `actor_qualifications` 表 + read ガード、登録 route は後続 | §4 |
| D-4 | confirm 後の編集 | (a) status NULL 以外 PUT 409 | §5 |
| D-5 | 監査/outbox | confirmed/finalized/denied 4 種 + `prescription.finalized` outbox、同一 tx | §6 |
| D-6 | snapshot | version=1 immutable、hash 一致検証、append-only trigger | §7 |
| D-7 | confirm replay が finalize 後に到着 | **409 invalid_transition** を返す(正規の replay 返却は status=PHARMACIST_CONFIRMED の間のみ)。response 喪失→finalize→confirm 再送のレースでは、stale CONFIRMED view を返すより遷移済みを明示する方が安全 | R3 review F-11 |

承認: 「残タスクを実行。すべて許可」(2026-09-19、direct user instruction)により
推奨案を採用。承認は本 packet の設計決定のみで、production 適用・外部接続・
資格登録 route の実装は含まない。

## 10. 実装状況

- [x] contracts(prescription-lifecycle.ts + draft response lifecycle 項目 +
  partner event `prescription.finalized` + Idempotency-Key header 契約)
- [x] shared-kernel(PRESCRIPTION_STATUSES、RX-0002〜0006、MOD-006 登録)
- [x] migration `000020`(status 列 + 単方向/不変 trigger +
  `prescription_versions` append-only + `actor_qualifications` append-only +
  outbox aggregate_type 'prescription' 拡張(000007 §2 規定どおり CHECK+FK 一体置換))
- [x] API(in-memory + PG service、資格 read ガード SEC-010、deny 監査、
  Idempotency-Key replay、audit/outbox/version 同一 tx、PUT locked 409、
  `POST /prescriptions/{id}/{confirm,finalize}`、RX-0001〜0006 写像)
- [x] Web(チェックリスト + 確認 dialog + lifecycle lock + 403/409 安全写像)
- [x] MOD-008 0.2.8・API-012 0.1.1・MOD-009 0.2.2・MOD-005 §2.3・IDX-001 0.4.72
- [x] OpenAPI regen + drift check
- [x] 検証(実行済み): api 全 PASS(実 PG 統合 473 tests 含む: draft lifecycle・
  migration runner・outbox aggregate guard・trigger 実実行) / web 805 /
  contracts 全 PASS / typecheck / lint / OpenAPI drift / SSOT index(190) /
  boundaries / secrets / calculation-purity / deps / sbom / `git diff --check`
- [x] R3 独立 review round 1: **FAIL**(2H/7M/9L)。全 18 findings に対応:
  - F-1(H): partner projection が `version` を未投影 → payload 検証付きで
    `{version}` のみ公開面へ追加、不正 payload は fail-closed
  - F-2(H): fixture draft 応答の lifecycle 6 key 欠落 → 追加 + confirm/finalize
    endpoint と locked PUT を fixture に実装
  - F-3(M): PG confirm の lock 順(draft→reception)を save と同じ
    reception→draft へ修正(deadlock 解消)
  - F-4(M): in-memory で状態適用を evidence 書込み後へ移動(部分遷移解消)
  - F-5(M): in-memory outbox 結線・操作数をテストで固定
  - F-6(M): metadata ガードへ prescriptionType/date/defaultDays を追加(API+Web)
  - F-7(M): migration `000021` で identity(patient/reception/business_date)・
    lifecycle 記録・冪等 key の不変 trigger + `recorded_seq` 追加
  - F-8(M): 独自 review UI を `ConfirmationDialog` へ置換、患者再提示 +
    実行 actor 表示(dev は `u-dev` スタブ明記)
  - F-9/F-10/F-17(L): MOD-009 文言を実装へ整合(`<eventId>:1` 冪等 key、
    outbox_event_id ≠ audit_event_id の FK 構造、version は payload 保持)
  - F-11(L): confirm replay post-finalize は 409(D-7 に記録)
  - F-12(L): 資格チェックを存在確認より先へ(in-memory+PG、deny 監査は
    対象非存在でも記録)
  - F-13(L): `actor_qualifications.recorded_seq`(IDENTITY)を created_at
    同値の決定的 tiebreak へ
  - F-14(L): 子テーブル post-confirm 全 DML 拒否 + confirmed/finalized
    親行の DELETE 拒否 trigger
  - F-15(L): テスト追加 — PG outbox 障害 rollback・concurrent save/confirm・
    REVOKED/finalize.denied・監査 envelope/chain/outbox 連結・子表 tamper・
    in-memory 監査失敗原子性・projection・dialog
  - F-16(L): locked PUT へ `code: RX-0002` + Web 写像
  - F-18(L): in-memory `lifecycleView` を schema parse で PG と parity
- [x] 再検証(実行済み): api 1,279 PASS(実 PG 統合: draft lifecycle 25・
  migration runner・rollback/concurrent/tamper 含む) / web 808 /
  contracts 238 / typecheck / lint / OpenAPI drift / SSOT index(190) /
  boundaries / secrets / calculation-purity / deps / sbom
- [x] R3 再審査 round 2: 残 3M/1L を検出、全件修正:
  - R2-1(M): PG confirm が受付状態判定を draft status/replay 判定より先に
    評価 → lock 順は reception→draft のまま、status 判定を draft lock 後へ
    移動(同一 key replay が受付完了後も 200 を返す回帰テスト追加)
  - R2-2(M): in-memory が lock 取得前の record 複製を操作 → lock 内で
    `records.get(lockKey)` 再読込(save 差替えとの競合で wedge しない)
  - R2-3(M): fixture lifecycle 応答が view schema 非適合 →
    `fixtureLifecycleView`(contentHash/draftVersion/prescriptionType 付き)
    へ変更
  - R2-4(L): fixture が冪等 key を未保持・遷移 conflict に RX-0004 誤用 →
    key 保持 + key pattern 検証 + RX-0002 + finalize 時の再検証 parity
- [x] 再検証(実行済み): api 1,280 PASS(実 PG 統合: draft lifecycle 26・
  replay-after-completion 含む) / web 808 / contracts 238 / typecheck /
  lint / OpenAPI drift / SSOT index(190) / boundaries / secrets /
  calculation-purity / deps / sbom / `git diff --check`
- [x] R3 最終審査 round 3: fixture のみ残 2M(+comment-only 1L)を検出、修正:
  - R3-1(M): fixture が未解決用法を RX-0001 と誤判定 → 実装同様
    薬剤 item のみを数えるよう修正(未解決用法は制度上許容)
  - R3-2(M): fixture lifecycle エラーが `{code}` 形状 → 実 route 同様の
    `{errorCode, message}` 形状へ統一(locked PUT は framework 形状の
    `code` が正しく据置)
  - R3-3(L): `lockReceptionForLifecycle` の docstring が finalize も
    受付ロックすると誤記 → finalize は draft 単一ロックと明記
  - fixture を実起動して smoke 検証: PUT→confirm(未解決用法許容)→
    same-key replay→異 key RX-0002→finalize v1→locked PUT RX-0002
- [x] R3 審査 round 4: **PASS**(production code に defect なし)。
  fixture の非ブロッキング findings も対応:
  - RX-0004 ガード追加(confirm は受付 IN_PROGRESS のみ、seed 済み
    WAITING reception で 409 検証済み)
  - prescriptionId に businessDate を含め日付違い draft の衝突を解消
  - GET draft 応答から内部冪等 key を除外
  - RX-0001 メッセージを実 route と統一、migrationState を 000021 へ更新
- [ ] commit(着地時に更新)
