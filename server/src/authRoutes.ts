import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { hashPassword, verifyPassword, validatePasswordStrength } from './password';
import { generateToken, authMiddleware, AuthRequest } from './authMiddleware';

const router = Router();
const prisma = new PrismaClient();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Email and password are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'INVALID_CREDENTIALS', message: 'Invalid email or password' });
      return;
    }

    const token = generateToken({
      id: user.id, email: user.email, role: user.role, requiresPasswordChange: user.requiresPasswordChange
    });

    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role, requiresPasswordChange: user.requiresPasswordChange }
    });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred' });
  }
});

router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('token');
  res.json({ message: 'Logged out successfully' });
});

router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { id: true, name: true, email: true, role: true, requiresPasswordChange: true, isActive: true }
    });

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found or inactive' });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred' });
  }
});

router.post('/change-password', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Current and new password are required' });
      return;
    }

    const validation = validatePasswordStrength(newPassword);
    if (!validation.valid) {
      res.status(400).json({ error: 'WEAK_PASSWORD', message: validation.errors.join(', ') });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED', message: 'User not found' });
      return;
    }

    const isValid = await verifyPassword(currentPassword, user.password);
    if (!isValid) {
      res.status(401).json({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect' });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword, requiresPasswordChange: false }
    });

    res.json({ message: 'Password changed successfully', requiresPasswordChange: false });
  } catch (error) {
    res.status(500).json({ error: 'SERVER_ERROR', message: 'An unexpected error occurred' });
  }
});

export default router;