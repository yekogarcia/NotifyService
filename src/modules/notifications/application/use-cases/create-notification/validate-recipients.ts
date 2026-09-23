import { BadRequestException } from '@nestjs/common';
import { RecipientDTO } from '../../dto/create-notification.dto';
import { RecipientType } from '../../../domain/enums';

export function validateRecipients(recipients: RecipientDTO[]): RecipientDTO[] {
  for (const r of recipients) {
    if (
      r.recipientType === RecipientType.INTERNAL_USER ||
      r.recipientType === RecipientType.EXTERNAL_USER
    ) {
      if (!r.userId) {
        throw new BadRequestException(
          `userId is required for recipientType ${r.recipientType}`,
        );
      }
    }
    if (r.recipientType === RecipientType.EMAIL) {
      if (!r.email) {
        throw new BadRequestException(
          'email is required for recipientType EMAIL',
        );
      }
    }
    if (r.recipientType === RecipientType.PHONE) {
      if (!r.phone) {
        throw new BadRequestException(
          'phone is required for recipientType PHONE',
        );
      }
    }
  }
  return recipients;
}
