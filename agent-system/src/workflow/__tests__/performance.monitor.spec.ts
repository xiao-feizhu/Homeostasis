import {
  PerformanceMonitor,
  AlertThreshold,
} from '../monitoring/performance.monitor';
import { MetricsCollector } from '../monitoring/metrics.collector';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
    monitor = new PerformanceMonitor(metrics);
  });

  describe('recordExecution', () => {
    it('should record execution metrics', () => {
      monitor.recordExecution('test-workflow', 100, true);

      const value = metrics.getValue('workflow_execution_duration');
      expect(value).toBe(100);
    });

    it('should track success count', () => {
      monitor.recordExecution('test-workflow', 100, true);
      monitor.recordExecution('test-workflow', 200, true);

      const successCount = metrics.getValue('workflow_execution_success');
      expect(successCount).toBe(2);
    });

    it('should track failure count', () => {
      monitor.recordExecution('test-workflow', 100, false);

      const failureCount = metrics.getValue('workflow_execution_failure');
      expect(failureCount).toBe(1);
    });
  });

  describe('recordNodeExecution', () => {
    it('should record node execution metrics', () => {
      monitor.recordNodeExecution('code', 50, true);

      const value = metrics.getValue('node_execution_duration');
      expect(value).toBe(50);
    });

    it('should track node success count', () => {
      monitor.recordNodeExecution('code', 50, true);

      const successCount = metrics.getValue('node_execution_success');
      expect(successCount).toBe(1);
    });
  });

  describe('recordQueueMetrics', () => {
    it('should record queue depth', () => {
      monitor.recordQueueMetrics(10, 5);

      const depth = metrics.getValue('queue_depth');
      const processing = metrics.getValue('queue_processing');

      expect(depth).toBe(10);
      expect(processing).toBe(5);
    });
  });

  describe('recordMemoryUsage', () => {
    it('should record memory metrics', () => {
      monitor.recordMemoryUsage(1000, 500, 200);

      const total = metrics.getValue('memory_total');
      const used = metrics.getValue('memory_used');
      const free = metrics.getValue('memory_free');

      expect(total).toBe(1000);
      expect(used).toBe(500);
      expect(free).toBe(200);
    });
  });

  describe('configureAlerts', () => {
    it('should configure alert thresholds', () => {
      const thresholds: AlertThreshold[] = [
        { metric: 'workflow_execution_duration', max: 1000 },
        { metric: 'memory_used', max: 80 },
      ];

      monitor.configureAlerts(thresholds);

      // Should not throw
      expect(() => monitor.checkAlerts()).not.toThrow();
    });
  });

  describe('checkAlerts', () => {
    it('should trigger alert when threshold exceeded', () => {
      const onAlert = jest.fn();
      const thresholds: AlertThreshold[] = [
        { metric: 'workflow_execution_duration', max: 100 },
      ];

      monitor.configureAlerts(thresholds, onAlert);
      monitor.recordExecution('test', 200, true);

      monitor.checkAlerts();

      expect(onAlert).toHaveBeenCalled();
    });

    it('should not trigger alert when within threshold', () => {
      const onAlert = jest.fn();
      const thresholds: AlertThreshold[] = [
        { metric: 'workflow_execution_duration', max: 1000 },
      ];

      monitor.configureAlerts(thresholds, onAlert);
      monitor.recordExecution('test', 100, true);

      monitor.checkAlerts();

      expect(onAlert).not.toHaveBeenCalled();
    });
  });

  describe('generateReport', () => {
    it('should generate performance report', () => {
      monitor.recordExecution('wf1', 100, true);
      monitor.recordExecution('wf2', 200, true);
      monitor.recordExecution('wf3', 300, false);

      const report = monitor.generateReport();

      expect(report.totalExecutions).toBe(3);
      expect(report.successRate).toBeCloseTo(66.67, 1);
      expect(report.avgExecutionTime).toBeGreaterThan(0);
    });

    it('should calculate percentiles', () => {
      for (let i = 1; i <= 10; i++) {
        monitor.recordExecution(`wf${i}`, i * 10, true);
      }

      const report = monitor.generateReport();

      expect(report.p50).toBeDefined();
      expect(report.p95).toBeDefined();
      expect(report.p99).toBeDefined();
    });

    it('should handle empty metrics', () => {
      const report = monitor.generateReport();

      expect(report.totalExecutions).toBe(0);
      expect(report.successRate).toBe(0);
    });
  });

  describe('exportPrometheus', () => {
    it('should export metrics in Prometheus format', () => {
      monitor.recordExecution('test', 100, true);

      const output = monitor.exportPrometheus();

      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('workflow_execution_duration');
    });
  });

  describe('startTimer', () => {
    it('should return timer that records duration', () => {
      const timer = monitor.startTimer('test-workflow');

      // Simulate some work
      const duration = timer.end();

      expect(duration).toBeGreaterThanOrEqual(0);

      const value = metrics.getValue('workflow_execution_duration');
      expect(value).toBeDefined();
    });
  });

  describe('reset', () => {
    it('should reset all metrics', () => {
      monitor.recordExecution('test', 100, true);

      monitor.reset();

      const value = metrics.getValue('workflow_execution_duration');
      expect(value).toBeNull();
    });
  });
});
