# Security Policy

Astroid is financial infrastructure for autonomous AI agents. We take security
seriously and appreciate responsible disclosure.

## Supported Versions

The web frontend follows Semantic Versioning. Security fixes are released for
the latest minor of the current major. During the `0.x` phase, please track the
latest release.

## Reporting a Vulnerability

**Do not open a public GitHub issue for security reports.**

Email `security@astroid.dev` with:

- A description of the vulnerability and its impact
- Steps to reproduce (proof of concept if possible)
- Affected component(s) and version(s)

We aim to acknowledge reports within 48 hours and to provide a remediation
timeline within five business days.

## Scope & handling guidance

- **Never commit secrets.** API keys, session tokens, and environment variables
  must not appear in source, tests, or examples.
- **Content Security Policy.** The frontend enforces strict CSP headers. Do not
  weaken them without review.
- **Input validation.** All user-facing forms use Zod schemas. Never trust
  client-side validation alone; the API validates independently.
- **Secret redaction.** Sensitive data (wallet addresses, API keys) must be
  masked in UI previews and never logged to the browser console.

Thank you for helping keep the Astroid ecosystem safe.




