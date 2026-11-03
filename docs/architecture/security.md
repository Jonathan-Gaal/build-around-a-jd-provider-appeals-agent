# Security

Stack: Next.js with TypeScript, a SQL database, and React on the front end. That stack is secure enough for this app if we follow these rules.

- **Keep the API key on the server.** Agents run in server code only (route handlers or server actions). Never prefix the key with `NEXT_PUBLIC_`, and keep `.env*` out of git.
- **Check authorization on the server for every request.** Middleware alone isn't enough. Each route and server action confirms the user is signed in and allowed to see that case.
- **Use parameterized queries or an ORM.** Never build SQL by joining strings.
- **Treat uploads as untrusted.** A denial letter or note could contain text that tries to steer an agent (prompt injection). Agents return structured JSON, the orchestrator validates it, and no agent can submit anything on its own.
- **Keep an audit log.** Record who approved what and when. The clinician approves every step before anything is sent.
- **Synthetic data only.** Real patient data (PHI) would require a Business Associate Agreement with every vendor that touches it, including the LLM provider and the host. This project doesn't use any.
