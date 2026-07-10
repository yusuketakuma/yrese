# oss_sdk_and_schema_publication_policy — OSS/SDK 公開範囲方針

```yaml
ssot_id: API-005
title: OSS SDK・契約スキーマの公開範囲方針
domain: api
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
effective_from: null
effective_to: null
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required(ライセンス・法務)
version: 0.1.1
created_at: 2026-07-09
updated_at: 2026-07-11
source_refs: [構築プロンプト v0.2.0 §14(API-first / OSS)・§6(NSIPS境界隔離), PRD-006(柱4), PRD-009(戦い4), ARC-003(NSIPS境界)]
depends_on: [API-002, API-003, SEC-004(PIA), ARC-003, REG-001(source_registry)]
impacts: [WP-0036(Integration Hub), packages/contracts]
related_work_packages: [WP-0046, WP-0036, WP-9002-W5A]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5A metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions: []
blockers:
  - BLOCKED_LEGAL_REVIEW: ライセンス選定・公開の法務確認が完了するまで実公開しない
```

## 1. 目的と結論

「開かれたレセコン」の信頼は、パートナーが接続仕様を検証できる公開性から生まれる。
一方で PHI・公的仕様・マスター実体の漏出は絶対に許されない。

**結論: 公開してよいのは「yrese が自ら定義した接続仕様とその利用補助物」のみ。
第三者由来・患者由来・法令由来の実体データは公開しない。**

## 2. 公開してよいもの(allow-list)

| 対象 | 条件 |
|---|---|
| 契約スキーマ(@yrese/contracts の公開 API 分) | 該当契約 SSOT が APPROVED であること |
| クライアント SDK(契約からの生成物) | 生成元契約と同一バージョンで管理 |
| 接続サンプルコード・チュートリアル | fixture は完全合成データのみ(MOD-013) |
| Contract Test Kit(WP-0036) | 同上 |
| JAHIS / FHIR conformance test skeleton(v0.2.0 §14 明示のOSS対象) | JAHIS 仕様・公式仕様の本文・要約を一切埋め込まないこと(§3 の deny 優先)。skeleton の公開可否自体も BLOCKED_LEGAL_REVIEW 解除後 |

本 allow-list にないものは公開しない(fail-closed)。追加は本 SSOT の改版による。

## 3. 公開禁止(deny 例示 — 例示であって限定列挙ではない)

- **PHI/PII を含む一切のもの**(fixture・ログ・スクリーンショット・テストデータを含む)
- **NSIPS 仕様本文・その要約・推測互換情報**(ARC-003。ライセンスの有無にかかわらず転載禁止)
- **ONS 限定資料・オン資/電子処方箋/オンライン請求/PMH の公式仕様本文**(入手条件に従う)
- **JAHIS 仕様本文**(頒布条件に従う)
- **点数マスター・医薬品マスター等の実体データ**(配布権の確認なく再配布しない)
- 内部実装の秘密(鍵・証明書・インフラ構成の詳細)

## 4. ライセンスと公開手続

1. OSS ライセンスの選定(SDK・スキーマそれぞれ)は法務確認事項であり、
   **BLOCKED_LEGAL_REVIEW が解除されるまで実公開は行わない**。
   それまでは公開準備(リポジトリ分離設計・生成パイプライン)のみ先行できる。
2. 公開は人間の最終承認を必須とする(自動公開パイプラインを初期リリースで作らない —
   QUA-008 の公開判断と同じ運用)。
3. 公開物からの PHI/秘密検出は check:secrets と同型の機械ゲートを公開前に必須とする。
   ただし機械ゲートが実効的なのは PHI・秘密・実体データの検出までであり、NSIPS/公式仕様の
   「本文(著作物としての文章)」の混入は機械検出が本質的に弱い。この類型に対する実効統制は
   本条ではなく §4-2 の人間最終承認と公開リポジトリ分離である。
4. 公開後の撤回手順(誤公開時の削除・キーローテーション・影響通知)を公開開始前に
   Integration Hub SSOT(WP-0036)で確定する。確定前の公開開始は不可。

## 5. 停止条件(fail-closed)

- allow-list 外の公開 → 実施せず本 SSOT へ差し戻し
- ライセンス未確定での実公開 → BLOCKED_LEGAL_REVIEW
- 合成でない fixture・PHI 混入の疑い → 公開停止+インシデント手順(QUA-005)
- NSIPS/ONS/JAHIS 由来情報の混入 → 公開停止+ARC-003 / 各入手条件の手順へ

## 変更履歴

- 0.1.1 (2026-07-09): opus4.8 レビュー反映(source_refs を §14/§6 へ修正、v0.2.0 §14 明示の JAHIS/FHIR conformance test skeleton を条件付きで allow-list に追加、仕様本文混入への実効統制の所在を明確化)。
- 0.1.0 (2026-07-09): 初版起草(WP-0046)。
