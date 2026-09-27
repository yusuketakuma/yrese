import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { deviceId, eventId, pharmacyId, tenantId, userId } from "@yrese/shared-kernel";

import * as auditPublicApi from "./index.js";
import { canonicalJsonString } from "./canonical-json.js";
import {
  canonicalizeAuditAppendIntentFingerprintInput,
  copyExactAuditEventShape,
  snapshotAuditAppendIntentFingerprintInput,
} from "./intent-fingerprint.js";
import {
  AUDIT_GENESIS_PREV_HASH,
  AUDIT_INTENT_FINGERPRINT_SCHEMA_VERSION,
  AuditEventContextMismatchError,
  UnsupportedAuditIntentFingerprintSchemaVersionError,
  computeAuditAppendIntentFingerprint,
  computeAuditEventIntentFingerprint,
  createAuditEvent,
  type AuditEvent,
  type AuditAppendIntent,
  type AuditEventIntentFingerprintInput,
  type AuditIntentFingerprintInput,
  type AuditWriteContext,
} from "./index.js";


import {
  payloadHash,
  expectedCanonicalJson,
  expectedFingerprint,
  syntheticContext,
  syntheticIntent,
  fingerprintInput,
  countSetConstructions,
} from './intent-fingerprint-test-support.js';

describe("audit append intent fingerprint v1 golden vector", () => {
  it("reuses static field sets while snapshotting an append intent", () => {
    const input = fingerprintInput();

    expect(
      countSetConstructions(() => {
        snapshotAuditAppendIntentFingerprintInput(input);
      }),
    ).toBe(0);
  });

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

  it("reads each direct Proxy data descriptor once and never invokes property getters", () => {
    const descriptorReads = new Map<string, number>();
    const propertyReads = new Map<string, number>();
    const singleReadProxy = <T extends object>(label: string, target: T): T =>
      new Proxy(target, {
        getOwnPropertyDescriptor: (current, key) => {
          const countKey = `${label}.${String(key)}`;
          const nextCount = (descriptorReads.get(countKey) ?? 0) + 1;
          descriptorReads.set(countKey, nextCount);
          if (nextCount > 1) {
            throw new Error(`descriptor-read-twice:${countKey}`);
          }
          return Reflect.getOwnPropertyDescriptor(current, key);
        },
        get: (_current, key) => {
          const countKey = `${label}.${String(key)}`;
          propertyReads.set(countKey, (propertyReads.get(countKey) ?? 0) + 1);
          throw new Error(`property-get-must-not-run:${countKey}`);
        },
      });

    const targetRefTarget = { ...syntheticIntent().targetRef };
    const businessReasonTarget = { ...syntheticIntent().businessReason! };
    const targetRef = singleReadProxy("targetRef", targetRefTarget);
    const businessReason = singleReadProxy("businessReason", businessReasonTarget);
    const intentTarget = syntheticIntent({ targetRef, businessReason });
    const intent = singleReadProxy("intent", intentTarget);
    const contextTarget = syntheticContext();
    const context = singleReadProxy("context", contextTarget);
    const outerTarget = fingerprintInput({ context, intent });
    const outer = singleReadProxy("outer", outerTarget);

    expect(computeAuditAppendIntentFingerprint(outer)).toEqual({
      fingerprintSchemaVersion: 1,
      intentFingerprint: expectedFingerprint,
    });
    for (const [label, target] of [
      ["outer", outerTarget],
      ["context", contextTarget],
      ["intent", intentTarget],
      ["targetRef", targetRefTarget],
      ["businessReason", businessReasonTarget],
    ] as const) {
      for (const key of Reflect.ownKeys(target)) {
        expect(descriptorReads.get(`${label}.${String(key)}`)).toBe(1);
      }
    }
    expect(propertyReads.size).toBe(0);
  });

  it("uses descriptor values for both hashing and validation instead of hostile Proxy getters", () => {
    const getterOnlyAttackerValue = "audit.getter_only_attacker_value";
    let getterReads = 0;
    const getterIntent = new Proxy(syntheticIntent(), {
      get: (current, key, receiver) => {
        getterReads += 1;
        if (key === "auditEventType") {
          return getterOnlyAttackerValue;
        }
        if (key === "phiClassification") {
          return "phi";
        }
        return Reflect.get(current, key, receiver);
      },
    });

    expect(
      computeAuditAppendIntentFingerprint(fingerprintInput({ intent: getterIntent })),
    ).toEqual({
      fingerprintSchemaVersion: 1,
      intentFingerprint: expectedFingerprint,
    });
    expect(getterReads).toBe(0);

    const descriptorAttackerValue = "audit.descriptor_attacker_value";
    let descriptorGetterReads = 0;
    const descriptorIntent = new Proxy(syntheticIntent(), {
      getOwnPropertyDescriptor: (current, key) => {
        const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
        if (key === "auditEventType" && descriptor !== undefined && "value" in descriptor) {
          return { ...descriptor, value: descriptorAttackerValue };
        }
        return descriptor;
      },
      get: (current, key, receiver) => {
        descriptorGetterReads += 1;
        return Reflect.get(current, key, receiver);
      },
    });

    try {
      computeAuditAppendIntentFingerprint(fingerprintInput({ intent: descriptorIntent }));
      throw new Error("expected descriptor-supplied audit event type to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(RangeError);
      expect((error as Error).message).toBe("unknown auditEventType");
      expect((error as Error).message).not.toContain(descriptorAttackerValue);
    }
    expect(descriptorGetterReads).toBe(0);
  });

  it("normalizes a hostile Date subclass without executing its overridden methods", () => {
    const firstCanonicalInstant = "2026-07-10T00:00:00.000Z";
    class HostileDate extends Date {
      getTimeCalls = 0;
      toISOStringCalls = 0;

      override getTime(): number {
        this.getTimeCalls += 1;
        if (this.getTimeCalls > 1) {
          throw new Error("getTime-must-not-run-twice");
        }
        return super.getTime();
      }

      override toISOString(): string {
        this.toISOStringCalls += 1;
        if (this.toISOStringCalls > 1) {
          throw new Error("toISOString-must-not-run-twice");
        }
        return firstCanonicalInstant;
      }
    }
    const hostileDate = new HostileDate(firstCanonicalInstant);

    const hostile = computeAuditAppendIntentFingerprint(
      fingerprintInput({
        intent: syntheticIntent({ wallClock: hostileDate as unknown as string }),
      }),
    );
    const ordinary = computeAuditAppendIntentFingerprint(
      fingerprintInput({
        intent: syntheticIntent({ wallClock: firstCanonicalInstant }),
      }),
    );

    expect(hostileDate.getTimeCalls).toBe(0);
    expect(hostileDate.toISOStringCalls).toBe(0);
    expect(hostile).toEqual(ordinary);
    expect(hostile.intentFingerprint).toBe(expectedFingerprint);
  });

  it("canonicalizes a genuine cross-realm Date to the ordinary fingerprint", () => {
    const firstCanonicalInstant = "2026-07-10T00:00:00.000Z";
    const crossRealmDate = runInNewContext(
      `new Date("${firstCanonicalInstant}")`,
    ) as Date;

    const crossRealm = computeAuditAppendIntentFingerprint(
      fingerprintInput({
        intent: syntheticIntent({
          wallClock: crossRealmDate as unknown as string,
        }),
      }),
    );
    const ordinary = computeAuditAppendIntentFingerprint(
      fingerprintInput({
        intent: syntheticIntent({ wallClock: firstCanonicalInstant }),
      }),
    );

    expect(crossRealm).toEqual(ordinary);
  });

  it("rejects a Date.prototype spoof without executing its own methods", () => {
    let spoofGetTimeCalls = 0;
    let spoofToISOStringCalls = 0;
    const spoof = Object.create(Date.prototype) as Date;
    Object.defineProperty(spoof, "getTime", {
      value: () => {
        spoofGetTimeCalls += 1;
        return 0;
      },
    });
    Object.defineProperty(spoof, "toISOString", {
      value: () => {
        spoofToISOStringCalls += 1;
        return "2026-07-10T00:00:00.000Z";
      },
    });

    expect(() =>
      computeAuditAppendIntentFingerprint(
        fingerprintInput({
          intent: syntheticIntent({ wallClock: spoof as unknown as string }),
        }),
      ),
    ).toThrow("must be a non-empty string");
    expect(spoofGetTimeCalls).toBe(0);
    expect(spoofToISOStringCalls).toBe(0);
  });

  it.each([
    "businessReason",
    "causationId",
    "deadLetterReason",
    "deviceId",
    "reasonCode",
  ] as const)("rejects direct optional field %s when explicitly undefined", (field) => {
    const intent = { ...syntheticIntent(), [field]: undefined } as unknown as AuditAppendIntent;

    expect(() =>
      computeAuditAppendIntentFingerprint(fingerprintInput({ intent })),
    ).toThrow(`intent.${field} must be omitted instead of undefined`);
  });

  it("rejects an unsupported version before inspecting a malformed intent", () => {
    let deepReads = 0;
    const malformedTarget = syntheticIntent();
    Object.defineProperty(malformedTarget, "auditEventType", {
      enumerable: true,
      get: () => {
        deepReads += 1;
        return "audit.accessor_attacker_value";
      },
    });
    const malformedIntent = new Proxy(malformedTarget, {
      getPrototypeOf: (current) => {
        deepReads += 1;
        return Reflect.getPrototypeOf(current);
      },
      ownKeys: (current) => {
        deepReads += 1;
        return Reflect.ownKeys(current);
      },
      getOwnPropertyDescriptor: (current, key) => {
        deepReads += 1;
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
      get: (current, key, receiver) => {
        deepReads += 1;
        return Reflect.get(current, key, receiver);
      },
    });

    expect(() =>
      computeAuditAppendIntentFingerprint(
        fingerprintInput({
          fingerprintSchemaVersion: 2,
          intent: malformedIntent,
        }),
      ),
    ).toThrow(UnsupportedAuditIntentFingerprintSchemaVersionError);
    expect(deepReads).toBe(0);
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
    expect(Object.hasOwn(auditPublicApi, "snapshotAuditAppendIntentFingerprintInput")).toBe(false);
    expect(Object.hasOwn(auditPublicApi, "canonicalizeAuditAppendIntentFingerprintSnapshot")).toBe(
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

