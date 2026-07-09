import { describe, expect, it } from "vitest";

import {
  CalendarDate,
  ClaimMonth,
  DispensingDate,
  PrescriptionDate,
  ReceptionDate,
} from "./index.js";

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
    expect(receptionDate.compare(PrescriptionDate.fromString("2026-07-09"))).toBe(1);
    expect(prescriptionDate.equals(PrescriptionDate.fromString("2026-07-09"))).toBe(true);
  });
});

describe("ClaimMonth", () => {
  it("constructs from YYYY-MM strings, parts, and CalendarDate", () => {
    expect(ClaimMonth.fromString("2026-07").toString()).toBe("2026-07");
    expect(ClaimMonth.fromParts({ year: 2026, month: 1 }).toString()).toBe("2026-01");
    expect(ClaimMonth.fromCalendarDate(CalendarDate.fromString("2026-12-31")).toString()).toBe("2026-12");
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
