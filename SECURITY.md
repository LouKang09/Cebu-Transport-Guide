# Security Policy

## Reporting a vulnerability

Please do not open a public issue for suspected vulnerabilities or exposed credentials.

Use GitHub's private vulnerability reporting feature for this repository when available. If private reporting is unavailable, contact the repository owner privately.

Please include:
- A description of the issue
- Reproduction steps
- Affected route or component
- Potential impact
- Suggested mitigation, if known

## Secrets

Secrets, API keys, database URLs, tokens, private keys, and production credentials must never be committed to this repository. Production secrets belong in Railway environment variables.

If a secret is ever committed, treat it as compromised: revoke/rotate it first, then remove it from Git history.
