# yrese_four_battles_strategy — 4つの戦い 戦略各論

```yaml
ssot_id: PRD-009
title: yrese 4つの戦い(業界閉塞への対抗戦略 各論)
domain: product
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.2.0 §2〜§8, PRD-006, PRD-007, PRD-008]
impacts: [Plans.md 優先順位, WP-0042〜0047 SSOTパック]
```

PRD-006 の4本柱を、v0.2.0 §4「yreseが戦う4つの閉塞」に対応する戦略各論として SSOT 化する。
各戦いの実装詳細は対応する下流 SSOT(WP-0042〜0047)へ委譲し、本書は方針と勝利条件のみ定める。
判断が PRD-008 ドクトリンと衝突する場合は PRD-008 が優先する。

## 戦い1 — NSIPS 支配の打破(閉じた連携と進歩停滞)

- **方針**: 排除ではなく周縁化。Pharmacy Integration API(OpenAPI 3.1 / OAuth2 CC / mTLS / 署名付き Webhook / Idempotency)を第一級とし、NSIPS は正規許諾取得時のみ Legacy Adapter として境界層に閉じ込める(ARC-003)。
- **法的清潔さ**: NSIPS 仕様の無許諾複製・模倣・推測互換実装をしない。許諾未取得の間、NSIPS 依存機能は BLOCKED_NSIPS_LICENSE。
- **勝利条件**: パートナーが会員手続き・許諾交渉なしに sandbox 接続開発を開始でき、「NSIPSにしか繋がらない」ロックインの再生産が止まること。
- **下流**: ARC-003 / ARC-004 / WP-0042(FHIR canonical)/ WP-0036(Integration Hub)。

## 戦い2 — 品質で勝つ(低品質シェアの構造)

- **方針**: 「品質が高いと言う」のではなく「品質を第三者が検証できる」状態を作る。evidence_id / calculation_trace / fail-closed / golden test の公式 evidence 1:1 対応。
- **公開 KPI**: 返戻率を含む品質 KPI を匿名化・同意・契約整理のうえ公開する。設計は WP-0043(quality_transparency_strategy / public_quality_kpi_policy / claim_return_rate_kpi_policy)で確定する。
- **勝利条件**: 市場の情報非対称性が崩れ、検証可能な品質が参入障壁として機能すること。
- **下流**: WP-0043 / OPS 系 SLO SSOT / conformance test 公開。

## 戦い3 — 24/365(止まる運用の打破)

- **方針**: 夜間バッチの廃止(締め=ロック操作でありバッチ時間ではない)。Cloud Core は zero-downtime 更新、Pharmacy Edge Node は LOCAL_ONLY で受付・仮算定・仮帳票・監査ログを継続する。
- **正直な継続性**: 「動いているように見せる」のではなく、モードごとにできること/できないこと/復旧後に必要なことを明示する(ARC-001 offline_mode_matrix、PENDING 系ステータス)。
- **勝利条件**: 在宅・夜間当番・24時間薬局の実需で「クラウドが落ちたら薬局が止まる」構造を持たないこと。SLO を公開値として運用すること。
- **下流**: WP-0044(イベントソーシング+projection)/ WP-0045(always-on・no-nightly-batch)。

## 戦い4 — 連携基盤で発展させる(弱い連携の構造)

- **方針**: Integration Hub(partner registry / scope・consent / event catalog / Webhook / Outbox・Inbox / 監査 / sandbox / SDK / versioning・deprecation policy)を第一級ドメインとして実装する。
- **API-first dogfooding**: yrese UI 自身が公開 API の最初の利用者。最初の外部接続クライアントは PH-OS(参照連携)。専用裏口 API・直接 DB 参照・パートナー個別の場当たり仕様は禁止。
- **勝利条件**: 電子薬歴・監査機器・在庫・POS・お薬手帳が「申請から数日で sandbox 接続」できる開発者体験。接続先が増えるほど yrese の価値が増える構造。
- **下流**: WP-0036(Integration Hub SSOT 11本)/ WP-0046(API-first・PH-OS・OSS)/ WP-0047(WORM 監査・テナント分離)。

## 横断原則

1. 4つの戦いは v0.2.0 §28 停止条件・PRD-008 D1(法令・医療安全・請求正確性)の上には立たない。
2. ベンチマーク(PRD-004/005)は模倣リストではなく現在地の記録。差別化は本書で行う。
3. 各戦いの進捗は Plans.md の WP 消化で測り、戦いに資する WP を同リスク・同コストの他 WP より優先する。

## 変更履歴

- 0.1.0 (2026-07-09): WP-0041 により起案(PROPOSED)。PRD-006 v1.1.0 の戦略具体化を各論として SSOT 化。
