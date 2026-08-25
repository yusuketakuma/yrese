"use client";

import { usePathname } from "next/navigation";

import { PatientContextBar } from "./patient-context";

const PATIENT_CONTEXT_ROUTE_PREFIXES = [
  "/patients",
  "/prescriptions",
  "/checkout",
] as const;

export function shouldShowPatientContext(pathname: string): boolean {
  if (pathname === "/") return true;
  return PATIENT_CONTEXT_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Prevent selected-patient PHI from following the operator into batch, master, sync, or
 * administration screens. Patient state remains in the provider for intentional return to a
 * patient workflow, but it is neither rendered nor refreshed outside the approved route scope.
 */
export function ScopedPatientContextBar() {
  const pathname = usePathname();
  return shouldShowPatientContext(pathname) ? <PatientContextBar /> : null;
}
