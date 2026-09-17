# WP-7202 / WP-7203 pre-review packet(R3 実装前 human decision 材料)

```yaml
document_kind: human_pre_review_packet
status: AWAITING_HUMAN_DECISION
work_packages: [WP-7202, WP-7203]
created_at: 2026-09-18
risk_class: R3 (both)
prepared_by: devin active_root_writer (maker — 本packetは判断材料であり、makerの自己承認ではない)
oracle_used: false (user instruction 2026-09-17: oracleは使用しない)
implementation_authority: 0 (human decision 記録まで実装・stage・landing 禁止)
decisions_required: 5
```

## 1. 目的

PRC-003 DoR #10 / AGT-018: R3 実装は「required specialist review に加えて該当する
human authority の事前 review record」が揃うまで開始しない。本 packet はその判断材料を
凍結したものである。人間の決定(APPROVE / APPROVE_WITH_CONDITIONS / AMEND / REJECT)が
本書 §6 に記録されて初めて R3 pre-review record が成立する。

## 2. WP-7202 — 患者登録・更新 API(POST/PUT /patients)

### 2.1 承認済み根拠(すべて APPROVED)

- **API-001 0.3.0**(patient_search_contract.md): POST /patients + PUT /patients/{id}。
  独立 review 訂正反映済み — `patient:write`+`patient:read` 併須(重複候補が PHI を返すため)、
  `phone`/`note` 削除(永続列・属性定義なし)、Idempotency-Key `[A-Za-z0-9_-]{16,128}`、
  PUT は If-Match + expectedVersion CAS(412 PAT-0004)、patientNumber は PUT で不変
  (422 PAT-0005)、identity field 変更は append-only `patient_identity_history` へ記録。
- **MOD-006 0.1.3**: PAT-0003〜0006 登録済み(status を APPROVED/未実装 へ訂正済み)。
- **MOD-008**: `patient.created` / `patient.updated` / `patient.searched` 既存種別
  (payload は patientId のみ、PHI 値を載せない)。registry 改版不要。
- **DOM-002 §2**: カナ必須。migration 000002 の `patients` 列(name/kana/birth_date/sex/
  patient_number + CHECK)と wire が一致することを実コードで確認済み。
- **UIX-001 §11.1/§12**: 新規登録は SCR-002(患者検索・選択, U4)の患者特定フロー内。

### 2.2 scope

| in | out(明示非目標) |
|---|---|
| POST /patients(Idempotency-Key、冪等 replay 200、PAT-0003/0006) | patient merge / 付け替え(C-029 lineage 承認待ち) |
| PUT /patients(If-Match CAS、差分 update、identity history 記録) | 連絡先・備考(永続列なし、別 DOM-002 改版) |
| migration 000015(version 列、idempotency 記録、identity history) | migration 適用(【HG】環境適用は別承認) |
| 監査 patient.created/updated/searched(同一 tx / undo 補償) | FHIR Patient write(API-008 cutover 規律不変) |
| Web: SCR-002 内の登録フォーム + POSSIBLE_DUPLICATE warning 表示 | 自動 merge・候補自動選択(契約で禁止) |

### 2.3 R3 根拠と必要 specialist 観点

- PHI write 経路の新設 + identity(取り違え防止が患者安全 U4)。
- privacy: POSSIBLE_DUPLICATE の候補列挙(要配慮情報の列挙アクセス →
  `patient.searched` 併記で監査済み設計かの確認)。
- data integrity: append-only history、CAS、idempotency 記録の atomicity。
- R3 review gate は maker≠checker が必須 → 別 context 独立 review(§5 決定事項)。

## 3. WP-7203 — Coverage(保険・公費)登録 API(GET/POST /patients/{id}/coverage)

### 3.1 承認済み根拠

- **API-020 0.1.0**(coverage_contract.md): append-only InsuranceCard / PublicExpense。
  期間重複 409(INS-0003)、priority 重複 409(INS-0004)、supersede 不存在/二重 409
  (INS-0005)、idempotency conflict 409(INS-0006)、asOf 必須(MOD-011)。
  UPDATE/DELETE は trigger で拒否(block_mutation 同型)。
- **MOD-006 0.1.3**: INS-0001〜0006 登録済み(APPROVED/未実装 へ訂正済み)。
- **MOD-008**: `insurance.updated` / `insurance.viewed` 既存種別。監査 payload に
  保険者番号・記号番号を入れない規律明記済み。
- **UIX-001 §12**: SCR-007(患者・保険・公費確認, U4, 未実装)が受入画面。

### 3.2 scope

| in | out(明示非目標) |
|---|---|
| GET(asOf 必須・有効行のみ・全履歴閲覧なし)/ POST(3 kind union) | 負担割合・公費の**算定利用**(CAL-R-024 BLOCKED 据置) |
| migration 000016(insurance_cards / public_expense_certificates + block_mutation trigger + 冪等記録) | migration 適用(【HG】) |
| supersede による訂正(新版のみ。UPDATE/DELETE なし) | 資格確認(ADP-004/API-019)との状態同期 — 別集約のまま |
| Web: SCR-007 保険タブ | 優先順位の正しさ判定(open_question は算定 SSOT 側に残る) |

### 3.3 R3 根拠

- 保険者番号・受給者番号は PHI 相当の要配慮情報の write 経路。
- 請求入力の事実を記録する集約(誤データが将来の算定に流入し得る)。
- specialist 観点: privacy(PHI 最小化・監査非搭載規律)、data integrity
  (append-only + trigger 拒否 + 期間重複検証の race)。

## 4. 共通の実装・検証方針

- Postgres: 対象 INSERT + 制約/重複検査 + 監査 hash-chain 追記を単一 tx(失敗は全 rollback)。
  in-memory は undo 補償で parity(WP-7201/7204 と同型)。
- route テスト: 認可 scope 不足 403、cross-tenant/pharmacy 404(存在非露出)、
  冪等 replay/conflict、監査巻戻し、検証 409 群を網羅。
- ゲート: typecheck / lint / 全 test / OpenAPI regen+drift / SSOT index / boundaries /
  secrets / calculation-purity / deps / sbom(WP-7205 と同一セット)。

## 5. 独立 review の構成(決定事項 D-4 参照)

Oracle 不使用の指示により、R3 review gate の独立 checker は
**変更作成に関与しない別 context(例: read-only subagent)への frozen-diff review**を想定。
従来の「native independent review FINDINGS_NONE」記録と同等の証跡を packet へ残す。
human authority の承認は別 context review を代替しない。

## 6. Human decisions(回答後に本節へ記録)

| # | 論点 | 推奨 | 決定 |
|---|---|---|---|
| D-1 | WP-7202 scope(§2.2)の承認。C-028 は API-001 0.3.0 で解消済みと確定するか | APPROVE | 未決 |
| D-2 | C-029 の位置づけ: patientNumber 不変・merge 経路なしのまま cutover blocker として維持するか(Plans.md の【HG】記述の解消) | 維持で APPROVE | 未決 |
| D-3 | WP-7203 scope(§3.2)の承認。CAL-R-024(算定利用)は範囲外のまま維持するか | APPROVE | 未決 |
| D-4 | UIX-001 §12.3 operation matrix への追加(SCR-002 患者 create/update、SCR-007 coverage read/write)を各 WP の実装 batch に含めて承認するか。否認なら Web phase を分離して API-only 先行 | 同一 batch で APPROVE | 未決 |
| D-5 | R3 review gate の checker 構成(§5)の承認 | APPROVE | 未決 |

## 7. 本 packet が権限を与えないもの

- migration 000015/000016 の**環境適用**(production/staging 含む一切)→ 別承認
- production PHI、外部送信、deploy、認証境界変更
- C-029 merge lineage、連絡先属性追加、算定接続 — 各々の SSOT/gate が正本
