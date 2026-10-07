import { Router } from 'express';
import { authenticate, requirePermission } from '../middleware/auth';
import { z } from 'zod';
import { listAuditLogs } from '../services/admin.service';
import { adminDashboard } from '../services/dashboard.service';

/** GET /api/admin/dashboard — Super Admin only. */
export const adminRouter = Router();
adminRouter.use(authenticate, requirePermission('dashboard:admin'));
adminRouter.get('/dashboard', async (_req, res) => {
  res.json(await adminDashboard());
});

const auditQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().trim().max(60).optional(),
});

/** GET /api/admin/audit-logs?page=&pageSize=&action= — Super Admin only (permission audit:read). */
adminRouter.get('/audit-logs', requirePermission('audit:read'), async (req, res) => {
  const q = auditQuery.parse(req.query);
  res.json(await listAuditLogs(q.page, q.pageSize, q.action));
});

