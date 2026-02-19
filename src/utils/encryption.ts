import crypto from 'crypto';
import { config } from '../config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const SALT_LENGTH = 32;

export class EncryptionService {
  private readonly key: Buffer;

  constructor() {
    const keyBuffer = Buffer.from(config.encryption.key, 'utf-8');
    this.key = crypto.scryptSync(keyBuffer, 'voms-salt', 32);
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);

    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const tag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
  }

  decrypt(ciphertext: string): string {
    const [ivHex, tagHex, encrypted] = ciphertext.split(':');

    if (!ivHex || !tagHex || !encrypted) {
      throw new Error('Invalid ciphertext format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  hash(value: string): string {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  hashWithSalt(value: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    const hash = crypto
      .createHash('sha256')
      .update(value + salt)
      .digest('hex');
    return { hash, salt };
  }

  verifyHash(value: string, hash: string, salt: string): boolean {
    const computedHash = crypto
      .createHash('sha256')
      .update(value + salt)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(computedHash), Buffer.from(hash));
  }

  maskSensitiveData(value: string, visibleChars: number = 4): string {
    if (value.length <= visibleChars) {
      return '*'.repeat(value.length);
    }
    const masked = '*'.repeat(value.length - visibleChars);
    return masked + value.slice(-visibleChars);
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}

export const encryptionService = new EncryptionService();
