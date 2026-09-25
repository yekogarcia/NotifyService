import { BadRequestException } from '@nestjs/common';
import { RecipientDTO } from '../../dto/create-notification.dto';

const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export function isValidE164(phone: string): boolean {
  return E164_REGEX.test(phone);
}

export function validateWhatsAppRecipients(
  recipients: RecipientDTO[],
): RecipientDTO[] {
  for (const r of recipients) {
    if (!r.phone) {
      throw new BadRequestException(
        'phone is required for WHATSAPP channel (E.164 format, e.g. +573001234567)',
      );
    }
    if (!isValidE164(r.phone)) {
      throw new BadRequestException(
        `Invalid phone "${r.phone}" for WHATSAPP channel: must be E.164 format (e.g. +573001234567)`,
      );
    }
  }
  return recipients;
}
