export interface CommandIntent {
  readonly label: string;
  readonly href: string;
  readonly rationale: string;
}

interface WeightedKeyword {
  readonly value: string;
  readonly weight: number;
}

interface IntentDefinition {
  readonly keywords: readonly WeightedKeyword[];
  readonly intent: CommandIntent;
}

const MIN_INTENT_SCORE = 3;
const STRONG_SECONDARY_SCORE = 5;

const INTENTS: readonly IntentDefinition[] = [
  {
    keywords: [
      { value: "電子処方箋", weight: 8 },
      { value: "処方箋", weight: 6 },
      { value: "受付", weight: 5 },
      { value: "qr", weight: 4 },
      { value: "取り込", weight: 3 },
    ],
    intent: { label: "受付を開く", href: "/", rationale: "受付・処方箋取込に関する指示" },
  },
  {
    keywords: [
      { value: "患者検索", weight: 8 },
      { value: "患者番号", weight: 6 },
      { value: "生年月日", weight: 5 },
      { value: "患者", weight: 4 },
      { value: "検索", weight: 1 },
    ],
    intent: { label: "患者検索を開く", href: "/patients", rationale: "患者検索・患者選択に関する指示" },
  },
  {
    keywords: [
      { value: "処方入力", weight: 8 },
      { value: "疑義照会", weight: 6 },
      { value: "残薬", weight: 5 },
      { value: "用法", weight: 4 },
      { value: "用量", weight: 4 },
      { value: "処方", weight: 3 },
      { value: "日数", weight: 2 },
      { value: "薬", weight: 1 },
    ],
    intent: { label: "処方入力を開く", href: "/prescriptions", rationale: "処方内容の確認・編集に関する指示" },
  },
  {
    keywords: [
      { value: "一部負担金", weight: 8 },
      { value: "会計", weight: 7 },
      { value: "領収", weight: 5 },
      { value: "返金", weight: 5 },
      { value: "未収", weight: 5 },
      { value: "支払", weight: 4 },
    ],
    intent: { label: "会計を開く", href: "/checkout", rationale: "会計・患者負担に関する指示" },
  },
  {
    keywords: [
      { value: "請求前点検", weight: 8 },
      { value: "レセプト", weight: 6 },
      { value: "請求", weight: 6 },
      { value: "点検", weight: 5 },
      { value: "エラー", weight: 1 },
    ],
    intent: { label: "請求前点検を開く", href: "/claim-check", rationale: "請求前点検に関する指示" },
  },
  {
    keywords: [
      { value: "月次締め", weight: 8 },
      { value: "再請求", weight: 6 },
      { value: "返戻", weight: 6 },
      { value: "締め", weight: 5 },
      { value: "月次", weight: 4 },
    ],
    intent: { label: "月次締めを開く", href: "/monthly-closing", rationale: "月次締め・返戻に関する指示" },
  },
  {
    keywords: [
      { value: "医薬品マスター", weight: 8 },
      { value: "マスター", weight: 7 },
      { value: "薬価", weight: 6 },
      { value: "医薬品", weight: 3 },
    ],
    intent: { label: "マスターを開く", href: "/masters", rationale: "マスター情報に関する指示" },
  },
  {
    keywords: [
      { value: "同期状態", weight: 8 },
      { value: "同期", weight: 6 },
      { value: "障害", weight: 6 },
      { value: "連携", weight: 5 },
      { value: "ステータス", weight: 2 },
    ],
    intent: { label: "同期状態を開く", href: "/sync-status", rationale: "外部連携・同期状態に関する指示" },
  },
  {
    keywords: [
      { value: "管理設定", weight: 8 },
      { value: "権限", weight: 6 },
      { value: "ユーザー", weight: 5 },
      { value: "管理", weight: 5 },
      { value: "設定", weight: 2 },
    ],
    intent: { label: "管理・設定を開く", href: "/admin", rationale: "管理・設定に関する指示" },
  },
];

function normalizeCommand(command: string): string {
  return command.normalize("NFKC").trim().toLowerCase();
}

/**
 * 画面候補だけを返すbounded resolver。
 * 弱い一致、複数の強い業務意図、未知の依頼はnullへ倒す。
 */
export function resolveOperatorIntent(command: string): CommandIntent | null {
  const normalized = normalizeCommand(command);
  if (!normalized) return null;

  const scored = INTENTS.map((candidate) => ({
    candidate,
    score: candidate.keywords.reduce(
      (sum, keyword) =>
        sum + (normalized.includes(normalizeCommand(keyword.value)) ? keyword.weight : 0),
      0,
    ),
  })).sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (best === undefined || best.score < MIN_INTENT_SCORE) return null;
  if ((scored[1]?.score ?? 0) >= STRONG_SECONDARY_SCORE) return null;
  return best.candidate.intent;
}

export interface OperatorShortcutContext {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly altKey?: boolean;
  readonly isComposing?: boolean;
  readonly targetIsTextEntry: boolean;
  readonly targetIsCommandInput?: boolean;
}

export function shouldFocusOperatorCommand(context: OperatorShortcutContext): boolean {
  if (context.isComposing || context.altKey) return false;

  const normalizedKey = context.key.toLowerCase();
  const commandShortcut =
    (context.ctrlKey === true || context.metaKey === true) &&
    normalizedKey === "k" &&
    (!context.targetIsTextEntry || context.targetIsCommandInput === true);
  const slashShortcut =
    context.key === "/" &&
    context.ctrlKey !== true &&
    context.metaKey !== true &&
    !context.targetIsTextEntry;

  return commandShortcut || slashShortcut;
}
