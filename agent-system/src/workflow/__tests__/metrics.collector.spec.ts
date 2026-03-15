import {
  MetricsCollector,
  MetricType,
} from '../monitoring/metrics.collector';

describe('MetricsCollector', () => {
  let collector: MetricsCollector;

  beforeEach(() => {
    collector = new MetricsCollector();
  });

  describe('record', () => {
    it('should record counter metric', () => {
      collector.record('execution_count', 1, MetricType.COUNTER);
      collector.record('execution_count', 1, MetricType.COUNTER);

      const metrics = collector.getMetrics();
      expect(metrics['execution_count']).toBeDefined();
    });

    it('should record gauge metric', () => {
      collector.record('active_executions', 5, MetricType.GAUGE);
      collector.record('active_executions', 3, MetricType.GAUGE);

      const value = collector.getValue('active_executions');
      expect(value).toBe(3);
    });

    it('should record histogram metric', () => {
      collector.record('execution_duration', 100, MetricType.HISTOGRAM);
      collector.record('execution_duration', 200, MetricType.HISTOGRAM);
      collector.record('execution_duration', 300, MetricType.HISTOGRAM);

      const metrics = collector.getMetrics();
      expect(metrics['execution_duration']).toBeDefined();
    });

    it('should record timer metric', () => {
      const timer = collector.startTimer('api_call');
      timer.end();

      const metrics = collector.getMetrics();
      expect(metrics['api_call']).toBeDefined();
    });
  });

  describe('getMetrics', () => {
    it('should return all metrics', () => {
      collector.record('metric1', 1, MetricType.COUNTER);
      collector.record('metric2', 2, MetricType.GAUGE);

      const metrics = collector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(2);
    });

    it('should filter by name pattern', () => {
      collector.record('execution_count', 1, MetricType.COUNTER);
      collector.record('execution_time', 100, MetricType.HISTOGRAM);
      collector.record('memory_usage', 50, MetricType.GAUGE);

      const metrics = collector.getMetrics({ pattern: /execution/ });
      expect(Object.keys(metrics)).toHaveLength(2);
    });
  });

  describe('getValue', () => {
    it('should return current value for gauge', () => {
      collector.record('gauge', 100, MetricType.GAUGE);
      expect(collector.getValue('gauge')).toBe(100);

      collector.record('gauge', 200, MetricType.GAUGE);
      expect(collector.getValue('gauge')).toBe(200);
    });

    it('should return null for non-existent metric', () => {
      expect(collector.getValue('non_existent')).toBeNull();
    });
  });

  describe('getHistogramStats', () => {
    it('should calculate percentiles', () => {
      // Add values: 10, 20, 30, ..., 100
      for (let i = 1; i <= 10; i++) {
        collector.record('latency', i * 10, MetricType.HISTOGRAM);
      }

      const stats = collector.getHistogramStats('latency');
      expect(stats).toBeDefined();
      expect(stats?.count).toBe(10);
      expect(stats?.p50).toBe(50);
      expect(stats?.p95).toBe(100); // 95th percentile of [10, 20, ..., 100] = 100
    });
  });

  describe('exportPrometheus', () => {
    it('should export in Prometheus format', () => {
      collector.record('counter', 5, MetricType.COUNTER, { label: 'value' });
      collector.record('gauge', 100, MetricType.GAUGE, { label: 'value' });

      const output = collector.exportPrometheus();
      expect(output).toContain('# HELP');
      expect(output).toContain('# TYPE');
      expect(output).toContain('counter');
      expect(output).toContain('gauge');
    });
  });

  describe('reset', () => {
    it('should clear all metrics', () => {
      collector.record('metric1', 1, MetricType.COUNTER);
      collector.record('metric2', 2, MetricType.GAUGE);

      collector.reset();

      const metrics = collector.getMetrics();
      expect(Object.keys(metrics)).toHaveLength(0);
    });

    it('should clear specific metric', () => {
      collector.record('metric1', 1, MetricType.COUNTER);
      collector.record('metric2', 2, MetricType.GAUGE);

      collector.reset('metric1');

      expect(collector.getValue('metric1')).toBeNull();
      expect(collector.getValue('metric2')).toBe(2);
    });
  });

  describe('rate calculation', () => {
    it('should calculate rate for counter', async () => {
      collector.record('requests', 100, MetricType.COUNTER);

      await new Promise(resolve => setTimeout(resolve, 100));

      collector.record('requests', 200, MetricType.COUNTER);

      const rate = collector.getRate('requests', 1000);
      // Rate should be approximately 1000 requests/second
      expect(rate).toBeGreaterThan(0);
    });
  });
});
