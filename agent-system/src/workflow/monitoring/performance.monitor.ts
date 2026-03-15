/**
 * 性能监控器
 *
 * 协调性能指标收集、告警和报告生成
 */

import { MetricsCollector, MetricType, Timer } from './metrics.collector';

export interface AlertThreshold {
  metric: string;
  min?: number;
  max?: number;
}

export interface PerformanceAlertEvent {
  timestamp: number;
  metric: string;
  value: number;
  threshold: AlertThreshold;
  message: string;
}

export interface PerformanceReport {
  timestamp: number;
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;
  avgExecutionTime: number;
  p50: number;
  p95: number;
  p99: number;
  queueDepth: number;
  memoryUsage: {
    total: number;
    used: number;
    free: number;
  };
}

/**
 * 性能监控器
 */
export class PerformanceMonitor {
  private alertThresholds: AlertThreshold[] = [];
  private onAlert?: (event: PerformanceAlertEvent) => void;

  constructor(private metrics: MetricsCollector) {}

  /**
   * 记录工作流执行
   */
  recordExecution(
    workflowId: string,
    duration: number,
    success: boolean,
    labels?: Record<string, string>
  ): void {
    const executionLabels = { workflowId, ...labels };

    this.metrics.record(
      'workflow_execution_duration',
      duration,
      MetricType.HISTOGRAM,
      executionLabels
    );

    if (success) {
      this.metrics.record(
        'workflow_execution_success',
        1,
        MetricType.COUNTER,
        executionLabels
      );
    } else {
      this.metrics.record(
        'workflow_execution_failure',
        1,
        MetricType.COUNTER,
        executionLabels
      );
    }
  }

  /**
   * 记录节点执行
   */
  recordNodeExecution(
    nodeType: string,
    duration: number,
    success: boolean,
    labels?: Record<string, string>
  ): void {
    const nodeLabels = { nodeType, ...labels };

    this.metrics.record(
      'node_execution_duration',
      duration,
      MetricType.HISTOGRAM,
      nodeLabels
    );

    if (success) {
      this.metrics.record(
        'node_execution_success',
        1,
        MetricType.COUNTER,
        nodeLabels
      );
    } else {
      this.metrics.record(
        'node_execution_failure',
        1,
        MetricType.COUNTER,
        nodeLabels
      );
    }
  }

  /**
   * 记录队列指标
   */
  recordQueueMetrics(depth: number, processing: number): void {
    this.metrics.record('queue_depth', depth, MetricType.GAUGE);
    this.metrics.record('queue_processing', processing, MetricType.GAUGE);
  }

  /**
   * 记录内存使用
   */
  recordMemoryUsage(total: number, used: number, free: number): void {
    this.metrics.record('memory_total', total, MetricType.GAUGE);
    this.metrics.record('memory_used', used, MetricType.GAUGE);
    this.metrics.record('memory_free', free, MetricType.GAUGE);
  }

  /**
   * 配置告警阈值
   */
  configureAlerts(
    thresholds: AlertThreshold[],
    onAlert?: (event: PerformanceAlertEvent) => void
  ): void {
    this.alertThresholds = thresholds;
    this.onAlert = onAlert;
  }

  /**
   * 检查告警
   */
  checkAlerts(): void {
    if (!this.onAlert) return;

    for (const threshold of this.alertThresholds) {
      const value = this.metrics.getValue(threshold.metric);
      if (value === null) continue;

      if (threshold.max !== undefined && value > threshold.max) {
        this.onAlert({
          timestamp: Date.now(),
          metric: threshold.metric,
          value,
          threshold,
          message: `${threshold.metric} exceeded maximum threshold: ${value} > ${threshold.max}`,
        });
      }

      if (threshold.min !== undefined && value < threshold.min) {
        this.onAlert({
          timestamp: Date.now(),
          metric: threshold.metric,
          value,
          threshold,
          message: `${threshold.metric} below minimum threshold: ${value} < ${threshold.min}`,
        });
      }
    }
  }

  /**
   * 生成性能报告
   */
  generateReport(): PerformanceReport {
    const durationStats = this.metrics.getHistogramStats(
      'workflow_execution_duration'
    );
    const successCount = this.metrics.getValue('workflow_execution_success') || 0;
    const failureCount = this.metrics.getValue('workflow_execution_failure') || 0;
    const totalExecutions = successCount + failureCount;

    const successRate =
      totalExecutions > 0 ? (successCount / totalExecutions) * 100 : 0;

    return {
      timestamp: Date.now(),
      totalExecutions,
      successfulExecutions: successCount,
      failedExecutions: failureCount,
      successRate,
      avgExecutionTime: durationStats?.avg || 0,
      p50: durationStats?.p50 || 0,
      p95: durationStats?.p95 || 0,
      p99: durationStats?.p99 || 0,
      queueDepth: this.metrics.getValue('queue_depth') || 0,
      memoryUsage: {
        total: this.metrics.getValue('memory_total') || 0,
        used: this.metrics.getValue('memory_used') || 0,
        free: this.metrics.getValue('memory_free') || 0,
      },
    };
  }

  /**
   * 导出 Prometheus 格式
   */
  exportPrometheus(): string {
    return this.metrics.exportPrometheus();
  }

  /**
   * 开始计时器
   */
  startTimer(workflowId: string, labels?: Record<string, string>): Timer {
    return this.metrics.startTimer('workflow_execution_duration', {
      workflowId,
      ...labels,
    });
  }

  /**
   * 重置指标
   */
  reset(): void {
    this.metrics.reset();
  }
}
