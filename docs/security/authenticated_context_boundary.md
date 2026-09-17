# authenticated_context_boundary — 認証済み TenantContext 注入境界の設計

```yaml
ssot_id: SEC-009
title: 認証済み TenantContext 注入境界(production provider / 署名付き test-auth adapter / dev header 禁止条件)
domain: security
status: APPROVED
owner: codex_root
reviewers:
  - independent_verifier
  - security_critic
  - privacy_compliance_reviewer
  - api_contract_reviewer
  - data_integrity_auditor
  - human_review_required
version: 0.1.0
created_at: 2026-09-18
updated_at: 2026-09-18
approved_at: 2026-09-18
approved_by: direct_user_instruction (2026-09-18 一括承認); independent read-only review findings applied before finalization
effective_from: 2026-09-18
effective_to: null
source_refs:
  - C-083(production AuthContext / OIDC 設計 — dev header の非 production 化を固定)
  - C-034(位相依存 401/403/404/405 応答族の決定)
  - MOD-007(permission scope registry)
  - SEC-006(tenant_isolation_design)
  - apps/api/src/plugins/tenant-context.ts(現行実装)
  - apps/api/src/config.ts `resolveTenantContextMode`(現行 guard)
depends_on: [MOD-006, MOD-007, SEC-006]
impacts:
  - apps/api/src/plugins/tenant-context.ts
  - apps/api/src/config.ts
  - apps/api/src/main.ts
  - CI/E2E 認証経路
related_work_packages: [WP-7101]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "0.1.0 2026-09-18 finalization: 独立 read-only review の finding(AUTH-0004 採番・forbidden 除去・role→scope 表追加・405 行・opt-in flag 明記・MOD-006 依存)を反映後、direct human approval(一括承認)により PROPOSED→APPROVED"
  - "0.1.0 2026-09-18 WP-7101 初版起案(PROPOSED)。provider 抽象・claims→scope 写像・失敗応答族・dev header 禁止条件・署名付き test-auth adapter の条件を 1 文書へ固定する提案。コードは書かない。review と human approval まで実装根拠にしない"
open_questions:
  - OIDC provider の製品選定(IdP 自己ホスト vs 外部 IdP)は本記録では interface 抽象までに留め、具体製品は別決定
  - actor の薬剤師資格(qualification)検証は C-084【HG】— scope 写像は資格 claim を透過するだけで、資格の真正性検証は別 gate
  - role→scope 写像表(§3)は初版の仮確定であり、MOD-007 の role 既定割当 open_question を本表で閉じるか、MOD-007 側へ正本を移すかは承認時に決定
  - break-glass アクセス(C-086)は本境界の通常経路と分離し、監査必須の別 adapter として扱う(本記録では境界のみ規定)
blockers:
  - production 環境での有効化は C-083/C-085(runtime role + RLS proof)の human security approval まで禁止
  - dev header 経路の production 到達は現行 config guard で既に不可。本記録はその条件を明示し、緩和を意図しない
```

## 1. 目的と現状

現行 `TenantContextMode` は `'disabled' | 'dev_headers'` のみ。`dev_headers` は
`x-dev-tenant`/`x-dev-pharmacy`/`x-dev-actor`/`x-dev-scopes` を無検証で信頼するため、
`resolveTenantContextMode` が `YRESE_ALLOW_DEV_TENANT_STUB=true` かつ
`NODE_ENV ∈ {development,test}` かつ `repositoryMode === 'in_memory'` かつ
`DATABASE_URL` 未設定のときだけ許可する。
この結果、**postgres mode には認証済み到達経路が存在しない** — durable 環境では
全 scope 必須 route が 403 で fail-closed。

本記録は以下を固定する(実装は含まない):

1. 認証 provider の抽象 interface
2. production 用 OIDC claims → `TenantContext` 写像
3. CI/E2E 用の署名付き test-auth adapter と in_memory 限定 guard を安全に外す条件
4. 失敗時応答族(C-034 決定案)
5. dev header が production で不可能である条件の明文化

## 2. Provider 抽象

`TenantContext` の注入は単一の `TenantContextProvider` interface に統一する:

```ts
interface TenantContextProvider {
  readonly mode: TenantContextMode; // 'disabled' | 'dev_headers' | 'test_signed' | 'oidc'
  resolve(request: FastifyRequest): Promise<TenantContextResolution>;
}
type TenantContextResolution =
  | { readonly kind: 'resolved'; readonly context: TenantContext }
  | { readonly kind: 'unauthenticated' };  // 資格情報なし/不正/受理不能 → 401
```

- provider は `TenantContext` を返すだけ。route 側の scope 判定(MOD-007)は
  現行どおり provider 非依存とし、認可ロジックを provider に漏らさない
  (provider 側に `forbidden` 解決は存在しない — scope 不足は常に route が 403
  `AUTH-0003` を返す)。
- 認証失敗の分類(`unauthenticated` / 受理不能)は provider が決める。
  受理不能な credential(署名不正・期限切れ・未知 issuer)は 401 であり、
  存在非開示(404)や 403 に倒さない。

## 3. Production provider: OIDC claims → TenantContext

| TenantContext field | claim 来源 | 規則 |
|---|---|---|
| tenantId | `tenant` claim(IdP で tenant 単位の audience/issuer 分離) | 必須。欠落・未知値は 401 |
| pharmacyId | `pharmacy` claim | 必須。actor の所属 pharmacy 集合に含まれない値は 401 |
| actorId | `sub` + IdP 側 user registry の写像 | 必須 |
| scopes | `roles` claim → 下表の role→scope 写像で展開 | claim 内の生 scope 文字列を直接信頼しない。写像表にない role は捨てる(最小権限) |

**role→scope 写像表(初版 — MOD-007 の role 既定割当 open_question をここで仮確定)**
【要確認 — C-084 薬剤師資格検証の確定時に再審】:

| role | scopes |
|---|---|
| `pharmacist` | `patient:*`, `reception:*`, `insurance:*`, `public-expense:*`, `prescription:*`, `dispensing:*`(confirm 含む), `calculation:*`, `claim:read`, `report:*`, `master:read`, `audit-log:read` |
| `clerk`(事務) | `patient:*`, `reception:*`, `insurance:*`, `public-expense:read`, `prescription:read`, `calculation:read`, `claim:*`, `report:*`, `master:read` |
| `admin` | 全 resource の全 action(`master:admin`・`claim:finalize` 含む)。tenant 外へは及ばない |

- 薬剤師確認(`dispensing:confirm`)を `clerk` に与えないのは意図的(資格 boundary、
  C-084 と連動)。`admin` は運用管理者向けで、薬学的確定の human-gate を
  迂回しない(qualification 検証は別層)。

不変条件:

- 検証は issuer 公開鍵(JWKS)による署名検証 + `exp`/`aud`/`iss` の検査。
  検証失敗は `unauthenticated`。
- claims・token・生 JWT は log・audit・error 応答に出さない(PHI/secret 規則)。
- token の transport は TLS 前提。`Authorization: Bearer` 以外の経路
  (cookie・query param)は受理しない。
- actor が無効化・退職扱いの場合の判定は IdP/ユーザー registry 側の責務であり、
  API は検証済み claims のみを信頼する(プロビジョニング失効の伝播は C-083 後続課題)。

## 4. 署名付き test-auth adapter(CI/E2E)

dev header と別物の `test_signed` mode:

- **形式**: リクエストヘッダ `x-test-auth` に、テスト固定の秘密鍵で署名した
  compact credential(tenant/pharmacy/actor/scopes を payload に持つ)を付ける。
  署名は HMAC-SHA256(共有秘密)または Ed25519 — 鍵は CI secret / ローカル
  開発のみで、repo に commit しない。
- **postgres でも安全に外せる条件**(in_memory 限定 guard の解除条件、全て必須):
  1. `NODE_ENV === 'test'` または CI 環境変数の明示フラグ(`YRESE_TEST_AUTH=1`)
  2. 対象 DB が既知の test database 名 allowlist(`yrese_test*` のみ)に一致
  3. adapter の検証鍵が production IdP の鍵と**別系統**であること
     (同一鍵の使い回し禁止 — test credential が production で受理される
     経路を構造的に排除)
  4. `test_signed` mode の有効化は config で明示(`resolveTenantContextMode`
     に条件分岐を増やし、既定は disabled のまま)
- dev header は引き続き in_memory 限定のまま変更しない(test_signed と併存)。

## 5. 失敗時応答族(C-034 決定案)

| 状況 | 応答 | code |
|---|---|---|
| 資格情報なし・署名不正・期限切れ・未知 issuer | 401 | `AUTH-0004`(認証失敗の汎用。理由内訳を応答に含めない。**MOD-006 へ bounded amendment で登録** — 0001〜0002 は欠番として再利用しない) |
| 認証済み・route 要求 scope 不足 | 403 | `AUTH-0003`(現行維持) |
| 認証済み・scope 内だが対象が別 tenant/pharmacy | 404 | 存在非開示(現行維持。403 に倒さない) |
| route 存在・method 不一致 | 405 | framework 既定(Fastify)。route 契約外のため個別 code なし |
| `TenantContextMode === 'disabled'` で scope 必須 route | 403 | `AUTH-0003`(現行維持) |
| provider 内部障害(検証鍵取得失敗等) | 503 + retry なし | 汎用 error(PHI/内部情報を出さない) |

- 401/403/404 の区別は**リクエスト時点の位相**だけで決まり、対象行の存在有無に
  依存しない(存在非開示との整合)。405 は C-034 の範囲を framework 既定の
  まま固定する記録であり、新規 code は割当ない。

## 6. dev header の production 不可条件(明文化)

`dev_headers` mode が有効になるのは以下**すべて**を満たす場合のみ:

1. `YRESE_ALLOW_DEV_TENANT_STUB=true` の明示設定
2. `NODE_ENV ∈ {development, test}`
3. `repositoryMode === 'in_memory'`
4. `DATABASE_URL` 未設定

いずれか不成立で `dev_headers` が要求された場合は起動時に throw(現行
`devTenantContextConfigurationErrorMessage` の挙動を維持)。本記録はこの
条件を緩和せず、test_signed/oidc を追加する場合も dev header の条件は不変とする。

## 7. 受入条件(実装 WP 起票時の検証)

- provider 抽象が 1 interface に統一され、route 層は provider を区別しない。
- oidc mode: 署名不正・期限切れ・未知 issuer・claim 欠落 → 401、
  role 写像表にない role は scope に出ない(最小権限テスト)。
- test_signed mode: postgres + allowlist 外 DB 名では起動失敗、
  production 鍵系統との混用経路が存在しない。
- dev header: 上記 §6 の条件外では config が throw(回帰テスト)。
- claims/token が log・audit・error body に出ないことの grep/テスト。
