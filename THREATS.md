# TrustVault Threat Model

## 1. Purpose

TrustVault is a secure document-sharing application being developed for the Snovasys Fresher Hiring Challenge 2026. This threat model records the assets that must be protected, relevant threats, implemented controls, verification evidence, and remaining limitations.

TrustVault has implemented authentication, document operations, document-level permissions, audit logging for selected operations, and permission-filtered search. Automated integration tests cover specific authorization, search, session, and upload-validation cases. Passing these tests is evidence for those cases only; it does not establish that the entire application is secure.

## 2. Assets to Protect

- Uploaded document contents and metadata.
- User accounts, password hashes, and authenticated sessions.
- Document ownership and per-document read/edit permissions.
- Audit records and security events.
- Application configuration, database credentials, and session secrets.
- Search results and metadata that could reveal confidential documents.

## 3. Threats and Mitigations

### T1. Unauthorized Document Access

**Threat:** A user accesses another user's document by changing a document ID or manipulating an API request.

**Implemented control:** Document listing and download queries restrict results to documents owned by the authenticated user or accessible through explicit read permission.

**Verification:** Integration tests passed for unauthorized download denial, granting read access, successful download after a grant, revocation, and denial after revocation. Search tests also verified that a viewer cannot discover a private document by searching for its exact name.

**Remaining risk:** These tests cover selected scenarios, not every route, identifier, or authorization edge case.

### T2. Unauthorized Download, Modification, or Deletion

**Threat:** A user without the necessary permission downloads, edits, or deletes a document.

**Implemented control:** Download access checks ownership or read permission. Metadata editing checks ownership or explicit edit permission. Deletion is restricted to the document owner in the tested scenarios.

**Verification:** The integration suite passed tests for unauthorized download, unauthorized editing, unauthorized deletion, owner editing, explicit editor access, and read-only viewer denial. The tested unauthorized download and deletion requests returned HTTP 404; the read-only viewer's edit request returned HTTP 404 without changing the document.

**Remaining risk:** Continue testing authorization boundaries, malformed requests, and all protected operations.

### T3. Privilege Escalation

**Threat:** A user changes request data or permissions to obtain a higher role or grant themselves unauthorized document access.

**Implemented control:** Registration assigns the `viewer` role by default. Document permission changes are handled by server-side routes that check authorization for the requested operation.

**Remaining risk:** Administrative role management and privilege-escalation scenarios require further review and testing. Do not rely on role values supplied by clients.

### T4. Account and Session Compromise

**Threat:** Weak password handling, stolen sessions, or session misuse allows another person to act as a legitimate user.

**Implemented controls:** Passwords are hashed with bcrypt. Sessions are stored in PostgreSQL. Session cookies are configured as HTTP-only, use `SameSite=Lax`, and use the `secure` flag in production. Security headers and login rate limiting are configured.

**Verification:** Integration tests verified that login succeeds, `/api/auth/me` returns HTTP 200 before logout, logout returns HTTP 200, and `/api/auth/me` returns HTTP 401 after logout.

**Remaining risk:** Review session lifecycle and error handling, production proxy and HTTPS settings, and CSRF protection for cookie-authenticated state-changing requests beyond the tested document-editing scenarios. Rotate the previously exposed temporary test-account password privately before the final demonstration.

### T5. Malicious or Invalid File Uploads

**Threat:** An attacker uploads an invalid or malicious file, bypasses file restrictions, or consumes excessive resources.

**Implemented controls:** Upload handling enforces a 5 MB limit and checks supported PDF, PNG, and JPEG file signatures against the expected file type and metadata. A centralized error handler returns HTTP 413 for the tested oversized-upload case.

**Verification:** The latest integration suite passed both upload-validation subtests:

- An oversized file exceeding the 5 MB limit was rejected with HTTP 413.
- Unsupported file content was rejected with HTTP 400.

**Remaining risk:** File-signature checks are not complete file-format validation and do not provide malware scanning. The tests do not establish that every malformed or malicious file is safely handled. Continue testing mismatched file types, malformed content, and resource-exhaustion cases.

### T6. Audit Log Tampering or Missing Events

**Threat:** A security-relevant action is not recorded, or audit records are altered or removed.

**Implemented controls:** An audit service records security events. Integration tests verify a successful metadata-edit audit and the successful owner-deletion audit case.

**Verification:** The tested successful edit generated a matching successful audit record. The deletion test verified the expected successful deletion audit. The latest integration run also passed the document download-access tests after the audit-log fix. The full suite passing does not, by itself, prove complete audit coverage for every download outcome.

**Remaining risk:** Verify audit coverage for uploads, downloads, permission grants and revocations, denied requests, and failures. Restrict audit-log modification privileges. Database audit records are not inherently immutable, and no claim of complete tamper-proof logging is made.

### T7. Information Leakage

**Threat:** Error responses, logs, or URLs reveal document contents, secrets, or sensitive information.

**Implemented controls:** Reviewed error handlers return controlled error messages. Audit-service documentation prohibits recording passwords, session cookies, or document contents in audit details.

**Remaining risk:** Review all routes and logs for sensitive data leakage. Avoid exposing database errors, secrets, or document contents in responses.

### T8. Search and Metadata Leakage

**Threat:** Search results reveal document names, owners, categories, or dates to users who lack permission.

**Implemented control:** The document listing query filters results by ownership or explicit read permission before returning them. Search filters support name, category, owner ID, and creation-date range.

**Verification:** All five search subtests passed: shared-document discovery, exact-name privacy for a private document, category filtering, invalid owner-ID rejection, and invalid-date rejection.

**Remaining risk:** Add further positive tests for valid owner and date filters, and continue checking that combinations of filters never bypass authorization.

### T9. Missing or Ineffective Security Tests

**Threat:** A change removes an authorization check without being detected by automated tests.

**Implemented controls:** Integration tests cover selected download, permission, edit, delete, audit, search, session, and upload-validation behaviors. A previous mutation check demonstrated that the unauthorized-download and revoked-permission tests failed when the download authorization condition was removed.

**Verification:** The latest full integration run on October 22, 2026, passed **32 tests with 0 failures and 0 skipped tests**. Coverage includes document access, permission grants and revocation, unauthorized downloads and deletion, metadata editing, CSRF-token rejection for document edits, search validation, selected audit checks, logout session invalidation, role-based access, and upload-validation rejection.

**Remaining risk:** The mutation check covers a specific authorization regression only. Expand test coverage and continue reviewing each security-sensitive route. Passing these tests does not establish that the entire application is secure.

## 4. Security Verification Record

The following results have been observed:

- **Document access, grants, and revocation:** Passed in the integration suite.
- **Unauthorized download:** Passed in the tested scenarios.
- **Document deletion authorization and successful audit:** Passed in the tested scenarios.
- **Document metadata editing and successful edit audit:** Passed in the tested scenarios.
- **CSRF protection for document editing:** Requests with missing or invalid CSRF tokens were rejected in the tested scenarios.
- **Search authorization and invalid-filter handling:** All five search subtests passed, covering shared-document discovery, private-document exact-name privacy, category filtering, invalid owner-ID rejection, and invalid-date rejection.
- **Logout session invalidation:** Passed; the authenticated session was no longer accepted after logout in the tested scenario.
- **Oversized upload rejection:** The tested file exceeding 5 MB was rejected with HTTP 413.
- **Unsupported file-content rejection:** The tested unsupported file was rejected with HTTP 400.
- **Role-based access:** The tested viewer was denied access to an admin-only route, and the tested admin was allowed to continue.
- **Latest full integration run — October 22, 2026:** 32 passed, 0 failed, 0 skipped.
- **Database connection warning:** PostgreSQL emitted an SSL-mode compatibility warning during testing. It did not prevent the latest test run from passing; the connection configuration still requires review.

Verification results apply only to the scenarios exercised. They are not a substitute for comprehensive security review or production testing.

## 5. Remaining Work

- Continue reviewing session lifecycle and error handling; logout passed the tested session-invalidation scenario.
- Extend CSRF protection review and testing to other cookie-authenticated state-changing routes, including logout, registration, and login, as appropriate to their request flows.
- Complete administrative activity and permission views with server-side role enforcement.
- Expand audit coverage for uploads, downloads, permission grants and revocations, denied requests, and failures.
- Add more valid owner/date search tests and authorization regression tests.
- Continue upload validation and malformed-file testing, including oversized uploads and mismatched file types.
- Finish the user interface, API documentation, README, setup instructions, and demo.
- Review deployment security, HTTPS/proxy configuration, secrets handling, and the PostgreSQL SSL-mode warning.
- Rotate the previously exposed temporary test-account password privately before the final demonstration.

Update this document as implementation and verification progress. Do not mark a control as fully verified until the relevant tests or review have actually been completed.