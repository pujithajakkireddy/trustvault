# TrustVault

### Secure Document Sharing with a Real Audit Trail

TrustVault is a secure document-sharing application developed for the **Snovasys Fresher Hiring Challenge 2026**. It helps users share documents through server-side access controls while maintaining audit records of selected important actions.

The application uses Node.js, Express, and PostgreSQL. It includes authentication, document-level permissions, document upload and download, access-controlled search, selected audit logging, document-integrity verification, and a web interface.

## Project Status

The core backend features, frontend integration, and security tests have been implemented. TrustVault has been deployed to Render and verified through selected application workflows and access-control checks.

The project remains a working prototype. Additional security testing, production configuration review, and verification of database persistence, backup, and recovery are required before it should be used for sensitive documents.

## Implemented Features

- User registration and login with bcrypt password hashing.
- Server-side sessions stored in PostgreSQL.
- Role support for `admin`, `owner`, and `viewer`.
- New registrations receive the `viewer` role by default.
- Web interface for registration, login, and the authenticated workspace.
- Document uploads with a 5 MB size limit.
- File-signature checks for supported PDF, PNG, and JPEG uploads.
- Document ownership and document-specific read/edit permissions.
- Routes to grant and revoke document permissions.
- Document download, metadata editing, and owner-restricted deletion.
- Document search and filtering with server-side access checks.
- SHA-256 integrity verification during document downloads.
- Audit logging for selected document operations.
- CSRF-token validation for protected document operations.
- An admin-only audit-log API endpoint.
- Security headers and login rate limiting.
- Automated tests for selected authentication, authorization, CSRF, search, audit, session, and upload-validation scenarios.

The frontend has been connected to the Express server and manually tested for registration, login, document upload, download, logout, and the signed-out state. Administrator endpoint access restrictions have also been checked.

## Limitations and Future Improvements

- Expand audit logging to cover additional failure paths and review audit-record protection against unauthorized modification or deletion.
- Perform comprehensive frontend regression testing and verify all security-sensitive workflows in the deployed environment.
- Expand automated tests for malformed files and additional authorization edge cases.
- Document and test database backup and recovery procedures.
- Verify document persistence across deployment restarts and continue reviewing production security configuration.

## Technology Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** PostgreSQL with Neon
- **Authentication:** bcrypt password hashing and server-side sessions
- **Session Storage:** PostgreSQL using `connect-pg-simple`
- **Security:** Helmet, login rate limiting, and CSRF-token validation
- **File Uploads:** Multer in-memory buffering, PostgreSQL `BYTEA` document storage, and SHA-256 integrity verification
- **Frontend:** HTML, CSS, and JavaScript
- **Testing:** Node.js test runner and Supertest
- **Version Control:** Git and GitHub

## Project Structure

```text
trustvault/
├── src/
│   ├── db/
│   │   ├── database.js
│   │   ├── schema.sql
│   │   ├── apply-schema.js
│   │   └── check-connection.js
│   ├── middleware/
│   │   ├── require-auth.js
│   │   ├── require-role.js
│   │   ├── csrf-protection.js
│   │   └── upload.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── documents.js
│   │   └── admin.js
│   ├── services/
│   │   └── audit.js
│   └── server.js
├── tests/
│   ├── admin-audit.test.js
│   ├── auth-middleware.test.js
│   ├── csrf-protection.test.js
│   ├── document-access.test.js
│   ├── role-middleware.test.js
│   └── run-mutation-check.js
├── public/
│   ├── index.html
│   ├── styles.css
│   └── app.js
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── THREATS.md
└── PROMPTS.md
```

This tree documents the intended project layout. Confirm file names and paths against the current repository before submission.

## Prerequisites

- Node.js and npm installed.
- Access to a PostgreSQL database.
- Git, if cloning the repository.
- Environment variables configured in a local `.env` file.

## Running the Project Locally

### 1. Clone the Repository

```bash
git clone https://github.com/pujithajakkireddy/trustvault.git
cd trustvault
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Copy `.env.example` to `.env` and replace all placeholder values with your own configuration.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure these variables:

- `DATABASE_URL`: PostgreSQL connection string for the application database.
- `SESSION_SECRET`: A private random secret containing at least 32 characters.
- `NODE_ENV`: The runtime environment, such as `development`, `test`, or `production`.
- `PORT`: Optional local server port; the default is `3000`.
- `TEST_DATABASE_URL`: A separate PostgreSQL database connection string for integration tests.

Use a separate test database. Never point tests at production data.

Never commit `.env` or publish database credentials, session secrets, or real account passwords.

### 4. Apply the Database Schema

```bash
node src/db/apply-schema.js
```

Verify that the script is configured to use the intended database before running it. Do not run schema changes against a database containing important data unless you understand their effects.

### 5. Start the Application

```bash
npm start
```

### 6. Open the Application

Open the following address in your browser:

`http://localhost:3000`

The backend health endpoint can be checked at:

`http://localhost:3000/api/health`

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application |
| `SESSION_SECRET` | Secret used to sign session cookies; must contain at least 32 characters |
| `TEST_DATABASE_URL` | Separate PostgreSQL connection string for integration tests |
| `NODE_ENV` | Runtime environment, such as `test` or `production` |
| `PORT` | Optional server port; defaults to `3000` |

**Security note:** `.env.example` contains placeholders only. Replace them locally with private values. Never commit `.env` or publish database credentials, session secrets, or real account passwords.

## Testing

TrustVault uses Node.js's built-in test runner and Supertest to check selected application and security behavior.

### Run the Integration Tests

In Windows PowerShell:

```powershell
$env:NODE_ENV = "test"
npm run test:integration
```

### Run the Full Test Suite

```powershell
$env:NODE_ENV = "test"
npm test
```

Make sure `TEST_DATABASE_URL` is configured and the test database is reachable before running tests that require PostgreSQL.

### Latest Verified Full Test Run

The latest confirmed full test run reported:

- **Passed:** 48
- **Failed:** 0
- **Skipped:** 0
- **Cancelled:** 0

The tests cover selected scenarios involving:

- Authentication and session handling, including logout.
- Document ownership, read permissions, and permission revocation.
- Unauthorized downloads, edits, and deletions.
- CSRF-token validation for tested requests.
- Search authorization and invalid filters.
- Selected audit-log entries.
- Role-based access to the admin audit endpoint.
- Audit endpoint limits and invalid query parameters.
- Oversized uploads and unsupported file content.
- Document-integrity failure detection.
- Permission grant and revocation authorization checks.
- Audit records for selected denied permission changes.

These results apply only to the scenarios covered by the tests. Passing the suite does not guarantee that every feature works in every situation or that the application has no security vulnerabilities.

A PostgreSQL SSL-mode compatibility warning was observed during earlier testing. Later checks did not return matching SSL-related messages, but production SSL verification has not been independently confirmed. The database connection configuration and deployed environment should be reviewed before production use.

## Security Considerations

Security is a central focus of TrustVault. The application enforces authorization on the server rather than relying on the frontend to hide or restrict protected operations.

The current implementation includes password hashing, server-side sessions, document ownership and permission checks, permission-filtered search, upload limits, file-signature checks, security headers, login rate limiting, CSRF-token validation on protected operations, document-integrity checks, and selected audit records.

The following limitations remain:

- **File validation:** File-signature checks do not provide complete file-format validation. Malware scanning is not implemented.
- **CSRF protection:** CSRF-token validation is implemented for protected operations, but coverage across all relevant state-changing endpoints still requires review.
- **Audit logging:** Coverage is not yet proven complete. Database audit records are not inherently immutable or tamper-proof.
- **File storage:** Multer buffers incoming uploads in memory. After validation, document bytes are stored in PostgreSQL in the `documents.content` column (`BYTEA`), alongside a SHA-256 hash. Persistence across an actual Render restart or redeployment has not yet been independently verified. Database availability, backup, and recovery also need to be verified for production use.
- **Production configuration:** HTTPS, proxy settings, secure session-cookie behavior, database connection security, and PostgreSQL SSL configuration require review.
- **Testing:** Automated tests cover selected scenarios, not every possible attack or failure.

The recorded test results provide evidence for the scenarios exercised; they do not constitute a complete security audit or guarantee production readiness.

**Do not use the application to store sensitive production documents until the remaining security and storage concerns have been addressed.**

For additional details, see [THREATS.md](THREATS.md).

## Project Documentation

- **[THREATS.md](THREATS.md):** Security threats, implemented protections, test evidence, and remaining risks.
- **[PROMPTS.md](PROMPTS.md):** A dated record of AI assistance, development tasks, implementation changes, and verification results.
- **`src/db/schema.sql`:** Database schema.
- **`tests/`:** Automated tests for selected application and security behavior.

## Repository

**GitHub:** https://github.com/pujithajakkireddy/trustvault

**Live Demo:** https://trustvault-0law.onrender.com

**Note on availability:** The hosted application may take longer to respond to the first request after a period of inactivity, depending on the hosting service's current instance state. If the page does not load immediately, wait briefly and try again.

## Conclusion

TrustVault is a secure document-sharing application developed for the Snovasys Fresher Hiring Challenge 2026. It brings together user authentication, document-level access control, permission management, document-integrity verification, selected audit logging, and a web-based interface.

The implementation has been verified through automated tests covering key authorization, session, CSRF, upload-validation, search, and audit scenarios. The latest confirmed full test run passed **48 tests**, with **0 failures, 0 skipped tests, and 0 cancelled tests**.

TrustVault demonstrates the practical application of security principles such as server-side authorization, controlled document access, password hashing, session management, and integrity checking.

The current implementation is a working project prototype. Broader security verification, confirmation of database persistence after deployment restarts, backup and recovery planning, and production deployment hardening remain important before it is used to store sensitive documents.