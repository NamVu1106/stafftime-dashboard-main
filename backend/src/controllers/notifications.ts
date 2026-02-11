import { Request, Response } from 'express';
import { prisma } from '../server';

// Helper function to create a notification
export const createNotification = async (
  type: 'upload_success' | 'late_employees' | 'new_employees',
  title: string,
  message: string,
  metadata?: any
) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        type,
        title,
        message,
        metadata: metadata ? JSON.stringify(metadata) : null,
        is_read: 0,
        created_at: new Date().toISOString(),
      },
    });
    return notification;
  } catch (error: any) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// GET /api/notifications - Get all notifications (with optional filters)
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const { unread_only, limit } = req.query;
    
    const where: any = {};
    if (unread_only === 'true') {
      where.is_read = 0;
    }
    
    const notifications = await prisma.notification.findMany({
      where,
      orderBy: {
        created_at: 'desc',
      },
      take: limit ? parseInt(limit as string) : 50,
    });
    
    // Parse metadata JSON strings
    const notificationsWithParsedMetadata = notifications.map(notif => ({
      ...notif,
      metadata: notif.metadata ? JSON.parse(notif.metadata) : null,
    }));
    
    res.json(notificationsWithParsedMetadata);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/notifications/unread-count - Get count of unread notifications
export const getUnreadCount = async (req: Request, res: Response) => {
  try {
    const count = await prisma.notification.count({
      where: {
        is_read: 0,
      },
    });
    
    res.json({ count });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/:id/read - Mark notification as read
export const markAsRead = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const notification = await prisma.notification.update({
      where: {
        id: parseInt(id),
      },
      data: {
        is_read: 1,
      },
    });
    
    res.json(notification);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/notifications/read-all - Mark all notifications as read
export const markAllAsRead = async (req: Request, res: Response) => {
  try {
    await prisma.notification.updateMany({
      where: {
        is_read: 0,
      },
      data: {
        is_read: 1,
      },
    });
    
    res.json({ message: 'All notifications marked as read' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/notifications/:id - Delete a notification
export const deleteNotification = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.notification.delete({
      where: {
        id: parseInt(id),
      },
    });
    
    res.json({ message: 'Notification deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/notifications - Delete all notifications
export const deleteAllNotifications = async (req: Request, res: Response) => {
  try {
    await prisma.notification.deleteMany({});
    
    res.json({ message: 'All notifications deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

