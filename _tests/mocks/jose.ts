// Mock implementation of jose for testing purposes
const SECRET = (process.env.JWT_SECRET || 'test-secret') as string;
const secret = new TextEncoder().encode(SECRET);

// Simple JWT implementation for testing
export interface JWTPayload {
  [key: string]: any;
  iat?: number;
  exp?: number;
}

// Mock SignJWT class
export class SignJWT {
  private payload: JWTPayload;
  private header: any = {};
  private claims: any = {};

  constructor(payload: JWTPayload) {
    this.payload = payload;
  }

  setProtectedHeader(header: any) {
    this.header = header;
    return this;
  }

  setIssuedAt() {
    this.claims.iat = Math.floor(Date.now() / 1000);
    return this;
  }

  setExpirationTime(exp: string) {
    if (exp === '7d') {
      this.claims.exp = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    }
    return this;
  }

  async sign(secret: Uint8Array): Promise<string> {
    const header = btoa(JSON.stringify(this.header));
    const payload = btoa(JSON.stringify({ ...this.payload, ...this.claims }));
    const signature = 'mock-signature';
    return `${header}.${payload}.${signature}`;
  }
}

// Mock jwtVerify function
export async function jwtVerify(token: string, secret: Uint8Array): Promise<{ payload: JWTPayload }> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token');
  }

  try {
    const payload = JSON.parse(atob(parts[1]));
    // Check expiration
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      throw new Error('Token expired');
    }
    return { payload };
  } catch (error) {
    throw new Error('Invalid token');
  }
}

