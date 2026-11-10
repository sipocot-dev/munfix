import nodemailer, { type Transporter } from "nodemailer";
import { MUNICIPALITY } from "./config";

/**
 * Email is optional: with no SMTP settings, notifications are simply not queued.
 * Configure either SMTP_URL (e.g. smtps://user:pass@smtp.example.com:465) or SMTP_HOST + friends.
 */
export function mailEnabled(): boolean {
  return Boolean(process.env.SMTP_URL || process.env.SMTP_HOST);
}

export function mailFrom(): string {
  const configured = process.env.MAIL_FROM || process.env.SMTP_FROM;
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
  const url = process.env.SMTP_URL;
  const port = Number(process.env.SMTP_PORT) || 587;
  g.__mailer = url
    ? nodemailer.createTransport({ ...common, url })
    : nodemailer.createTransport({
        ...common,
        host: process.env.SMTP_HOST,
        port,
        // Implicit TLS on 465; other ports upgrade with STARTTLS when the server offers it.
        secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === "true" : port === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD ?? process.env.SMTP_PASS ?? "" } : undefined,
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
