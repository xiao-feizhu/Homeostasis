/**
 * 告警管理器
 *
 * 管理告警规则和告警触发
 */

import { MetricsCollector } from './metrics.collector';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export enum AlertCondition {
  GT = 'gt',    // greater than
  LT = 'lt',    // less than
  EQ = 'eq',    // equal
  GTE = 'gte',  // greater than or equal
  LTE = 'lte',  // less than or equal
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  severity: AlertSeverity;
  cooldownMs?: number;
  labels?: Record<string, string>;
}

export interface AlertInstance {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: AlertSeverity;
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
  resolvedAt?: number;
}

export interface AlertEvent {
  alert: AlertInstance;
  action: 'triggered' | 'resolved';
}

type AlertHandler = (event: AlertEvent) => void;

interface RuleState {
  lastTriggeredAt?: number;
  silencedUntil?: number;
}

/**
 * 告警管理器
 */
export class AlertManager {
  private rules: Map<string, AlertRule> = new Map();
  private ruleStates: Map<string, RuleState> = new Map();
  private activeAlerts: Map<string, AlertInstance> = new Map();
  private alertHistory: AlertInstance[] = [];
  private handlers: AlertHandler[] = [];

  constructor(private metrics: MetricsCollector) {}

  /**
   * 添加告警规则
   */
  addRule(rule: AlertRule): void {
    if (this.rules.has(rule.id)) {
      throw new Error(`Alert rule with id '${rule.id}' already exists`);
    }
    this.rules.set(rule.id, rule);
    this.ruleStates.set(rule.id, {});
  }

  /**
   * 移除告警规则
   */
  removeRule(ruleId: string): boolean {
    // Resolve any active alerts for this rule
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.ruleId === ruleId) {
        this.resolveAlert(alertId);
      }
    }
    this.ruleStates.delete(ruleId);
    return this.rules.delete(ruleId);
  }

  /**
   * 获取所有规则
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * 注册告警处理器
   */
  onAlert(handler: AlertHandler): void {
    this.handlers.push(handler);
  }

  /**
   * 检查所有规则
   */
  checkRules(): AlertInstance[] {
    const triggered: AlertInstance[] = [];

    for (const rule of this.rules.values()) {
      const alert = this.checkRule(rule);
      if (alert) {
        triggered.push(alert);
      }
    }

    return triggered;
  }

  /**
   * 检查单个规则
   */
  private checkRule(rule: AlertRule): AlertInstance | null {
    const state = this.ruleStates.get(rule.id) || {};

    // Check if rule is silenced
    if (state.silencedUntil && Date.now() < state.silencedUntil) {
      return null;
    }

    // Check cooldown
    if (rule.cooldownMs && state.lastTriggeredAt) {
      const elapsed = Date.now() - state.lastTriggeredAt;
      if (elapsed < rule.cooldownMs) {
        return null;
      }
    }

    // Get metric value
    const value = this.metrics.getValue(rule.metric);
    if (value === null) {
      return null;
    }

    // Check condition
    const conditionMet = this.evaluateCondition(value, rule.condition, rule.threshold);
    if (!conditionMet) {
      // Check if we need to resolve an active alert
      const existingAlert = this.findActiveAlert(rule.id);
      if (existingAlert) {
        this.resolveAlert(existingAlert.id);
      }
      return null;
    }

    // Check if already active
    if (this.findActiveAlert(rule.id)) {
      return null;
    }

    // Create alert
    const alert: AlertInstance = {
      id: this.generateAlertId(),
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, value),
      value,
      threshold: rule.threshold,
      timestamp: Date.now(),
    };

    // Update state
    state.lastTriggeredAt = Date.now();
    this.ruleStates.set(rule.id, state);

    // Store alert
    this.activeAlerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Notify handlers
    this.notifyHandlers({ alert, action: 'triggered' });

    return alert;
  }

  /**
   * 评估条件
   */
  private evaluateCondition(
    value: number,
    condition: string,
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'eq':
        return value === threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      default:
        return false;
    }
  }

  /**
   * 生成告警消息
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    const conditionText: Record<string, string> = {
      gt: 'exceeds',
      lt: 'below',
      eq: 'equals',
      gte: 'greater than or equals',
      lte: 'less than or equals',
    };

    return `${rule.name}: ${rule.metric} (${value}) ${conditionText[rule.condition]} threshold (${rule.threshold})`;
  }

  /**
   * 查找活动告警
   */
  private findActiveAlert(ruleId: string): AlertInstance | undefined {
    for (const alert of this.activeAlerts.values()) {
      if (alert.ruleId === ruleId) {
        return alert;
      }
    }
    return undefined;
  }

  /**
   * 解决告警
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.activeAlerts.get(alertId);
    if (!alert) {
      return false;
    }

    alert.resolvedAt = Date.now();
    this.activeAlerts.delete(alertId);

    this.notifyHandlers({ alert, action: 'resolved' });

    return true;
  }

  /**
   * 获取活动告警
   */
  getActiveAlerts(): AlertInstance[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * 获取告警历史
   */
  getAlertHistory(): AlertInstance[] {
    return [...this.alertHistory];
  }

  /**
   * 清空历史
   */
  clearHistory(): void {
    this.alertHistory = [];
  }

  /**
   * 静默规则
   */
  silenceRule(ruleId: string, durationMs: number): boolean {
    const state = this.ruleStates.get(ruleId);
    if (!state) {
      return false;
    }

    state.silencedUntil = Date.now() + durationMs;
    this.ruleStates.set(ruleId, state);

    return true;
  }

  /**
   * 取消静默
   */
  unsilenceRule(ruleId: string): boolean {
    const state = this.ruleStates.get(ruleId);
    if (!state) {
      return false;
    }

    delete state.silencedUntil;
    this.ruleStates.set(ruleId, state);

    return true;
  }

  /**
   * 通知处理器
   */
  private notifyHandlers(event: AlertEvent): void {
    for (const handler of this.handlers) {
      try {
        handler(event);
      } catch (error) {
        console.error('Alert handler error:', error);
      }
    }
  }

  /**
   * 生成告警ID
   */
  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }
}
