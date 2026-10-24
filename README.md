# TrustVault

### Secure Document Sharing with a Real Audit Trail

TrustVault is a secure document-sharing application developed for the **Snovasys Fresher Hiring Challenge 2026**. Its goal is to help users share documents securely through server-side access controls while maintaining audit records of selected important actions.

The application uses Node.js, Express, and PostgreSQL. It includes authentication, document-level permissions, document upload and download, access-controlled search, selected audit logging, and a web interface.

## Project Status

The core backend features, frontend integration, and security tests have been implemented. The application is still under development, and additional security testing and production configuration work are required before it should be used for sensitive documents.

### Implemented Features

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
- Audit logging for selected document operations.
- CSRF-token validation for protected document operations.
- An admin-only audit-log API endpoint.
- Security headers and login rate limiting.
- Automated tests for selected authentication, authorization, CSRF, search, audit, session, and upload-validation scenarios.

The frontend has been connected to the Express server and manually tested for registration, login, document upload, download, logout, and the signed-out state. Administrator endpoint access restrictions have also been checked.

### Work Still Needed

- Complete frontend regression testing and verify all user workflows.
- Review CSRF protection across all relevant state-changing routes.
- Expand audit logging and verify coverage for successful actions, denied requests, and failures.
- Add more tests for malformed files and authorization edge cases.
- Complete API documentation and deployment instructions.
- Review production configuration, HTTPS and proxy settings, and the PostgreSQL SSL-mode warning.
- Configure persistent file storage before production use.
- Deploy the application and verify its behavior in the hosting environment.

## Technology Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** PostgreSQL with Neon
- **Authentication:** bcrypt password hashing and server-side sessions
- **Session Storage:** PostgreSQL using `connect-pg-simple`
- **Security:** Helmet, login rate limiting, and CSRF-token validation
- **File Uploads:** Multer with in-memory storage
- **Frontend:** HTML, CSS, and JavaScript
- **Testing:** Node.js test runner and Supertest
- **Version Control:** Git and GitHub

## Project Structure

```text
trustvault/
|-- src/
|   |-- db/
|   |   |-- database.js
|   |   |-- schema.sql
|   |   |-- apply-schema.js
|   |   `-- check-connection.js
|   |-- middleware/
|   |   |-- require-auth.js
|   |   |-- require-role.js
|   |   |-- csrf-protection.js
|   |   `-- upload.js
|   |-- routes/
|   |   |-- auth.js
|   |   |-- documents.js
|   |   `-- admin.js
|   |-- services/
|   |   `-- audit.js
|   `-- server.js
|-- tests/
|   |-- admin-audit.test.js
|   |-- auth-middleware.test.js
|   |-- csrf-protection.test.js
|   |-- document-access.test.js
|   |-- role-middleware.test.js
|   `-- run-mutation-check.js
|-- public/
|   |-- index.html
|   |-- styles.css
|   `-- app.js
|-- docs/
|-- .gitignore
|-- package.json
|-- package-lock.json
|-- README.md
|-- THREATS.md
`-- PROMPTS.md
```

This structure reflects the expected project layout. Check it against the repository before submission and update any paths if the actual structure differs.

## Prerequisites

- Node.js and npm installed.
- Access to a PostgreSQL database.
- Environment variables configured in a local `.env` file.
- Git, if cloning the repository.

## Running the Project Locally

### 1. Clone the repository

```bash
git clone https://github.com/pujithajakkireddy/trustvault.git
cd trustvault
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a local `.env` file and configure the required variables. Set `DATABASE_URL` to your application database and use a strong, private `SESSION_SECRET`.

Configure `TEST_DATABASE_URL` separately if you intend to run integration tests. Use a separate test database to avoid modifying application data during testing.

Never commit the `.env` file or publish database credentials and session secrets.

### 4. Apply the database schema

```bash
node src/db/apply-schema.js
```

Verify that the script is configured to use the intended database before running it. Do not run schema changes against a database containing important data unless you understand their effects.

### 5. Start the application

```bash
npm start
```

### 6. Open the application

Open the following address in your browser:

`http://localhost:3000`

The root URL serves the TrustVault web interface. The backend health endpoint can be checked at:

`http://localhost:3000/api/health`

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `TEST_DATABASE_URL` | Separate PostgreSQL connection string for integration tests |
| `NODE_ENV` | Runtime environment, such as `test` or `production` |

**Security note:** Never commit `.env` or publish database credentials, session secrets, or real account passwords. Use a separate test database for tests that create or modify records.

## Testing

TrustVault uses Node.js's built-in test runner and Supertest to check selected application and security behavior.

### Run the integration tests

In Windows PowerShell:

```powershell
$env:NODE_ENV = "test"
npm run test:integration
```

### Run the full test suite

```powershell
$env:NODE_ENV = "test"
npm test
```

Make sure the test database is configured and reachable before running tests that require PostgreSQL.

### Latest Verified Full Test Run

The latest recorded full test run reported:

- **Passed:** 46
- **Failed:** 0
- **Skipped:** 0

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

These results apply only to the scenarios covered by the tests. Passing the suite does not guarantee that every feature works in every situation or that the application has no security vulnerabilities.

A PostgreSQL SSL-mode compatibility warning has appeared during testing. It did not prevent the recorded test run from passing, but the database connection configuration still needs review.

## Security Considerations

Security is a central focus of TrustVault. The application enforces authorization on the server rather than relying on the frontend to hide or restrict protected operations.

The current implementation includes password hashing, server-side sessions, document ownership and permission checks, permission-filtered search, upload limits, file-signature checks, security headers, login rate limiting, CSRF-token validation on protected operations, and selected audit records.

The following limitations remain:

- **File validation:** File-signature checks do not provide complete file-format validation. Malware scanning is not implemented.
- **CSRF protection:** Protection requires further review across all relevant state-changing endpoints.
- **Audit logging:** Coverage is not yet proven complete. Database audit records are not inherently immutable or tamper-proof.
- **File storage:** Uploaded files currently use in-memory storage. Files held only in application memory are not persistent across process restarts. Production deployment requires suitable persistent storage.
- **Production configuration:** HTTPS, proxy settings, secure session-cookie behavior, database connection security, and the PostgreSQL SSL-mode warning require review.
- **Testing:** Automated tests cover selected scenarios, not every possible attack or failure.

The recorded test results provide evidence for the scenarios exercised; they do not constitute a complete security audit or guarantee production readiness.

Do not use the application to store sensitive production documents until the remaining security and storage concerns have been addressed.

For additional details, see [THREATS.md](THREATS.md).

## Project Documentation

- **[THREATS.md](THREATS.md):** Security threats, implemented protections, test evidence, and remaining risks.
- **[PROMPTS.md](PROMPTS.md):** A dated record of AI assistance, development tasks, implementation changes, and verification results.
- **`src/db/schema.sql`:** Database schema, if present in the repository.
- **`tests/`:** Automated tests for selected application and security behavior.

## Repository

GitHub: https://github.com/pujithajakkireddy/trustvault

## Conclusion

TrustVault is a secure document-sharing application developed for the Snovasys Fresher Hiring Challenge 2026. It brings together user authentication, document-level access control, permission management, document integrity verification, selected audit logging, and a web-based interface.

The implementation has been verified through automated tests covering key authorization, session, CSRF, upload-validation, search, and audit scenarios. The latest recorded full test run passed 46 tests with no failures or skipped tests.

TrustVault demonstrates the practical application of security principles such as server-side authorization, controlled document access, password hashing, session management, and integrity checking.

The current implementation is a working project prototype. Persistent file storage, broader security verification, and production deployment hardening remain important before it is used to store sensitive documents in a production environment.
