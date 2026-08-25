# Prescription launch URL privacy decision

The first bounded slice currently carries an opaque `patientId` as a selector and independently revalidates it against the authenticated reception queue. This does not make the URL an authorization boundary.

Before the slice is eligible for merge, the URL contract should be reduced to the opaque reception identifier plus business date, with patient identity derived only from the authenticated queue and compared to the explicitly selected patient. This removes redundant patient identity from browser history, reverse-proxy access logs, analytics, copied links, and support screenshots.

Status: **merge blocker for this draft PR** until the route and tests are updated.
