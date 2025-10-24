import { SignJWT, jwtVerify, JWTPayload as JoseJWTPayload } from 'jose';

const SECRET = process.env.JWT_SECRET as string;

if (!SECRET) {
  throw new Error('JWT_SECRET must be defined in environment variables');
}

const secret = new TextEncoder().encode(SECRET);

export interface JWTPayload extends JoseJWTPayload {
  userId: string;
  username: string;
}

export async function createJWT(payload: Omit<JWTPayload, keyof JoseJWTPayload>): Promise<string> {
  const token = await new SignJWT(payload as JoseJWTPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d') // Token expires in 7 days
    .sign(secret);

  return token;
}

export async function verifyJWT(token: string): Promise<JWTPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}
