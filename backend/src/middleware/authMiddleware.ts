import { Request, Response, NextFunction } from 'express';
import { decrypt } from '../lib/auth';

export const authMiddleware = async (req: any, res: Response, next: NextFunction) => {
  const session = req.cookies.session;

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
