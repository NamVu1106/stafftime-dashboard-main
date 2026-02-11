import { Request, Response } from 'express';
import { prisma } from '../server';
import { createNotification } from './notifications';

// GET /api/employees - List all employees with filters
export const getEmployees = async (req: Request, res: Response) => {
  try {
    const { search, department, employment_type } = req.query;
    
    const where: any = {};
    
    // Filter by department
    if (department && department !== 'all') {
      where.department = department;
    }
    
    // Filter by employment type
    if (employment_type) {
      where.employment_type = employment_type;
    }
    
    // Fetch all employees first (we'll filter by search term after)
    const employees = await prisma.employee.findMany({
      where,
      include: {
        family_members: true,
      },
      orderBy: [
        {
          updated_at: 'desc', // Dữ liệu mới cập nhật hiển thị trước
        },
        {
          created_at: 'desc', // Nếu updated_at giống nhau, sắp xếp theo created_at
        },
      ],
    });
    
    // Filter by employee_code or name (case-insensitive)
    // SQLite doesn't support case-insensitive search well, so we filter after fetching
    let filteredEmployees = employees;
    if (search) {
      const searchTerm = (search as string).trim().toLowerCase();
      if (searchTerm) {
        filteredEmployees = employees.filter(emp => 
          emp.employee_code.toLowerCase().includes(searchTerm) ||
          emp.name.toLowerCase().includes(searchTerm)
        );
      }
    }
    
    res.json(filteredEmployees);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/employees/official - Raw Excel data for display (chính thức)
export const getEmployeesOfficial = async (req: Request, res: Response) => {
  try {
    const store = await prisma.employeeExcelStore.findUnique({ where: { type: 'official' } });
    if (!store) return res.json({ headers: [], rows: [] });
    const headers = JSON.parse(store.headers || '[]') as string[];
    const rows = JSON.parse(store.rows || '[]') as Record<string, any>[];
    res.json({ headers, rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/employees/seasonal - Raw Excel data for display (thời vụ)
export const getEmployeesSeasonal = async (req: Request, res: Response) => {
  try {
    const store = await prisma.employeeExcelStore.findUnique({ where: { type: 'seasonal' } });
    if (!store) return res.json({ headers: [], rows: [] });
    const headers = JSON.parse(store.headers || '[]') as string[];
    const rows = JSON.parse(store.rows || '[]') as Record<string, any>[];
    res.json({ headers, rows });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// GET /api/employees/:id - Get employee by ID
export const getEmployeeById = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    const employee = await prisma.employee.findUnique({
      where: { id: parseInt(id) },
      include: {
        family_members: true,
      },
    });
    
    if (!employee) {
      return res.status(404).json({ error: 'Employee not found' });
    }
    
    res.json(employee);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

// POST /api/employees - Create new employee
export const createEmployee = async (req: Request, res: Response) => {
  try {
    const {
      employee_code,
      name,
      gender,
      date_of_birth,
      department,
      employment_type,
      cccd,
      hometown,
      permanent_residence,
      temporary_residence,
      marital_status,
      phone,
      avatar_url,
      family_relations,
    } = req.body;
    
    // Calculate age
    const birthDate = new Date(date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    const employee = await prisma.employee.create({
      data: {
        employee_code,
        name,
        gender,
        date_of_birth,
        age,
        department,
        employment_type,
        cccd: cccd || null,
        hometown: hometown || null,
        permanent_residence: permanent_residence || null,
        temporary_residence: temporary_residence || null,
        marital_status: marital_status || null,
        phone: phone || null,
        avatar_url: avatar_url || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        family_members: {
          create: (family_relations || []).map((member: any) => ({
            relation: member.relation,
            name: member.name,
            occupation: member.occupation,
          })),
        },
      },
      include: {
        family_members: true,
      },
    });
    
    // Create notification for new employee
    await createNotification(
      'new_employees',
      'Có 1 nhân viên mới được thêm',
      `Nhân viên ${name} (${employee_code}) đã được thêm vào hệ thống`,
      {
        count: 1,
        employee_code,
        employee_name: name,
      }
    );
    
    res.status(201).json(employee);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Employee code already exists' });
    }
    res.status(500).json({ error: error.message });
  }
};

// PUT /api/employees/:id - Update employee
export const updateEmployee = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const {
      employee_code,
      name,
      gender,
      date_of_birth,
      department,
      employment_type,
      cccd,
      hometown,
      permanent_residence,
      temporary_residence,
      marital_status,
      phone,
      avatar_url,
      family_relations,
    } = req.body;
    
    // Log for debugging
    console.log(`Updating employee ID: ${id}`);
    console.log('Update data:', {
      employee_code,
      name,
      date_of_birth,
      department,
      family_relations_count: Array.isArray(family_relations) ? family_relations.length : 'not array',
    });
    
    // Calculate age
    let age;
    if (date_of_birth) {
      try {
        const birthDate = new Date(date_of_birth);
        if (!isNaN(birthDate.getTime())) {
          const today = new Date();
          age = today.getFullYear() - birthDate.getFullYear();
          const monthDiff = today.getMonth() - birthDate.getMonth();
          if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
          }
        }
      } catch (error) {
        console.warn('Failed to calculate age from date_of_birth:', date_of_birth, error);
      }
    }
    
    // Update employee - always update all provided fields
    // If a field is explicitly set to null or empty string, it will be cleared
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };
    
    // Required fields - only update if provided
    if (employee_code !== undefined) updateData.employee_code = employee_code;
    if (name !== undefined) updateData.name = name;
    if (gender !== undefined) updateData.gender = gender;
    if (date_of_birth !== undefined) updateData.date_of_birth = date_of_birth;
    if (age !== undefined) updateData.age = age;
    if (department !== undefined) updateData.department = department;
    if (employment_type !== undefined) updateData.employment_type = employment_type;
    
    // Optional fields - update even if null/empty to allow clearing
    if (cccd !== undefined) updateData.cccd = cccd || null;
    if (hometown !== undefined) updateData.hometown = hometown || null;
    if (permanent_residence !== undefined) updateData.permanent_residence = permanent_residence || null;
    if (temporary_residence !== undefined) updateData.temporary_residence = temporary_residence || null;
    if (marital_status !== undefined) updateData.marital_status = marital_status || null;
    if (phone !== undefined) updateData.phone = phone || null;
    if (avatar_url !== undefined) updateData.avatar_url = avatar_url || null;
    
    // Update family members if provided
    // Always delete existing family members first, then create new ones if provided
    // This handles both cases: updating with new members, and clearing all members (empty array)
    if (family_relations !== undefined) {
      // Delete all existing family members first
      await prisma.familyMember.deleteMany({
        where: { employee_id: parseInt(id) },
      });
      
      // Create new family members only if array is not empty
      if (Array.isArray(family_relations) && family_relations.length > 0) {
        // Filter out 'id' and 'employee_id' fields - Prisma will auto-generate id and set employee_id
        const cleanFamilyRelations = family_relations.map((member: any) => ({
          relation: member.relation,
          name: member.name,
          occupation: member.occupation,
        }));
        
        updateData.family_members = {
          create: cleanFamilyRelations,
        };
      }
      // If family_relations is an empty array, we just delete and don't create anything
      // This effectively clears all family members
    }
    
    // Validate employee ID
    const employeeId = parseInt(id);
    if (isNaN(employeeId)) {
      return res.status(400).json({ error: 'Invalid employee ID' });
    }
    
    const employee = await prisma.employee.update({
      where: { id: employeeId },
      data: updateData,
      include: {
        family_members: true,
      },
    });
    
    res.json(employee);
  } catch (error: any) {
    console.error('Error updating employee:', error);
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Employee code already exists' });
    }
    res.status(500).json({ 
      error: error.message || 'Something went wrong!',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// DELETE /api/employees/:id - Delete employee
export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    
    await prisma.employee.delete({
      where: { id: parseInt(id) },
    });
    
    res.json({ message: 'Employee deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'Employee not found' });
    }
    res.status(500).json({ error: error.message });
  }
};

// DELETE /api/employees - Delete all employees
// Lưu ý: Hành động này sẽ xóa toàn bộ nhân viên trong hệ thống.
// FamilyMember được cấu hình onDelete: Cascade nên sẽ tự xóa theo.
export const deleteAllEmployees = async (req: Request, res: Response) => {
  try {
    const result = await prisma.employee.deleteMany({});

    res.json({
      message: 'All employees deleted successfully',
      count: result.count,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};



