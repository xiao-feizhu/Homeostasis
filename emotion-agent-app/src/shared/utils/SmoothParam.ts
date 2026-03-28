/**
 * Smooth parameter interpolation using exponential easing
 * For smooth transitions between animation values
 */
export class SmoothParam {
  private current: number = 0;
  private target: number = 0;
  private smoothFactor: number;

  constructor(smoothFactor: number = 0.1) {
    this.smoothFactor = smoothFactor;
  }

  setTarget(value: number): void {
    this.target = Math.max(0, Math.min(1, value));
  }

  getTarget(): number {
    return this.target;
  }

  getCurrent(): number {
    return this.current;
  }

  update(deltaTime: number): number {
    const dt = deltaTime / 1000;
    const t = 1 - Math.exp(-dt / this.smoothFactor);
    this.current += (this.target - this.current) * t;
    return this.current;
  }

  reset(value: number): void {
    this.current = value;
    this.target = value;
  }
}
