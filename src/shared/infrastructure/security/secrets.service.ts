import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const PREFIX = 'enc:v1:';

@Injectable()
export class SecretsService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.SECRETS_MASTER_KEY;
    if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
      throw new Error(
        'SECRETS_MASTER_KEY must be set as a 64-char hex string (32 bytes). Generate with: openssl rand -hex 32',
      );
    }
    this.key = Buffer.from(hex, 'hex');
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plain, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('base64url')}:${tag.toString(
      'base64url',
    )}:${encrypted.toString('base64url')}`;
  }

  decrypt(value: string): string {
    if (!this.isEncrypted(value)) {
      return value;
    }
    const [ivB64, tagB64, dataB64] = value.slice(PREFIX.length).split(':');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted secret format');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64url'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  }

  isEncrypted(value: string): boolean {
    return value.startsWith(PREFIX);
  }
}
