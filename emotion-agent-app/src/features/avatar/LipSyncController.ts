import type { PhonemeData, Phoneme, LipShape } from '@/shared/types';
import { SmoothParam } from '@/shared/utils/SmoothParam';

const phonemeToLipShape: Record<Phoneme, LipShape> = {
  'a': { open: 1.0, wide: 0.8 },
  'i': { open: 0.2, wide: 1.0 },
  'u': { open: 0.2, wide: 0.3 },
  'e': { open: 0.5, wide: 0.8 },
  'o': { open: 0.6, wide: 0.6 },
  'n': { open: 0.1, wide: 0.5 },
  'sil': { open: 0, wide: 0.5 },
};

const visemeToPhonemeMap: Record<number, Phoneme> = {
  0: 'sil', 1: 'a', 2: 'a', 3: 'i', 4: 'u', 5: 'e', 6: 'o',
  7: 'u', 8: 'n', 9: 'n', 10: 'n', 11: 'i', 12: 'n',
  13: 'i', 14: 'n', 15: 'a', 16: 'i',
};

export class LipSyncController {
  private phonemes: PhonemeData[] = [];
  private startTime: number = 0;
  private smoothOpen = new SmoothParam(0.05);
  private smoothWide = new SmoothParam(0.05);
  private setParam: (param: string, value: number) => void;

  constructor(setParamCallback: (param: string, value: number) => void) {
    this.setParam = setParamCallback;
  }

  setPhonemeData(data: PhonemeData[], startTime: number): void {
    this.phonemes = data;
    this.startTime = startTime;
  }

  getPhonemeCount(): number {
    return this.phonemes.length;
  }

  visemeToPhoneme(visemeId: number): Phoneme {
    return visemeToPhonemeMap[visemeId] || 'sil';
  }

  getLipShapeForPhoneme(phoneme: Phoneme): LipShape {
    return phonemeToLipShape[phoneme] || { open: 0, wide: 0.5 };
  }

  update(currentTime: number): void {
    const elapsed = currentTime - this.startTime;
    const current = this.phonemes.find(
      p => elapsed >= p.offset && elapsed < p.offset + p.duration
    );

    let targetOpen = 0;
    let targetWide = 0.5;

    if (current && current.phoneme !== 'sil') {
      const shape = this.getLipShapeForPhoneme(current.phoneme);
      targetOpen = shape.open;
      targetWide = shape.wide;
      const jitter = Math.sin(elapsed * 0.02) * 0.05;
      targetOpen += jitter;
    }

    this.smoothOpen.setTarget(targetOpen);
    this.smoothWide.setTarget(targetWide);

    const smoothedOpen = this.smoothOpen.update(16);
    const smoothedWide = this.smoothWide.update(16);

    this.setParam('ParamMouthOpenY', Math.max(0, Math.min(1, smoothedOpen)));
    this.setParam('ParamMouthForm', (smoothedWide - 0.5) * 2);
  }

  reset(): void {
    this.smoothOpen.reset(0);
    this.smoothWide.reset(0.5);
    this.setParam('ParamMouthOpenY', 0);
    this.setParam('ParamMouthForm', 0);
    this.phonemes = [];
  }

  isActive(): boolean {
    return this.phonemes.length > 0;
  }
}
