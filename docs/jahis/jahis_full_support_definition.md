# jahis_full_support_definition — JAHIS対応を名乗る条件

```yaml
ssot_id: JHS-002
title: JAHISフル対応の定義
domain: jahis
status: PROPOSED
owner: fable5
reviewers:
  - opus4.8
  - human_review_if_required
version: 0.1.0
created_at: 2026-07-09
updated_at: 2026-07-09
source_refs: [構築プロンプト v0.1.8 §0.0.4.10, REG-007, ADP-001, MST-002, CLM-002]
```


## 「JAHIS対応」を名乗る条件(v0.1.8 §0.0.4.10 を正式化)

対象標準ごとに、以下 6 条件を**すべて**満たした場合のみ「対応」を名乗ってよい。

1. 該当 JAHIS 仕様の**版が明確**である(JHS-001 に記載、evidence_id 発行済み)
2. 該当仕様の**入力・出力・検証・エラー処理が実装済み**である
3. **conformance test が通っている**(JHS-005 のテスト計画に基づく)
4. **文字コード・レコード順・項目定義のテストが通っている**(JHS-006/JHS-008)
5. **仕様差分の監視がある**(JHS-004 watchlist に登録済み)
6. **例外・未対応範囲を公開ドキュメントに明記**している

## 判定運用

- 条件充足が不明・一部未達の場合は `BLOCKED_JAHIS_CONFORMANCE_REVIEW` とし、対外表記(画面・ドキュメント・営業資料)で「対応」を使用しない。
- 判定は fable5 が行い、opus4.8 レビューを必須とする。判定結果は本SSOTの付録台帳に版・日付つきで記録する。
- 部分対応の対外表記は「(標準名)(版)の読み取りのみ対応」等、範囲を限定した表現のみ許可する。

## 判定台帳(現在)

| 標準 | 判定 | 根拠 |
|---|---|---|
| 2次元シンボル Ver.1.11 | BLOCKED_JAHIS_CONFORMANCE_REVIEW | 仕様本文未入手・実装未着手(条件1のみ部分充足) |
| 薬歴連携仕様 | BLOCKED_JAHIS_CONFORMANCE_REVIEW | 版未確認 |
| お薬手帳 Ver.2.6 | BLOCKED_JAHIS_CONFORMANCE_REVIEW | 本文未精読・実装未着手 |
