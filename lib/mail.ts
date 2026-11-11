import { realEnv } from "./env";
import nodemailer, { type Transporter } from "nodemailer";
import { MUNICIPALITY } from "./config";

/**
 * Email is optional: with no SMTP settings, notifications are simply not queued.
 * Configure either SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465) or SMTP_HOST + friends.
 */
export function mailEnabled(): boolean {
  if (realEnv("SMTP_URL")) return true;
  if (!realEnv("SMTP_HOST")) return false;
  // A username that is still template text means the account was never filled in: stay off.
  if (process.env.SMTP_USER?.trim() && !realEnv("SMTP_USER")) return false;
  if (realEnv("SMTP_USER") && !(realEnv("SMTP_PASSWORD") ?? realEnv("SMTP_PASS"))) return false;
  return true;
}

export function mailFrom(): string {
  const configured = realEnv("MAIL_FROM") || realEnv("SMTP_FROM");
  if (configured) {
    // Accept `Name email@host` (no angle brackets) as well as the standard `Name <email@host>`.
    const loose = configured.trim().replace(/^"|"$/g, "").match(/^(.+?)\s+([^\s<>@]+@[^\s<>@]+)$/);
    return loose ? `${loose[1].replace(/"/g, "")} <${loose[2]}>` : configured;
  }
  let host = "localhost";
  try {
    host = new URL(process.env.APP_URL ?? "http://localhost").hostname;
  } catch {
    // keep default
  }
  return `MunFix ${MUNICIPALITY.name} <no-reply@${host}>`;
}

const g = globalThis as unknown as { __mailer?: Transporter };

function transporter(): Transporter {
  if (g.__mailer) return g.__mailer;
  const common = { connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 };
  const url = realEnv("SMTP_URL");
  const port = Number(process.env.SMTP_PORT) || 587;
  g.__mailer = url
    ? nodemailer.createTransport({ ...common, url })
    : nodemailer.createTransport({
        ...common,
        host: realEnv("SMTP_HOST"),
        port,
        // Implicit TLS on 465; other ports upgrade with STARTTLS when the server offers it.
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
        auth: realEnv("SMTP_USER") ? { user: realEnv("SMTP_USER")!, pass: realEnv("SMTP_PASSWORD") ?? realEnv("SMTP_PASS") ?? "" } : undefined,
      });
  return g.__mailer;
}

export interface Mail {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export async function sendMail(mail: Mail): Promise<void> {
  await transporter().sendMail({ from: mailFrom(), ...mail });
}
