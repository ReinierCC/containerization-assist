/**
 * Sample Express application for E2E workflow testing
 * 
 * Features:
 * - Health check endpoint (/health)
 * - Readiness check endpoint (/ready)
 * - Simple API endpoint (/)
 * - Environment variable support
 */

const express = require('express');
const app = express();

const PORT = process.env.PORT || 3000;
const VERSION = process.env.APP_VERSION || '1.0.0';
const ENV = process.env.NODE_ENV || 'development';

// Track startup time for health checks
const startTime = new Date();

// Middleware
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Hello from sample-workflow-app!',
    version: VERSION,
    environment: ENV,
    timestamp: new Date().toISOString()
  });
});

// Health check endpoint (for liveness probes)
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    uptime: Math.floor((Date.now() - startTime.getTime()) / 1000),
    timestamp: new Date().toISOString()
  });
});

// Readiness check endpoint (for readiness probes)
app.get('/ready', (req, res) => {
  // In a real app, this would check database connections, etc.
  res.status(200).json({
    status: 'ready',
    checks: {
      server: 'ok'
    },
    timestamp: new Date().toISOString()
  });
});

// API endpoint
app.get('/api/info', (req, res) => {
  res.json({
    name: 'sample-workflow-app',
    version: VERSION,
    environment: ENV,
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${ENV}`);
  console.log(`Version: ${VERSION}`);
});
