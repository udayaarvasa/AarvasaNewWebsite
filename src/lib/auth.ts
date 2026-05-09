import jwt, { type JwtPayload } from "jsonwebtoken";

export type SessionUser = {
  id: string;
  name: string;
  email: string;
};

const fallbackSecret = "local-development-aarvasa-secret";

export function getJwtSecret() {
  return process.env.JWT_SECRET || fallbackSecret;
}

export function signToken(user: SessionUser) {
  return jwt.sign(user, getJwtSecret(), { expiresIn: "7d" });
}

export function verifyToken(token?: string | null): SessionUser | null {
  if (!token) {
    return null;
  }

  try {
    const payload = jwt.verify(token, getJwtSecret()) as JwtPayload & SessionUser;
    if (!payload.id || !payload.email || !payload.name) {
      return null;
    }

    return {
      id: payload.id,
      name: payload.name,
      email: payload.email,
    };
  } catch {
    return null;
  }
}
