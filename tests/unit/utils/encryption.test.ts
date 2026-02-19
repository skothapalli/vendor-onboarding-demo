import { EncryptionService } from '../../../src/utils/encryption';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;

  beforeEach(() => {
    encryptionService = new EncryptionService();
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt a string successfully', () => {
      const plaintext = 'sensitive-data-123';

      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(encrypted).not.toBe(plaintext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plaintext = 'test-data';

      const encrypted1 = encryptionService.encrypt(plaintext);
      const encrypted2 = encryptionService.encrypt(plaintext);

      expect(encrypted1).not.toBe(encrypted2);
    });

    it('should handle empty strings', () => {
      const plaintext = '';

      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 世界 🌍';

      const encrypted = encryptionService.encrypt(plaintext);
      const decrypted = encryptionService.decrypt(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it('should throw error for invalid ciphertext', () => {
      expect(() => encryptionService.decrypt('invalid')).toThrow();
    });
  });

  describe('hash', () => {
    it('should produce consistent hash for same input', () => {
      const value = 'test-value';

      const hash1 = encryptionService.hash(value);
      const hash2 = encryptionService.hash(value);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different input', () => {
      const hash1 = encryptionService.hash('value1');
      const hash2 = encryptionService.hash('value2');

      expect(hash1).not.toBe(hash2);
    });
  });

  describe('hashWithSalt', () => {
    it('should produce different hash for same input with different salt', () => {
      const value = 'test-value';

      const result1 = encryptionService.hashWithSalt(value);
      const result2 = encryptionService.hashWithSalt(value);

      expect(result1.hash).not.toBe(result2.hash);
      expect(result1.salt).not.toBe(result2.salt);
    });

    it('should verify hash correctly', () => {
      const value = 'test-value';
      const { hash, salt } = encryptionService.hashWithSalt(value);

      expect(encryptionService.verifyHash(value, hash, salt)).toBe(true);
      expect(encryptionService.verifyHash('wrong-value', hash, salt)).toBe(false);
    });
  });

  describe('maskSensitiveData', () => {
    it('should mask data keeping last 4 characters', () => {
      expect(encryptionService.maskSensitiveData('1234567890')).toBe('******7890');
    });

    it('should mask all characters for short strings', () => {
      expect(encryptionService.maskSensitiveData('123')).toBe('***');
    });

    it('should handle custom visible characters', () => {
      expect(encryptionService.maskSensitiveData('1234567890', 2)).toBe('********90');
    });
  });

  describe('generateSecureToken', () => {
    it('should generate token of specified length', () => {
      const token = encryptionService.generateSecureToken(16);
      expect(token.length).toBe(32); // Hex encoding doubles the length
    });

    it('should generate unique tokens', () => {
      const token1 = encryptionService.generateSecureToken();
      const token2 = encryptionService.generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });
});
