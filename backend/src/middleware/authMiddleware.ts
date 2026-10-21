import { Request, Response, NextFunction } from 'express';
import { decrypt } from '../lib/auth';

export const authMiddleware = async (req: any, res: Response, next: NextFunction) => {
  const cookieSession = req.cookies.session;
  let session = cookieSession;

  if (cookieSession && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    const origin = req.headers.origin;
    const trustedOrigins = new Set([
      'http://localhost:5173',
      'http://localhost:3000',
      'https://acnerra.vercel.app',
      process.env.FRONTEND_URL,
    ].filter(Boolean));
    const trustedPreview = typeof origin === 'string' && /^https:\/\/acnerra-.*\.vercel\.app$/.test(origin);
    const trustedLocal = process.env.NODE_ENV !== 'production' && typeof origin === 'string' && /^http:\/\/localhost:\d+$/.test(origin);
    if (origin && !trustedOrigins.has(origin) && !trustedPreview && !trustedLocal) {
      return res.status(403).json({ message: 'Request origin is not allowed.' });
    }
  }

  if (!session) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      session = authHeader.substring(7);
    } else if (authHeader) {
      session = authHeader;
    }
  }

  if (!session) {
    return res.status(401).json({ message: "No session found. Please log in." });
  }

  const payload = await decrypt(session);

  if (!payload) {
    return res.status(401).json({ message: "Invalid or expired session. Please log in again." });
  }

  // Attach user info to request
  req.user = payload;
  next();
};
