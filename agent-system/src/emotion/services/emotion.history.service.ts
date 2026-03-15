/**
 * 情感历史记录服务
 * 管理会话的情感变化历史
 */

import { v4 as uuidv4 } from 'uuid';
import {
  EmotionHistory,
  EmotionSnapshot,
  EmotionMetrics,
  EmotionState,
  PeakEmotion,
} from '../entities/emotion.entity';

/** 记录快照请求 */
export interface RecordSnapshotRequest {
  sessionId: string;
  userId: string;
  metrics: EmotionMetrics;
  state: EmotionState;
  triggerText: string;
}

export class EmotionHistoryService {
  private histories: Map<string, EmotionHistory> = new Map();

  /**
   * 记录情感快照
   */
  async recordSnapshot(request: RecordSnapshotRequest): Promise<EmotionHistory> {
    const { sessionId, userId, metrics, state, triggerText } = request;

    let history = this.histories.get(sessionId);

    const snapshot: EmotionSnapshot = {
      timestamp: new Date(),
      metrics,
      state,
      triggerText,
    };

    if (!history) {
      // 创建新历史记录
      history = {
        historyId: uuidv4(),
        sessionId,
        userId,
        timeline: [snapshot],
        overallTrend: 'stable',
        peakEmotions: this.extractPeakEmotions([snapshot]),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      // 追加到现有历史
      history.timeline.push(snapshot);
      history.updatedAt = new Date();

      // 更新峰值情绪
      history.peakEmotions = this.extractPeakEmotions(history.timeline);

      // 更新整体趋势
      history.overallTrend = this.calculateOverallTrend(history.timeline);
    }

    this.histories.set(sessionId, history);
    return history;
  }

  /**
   * 获取历史记录
   */
  async getHistory(sessionId: string): Promise<EmotionHistory | null> {
    return this.histories.get(sessionId) || null;
  }

  /**
   * 计算情感趋势
   */
  async calculateTrend(sessionId: string): Promise<'improving' | 'stable' | 'declining'> {
    const history = this.histories.get(sessionId);
    if (!history || history.timeline.length < 3) {
      return 'stable';
    }

    return this.calculateOverallTrend(history.timeline);
  }

  /**
   * 获取峰值情绪
   */
  async getPeakEmotions(sessionId: string): Promise<PeakEmotion[]> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return [];
    }

    return history.peakEmotions;
  }

  /**
   * 获取最近的情感快照
   */
  async getRecentSnapshots(sessionId: string, count: number = 5): Promise<EmotionSnapshot[]> {
    const history = this.histories.get(sessionId);
    if (!history) {
      return [];
    }

    return history.timeline.slice(-count);
  }

  /**
   * 计算整体趋势
   */
  private calculateOverallTrend(timeline: EmotionSnapshot[]): 'improving' | 'stable' | 'declining' {
    if (timeline.length < 3) {
      return 'stable';
    }

    // 计算前1/3和后1/3的平均满意度
    const third = Math.floor(timeline.length / 3);
    const firstPart = timeline.slice(0, third);
    const lastPart = timeline.slice(-third);

    const firstAvg = this.calculateAverageSatisfaction(firstPart);
    const lastAvg = this.calculateAverageSatisfaction(lastPart);

    const diff = lastAvg - firstAvg;

    if (diff > 10) {
      return 'improving';
    } else if (diff < -10) {
      return 'declining';
    } else {
      return 'stable';
    }
  }

  /**
   * 计算平均满意度
   */
  private calculateAverageSatisfaction(snapshots: EmotionSnapshot[]): number {
    if (snapshots.length === 0) return 50;

    const sum = snapshots.reduce((acc, s) => acc + s.metrics.satisfaction, 0);
    return sum / snapshots.length;
  }

  /**
   * 提取峰值情绪
   */
  private extractPeakEmotions(timeline: EmotionSnapshot[]): PeakEmotion[] {
    const peaks: PeakEmotion[] = [];

    // 定义峰值阈值
    const THRESHOLDS: Record<EmotionState, number> = {
      [EmotionState.CRITICAL]: 70,
      [EmotionState.NEGATIVE]: 65,
      [EmotionState.NEUTRAL]: 0, // 中性不记录峰值
      [EmotionState.POSITIVE]: 75,
    };

    for (const snapshot of timeline) {
      const threshold = THRESHOLDS[snapshot.state];

      // 计算该状态的强度
      let intensity = 0;
      switch (snapshot.state) {
        case EmotionState.CRITICAL:
          intensity = Math.max(snapshot.metrics.frustration, snapshot.metrics.urgency);
          break;
        case EmotionState.NEGATIVE:
          intensity = Math.max(snapshot.metrics.frustration, 100 - snapshot.metrics.satisfaction);
          break;
        case EmotionState.POSITIVE:
          intensity = snapshot.metrics.satisfaction;
          break;
      }

      if (intensity >= threshold && snapshot.state !== EmotionState.NEUTRAL) {
        peaks.push({
          state: snapshot.state,
          intensity,
          timestamp: snapshot.timestamp,
          triggerText: snapshot.triggerText,
        });
      }
    }

    // 只保留最强的3个峰值
    return peaks
      .sort((a, b) => b.intensity - a.intensity)
      .slice(0, 3);
  }

  /**
   * 清除过期历史（可选）
   */
  async cleanExpiredHistory(retentionHours: number): Promise<number> {
    const now = new Date().getTime();
    const retentionMs = retentionHours * 60 * 60 * 1000;

    let deletedCount = 0;
    for (const [sessionId, history] of this.histories.entries()) {
      const ageMs = now - history.updatedAt.getTime();
      if (ageMs > retentionMs) {
        this.histories.delete(sessionId);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * 获取所有会话的历史概览
   */
  async getAllHistoriesOverview(): Promise<Array<{
    sessionId: string;
    userId: string;
    snapshotCount: number;
    lastUpdated: Date;
    currentState: EmotionState;
  }>> {
    return Array.from(this.histories.values()).map(history => ({
      sessionId: history.sessionId,
      userId: history.userId,
      snapshotCount: history.timeline.length,
      lastUpdated: history.updatedAt,
      currentState: history.timeline[history.timeline.length - 1]?.state || EmotionState.NEUTRAL,
    }));
  }
}
