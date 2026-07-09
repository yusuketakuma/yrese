import {
  patientId,
  pharmacyId,
  receptionId,
  tenantId,
  userId,
} from "@yrese/shared-kernel";
import { z } from "zod";

export const WIRE_ID_MAX_LENGTH = 128;

type SharedKernelIdFactory = (value: string) => unknown;

function acceptsSharedKernelId(factory: SharedKernelIdFactory, value: string): boolean {
  try {
    factory(value);
    return true;
  } catch (error) {
    if (error instanceof RangeError) {
      return false;
    }
    throw error;
  }
}

function wireIdSchema(label: string, factory: SharedKernelIdFactory) {
  return z
    .string()
    .min(1)
    .max(WIRE_ID_MAX_LENGTH)
    .refine((value) => acceptsSharedKernelId(factory, value), {
      message: `${label} must be a non-empty ID without control characters`,
    });
}

export const tenantIdWireSchema = wireIdSchema("tenantId", tenantId);
export const pharmacyIdWireSchema = wireIdSchema("pharmacyId", pharmacyId);
export const actorIdWireSchema = wireIdSchema("actorId", userId);
export const patientIdWireSchema = wireIdSchema("patientId", patientId);
export const receptionIdWireSchema = wireIdSchema("receptionId", receptionId);
