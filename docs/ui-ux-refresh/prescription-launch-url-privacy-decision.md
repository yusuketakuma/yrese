# Prescription launch URL privacy decision

The bounded slice carries only the opaque reception identifier and business date in the workflow URL. Patient identity is derived from the authenticated reception queue and compared with the explicitly selected patient.

This keeps redundant patient identity out of browser history, reverse-proxy access logs, analytics, copied links, and support screenshots. Route values remain untrusted selectors rather than authorization evidence.

Status: **resolved in the route and contract tests**.
