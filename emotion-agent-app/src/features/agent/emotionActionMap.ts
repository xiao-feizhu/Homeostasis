import type { EmotionType, ActionConfig, ActionStrategy } from '@/shared/types';

export const emotionActionMap: Record<EmotionType, ActionConfig> = {
  happy: {
    expression: 'HEART_EYES',
    head: { tilt: -10, nodSpeed: 1.5 },
    gesture: { name: 'CLAP', trigger: 'emphasis' },
    body: { lean: 0.2, bounce: true }
  },
  sad: {
    expression: 'TEARY_EYES',
    head: { tilt: 10, droop: true },
    gesture: { name: 'SELF_HUG', loop: true },
    body: { lean: -0.1, sink: true }
  },
  excited: {
    expression: 'STAR_EYES',
    head: { shake: 'rapid' },
    gesture: { name: 'WAVE', hold: 1000 },
    body: { jump: true, lean: 0.3 }
  },
  thinking: {
    expression: 'NEUTRAL',
    head: { tilt: 15, slowSway: true },
    gesture: { name: 'CHIN_RUB', loop: true },
    body: { lean: 0.1 }
  },
  angry: {
    expression: 'BLACK_FACE',
    head: { shake: 'emphatic' },
    gesture: { name: 'POINT', trigger: 'keyword' },
    body: { lean: 0.4, tense: true }
  },
  playful: {
    expression: 'CAT_MOUTH',
    head: { tilt: -15, slowSway: true },
    gesture: { name: 'PEACE_SIGN', trigger: 'random' },
    body: { lean: 0.15, bounce: { freq: 1.5 } }
  },
  neutral: {
    expression: 'NEUTRAL',
    head: { nodSpeed: 0.5 },
    body: { lean: 0 }
  }
};

export function determineComplexity(
  text: string,
  emotionIntensity: number
): ActionStrategy {
  const wordCount = text.length;
  const hasPunctuation = /[！。？]/.test(text);
  const hasEmphasis = /(真的|特别|非常|超级)/.test(text);

  if (emotionIntensity > 0.8) return 'dramatic';
  if (wordCount < 5 && !hasPunctuation) return 'minimal';
  if (hasEmphasis || (wordCount > 15 && hasPunctuation)) return 'expressive';
  return 'gesture_assisted';
}

export function getIntensityLevel(intensity: number): 'calm' | 'gentle' | 'active' | 'intense' {
  if (intensity < 0.3) return 'calm';
  if (intensity < 0.6) return 'gentle';
  if (intensity < 0.8) return 'active';
  return 'intense';
}
