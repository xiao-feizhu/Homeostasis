import { AlertManager, AlertRule, AlertSeverity, AlertEvent } from '../monitoring/alert.manager';
import { MetricsCollector, MetricType } from '../monitoring/metrics.collector';

describe('AlertManager', () => {
  let manager: AlertManager;
  let metrics: MetricsCollector;

  beforeEach(() => {
    metrics = new MetricsCollector();
    manager = new AlertManager(metrics);
  });

  describe('addRule', () => {
    it('should add alert rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);

      // Should not throw
      expect(() => manager.checkRules()).not.toThrow();
    });

    it('should throw if rule with same id already exists', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);

      expect(() => manager.addRule(rule)).toThrow(/already exists/);
    });
  });

  describe('removeRule', () => {
    it('should remove alert rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      manager.removeRule('rule-1');

      // Rule removed, should not trigger alert even if condition is met
      metrics.record('error_count', 100, MetricType.COUNTER);
      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(0);
    });

    it('should resolve active alerts when removing rule', () => {
      const handler = jest.fn();
      manager.onAlert(handler);

      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(1);

      // Remove rule should resolve the active alert
      manager.removeRule('rule-1');

      // Should have triggered 'resolved' event
      const resolveEvent = handler.mock.calls.find(
        (call: [AlertEvent]) => call[0].action === 'resolved'
      );
      expect(resolveEvent).toBeDefined();
      expect(resolveEvent[0].alert.ruleId).toBe('rule-1');

      // No active alerts should remain
      expect(manager.getActiveAlerts()).toHaveLength(0);
    });

    it('should return false when removing non-existent rule', () => {
      const result = manager.removeRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('checkRules', () => {
    it('should trigger alert when gt condition is met', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);

      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(1);
      expect(triggered[0].ruleId).toBe('rule-1');
    });

    it('should trigger alert when lt condition is met', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Low Throughput',
        metric: 'throughput',
        condition: 'lt',
        threshold: 100,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('throughput', 50, MetricType.GAUGE);

      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(1);
    });

    it('should trigger alert when eq condition is met', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Specific Value',
        metric: 'status',
        condition: 'eq',
        threshold: 500,
        severity: AlertSeverity.CRITICAL,
      };

      manager.addRule(rule);
      metrics.record('status', 500, MetricType.GAUGE);

      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(1);
    });

    it('should not trigger alert when condition is not met', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 100,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 10, MetricType.COUNTER);

      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(0);
    });

    it('should respect cooldown period', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
        cooldownMs: 60000,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);

      // First check - should trigger
      const triggered1 = manager.checkRules();
      expect(triggered1).toHaveLength(1);

      // Second check - should not trigger due to cooldown
      const triggered2 = manager.checkRules();
      expect(triggered2).toHaveLength(0);
    });
  });

  describe('onAlert', () => {
    it('should call alert handler when rule triggers', () => {
      const handler = jest.fn();
      manager.onAlert(handler);

      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      manager.checkRules();

      expect(handler).toHaveBeenCalled();
      expect(handler.mock.calls[0][0].alert.ruleId).toBe('rule-1');
      expect(handler.mock.calls[0][0].action).toBe('triggered');
    });
  });

  describe('resolveAlert', () => {
    it('should resolve active alert', () => {
      const handler = jest.fn();
      manager.onAlert(handler);

      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(1);

      // Resolve the alert
      const resolved = manager.resolveAlert(triggered[0].id);
      expect(resolved).toBe(true);

      const activeAlerts = manager.getActiveAlerts();
      expect(activeAlerts).toHaveLength(0);
    });
  });

  describe('getActiveAlerts', () => {
    it('should return list of active alerts', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      manager.checkRules();

      const active = manager.getActiveAlerts();
      expect(active).toHaveLength(1);
      expect(active[0].severity).toBe(AlertSeverity.WARNING);
    });
  });

  describe('getAlertHistory', () => {
    it('should return alert history', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      manager.checkRules();

      const history = manager.getAlertHistory();
      expect(history).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    it('should clear alert history', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      manager.checkRules();

      manager.clearHistory();

      const history = manager.getAlertHistory();
      expect(history).toHaveLength(0);
    });
  });

  describe('silenceRule', () => {
    it('should silence rule for specified duration', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      manager.silenceRule('rule-1', 60000);

      metrics.record('error_count', 100, MetricType.COUNTER);
      const triggered = manager.checkRules();

      expect(triggered).toHaveLength(0);
    });

    it('should return false when silencing non-existent rule', () => {
      const result = manager.silenceRule('non-existent', 60000);
      expect(result).toBe(false);
    });
  });

  describe('unsilenceRule', () => {
    it('should unsilence a silenced rule', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      manager.silenceRule('rule-1', 60000);

      // Should be silenced
      metrics.record('error_count', 100, MetricType.COUNTER);
      let triggered = manager.checkRules();
      expect(triggered).toHaveLength(0);

      // Unsilence
      const unsilenced = manager.unsilenceRule('rule-1');
      expect(unsilenced).toBe(true);

      // Should trigger now
      triggered = manager.checkRules();
      expect(triggered).toHaveLength(1);
    });

    it('should return false when unsilencing non-existent rule', () => {
      const result = manager.unsilenceRule('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('getRules', () => {
    it('should return all added rules', () => {
      const rule1: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      const rule2: AlertRule = {
        id: 'rule-2',
        name: 'Low Throughput',
        metric: 'throughput',
        condition: 'lt',
        threshold: 100,
        severity: AlertSeverity.CRITICAL,
      };

      manager.addRule(rule1);
      manager.addRule(rule2);

      const rules = manager.getRules();
      expect(rules).toHaveLength(2);
      expect(rules.map(r => r.id)).toContain('rule-1');
      expect(rules.map(r => r.id)).toContain('rule-2');
    });

    it('should return empty array when no rules', () => {
      const rules = manager.getRules();
      expect(rules).toEqual([]);
    });
  });

  describe('condition evaluation', () => {
    it('should trigger alert with gte condition', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gte',
        threshold: 100,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);

      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(1);
    });

    it('should trigger alert with lte condition', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Low Memory',
        metric: 'memory',
        condition: 'lte',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('memory', 10, MetricType.GAUGE);

      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(1);
    });

    it('should not trigger for unknown condition', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'Test Rule',
        metric: 'test_metric',
        condition: 'unknown' as any,
        threshold: 100,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('test_metric', 1000, MetricType.COUNTER);

      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(0);
    });
  });

  describe('alert resolution when condition not met', () => {
    it('should resolve alert when condition is no longer met', () => {
      const handler = jest.fn();
      manager.onAlert(handler);

      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Memory Usage',
        metric: 'memory_usage',
        condition: 'gt',
        threshold: 80,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);

      // Trigger alert using GAUGE (not COUNTER, since counters accumulate)
      metrics.record('memory_usage', 90, MetricType.GAUGE);
      let triggered = manager.checkRules();
      expect(triggered).toHaveLength(1);
      expect(manager.getActiveAlerts()).toHaveLength(1);

      // Resolve alert by lowering value
      metrics.record('memory_usage', 50, MetricType.GAUGE);
      triggered = manager.checkRules();
      expect(triggered).toHaveLength(0);
      expect(manager.getActiveAlerts()).toHaveLength(0);

      // Check resolve event was sent
      const resolveEvent = handler.mock.calls.find(
        (call: [AlertEvent]) => call[0].action === 'resolved'
      );
      expect(resolveEvent).toBeDefined();
    });
  });

  describe('null metric handling', () => {
    it('should not trigger alert when metric value is null', () => {
      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'non_existent_metric',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      // Don't record any value for the metric

      const triggered = manager.checkRules();
      expect(triggered).toHaveLength(0);
    });
  });

  describe('alert handler error handling', () => {
    it('should continue notifying other handlers when one throws', () => {
      const errorHandler = jest.fn(() => {
        throw new Error('Handler error');
      });
      const successHandler = jest.fn();

      manager.onAlert(errorHandler);
      manager.onAlert(successHandler);

      const rule: AlertRule = {
        id: 'rule-1',
        name: 'High Error Rate',
        metric: 'error_count',
        condition: 'gt',
        threshold: 10,
        severity: AlertSeverity.WARNING,
      };

      manager.addRule(rule);
      metrics.record('error_count', 100, MetricType.COUNTER);
      manager.checkRules();

      // Both handlers should have been called
      expect(errorHandler).toHaveBeenCalled();
      expect(successHandler).toHaveBeenCalled();
    });
  });

  describe('resolveAlert', () => {
    it('should return false when resolving non-existent alert', () => {
      const result = manager.resolveAlert('non-existent');
      expect(result).toBe(false);
    });
  });
});
