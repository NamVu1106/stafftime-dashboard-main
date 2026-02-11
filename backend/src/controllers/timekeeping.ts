import { Request, Response } from 'express';
import { prisma } from '../server';

// GET /api/timekeeping - List timekeeping records with filters
// Query param: archived=true để lấy dữ liệu lịch sử, mặc định chỉ lấy dữ liệu mới
export const getTimekeeping = async (req: Request, res: Response) => {
  try {
    const { date, start_date, end_date, department, employee_code, search, archived, page, limit } = req.query;
    
    const where: any = {};
    
    // Mặc định chỉ lấy dữ liệu mới (is_archived = 0) nếu không có param archived
    // Nếu archived=true thì lấy dữ liệu cũ (is_archived = 1)
    if (archived === 'true') {
      where.is_archived = 1; // Lấy dữ liệu lịch sử
    } else {
      // Chỉ lấy dữ liệu mới: is_archived = 0
      // Không dùng null vì Prisma không hỗ trợ null trong where clause cho SQLite
      where.is_archived = 0;
    }
    
    if (date) {
      where.date = date;
    } else if (start_date && end_date) {
      where.date = {
        gte: start_date as string,
        lte: end_date as string,
      };
    }
    
    if (department && department !== 'all') {
      where.department = department;
    }
    
    // Fetch all records first (we'll filter by search term after)
    const allRecords = await prisma.timekeepingRecord.findMany({
      where,
      include: {
        employee: true,
      },
      orderBy: [
        {
          created_at: 'desc', // Dữ liệu mới upload hiển thị trước
        },
        {
          date: 'desc', // Ngày mới nhất trước
        },
        {
          employee_code: 'asc',
        },
      ],
    });
    
    // Filter by employee_code, employee_name, or search term (case-insensitive)
    // SQLite doesn't support case-insensitive search well, so we filter after fetching
    let filteredRecords = allRecords;
    const searchTerm = (search || employee_code) as string;
    if (searchTerm) {
      const term = searchTerm.trim().toLowerCase();
      if (term) {
        filteredRecords = allRecords.filter(record => 
          record.employee_code.toLowerCase().includes(term) ||
          record.employee_name.toLowerCase().includes(term)
        );
      }
    }
    
    // Pagination
    const pageNum = page ? parseInt(page as string) : 1;
    const limitNum = limit ? parseInt(limit as string) : 20;
    const skip = (pageNum - 1) * limitNum;
    const total = filteredRecords.length;
    const data = filteredRecords.slice(skip, skip + limitNum);
    
    res.json({
      data,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/timekeeping/:id - Get timekeeping record by ID
export const getTimekeepingById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const record = await prisma.timekeepingRecord.findUnique({
      where: { id: parseInt(id) },
      include: {
        employee: true,
      },
    });
    
    if (!record) {
      return res.status(404).json({ error: 'Timekeeping record not found' });
    }
    
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/timekeeping - Create new timekeeping record
export const createTimekeeping = async (req: Request, res: Response) => {
  try {
    const {
      employee_code,
      employee_id,
      employee_name,
      date,
      day_of_week,
      check_in,
      check_out,
      late_minutes,
      early_minutes,
      workday,
      total_hours,
      overtime_hours,
      total_all_hours,
      shift,
      department,
    } = req.body;
    
    // If employee_id not provided, try to find by employee_code
    let finalEmployeeId = employee_id || null;
    if (!finalEmployeeId && employee_code) {
      const employee = await prisma.employee.findUnique({
        where: { employee_code },
        select: { id: true },
      });
      if (employee) {
        finalEmployeeId = employee.id;
      }
    }
    
    const record = await prisma.timekeepingRecord.create({
      data: {
        employee_code,
        employee_id: finalEmployeeId,
        employee_name,
        date,
        day_of_week,
        check_in,
        check_out,
        late_minutes: late_minutes || 0,
        early_minutes: early_minutes || 0,
        workday,
        total_hours,
        overtime_hours: overtime_hours || 0,
        total_all_hours,
        shift,
        department,
        created_at: new Date().toISOString(), // Đánh dấu thời gian tạo để sắp xếp dữ liệu mới trước
        is_archived: 0, // Dữ liệu mới tạo = 0 (hiển thị ở Báo cáo)
      },
      include: {
        employee: true,
      },
    });
    
    res.status(201).json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/timekeeping/:id - Update timekeeping record
export const updateTimekeeping = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const updateData = req.body;
    
    const record = await prisma.timekeepingRecord.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        employee: true,
      },
    });
    
    res.json(record);
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Timekeeping record not found' });
    }
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/timekeeping/:id - Delete timekeeping record
export const deleteTimekeeping = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.timekeepingRecord.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({ message: 'Timekeeping record deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Timekeeping record not found' });
    }
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/timekeeping - Delete all timekeeping records
export const deleteAllTimekeeping = async (req: Request, res: Response) => {
  try {
    const result = await prisma.timekeepingRecord.deleteMany({});
    
    res.json({ 
      message: 'All timekeeping records deleted successfully',
      count: result.count 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/timekeeping/archived - Delete all archived (historical) records
export const deleteAllArchivedTimekeeping = async (req: Request, res: Response) => {
  try {
    const result = await prisma.timekeepingRecord.deleteMany({
      where: {
        is_archived: 1, // Chỉ xóa dữ liệu đã được archive (lịch sử)
      },
    });
    
    res.json({ 
      message: 'All archived timekeeping records deleted successfully',
      count: result.count 
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/timekeeping/fix-archive - Fix archive status: archive all old data, keep only the latest upload
export const fixArchiveStatus = async (req: Request, res: Response) => {
  try {
    // Tìm created_at mới nhất (lần upload gần nhất) - chỉ lấy những record có created_at không rỗng
    const latestRecord = await prisma.timekeepingRecord.findFirst({
      where: {
        created_at: { not: '' }, // Chỉ lấy record có created_at không rỗng
      },
      orderBy: { created_at: 'desc' },
      select: { created_at: true },
    });
    
    if (!latestRecord || !latestRecord.created_at) {
      // Nếu không có created_at hợp lệ, lấy tất cả dữ liệu và đánh dấu tất cả là archived
      // Sau đó giữ lại batch mới nhất (dựa vào id)
      const allRecords = await prisma.timekeepingRecord.findMany({
        orderBy: { id: 'desc' },
        take: 1000, // Giả sử batch mới nhất có tối đa 1000 records
      });
      
      if (allRecords.length === 0) {
        return res.json({ 
          message: 'No records to fix',
          archived: 0,
          kept: 0
        });
      }
      
      // Lấy id của record mới nhất và cũ nhất trong batch
      const latestId = allRecords[0].id;
      const oldestIdInBatch = allRecords[allRecords.length - 1].id;
      
      // Archive tất cả dữ liệu có id < oldestIdInBatch (dữ liệu cũ hơn batch mới nhất)
      const archiveResult = await prisma.timekeepingRecord.updateMany({
        where: {
          id: { lt: oldestIdInBatch },
        },
        data: {
          is_archived: 1,
        },
      });
      
      // Đảm bảo batch mới nhất có is_archived = 0
      await prisma.timekeepingRecord.updateMany({
        where: {
          id: { gte: oldestIdInBatch, lte: latestId },
        },
        data: {
          is_archived: 0,
        },
      });
      
      return res.json({
        message: 'Archive status fixed successfully',
        archived: archiveResult.count,
        kept: allRecords.length,
      });
    }
    
    const latestCreatedAt = latestRecord.created_at;
    
    // Archive tất cả dữ liệu có created_at < latestCreatedAt hoặc created_at rỗng
    // Sử dụng OR với điều kiện hợp lệ
    const archiveConditions: any[] = [
      { created_at: { lt: latestCreatedAt } },
    ];
    
    // Thêm điều kiện cho created_at rỗng (nếu có)
    archiveConditions.push({ created_at: '' });
    
    // Thêm điều kiện cho is_archived = 0 nhưng created_at khác latestCreatedAt
    archiveConditions.push({ 
      is_archived: 0,
      created_at: { not: latestCreatedAt }
    });
    
    const archiveResult = await prisma.timekeepingRecord.updateMany({
      where: {
        OR: archiveConditions,
      },
      data: {
        is_archived: 1,
      },
    });
    
    // Đảm bảo batch mới nhất có is_archived = 0
    const keepResult = await prisma.timekeepingRecord.updateMany({
      where: {
        created_at: latestCreatedAt,
      },
      data: {
        is_archived: 0,
      },
    });
    
    res.json({
      message: 'Archive status fixed successfully',
      archived: archiveResult.count,
      kept: keepResult.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


