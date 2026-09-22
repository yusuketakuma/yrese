# WP-7407(仮番) pre-review packet — 薬剤師資格 evidence 登録/取消 route

- 作成: 2026-09-19(WP-7406 点検着地後の human-gate 入力起案)
- 正本: `docs/security/pharmacist_qualification_boundary.md` SEC-010
  (APPROVED 0.1.0)、State.md human 承認待ち (3)、Plans.md WP-7401 実績の
  「登録/取消 route は後続 WP」
- base SHA: `5307d3a`
- task mode: PLAN_ONLY — 本 packet は承認取得用の起案。承認まで実装しない。

## 1. 目的

`actor_qualifications` テーブル(migration `000020` で作成済み・append-only
trigger + `recorded_seq` tiebreak 済み)に対する**登録・取消・一覧参照の
管理経路**を実装する。現在は read 側(`hasActiveQualification`)のみ実装で、
evidence の投入経路が dev 用 `YRESE_DEV_PHARMACIST_GRANTS` と PG 直接 INSERT
しかない — production 相当の管理面として fail-closed のまま閉じる。

## 2. 対象 route(案)

| route | scope | 概要 |
|---|---|---|
| `POST /qualifications` | `user:admin` | 資格 evidence 登録(ACTIVE record 追加) |
| `POST /qualifications/{qualificationId}/revoke` | `user:admin` | 取消(REVOKED record 追加 — 行更新ではない) |
| `GET /qualifications` | `user:admin` | tenant/pharmacy 内 evidence 一覧(status 別)。`licenseRef` は応答に含めない |

(GET は最小限かつ admin 限定。個別 GET `/{id}` は要否を D-2 で審議)

### リクエスト/応答(案)

```jsonc
// POST /qualifications
{
  "actorId": "user-...",                 // 対象 actor(≠ 実行者)
  "qualificationKind": "PHARMACIST_LICENSE",
  "licenseRef": "免許番号等の照合参照",     // 応答・監査・log へ再出力しない
  "verifiedAt": "2026-09-19T09:00:00Z"
}
// → 201: { qualificationId, actorId, kind, status:"ACTIVE", verifiedBy, verifiedAt }
//   (licenseRef を echo しない)

// POST /qualifications/{id}/revoke
{ "revokeReason": "..." }               // 非空。record 追加で表現
// → 201: { qualificationId, status:"REVOKED", revokedBy, revokedAt }
```

## 3. SEC-010 §2 不変条件の写像

| 不変条件 | 実装方針 |
|---|---|
| append-only(取消も新規 record) | UPDATE なし。revoke は REVOKED status の INSERT。既存 trigger が UPDATE/DELETE/TRUNCATE を拒否 |
| `licenseRef` を監査/log/error/外部送信へ出さない | 監査 payload は record ID+actorId+verifier のみ(MOD-008 登録候補 `actor_qualification.verified`/`revoked`)。response にも含めない。GET 一覧は licenseRef 除外 |
| `verifiedBy ≠ actorId`(自己検証禁止) | service 層 guard → 422/409。open_question(1人薬剤師薬局)は D-3 |
| `user:admin` + tenant/pharmacy 一致 | trusted context で検証。scope 不足 403 |
| 同一 tx で監査 | record INSERT + audit append を単一 tx(PG)。in-memory は parity |
| 取消後の confirm が即座に 403 | `hasActiveQualification` が最新 record を読むため即時反映。遅延なしを回帰テストで固定 |

## 4. Error codes(候補・MOD-006 登録対象)

| code | 状況 |
|---|---|
| `QUA-0001` | actor/record 不存在(revoke 対象なし、別 scope 隔離) |
| `QUA-0002` | `verifiedBy === actorId` 自己検証 |
| `QUA-0003` | 既 REVOKED への再取消(idempotent replay との区別は D-4) |
| `QUA-0004` | request shape 不正 |

## 5. 設計決定(D-系・要承認)

- **D-1**: route 面の切り方 — `/qualifications` 直下 vs `/admin/…` 配下。
  前者案(MOD-007 の admin scope で保護される resource として)。
- **D-2**: `GET /qualifications/{id}` 個別参照の要否。
- **D-3**: SEC-010 §2 open_question — `verifiedBy ≠ actorId` を厳格適用すると
  1人薬剤師薬局で誰も登録できない。代替統制(例: tenant 外 supervisor
  actor の定義)を本 WP で扱うか、【HG medical-safety】へ送るか。
  → 推奨: 厳格適用したまま実装し、代替統制は human review へ。
- **D-4**: revoke の冪等 — 同一 Idempotency-Key 再送は replay、
  別 key で既 REVOKED は 409(QUA-0003)か 200 か。先例(WP-7404
  `invalid_transition`)に倣い別 key は 409 案。
- **D-5**: 監査 event 名を MOD-008 へ登録する改版
  (`actor_qualification.verified`/`revoked` — registry 行追加)。

## 6. テスト計画(実装時)

- in-memory + PG parity: register→ACTIVE 反映→confirm 実行可能、
  revoke→即座 403(遅延なし)、append-only(取消で旧 record 不変)、
  self-verification 拒否、scope 不足 403、licenseRef が
  response/audit payload/log に出ないこと、Idempotency-Key replay。
- PG: UPDATE/DELETE/TRUNCATE trigger 拒否は 000020 で担保済み(再検証)。
- audit chain: verified/revoked の append-only + outbox 不要(内部イベント)。

## 7. 範囲外(human gate・別 WP)

- 免許番号の公的照合(RB-003【EXT】、SEC-010 §5)。
- 資格有効期限(免許更新)列 — MVP は失効日なし・取消のみ(SEC-010 §1)。
- production での登録/confirm 実行(C-084 human medical-safety approval)。
- migration 追加なし(000020/000021 の既存 schema で充足 — 次番号 000025
  は不要の見込み。要否は実装時に再確認)。

## 8. 実装状況・独立 review

(承認後に実施 — 結果をここに追記)
