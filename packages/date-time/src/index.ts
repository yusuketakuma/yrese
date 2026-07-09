/**
 * @yrese/date-time
 *
 * 診療系日付は wall-clock date semantics として扱う。
 * この package は timezone 変換を行わず、JST などの timezone policy は
 * date_time_policy SSOT 側で定義する。
 *
 * 算定関数が現在時刻へ暗黙依存しないよう、Date.now()/new Date() default は提供しない。
 * CalendarDate は 'YYYY-MM-DD' 文字列または整数 year/month/day からのみ構築する。
 */

export interface CalendarDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface ClaimMonthParts {
  readonly year: number;
  readonly month: number;
}

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;
const claimMonthPattern = /^(\d{4})-(\d{2})$/;
const minimumYear = 1;
const maximumYear = 9999;

function assertInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`${label} must be a safe integer`);
  }
}

function assertYear(value: number): void {
  assertInteger(value, "year");
  if (value < minimumYear || value > maximumYear) {
    throw new RangeError(`year must be between ${minimumYear} and ${maximumYear}`);
  }
}

function assertMonth(value: number): void {
  assertInteger(value, "month");
  if (value < 1 || value > 12) {
    throw new RangeError("month must be between 1 and 12");
  }
}

function compareParts(
  leftYear: number,
  leftMonth: number,
  leftDay: number,
  rightYear: number,
  rightMonth: number,
  rightDay: number,
): -1 | 0 | 1 {
  if (leftYear !== rightYear) {
    return leftYear < rightYear ? -1 : 1;
  }
  if (leftMonth !== rightMonth) {
    return leftMonth < rightMonth ? -1 : 1;
  }
  if (leftDay !== rightDay) {
    return leftDay < rightDay ? -1 : 1;
  }
  return 0;
}

function isLeapYear(year: number): boolean {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 1:
    case 3:
    case 5:
    case 7:
    case 8:
    case 10:
    case 12:
      return 31;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    case 2:
      return isLeapYear(year) ? 29 : 28;
    default:
      throw new RangeError("month must be between 1 and 12");
  }
}

function assertCalendarDate(parts: CalendarDateParts): void {
  assertYear(parts.year);
  assertMonth(parts.month);
  assertInteger(parts.day, "day");

  const maxDay = daysInMonth(parts.year, parts.month);
  if (parts.day < 1 || parts.day > maxDay) {
    throw new RangeError("day must be a real day in the provided month");
  }
}

function padYear(year: number): string {
  return year.toString().padStart(4, "0");
}

function padTwo(value: number): string {
  return value.toString().padStart(2, "0");
}

export class CalendarDate {
  private constructor(
    readonly year: number,
    readonly month: number,
    readonly day: number,
  ) {}

  static fromString(value: string): CalendarDate {
    const match = calendarDatePattern.exec(value);
    if (!match) {
      throw new RangeError("CalendarDate must be formatted as YYYY-MM-DD");
    }

    return CalendarDate.fromParts({
      year: Number(match[1]),
      month: Number(match[2]),
      day: Number(match[3]),
    });
  }

  static fromParts(parts: CalendarDateParts): CalendarDate {
    assertCalendarDate(parts);
    return new CalendarDate(parts.year, parts.month, parts.day);
  }

  compare(other: CalendarDate): -1 | 0 | 1 {
    return compareParts(this.year, this.month, this.day, other.year, other.month, other.day);
  }

  equals(other: CalendarDate): boolean {
    return this.compare(other) === 0;
  }

  toParts(): CalendarDateParts {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
    };
  }

  toString(): string {
    return `${padYear(this.year)}-${padTwo(this.month)}-${padTwo(this.day)}`;
  }
}

abstract class CalendarDateWrapper<TBrand extends string> {
  declare private readonly __dateWrapperBrand: TBrand;

  protected constructor(readonly date: CalendarDate) {}

  compare(other: CalendarDateWrapper<TBrand>): -1 | 0 | 1 {
    return this.date.compare(other.date);
  }

  equals(other: CalendarDateWrapper<TBrand>): boolean {
    return this.date.equals(other.date);
  }

  toCalendarDate(): CalendarDate {
    return this.date;
  }

  toString(): string {
    return this.date.toString();
  }
}

export class PrescriptionDate extends CalendarDateWrapper<"PrescriptionDate"> {
  private constructor(date: CalendarDate) {
    super(date);
  }

  static fromString(value: string): PrescriptionDate {
    return new PrescriptionDate(CalendarDate.fromString(value));
  }

  static fromParts(parts: CalendarDateParts): PrescriptionDate {
    return new PrescriptionDate(CalendarDate.fromParts(parts));
  }

  static fromCalendarDate(date: CalendarDate): PrescriptionDate {
    return new PrescriptionDate(date);
  }
}

export class DispensingDate extends CalendarDateWrapper<"DispensingDate"> {
  private constructor(date: CalendarDate) {
    super(date);
  }

  static fromString(value: string): DispensingDate {
    return new DispensingDate(CalendarDate.fromString(value));
  }

  static fromParts(parts: CalendarDateParts): DispensingDate {
    return new DispensingDate(CalendarDate.fromParts(parts));
  }

  static fromCalendarDate(date: CalendarDate): DispensingDate {
    return new DispensingDate(date);
  }
}

export class ReceptionDate extends CalendarDateWrapper<"ReceptionDate"> {
  private constructor(date: CalendarDate) {
    super(date);
  }

  static fromString(value: string): ReceptionDate {
    return new ReceptionDate(CalendarDate.fromString(value));
  }

  static fromParts(parts: CalendarDateParts): ReceptionDate {
    return new ReceptionDate(CalendarDate.fromParts(parts));
  }

  static fromCalendarDate(date: CalendarDate): ReceptionDate {
    return new ReceptionDate(date);
  }
}

export class ClaimMonth {
  private constructor(
    readonly year: number,
    readonly month: number,
  ) {}

  static fromString(value: string): ClaimMonth {
    const match = claimMonthPattern.exec(value);
    if (!match) {
      throw new RangeError("ClaimMonth must be formatted as YYYY-MM");
    }

    return ClaimMonth.fromParts({
      year: Number(match[1]),
      month: Number(match[2]),
    });
  }

  static fromParts(parts: ClaimMonthParts): ClaimMonth {
    assertYear(parts.year);
    assertMonth(parts.month);
    return new ClaimMonth(parts.year, parts.month);
  }

  static fromCalendarDate(date: CalendarDate): ClaimMonth {
    return new ClaimMonth(date.year, date.month);
  }

  compare(other: ClaimMonth): -1 | 0 | 1 {
    if (this.year !== other.year) {
      return this.year < other.year ? -1 : 1;
    }
    if (this.month !== other.month) {
      return this.month < other.month ? -1 : 1;
    }
    return 0;
  }

  equals(other: ClaimMonth): boolean {
    return this.compare(other) === 0;
  }

  next(): ClaimMonth {
    if (this.year === maximumYear && this.month === 12) {
      throw new RangeError("ClaimMonth next() would exceed maximum year");
    }

    return this.month === 12
      ? new ClaimMonth(this.year + 1, 1)
      : new ClaimMonth(this.year, this.month + 1);
  }

  prev(): ClaimMonth {
    if (this.year === minimumYear && this.month === 1) {
      throw new RangeError("ClaimMonth prev() would precede minimum year");
    }

    return this.month === 1
      ? new ClaimMonth(this.year - 1, 12)
      : new ClaimMonth(this.year, this.month - 1);
  }

  toParts(): ClaimMonthParts {
    return {
      year: this.year,
      month: this.month,
    };
  }

  toString(): string {
    return `${padYear(this.year)}-${padTwo(this.month)}`;
  }
}
