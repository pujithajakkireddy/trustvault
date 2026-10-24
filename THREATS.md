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

**Remaining risk:** Review session lifecycle, error handling, HTTPS and proxy configuration, and CSRF protection on other relevant state-changing requests. Rotate any previously exposed temporary test-account password privately before the final demonstration.

### T5. Malicious or Invalid File Uploads

**Threat:** A user uploads an unsupported, malformed, or malicious file, or attempts to consume excessive resources.

**Implemented controls:** Uploads have a 5 MB size limit. The application checks file signatures for supported PDF, PNG, and JPEG uploads.

**Verification:** Integration tests confirm that the tested oversized upload is rejected with HTTP 413 and unsupported file content is rejected with HTTP 400.

**Remaining risk:** File-signature checks do not fully validate a file's format and do not detect malware. More malformed-file and resource-exhaustion tests are needed.

### T6. Missing or Altered Audit Records

**Threat:** Important actions are not recorded, or someone changes or deletes audit records.

**Implemented controls:** An audit service records selected security-related events. The admin-only endpoint allows authorized administrators to view recent audit records.

**Verification:** Tests check selected successful edit and deletion audit entries. Admin endpoint tests also verify access restrictions, returned audit data, and limit validation.

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

**Verification:** A previous mutation test showed that the unauthorized-download and revoked-permission tests failed when the relevant authorization condition was deliberately removed. The latest recorded full test run passed 46 tests, with no failures or skipped tests. These results apply only to the scenarios exercised by the test suite and do not constitute a complete security audit.

**Remaining risk:** The mutation test checks one specific regression. More security tests and code reviews are needed to cover other possible failures.

### T10. Frontend and API Integration Errors

**Threat:** Frontend errors or incorrect API integration could cause users to misunderstand operation results or prevent them from completing document workflows.

**Implemented controls:** The frontend is served by Express and communicates with the existing backend API. Manual checks have covered registration, login, document upload, download, logout, and the signed-out state.

**Verification:** The website loaded locally, the tested uploaded document appeared in the workspace after refreshing, the downloaded file opened correctly, and a viewer was denied access to the administrator audit endpoint.

**Remaining risk:** Complete regression testing is still required for permission grants and revocations, metadata editing, deletion, and the administrator audit interface. Frontend behavior must not replace server-side authorization.

### T11. Loss of Uploaded Files

**Threat:** Uploaded documents may be lost when an application process restarts or when a hosting platform replaces its temporary filesystem.

**Current implementation:** The upload middleware uses Multer with in-memory storage. Uploaded file contents are not guaranteed to persist across process restarts.

**Required mitigation:** Configure suitable persistent file storage before production use. Verify that uploaded documents remain available after application restarts and that only authorized users can retrieve them. Avoid exposing private documents through unrestricted public URLs.

**Remaining risk:** Persistent file storage has not yet been configured or verified in a production deployment.

### T12. Production Deployment Misconfiguration

**Threat:** Incorrect production settings could expose sessions, database credentials, or protected application functionality.

**Current status:** The application has been tested locally. Production deployment and its security settings have not yet been verified.

**Required mitigation:** Use HTTPS, configure secure session cookies and trusted proxy settings correctly, keep secrets in the hosting provider's environment configuration, review database SSL settings, and test authentication and authorization after deployment.

**Remaining risk:** These controls must be checked in the actual hosting environment before the application is considered ready for sensitive documents.

## 4. Security Verification Record

The latest recorded full test run reported:

- **Tests passed:** 46
- **Tests failed:** 0
- **Tests skipped:** 0

The test suite covers selected scenarios involving:

- Document ownership, sharing, and permission revocation.
- Unauthorized downloads, editing, and deletion.
- CSRF-token validation for tested document operations.
- Search authorization and invalid-filter handling.
- Selected audit records.
- Logout and session invalidation.
- Role-based access to the administrator audit endpoint.
- Audit endpoint query limits and invalid values.
- Oversized uploads and unsupported file content.

A PostgreSQL SSL-mode compatibility warning has appeared during testing. It did not prevent the recorded test run from passing, but the database connection configuration still needs review.

These results apply only to the scenarios exercised by the tests. They are not a complete security audit and do not guarantee production readiness.

## 5. Remaining Work

The main security tasks still to address are:

- Continue reviewing CSRF protection across relevant state-changing routes and add regression tests where coverage is incomplete.
- Expand audit coverage for successful actions, denied requests, and failures.
- Add more authorization regression tests and malformed-file tests.
- Continue reviewing session handling and production configuration.
- Review database SSL settings and deployment security.
- Complete frontend regression testing for document-management workflows.
- Configure and verify persistent file storage.
- Complete API documentation and deployment instructions.
- Verify security settings in the deployed environment.
- Rotate any previously exposed temporary test-account password privately before the final demonstration.

## 6. Conclusion

Building TrustVault has helped me understand why security checks must be enforced on the server rather than relying on the user interface alone. I have implemented and tested several important protections, including authentication, document-level authorization, selected audit logging, and automated security checks.

The frontend is now integrated with the backend and has been manually tested for selected workflows. However, additional testing, persistent file storage, and production deployment verification remain necessary before the application should be used for sensitive documents.

This threat model will be updated as further features are implemented and additional security tests are completed.
