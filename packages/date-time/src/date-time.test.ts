import { describe, expect, it, vi } from "vitest";

import {
  CalendarDate,
  ClaimMonth,
  DispensingDate,
  PrescriptionDate,
  ReceptionDate,
} from "./index.js";

function assertClinicalDateWrappersAreNominal(): void {
  const prescriptionDate = PrescriptionDate.fromString("2026-07-09");
  const dispensingDate = DispensingDate.fromString("2026-07-09");
  const receptionDate = ReceptionDate.fromString("2026-07-09");

  // @ts-expect-error PrescriptionDate must not be comparable to DispensingDate.
  prescriptionDate.compare(dispensingDate);
  // @ts-expect-error ReceptionDate must not be assignable to PrescriptionDate.
  const wrongPrescriptionDate: PrescriptionDate = receptionDate;
  void wrongPrescriptionDate;
}

void assertClinicalDateWrappersAreNominal;

const stringFactories = [
  [
    "CalendarDate",
    (value: string) => CalendarDate.fromString(value),
    "CalendarDate must be formatted as YYYY-MM-DD",
  ],
  [
    "PrescriptionDate",
    (value: string) => PrescriptionDate.fromString(value),
    "CalendarDate must be formatted as YYYY-MM-DD",
  ],
  [
    "DispensingDate",
    (value: string) => DispensingDate.fromString(value),
    "CalendarDate must be formatted as YYYY-MM-DD",
  ],
  [
    "ReceptionDate",
    (value: string) => ReceptionDate.fromString(value),
    "CalendarDate must be formatted as YYYY-MM-DD",
  ],
  [
    "ClaimMonth",
    (value: string) => ClaimMonth.fromString(value),
    "ClaimMonth must be formatted as YYYY-MM",
  ],
] as const;

describe("runtime string input authority", () => {
  it.each(stringFactories)(
    "%s rejects type-erased non-strings without coercion",
    (factoryName, factory, expectedMessage) => {
      const isClaimMonth = expectedMessage.includes("ClaimMonth");
      const coercionRead = vi.fn(() => (isClaimMonth ? "2026-07" : "2026-07-09"));
      const hostileObject = {
        [Symbol.toPrimitive]: coercionRead,
        toString: coercionRead,
        valueOf: coercionRead,
      };
      const proxyRead = vi.fn(() => {
        throw new Error(`raw ${factoryName} coercion trap`);
      });
      const hostileProxy = new Proxy(
        {},
        {
          get: proxyRead,
          has: proxyRead,
          getPrototypeOf: proxyRead,
          ownKeys: proxyRead,
          getOwnPropertyDescriptor: proxyRead,
        },
      );
      const { proxy: revokedProxy, revoke } = Proxy.revocable({}, {});
      revoke();

      for (const value of [
        null,
        undefined,
        20260709,
        true,
        20260709n,
        Symbol("2026-07-09"),
        [isClaimMonth ? "2026-07" : "2026-07-09"],
        new String(isClaimMonth ? "2026-07" : "2026-07-09"),
        hostileObject,
        hostileProxy,
        revokedProxy,
      ]) {
        expect(() => factory(value as never)).toThrow(new RangeError(expectedMessage));
      }

      expect(coercionRead).not.toHaveBeenCalled();
      expect(proxyRead).not.toHaveBeenCalled();
    },
  );
});

describe("CalendarDate", () => {
  it("constructs from YYYY-MM-DD strings and integer parts", () => {
    expect(CalendarDate.fromString("2026-07-09").toString()).toBe("2026-07-09");
    expect(CalendarDate.fromParts({ year: 2026, month: 1, day: 5 }).toString()).toBe("2026-01-05");
    expect(CalendarDate.fromString("0001-01-01").toParts()).toEqual({
      year: 1,
      month: 1,
      day: 1,
    });
  });

  it("validates real leap-year calendar dates without Date", () => {
    expect(CalendarDate.fromString("2024-02-29").toString()).toBe("2024-02-29");
    expect(CalendarDate.fromString("2000-02-29").toString()).toBe("2000-02-29");
    expect(() => CalendarDate.fromString("2023-02-29")).toThrow(RangeError);
    expect(() => CalendarDate.fromString("1900-02-29")).toThrow(RangeError);
  });

  it("rejects invalid formats and non-integer parts", () => {
    expect(() => CalendarDate.fromString("2026-7-09")).toThrow(RangeError);
    expect(() => CalendarDate.fromString("2026-00-10")).toThrow(RangeError);
    expect(() => CalendarDate.fromString("2026-04-31")).toThrow(RangeError);
    expect(() => CalendarDate.fromString("0000-01-01")).toThrow(RangeError);
    expect(() => CalendarDate.fromParts({ year: 2026, month: 1.5, day: 1 })).toThrow(RangeError);
    expect(() => CalendarDate.fromParts({ year: 2026, month: 1, day: 1.2 })).toThrow(RangeError);
  });

  it("constructs from the same parts it validates", () => {
    let yearReads = 0;
    let monthReads = 0;
    let dayReads = 0;
    const calendarDate = CalendarDate.fromParts({
      get year() {
        yearReads += 1;
        return yearReads < 3 ? 2026 : 0;
      },
      get month() {
        monthReads += 1;
        return monthReads < 3 ? 12 : 13;
      },
      get day() {
        dayReads += 1;
        return dayReads < 4 ? 31 : 32;
      },
    });

    expect({ yearReads, monthReads, dayReads, value: calendarDate.toString() }).toEqual({
      yearReads: 1,
      monthReads: 1,
      dayReads: 1,
      value: "2026-12-31",
    });
  });

  it("validates each part before reading the next", () => {
    let monthReads = 0;
    let dayReads = 0;
    expect(() =>
      CalendarDate.fromParts({
        get year() {
          return 0;
        },
        get month(): number {
          monthReads += 1;
          throw new Error("month getter must not run");
        },
        get day(): number {
          dayReads += 1;
          throw new Error("day getter must not run");
        },
      }),
    ).toThrow(new RangeError("year must be between 1 and 9999"));
    expect({ monthReads, dayReads }).toEqual({ monthReads: 0, dayReads: 0 });

    expect(() =>
      CalendarDate.fromParts({
        year: 2026,
        get month() {
          return 13;
        },
        get day(): number {
          dayReads += 1;
          throw new Error("day getter must not run");
        },
      }),
    ).toThrow(new RangeError("month must be between 1 and 12"));
    expect(dayReads).toBe(0);
  });

  it("compares and checks equality", () => {
    const earlier = CalendarDate.fromString("2026-07-08");
    const same = CalendarDate.fromString("2026-07-09");
    const later = CalendarDate.fromString("2026-07-10");

    expect(same.compare(earlier)).toBe(1);
    expect(same.compare(later)).toBe(-1);
    expect(same.compare(CalendarDate.fromParts({ year: 2026, month: 7, day: 9 }))).toBe(0);
    expect(same.equals(CalendarDate.fromString("2026-07-09"))).toBe(true);
  });
});

describe("branded clinical date wrappers", () => {
  it("wraps CalendarDate for prescription, dispensing, and reception dates", () => {
    const calendarDate = CalendarDate.fromString("2026-07-09");
    const prescriptionDate = PrescriptionDate.fromCalendarDate(calendarDate);
    const dispensingDate = DispensingDate.fromString("2026-07-10");
    const receptionDate = ReceptionDate.fromParts({ year: 2026, month: 7, day: 11 });

    expect(prescriptionDate.toString()).toBe("2026-07-09");
    expect(dispensingDate.toCalendarDate().toString()).toBe("2026-07-10");
    expect(receptionDate.compare(ReceptionDate.fromString("2026-07-09"))).toBe(1);
    expect(prescriptionDate.equals(PrescriptionDate.fromString("2026-07-09"))).toBe(true);
  });
});

describe("ClaimMonth", () => {
  it("constructs from YYYY-MM strings, parts, and CalendarDate", () => {
    expect(ClaimMonth.fromString("2026-07").toString()).toBe("2026-07");
    expect(ClaimMonth.fromParts({ year: 2026, month: 1 }).toString()).toBe("2026-01");
    expect(ClaimMonth.fromCalendarDate(CalendarDate.fromString("2026-12-31")).toString()).toBe("2026-12");
  });

  it.each([
    [{ year: 2026, month: 13, day: 1 }, "month must be between 1 and 12"],
    [{ year: 0, month: 1, day: 1 }, "year must be between 1 and 9999"],
    [
      { year: Number.MAX_SAFE_INTEGER + 1, month: 1, day: 1 },
      "year must be a safe integer",
    ],
  ] as const)("rejects invalid type-erased CalendarDate parts %#", (parts, expectedMessage) => {
    const create = () => ClaimMonth.fromCalendarDate(parts as unknown as CalendarDate);

    expect(create).toThrow(RangeError);
    expect(create).toThrow(new RangeError(expectedMessage));
  });

  it("snapshots parts before validating and constructing", () => {
    let yearReads = 0;
    let monthReads = 0;
    const claimMonth = ClaimMonth.fromParts({
      get year() {
        yearReads += 1;
        return yearReads === 1 ? 2026 : 0;
      },
      get month() {
        monthReads += 1;
        return monthReads === 1 ? 12 : 13;
      },
    });

    expect({ yearReads, monthReads, value: claimMonth.toString() }).toEqual({
      yearReads: 1,
      monthReads: 1,
      value: "2026-12",
    });
  });

  it("rejects an invalid year before reading month", () => {
    let monthReads = 0;
    const create = () =>
      ClaimMonth.fromParts({
        get year() {
          return 0;
        },
        get month(): number {
          monthReads += 1;
          throw new Error("month getter must not run");
        },
      });

    expect(create).toThrow(new RangeError("year must be between 1 and 9999"));
    expect(monthReads).toBe(0);
  });

  it("compares, advances, and rewinds across year boundaries", () => {
    const december = ClaimMonth.fromString("2026-12");
    const january = ClaimMonth.fromString("2027-01");

    expect(december.next().toString()).toBe("2027-01");
    expect(january.prev().toString()).toBe("2026-12");
    expect(december.compare(january)).toBe(-1);
    expect(january.compare(december)).toBe(1);
    expect(january.equals(ClaimMonth.fromParts({ year: 2027, month: 1 }))).toBe(true);
  });

  it("rejects invalid months and out-of-range movement", () => {
    expect(() => ClaimMonth.fromString("2026-13")).toThrow(RangeError);
    expect(() => ClaimMonth.fromString("2026-7")).toThrow(RangeError);
    expect(() => ClaimMonth.fromParts({ year: 2026, month: 1.5 })).toThrow(RangeError);
    expect(() => ClaimMonth.fromString("9999-12").next()).toThrow(RangeError);
    expect(() => ClaimMonth.fromString("0001-01").prev()).toThrow(RangeError);
  });
});
