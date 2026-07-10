# legacy_adapter_s3_lambda_policy — Legacy Adapter S3/Lambda 候補構成と停止条件

```yaml
ssot_id: ARC-004
title: NSIPS Legacy Adapter の S3/Lambda 候補構成・確定前提・fail-closed 停止条件
domain: architecture
status: APPROVED
approved_at: 2026-07-09
approved_by: opus4.8 review + fable5
owner: fable5
reviewers:
  - opus4.8
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-11
effective_from: null
effective_to: null
source_refs: [構築プロンプト v0.2.0 §6・§28, ARC-003, PRD-008 D2/D5]
depends_on: [ARC-003]
impacts: [NSIPS Legacy Adapter 実装WP(未起案), Integration Hub SSOT, ARC-001 offline_mode_matrix]
related_work_packages: [WP-0041, WP-9002-W5B]
related_tests: []
related_prs: []
evidence_ids: []
change_log:
  - "body history authority: 本文の変更履歴をversioned content historyのauthoritative sourceとして維持"
  - "2026-07-11 WP-9002-W5B metadata-only completion: body/status/version/approval/effective semantics unchanged"
open_questions:
  - pharmacy-LAN integration method
  - PHI handling, encryption, and storage location
  - medical information system safety guideline conformity
  - network responsibility boundary, communication path, and authentication
  - LOCAL_ONLY behavior
blockers:
  - BLOCKED_NSIPS_LICENSE
```

v0.2.0 §6 末尾の「S3へのファイル投下とLambda双方向変換は Legacy Adapter の候補構成であり、
yrese コアの前提ではない」を方針として確定し、確定に必要な前提と停止条件を定める。

## 位置づけ

- 本書の構成は**候補**である。yrese コアは本構成の存在を前提にしない
  (コアは ARC-003 の境界を通過した Canonical データのみを見る)。
- Adapter の実装 WP は、下記「確定前提」がすべて満たされるまで起案しない。

## 候補構成(参考)

```
[薬局内 NSIPS 対応機器] → ファイル → [S3(受信バケット)] → [Lambda 変換(双方向)] → [ARC-003 通過条件] → [yrese コア]
yrese コア → [Lambda 変換] → [S3(送信バケット)] → ファイル → [薬局内機器]
```

- 変換 Lambda は ARC-003 の通過条件(正規化・検証・監査・ステータス付与)を実装する場所の候補。
- S3 は薬局内 LAN とクラウドの分界点の候補。分界の実体(転送手段・暗号化・鍵管理)は未確定。

## 確定前提(すべて満たすまで構成を確定しない — v0.2.0 §6)

1. 薬局内 LAN 機器との連携方式の確認
2. 個人情報・医療情報の取り扱い整理(PHI 分類・暗号化・保存場所)
3. 医療情報システム安全管理ガイドライン(最新版)との適合確認
4. NSIPS 利用許諾の取得(未取得の間は BLOCKED_NSIPS_LICENSE — ARC-003)
5. ネットワーク分界(責任分界点・通信経路・認証)の確定
6. オフライン時動作(LOCAL_ONLY 時に Adapter がどう振る舞うか — ARC-001 と整合)の確定

## fail-closed 停止条件(Adapter 実装後の実行時規律)

1. **変換不能データは PENDING**: スキーマ不一致・検証失敗・未知の状態表現を持つデータは
   変換を試みず PENDING 系ステータスで隔離する。推測補完・黙殺・部分通過をしない。
2. **無断変換の禁止**: 対象薬局のテナント設定で Adapter が明示的に有効化されていない限り変換しない。
3. **監査必須**: すべての変換(成功・失敗・隔離)を audit イベントとして記録する。
   PHI を含むペイロードは暗号化必須(packages/events の不変条件に従う)。
4. **請求経路の分離**: Adapter 由来データはステータス付与(ARC-003)を経ない限り
   算定・請求の入力にならない。isClaimable の allow-list 規律を Adapter が迂回しない。
5. **双方向の対称性**: 送信方向(コア→機器)も同じ検証・監査を通す。コアの内部表現を
   そのままファイルへ書き出さない。

## 変更履歴

- 0.1.0 (2026-07-09): WP-0041 により起案(PROPOSED)。
