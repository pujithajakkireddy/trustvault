# TrustVault Threat Model

## 1. Purpose

TrustVault is a document-sharing application developed for the Snovasys Fresher Hiring Challenge 2026. This document describes the security risks considered during development, the protections implemented so far, the tests used to evaluate them, and the remaining work.

The application includes authentication, document permissions, search access checks, selected audit logging, a web interface, and automated security tests. The tests provide evidence for specific scenarios, but they do not prove that the entire application is secure.

## 2. Assets to Protect

The main assets that need protection are:

- Uploaded documents and their metadata.
- User accounts and password hashes.
- Authenticated sessions and session secrets.
- Document ownership and read/edit permissions.
- Audit records that track important actions.
- Database credentials and application configuration.
- Search results that could reveal private document information.
- Uploaded file contents and their storage locations.
- Frontend-to-backend requests and authentication state.

## 3. Threats and Mitigations

### T1. Unauthorized Document Access

**Threat:** A user changes a document ID or sends a modified API request to access someone else's private document.

**Implemented control:** Server-side queries check whether the authenticated user owns the document or has the required read permission.

**Verification:** Integration tests cover unauthorized downloads, shared-document access, permission revocation, and searching for private documents by their exact names.

**Remaining risk:** More authorization tests are needed for every protected route and unusual request.

### T2. Unauthorized Download, Editing, or Deletion

**Threat:** A user downloads, modifies, or deletes a document without the required permission.

**Implemented control:** Download requests check access permissions, metadata editing checks ownership or explicit edit permission, and deletion is restricted to the document owner in the tested scenarios.

**Verification:** Integration tests cover owner access, explicit editor access, read-only viewer denial, unauthorized downloads, and deletion restrictions.

**Remaining risk:** Continue testing authorization boundaries and confirm that denied requests never change document data.

### T3. Privilege Escalation

**Threat:** A user changes request data to obtain an administrator role or give themselves unauthorized access to a document.

**Implemented control:** Registration assigns the `viewer` role by default. Role checks are performed by server-side middleware, and document permission changes are handled by protected routes.

**Verification:** Admin audit endpoint tests confirm that an unauthenticated request is rejected, a viewer is denied access, and an administrator can retrieve audit records.

**Remaining risk:** Administrative role management and additional privilege-escalation scenarios need further testing. Client-supplied role values must not be trusted.

### T4. Account and Session Compromise

**Threat:** Someone gains access to another user's account through weak password handling or session misuse.

**Implemented controls:** Passwords are hashed using bcrypt. Sessions are stored in PostgreSQL. Session handling includes regeneration after successful login, and security headers and login rate limiting are configured.

**Verification:** Tests check authentication, role-based access, and session invalidation after logout.

**Remaining risk:** Review the complete session lifecycle, error handling, HTTPS and proxy configuration, and CSRF protection across relevant state-changing requests. Handle any exposed test credentials securely before the final demonstration.

### T5. Malicious or Invalid File Uploads

**Threat:** A user uploads an unsupported, malformed, or malicious file, or attempts to consume excessive resources.

**Implemented controls:** Uploads have a 5 MB size limit. The application checks file signatures for supported PDF, PNG, and JPEG uploads.

**Verification:** Integration tests confirm that the tested oversized upload is rejected with HTTP 413 and unsupported file content is rejected with HTTP 400.

**Remaining risk:** File-signature checks do not fully validate a file's format and do not detect malware. More malformed-file and resource-exhaustion tests are needed.

### T6. Missing or Altered Audit Records

**Threat:** Important actions are not recorded, or someone changes or deletes audit records.

**Implemented controls:** An audit service records selected security-related events. The admin-only endpoint allows authorized administrators to view recent audit records.

**Verification:** Tests check selected successful edit and deletion audit entries. Additional tests cover selected denied permission changes. Admin endpoint tests also verify access restrictions, returned audit data, and limit validation.

**Remaining risk:** Audit coverage still needs review for uploads, downloads, permission grants and revocations, denied requests, and failures. Database audit records are not inherently immutable, so the current implementation should not be described as tamper-proof.

### T7. Information Leakage

**Threat:** Error responses or logs reveal document contents, passwords, session cookies, or other sensitive information.

**Implemented controls:** Error handlers return controlled messages for reviewed cases. The audit service is designed not to record sensitive values such as passwords, session cookies, or document contents.

**Verification:** Admin audit tests check selected returned fields and confirm that document content is not included in the tested audit response.

**Remaining risk:** Review all routes, error handlers, and logs for accidental exposure of sensitive information.

### T8. Search and Metadata Leakage

**Threat:** Search results reveal private document names or metadata to users who do not have access.

**Implemented control:** The document query filters results according to ownership or explicit read permission before returning them.

**Verification:** Search tests cover shared-document discovery, exact-name privacy for private documents, category filtering, invalid owner IDs, and invalid calendar dates.

**Remaining risk:** Add more tests for valid owner and date filters and combinations of search filters. Confirm that filtering never bypasses access checks.

### T9. Inadequate Security Testing

**Threat:** A code change accidentally removes an authorization check without being detected.

**Implemented controls:** Automated tests cover selected document-access, permission, search, audit, session, CSRF, upload-validation, and admin-access scenarios.

**Verification:** A previous mutation test showed that the unauthorized-download and revoked-permission tests failed when the relevant authorization condition was deliberately removed. The latest confirmed full test run passed **48 tests**, with 0 failures, 0 skipped tests, and 0 cancelled tests.

These results apply only to the scenarios exercised by the test suite and do not constitute a complete security audit.

**Remaining risk:** The mutation test checks specific regressions. More security tests and code reviews are needed to cover other possible failures.

### T10. Frontend and API Integration Errors

**Threat:** Frontend errors or incorrect API integration could cause users to misunderstand operation results or prevent them from completing document workflows.

**Implemented controls:** The frontend is served by Express and communicates with the backend API. Server-side authorization protects document operations and the administrator audit endpoint.

**Verification:** Local and deployed application checks covered registration, login, document upload, download, logout, and selected document-management workflows. The deployed administrator account could retrieve audit logs. A viewer-session request to the administrator audit endpoint returned HTTP 403 Forbidden. The latest confirmed full automated test run passed 48 tests, with 0 failures, 0 skipped tests, and 0 cancelled tests.

**Remaining risk:** Complete regression testing is still required for all workflows and error paths. Frontend visibility controls must not replace server-side authorization.

### T11. Loss of Uploaded Files

**Threat:** Uploaded documents may become unavailable if file contents are stored only in temporary application memory or if the database loses data.

**Current implementation:** Multer uses in-memory storage to buffer incoming uploads. After validation, the upload route stores the document bytes in PostgreSQL in the `documents.content` column and stores a SHA-256 hash alongside the content.

**Verification:** The upload and download code paths confirm that document bytes are written to and retrieved from PostgreSQL. Downloads recalculate the SHA-256 hash and reject files whose stored content does not match the recorded hash. Persistence across an actual Render restart or redeployment has not yet been independently verified.

**Required mitigation:**

- Verify document retrieval after an application restart or redeployment.
- Configure suitable database backups and recovery procedures.
- Confirm that the database retains document content.
- Test the recovery process rather than relying only on configuration.

**Remaining risk:** Database availability, backup and recovery, and persistence across deployment events still require verification. The current implementation should not be treated as a substitute for a tested backup strategy.

### T12. Production Deployment Misconfiguration

**Threat:** Incorrect production settings could expose sessions, database credentials, or protected application functionality.

**Current status:** TrustVault has been deployed to Render, and the deployed application has been checked. The administrator audit endpoint was verified to reject a viewer's request with HTTP 403 Forbidden. However, successful deployment and selected access-control checks do not establish that every production security setting is correct.

**Implemented controls:** The application uses server-side authentication, PostgreSQL-backed sessions, role-based authorization, security headers, and login rate limiting. These controls have been implemented in the application, but their complete production configuration has not yet been independently verified.

**Required mitigation:**

- Verify HTTPS and secure session-cookie settings in the deployed environment.
- Review trusted proxy configuration.
- Ensure environment secrets are handled securely.
- Review database SSL settings and connection security.
- Test authentication and authorization behavior in the deployed environment.
- Verify that production settings match the intended security configuration.

**Remaining risk:** Production configuration review is incomplete. Uploaded files are buffered in memory during upload and stored in PostgreSQL after validation, but persistence across actual process restarts or redeployments has not yet been independently verified. Database backup and recovery procedures, production security settings, and the remaining security controls must be reviewed and verified before storing sensitive production documents.

## 4. Security Verification Record

The latest confirmed full test run reported:

- **Tests passed:** 48
- **Tests failed:** 0
- **Tests skipped:** 0
- **Tests cancelled:** 0

The test suite covers selected scenarios involving:

- Document ownership, sharing, and permission revocation.
- Unauthorized downloads, editing, and deletion.
- CSRF-token validation for tested document operations.
- Search authorization and invalid-filter handling.
- Selected successful and denied-operation audit records.
- Logout and session invalidation.
- Role-based access to the administrator audit endpoint.
- Audit endpoint query limits and invalid values.
- Oversized uploads and unsupported file content.
- Selected permission grant and revocation authorization checks.

A PostgreSQL SSL-mode compatibility warning was observed during earlier testing. Later checks did not return matching SSL-related messages, but production SSL verification has not been independently confirmed. The database connection configuration and deployed environment should be reviewed before production use.

These results apply only to the scenarios exercised by the tests. They are not a complete security audit and do not guarantee production readiness.

## 5. Residual Risks and Future Improvements

The main security tasks still to address are:

- Continue reviewing CSRF protection across relevant state-changing routes and add regression tests where coverage is incomplete.
- Expand audit coverage for successful actions, denied requests, and failures.
- Add more authorization regression tests and malformed-file tests.
- Continue reviewing session handling and production configuration.
- Review database SSL settings and deployment security.
- Complete frontend regression testing for document-management workflows.
- Verify document persistence across application restarts and redeployments.
- Configure and test database backup and recovery procedures.
- Complete API documentation and deployment instructions.
- Verify security settings in the deployed environment.

## 6. Conclusion

Building TrustVault has helped me understand why security checks must be enforced on the server rather than relying on the user interface alone. I have implemented and tested several important protections, including authentication, document-level authorization, selected audit logging, and automated security checks.

The frontend is integrated with the backend and has been manually tested for selected workflows. The latest confirmed full automated test run passed 48 tests, with no failures, skipped tests, or cancelled tests.

However, additional testing, verification of persistent file storage, and production deployment review remain necessary before the application should be used for sensitive documents.

This threat model will be updated as further features are implemented and additional security tests are completed.