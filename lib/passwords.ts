import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import { HttpError } from "./errors";

const COST = 11;

export const hashPassword = (password: string) => bcrypt.hash(password, COST);
export const verifyPassword = (password: string, hash: string) => bcrypt.compare(password, hash);

// No look-alike characters (0/O, 1/l/I), so a printed temporary password can be typed reliably.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

/** Cryptographically random password for temporary and bootstrap credentials. */
export function generatePassword(length = 16): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

const COMMON = new Set([
  "password",
  "password1",
  "password123",
  "12345678",
  "123456789",
  "1234567890",
  "qwertyui",
  "qwerty123",
  "iloveyou",
  "admin123",
  "letmein1",
  "welcome1",
  "change-me-please",
  "changeme",
]);

/** Throws a 400 with a helpful message when a password is too weak. */
export function assertPasswordAcceptable(password: string, email?: string): void {
  if (password.length < 8) throw new HttpError(400, "Password must be at least 8 characters");
  if (password.length > 128) throw new HttpError(400, "Password is too long");
  const lower = password.toLowerCase();
  if (COMMON.has(lower)) throw new HttpError(400, "That password is too common. Choose something harder to guess.");
  if (email && (lower === email.toLowerCase() || lower === email.split("@")[0].toLowerCase())) {
    throw new HttpError(400, "Your password cannot be your email address");
  }
}

/** Production bootstrap credentials must be strong, because they are usually typed into an env file. */
export function isStrongBootstrapPassword(password: string): boolean {
  return password.length >= 12 && !COMMON.has(password.toLowerCase());
}
