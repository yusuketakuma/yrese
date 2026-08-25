const PATIENT_SCOPED_ROOTS = ["/patients", "/prescriptions", "/checkout"] as const;

/**
 * 患者文脈を表示してよい業務ルートを限定する。
 * バッチ・システム・管理画面へPHIを持ち込まない。
 */
export function isPatientContextVisiblePath(pathname: string): boolean {
  if (pathname === "/") return true;
  return PATIENT_SCOPED_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}
