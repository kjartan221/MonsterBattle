// Auth router: login (verifies signed proof, upserts user, mints session cookie),
// logout, check-session, and the two public server-key lookups.
// Ported verbatim from src/app/api/{login,logout,check-session,server-public-key,server-identity-key}/route.ts.

import { Router, type Request, type Response } from 'express';
import { connectToMongo } from '@server/lib/mongodb';
import { createJWT, verifyJWT } from '@server/lib/jwt';
import { getServerWallet, getServerPublicKey, getServerIdentityPublicKey } from '@server/lib/serverWallet';
import { authServer } from '@shared/authProof';
import { consumeNonce } from '@server/lib/authNonceStore';

export const authRouter = Router();

// Same cookie name/options the Next side sets on NextResponse.cookies — requireSession reads req.cookies.verified.
const SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 60 * 60 * 24 * 7 * 1000, // 7 days, in ms (Express maxAge is ms; Next's was seconds)
  path: '/',
};

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const { userId, username, proof } = body;

    // Validate input
    if (!userId || !username) {
      res.status(400).json({ error: 'userId and username are required' });
      return;
    }

    if (!proof) {
      res.status(400).json({ error: 'proof is required' });
      return;
    }

    // Signed-proof check — expiry-bound, single-use proof of key ownership
    const serverWallet = await getServerWallet();
    const proofResult = await authServer.verifyAuthProof(serverWallet, proof, 'login', { consumeNonce });
    if (!proofResult.valid || proofResult.identityKey !== userId) {
      res.status(401).json({ error: proofResult.error ?? 'Proof identity mismatch' });
      return;
    }

    // Connect to MongoDB and get collections
    const { usersCollection } = await connectToMongo();

    // Check if user exists
    let user = await usersCollection.findOne({ userId });

    if (!user) {
      // Create new user (userId IS the public key)
      const newUser = {
        userId,
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await usersCollection.insertOne(newUser);

      // Refetch user to get complete document with _id
      user = await usersCollection.findOne({ userId });

    } else {
      // Update username if it changed
      if (user.username !== username) {
        await usersCollection.updateOne(
          { userId },
          {
            $set: {
              username,
              updatedAt: new Date()
            }
          }
        );
      }
    }

    // At this point user should always exist, but TypeScript doesn't know that
    if (!user) {
      res.status(500).json({ error: 'Failed to create or retrieve user' });
      return;
    }

    // Create JWT token
    const token = await createJWT({
      userId: user.userId,
      username: username,
    });

    // Set cookie with JWT token
    res.cookie('verified', token, SESSION_COOKIE_OPTIONS);

    res.json({
      success: true,
      user: {
        userId: user.userId,
        username: username,
      },
    });
    return;
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

authRouter.post('/logout', async (_req: Request, res: Response) => {
  try {
    // Delete the verified cookie
    res.clearCookie('verified', { path: '/' });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
    return;
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
});

// GET /api/check-session — quick session validity check. Returns { authenticated: true/false }.
authRouter.get('/check-session', async (req: Request, res: Response) => {
  try {
    const token = req.cookies?.verified as string | undefined;

    if (!token) {
      res.json({ authenticated: false });
      return;
    }

    // Verify the JWT is valid
    const payload = await verifyJWT(token);

    if (!payload || !payload.userId) {
      res.json({ authenticated: false });
      return;
    }

    res.json({ authenticated: true, userId: payload.userId });
    return;
  } catch (error) {
    console.error('Session check error:', error);
    res.json({ authenticated: false });
    return;
  }
});

// GET /api/server-public-key — server wallet's DERIVED public key (protocolID/keyID/counterparty). Public.
authRouter.get('/server-public-key', async (_req: Request, res: Response) => {
  try {
    const serverPublicKey = await getServerPublicKey();

    res.json({ publicKey: serverPublicKey });
    return;
  } catch (error) {
    console.error('Error getting server public key:', error);
    res.status(500).json({ error: 'Failed to get server public key' });
    return;
  }
});

// GET /api/server-identity-key — server wallet's IDENTITY public key (root key, not derived). Public.
authRouter.get('/server-identity-key', async (_req: Request, res: Response) => {
  try {
    const identityPublicKey = await getServerIdentityPublicKey();

    res.json({ publicKey: identityPublicKey });
    return;
  } catch (error) {
    console.error('Error getting server identity key:', error);
    res.status(500).json({ error: 'Failed to get server identity key' });
    return;
  }
});
