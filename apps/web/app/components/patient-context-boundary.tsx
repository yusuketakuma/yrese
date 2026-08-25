"use client";

import { usePathname } from "next/navigation";

import { PatientContextBar } from "./patient-context";
import { isPatientContextVisiblePath } from "./patient-context-route-policy";

export { isPatientContextVisiblePath } from "./patient-context-route-policy";

export function PatientContextBoundary() {
  const pathname = usePathname();
  return isPatientContextVisiblePath(pathname) ? <PatientContextBar /> : null;
}
