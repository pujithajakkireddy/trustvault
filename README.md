# TrustVault
### Secure Document Sharing with a Real Audit Trail

TrustVault is a document-sharing application I am developing for the **Snovasys Fresher Hiring Challenge 2026**. The main goal is to let users share documents securely while making sure that access is controlled by the server and important actions can be tracked through audit logs.

The project uses Node.js, Express, and PostgreSQL. I have focused on authentication, document permissions, secure access checks, and automated testing.

## Project Status

The core backend features and security tests are implemented. The application is still under development, and some areas need further testing and improvement before production use.

### Implemented features

- User registration and login with bcrypt password hashing.
- Server-side sessions stored in PostgreSQL.
- Role support for `admin`, `owner`, and `viewer`. New registrations receive the `viewer` role by default.
- Document uploads with a 5 MB size limit.
- File-signature checks for supported PDF, PNG, and JPEG uploads.
- Document ownership and document-specific read/edit permissions.
- Routes to grant and revoke document permissions.
- Document download, metadata editing, and owner-restricted deletion.
- Document search and filtering with access checks.
- Audit logging for selected document operations.
- CSRF-token validation for protected document operations.
- An admin-only audit-log API endpoint.
- Security headers and login rate limiting.
- Automated tests for selected authentication, authorization, CSRF, search, audit, session, and upload-validation scenarios.

### Work still needed

- Review CSRF protection across all relevant state-changing routes.
- Expand audit logging and verify coverage for more success, denial, and failure cases.
- Add more tests for malformed files and authorization edge cases.
- Build and test the frontend and connect it to the backend.
- Complete API documentation and deployment instructions.
- Review production configuration and the PostgreSQL SSL-mode warning.

## Technology Stack

- **Runtime:** Node.js
- **Backend:** Express.js
- **Database:** PostgreSQL with Neon
- **Authentication:** bcrypt and server-side sessions
- **Session storage:** PostgreSQL using `connect-pg-simple`
- **Security:** Helmet, login rate limiting, and CSRF-token validation
- **File uploads:** Multer with in-memory storage
- **Testing:** Node.js test runner and Supertest
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
│   │   ├── documents.js
│   │   └── admin.js
│   ├── services/
│   │   └── audit.js
│   └── server.js
├── tests/
│   ├── document-access.test.js
│   ├── admin-audit.test.js
│   └── csrf-protection.test.js
├── public/
├── docs/
├── .env.example
├── .gitignore
├── package.json
├── README.md
├── THREATS.md
└── PROMPTS.md
```

This is the expected structure based on the current implementation. Check it against your repository before submitting, and adjust any paths if your files are arranged differently.

## Prerequisites

- Node.js and npm installed.
- Access to a PostgreSQL database.
- Environment variables configured in a local `.env` file.

## Running the Project Locally

1. Clone the repository and open the project folder in your terminal.

2. Install the dependencies:

   ```bash
   npm install
   ```

3. Configure the required environment variables in `.env`. Set `DATABASE_URL` to your application database and use a strong `SESSION_SECRET`. Configure `TEST_DATABASE_URL` separately if you want to run the integration tests.

4. Apply the database schema:

   ```bash
   node src/db/apply-schema.js
   ```

   Check that the script is configured to use the intended database before running it.

5. Start the application:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser. The root endpoint should return a response confirming that TrustVault is running.

## Environment Variables

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string for the application |
| `SESSION_SECRET` | Secret used to sign session cookies |
| `TEST_DATABASE_URL` | Separate database connection string for integration tests |
| `NODE_ENV` | Runtime environment; set to `test` when running the integration suite |

**Important:** Do not commit `.env` or publish database credentials, session secrets, or real account passwords. Always use a separate test database for tests that create or modify records.

## Testing

TrustVault uses Node.js's built-in test runner and Supertest to check selected application behavior.

To run the integration tests in Windows PowerShell:

```powershell
$env:NODE_ENV = "test"
npm run test:integration
```

To run the full test suite:

```powershell
$env:NODE_ENV = "test"
npm test
```

### Latest verified full test run

- **Passed:** 45
- **Failed:** 0
- **Skipped:** 0

The tests cover selected cases involving:

- Authentication and session handling, including logout.
- Document ownership, read permissions, and permission revocation.
- Unauthorized downloads, edits, and deletions.
- CSRF-token validation for tested requests.
- Search authorization and invalid filters.
- Selected audit-log entries.
- Role-based access to the admin audit endpoint.
- Audit endpoint limits and invalid query parameters.
- Oversized uploads and unsupported file content.

These results apply to the scenarios covered by the tests. Passing the suite does not guarantee that every feature works in every situation or that the application has no security vulnerabilities.

## Security Considerations

Security has been an important part of this project, particularly server-side authorization and preventing users from accessing documents they have not been permitted to view.

The current implementation includes password hashing, server-side sessions, permission checks, permission-filtered search, upload limits, file-signature checks, security headers, rate limiting, and selected audit records.

Some limitations remain:

- File-signature checks are not full file-format validation, and malware scanning is not implemented.
- CSRF protection needs further review across relevant state-changing endpoints.
- Audit logging does not yet have proven complete coverage, and database audit records are not inherently tamper-proof.
- Production deployment, HTTPS and proxy settings, session handling, and database connection security need further review.
- Automated tests cover selected cases rather than every possible attack or failure.

For more details, see [THREATS.md](THREATS.md).

## Project Documentation

- **[THREATS.md](THREATS.md):** Security threats, current protections, test evidence, and remaining risks.
- **[PROMPTS.md](PROMPTS.md):** A dated record of AI assistance, development tasks, implementation changes, and verification results.
- **`src/db/schema.sql`:** Database schema, if present in the repository.
- **`tests/`:** Automated tests for selected application and security behavior.

This project is a work in progress. I will continue improving the implementation and updating the documentation as additional features and tests are completed.