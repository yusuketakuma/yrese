# WP-7408(仮番) pre-review packet — production OIDC provider 実装

- 作成: 2026-09-19(WP-7406 着地後の human-gate 入力起案)
- 正本: `docs/security/authenticated_context_boundary.md` SEC-009
  (APPROVED 0.1.0 — provider 抽象・claims 写像・失敗応答族は確定済み)、
  State.md human 承認待ち (2)
- base SHA: `5307d3a`
- task mode: PLAN_ONLY — 本 packet は承認取得用の起案。承認まで実装しない。
  IdP の選定・環境 provisioning は別 human gate。

## 1. 目的

`TenantContextMode` に `'oidc'` provider を実装し、production 相当の
認証経路(JWT Bearer → `TenantContext`)を追加する。SEC-009 §3 の設計は
APPROVED 済み — 本 WP はその実装であり、写像表の再設計は行わない
(変更が必要なら SEC-009 改版へ送る)。

現状: `disabled` / `dev_headers`(in_memory 限定)/ `test_signed`(WP-7405、
test 限定)の 3 mode のみで、production 到達経路が存在しない。

## 2. 実装範囲(案)

1. **provider 抽象の統一**: `TenantContextProvider` interface への整理
   (SEC-009 §2)。route 層は provider 非依存のまま — scope 判定は現行
   `requirePermission`(MOD-007)を変更しない。
2. **`oidc` mode**:
   - `Authorization: Bearer <JWT>` のみ受理(cookie/query param 不受理)。
   - JWKS(issuer 公開鍵)による署名検証 + `exp`/`aud`/`iss` 検査。
     失敗・欠落・未知 issuer → `unauthenticated` → 401 `AUTH-0004`。
   - claims → TenantContext 写像(SEC-009 §3 表どおり):
     `tenant`/`pharmacy`/`sub` 必須、`roles` → role→scope 写像表で展開、
     表外 role は捨てる(最小権限)。pharmacy 所属集合外の値は 401。
3. **config gate**: `oidc` mode 有効化条件 — issuer URL・audience・JWKS URI
   の明示設定必須。未設定での `oidc` 要求は起動失敗。production での
   `dev_headers`/`test_signed` 不可条件は不変(SEC-009 §6、WP-7405 実装済み)。
4. **role→scope 写像表**: SEC-009 §3 の初版表をコード化
   (【要確認 — C-084 確定時に再審】の留保を維持)。表外 role は scope に
   出さないことをテストで固定。

## 3. 失敗応答(SEC-009 §5 の写像)

| 状況 | 応答 |
|---|---|
| 資格情報なし/署名不正/期限切れ/未知 issuer/claim 欠落 | 401 `AUTH-0004`(理由内訳を応答に含めない) |
| scope 不足 | 403 `AUTH-0003`(route 側、現行維持) |
| 別 tenant/pharmacy の対象 | 404 存在非開示(現行維持) |
| provider 内部障害(JWKS 取得失敗等) | 503 汎用(内部情報を出さない) |

## 4. 不変条件

- claims・token・生 JWT を log・audit・error 応答へ出さない(PHI/secret 規則)。
- `test_signed` 鍵と production IdP 鍵の混用経路が構造的に存在しないこと
  (SEC-009 §4-3 は WP-7405 で実装済み — 回帰テストで維持)。
- `dev_headers` の有効化条件を緩和しない(SEC-009 §6 不変)。
- qualification 検証(SEC-010)は別層 — `pharmacist` role の confirm scope
  実効には ACTIVE 資格 evidence が引き続き必須。

## 5. 設計決定(D-系・要承認)

- **D-1**: JWKS 実装の依存選択 — `jose` 系ライブラリ導入 vs 自前実装。
  推奨: 実績のある署名検証ライブラリ(自前 JWKS/署名検証は禁止級)。
  追加 dep は supply-chain gate(check:deps)対象。
- **D-2**: pharmacy 所属集合の判定根拠 — IdP claim の `pharmacy` 集合のみで
  見るか、tenant 内 pharmacy registry との照合も行うか(後者は user
  registry 依存 → WP-7407 系の admin 面と接続)。
- **D-3**: `oidc` mode の E2E 検証方法 — 実 IdP 不要の test IdP(fixture
  JWKS server)で署名検証経路を通す案。
- **D-4**: `admin` role が全 scope を持つ点の維持確認(SEC-009 §3 表どおり。
  qualification 別層により薬学的確定は迂回しない — 表記どおり実装)。

## 6. テスト計画(実装時)

- 署名不正・期限切れ・未知 issuer・aud/iss 不一致・claim 欠落 → 401。
- 写像表外 role → scope 不展開。`clerk` に `dispensing:confirm` が出ない。
- `tenant`/`pharmacy` claim と trusted context の tenant/pharmacy 不一致 →
  401/404(存在非開示)。
- claims/token が log・audit・error body に出ないことの grep + テスト。
- postgres + `oidc` composition の buildServer 経路。
- `test_signed`/`dev_headers` との併存・排他条件の回帰。

## 7. 範囲外(human gate・別 WP)

- IdP 製品選定・テナント/クライアント登録・production/staging provisioning。
- ユーザー registry(actor 無効化・退職の伝播 — SEC-009 §3 後続課題、C-083)。
- `test_signed` → production への切替え運用手順。
- 資格登録 route(WP-7407 仮番 packet)は別 WP。

## 8. 実装状況・独立 review

(承認後に実施 — 結果をここに追記)
