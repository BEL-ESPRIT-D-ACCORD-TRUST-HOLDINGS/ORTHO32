# Security Policy

## Reporting Vulnerabilities

Email: jessicalw34@gmail.com  
Subject line: `ORTHO-32 Security Issue`

Include:
1. Description of the vulnerability
2. Steps to reproduce
3. Potential impact
4. Suggested fix (if known)

## Response Timeline

- 24 hours: acknowledgment
- 7 days: severity assessment
- 30 days: fix or mitigation
- 90 days: coordinated disclosure

## Integrity Verification

All source files are cryptographically attested via `seal/`:

```bash
python seal/seal.py verify
```

This validates:
- SHA-256 fingerprints of all source files
- RSA-2048 signatures over each fingerprint
- WORM audit chain integrity (tamper detection)

The signing certificate is at `seal/signing.cert.pem`.

## Supported Versions

| Version | Status |
|---|---|
| 1.0.x (current) | Supported |

## Security Properties

ORTHO-32 is side-channel immune by construction:
- No timing variations (H=0.0, formally proven)
- Constant-time execution (all paths same cycle count)
- No power analysis surface (deterministic energy profile)
- No cache timing attacks (deterministic memory access)

These properties are formally verified in `Ortho32/Timing.lean`.
