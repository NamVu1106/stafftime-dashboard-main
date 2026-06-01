import { Response, NextFunction } from 'express';
import { query } from '../db/sqlServer';
import type { AuthRequest } from './auth';

export type SecurityScope = {
  isAdmin: boolean;
  /** null = toàn nhà máy (admin) */
  departmentIds: number[] | null;
};

/** Tải danh sách bộ phận được phép — admin/field: null (tất cả); manager: chỉ bộ phận gán */
export async function loadSecurityScope(user: {
  userId: number;
  role: string;
}): Promise<SecurityScope> {
  if (user.role === 'admin') {
    return { isAdmin: true, departmentIds: null };
  }
  if (user.role === 'manager') {
    const rows = await query<{ department_id: number }>(
      `SELECT department_id FROM dbo.sec_user_departments WHERE user_id = @uid`,
      { uid: user.userId }
    );
    return { isAdmin: false, departmentIds: rows.map((r) => r.department_id) };
  }
  /** Nhân viên hiện trường (tablet checklist) — toàn bộ bộ phận để quét/kiểm tra */
  return { isAdmin: false, departmentIds: null };
}

export async function attachSecurityScope(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  try {
    req.securityScope = await loadSecurityScope(req.user);
    next();
  } catch (e: unknown) {
    res.status(500).json({ error: (e as Error).message });
  }
}

/** Admin hoặc manager có ít nhất một bộ phận */
/** Admin hoặc manager — quản lý tài sản / QR */
export function requireSecurityAssetAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const scope = req.securityScope;
  if (!req.user || !scope) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (scope.isAdmin) return next();
  if (req.user.role === 'manager' && scope.departmentIds && scope.departmentIds.length > 0) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden - Asset admin required' });
}

export function requireSecurityReportAccess(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const scope = req.securityScope;
  if (!req.user || !scope) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (scope.isAdmin) return next();
  if (req.user.role === 'manager' && scope.departmentIds && scope.departmentIds.length > 0) {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden - Manager or admin required' });
}

export function canAccessDepartment(scope: SecurityScope, departmentId: number): boolean {
  if (scope.isAdmin || scope.departmentIds === null) return true;
  return scope.departmentIds.includes(departmentId);
}

/** SQL filter cho cột department (vd. d.id) */
export function deptSqlFilter(
  scope: SecurityScope,
  columnSql: string
): { clause: string; params: Record<string, unknown> } {
  if (scope.isAdmin || scope.departmentIds === null) {
    return { clause: '1=1', params: {} };
  }
  if (!scope.departmentIds.length) {
    return { clause: '1=0', params: {} };
  }
  const params: Record<string, unknown> = {};
  const placeholders = scope.departmentIds.map((id, i) => {
    const key = `secDept${i}`;
    params[key] = id;
    return `@${key}`;
  });
  return { clause: `${columnSql} IN (${placeholders.join(',')})`, params };
}

export function assertDeptAccess(
  req: AuthRequest,
  res: Response,
  departmentId: number
): boolean {
  const scope = req.securityScope;
  if (!scope) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!canAccessDepartment(scope, departmentId)) {
    res.status(403).json({ error: 'Forbidden - No access to this department' });
    return false;
  }
  return true;
}
