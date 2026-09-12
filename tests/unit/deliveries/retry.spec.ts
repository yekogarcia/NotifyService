import { RetryPolicy } from '../../../src/modules/deliveries/domain/retry-policy';
import { BackoffStrategy } from '../../../src/modules/deliveries/domain/backoff-strategy';
import { ErrorClassifier } from '../../../src/modules/deliveries/domain/error-classifier';
import { AttemptResult } from '../../../src/modules/notifications/domain/enums';

describe('RetryPolicy', () => {
  const policy = new RetryPolicy({ maxAttempts: 3 });

  it('should retry transient errors under max attempts', () => {
    expect(policy.shouldRetry(AttemptResult.TRANSIENT_ERROR, 1)).toBe(true);
    expect(policy.shouldRetry(AttemptResult.TRANSIENT_ERROR, 2)).toBe(true);
  });

  it('should not retry when max attempts reached', () => {
    expect(policy.shouldRetry(AttemptResult.TRANSIENT_ERROR, 3)).toBe(false);
  });

  it('should not retry permanent errors', () => {
    expect(policy.shouldRetry(AttemptResult.PERMANENT_ERROR, 1)).toBe(false);
  });

  it('should not retry success', () => {
    expect(policy.shouldRetry(AttemptResult.SUCCESS, 1)).toBe(false);
  });

  it('should detect exhaustion', () => {
    expect(policy.isExhausted(3)).toBe(true);
    expect(policy.isExhausted(2)).toBe(false);
  });
});

describe('BackoffStrategy', () => {
  const backoff = new BackoffStrategy(1000, 30000);

  it('should calculate exponential delays', () => {
    expect(backoff.getDelay(1)).toBe(1000);
    expect(backoff.getDelay(2)).toBe(2000);
    expect(backoff.getDelay(3)).toBe(4000);
    expect(backoff.getDelay(4)).toBe(8000);
  });

  it('should cap at max delay', () => {
    expect(backoff.getDelay(10)).toBe(30000);
  });
});

describe('ErrorClassifier', () => {
  const classifier = new ErrorClassifier();

  it('should classify 500 as transient', () => {
    const result = classifier.classify(500);
    expect(result.result).toBe(AttemptResult.TRANSIENT_ERROR);
  });

  it('should classify 400 as permanent', () => {
    const result = classifier.classify(400);
    expect(result.result).toBe(AttemptResult.PERMANENT_ERROR);
  });

  it('should classify 408 as transient', () => {
    const result = classifier.classify(408);
    expect(result.result).toBe(AttemptResult.TRANSIENT_ERROR);
  });

  it('should classify 200 as success', () => {
    const result = classifier.classify(200);
    expect(result.result).toBe(AttemptResult.SUCCESS);
  });

  it('should classify timeout as transient', () => {
    const result = classifier.classifyTimeout();
    expect(result.result).toBe(AttemptResult.TRANSIENT_ERROR);
  });

  it('should classify bounce as permanent', () => {
    const result = classifier.classifyBounce();
    expect(result.result).toBe(AttemptResult.PERMANENT_ERROR);
  });
});
