import { validateRecipients } from '../../../src/modules/notifications/application/use-cases/create-notification/validate-recipients';
import { RecipientType } from '../../../src/modules/notifications/domain/enums';
import { BadRequestException } from '@nestjs/common';

describe('validateRecipients', () => {
  it('should pass for valid INTERNAL_USER with userId', () => {
    const result = validateRecipients([
      { recipientType: RecipientType.INTERNAL_USER, userId: 'user_123' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should pass for valid EMAIL with email', () => {
    const result = validateRecipients([
      { recipientType: RecipientType.EMAIL, email: 'test@example.com' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should pass for valid PHONE with phone', () => {
    const result = validateRecipients([
      { recipientType: RecipientType.PHONE, phone: '+34600000000' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('should throw for INTERNAL_USER without userId', () => {
    expect(() =>
      validateRecipients([
        { recipientType: RecipientType.INTERNAL_USER },
      ]),
    ).toThrow(BadRequestException);
  });

  it('should throw for EMAIL without email', () => {
    expect(() =>
      validateRecipients([{ recipientType: RecipientType.EMAIL }]),
    ).toThrow(BadRequestException);
  });

  it('should throw for PHONE without phone', () => {
    expect(() =>
      validateRecipients([{ recipientType: RecipientType.PHONE }]),
    ).toThrow(BadRequestException);
  });

  it('should validate multiple recipients', () => {
    const result = validateRecipients([
      { recipientType: RecipientType.INTERNAL_USER, userId: 'user_1' },
      { recipientType: RecipientType.EMAIL, email: 'a@b.com' },
      { recipientType: RecipientType.PHONE, phone: '+34600000000' },
    ]);
    expect(result).toHaveLength(3);
  });
});
