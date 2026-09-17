# pharmacist_qualification_boundary — 薬剤師資格 actor 境界の設計

```yaml
ssot_id: SEC-010
title: 薬剤師資格 actor 境界(confirm scope 付与条件・資格 evidence・非資格拒否)
domain: security
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - security_critic
  - privacy_compliance_reviewer
  - human_review_required
version: 0.1.0
created_at: 2026-09-19
updated_at: 2026-09-19
approved_at: 2026-09-19
approved_by: direct_user_instruction (WP-7401; 残タスク一括許可)
effective_from: 2026-09-19
effective_to: null
source_refs:
  - C-084(薬剤師資格境界【HG medical safety】)
  - C-022(非資格 actor の確定操作拒否 = 403 + 監査 deny)
  - RB-003(HPKI 連携は範囲外)
  - DOM-004 §1(仮受付/仮取込 → 薬剤師確認済みは薬剤師の明示操作)
  - MOD-007 §3(confirm action = 専門職確認・人間責任の明示)
  - MOD-007 §4(role→scope 既定割当は auth 設計 SSOT で確定)
  - SEC-009 §3(role→scope 写像表: dispensing:confirm は pharmacist role のみ)
  - MOD-008(監査 outcome = success / denied / failed)
depends_on: [MOD-007, MOD-008, SEC-009]
impacts:
  - apps/api/src/plugins/tenant-context.ts(将来)
  - actor/qualification 管理経路(将来)
related_work_packages: [WP-7401, WP-7402, WP-7404]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-09-19 WP-7401 起案・確定: confirm scope 付与条件・資格 evidence 保持/検証・非資格拒否応答を 1 文書へ固定。active_root_writer の self-review で検証者 scope(user:admin)と資格登録/取消の監査イベントを補強後、direct human approval(残タスク一括許可)により APPROVED。コード実装・migration・外部接続・production action は含まない"
open_questions:
  - 免許番号の照合(公的 registry 照会)は外部依存のため MVP では「登録者の目視確認 + 二重入力」レベルに留めるか(HPKI/外部照会は RB-003・【EXT】で明示除外)
  - 1人薬剤師薬局で verifiedBy が被検者自身になる場合の二者統制の代替(C-022 運用統制の人間レビューと連動)
  - 資格の有効期限(免許更新)を evidence に持つか — MVP は失効日なし(取消のみ)を提案
blockers:
  - production での資格 evidence 登録・confirm 実行は C-084 の human medical-safety approval まで禁止
```

## 1. 目的と現状

DOM-004 §1 は「薬剤師の明示操作」による PHARMACIST_CONFIRMED 遷移を要求し、
MOD-007 は `confirm` action を「専門職確認(人間責任の明示)」と定義する。
SEC-009 §3 の role→scope 表は `prescription:confirm`/`dispensing:confirm` を
`pharmacist` role にのみ付与するが、**role の付与そのものの真正性** —
「この actor は本当に薬剤師か」— は未定義のままである。

本記録は以下を固定する(実装は含まない):

1. confirm scope が actor に付与されるための資格 evidence 要件
2. 資格 evidence の保持形・検証者・監査
3. 非資格 actor の確定操作に対する拒否応答(403 + 監査 deny = C-022)
4. HPKI/外部照会の境界外宣言(RB-003)

## 2. 資格 evidence モデル

資格 evidence は tenant 内 actor registry の一部として保持する概念であり、
認証 claims(SEC-009)とは別層の**運用データ**である:

```
actor_qualification {
  tenantId, pharmacyId,
  actorId,                 // 対象 actor
  qualificationKind,       // 'PHARMACIST_LICENSE'(MVP はこの 1 種のみ)
  licenseRef,              // 免許番号等の照合用参照(監査・log には出さない)
  status,                  // 'ACTIVE' | 'REVOKED'
  verifiedBy,              // 検証実施者 actorId(admin または supervisor)
  verifiedAt,              // 検証日時
  revokedBy / revokedAt / revokeReason  // 取消時のみ
}
```

不変条件:

- append-only: 変更は新規 record(取消も status 遷移の記録として保持)。
- `licenseRef` は直接識別子相当として扱い、監査 payload・log・error 応答・
  外部送信へ出さない(監査 targetRef は actorId/record ID のみ)。
- `verifiedBy` は `verifiedBy ≠ actorId` を原則とする(自己検証の禁止)。
  1人薬剤師薬局の代替統制は open_question とし、人間レビューで確定する。
- 登録・取消の実行には `user:admin` scope(MOD-007 §3 admin = 権限付与等の
  管理操作)を要求し、tenant/pharmacy 一致を trusted context で検証する。
- 登録・取消は監査イベント `actor_qualification.verified` /
  `actor_qualification.revoked`(MOD-008 登録候補、payload は record ID +
  actorId + verifier actorId のみ)を同一 tx で記録する。

## 3. confirm scope の付与条件

confirm scope(`prescription:confirm` / `dispensing:confirm`)が actor に
**実効**するには、以下のすべてを満たす:

1. 認証 claims が `pharmacist` role → scope 写像で confirm scope を含む
   (SEC-009 §3 — scope の形式的存在)。
2. 当該 tenant/pharmacy で `actor_qualification(qualificationKind =
   'PHARMACIST_LICENSE', status = 'ACTIVE')` が存在する(資格の実体的存在)。
3. confirm 実行時点で 2 が有効であること(付与時点ではなく実行時判定 —
   失効後の confirm を構造的に拒否する)。

- `clerk`/`support` role には confirm scope を与えない(SEC-009 §3 維持)。
- `admin` role も薬学的確定の human-gate を迂回しない — admin が confirm
  するには admin 自身の `PHARMACIST_LICENSE` evidence が必要
  (role だけでは confirm できない)。
- scope claim と資格 evidence の乖離(claims は pharmacist だが evidence なし)
  は deny 対象であり、受理側の fail-open にしない。

## 4. 非資格 actor の拒否(C-022)

| 状況 | 応答 | 監査 |
|---|---|---|
| 認証済み・confirm scope を持たない | 403 `AUTH-0003` | route 側 scope 判定(現行) |
| confirm scope は持つが `ACTIVE` 資格 evidence なし/失効 | 403 `AUTH-0003` | `prescription.confirm.denied` / `dispensing.confirm.denied`(MOD-008 登録候補、outcome=denied、targetRef は prescription/dispensing ID + actorId のみ、理由内訳・免許情報は payload へ入れない) |
| 対象が別 tenant/pharmacy | 404 存在非開示 | 現行維持 |

- 資格判定は confirm route/command のガードとして実装し、UI だけの
  制御は禁止(MOD-007 の API 側必須規則と同じ)。
- deny 判定と監査記録は同一 tx で行い、監査失敗は操作全体を失敗させる
  (監査なし deny/実行は存在しない — SEC-007 規約)。

## 5. 境界外(明示)

- HPKI(薬剤師資格検証の公的インフラ)連携は RB-003 のとおり本境界の外。
  免許番号の真正性照合・電子署名検証は行わない。
- 外部 registry 照会による自動検証は【EXT】— MVP では `verifiedBy` による
  人間確認の記録で代替する。
- actor の採用・退職・IdP 側の失効伝播は C-083/SEC-009 の範囲。

## 6. 受入条件(実装 WP 起票時の検証)

- confirm route は scope 判定と資格判定を分離し、資格なし confirm は
  403 + deny 監査(同一 tx)を返す。
- evidence 未登録 actor への confirm scope 実効経路が存在しない
  (in_memory/seed 経路含む — dev fixture も evidence を必要とするかは
  実装 WP で決定;少なくとも test_signed/dev_headers の confirm 経路を
  本境界で制御する)。
- 取消後の confirm が即座に 403 になること(遅延なし)。
- `licenseRef` が監査・log・error・fixture へ出ないことの検証。
