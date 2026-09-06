import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";

export const ACCESS_COOKIE = "storeflow-access";
export const REFRESH_COOKIE = "storeflow-refresh";
export const PRIMARY_COOKIE = "storeflow-primary";
export const OPERATOR_COOKIE = "storeflow-operator";
export const BCRYPT_ROUNDS = 12;

export type SessionClaims = JWTPayload & {
  user_id: string;
  tenant_id: number;
  warehouse_id: number | null;
  assigned_warehouse_id?: number | null;
  role: string;
  allowed_warehouses: number[];
  token_type: "access" | "refresh" | "operator";
};

function secret() {
  const value = process.env.AUTH_JWT_SECRET;
  if (!value || value.length < 32) throw new Error("AUTH_JWT_SECRET must be at least 32 characters.");
  return new TextEncoder().encode(value);
}

export function normalizeIdentifier(identifier: string) {
  const value = identifier.trim().toLowerCase();
  if (value.includes("@")) return value;
  if (/^\+?[0-9 ()-]{7,20}$/.test(value)) return value.replace(/[^0-9+]/g, "");
  return value.replace(/[^a-z0-9_.-]/g, "");
}

export function hashCredential(value: string) { return bcrypt.hash(value, BCRYPT_ROUNDS); }
export function compareCredential(value: string, hash: string) { return bcrypt.compare(value, hash); }
export async function createSessionToken(claims: Omit<SessionClaims, "iat" | "exp">, expiresIn: string) {
  return new SignJWT(claims).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuedAt().setExpirationTime(expiresIn).sign(secret());
}
export async function verifySessionToken(token: string, expectedType: SessionClaims["token_type"]) {
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.token_type !== expectedType) throw new Error("Invalid session token.");
  return payload as SessionClaims;
}
export const secureCookie = { httpOnly: true, sameSite: "strict" as const, secure: process.env.NODE_ENV === "production", path: "/" };