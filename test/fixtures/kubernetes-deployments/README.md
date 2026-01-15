# Kubernetes Deployment Test Fixtures

> **Purpose:** Test fixtures for the `verify-deploy` tool integration tests.

## Overview

These fixtures are used to test Kubernetes deployment verification, including:
- Health check validation
- Service endpoint discovery
- Pod status checking
- Replica management

## Contents

### health-check-app/

A minimal Node.js HTTP server designed for Kubernetes health check testing.

**Features:**
- No external dependencies
- `/health` endpoint for liveness probes
- `/ready` endpoint for readiness probes
- Configurable via environment variables
- Non-root user for security
- Graceful shutdown handling

**Endpoints:**
| Endpoint | Purpose | Response |
|----------|---------|----------|
| `GET /` | Default | Welcome message with app info |
| `GET /health` | Liveness probe | Health status JSON |
| `GET /ready` | Readiness probe | Readiness status JSON |

### simple-web-app.yaml

A Kubernetes deployment manifest for testing verify-deploy tool.

**Components:**
- Deployment with 2 replicas
- Liveness and readiness probes
- Resource limits
- ClusterIP Service

**Usage:**
The image tag `localhost:5000` should be replaced with the actual registry port during test execution.

## Test Flow

1. Build health-check-app image
2. Push to local registry
3. Apply simple-web-app.yaml (with correct registry URL)
4. Wait for deployment ready
5. Run verify-deploy tool
6. Validate results
7. Cleanup

## Expected Results

After successful deployment:
- All pods should be Running
- Ready replicas: 2/2
- Service endpoint should be discovered
- Health checks should pass

## Maintenance

**Review Schedule:** Quarterly

**Update Checklist:**
- [ ] Node.js base image version
- [ ] Resource limits appropriate for CI/CD
- [ ] Health check timing reasonable
- [ ] Manifest follows K8s best practices

## Related Documentation

- See `DEPLOYMENT_PATTERNS.md` for comprehensive K8s patterns
- See `../../../scripts/integration-test-verify-deploy.ts` for test implementation
