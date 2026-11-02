# Topic: security and compliance (SEC)

Rows are information needs; the phrasing is an example — formulate the best question for the project (`process/questionnaire/README.md`).

| ID | Level | Information need — example phrasing |
|---|---|---|
| SEC-01 | XS | Login and access: own accounts, company SSO (which provider), social login, API keys; MFA; self-registration or invited users; access rules beyond roles ("only own records", per team/organization)? |
| SEC-02 | M | Sensitive data and compliance: which data is personal, confidential or regulated; applicable regulations and required evidence; data residency (e.g. EU only); may third-party services process the data? |
| SEC-03 | L | Audit log (which actions, retention, visibility); likely threats or abuse cases (fraud, scraping, account takeover); account lifecycle (password rules, session timeout, lockout, deactivation)? |

Agent decides (shown at the design gate): password hashing, session/token handling, encryption in transit and at rest, secrets management, dependency scanning and static analysis.
