export class BackoffStrategy {
  private readonly base: number;
  private readonly max: number;

  constructor(base: number = 1000, max: number = 30000) {
    this.base = base;
    this.max = max;
  }

  getDelay(attemptNumber: number): number {
    const delay = this.base * Math.pow(2, attemptNumber - 1);
    return Math.min(delay, this.max);
  }
}
