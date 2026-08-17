# Security Policy

## Reporting a vulnerability

Email jyotsnasagar1357@gmail.com with details and, if you have one, a way to
reproduce it. Please don't open a public issue for anything that looks
exploitable.

You should get a response within 5 business days. This is a small,
single-maintainer project, so there's no formal SLA beyond that, but reports
will be taken seriously and a fix or mitigation will be prioritized once
confirmed.

## Scope

In scope:

- The server code in `src/` — input handling, the Open-Meteo API client,
  anything that could lead to unexpected code execution, SSRF, or a crash
  triggerable by a malicious tool argument or upstream response.
- The build and release process (`package.json`, CI config, published npm
  package if one exists).

Out of scope:

- The Open-Meteo API itself — report those to https://open-meteo.com.
- Denial of service from ordinary API rate limiting or upstream outages —
  that's expected behavior, documented in the README under "Limitations".
- Issues that require an already-compromised MCP client or local machine.

## Supported versions

Only the latest version on `main` is supported. There are no maintained
older releases.
