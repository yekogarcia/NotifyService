import { DeliveryStatus } from '../../notifications/domain/enums';

const VALID_TRANSITIONS: ReadonlyMap<
  DeliveryStatus,
  ReadonlySet<DeliveryStatus>
> = new Map<DeliveryStatus, ReadonlySet<DeliveryStatus>>([
  [DeliveryStatus.CREATED, new Set([DeliveryStatus.QUEUED])],
  [DeliveryStatus.QUEUED, new Set([DeliveryStatus.PROCESSING])],
  [
    DeliveryStatus.PROCESSING,
    new Set([
      DeliveryStatus.SENT,
      DeliveryStatus.RETRYING,
      DeliveryStatus.FAILED,
    ]),
  ],
  [DeliveryStatus.RETRYING, new Set([DeliveryStatus.PROCESSING])],
  [
    DeliveryStatus.SENT,
    new Set([DeliveryStatus.DELIVERED, DeliveryStatus.FAILED]),
  ],
  [DeliveryStatus.DELIVERED, new Set()],
  [DeliveryStatus.FAILED, new Set()],
]);

export function isValidTransition(
  from: DeliveryStatus,
  to: DeliveryStatus,
): boolean {
  const allowed = VALID_TRANSITIONS.get(from);
  if (!allowed) {
    return false;
  }
  return allowed.has(to);
}
