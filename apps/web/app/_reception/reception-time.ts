import { CalendarDate } from "@yrese/date-time";

export const receptionBusinessDateInvariantErrorMessage =
  "Reception business date could not be derived";
export const receptionAcceptedTimeInvariantErrorMessage =
  "Reception accepted time could not be formatted";
// MOD-011 defines MVP business dates as fixed JST. IANA Asia/Tokyo applies
// historical local-mean offsets to ancient years, so it is not authoritative here.
export const japanStandardTimeOffsetMilliseconds = 9 * 60 * 60 * 1_000;

function fixedJstParts(
  instant: unknown,
  invariantErrorMessage: string,
): { readonly date: string; readonly hour: number; readonly minute: number } {
  try {
    const epochMilliseconds = Date.prototype.getTime.call(instant);
    if (!Number.isFinite(epochMilliseconds)) {
      throw new Error(invariantErrorMessage);
    }
    const jstWallClock = new Date(
      epochMilliseconds + japanStandardTimeOffsetMilliseconds,
    );
    const year = Date.prototype.getUTCFullYear.call(jstWallClock);
    const month = Date.prototype.getUTCMonth.call(jstWallClock) + 1;
    const day = Date.prototype.getUTCDate.call(jstWallClock);
    const hour = Date.prototype.getUTCHours.call(jstWallClock);
    const minute = Date.prototype.getUTCMinutes.call(jstWallClock);
    if (![year, month, day, hour, minute].every(Number.isSafeInteger)) {
      throw new Error(invariantErrorMessage);
    }
    return {
      date: CalendarDate.fromParts({ year, month, day }).toString(),
      hour,
      minute,
    };
  } catch {
    throw new Error(invariantErrorMessage);
  }
}

export function formatAcceptedTime(acceptedAt: string): string {
  const { hour, minute } = fixedJstParts(
    new Date(acceptedAt),
    receptionAcceptedTimeInvariantErrorMessage,
  );
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}


/**
 * 受付業務日付の UI 既定値(JST 固定 — WP-4053)。
 * toISOString() は UTC 日付になり JST 00:00〜08:59 に前日を返すため使わない。
 * 業務日付のタイムゾーン規律は MOD-011 改版(WP-4053)が正本。
 */
export function todayAsIsoDate(now?: unknown): string {
  const instant = arguments.length === 0 ? new Date() : now;
  return fixedJstParts(instant, receptionBusinessDateInvariantErrorMessage).date;
}

/**
 * URL の ?date= から業務日付(YYYY-MM-DD)を取り出す(監査 S-03)。
 * 共有・復元してよいのは PHI を含まない業務日付のみ。患者検索クエリ(氏名等)は
 * PHI がブラウザ履歴・リファラ・ログに残るため URL へ永続しない(意図的な除外)。
 */
export function parseDateParam(search: string): string | undefined {
  const value = new URLSearchParams(search).get("date");
  if (value === null) {
    return undefined;
  }
  try {
    return CalendarDate.fromString(value).toString();
  } catch (error) {
    if (error instanceof RangeError) {
      return undefined;
    }
    throw error;
  }
}

