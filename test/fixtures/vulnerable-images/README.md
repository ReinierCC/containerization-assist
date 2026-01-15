# Vulnerable Images Test Fixtures

> ⚠️ **WARNING:** These images contain intentionally vulnerable dependencies and base images for testing security scanning tools. **NEVER deploy these in production.**

## Purpose

These fixtures are used to test the `scan-image` tool with known, documented vulnerabilities. Each image has specific expected vulnerability counts based on the CVEs present.

## Test Images

### 1. Node.js with Known CVEs (`node-cves/`)

**Base Image:** `node:14.15.0` (Debian Buster)

**Expected Vulnerabilities:**
- Critical: 8-12
- High: 25-35
- Medium: 40-60

**Primary CVEs:**
- CVE-2021-44531 (Node.js)
- CVE-2021-3711 (OpenSSL)
- CVE-2021-23840 (OpenSSL)
- CVE-2020-8203 (lodash - prototype pollution)
- CVE-2020-28168 (axios - SSRF)
- CVE-2021-44906 (minimist - prototype pollution)
- CVE-2022-24999 (express - open redirect)

**Why This Image:**
- Node.js 14.15.0 was released Nov 2020 with multiple documented CVEs
- Dependencies include packages with known vulnerabilities
- Widely used pattern, reliable detection

### 2. Python with Known CVEs (`python-cves/`)

**Base Image:** `python:3.7.9` (Debian Buster)

**Expected Vulnerabilities:**
- Critical: 5-10
- High: 20-30
- Medium: 35-50

**Primary CVEs:**
- CVE-2021-3177 (Python core - buffer overflow)
- CVE-2021-23336 (Python core - web cache poisoning)
- CVE-2021-33203, CVE-2021-33571 (Django - SQL injection, directory traversal)
- CVE-2020-14343 (PyYAML - arbitrary code execution)
- CVE-2020-28493 (Jinja2 - ReDoS)
- CVE-2021-25287, CVE-2021-25288 (Pillow - buffer overflow)

**Why This Image:**
- Python 3.7.9 was released Aug 2020 with multiple documented vulnerabilities
- Dependencies include packages with known critical CVEs
- Good balance of OS and application-level vulnerabilities

### 3. Clean Baseline Image (`clean-baseline/`)

**Base Image:** `mcr.microsoft.com/dotnet/runtime:8.0-alpine`

**Expected Vulnerabilities:**
- Critical: 0
- High: 0
- Medium: 0-5 (OS packages only)

**Why This Image:**
- Microsoft official image, actively maintained
- Alpine base minimizes attack surface
- Used as a control to verify scanner correctly identifies secure images
- Follows security best practices (non-root user, healthcheck)

## Usage

These images are built and scanned by the integration test:

```bash
# Run the scan-image integration test
tsx scripts/integration-test-scan-image.ts
```

## Maintenance

**Review Schedule:** Quarterly (April, July, October, January)

**Maintenance Tasks:**
1. Verify CVE counts still match expectations (scanner DB updates may change counts)
2. Update base image versions if they become unavailable
3. Add new vulnerable packages if better examples emerge
4. Update documentation with new CVE information

**Reference:** See `VULNERABILITY_REFERENCE.md` for detailed CVE database research.

## Scanner Compatibility

These fixtures are designed to work with:
- **Trivy** (primary scanner)
- **Grype** (secondary validation)
- **Snyk** (requires API key)

See `SCANNER_COMPARISON.md` for detailed scanner comparison and installation instructions.
