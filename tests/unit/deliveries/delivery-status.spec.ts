import { DeliveryStatus } from '../../../src/modules/notifications/domain/enums';
import { isValidTransition } from '../../../src/modules/deliveries/domain/delivery-status';

describe('Delivery Status State Machine', () => {
  it('should allow CREATED → QUEUED', () => {
    expect(isValidTransition(DeliveryStatus.CREATED, DeliveryStatus.QUEUED)).toBe(true);
  });

  it('should allow QUEUED → PROCESSING', () => {
    expect(isValidTransition(DeliveryStatus.QUEUED, DeliveryStatus.PROCESSING)).toBe(true);
  });

  it('should allow PROCESSING → SENT', () => {
    expect(isValidTransition(DeliveryStatus.PROCESSING, DeliveryStatus.SENT)).toBe(true);
  });

  it('should allow PROCESSING → FAILED', () => {
    expect(isValidTransition(DeliveryStatus.PROCESSING, DeliveryStatus.FAILED)).toBe(true);
  });

  it('should allow PROCESSING → RETRYING', () => {
    expect(isValidTransition(DeliveryStatus.PROCESSING, DeliveryStatus.RETRYING)).toBe(true);
  });

  it('should allow RETRYING → PROCESSING', () => {
    expect(isValidTransition(DeliveryStatus.RETRYING, DeliveryStatus.PROCESSING)).toBe(true);
  });

  it('should allow SENT → DELIVERED', () => {
    expect(isValidTransition(DeliveryStatus.SENT, DeliveryStatus.DELIVERED)).toBe(true);
  });

  it('should allow SENT → FAILED (webhook failure after send)', () => {
    expect(isValidTransition(DeliveryStatus.SENT, DeliveryStatus.FAILED)).toBe(true);
  });

  it('should not allow DELIVERED → FAILED', () => {
    expect(isValidTransition(DeliveryStatus.DELIVERED, DeliveryStatus.FAILED)).toBe(false);
  });

  it('should not allow CREATED → DELIVERED', () => {
    expect(isValidTransition(DeliveryStatus.CREATED, DeliveryStatus.DELIVERED)).toBe(false);
  });

  it('should not allow FAILED → SENT', () => {
    expect(isValidTransition(DeliveryStatus.FAILED, DeliveryStatus.SENT)).toBe(false);
  });
});
