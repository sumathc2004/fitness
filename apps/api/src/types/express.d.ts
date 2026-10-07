import type { RoleName } from '@gym/config';

declare global {
  namespace Express {
    interface AuthContext {
      userId: string;
      role: RoleName;
      trainerId: string | null;
      clientId: string | null;
    }
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
