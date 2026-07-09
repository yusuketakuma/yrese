# api_first_dogfooding_policy — API-first dogfooding 原則

```yaml
ssot_id: API-002
title: API-first dogfooding 原則(自社 UI も公開 API と同一契約のみを使う)
domain: api
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - codex (backend実装可能性)
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §0.0.2.2, PRD-006(柱4), PRD-008(D6), PRD-009(戦い4)]
depends_on: [PRD-006, PRD-008, API-001, MOD-003(依存方向)]
impacts: [API-003, API-004, API-005, packages/contracts, apps/api, apps/web]
blockers:
  - API_CONTRACT_BLOCKED: 契約(@yrese/contracts)にない API の呼び出し・提供は実装しない
```

## 1. 目的と結論

「開かれたレセコン」の連携基盤は、外部パートナーに提供する API と自社が使う API が
同一であって初めて信頼できる(PRD-006 柱4 / PRD-008 D6)。

**結論: 自社 UI(apps/web)を含むすべての API 利用者は、公開 API と同一の契約
(@yrese/contracts の zod schema)経由でのみ API を呼ぶ。内部専用の抜け道 API を作らない。**

## 2. 原則

1. **単一契約**: API 契約の正本は @yrese/contracts(contract-first、API-001 で実績確立)。
   backend は契約 schema で入出力を検証し、frontend は契約由来型のみを参照する。
   契約外フィールドの仮定は禁止(v0.2.0 §0.0.2.2)。
2. **抜け道 API の禁止**: apps/web だけが呼べる非公開エンドポイント、契約に載らない
   隠しパラメータ・隠しフィールドを作らない。内部利用と外部公開で認可 scope が異なることは
   許容するが、**契約形状は同一**とする。
3. **同一の認可経路**: 自社 UI も deny-by-default 権限(requirePermission)・テナント境界の
   例外にしない。内部だからと権限検査を省略する実装は禁止。
4. **契約変更の単一手順**: 内部都合の変更も外部要望の変更も、同じ CONTRACT_CHANGE_REQUEST
   手順(API-001 §5)を通す。silent な契約変更は禁止。
5. **例外の扱い**: dev 専用スタブ(dev テナントヘッダ等)は本番で無効化されることを条件に
   許容する(既存の tenant-context 実装が先例)。それ以外の例外は本 SSOT の改版を要する。

## 3. 適用範囲

- 対象: apps/web、将来の別 UI・バッチ・社内ツール、PH-OS リファレンス連携(API-004)、
  外部パートナー。
- 対象外: Official Adapter(オン資・電子処方箋・オンライン請求・PMH)および JAHIS 連携の
  公的・業界指定インターフェース。これらは公式仕様に従う別レーンであり(DOM-006 §4)、
  本方針の「公開 API」には含めない。

## 4. 停止条件(fail-closed)

- 契約にないエンドポイント・フィールドの実装 → API_CONTRACT_BLOCKED
- 自社 UI 専用の認可バイパス・隠し API → 実装せず本 SSOT へ差し戻し
- 契約変更手順を経ない wire 形状の変更 → SSOT_UPDATE_REQUIRED

## 変更履歴

- 0.1.0 (2026-07-09): 初版起草(WP-0046)。
