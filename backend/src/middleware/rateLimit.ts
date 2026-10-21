import { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export const rateLimit = (name: string, max: number, windowMs: number) =>
  (req: Request & { user?: { userId?: string } }, res: Response, next: NextFunction) => {
    const now = Date.now();
    const identity = req.user?.userId || req.ip || 'unknown';
    const key = `${name}:${identity}`;
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    current.count += 1;
    if (current.count > max) {
      res.setHeader('Retry-After', Math.ceil((current.resetAt - now) / 1000));
      return res.status(429).json({ message: 'Too many requests. Please wait before trying again.' });
    }
    next();
  };
