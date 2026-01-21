# Vulnerable Images Test Documentation

> ⚠️ **WARNING:** The test images referenced here contain intentionally vulnerable software for testing security scanning tools. **NEVER deploy these in production.**

## Purpose

This documentation supports the `scan-image` integration test which uses known vulnerable images to verify security scanning functionality. The test **pulls pre-existing images from public registries** rather than building from local Dockerfiles.

## Test Approach

Instead of maintaining local Dockerfile fixtures that can break due to:
- Package manager changes (npm, pip deprecations)
- Registry availability
- Build tool version mismatches

We now pull well-known vulnerable images directly:

```bash
# The test script does this automatically:
docker pull openjdk:8u181-jdk
docker pull mcr.microsoft.com/dotnet/aspnet:3.1
docker pull mcr.microsoft.com/dotnet/runtime:8.0-alpine
```

## Test Images

### 1. Java OpenJDK 8 with Known CVEs

**Image:** `openjdk:8u181-jdk`

**Expected Vulnerabilities:**
- Critical: 1+ (OpenSSL, glibc, etc.)
- High: 5+
- Medium: 50+

**Why This Image:**
- OpenJDK 8u181 was released in 2018
- Based on Debian stretch (EOL)
- Contains outdated OpenSSL, glibc, and other system libraries
- Well-documented CVE history
- Reliable for testing - image is immutable in Docker Hub

### 2. .NET Core 3.1 (EOL) with Known CVEs

**Image:** `mcr.microsoft.com/dotnet/aspnet:3.1`

**Expected Vulnerabilities:**
- Critical: 0+
- High: 1+
- Medium: varies

**Why This Image:**
- .NET Core 3.1 reached End of Life on December 13, 2022
- No longer receives security patches
- Contains known unpatched vulnerabilities
- Official Microsoft image - reliable availability

### 3. Clean .NET 8 Alpine Baseline

**Image:** `mcr.microsoft.com/dotnet/runtime:8.0-alpine`

**Expected Vulnerabilities:**
- Critical: 0
- High: 0
- Medium: minimal (OS packages only)

**Why This Image:**
- Current LTS version of .NET
- Alpine-based (minimal attack surface)
- Actively maintained and patched
- Control test - verifies scanner correctly identifies secure images

## Running the Tests

```bash
# Build the project first
npm run build

# Run the scan-image integration test
tsx scripts/integration-test-scan-image.ts
```

The test will:
1. Verify Docker and Trivy are installed
2. Pull the test images from registries
3. Scan each image with Trivy
4. Validate vulnerability counts against expected thresholds
5. Verify threshold enforcement (fail on HIGH/CRITICAL)
6. Clean up pulled images

## Advantages of Pull-Based Approach

| Aspect | Build-Based (Old) | Pull-Based (New) |
|--------|-------------------|------------------|
| Reliability | ❌ Package managers can break | ✅ Immutable images |
| Speed | ❌ Full build each time | ✅ Layer caching |
| Maintenance | ❌ Update Dockerfiles | ✅ No maintenance |
| Consistency | ❌ Depends on build env | ✅ Same image everywhere |
| CI/CD | ❌ Build failures | ✅ Just pull |

## Reference Documentation

- [VULNERABILITY_REFERENCE.md](./VULNERABILITY_REFERENCE.md) - Detailed CVE research
- [SCANNER_COMPARISON.md](./SCANNER_COMPARISON.md) - Comparison of Trivy, Snyk, Grype

## Notes

- Vulnerability counts may vary slightly as Trivy's database is updated
- The test uses minimum thresholds (e.g., "at least 5 HIGH") rather than exact counts
- Clean baseline should always have 0 CRITICAL and 0 HIGH vulnerabilities
