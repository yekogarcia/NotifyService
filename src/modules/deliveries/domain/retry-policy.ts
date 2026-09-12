import { AttemptResult } from '../../notifications/domain/enums';

export interface RetryPolicyConfig {
  maxAttempts: number;
}

export class RetryPolicy {
  private readonly maxAttempts: number;

  constructor(config: RetryPolicyConfig) {
    this.maxAttempts = config.maxAttempts;
  }

  shouldRetry(result: AttemptResult, currentAttemptCount: number): boolean {
    if (result === AttemptResult.PERMANENT_ERROR) return false;
    if (result === AttemptResult.SUCCESS) return false;
    return currentAttemptCount < this.maxAttempts;
  }

  isExhausted(currentAttemptCount: number): boolean {
    return currentAttemptCount >= this.maxAttempts;
  }

  get maxAttemptsValue(): number {
    return this.maxAttempts;
  }
}
