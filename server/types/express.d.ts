import { User } from "../../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      login: (user: User, callback: (err: any) => void) => void;
      logout: (callback: (err: any) => void) => void;
    }
  }
}