# TrustVault

**Secure Document Sharing with a Real Audit Trail**

TrustVault is a document-sharing application developed for the **Snovasys Fresher Hiring Challenge 2026**. It is designed to help users store and share documents securely through authentication, document-level permissions, access controls, and audit logging.

## Project Status

**Current stage:** Core backend implementation and security testing.

The application includes authentication, PostgreSQL-backed sessions, document operations, document-level permissions, permission-filtered search, audit logging for selected operations, and automated integration tests.

**Latest verified integration test run:** October 22, 2026.

- **Tests passed:** 32
- **Tests failed:** 0
- **Tests skipped:** 0

These results verify the scenarios exercised by the integration suite. They do not establish that the entire application is secure or that every challenge requirement is complete.

## Features

### Implemented

- User registration and login with bcrypt password hashing.
- Server-side sessions stored in PostgreSQL.
- Role support for `admin`, `owner`, and `viewer`, with registration defaulting to `viewer`.
- Document upload handling with a 5 MB size limit.
- PDF, PNG, and JPEG file-signature checks against the expected file type and metadata.
- Document ownership and document-specific read/edit permissions.
- Permission granting and revocation through server-side routes.
- Document download, metadata editing, and owner-restricted deletion.
- Search and filtering by document name, category, owner ID, and creation-date range, subject to access permissions.
- Audit logging for selected operations.
- CSRF-token validation for the tested document-editing requests.
- Security headers and login rate limiting.
- Automated integration tests for selected authorization, search, audit, session, and upload-validation scenarios.
- Centralized handling of oversized upload errors, returning HTTP 413 for files exceeding the configured limit.

### In Progress

- Broader CSRF protection and testing across relevant state-changing endpoints.
- More comprehensive audit coverage for uploads, downloads, permission changes, denied requests, and failures.
- Additional file-validation and malformed-upload tests.
- Administrative activity and permission views.
- Frontend implementation and end-to-end testing.
- Expanded authorization regression tests and deployment-security review.

## Technology Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** PostgreSQL with Neon
- **Authentication:** bcrypt and server-side sessions
- **Session storage:** PostgreSQL using `connect-pg-simple`
- **Security:** Helmet, rate limiting, and CSRF-token validation for tested document operations
- **File handling:** Multer with in-memory upload storage
- **Testing:** Node.js built-in test runner and Supertest
- **Version control:** Git and GitHub

## Project Structure

```text
trustvault/
├── src/
│   ├── db/
│   │   ├── database.js
│   │   ├── schema.sql
│   │   └── apply-schema.js
│   ├── middleware/
│   │   ├── require-auth.js
│   │   ├── require-role.js
│   │   ├── csrf-protection.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── auth.js
│   │   └── documents.js
│   ├── services/
│   │   └── audit.js
│   └── server.js
├── tests/
│   └── document-access.test.js
├── public/
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── PROMPTS.md
├── THREATS.md
└── README.md
```

*Note: Verify this structure against your actual repository. Remove or rename entries that do not exist in your project.*

## Prerequisites

- Node.js and npm.
- A PostgreSQL database.
- Environment variables configured locally.

## Run Locally

1. Clone the repository and open its project directory.

2. Install dependencies:

   ```bash
   npm install
   ```

3. Configure the required environment variables in a local `.env` file. At minimum, configure the application database URL and a strong session secret. Configure `TEST_DATABASE_URL` separately if you intend to run the integration tests.

4. Apply the database schema using the project's schema setup script:

   ```bash
   node src/db/apply-schema.js
   ```

   Ensure the script is configured to use the intended database before running it.

5. Start the application:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser.

   The root endpoint should return a JSON response confirming that TrustVault is running.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `TEST_DATABASE_URL` | Separate PostgreSQL connection string for integration tests |
| `NODE_ENV` | Runtime environment; use `test` when running the integration suite |

**Security:** Never commit `.env` or publish database credentials, session secrets, or real account passwords. Use a separate test database for tests that create or modify data.

## Testing

The project uses Node.js's built-in test runner and Supertest.

Run the integration suite in PowerShell:

```powershell
$env:NODE_ENV = "test"
npm run test:integration
```

**Date:** October 22, 2026

| Result | Count |
|---|---:|
| Tests passed | 32 |
| Tests failed | 0 |
| Tests skipped | 0 |

The verified test scenarios include:

- **Document access:** Ownership checks, read grants, and permission revocation.
- **Unauthorized downloads:** Requests without authentication or permission are rejected.
- **Document deletion:** Non-owners are denied deletion, while authorized owners can delete their documents.
- **Document editing:** Ownership and explicit edit permissions are checked; read-only viewers cannot edit metadata.
- **CSRF validation:** Missing and invalid CSRF tokens are rejected for the tested document-editing requests.
- **Audit checks:** Selected document operations are verified to produce audit records.
- **Search authorization:** Search results respect document access permissions.
- **Filter validation:** Invalid owner IDs and calendar dates are rejected.
- **Session handling:** Logging out invalidates the authenticated session.
- **Upload validation:** Files exceeding 5 MB are rejected with HTTP 413, and unsupported file content is rejected with HTTP 400.

The test suite completed with zero failures and zero skipped tests. These results apply only to the scenarios covered by the tests; additional verification is required for comprehensive security assurance.

## Security Considerations

TrustVault is under active development and should not yet be used to store sensitive or confidential documents in a production environment.

Current safeguards include password hashing, server-side sessions, access-control checks, permission-filtered search, upload size limits, file-signature checks, security headers, login rate limiting, and selected audit records.

Important limitations remain:

- File-signature checks are not full file-format validation and do not include malware scanning.
- CSRF protection requires broader endpoint review and testing.
- Audit coverage is not yet comprehensive, and database audit records are not inherently immutable.
- Session configuration, HTTPS and proxy settings, error handling, and deployment security require further review.
- Upload validation tests do not establish that all malformed or malicious files are safely handled.
- Passing integration tests does not prove the absence of security vulnerabilities.

For the detailed threat analysis, implemented controls, verification evidence, and outstanding mitigations, see [`THREATS.md`](THREATS.md).

## Project Documentation

- [`THREATS.md`](THREATS.md) — Threat model, implemented controls, verification evidence, and remaining risks.
- [`PROMPTS.md`](PROMPTS.md) — Dated AI assistance log, implementation tasks, and verification results.
- `src/db/schema.sql` — Database schema, if this file exists in the repository.
- `tests/document-access.test.js` — Automated document-access integration tests.

## Challenge Context

TrustVault is being developed for the Snovasys Fresher Hiring Challenge 2026, with a focus on secure document sharing, server-side authorization, auditability, and automated security testing.