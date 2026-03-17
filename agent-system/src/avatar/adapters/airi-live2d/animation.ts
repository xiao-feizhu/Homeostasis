/**
 * Live2D 动画工具
 * 简化版实现，不依赖 Three.js
 * 参考: Airi packages/stage-ui-live2d/src/composables/live2d/animation.ts
 */

import type { InternalModel } from 'pixi-live2d-display';

/**
 * 生成随机注视间隔 (ms)
 */
function randomSaccadeInterval(): number {
  // 随机 2-6 秒
  return 2000 + Math.random() * 4000;
}

/**
 * 线性插值
 */
function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * 生成随机浮点数
 */
function randFloat(min: number, max: number): number {
  return Math.random() * (max - min) + min;
}

/**
 * 空闲时眼睛注视和焦点移动
 * 模拟自然的眼球运动 (saccades)
 */
export function useLive2DIdleEyeFocus() {
  let nextSaccadeAfter = -1;
  let focusTarget: [number, number] | undefined;
  let lastSaccadeAt = -1;

  function update(model: InternalModel, now: number): void {
    if (now >= nextSaccadeAfter || now < lastSaccadeAt) {
      focusTarget = [randFloat(-1, 1), randFloat(-1, 0.7)];
      lastSaccadeAt = now;
      nextSaccadeAfter = now + (randomSaccadeInterval() / 1000);
      model.focusController.focus(focusTarget[0] * 0.5, focusTarget[1] * 0.5, false);
    }

    model.focusController.update(now - lastSaccadeAt);

    const coreModel = model.coreModel as any;
    if (!coreModel || !focusTarget) return;

    // 平滑移动眼球
    const currentX = coreModel.getParameterValueById('ParamEyeBallX') || 0;
    const currentY = coreModel.getParameterValueById('ParamEyeBallY') || 0;

    coreModel.setParameterValueById('ParamEyeBallX', lerp(currentX, focusTarget[0], 0.3));
    coreModel.setParameterValueById('ParamEyeBallY', lerp(currentY, focusTarget[1], 0.3));
  }

  return { update };
}

/**
 * 眨眼动画状态
 */
interface BlinkState {
  phase: 'idle' | 'closing' | 'opening';
  progress: number;
  startLeft: number;
  startRight: number;
  delayMs: number;
}

/**
 * 自动眨眼控制器
 * 参考: Airi motion-manager.ts 中的 useMotionUpdatePluginAutoEyeBlink
 */
export function useAutoBlink() {
  const state: BlinkState = {
    phase: 'idle',
    progress: 0,
    startLeft: 1,
    startRight: 1,
    delayMs: 0,
  };

  const blinkCloseDuration = 200; // ms
  const blinkOpenDuration = 200; // ms
  const minDelay = 3000;
  const maxDelay = 8000;

  const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

  function resetBlinkState() {
    state.phase = 'idle';
    state.progress = 0;
    state.delayMs = minDelay + Math.random() * (maxDelay - minDelay);
  }

  function easeOutQuad(t: number) {
    return 1 - (1 - t) * (1 - t);
  }

  function easeInQuad(t: number) {
    return t * t;
  }

  resetBlinkState();

  /**
   * 更新眨眼状态
   * @param dt - 时间增量 (ms)
   * @param baseLeft - 左眼基础睁开程度 (0-1)
   * @param baseRight - 右眼基础睁开程度 (0-1)
   * @returns 当前眼睛睁开程度
   */
  function update(dt: number, baseLeft: number, baseRight: number): { eyeLOpen: number; eyeROpen: number } {
    // Idle: 等待下一次眨眼
    if (state.phase === 'idle') {
      state.delayMs = Math.max(0, state.delayMs - dt);
      if (state.delayMs === 0) {
        state.phase = 'closing';
        state.progress = 0;
        state.startLeft = baseLeft;
        state.startRight = baseRight;
      }
      return { eyeLOpen: baseLeft, eyeROpen: baseRight };
    }

    // Closing: 闭眼过程
    if (state.phase === 'closing') {
      state.progress = Math.min(1, state.progress + dt / blinkCloseDuration);
      const eased = easeOutQuad(state.progress);
      const eyeLOpen = clamp01(state.startLeft * (1 - eased));
      const eyeROpen = clamp01(state.startRight * (1 - eased));

      if (state.progress >= 1) {
        state.phase = 'opening';
        state.progress = 0;
      }
      return { eyeLOpen, eyeROpen };
    }

    // Opening: 睁眼过程
    state.progress = Math.min(1, state.progress + dt / blinkOpenDuration);
    const eased = easeInQuad(state.progress);
    const eyeLOpen = clamp01(state.startLeft * eased);
    const eyeROpen = clamp01(state.startRight * eased);

    if (state.progress >= 1) {
      resetBlinkState();
    }

    return { eyeLOpen, eyeROpen };
  }

  return { update, reset: resetBlinkState };
}

/**
 * 呼吸动画
 * 模拟自然的呼吸效果
 */
export function useBreathingAnimation() {
  let startTime = Date.now();

  function update(model: any): void {
    const now = Date.now();
    const elapsed = (now - startTime) / 1000; // 秒

    // 呼吸周期约 3-4 秒
    const breathCycle = Math.sin(elapsed * Math.PI * 0.5);

    const coreModel = model?.coreModel;
    if (!coreModel) return;

    // 身体轻微上下移动
    if (coreModel.setParameterValueById) {
      coreModel.setParameterValueById('ParamBodyY', breathCycle * 0.05);
      // 肩膀轻微移动
      coreModel.setParameterValueById('ParamShoulder', breathCycle * 0.03);
    }
  }

  function reset(): void {
    startTime = Date.now();
  }

  return { update, reset };
}
