import { TokenPayload } from '../modules/auth/auth.types';

declare global {
  namespace Express {
    interface Request {
      user?: TokenPayload;
      /** Child IDs resolved by the parent authorization guard from parent_child_links */
      resolvedChildIds?: string[];
    }
  }
}

export {};
