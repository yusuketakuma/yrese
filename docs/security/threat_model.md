# threat_model — 脅威モデル(STRIDE × 信頼境界)

```yaml
ssot_id: SEC-003
title: 脅威モデル(STRIDE × 信頼境界 T1/T2/T2'/T3)
domain: security
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
effective_from: null
effective_to: null
source_refs:
  - 構築プロンプト v0.2.0 §34, §35, §33
depends_on:
  - docs/adapters/external_system_boundary.md(ADP-002 信頼境界定義)
  - docs/safety/medical_safety_risk_register.md(SAF-001)
impacts:
  - docs/security/edge_node_security_design.md
  - docs/security/tenant_isolation_design.md
  - docs/security/audit_log_design.md
related_work_packages: [WP-0009, WP-2002, WP-4012, WP-4047, WP-4080, WP-9002-W7A]
related_tests:
  - packages/events/src/events.test.ts
  - apps/api/src/server.test.ts
  - apps/web/app/api-transport.test.ts
  - pnpm check:deps
  - pnpm check:sbom
related_prs: []
evidence_ids: []
open_questions:
  - Edge Node の物理環境前提(サーバールーム有無・盗難リスク水準)は導入薬局プロファイルで再評価
  - DDoS 対策水準(WAF/Shield)の費用対効果(finops と往復)
blockers: []
change_log:
  - "2026-07-11 WP-9002-W7A metadata-only completion: body/status/version/approval/effective semantics unchanged"
  - 0.1.1 (2026-07-09): WP-4047 実装状態 drift 整備。供給網攻撃対策の dependency scan / SBOM CI 実装状態を WP-4012/b0ecf84+702c2f5 に同期(脅威判断は不変更)。
```

## 信頼境界(ADP-002 より)

- **T1**: Cloud Core ⇄ Pharmacy Edge Node(同期境界・インターネット経由)
- **T2**: Edge Node ⇄ 薬局内 Partner Systems(薬局内LAN)
- **T2'**: Cloud Core ⇄ 外部SaaS Partner Systems(インターネット)
- **T3**: Official Adapter ⇄ External National Systems(公的網・公式接続方式)

## STRIDE 分析

### T1: Cloud Core ⇄ Edge Node

| 脅威(STRIDE) | シナリオ | 対策(既存◎/計画○) | 残余リスク |
|---|---|---|---|
| Spoofing | 偽 Edge Node が同期接続 | ○ 端末証明書 + mTLS(§35)、デバイス登録制 | 証明書窃取 → 失効手順で対応 |
| Tampering | 同期イベントの改ざん | ◎ EventEnvelope payloadHash(@yrese/events)/ ○ 署名 | ハッシュ検証の運用抜け |
| Repudiation | 「その操作はしていない」 | ○ actor_id + device_id + 監査ログ(SEC-007) | オフライン時の時刻信頼性(clock drift 検出で緩和) |
| Information disclosure | 同期経路での PHI 漏えい | ◎ PHI≠none → encrypted 必須(events 不変条件)+ TLS | 鍵管理不備(KMS 設計で対応) |
| DoS | 同期エンドポイント飽和 | ○ WAF・レート制限・キュー背圧 | 長期断は LOCAL_ONLY で業務継続 |
| Elevation | Edge 権限で Cloud 管理操作 | ○ Edge 用最小権限トークン(tenant/pharmacy スコープ固定) | — |

### T2: Edge Node ⇄ 薬局内 Partner Systems

| 脅威 | シナリオ | 対策 | 残余リスク |
|---|---|---|---|
| Spoofing | 偽装機器が Integration API を呼ぶ | ○ partner app 管理 + OAuth2 CC + mTLS(§28) | 薬局内LANの物理アクセス |
| Tampering | 調剤指示データの改ざん | ○ 署名付きイベント + 監査ログ | 監査機器側の脆弱性(責任分界を契約明記) |
| Information disclosure | LAN 盗聴 | ○ LAN 内も TLS 必須 | 旧型機器の平文通信 → device_compatibility_matrix で対象外条件 |
| Elevation | scope 外 API 呼び出し | ◎ deny-by-default(requirePermission、WP-2002)+ tenant別 scope | — |

### T2': Cloud Core ⇄ 外部SaaS Partner Systems

T2 と同一契約(Integration API)。追加: data minimization / PHI classification によるフィールド最小化(§28)、テナント越え応答の禁止(SEC-006 isolation test)。

### T3: Official Adapter ⇄ External National Systems

| 脅威 | シナリオ | 対策 | 残余リスク |
|---|---|---|---|
| Spoofing | 偽の外部システム応答 | ○ 公式接続方式・電子証明書のみ使用(公式仕様外の接続禁止) | — |
| Tampering | 請求データの送信前改ざん | ○ 請求データロック + ハッシュ保存(§19)+ 監査ログ | ロック前の内部者操作(権限分離で緩和) |
| Repudiation | 送信済み/未送信の争い | ○ 送信結果・受付結果の保存(§19) | — |
| Information disclosure | 資格確認結果の過剰保持 | ○ スナップショット最小化 + 保存期間管理【要確認】 | — |

## 必須シナリオ(v0.2.0 指定)

| # | シナリオ | 主対策 | 参照 |
|---|---|---|---|
| 1 | **PHI 漏えい**(ログ経由) | PHI 平文ログ禁止(§9.6)、trace の PHI 排除設計(型レベル)、log redaction | SEC-004, @yrese/trace |
| 2 | **医療情報・請求データ改ざん** | tamper-evident 監査ログ、請求月ロック、出力ハッシュ | SEC-007, §19/§20 |
| 3 | **退職者アカウントによるオフライン操作** | オフライン認証 TTL、復旧後再検証、失効リストの Edge 配布、操作監査 | SEC-005 |
| 4 | **Edge Node 盗難・紛失** | ローカルDB暗号化 + ディスク暗号化、鍵は TPM/OS キーチェーン【要確認】、リモート失効、紛失時対応手順 | SEC-005 |
| 5 | **サポートアクセスの過剰権限** | サポート操作の監査ログ・PHI 最小化・本人確認(§9.2) | SEC-002 #10 |
| 6 | **テナント越えアクセス** | branded TenantId/PharmacyId 強制、cross-tenant test、鍵分離 | SEC-006 |

## 未対策・保留

- ランサムウェア対応のオフラインバックアップ要求水準【要精読 — GL7.0】
- Edge Node の物理封印・改造検知(導入形態確定後)
- 供給網攻撃(依存パッケージ): dependency scan + SBOM は CI 稼働中(WP-4012/b0ecf84+702c2f5)。署名検証・依存更新運用・追加SAST等は Phase 1 以降で継続検討
