import type { IncomingMessage, ServerResponse } from 'node:http';
import type { NextApiRequest, NextApiResponse } from 'next';

/**
 * Embedded API — used when API_URL is NOT set (the Vercel deployment): every /api/* request is handed to the
 * Express app from apps/api, running inside this same function. Same origin, so cookies and client IPs need no proxy.
 *
 * When API_URL IS set (local development), next.config.mjs rewrites /api/* to that server *before* this route
 * is matched, so this file is never reached.
 */
export const config = {
  api: { bodyParser: false, externalResolver: true, responseLimit: false },
};

type Handler = (req: IncomingMessage, res: ServerResponse) => void;
let app: Handler | undefined;

// Next adds its own helpers as own properties (req.query, res.json, …); they would shadow Express's versions
// (req.query would also contain the catch-all `path` param), so strip them before handing over.
const NEXT_REQ_PROPS = ['query', 'cookies', 'body', 'env', 'preview', 'previewData', 'draftMode'] as const;
const NEXT_RES_PROPS = ['status', 'send', 'json', 'redirect', 'setDraftMode', 'setPreviewData', 'clearPreviewData', 'revalidate'] as const;

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  app ??= (require('@gym/api') as { default: Handler }).default;
  for (const k of NEXT_REQ_PROPS) delete (req as unknown as Record<string, unknown>)[k];
  for (const k of NEXT_RES_PROPS) delete (res as unknown as Record<string, unknown>)[k];
  // Resolve only once Express has finished, so the function isn't frozen mid-response.
  return new Promise<void>((resolve) => {
    res.once('finish', resolve);
    res.once('close', resolve);
    app!(req, res);
  });
}
