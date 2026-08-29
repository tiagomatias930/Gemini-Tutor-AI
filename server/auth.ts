import crypto from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';
import type {AppConfig} from './config.js';

const STUDENT_COOKIE = 'ngola_student';
const ADMIN_COOKIE = 'ngola_admin';
const COOKIE_AGE_MS = 7 * 24 * 60 * 60 * 1000;

declare global {
  namespace Express {
    interface Request {
      studentSessionId?: string;
    }
  }
}

function cookieOptions(config: AppConfig) {
  return {
    httpOnly: true,
    secure: config.nodeEnv === 'production',
    sameSite: 'strict' as const,
    signed: true,
    path: '/',
    maxAge: COOKIE_AGE_MS,
  };
}

export function issueStudentSession(config: AppConfig) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const signed = req.signedCookies?.[STUDENT_COOKIE];
    const sessionId =
      typeof signed === 'string' && /^[a-f0-9]{32}$/.test(signed)
        ? signed
        : crypto.randomBytes(16).toString('hex');
    req.studentSessionId = sessionId;
    if (signed !== sessionId) {
      res.cookie(STUDENT_COOKIE, sessionId, cookieOptions(config));
    }
    next();
  };
}

export function authenticateAdmin(config: AppConfig, provided: string): boolean {
  if (!config.adminSecret || !provided) return false;
  const expected = Buffer.from(config.adminSecret);
  const actual = Buffer.from(provided);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

export function setAdminCookie(config: AppConfig, res: Response): void {
  const token = crypto.randomBytes(24).toString('hex');
  res.cookie(ADMIN_COOKIE, token, cookieOptions(config));
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.signedCookies?.[ADMIN_COOKIE];
  if (typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) {
    res.status(401).json({error: {code: 'UNAUTHORIZED', message: 'Admin authentication required'}});
    return;
  }
  next();
}

export function clearAdminCookie(config: AppConfig, res: Response): void {
  res.clearCookie(ADMIN_COOKIE, {...cookieOptions(config), maxAge: undefined});
}
