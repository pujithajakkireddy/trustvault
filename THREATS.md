# TrustVault Threat Model

## 1. Purpose

TrustVault is being developed as a secure document-sharing application for the Snovasys Fresher Hiring Challenge 2026. This threat model identifies the information that must be protected, the main threats, and the controls planned to reduce those threats.

The application is currently at the initial Express server stage. The controls below are design requirements, not claims that security has already been implemented or verified.

## 2. Assets to Protect

- Uploaded document contents and metadata.
- User accounts, passwords, and sessions.
- Document ownership and access permissions.
- Audit records and security events.
- Application configuration and database credentials.

## 3. Threats and Planned Mitigations

### T1. Unauthorized Document Access

**Threat:** A user accesses another user's document by changing a document ID in a URL or API request.

**Planned mitigation:** Check the authenticated user's permission for the specific document on every relevant server-side operation. Test access using multiple users and documents.

### T2. Unauthorized Download or Modification

**Threat:** A user without permission downloads, edits, or deletes a document.

**Planned mitigation:** Enforce document-level authorization for viewing, downloading, editing, and deleting. Reject unauthorized requests and test each protected operation.

### T3. Privilege Escalation

**Threat:** A user changes request data to obtain administrator privileges or grant themselves additional document permissions.

**Planned mitigation:** Determine roles and ownership from trusted server-side records. Validate permission changes and restrict administrative operations to authorized roles.

### T4. Account and Session Compromise

**Threat:** Weak password handling, stolen sessions, or session misuse allows another person to act as a legitimate user.

**Planned mitigation:** Use a suitable password-hashing library, secure session configuration, and appropriate session-cookie settings. Never store plaintext passwords or commit secrets to Git.

### T5. Malicious or Invalid File Uploads

**Threat:** An attacker uploads a file designed to exploit the application, bypass file restrictions, or consume excessive storage.

**Planned mitigation:** Apply file-size and file-type restrictions, validate file contents where appropriate, generate safe server-side storage identifiers, and prevent uploaded content from being executed as application code.

### T6. Audit Log Tampering or Missing Events

**Threat:** A user or application bug changes or removes audit records, or security-relevant actions are not recorded.

**Planned mitigation:** Record relevant successful and denied actions, including document operations and permission changes. Restrict who can modify audit records and test that expected events are recorded. Any tamper-evidence mechanism must be verified and must not be described as fully immutable unless that property is actually guaranteed.

### T7. Information Leakage

**Threat:** Error responses, logs, or document URLs reveal confidential content or information about documents a user cannot access.

**Planned mitigation:** Avoid returning document contents or sensitive internal details in error responses. Apply consistent authorization checks and review logs for sensitive information.

### T8. Search and Metadata Leakage

**Threat:** Search results reveal document names, owners, categories, or dates to users who lack permission to view those documents.

**Planned mitigation:** Apply authorization filtering to search results on the server before returning them to the client.

### T9. Missing or Inadequate Security Tests

**Threat:** A change removes an authorization check without being detected.

**Planned mitigation:** Create automated tests for unauthorized document access, downloads, edits, deletions, and permission changes. Ensure the tests fail when a required authorization control is removed.

## 4. Security Verification Plan

For each security control, document:
- The expected secure behavior.
- The test or procedure used to verify it.
- The actual result.
- Any failure and the correction made.

No security control should be marked as verified until its corresponding test or review has actually been completed.

## 5. Current Limitations

The current application contains only an initial Express server and a root route. Authentication, document authorization, file validation, audit logging, and automated security tests remain to be implemented.

This threat model will be updated as the design and implementation evolve.
