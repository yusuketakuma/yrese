# evidence_verification_log — 公式資料検証台帳(WP-0014)

```yaml
ssot_id: REG-007
title: 公式資料検証台帳(evidence_id 発行候補)
domain: regulatory
status: APPROVED
owner: fable5
reviewers:
  - opus4.8
  - human_review_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
approved_at: 2026-07-09
approved_by: human_review (ユーザー承認「人間レビューはOKです」)
source_refs: 構築プロンプト v0.1.7 §11、docs/regulatory/source_registry.md(REG-001)
open_questions:
  - ONS限定資料(オン資外部IF仕様書・電子処方箋記録条件仕様)の入手手続き(人間の登録作業が必要)
  - 各PDFのハッシュ・取得日の記録(ダウンロード実施後に付与)
  - 告示第69号・保医発0305第6号の本文精読と適用範囲の確定
blockers: []
```

検証方法: WebSearch + 公式ドメイン(mhlw.go.jp / ssk.or.jp / jahis.jp / digital.go.jp / nichiyaku.or.jp)の一次確認。
検証度: **CONFIRMED** = 公式ドメインで版・存在を一次確認 / **SECONDARY** = 二次情報のみ / **NOT_FOUND** = 未発見。
CONFIRMED であっても、本文の精読・ダウンロード・ハッシュ記録・人間レビューを経るまで evidence_id は「候補」であり、実装根拠への昇格は source_registry の VERIFIED 化が条件。

## 検証結果(2026-07-09 実施)

### 1. 令和8年度診療報酬改定(調剤報酬)— CONFIRMED

- 正式名称: 令和8年度診療報酬改定。「診療報酬の算定方法の一部を改正する件」(令和8年厚生労働省告示第69号)、実施上の留意事項通知(令和8年3月5日 保医発0305第6号)
- 発行主体: 厚生労働省
- **施行日: 令和8年(2026年)6月1日**(本年度改定から4月ではなく6月施行)
- 公式URL: https://www.mhlw.go.jp/stf/newpage_67729.html (改定について) / https://www.mhlw.go.jp/stf/newpage_71068.html (説明資料等)
- 入手可否: 公開
- v0.1.7 記載との差異: なし(「令和8年度診療報酬改定」の実在を確認)
- evidence_id 候補: EVD-001(告示第69号・調剤点数表)、EVD-002(保医発0305第6号 留意事項)
- 実装上の要点: 処方日・調剤日が2026年5月以前のデータは旧点数表(令和6年度)適用。「当時有効版」の併存管理が必須(version_watchlist の方針どおり)

### 2. レセプト電算処理システム 記録条件仕様(調剤用)— CONFIRMED

- 正式名称: オンライン又は光ディスク等による請求に係る記録条件仕様(調剤用)**令和8年6月版**(医科・歯科・調剤とも令和8年6月版で統一)
- 発行主体: 社会保険診療報酬支払基金
- 公式URL: https://www.ssk.or.jp/seikyushiharai/iryokikan/iryokikan_02.html
- 併載: 電子レセプト作成の手引き(調剤)は令和6年9月版のまま/マスターファイル仕様説明書 令和8年度版(2026-05-01付PDF)
- 入手可否: 公開(PDF ダウンロード可)
- evidence_id 候補: EVD-003(記録条件仕様 調剤用 R8.6版)、EVD-004(作成手引き 調剤 R6.9版)、EVD-005(マスターファイル仕様説明書 R8年度版)
- 実装上の要点: WP-2102(電子レセプト生成)の BLOCKED 解除に直結する一次資料。ダウンロード・精読・golden test 期待値化が次アクション

### 3. 診療報酬情報提供サービス マスター配布 — CONFIRMED

- 正式名称: 診療報酬情報提供サービス ファイルダウンロード(基本マスター: 医薬品・調剤行為・コメント等)
- 発行主体: 厚生労働省(運用: 支払基金)
- 公式URL: https://shinryohoshu.mhlw.go.jp/shinryohoshu/downloadMenu/
- 入手可否: 公開(ZIP形式、全件/改定分)
- evidence_id 候補: EVD-006(医薬品マスター)、EVD-007(調剤行為マスター)、EVD-008(コメントマスター)
- 実装上の要点: マスター自動更新パイプライン(master_update_pipeline SSOT)の取得元として確定可能

### 4. オンライン資格確認等システム 外部インターフェイス仕様書 — CONFIRMED(所在)/ 入手は制限付き

- 正式名称: オンライン資格確認等システム外部インターフェイス仕様書ほか(医療機関等ONS で限定公開)
- 発行主体: 厚生労働省保険局/実施機関
- 公開範囲: **ONS(医療機関等システム事業者向け限定サイト)登録者のみ**。ベンダ向け技術解説書(令和7年12月版)は公開: https://www.mhlw.go.jp/content/10200000/000575785.pdf
- ポータル: https://iryohokenjyoho.service-now.com/csm (医療機関等向け総合ポータルサイト)
- v0.1.7 記載との差異: なし(ONS前提という前提どおり)
- evidence_id 候補: EVD-009(ベンダ向け技術解説書 R7.12)、EVD-010(外部IF仕様書 — ONS入手後に発行)
- 次アクション: **人間作業 — ONS へのベンダ登録手続き**(RB-002 解除条件)

### 5. 電子処方箋管理サービス 技術解説書 — CONFIRMED

- 正式名称: 電子処方箋管理サービスの導入に関するシステムベンダ向け技術解説書【医療機関・薬局】**2.04版(令和8年7月)**
- 発行主体: 厚生労働省 医薬局
- 公式URL: https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/denshishohousen_systemvendor.html(ページ上で 2.04版・令和8年7月 を確認)
- 併載: セルフチェックリスト 4.2版。**記録条件仕様は ONS 限定公開**
- v0.1.7 記載との差異: なし(「令和8年7月 2.04版以降」と完全一致)
- evidence_id 候補: EVD-011(技術解説書 2.04版)、EVD-012(セルフチェックリスト 4.2版)、EVD-013(記録条件仕様 — ONS入手後)

### 6. 医療情報システムの安全管理に関するガイドライン — CONFIRMED(第7.0版が実在)

- 正式名称: 医療情報システムの安全管理に関するガイドライン **第7.0版(令和8年6月)**
- 発行主体: 厚生労働省
- 公式URL: https://www.mhlw.go.jp/stf/shingi/0000516275_00006.html
- 主要改定点(第6.0版→7.0版): 保守委託機関編の新設、二要素認証対象の明確化(令和9年4月1日基準)、クラウドネイティブ型対応、パスワード要件見直し、サイバー攻撃前提のバックアップ/BCP具体化
- **v0.1.7 記載との差異: なし。※ REG-001/source_registry(f2作成)の「第6.0版が最新」は旧情報 — 第7.0版(令和8年6月)が最新であることを本検証で確定。source_registry 要修正**
- evidence_id 候補: EVD-014(GL第7.0版 本編・概説編・保守委託機関編)
- 実装上の要点: security_guideline_mapping SSOT は第7.0版ベースで作成する(二要素認証・保守委託の新要件を含む)

### 7. JAHIS 院外処方箋2次元シンボル記録条件規約 — CONFIRMED(Ver.1.11 が実在)

- 正式名称: JAHIS院外処方箋2次元シンボル記録条件規約 **Ver.1.11(2026年5月)**
- 発行主体: 一般社団法人 保健医療福祉情報システム工業会(JAHIS)
- 公式URL: https://www.jahis.jp/standard/detail/id=1233
- **v0.1.7 記載との差異: なし。※ REG-001(f2作成)の「Ver.1.10 が確認済み最新」は旧情報 — Ver.1.11 の存在を公式サイトで確定。source_registry 要修正**
- evidence_id 候補: EVD-015(2Dシンボル規約 Ver.1.11)
- 実装上の要点: QR読取(WP: 処方箋2次元シンボル)は Ver.1.11 準拠で設計。令和8年度改定対応の差分確認が必要

### 8. PMH(Public Medical Hub)医療費助成 — CONFIRMED

- 正式名称: PMH(Public Medical Hub)— 自治体と医療機関等をつなぐ情報連携基盤(医療費助成・予防接種・母子保健)
- 発行主体: デジタル庁
- 公式URL: https://www.digital.go.jp/en/policies/health/public-medical-hub / https://www.mhlw.go.jp/stf/seisakunitsuite/bunya/kenkou_iryou/iryou/iryouhijosei.html(医療費助成オン資: 自治体・ベンダ向け)
- 対応事業者リスト: 2026-03-11 更新版が公開(導入済み医療機関・薬局リスト)
- 入手可否: 概要資料・API仕様・検証チェックリスト等がデジタル庁サイトで公開(詳細仕様の一部は事業者向け)
- evidence_id 候補: EVD-016(PMH概要・制度資料)、EVD-017(PMH API仕様 — 入手範囲確認後)

### 9. NSIPS 利用許諾条件 — CONFIRMED

- 正式名称: 調剤システム処方IF共有仕様(NSIPS®)
- 発行主体: 公益社団法人 日本薬剤師会(2012年4月に著作権移管)
- 公式URL: https://www.nichiyaku.or.jp/yakuzaishi/activities/nsips / 利用希望: https://www.nichiyaku.or.jp/activities/nsips/use.html
- 許諾条件(公式サイト記載): 日本薬剤師会の内部審査 + NSIPS®会への入会が必要/調剤機器メーカー・医療関係団体に限定(個人不可)/年間事務管理手数料 10,000円(税別)/**「単一の薬局等の施設内における調剤機器同士の連動」用途に限定**
- v0.1.7 記載との差異: なし(「許諾取得まで実装凍結・仕様の複製禁止」の方針と整合。用途限定条件も v0.1.7 §29 の記載と一致)
- evidence_id 候補: EVD-018(NSIPS利用許諾条件ページ)
- 次アクション: **人間判断 — NSIPS会入会の要否・時期**(human_review_checklist 論点4)

### 10. オンライン請求(接続・送信手順)— CONFIRMED

- 正式名称: オンライン請求システム(社会保険診療報酬支払基金/国保連)
- 公式URL: https://www.ssk.or.jp/seikyushiharai/online/index.html ほか、準備資料: https://www.mhlw.go.jp/content/12400000/001239087.pdf(令和6年3月時点版)
- 接続方式: 閉域網 IP-VPN 方式/インターネット回線 IPsec+IKE 方式の2種。オンライン請求用電子証明書が必要(オン資端末との兼用可)
- 手続き: 毎月20日までに請求申出書提出 → 翌月15日までに設定ツール受領 → 電子証明書DL・導通試験 → 翌々月から請求開始
- v0.1.7 記載との差異: なし(公式手順への受け渡し方式の妥当性を裏付け)
- evidence_id 候補: EVD-019(オンライン請求接続・運用手順)
- 実装上の要点: MVPの「公式手順への受け渡しまで」という責務分界は妥当。直接送信自動化の凍結(RB-004)は継続

## サマリー

| 検証度 | 件数 |
|---|---|
| CONFIRMED | 10 / 10(うち2件は本文入手にONS登録等の人間手続きが必要) |
| SECONDARY | 0 |
| NOT_FOUND | 0 |

### source_registry(REG-001)への反映事項

1. **安全管理GL: 第7.0版(令和8年6月)が最新** — f2調査時の「第6.0版が最新」を上書き修正すること
2. **JAHIS 2Dシンボル: Ver.1.11(2026年5月)が最新** — 「Ver.1.10」を上書き修正すること
3. 令和8年度改定は **6月1日施行**(4月ではない)— date-time / マスター版選択ロジックの設計に反映
4. 電子処方箋技術解説書 2.04版(令和8年7月)は v0.1.7 指定と完全一致
5. ONS登録(人間作業)が RB-002(オン資外部IF)・RB-003(電子処方箋記録条件仕様)解除の前提

### BLOCKED 解除に向けた次アクション(優先順)

1. 記録条件仕様(調剤用)令和8年6月版 PDF のダウンロード・ハッシュ記録・精読(EVD-003 正式発行)→ WP-2102 の設計着手が可能に
2. 告示第69号・留意事項通知の調剤点数表精読(EVD-001/002)→ calculation_coverage_matrix の行単位解除開始
3. 基本マスターのダウンロードと構造確認(EVD-006〜008)→ master_update_pipeline 実装着手
4. ONS 登録手続き(人間作業依頼)
5. NSIPS会入会要否の人間判断
