/**
 * Serverless entry (Vercel). Exports the Express app as a plain (req, res) handler; the web app mounts it at /api/*
 * (apps/web/src/pages/api/[...path].ts). Unlike server.ts there is no Socket.IO server and no in-process scheduler:
 * live updates fall back to the web app's polling, and reminders run from Vercel Cron (GET /api/cron/reminders).
 */
import { createApp } from './app';

const app = createApp();
export default app;
