import type {
  ExpressionType,
  GestureType,
  HeadPose,
  BodyPosture,
  EmotionType,
} from '@/shared/types';
import { SmoothParam } from '@/shared/utils/SmoothParam';
import { emotionActionMap } from '@/features/agent/emotionActionMap';

interface Live2DModel {
  setExpression(expressionId: string): void;
  setParamValue(paramId: string, value: number): void;
  getParamValue(paramId: string): number;
}

export class AvatarService {
  private model: Live2DModel | null = null;
  private currentExpression: ExpressionType = 'NEUTRAL';
  private headTilt = new SmoothParam(0.1);
  private headTurn = new SmoothParam(0.1);
  private bodyLean = new SmoothParam(0.15);
  private bodyShift = new SmoothParam(0.15);

  setModel(model: Live2DModel): void {
    this.model = model;
  }

  getCurrentExpression(): ExpressionType {
    return this.currentExpression;
  }

  setExpression(expression: ExpressionType): void {
    if (!this.model) return;
    this.currentExpression = expression;
    this.model.setExpression(expression);
  }

  setHeadPose(params: HeadPose): void {
    this.headTilt.setTarget(params.tilt / 30);
    this.headTurn.setTarget(params.turn / 45);
  }

  setBodyPosture(params: BodyPosture): void {
    this.bodyLean.setTarget(params.lean);
    this.bodyShift.setTarget(params.shift);
  }

  playGesture(gesture: GestureType): void {
    if (!this.model) return;

    const gestureMap: Record<GestureType, Record<string, number>> = {
      'WAVE': { 'ParamArmLA': 1, 'ParamHandL': 0.5 },
      'POINT': { 'ParamArmRA': 0.8, 'ParamHandR': 1 },
      'CHIN_RUB': { 'ParamArmRA': 0.5, 'ParamHandR': 0.3 },
      'CLAP': { 'ParamArmLA': 0.8, 'ParamArmRA': 0.8 },
      'SHRUG': { 'ParamShoulderL': 1, 'ParamShoulderR': 1 },
      'SELF_HUG': { 'ParamArmLA': 0.6, 'ParamArmRA': 0.6 },
      'PEACE_SIGN': { 'ParamArmRA': 0.7, 'ParamHandR': 0.8 },
      'THUMBS_UP': { 'ParamArmRA': 0.9, 'ParamHandR': 1 },
    };

    const params = gestureMap[gesture];
    if (params) {
      Object.entries(params).forEach(([param, value]) => {
        this.model!.setParamValue(param, value);
      });
    }
  }

  applyEmotionAction(emotion: EmotionType, _intensity: number): void {
    const config = emotionActionMap[emotion];
    if (!config) return;

    this.setExpression(config.expression);

    if (config.head) {
      this.setHeadPose({
        tilt: config.head.tilt || 0,
        turn: 0,
        nodSpeed: config.head.nodSpeed,
      });
    }

    if (config.gesture) {
      this.playGesture(config.gesture.name);
    }

    if (config.body) {
      this.setBodyPosture({
        lean: config.body.lean || 0,
        shift: 0,
      });
    }
  }

  update(deltaTime: number): void {
    if (!this.model) return;

    const tilt = this.headTilt.update(deltaTime) * 30;
    const turn = this.headTurn.update(deltaTime) * 45;
    const lean = this.bodyLean.update(deltaTime);
    const shift = this.bodyShift.update(deltaTime);

    this.model.setParamValue('ParamAngleX', turn);
    this.model.setParamValue('ParamAngleY', tilt);
    this.model.setParamValue('ParamBodyAngleX', shift * 10);
    this.model.setParamValue('ParamBodyAngleY', lean * 10);
  }

  reset(): void {
    this.setExpression('NEUTRAL');
    this.setHeadPose({ tilt: 0, turn: 0 });
    this.setBodyPosture({ lean: 0, shift: 0 });
  }
}
