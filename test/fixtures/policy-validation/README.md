# Policy Validation Test Fixtures

This directory contains Dockerfile test fixtures for validating built-in Rego policies with the `fix-dockerfile` tool.

## Structure

```
policy-validation/
├── happy/     - Dockerfiles that should PASS policy validation
└── sad/       - Dockerfiles that should FAIL or WARN policy validation
```

## Test Coverage

### Blocking Violations (Must Fail)

| Test Case | Happy File | Sad File | Policy | Rule |
|-----------|-----------|----------|--------|------|
| Microsoft Images | `microsoft-images.Dockerfile` | `non-microsoft-images.Dockerfile` | `base-images.rego` | `require-microsoft-images` |
| Root User | `non-root-user.Dockerfile` | `root-user.Dockerfile` | `security-baseline.rego` | `block-root-user` |
| Hardcoded Secrets | `no-secrets.Dockerfile` | `hardcoded-secrets.Dockerfile` | `security-baseline.rego` | `block-secrets-in-env` |
| Latest Tag | `specific-tags.Dockerfile` | `latest-tag.Dockerfile` | `base-images.rego` | `block-latest-tag` |
| Deprecated Node | `modern-node.Dockerfile` | `deprecated-node.Dockerfile` | `base-images.rego` | `block-deprecated-node` |
| Deprecated Python | `modern-python.Dockerfile` | `deprecated-python.Dockerfile` | `base-images.rego` | `block-deprecated-python` |
| Alpine Variant | `alpine-variant.Dockerfile` | `non-alpine-variant.Dockerfile` | `base-images.rego` | `recommend-alpine` |
| Base Image Size | `small-base-image.Dockerfile` | `oversized-base-image.Dockerfile` | `base-images.rego` | `block-oversized-base` |

### Warnings (Should Warn)

| Test Case | Happy File | Sad File | Policy | Rule |
|-----------|-----------|----------|--------|------|
| User Directive | `with-user-directive.Dockerfile` | `missing-user-directive.Dockerfile` | `security-baseline.rego` | `require-user-directive` |
| Healthcheck | `with-healthcheck.Dockerfile` | `missing-healthcheck.Dockerfile` | `container-best-practices.rego` | `require-healthcheck` |
| Apt Upgrade | `no-apt-upgrade.Dockerfile` | `apt-upgrade.Dockerfile` | `container-best-practices.rego` | `avoid-apt-upgrade` |
| WORKDIR | `with-workdir.Dockerfile` | `missing-workdir.Dockerfile` | `container-best-practices.rego` | `require-workdir` |
| Sudo Usage | `no-sudo.Dockerfile` | `sudo-used.Dockerfile` | `container-best-practices.rego` | `avoid-sudo` |

## Usage

These fixtures are used by the integration test script `scripts/test-policy-enforcement.ts` to validate that:

1. **Happy cases** pass policy validation (no blocking violations)
2. **Sad cases** fail or warn with expected violations
3. Policy violation messages match expected rule IDs
4. Severity levels are correctly reported
