import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

/**
 * Mail service interface. With SMTP_HOST configured it sends real email; otherwise it writes the message to the
 * log so development works without an SMTP account. (No fake "sent" claims: the log line says it was not delivered.)
 */
export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

class SmtpMailer implements Mailer {
  private transport = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
  });
  async send(message: MailMessage) {
    await this.transport.sendMail({ from: env.MAIL_FROM, ...message });
  }
}

class LogMailer implements Mailer {
  async send(message: MailMessage) {
    logger.info({ to: message.to, subject: message.subject, body: message.text }, 'SMTP not configured — email NOT delivered (logged instead)');
  }
}

export const mailer: Mailer = env.SMTP_HOST ? new SmtpMailer() : new LogMailer();

/** Test hook: capture outgoing mail. */
export const outbox: MailMessage[] = [];
export function useOutbox() {
  (mailer as Mailer).send = async (m: MailMessage) => {
    outbox.push(m);
  };
}
