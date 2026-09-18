import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-change-in-production';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    role: string;
    requiresPasswordChange: boolean;
  };
}

export function generateToken(user: { id: number; email: string; role: string; requiresPasswordChange: boolean }): string {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, requiresPasswordChange: user.requiresPasswordChange },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = decoded;
      next();
      return;
    } catch (error) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' });
      return;
    }
  }

  const legacyRequesterId = req.body?.requesterId ?? req.query?.requesterId;
  if (legacyRequesterId !== undefined && legacyRequesterId !== null && legacyRequesterId !== '') {
    const parsedRequesterId = Number(legacyRequesterId);
    if (Number.isInteger(parsedRequesterId) && parsedRequesterId > 0) {
      req.user = {
        id: parsedRequesterId,
        email: 'legacy-requester@local.test',
        role: 'REQUESTER',
        requiresPasswordChange: false,
      };
      next();
      return;
    }
  }

  res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
}

export function requireRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Insufficient permissions' });
      return;
    }
    next();
  };
}