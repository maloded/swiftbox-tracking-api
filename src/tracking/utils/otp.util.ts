import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';

export function normalizeTrackingNumber(trackingNumber: string): string {
  return trackingNumber.replace(/[\s-]/g, '').toUpperCase();
}

export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function hashOtpCode(code: string, secret: string): string {
  return createHmac('sha256', secret).update(code).digest('hex');
}

export function otpHashesMatch(hashA: string, hashB: string): boolean {
  const bufA = Buffer.from(hashA, 'hex');
  const bufB = Buffer.from(hashB, 'hex');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export function generateVerifyToken(): string {
  return randomBytes(24).toString('hex');
}

export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***';
  return `${local[0]}***@${domain}`;
}

const NUMBER_WORDS: Record<string, string> = {
  zero: '0',
  oh: '0',
  o: '0',
  one: '1',
  two: '2',
  three: '3',
  four: '4',
  five: '5',
  six: '6',
  seven: '7',
  eight: '8',
  nine: '9',
};

// Accepts spoken ("one two three four five six") or typed ("1 2 3 4 5 6" / "123456") codes.
export function normalizeOtpInput(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return tokens
    .map((token) => NUMBER_WORDS[token] ?? token.replace(/\D/g, ''))
    .join('');
}

export function isValidOtpFormat(digits: string): boolean {
  return /^\d{6}$/.test(digits);
}
