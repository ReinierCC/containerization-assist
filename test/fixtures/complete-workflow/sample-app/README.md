# Sample Workflow App

A minimal Node.js Express application used for E2E workflow testing.

## Purpose

This application is used to test the complete containerization workflow:
1. `analyze-repo` - Detect language and framework
2. `generate-dockerfile` - Create optimized Dockerfile
3. `build-image` - Build Docker image
4. `scan-image` - Scan for vulnerabilities
5. `tag-image` - Apply version tags
6. `push-image` - Push to registry
7. `generate-k8s-manifests` - Create Kubernetes manifests
8. `verify-deploy` - Verify deployment health

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Root endpoint with app info |
| `/health` | GET | Liveness probe endpoint |
| `/ready` | GET | Readiness probe endpoint |
| `/api/info` | GET | Detailed application info |

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | Server port |
| `APP_VERSION` | 1.0.0 | Application version |
| `NODE_ENV` | development | Environment name |

## Local Development

```bash
npm install
npm start
```

## Docker Build

```bash
# After generate-dockerfile creates Dockerfile
docker build -t sample-workflow-app:local .
docker run -p 3000:3000 sample-workflow-app:local
```

## Health Check Response

```json
{
  "status": "healthy",
  "uptime": 123,
  "timestamp": "2025-01-15T10:30:00.000Z"
}
```
