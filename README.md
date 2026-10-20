# TrustVault

**Secure document sharing with a real audit trail**

TrustVault is a secure document-sharing application being developed for the Snovasys Fresher Hiring Challenge 2026. It is designed to let users upload documents, manage document-specific permissions, and track activity through an audit trail.

## Project Status

**Current stage:** Initial Express server setup.

The application currently responds to requests at its root URL. Authentication, document storage, document-level authorization, audit logging, search, and automated security tests are planned implementation tasks and are not yet complete.

## Planned Features

- User authentication and role-based access.
- Document upload and management.
- Per-document read and edit permissions.
- Permission granting and revocation by document owners.
- Audit records for document activity and permission changes.
- Recording of denied access attempts.
- Document search and filtering.
- Administrative views for activity and permissions.
- Automated tests for unauthorized cross-user access.

## Technology

- Node.js
- Express
- Git and GitHub

Additional technologies and dependencies will be documented as they are selected and implemented.

## Run Locally

Prerequisites: Node.js and npm.

1. Open a terminal in the project folder.
2. Run `npm install`.
3. Run `node src/server.js`.
4. Open `http://localhost:3000` in a browser.

The page should display `TrustVault is running!`.

## Testing

Automated application and security tests have not yet been implemented. Test commands and verified results will be documented after the test suite is created and run.

## Security

TrustVault is still under development. Do not use it to store sensitive or confidential documents. Security features must be implemented and tested before deployment for real users.

## Project Documentation

- `THREATS.md` - threat model and security mitigations.
- `PROMPTS.md` - AI assistance log.
