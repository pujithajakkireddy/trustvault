# AI Assistance Log

This file records the AI assistance used while developing TrustVault. Entries describe the work requested, changes made, and verification performed. Verification results are recorded only after the relevant checks have actually been run.

## Entry 1 - 2026-10-20: Initial Project Setup

**Prompt / request:** Asked for step-by-step guidance to build TrustVault for the Snovasys Fresher Hiring Challenge, with beginner-friendly explanations and instructions suitable for Windows, VS Code, PowerShell, Node.js, and Git.

**AI-assisted changes:**
- Set up a basic Node.js project using Express.
- Created `src/server.js` with a root route that responds with `TrustVault is running!`.
- Created the initial project folders for routes, middleware, services, database code, public files, tests, and documentation.
- Created `.gitignore`, `README.md`, `THREATS.md`, and `PROMPTS.md`.
- Initialized a local Git repository and pushed the initial project to a private GitHub repository.

**Verification performed:**
- Confirmed Node.js, npm, and Git commands work.
- Started the Express server using `node src/server.js`.
- Opened `http://localhost:3000` and confirmed the initial response.
- Confirmed the Git push succeeded and the working tree was clean.

**Limitations at this stage:**
- Authentication, document storage, access permissions, audit logging, and automated security tests have not yet been implemented.

**Mistakes and corrections:** No specific implementation mistake has been confirmed for this entry. Record future mistakes and their actual corrections here.