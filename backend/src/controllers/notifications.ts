import { Request, Response } from 'express';
import { query, queryOne, exec } from '../db/sqlServer';

export const createNotification = async (
  type: 'upload_success' | 'late_employees' | 'new_employees',
  title: string,
  message: string,
  metadata?: any
) => {
  try {
    const meta = metadata ? JSON.stringify(metadata) : null;
    const created_at = new Date().toISOString();
    const rows = await query<{ id: number }>(
      `INSERT INTO notifications (type, title, message, is_read, metadata, created_at)
       OUTPUT INSERTED.id AS id
       VALUES (@type, @title, @message, 0, @metadata, @created_at)`,
      { type, title, message, metadata: meta, created_at }
    );
    return rows[0] ? { id: rows[0].id, type, title, message, metadata: meta, is_read: 0, created_at } : null;
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return null;
  }
};

export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { unread_only, limit } = req.query;
    const lim = limit ? parseInt(limit as string, 10) : 50;
    let sql =
      'SELECT TOP (@lim) * FROM notifications WHERE 1=1';
    const params: Record<string, unknown> = { lim };
    if (unread_only === 'true') {
      sql = 'SELECT TOP (@lim) * FROM notifications WHERE is_read = 0 ORDER BY created_at DESC';
    } else {
      sql = 'SELECT TOP (@lim) * FROM notifications ORDER BY created_at DESC';
    }
    const notifications = await query(sql, params);
    const parsed = notifications.map((notif: any) => ({
      ...notif,
      metadata: notif.metadata ? JSON.parse(notif.metadata) : null,
    }));
    res.json(parsed);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getUnreadCount = async (_req: Request, res: Response) => {
  try {
    const r = await queryOne<{ n: number }>(
      'SELECT COUNT(*) AS n FROM notifications WHERE is_read = 0',
      {}
    );
    res.json({ count: Number(r?.n ?? 0) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAsRead = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    await exec('UPDATE notifications SET is_read = 1 WHERE id = @id', { id });
    const n = await queryOne('SELECT * FROM notifications WHERE id = @id', { id });
    res.json(n);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markAllAsRead = async (_req: Request, res: Response) => {
  try {
    await exec('UPDATE notifications SET is_read = 1 WHERE is_read = 0', {});
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const id = parseInt(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, 10);
    await exec('DELETE FROM notifications WHERE id = @id', { id });
    res.json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteAllNotifications = async (_req: Request, res: Response) => {
  try {
    await exec('DELETE FROM notifications', {});
    res.json({ message: 'All notifications deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
