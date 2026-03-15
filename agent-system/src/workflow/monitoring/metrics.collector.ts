/**
 * 指标收集器
 *
 * 收集和导出工作流执行指标
 */

export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
  TIMER = 'timer',
}

export interface MetricValue {
  value: number;
  type: MetricType;
  labels?: Record<string, string>;
  timestamp: number;
}

export interface HistogramStats {
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
}

export interface Timer {
  end: () => number;
}

/**
 * 指标收集器
 */
export class MetricsCollector {
  private metrics: Map<string, MetricValue[]> = new Map();
  private gauges: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();

  /**
   * 记录指标
   */
  record(
    name: string,
    value: number,
    type: MetricType,
    labels?: Record<string, string>
  ): void {
    const metric: MetricValue = {
      value,
      type,
      labels,
      timestamp: Date.now(),
    };

    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }
    this.metrics.get(name)!.push(metric);

    // Update specific stores
    switch (type) {
      case MetricType.GAUGE:
        this.gauges.set(name, value);
        break;
      case MetricType.COUNTER:
        this.counters.set(name, (this.counters.get(name) || 0) + value);
        break;
    }

    // Limit stored values for histograms
    if (type === MetricType.HISTOGRAM) {
      const values = this.metrics.get(name)!;
      if (values.length > 10000) {
        values.shift();
      }
    }
  }

  /**
   * 开始计时器
   */
  startTimer(name: string, labels?: Record<string, string>): Timer {
    const start = Date.now();
    return {
      end: () => {
        const duration = Date.now() - start;
        this.record(name, duration, MetricType.TIMER, labels);
        return duration;
      },
    };
  }

  /**
   * 获取指标
   */
  getMetrics(options?: { pattern?: RegExp }): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [name, values] of this.metrics) {
      if (options?.pattern && !options.pattern.test(name)) {
        continue;
      }

      const latest = values[values.length - 1];
      if (!latest) continue;

      switch (latest.type) {
        case MetricType.GAUGE:
          result[name] = this.gauges.get(name) ?? 0;
          break;
        case MetricType.COUNTER:
          result[name] = this.counters.get(name) ?? 0;
          break;
        case MetricType.HISTOGRAM:
        case MetricType.TIMER:
          result[name] = this.calculateHistogramStats(values);
          break;
        default:
          result[name] = latest.value;
      }
    }

    return result;
  }

  /**
   * 获取当前值
   */
  getValue(name: string): number | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    const latest = values[values.length - 1];

    switch (latest.type) {
      case MetricType.GAUGE:
        return this.gauges.get(name) ?? null;
      case MetricType.COUNTER:
        return this.counters.get(name) ?? null;
      default:
        return latest.value;
    }
  }

  /**
   * 获取直方图统计
   */
  getHistogramStats(name: string): HistogramStats | null {
    const values = this.metrics.get(name);
    if (!values || values.length === 0) {
      return null;
    }

    return this.calculateHistogramStats(values);
  }

  /**
   * 获取速率
   */
  getRate(name: string, windowMs: number = 60000): number {
    const values = this.metrics.get(name);
    if (!values || values.length < 2) {
      return 0;
    }

    const now = Date.now();
    const cutoff = now - windowMs;

    const recentValues = values.filter(v => v.timestamp >= cutoff);
    if (recentValues.length < 2) {
      return 0;
    }

    const first = recentValues[0];
    const last = recentValues[recentValues.length - 1];
    const timeDiff = last.timestamp - first.timestamp;

    if (timeDiff === 0) {
      return 0;
    }

    const valueDiff = last.value - first.value;
    return (valueDiff / timeDiff) * 1000; // per second
  }

  /**
   * 导出 Prometheus 格式
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    for (const [name, values] of this.metrics) {
      if (values.length === 0) continue;

      const latest = values[values.length - 1];

      lines.push(`# HELP ${name} ${name} metric`);
      lines.push(`# TYPE ${name} ${latest.type}`);

      switch (latest.type) {
        case MetricType.GAUGE:
          lines.push(`${name}${this.formatLabels(latest.labels)} ${this.gauges.get(name) ?? 0}`);
          break;
        case MetricType.COUNTER:
          lines.push(`${name}${this.formatLabels(latest.labels)} ${this.counters.get(name) ?? 0}`);
          break;
        case MetricType.HISTOGRAM:
        case MetricType.TIMER:
          const stats = this.calculateHistogramStats(values);
          lines.push(`${name}_count ${stats.count}`);
          lines.push(`${name}_sum ${stats.sum}`);
          lines.push(`${name}_avg ${stats.avg}`);
          break;
        default:
          lines.push(`${name}${this.formatLabels(latest.labels)} ${latest.value}`);
      }

      lines.push('');
    }

    return lines.join('\n');
  }

  /**
   * 重置指标
   */
  reset(name?: string): void {
    if (name) {
      this.metrics.delete(name);
      this.gauges.delete(name);
      this.counters.delete(name);
    } else {
      this.metrics.clear();
      this.gauges.clear();
      this.counters.clear();
    }
  }

  /**
   * 计算直方图统计
   */
  private calculateHistogramStats(values: MetricValue[]): HistogramStats {
    const sorted = values.map(v => v.value).sort((a, b) => a - b);
    const count = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);

    return {
      count,
      sum,
      min: sorted[0],
      max: sorted[count - 1],
      avg: sum / count,
      p50: this.percentile(sorted, 0.5),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * 计算百分位
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * 格式化标签
   */
  private formatLabels(labels?: Record<string, string>): string {
    if (!labels || Object.keys(labels).length === 0) {
      return '';
    }

    const pairs = Object.entries(labels).map(([k, v]) => `${k}="${v}"`);
    return `{${pairs.join(',')}}`;
  }
}
