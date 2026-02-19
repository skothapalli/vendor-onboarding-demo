import crypto from 'crypto';

export interface HashChainEntry {
  id: string;
  data: string;
  timestamp: Date;
  previousHash: string | null;
  currentHash: string;
}

export class HashChainService {
  private lastHash: string | null = null;

  computeHash(data: string, previousHash: string | null, timestamp: Date): string {
    const content = JSON.stringify({
      data,
      previousHash: previousHash || '',
      timestamp: timestamp.toISOString(),
    });
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  createEntry(id: string, data: unknown, previousHash: string | null): HashChainEntry {
    const timestamp = new Date();
    const dataString = JSON.stringify(data);
    const currentHash = this.computeHash(dataString, previousHash, timestamp);

    this.lastHash = currentHash;

    return {
      id,
      data: dataString,
      timestamp,
      previousHash,
      currentHash,
    };
  }

  verifyEntry(entry: HashChainEntry): boolean {
    const computedHash = this.computeHash(entry.data, entry.previousHash, entry.timestamp);
    return computedHash === entry.currentHash;
  }

  verifyChain(entries: HashChainEntry[]): { valid: boolean; brokenAt?: number } {
    if (entries.length === 0) {
      return { valid: true };
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      if (!this.verifyEntry(entry)) {
        return { valid: false, brokenAt: i };
      }

      if (i > 0 && entry.previousHash !== entries[i - 1].currentHash) {
        return { valid: false, brokenAt: i };
      }
    }

    return { valid: true };
  }

  getLastHash(): string | null {
    return this.lastHash;
  }

  setLastHash(hash: string | null): void {
    this.lastHash = hash;
  }
}

export const hashChainService = new HashChainService();
