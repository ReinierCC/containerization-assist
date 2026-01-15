# Kubernetes Deployment Patterns for Integration Testing

**Purpose:** This document provides comprehensive guidance for testing Kubernetes deployments with the verify-deploy tool, focusing on KIND cluster compatibility, minimal resource usage, and reliable health checks.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Common Deployment Patterns](#common-deployment-patterns)
3. [Test Deployment Scenarios](#test-deployment-scenarios)
4. [Health Check Implementations](#health-check-implementations)
5. [Validation Strategies](#validation-strategies)
6. [Test Cleanup Best Practices](#test-cleanup-best-practices)
7. [Troubleshooting Guide](#troubleshooting-guide)
8. [References](#references)

---

## Executive Summary

### Key Findings

- **Deployment Readiness:** Simple stateless apps typically reach ready state in 10-30 seconds on KIND clusters
- **Resource Limits:** Test deployments should use minimal resources (100m CPU, 128Mi memory) for faster scheduling
- **Health Checks:** HTTP health endpoints are most reliable; use `/health` or `/healthz` conventions
- **Namespace Isolation:** Always use dedicated namespaces for test isolation and easy cleanup
- **Probe Timing:** Initial delay of 5-10 seconds, period of 5 seconds, timeout of 3 seconds works well for tests

### Quick Reference

| Scenario | Ready Time | Resource Usage | Complexity |
|----------|-----------|----------------|------------|
| Simple Stateless | 10-15s | Low | ⭐ |
| Init Containers | 15-25s | Low | ⭐⭐ |
| Multi-Container | 15-30s | Medium | ⭐⭐⭐ |
| ConfigMap/Secret | 15-25s | Low | ⭐⭐ |
| PersistentVolume | 20-40s | Medium | ⭐⭐⭐⭐ |

---

## Common Deployment Patterns

### Minimal Deployment Manifest Structure

Every test deployment should follow this minimal structure:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-name
  namespace: test-namespace
  labels:
    app: app-name
    test: integration
spec:
  replicas: 1  # Minimal for testing
  selector:
    matchLabels:
      app: app-name
  template:
    metadata:
      labels:
        app: app-name
    spec:
      containers:
      - name: app
        image: image:tag
        ports:
        - containerPort: 8080
          name: http
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 200m
            memory: 256Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
```

### Service Exposure Pattern

```yaml
apiVersion: v1
kind: Service
metadata:
  name: app-name
  namespace: test-namespace
  labels:
    app: app-name
spec:
  type: ClusterIP  # NodePort for KIND access if needed
  selector:
    app: app-name
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
```

### Resource Limits for Test Environments

**Recommended Resource Allocation:**

| Component | CPU Request | CPU Limit | Memory Request | Memory Limit |
|-----------|-------------|-----------|----------------|--------------|
| Simple App | 50m | 100m | 64Mi | 128Mi |
| Standard App | 100m | 200m | 128Mi | 256Mi |
| Heavy App | 200m | 500m | 256Mi | 512Mi |

**Rationale:**
- KIND clusters typically have 2-4 CPUs and 4-8GB RAM available
- Minimal limits allow faster pod scheduling
- Prevents resource exhaustion in CI/CD environments
- Enables parallel test execution

---

## Test Deployment Scenarios

### Scenario 1: Simple Stateless Web App (Basic Case)

**Use Case:** Validate basic deployment rollout and health checks.

**Expected Behavior:**
- Ready in 10-15 seconds
- Single replica
- HTTP health endpoint responds 200 OK
- No external dependencies

**Manifest: `simple-stateless.yaml`**

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-simple
  labels:
    test: integration

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: simple-web
  namespace: test-simple
  labels:
    app: simple-web
    scenario: basic
spec:
  replicas: 1
  selector:
    matchLabels:
      app: simple-web
  template:
    metadata:
      labels:
        app: simple-web
    spec:
      containers:
      - name: web
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        env:
        - name: PORT
          value: "8080"
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 2
        readinessProbe:
          httpGet:
            path: /
            port: http
          initialDelaySeconds: 3
          periodSeconds: 5
          timeoutSeconds: 2
        # Override nginx default port
        command: ["/bin/sh"]
        args:
          - -c
          - |
            cat > /etc/nginx/conf.d/default.conf <<EOF
            server {
              listen 8080;
              location / {
                return 200 'OK';
                add_header Content-Type text/plain;
              }
            }
            EOF
            nginx -g 'daemon off;'

---
apiVersion: v1
kind: Service
metadata:
  name: simple-web
  namespace: test-simple
spec:
  type: ClusterIP
  selector:
    app: simple-web
  ports:
  - port: 80
    targetPort: http
    name: http
```

**Validation Checklist:**
- [ ] Namespace created
- [ ] Deployment rollout complete (1/1 replicas ready)
- [ ] Pod status: Running
- [ ] Service endpoint accessible
- [ ] Health check returns 200 OK

---

### Scenario 2: App with Init Containers (Advanced Case)

**Use Case:** Validate deployment with initialization logic and dependencies.

**Expected Behavior:**
- Ready in 15-25 seconds (includes init container execution)
- Init container runs to completion before main container starts
- Main container waits for initialization file

**Manifest: `init-container.yaml`**

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-init
  labels:
    test: integration

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-init
  namespace: test-init
  labels:
    app: app-with-init
    scenario: init-container
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app-with-init
  template:
    metadata:
      labels:
        app: app-with-init
    spec:
      initContainers:
      - name: init-config
        image: busybox:1.36
        command: ['sh', '-c']
        args:
          - |
            echo "Initializing configuration..."
            sleep 5
            echo "CONFIG_READY=true" > /config/init.conf
            echo "TIMESTAMP=$(date)" >> /config/init.conf
            echo "Initialization complete"
        volumeMounts:
        - name: config
          mountPath: /config
        resources:
          requests:
            cpu: 50m
            memory: 32Mi
          limits:
            cpu: 100m
            memory: 64Mi
      
      containers:
      - name: app
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        volumeMounts:
        - name: config
          mountPath: /config
          readOnly: true
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
          timeoutSeconds: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
        command: ["/bin/sh"]
        args:
          - -c
          - |
            # Wait for init config
            while [ ! -f /config/init.conf ]; do
              echo "Waiting for init config..."
              sleep 1
            done
            
            # Configure nginx with health endpoint
            cat > /etc/nginx/conf.d/default.conf <<EOF
            server {
              listen 8080;
              location /health {
                return 200 '{"status":"healthy","config":"initialized"}';
                add_header Content-Type application/json;
              }
              location /config {
                alias /config/init.conf;
              }
            }
            EOF
            nginx -g 'daemon off;'
      
      volumes:
      - name: config
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: app-with-init
  namespace: test-init
spec:
  type: ClusterIP
  selector:
    app: app-with-init
  ports:
  - port: 80
    targetPort: http
    name: http
```

**Validation Checklist:**
- [ ] Init container runs to completion
- [ ] Init container logs show "Initialization complete"
- [ ] Main container starts after init completion
- [ ] Config file exists and is readable
- [ ] Health endpoint returns initialized status

---

### Scenario 3: Multi-Container Pod (Sidecar Pattern)

**Use Case:** Validate deployments with multiple containers sharing resources.

**Expected Behavior:**
- Ready in 15-30 seconds
- Both containers start and become ready
- Sidecar container provides auxiliary functionality
- Shared volume enables inter-container communication

**Manifest: `sidecar-pattern.yaml`**

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-sidecar
  labels:
    test: integration

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-sidecar
  namespace: test-sidecar
  labels:
    app: app-with-sidecar
    scenario: multi-container
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app-with-sidecar
  template:
    metadata:
      labels:
        app: app-with-sidecar
    spec:
      containers:
      # Main application container
      - name: app
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        volumeMounts:
        - name: logs
          mountPath: /var/log/app
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        command: ["/bin/sh"]
        args:
          - -c
          - |
            # Configure nginx
            cat > /etc/nginx/conf.d/default.conf <<EOF
            server {
              listen 8080;
              location /health {
                return 200 '{"status":"healthy","sidecar":"active"}';
                add_header Content-Type application/json;
              }
              location /metrics {
                alias /var/log/app/metrics.txt;
              }
            }
            EOF
            
            # Log to shared volume
            while true; do
              echo "$(date): Request processed" >> /var/log/app/access.log
              sleep 10
            done &
            
            nginx -g 'daemon off;'
      
      # Sidecar container (log processor/metrics exporter)
      - name: log-processor
        image: busybox:1.36
        volumeMounts:
        - name: logs
          mountPath: /var/log/app
        resources:
          requests:
            cpu: 25m
            memory: 32Mi
          limits:
            cpu: 50m
            memory: 64Mi
        command: ["/bin/sh"]
        args:
          - -c
          - |
            echo "Log processor starting..."
            while true; do
              if [ -f /var/log/app/access.log ]; then
                # Process logs and generate metrics
                LINES=$(wc -l < /var/log/app/access.log)
                echo "total_requests=$LINES" > /var/log/app/metrics.txt
                echo "last_updated=$(date)" >> /var/log/app/metrics.txt
              fi
              sleep 5
            done
      
      volumes:
      - name: logs
        emptyDir: {}

---
apiVersion: v1
kind: Service
metadata:
  name: app-with-sidecar
  namespace: test-sidecar
spec:
  type: ClusterIP
  selector:
    app: app-with-sidecar
  ports:
  - port: 80
    targetPort: http
    name: http
```

**Validation Checklist:**
- [ ] Both containers are running
- [ ] Both containers are ready
- [ ] Shared volume is mounted in both containers
- [ ] Main app health check passes
- [ ] Sidecar is processing logs (metrics file exists)
- [ ] Metrics endpoint is accessible

---

### Scenario 4: Deployment with ConfigMap/Secret (Configuration Case)

**Use Case:** Validate configuration injection and secret management.

**Expected Behavior:**
- Ready in 15-25 seconds
- ConfigMap values available as environment variables
- Secret values mounted as files
- Configuration changes trigger pod updates (not tested, but documented)

**Manifest: `config-secret.yaml`**

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-config
  labels:
    test: integration

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
  namespace: test-config
data:
  APP_NAME: "test-application"
  APP_VERSION: "1.0.0"
  LOG_LEVEL: "info"
  PORT: "8080"
  config.json: |
    {
      "features": {
        "authentication": true,
        "metrics": true,
        "healthCheck": true
      },
      "limits": {
        "maxConnections": 100,
        "timeout": 30
      }
    }

---
apiVersion: v1
kind: Secret
metadata:
  name: app-secrets
  namespace: test-config
type: Opaque
stringData:
  API_KEY: "test-api-key-12345"
  DATABASE_PASSWORD: "test-db-password"
  credentials.txt: |
    username=testuser
    password=testpass
    endpoint=https://api.example.com

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app-with-config
  namespace: test-config
  labels:
    app: app-with-config
    scenario: configuration
spec:
  replicas: 1
  selector:
    matchLabels:
      app: app-with-config
  template:
    metadata:
      labels:
        app: app-with-config
    spec:
      containers:
      - name: app
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        
        # Environment variables from ConfigMap
        envFrom:
        - configMapRef:
            name: app-config
        
        # Individual secret as environment variable
        env:
        - name: API_KEY
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: API_KEY
        
        # Mount ConfigMap as volume
        volumeMounts:
        - name: config-volume
          mountPath: /etc/config
          readOnly: true
        - name: secret-volume
          mountPath: /etc/secrets
          readOnly: true
        
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
        
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        
        command: ["/bin/sh"]
        args:
          - -c
          - |
            # Verify configuration is loaded
            echo "Configuration check:"
            echo "APP_NAME=$APP_NAME"
            echo "LOG_LEVEL=$LOG_LEVEL"
            echo "API_KEY present: $([ -n "$API_KEY" ] && echo 'yes' || echo 'no')"
            echo "Config file exists: $([ -f /etc/config/config.json ] && echo 'yes' || echo 'no')"
            echo "Secret file exists: $([ -f /etc/secrets/credentials.txt ] && echo 'yes' || echo 'no')"
            
            # Configure nginx with health endpoint that returns config info
            cat > /etc/nginx/conf.d/default.conf <<EOF
            server {
              listen 8080;
              location /health {
                return 200 '{"status":"healthy","app":"$APP_NAME","version":"$APP_VERSION","configLoaded":true}';
                add_header Content-Type application/json;
              }
              location /config {
                alias /etc/config/config.json;
                add_header Content-Type application/json;
              }
            }
            EOF
            
            nginx -g 'daemon off;'
      
      volumes:
      - name: config-volume
        configMap:
          name: app-config
          items:
          - key: config.json
            path: config.json
      - name: secret-volume
        secret:
          secretName: app-secrets
          items:
          - key: credentials.txt
            path: credentials.txt

---
apiVersion: v1
kind: Service
metadata:
  name: app-with-config
  namespace: test-config
spec:
  type: ClusterIP
  selector:
    app: app-with-config
  ports:
  - port: 80
    targetPort: http
    name: http
```

**Validation Checklist:**
- [ ] ConfigMap created successfully
- [ ] Secret created successfully
- [ ] Environment variables from ConfigMap are set
- [ ] Secret environment variables are set
- [ ] ConfigMap volume is mounted and readable
- [ ] Secret volume is mounted and readable
- [ ] Health endpoint returns configuration info
- [ ] Config JSON is accessible via HTTP

---

### Scenario 5: Deployment with PersistentVolumeClaim (Stateful Case)

**Use Case:** Validate persistent storage integration.

**Expected Behavior:**
- Ready in 20-40 seconds (PVC provisioning adds time)
- PVC is bound before pod starts
- Data persists across pod restarts
- Volume mounts correctly

**Manifest: `persistent-volume.yaml`**

```yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: test-stateful
  labels:
    test: integration

---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: app-data
  namespace: test-stateful
spec:
  accessModes:
  - ReadWriteOnce
  resources:
    requests:
      storage: 1Gi
  # KIND uses local-path-provisioner by default
  storageClassName: standard

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stateful-app
  namespace: test-stateful
  labels:
    app: stateful-app
    scenario: persistent-storage
spec:
  replicas: 1
  selector:
    matchLabels:
      app: stateful-app
  template:
    metadata:
      labels:
        app: stateful-app
    spec:
      containers:
      - name: app
        image: nginx:1.25-alpine
        ports:
        - containerPort: 8080
          name: http
        
        volumeMounts:
        - name: data
          mountPath: /data
        
        resources:
          requests:
            cpu: 50m
            memory: 64Mi
          limits:
            cpu: 100m
            memory: 128Mi
        
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 10
          periodSeconds: 5
        
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
        
        command: ["/bin/sh"]
        args:
          - -c
          - |
            # Initialize data directory
            mkdir -p /data/uploads /data/cache
            
            # Create or update state file
            if [ -f /data/state.txt ]; then
              COUNT=$(cat /data/state.txt | grep -oP 'count=\K\d+')
              COUNT=$((COUNT + 1))
            else
              COUNT=1
            fi
            
            echo "count=$COUNT" > /data/state.txt
            echo "started=$(date)" >> /data/state.txt
            echo "hostname=$(hostname)" >> /data/state.txt
            
            echo "Pod started $COUNT times"
            
            # Configure nginx
            cat > /etc/nginx/conf.d/default.conf <<EOF
            server {
              listen 8080;
              location /health {
                return 200 '{"status":"healthy","storage":"persistent","restarts":$COUNT}';
                add_header Content-Type application/json;
              }
              location /state {
                alias /data/state.txt;
                add_header Content-Type text/plain;
              }
              location /data/ {
                alias /data/;
                autoindex on;
              }
            }
            EOF
            
            nginx -g 'daemon off;'
      
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: app-data

---
apiVersion: v1
kind: Service
metadata:
  name: stateful-app
  namespace: test-stateful
spec:
  type: ClusterIP
  selector:
    app: stateful-app
  ports:
  - port: 80
    targetPort: http
    name: http
```

**Validation Checklist:**
- [ ] PVC is created
- [ ] PVC is bound (status: Bound)
- [ ] Pod is scheduled and running
- [ ] Volume is mounted at /data
- [ ] State file is created and writable
- [ ] Health endpoint shows restart count
- [ ] Data persists after pod restart (manual test)

---

## Health Check Implementations

### HTTP Health Endpoint Standards

**Best Practices:**
- Use `/health` or `/healthz` path convention
- Return HTTP 200 for healthy, 503 for unhealthy
- Include JSON response with status details
- Keep checks lightweight (< 100ms response time)
- Avoid external dependencies in liveness probes
- Include dependency checks in readiness probes

**Standard Response Format:**

```json
{
  "status": "healthy",
  "timestamp": "2026-01-15T10:30:00Z",
  "version": "1.0.0",
  "checks": {
    "database": "ok",
    "cache": "ok"
  }
}
```

---

### Node.js Health Check Implementation

**Minimal Express Server:**

```javascript
// server.js
const express = require('express');
const app = express();
const PORT = process.env.PORT || 8080;

// Health check state
let isReady = false;
let startTime = Date.now();

// Simulate async initialization
setTimeout(() => {
  isReady = true;
  console.log('Application ready');
}, 5000);

// Liveness probe - always returns OK if process is running
app.get('/health/live', (req, res) => {
  res.status(200).json({
    status: 'alive',
    uptime: Date.now() - startTime
  });
});

// Readiness probe - returns OK only when ready to serve traffic
app.get('/health/ready', (req, res) => {
  if (isReady) {
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } else {
    res.status(503).json({
      status: 'not ready',
      message: 'Application is initializing'
    });
  }
});

// Combined health check (for simple cases)
app.get('/health', (req, res) => {
  res.status(isReady ? 200 : 503).json({
    status: isReady ? 'healthy' : 'initializing',
    uptime: Date.now() - startTime,
    ready: isReady
  });
});

// Main application route
app.get('/', (req, res) => {
  res.send('Hello from Node.js!');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
```

**package.json:**

```json
{
  "name": "health-check-demo",
  "version": "1.0.0",
  "main": "server.js",
  "dependencies": {
    "express": "^4.18.2"
  },
  "scripts": {
    "start": "node server.js"
  }
}
```

**Dockerfile:**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY server.js ./
USER node
EXPOSE 8080
CMD ["npm", "start"]
```

---

### Python Health Check Implementation

**Minimal Flask Server:**

```python
# app.py
from flask import Flask, jsonify
import time
import os

app = Flask(__name__)

# Health check state
start_time = time.time()
is_ready = False

# Simulate async initialization
def initialize():
    global is_ready
    time.sleep(5)  # Simulate startup work
    is_ready = True
    print("Application ready")

# Run initialization in background (for demo)
import threading
threading.Thread(target=initialize, daemon=True).start()

@app.route('/health/live')
def liveness():
    """Liveness probe - checks if process is alive"""
    return jsonify({
        'status': 'alive',
        'uptime': time.time() - start_time
    }), 200

@app.route('/health/ready')
def readiness():
    """Readiness probe - checks if ready to serve traffic"""
    if is_ready:
        return jsonify({
            'status': 'ready',
            'timestamp': time.time()
        }), 200
    else:
        return jsonify({
            'status': 'not ready',
            'message': 'Application is initializing'
        }), 503

@app.route('/health')
def health():
    """Combined health check"""
    status_code = 200 if is_ready else 503
    return jsonify({
        'status': 'healthy' if is_ready else 'initializing',
        'uptime': time.time() - start_time,
        'ready': is_ready
    }), status_code

@app.route('/')
def index():
    return 'Hello from Python!'

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)
```

**requirements.txt:**

```
Flask==3.0.0
gunicorn==21.2.0
```

**Dockerfile:**

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY app.py ./
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 8080
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "2", "app:app"]
```

---

### Java Health Check Implementation

**Minimal Spring Boot Application:**

```java
// HealthCheckApplication.java
package com.example.healthcheck;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;

import java.util.HashMap;
import java.util.Map;
import java.time.Instant;

@SpringBootApplication
@RestController
public class HealthCheckApplication {

    private static final long startTime = System.currentTimeMillis();
    private boolean isReady = false;

    public static void main(String[] args) {
        SpringApplication.run(HealthCheckApplication.class, args);
    }

    @EventListener(ApplicationReadyEvent.class)
    public void onApplicationReady() {
        // Simulate initialization
        try {
            Thread.sleep(5000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        isReady = true;
        System.out.println("Application ready");
    }

    @GetMapping("/health/live")
    public Map<String, Object> liveness() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "alive");
        response.put("uptime", System.currentTimeMillis() - startTime);
        return response;
    }

    @GetMapping("/health/ready")
    public Map<String, Object> readiness() {
        Map<String, Object> response = new HashMap<>();
        if (isReady) {
            response.put("status", "ready");
            response.put("timestamp", Instant.now().toString());
            return response;
        } else {
            response.put("status", "not ready");
            response.put("message", "Application is initializing");
            throw new RuntimeException("Not ready");
        }
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", isReady ? "healthy" : "initializing");
        response.put("uptime", System.currentTimeMillis() - startTime);
        response.put("ready", isReady);
        return response;
    }

    @GetMapping("/")
    public String index() {
        return "Hello from Java!";
    }
}
```

**pom.xml:**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0
         http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    
    <parent>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-starter-parent</artifactId>
        <version>3.2.0</version>
    </parent>
    
    <groupId>com.example</groupId>
    <artifactId>health-check</artifactId>
    <version>1.0.0</version>
    
    <properties>
        <java.version>17</java.version>
    </properties>
    
    <dependencies>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
    </dependencies>
    
    <build>
        <plugins>
            <plugin>
                <groupId>org.springframework.boot</groupId>
                <artifactId>spring-boot-maven-plugin</artifactId>
            </plugin>
        </plugins>
    </build>
</project>
```

**Dockerfile:**

```dockerfile
FROM maven:3.9-eclipse-temurin-17-alpine AS build
WORKDIR /app
COPY pom.xml ./
RUN mvn dependency:go-offline
COPY src ./src
RUN mvn package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
```

---

## Validation Strategies

### Checking Deployment Rollout Completion

**Using kubectl:**

```bash
# Wait for deployment to be ready (with timeout)
kubectl wait --for=condition=available --timeout=60s \
  deployment/app-name -n test-namespace

# Check rollout status
kubectl rollout status deployment/app-name -n test-namespace

# Get deployment details
kubectl get deployment app-name -n test-namespace -o yaml
```

**Programmatic Check (Node.js with @kubernetes/client-node):**

```javascript
const k8s = require('@kubernetes/client-node');

async function waitForDeploymentReady(namespace, deploymentName, timeoutSeconds = 60) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const appsApi = kc.makeApiClient(k8s.AppsV1Api);
  
  const startTime = Date.now();
  const timeout = timeoutSeconds * 1000;
  
  while (Date.now() - startTime < timeout) {
    try {
      const { body } = await appsApi.readNamespacedDeployment(deploymentName, namespace);
      
      const replicas = body.spec.replicas || 0;
      const readyReplicas = body.status.readyReplicas || 0;
      const updatedReplicas = body.status.updatedReplicas || 0;
      
      if (readyReplicas === replicas && updatedReplicas === replicas) {
        console.log(`Deployment ${deploymentName} is ready: ${readyReplicas}/${replicas} replicas`);
        return true;
      }
      
      console.log(`Waiting for deployment: ${readyReplicas}/${replicas} ready`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('Error checking deployment:', error.message);
      throw error;
    }
  }
  
  throw new Error(`Deployment ${deploymentName} did not become ready within ${timeoutSeconds}s`);
}
```

---

### Service Endpoint Discovery

**Using kubectl:**

```bash
# Get service details
kubectl get service app-name -n test-namespace

# Get service endpoint
kubectl get endpoints app-name -n test-namespace

# Port forward for local testing
kubectl port-forward -n test-namespace service/app-name 8080:80

# For NodePort services on KIND
kubectl get service app-name -n test-namespace -o jsonpath='{.spec.ports[0].nodePort}'
```

**Programmatic Discovery (Node.js):**

```javascript
async function getServiceEndpoint(namespace, serviceName) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  
  // Get service
  const { body: service } = await coreApi.readNamespacedService(serviceName, namespace);
  
  // Get endpoints
  const { body: endpoints } = await coreApi.readNamespacedEndpoints(serviceName, namespace);
  
  if (!endpoints.subsets || endpoints.subsets.length === 0) {
    throw new Error(`No endpoints found for service ${serviceName}`);
  }
  
  const subset = endpoints.subsets[0];
  const address = subset.addresses?.[0]?.ip;
  const port = subset.ports?.[0]?.port;
  
  if (!address || !port) {
    throw new Error(`Invalid endpoint configuration for service ${serviceName}`);
  }
  
  return {
    ip: address,
    port: port,
    url: `http://${address}:${port}`
  };
}
```

---

### Health Check Validation Patterns

**Basic HTTP Check:**

```bash
# Using curl
curl -f http://service-ip:port/health || exit 1

# With retry logic
for i in {1..30}; do
  if curl -sf http://service-ip:port/health > /dev/null; then
    echo "Health check passed"
    exit 0
  fi
  echo "Attempt $i failed, retrying..."
  sleep 2
done
echo "Health check failed after 30 attempts"
exit 1
```

**Advanced Health Check (Node.js):**

```javascript
const axios = require('axios');

async function validateHealthCheck(url, expectedStatus = 200, retries = 30, delayMs = 2000) {
  for (let i = 1; i <= retries; i++) {
    try {
      const response = await axios.get(url, { timeout: 5000 });
      
      if (response.status === expectedStatus) {
        console.log(`Health check passed: ${response.data.status}`);
        
        // Validate response structure
        if (response.data.status === 'healthy' || response.data.status === 'ready') {
          return {
            success: true,
            response: response.data,
            attempts: i
          };
        }
      }
      
      console.log(`Attempt ${i}: Status ${response.status}, expected ${expectedStatus}`);
    } catch (error) {
      console.log(`Attempt ${i} failed: ${error.message}`);
    }
    
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  
  throw new Error(`Health check failed after ${retries} attempts`);
}
```

---

### Common Failure Scenarios to Test

1. **Image Pull Failure**
   ```yaml
   # Use non-existent image
   image: nonexistent/image:latest
   ```
   Expected: Pod stuck in `ImagePullBackOff`

2. **Failed Liveness Probe**
   ```yaml
   livenessProbe:
     httpGet:
       path: /nonexistent
       port: 8080
   ```
   Expected: Pod restarts repeatedly

3. **Failed Readiness Probe**
   ```yaml
   readinessProbe:
     httpGet:
       path: /health
       port: 8080
     failureThreshold: 1
   ```
   Expected: Pod not added to service endpoints

4. **Insufficient Resources**
   ```yaml
   resources:
     requests:
       cpu: 100
       memory: 100Gi
   ```
   Expected: Pod stuck in `Pending` (unschedulable)

5. **Missing ConfigMap/Secret**
   ```yaml
   envFrom:
   - configMapRef:
       name: nonexistent-config
   ```
   Expected: Pod stuck in `CreateContainerConfigError`

---

## Test Cleanup Best Practices

### Namespace Management

**Best Practice: Use Dedicated Test Namespaces**

```bash
# Create namespace with labels
kubectl create namespace test-${TEST_ID} --dry-run=client -o yaml | \
  kubectl label --local -f - test=integration test-id=${TEST_ID} -o yaml | \
  kubectl apply -f -

# Cleanup specific test namespace
kubectl delete namespace test-${TEST_ID} --timeout=60s

# Cleanup all test namespaces
kubectl delete namespace -l test=integration
```

**Programmatic Cleanup (Node.js):**

```javascript
async function createTestNamespace(testId) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  
  const namespace = {
    metadata: {
      name: `test-${testId}`,
      labels: {
        test: 'integration',
        'test-id': testId,
        'created-at': Date.now().toString()
      }
    }
  };
  
  try {
    await coreApi.createNamespace(namespace);
    console.log(`Created namespace: test-${testId}`);
  } catch (error) {
    if (error.statusCode !== 409) { // Already exists
      throw error;
    }
  }
  
  return `test-${testId}`;
}

async function cleanupTestNamespace(namespace) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  
  try {
    await coreApi.deleteNamespace(namespace);
    console.log(`Deleted namespace: ${namespace}`);
    
    // Wait for namespace to be fully deleted
    const startTime = Date.now();
    while (Date.now() - startTime < 60000) {
      try {
        await coreApi.readNamespace(namespace);
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        if (error.statusCode === 404) {
          console.log(`Namespace ${namespace} fully deleted`);
          return;
        }
      }
    }
    console.warn(`Namespace ${namespace} deletion timeout`);
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Error deleting namespace: ${error.message}`);
    }
  }
}
```

---

### Resource Cleanup Strategies

**1. Namespace-based Cleanup (Recommended)**

Advantages:
- Single delete operation removes all resources
- Guaranteed isolation between tests
- No resource leakage

```javascript
// Test structure
describe('verify-deploy integration', () => {
  let namespace;
  
  beforeEach(async () => {
    namespace = await createTestNamespace(Date.now());
  });
  
  afterEach(async () => {
    await cleanupTestNamespace(namespace);
  });
  
  it('should deploy simple app', async () => {
    // Test implementation
  });
});
```

**2. Resource-level Cleanup (Fallback)**

Use when namespace deletion is not sufficient:

```javascript
async function cleanupResources(namespace, resourceTypes) {
  const kc = new k8s.KubeConfig();
  kc.loadFromDefault();
  const appsApi = kc.makeApiClient(k8s.AppsV1Api);
  const coreApi = kc.makeApiClient(k8s.CoreV1Api);
  
  for (const resourceType of resourceTypes) {
    try {
      switch (resourceType) {
        case 'deployment':
          await appsApi.deleteCollectionNamespacedDeployment(namespace);
          break;
        case 'service':
          await coreApi.deleteCollectionNamespacedService(namespace);
          break;
        case 'configmap':
          await coreApi.deleteCollectionNamespacedConfigMap(namespace);
          break;
        case 'secret':
          await coreApi.deleteCollectionNamespacedSecret(namespace);
          break;
        case 'pvc':
          await coreApi.deleteCollectionNamespacedPersistentVolumeClaim(namespace);
          break;
      }
      console.log(`Deleted all ${resourceType}s in namespace ${namespace}`);
    } catch (error) {
      console.error(`Error deleting ${resourceType}: ${error.message}`);
    }
  }
}
```

**3. Graceful Cleanup with Finalizers**

Handle resources with finalizers (PVCs, custom resources):

```bash
# Remove finalizers from stuck resources
kubectl patch pvc pvc-name -n test-namespace \
  -p '{"metadata":{"finalizers":null}}' --type=merge

# Force delete if necessary (last resort)
kubectl delete pvc pvc-name -n test-namespace --force --grace-period=0
```

---

### Handling Orphaned Resources

**Detection:**

```bash
# Find resources without owner references
kubectl get pods -n test-namespace -o json | \
  jq '.items[] | select(.metadata.ownerReferences == null) | .metadata.name'

# Find old test namespaces
kubectl get namespaces -l test=integration -o json | \
  jq '.items[] | select(.metadata.labels."created-at" | tonumber < (now - 3600)) | .metadata.name'
```

**Automated Cleanup Script:**

```bash
#!/bin/bash
# cleanup-orphaned-tests.sh

# Delete test namespaces older than 1 hour
CUTOFF_TIME=$(($(date +%s) - 3600))

kubectl get namespaces -l test=integration -o json | \
  jq -r ".items[] | select(.metadata.labels.\"created-at\" | tonumber < $CUTOFF_TIME) | .metadata.name" | \
  while read ns; do
    echo "Deleting orphaned namespace: $ns"
    kubectl delete namespace "$ns" --timeout=60s &
  done

wait
echo "Cleanup complete"
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: Deployment Not Becoming Ready

**Symptoms:**
- `kubectl get pods` shows pods in `Pending`, `CrashLoopBackOff`, or `ImagePullBackOff`
- Deployment stuck with 0/1 replicas ready

**Diagnosis:**
```bash
# Check pod status
kubectl get pods -n test-namespace

# Describe pod for events
kubectl describe pod pod-name -n test-namespace

# Check logs
kubectl logs pod-name -n test-namespace

# Check previous logs (if container restarting)
kubectl logs pod-name -n test-namespace --previous
```

**Common Causes:**

1. **Image Pull Issues**
   - Solution: Verify image exists, check imagePullPolicy
   - KIND: Pre-load images with `kind load docker-image`

2. **Resource Constraints**
   - Solution: Reduce resource requests or increase cluster resources
   - KIND: Create cluster with more resources

3. **Failed Health Checks**
   - Solution: Increase initialDelaySeconds, verify health endpoint
   - Check: `curl http://pod-ip:port/health`

4. **Application Crashes**
   - Solution: Check logs for errors, verify environment variables
   - Check: `kubectl logs pod-name --previous`

---

#### Issue 2: Service Endpoint Not Accessible

**Symptoms:**
- Service created but health checks fail
- `kubectl get endpoints` shows no endpoints

**Diagnosis:**
```bash
# Check service
kubectl get service app-name -n test-namespace

# Check endpoints
kubectl get endpoints app-name -n test-namespace

# Check pod labels match service selector
kubectl get pods -n test-namespace --show-labels
kubectl get service app-name -n test-namespace -o yaml | grep selector -A 5
```

**Solutions:**

1. **Label Mismatch**
   ```bash
   # Verify pod labels match service selector
   kubectl label pod pod-name app=app-name -n test-namespace
   ```

2. **Pod Not Ready**
   ```bash
   # Check readiness probe status
   kubectl describe pod pod-name -n test-namespace | grep -A 10 Conditions
   ```

3. **Port Mismatch**
   ```bash
   # Verify service port matches container port
   kubectl get service app-name -n test-namespace -o yaml
   kubectl get pod pod-name -n test-namespace -o yaml | grep containerPort
   ```

---

#### Issue 3: PVC Not Binding

**Symptoms:**
- PVC stuck in `Pending` status
- Pod stuck in `ContainerCreating`

**Diagnosis:**
```bash
# Check PVC status
kubectl get pvc -n test-namespace

# Describe PVC for events
kubectl describe pvc pvc-name -n test-namespace

# Check available storage classes
kubectl get storageclass
```

**Solutions:**

1. **KIND Missing StorageClass**
   ```bash
   # KIND uses local-path-provisioner
   # Verify it's running
   kubectl get pods -n local-path-storage
   
   # Use correct storage class name
   storageClassName: standard  # or local-path
   ```

2. **Insufficient Storage**
   ```bash
   # Reduce storage request
   resources:
     requests:
       storage: 100Mi  # Instead of 10Gi
   ```

---

#### Issue 4: Slow Deployment on KIND

**Symptoms:**
- Deployments take >60 seconds to become ready
- Image pulls are slow

**Solutions:**

1. **Pre-load Images**
   ```bash
   # Build image locally
   docker build -t test-app:latest .
   
   # Load into KIND cluster
   kind load docker-image test-app:latest
   ```

2. **Use Cached Images**
   ```yaml
   # Use imagePullPolicy: Never for local images
   image: test-app:latest
   imagePullPolicy: Never
   ```

3. **Use Smaller Base Images**
   ```dockerfile
   # Use alpine variants
   FROM node:20-alpine  # Instead of node:20
   FROM python:3.11-slim  # Instead of python:3.11
   ```

---

#### Issue 5: Namespace Stuck in Terminating

**Symptoms:**
- `kubectl delete namespace` hangs
- Namespace shows `Terminating` status indefinitely

**Diagnosis:**
```bash
# Check for resources blocking deletion
kubectl api-resources --verbs=list --namespaced -o name | \
  xargs -n 1 kubectl get --show-kind --ignore-not-found -n test-namespace

# Check for finalizers
kubectl get namespace test-namespace -o yaml | grep -A 5 finalizers
```

**Solutions:**

1. **Remove Finalizers**
   ```bash
   kubectl patch namespace test-namespace \
     -p '{"metadata":{"finalizers":null}}' --type=merge
   ```

2. **Force Delete Resources**
   ```bash
   # Delete PVCs with finalizers
   kubectl delete pvc --all -n test-namespace --force --grace-period=0
   
   # Then delete namespace
   kubectl delete namespace test-namespace --force --grace-period=0
   ```

---

### Performance Optimization Tips

1. **Reduce Image Size**
   - Use multi-stage builds
   - Use alpine/slim base images
   - Remove unnecessary dependencies

2. **Optimize Health Check Timing**
   ```yaml
   # Good balance for tests
   livenessProbe:
     initialDelaySeconds: 10
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 3
   readinessProbe:
     initialDelaySeconds: 5
     periodSeconds: 5
     timeoutSeconds: 3
     failureThreshold: 3
   ```

3. **Use Resource Requests Wisely**
   ```yaml
   # Minimal but sufficient
   resources:
     requests:
       cpu: 50m      # 0.05 cores
       memory: 64Mi
     limits:
       cpu: 100m     # 0.1 cores
       memory: 128Mi
   ```

4. **Parallel Test Execution**
   - Use separate namespaces per test
   - Clean up resources immediately after test
   - Consider test ordering (fast tests first)

---

## References

### Kubernetes Documentation

- [Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Services](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Init Containers](https://kubernetes.io/docs/concepts/workloads/pods/init-containers/)
- [ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [Persistent Volumes](https://kubernetes.io/docs/concepts/storage/persistent-volumes/)

### KIND Documentation

- [Quick Start](https://kind.sigs.k8s.io/docs/user/quick-start/)
- [Loading Images](https://kind.sigs.k8s.io/docs/user/quick-start/#loading-an-image-into-your-cluster)
- [Cluster Configuration](https://kind.sigs.k8s.io/docs/user/configuration/)

### Best Practices

- [Kubernetes Best Practices](https://kubernetes.io/docs/concepts/configuration/overview/)
- [Health Checks Best Practices](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/#define-readiness-probes)
- [Resource Management Best Practices](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/)

### Testing Resources

- [Testing Kubernetes Deployments](https://github.com/kubernetes/community/blob/master/contributors/devel/sig-testing/testing.md)
- [@kubernetes/client-node](https://github.com/kubernetes-client/javascript)
- [Jest Testing Framework](https://jestjs.io/)

---

## Appendix

### Complete Test Suite Example

```javascript
// verify-deploy.integration.test.js
const k8s = require('@kubernetes/client-node');
const axios = require('axios');
const { execSync } = require('child_process');

describe('verify-deploy integration tests', () => {
  let kc, coreApi, appsApi;
  let testNamespace;
  
  beforeAll(() => {
    kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    coreApi = kc.makeApiClient(k8s.CoreV1Api);
    appsApi = kc.makeApiClient(k8s.AppsV1Api);
  });
  
  beforeEach(async () => {
    testNamespace = `test-${Date.now()}`;
    await createNamespace(testNamespace);
  });
  
  afterEach(async () => {
    await cleanupNamespace(testNamespace);
  });
  
  describe('simple stateless deployment', () => {
    it('should deploy and verify health', async () => {
      // Apply manifest
      execSync(`kubectl apply -f test/fixtures/kubernetes-deployments/simple-stateless.yaml -n ${testNamespace}`);
      
      // Wait for deployment
      await waitForDeployment(testNamespace, 'simple-web', 60);
      
      // Verify health
      const endpoint = await getServiceEndpoint(testNamespace, 'simple-web');
      const health = await validateHealth(endpoint.url);
      
      expect(health.success).toBe(true);
    });
  });
  
  // Additional test scenarios...
  
  async function createNamespace(name) {
    await coreApi.createNamespace({
      metadata: { name, labels: { test: 'integration' }}
    });
  }
  
  async function cleanupNamespace(name) {
    await coreApi.deleteNamespace(name);
  }
  
  async function waitForDeployment(namespace, name, timeoutSeconds) {
    // Implementation from validation strategies section
  }
  
  async function getServiceEndpoint(namespace, name) {
    // Implementation from validation strategies section
  }
  
  async function validateHealth(url) {
    // Implementation from validation strategies section
  }
});
```

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Maintainer:** Integration Test Team  
**Review Cycle:** Quarterly or when Kubernetes version changes
