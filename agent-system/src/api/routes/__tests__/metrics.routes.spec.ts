/**
 * Metrics Routes 测试
 */

import request from 'supertest';
import express from 'express';
import { createMetricsRoutes } from '../metrics.routes';
import { MetricsCollector } from '../../../workflow/monitoring/metrics.collector';

describe('Metrics Routes', () => {
  let app: express.Application;
  let metricsCollector: MetricsCollector;

  beforeEach(() => {
    metricsCollector = new MetricsCollector();
    app = express();
    app.use('/api/metrics', createMetricsRoutes(metricsCollector));
  });

  describe('GET /api/metrics', () => {
    it('should return metrics', async () => {
      // Record some metrics
      metricsCollector.record('test_metric', 100, { type: 'counter' } as any);

      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return empty metrics when no metrics recorded', async () => {
      const response = await request(app)
        .get('/api/metrics')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/metrics/prometheus', () => {
    it('should return prometheus format metrics', async () => {
      metricsCollector.record('http_requests', 10, { type: 'counter' } as any);

      const response = await request(app)
        .get('/api/metrics/prometheus')
        .expect(200);

      expect(response.text).toBeDefined();
      expect(response.headers['content-type']).toContain('text/plain');
    });

    it('should return empty prometheus output when no metrics', async () => {
      const response = await request(app)
        .get('/api/metrics/prometheus')
        .expect(200);

      expect(response.text).toBeDefined();
    });
  });

  describe('GET /api/metrics/health', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/api/metrics/health')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('healthy');
      expect(response.body.data.timestamp).toBeDefined();
      expect(response.body.data.uptime).toBeDefined();
      expect(response.body.data.memory).toBeDefined();
    });

    it('should include version in health check', async () => {
      const originalVersion = process.env.npm_package_version;
      process.env.npm_package_version = '2.0.0';

      const response = await request(app)
        .get('/api/metrics/health')
        .expect(200);

      expect(response.body.data.version).toBe('2.0.0');

      if (originalVersion !== undefined) {
        process.env.npm_package_version = originalVersion;
      } else {
        delete process.env.npm_package_version;
      }
    });

    it('should use default version when env not set', async () => {
      const originalVersion = process.env.npm_package_version;
      delete process.env.npm_package_version;

      const response = await request(app)
        .get('/api/metrics/health')
        .expect(200);

      expect(response.body.data.version).toBe('1.0.0');

      if (originalVersion !== undefined) {
        process.env.npm_package_version = originalVersion;
      }
    });
  });

  describe('GET /api/metrics/health/ready', () => {
    it('should return ready status', async () => {
      const response = await request(app)
        .get('/api/metrics/health/ready')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('ready');
      expect(response.body.data.checks).toBeDefined();
      expect(response.body.data.checks.database).toEqual({ status: 'ok' });
    });

    // Note: checkSystemReadiness currently always returns true,
    // so we cannot test the not_ready branch without mocking
  });

  describe('GET /api/metrics/health/live', () => {
    it('should return alive status', async () => {
      const response = await request(app)
        .get('/api/metrics/health/live')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('alive');
      expect(response.body.data.timestamp).toBeDefined();
    });
  });
});
