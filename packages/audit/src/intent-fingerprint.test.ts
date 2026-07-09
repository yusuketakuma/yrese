import { describe, expect, it } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import * as auditPublicApi from "./index.js";
import { canonicalJsonString } from "./canonical-json.js";
import { canonicalizeAuditAppendIntentFingerprintInput } from "./intent-fingerprint.js";
import {
  AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION,
  UnsupportedAuditIntentFingerprintSchemaVersionError,
  computeAuditAppendIntentFingerprint,
  type AuditAppendIntent,
  type AuditIntentFingerprintInput,
  type AuditWriteContext,
} from "./index.js";

const payloadHash = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
const expectedCanonicalJson =
  '{"context":{"actorId":"actor-synthetic-001","pharmacyId":"pharmacy-synthetic-001","tenantId":"tenant-synthetic-001"},"intent":{"aggregateId":"aggregate-synthetic-001","aggregateType":"synthetic-調剤","auditEventType":"breakglass.used","businessReason":{"code":"SYNTHETIC_EMERGENCY_ACCESS"},"causationId":"causation-synthetic-001","correlationId":"correlation-synthetic-001","deadLetterReason":"SYNTHETIC_TRANSPORT_FAILURE","deviceId":"device-synthetic-001","encryptionStatus":"plaintext_forbidden","eventId":"event-synthetic-001","idempotencyKey":"event-synthetic-001:1","logicalClock":"42","outcome":"denied","payloadHash":"0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef","phiClassification":"none","reasonCode":"AUTH-0003","retryCount":2,"schemaVersion":1,"syncStatus":"dead_letter","targetRef":{"id":"target-synthetic-001","kind":"synthetic"},"wallClock":"2026-07-10T00:00:00.000Z"}}';
const expectedFingerprint = "2c3a02b9051c29598991a60ebffaa1636e1ac9fdab74af88b4a6e7d164e02745";

function syntheticContext(): AuditWriteContext {
  return {
    tenantId: tenantId("tenant-synthetic-001"),
    pharmacyId: pharmacyId("pharmacy-synthetic-001"),
    actorId: userId("actor-synthetic-001"),
  };
}

function syntheticIntent(overrides: Partial<AuditAppendIntent> = {}): AuditAppendIntent {
  return {
    eventId: eventId("event-synthetic-001"),
    aggregateId: "aggregate-synthetic-001",
    aggregateType: "synthetic-調剤",
    deviceId: deviceId("device-synthetic-001"),
    causationId: eventId("causation-synthetic-001"),
    logicalClock: 42n,
    wallClock: "2026-07-10T09:00:00+09:00",
    idempotencyKey: "event-synthetic-001:1",
    correlationId: eventId("correlation-synthetic-001"),
    schemaVersion: 1,
    payloadHash,
    phiClassification: "none",
    encryptionStatus: "plaintext_forbidden",
    syncStatus: "dead_letter",
    retryCount: 2,
    deadLetterReason: "SYNTHETIC_TRANSPORT_FAILURE",
    auditEventType: "breakglass.used",
    targetRef: {
      kind: "synthetic",
      id: "target-synthetic-001",
    },
    outcome: "denied",
    reasonCode: "AUTH-0003",
    businessReason: {
      code: "SYNTHETIC_EMERGENCY_ACCESS",
    },
    ...overrides,
  };
}

function fingerprintInput(
  overrides: Partial<AuditIntentFingerprintInput> = {},
): AuditIntentFingerprintInput {
  return {
    fingerprintSchemaVersion: AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION,
    context: syntheticContext(),
    intent: syntheticIntent(),
    ...overrides,
  };
}

describe("audit append intent fingerprint v1 golden vector", () => {
  it("pins the synthetic canonical JSON bytes and lowercase SHA-256", () => {
    const input = fingerprintInput();

    expect(input.intent.phiClassification).toBe("none");
    expect(canonicalizeAuditAppendIntentFingerprintInput(input)).toBe(expectedCanonicalJson);
    expect(expectedCanonicalJson).not.toContain("fingerprintSchemaVersion");
    expect(computeAuditAppendIntentFingerprint(input)).toEqual({
      fingerprintSchemaVersion: 1,
      intentFingerprint: expectedFingerprint,
    });
    expect(expectedFingerprint).toMatch(/^[a-f0-9]{64}$/);
  });

  it("uses UTF-16 key sorting independent of insertion order", () => {
    const context = syntheticContext();
    const intent = syntheticIntent();
    const reversedContext = Object.fromEntries(Object.entries(context).reverse()) as unknown as AuditWriteContext;
    const reversedIntent = Object.fromEntries(Object.entries(intent).reverse()) as unknown as AuditAppendIntent;

    expect(
      canonicalizeAuditAppendIntentFingerprintInput(
        fingerprintInput({ context: reversedContext, intent: reversedIntent }),
      ),
    ).toBe(expectedCanonicalJson);
  });

  it("normalizes offset and UTC wallClock values to the same millisecond instant", () => {
    const offset = computeAuditAppendIntentFingerprint(fingerprintInput());
    const utc = computeAuditAppendIntentFingerprint(
      fingerprintInput({ intent: syntheticIntent({ wallClock: "2026-07-10T00:00:00.000Z" }) }),
    );

    expect(utc).toEqual(offset);
    expect(expectedCanonicalJson).toContain('"wallClock":"2026-07-10T00:00:00.000Z"');
  });

  it("normalizes an explicit Date wallClock but rejects an invalid Date", () => {
    const date = computeAuditAppendIntentFingerprint(
      fingerprintInput({
        intent: syntheticIntent({
          wallClock: new Date("2026-07-10T00:00:00.000Z") as unknown as string,
        }),
      }),
    );

    expect(date.intentFingerprint).toBe(expectedFingerprint);
    expect(() =>
      computeAuditAppendIntentFingerprint(
        fingerprintInput({
          intent: syntheticIntent({ wallClock: new Date("invalid") as unknown as string }),
        }),
      ),
    ).toThrow(/valid Date/);
  });

  it("includes retryCount in the logical intent", () => {
    const original = computeAuditAppendIntentFingerprint(fingerprintInput());
    const retried = computeAuditAppendIntentFingerprint(
      fingerprintInput({ intent: syntheticIntent({ retryCount: 3 }) }),
    );

    expect(retried.intentFingerprint).not.toBe(original.intentFingerprint);
  });

  it.each([
    ["negative logicalClock", { logicalClock: -1n }, /logicalClock/],
    ["non-positive schemaVersion", { schemaVersion: 0 }, /schemaVersion/],
    ["negative retryCount", { retryCount: -1 }, /retryCount/],
    ["invalid payloadHash", { payloadHash: "not-a-sha256" }, /payloadHash/],
    ["unknown auditEventType", { auditEventType: "audit.unknown" }, /unknown auditEventType/],
    ["empty target", { targetRef: { kind: "synthetic", id: "" } }, /targetRef.id/],
  ] as const)("rejects domain-invalid intent: %s", (_label, overrides, expected) => {
    expect(() =>
      computeAuditAppendIntentFingerprint(
        fingerprintInput({ intent: syntheticIntent(overrides as Partial<AuditAppendIntent>) }),
      ),
    ).toThrow(expected);
  });

  it("rejects PHI classification in the runtime input as well as narrowing it in the type", () => {
    const intent = {
      ...syntheticIntent(),
      phiClassification: "phi",
      encryptionStatus: "encrypted",
    } as unknown as AuditAppendIntent;

    expect(() => computeAuditAppendIntentFingerprint(fingerprintInput({ intent }))).toThrow(
      /phiClassification/,
    );
  });

  it.each(["tenantId", "pharmacyId", "actorId", "prevHash", "sequenceNumber", "entryHash", "attempt"])(
    "rejects injected authority, chain position, or adapter field %s",
    (field) => {
      const intent = { ...syntheticIntent(), [field]: "injected" } as unknown as AuditAppendIntent;
      expect(() => computeAuditAppendIntentFingerprint(fingerprintInput({ intent }))).toThrow(
        /unknown field/,
      );
    },
  );

  it.each(["prevHash", "sequenceNumber", "entryHash", "attempt", "phiClassification"])(
    "rejects injected root field %s before dereferencing the request",
    (field) => {
      const input = { ...fingerprintInput(), [field]: "injected" } as unknown as AuditIntentFingerprintInput;
      expect(() => computeAuditAppendIntentFingerprint(input)).toThrow(/unknown field/);
    },
  );

  it("rejects root symbol, non-enumerable, and accessor properties", () => {
    const symbolInput = Object.assign(fingerprintInput(), { [Symbol("hidden")]: true });
    const nonEnumerableInput = fingerprintInput();
    Object.defineProperty(nonEnumerableInput, "extraValue", { value: true, enumerable: false });
    const accessorInput = fingerprintInput();
    Object.defineProperty(accessorInput, "context", {
      enumerable: true,
      get: () => syntheticContext(),
    });

    expect(() => computeAuditAppendIntentFingerprint(symbolInput)).toThrow(/unknown field/);
    expect(() => computeAuditAppendIntentFingerprint(nonEnumerableInput)).toThrow(/unknown field/);
    expect(() => computeAuditAppendIntentFingerprint(accessorInput)).toThrow(/data property/);
  });

  it("rejects unknown nested and missing required fields", () => {
    const unknownNested = {
      ...syntheticIntent(),
      targetRef: { ...syntheticIntent().targetRef, extraValue: "not-fingerprinted" },
    } as unknown as AuditAppendIntent;
    const { eventId: _eventId, ...missingEventId } = syntheticIntent();

    expect(() =>
      computeAuditAppendIntentFingerprint(fingerprintInput({ intent: unknownNested })),
    ).toThrow(/intent.targetRef.*unknown field/);
    expect(() =>
      computeAuditAppendIntentFingerprint(
        fingerprintInput({ intent: missingEventId as unknown as AuditAppendIntent }),
      ),
    ).toThrow(/intent.eventId is required/);
  });

  it("dispatches v1 and rejects an unknown stored schema version distinctly", () => {
    expect(computeAuditAppendIntentFingerprint(fingerprintInput()).intentFingerprint).toBe(
      expectedFingerprint,
    );

    expect(() =>
      computeAuditAppendIntentFingerprint(fingerprintInput({ fingerprintSchemaVersion: 2 })),
    ).toThrow(UnsupportedAuditIntentFingerprintSchemaVersionError);
  });

  it.each([
    ["unknown positive integer", 2],
    ["object", { attackerMarker: "attacker-version-marker", toJSON: () => {
      throw new Error("attacker-version-marker");
    } }],
    ["string", "attacker-version-marker"],
    ["bigint", 2n],
    ["symbol", Symbol("attacker-version-marker")],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["fraction", 1.5],
    ["zero", 0],
    ["negative", -1],
    ["unsafe integer", Number.MAX_SAFE_INTEGER + 1],
  ] as const)("rejects %s schema versions without retaining the runtime value", (_label, value) => {
    const input = fingerprintInput({
      fingerprintSchemaVersion: value as unknown as number,
    });

    try {
      computeAuditAppendIntentFingerprint(input);
      throw new Error("expected fingerprint schema version validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(UnsupportedAuditIntentFingerprintSchemaVersionError);
      expect((error as Error).message).toBe(
        "Unsupported audit intent fingerprint schema version",
      );
      expect(Object.hasOwn(error as object, "fingerprintSchemaVersion")).toBe(false);

      const serialized = JSON.stringify(error);
      expect(typeof serialized).toBe("string");
      expect(serialized).not.toContain("attacker-version-marker");
    }
  });

  it("does not expose the raw canonical fingerprint input through the package public API", () => {
    expect(Object.hasOwn(auditPublicApi, "canonicalizeAuditAppendIntentFingerprint")).toBe(false);
    expect(Object.hasOwn(auditPublicApi, "canonicalizeAuditAppendIntentFingerprintInput")).toBe(
      false,
    );
    expect(typeof auditPublicApi.computeAuditAppendIntentFingerprint).toBe("function");
  });

  it("does not echo an unknown audit event type in errors", () => {
    const attackerValue = "audit.attacker_supplied_value";

    try {
      computeAuditAppendIntentFingerprint(
        fingerprintInput({ intent: syntheticIntent({ auditEventType: attackerValue }) }),
      );
      throw new Error("expected fingerprint validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe("unknown auditEventType");
      expect((error as Error).message).not.toContain(attackerValue);
    }
  });
});

describe("strict canonical JSON rules used by fingerprint v1", () => {
  it("pins nested sorting, bigint, null, undefined omission, arrays, and control escaping", () => {
    expect(
      canonicalJsonString(
        {
          z: undefined,
          text: "薬局\n\u0001",
          nested: { z: undefined, b: 2n, a: null },
          array: [3n, null, 1],
        },
        "test",
      ),
    ).toBe('{"array":["3",null,1],"nested":{"a":null,"b":"2"},"text":"薬局\\n\\u0001"}');
  });

  it("distinguishes null from undefined and absent object fields", () => {
    expect(canonicalJsonString({ value: null }, "test")).toBe('{"value":null}');
    expect(canonicalJsonString({ value: undefined }, "test")).toBe("{}");
    expect(canonicalJsonString({}, "test")).toBe("{}");
  });

  it("pins UTF-16 code-unit ordering when an astral key sorts before a BMP key", () => {
    const canonicalJson = canonicalJsonString(
      {
        "\uE000": "bmp",
        "\u{10000}": "astral",
      },
      "test",
    );

    expect(canonicalJson).toBe('{"\u{10000}":"astral","\uE000":"bmp"}');
    expect(Buffer.from(canonicalJson, "utf8").toString("hex")).toBe(
      "7b22f0908080223a2261737472616c222c22ee8080223a22626d70227d",
    );
  });

  it("rejects both sparse array holes and explicit undefined elements", () => {
    const sparse: unknown[] = [];
    sparse.length = 1;

    expect(() => canonicalJsonString({ value: sparse }, "test")).toThrow(/sparse array hole/);
    expect(() => canonicalJsonString({ value: [undefined] }, "test")).toThrow(/must not be undefined/);
  });

  it("rejects hidden own data properties on plain objects", () => {
    const value = { visible: true };
    Object.defineProperty(value, "hidden", { value: "not-fingerprinted", enumerable: false });

    expect(() => canonicalJsonString(value, "test")).toThrow(/enumerable data property/);
  });

  it.each([
    ["enumerable", true],
    ["non-enumerable", false],
  ] as const)("rejects %s extra array properties", (_label, enumerable) => {
    const value = [1];
    Object.defineProperty(value, "extra", { value: "not-fingerprinted", enumerable });

    expect(() => canonicalJsonString({ value }, "test")).toThrow(/non-index array properties/);
  });

  it("rejects non-enumerable array index properties", () => {
    const value = [1];
    Object.defineProperty(value, "0", { value: 1, enumerable: false });

    expect(() => canonicalJsonString({ value }, "test")).toThrow(/enumerable data property/);
  });

  it("rejects cycles cleanly", () => {
    const cycle: Record<string, unknown> = {};
    cycle.self = cycle;

    expect(() => canonicalJsonString(cycle, "test")).toThrow(/must not contain a cycle/);
  });

  it.each([Number.MAX_SAFE_INTEGER + 1, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "rejects non-canonical number %s",
    (value) => {
      expect(() => canonicalJsonString({ value }, "test")).toThrow(/safe integer/);
    },
  );

  it.each([
    ["function", () => undefined],
    ["symbol", Symbol("value")],
    ["Date", new Date("2026-07-10T00:00:00.000Z")],
    ["Map", new Map()],
    ["class instance", new (class SyntheticValue {})()],
  ])("rejects unsupported %s values", (_label, value) => {
    expect(() => canonicalJsonString({ value }, "test")).toThrow();
  });

  it("rejects symbol keys", () => {
    const value = { visible: true, [Symbol("hidden")]: true };
    expect(() => canonicalJsonString(value, "test")).toThrow(/symbol keys/);
  });
});
