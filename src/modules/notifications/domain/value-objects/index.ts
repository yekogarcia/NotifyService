import { randomUUID } from 'crypto';

export class NotificationId {
  private constructor(private readonly value: string) {}

  static create(): NotificationId {
    return new NotificationId(randomUUID());
  }

  static fromString(value: string): NotificationId {
    return new NotificationId(value);
  }

  toString(): string {
    return this.value;
  }
}

export class TenantId {
  private constructor(private readonly value: string) {}

  static fromString(value: string): TenantId {
    return new TenantId(value);
  }

  toString(): string {
    return this.value;
  }
}

export class IdempotencyKey {
  private constructor(private readonly value: string) {}

  static fromString(value: string): IdempotencyKey {
    if (!value || value.trim().length === 0) {
      throw new Error('IdempotencyKey cannot be empty');
    }
    return new IdempotencyKey(value);
  }

  toString(): string {
    return this.value;
  }
}

export class CorrelationId {
  private constructor(private readonly value: string) {}

  static create(): CorrelationId {
    return new CorrelationId(randomUUID());
  }

  static fromString(value: string): CorrelationId {
    return new CorrelationId(value);
  }

  toString(): string {
    return this.value;
  }
}

export class SourceSystem {
  private constructor(private readonly value: string) {}

  static fromString(value: string): SourceSystem {
    if (!value || value.trim().length === 0) {
      throw new Error('SourceSystem cannot be empty');
    }
    return new SourceSystem(value);
  }

  toString(): string {
    return this.value;
  }
}

export class EventType {
  private constructor(private readonly value: string) {}

  static fromString(value: string): EventType {
    if (!value || value.trim().length === 0) {
      throw new Error('EventType cannot be empty');
    }
    return new EventType(value);
  }

  toString(): string {
    return this.value;
  }
}

export class TemplateCode {
  private constructor(private readonly value: string) {}

  static fromString(value: string): TemplateCode {
    if (!value || value.trim().length === 0) {
      throw new Error('TemplateCode cannot be empty');
    }
    return new TemplateCode(value);
  }

  toString(): string {
    return this.value;
  }
}
