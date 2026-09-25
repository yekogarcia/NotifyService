import { BadRequestException } from '@nestjs/common';
import {
  isValidE164,
  validateWhatsAppRecipients,
} from '../../../src/modules/notifications/application/use-cases/create-notification/validate-whatsapp-recipients';
import { RecipientType } from '../../../src/modules/notifications/domain/enums';

describe('validateWhatsAppRecipients', () => {
  it('accepts valid E.164 phone', () => {
    expect(isValidE164('+573001234567')).toBe(true);
    expect(isValidE164('+14155552671')).toBe(true);
  });

  it('rejects phones without + or with wrong length', () => {
    expect(isValidE164('3001234567')).toBe(false);
    expect(isValidE164('+0123456789')).toBe(false);
    expect(isValidE164('+573001234567890123')).toBe(false);
    expect(isValidE164('')).toBe(false);
  });

  it('passes for recipient with valid phone', () => {
    const result = validateWhatsAppRecipients([
      { recipientType: RecipientType.PHONE, phone: '+573001234567' },
    ]);
    expect(result).toHaveLength(1);
  });

  it('throws when phone is missing', () => {
    expect(() =>
      validateWhatsAppRecipients([{ recipientType: RecipientType.INTERNAL_USER, userId: 'u1' }]),
    ).toThrow(BadRequestException);
  });

  it('throws when phone is not E.164', () => {
    expect(() =>
      validateWhatsAppRecipients([
        { recipientType: RecipientType.PHONE, phone: '3001234567' },
      ]),
    ).toThrow(BadRequestException);
  });
});
