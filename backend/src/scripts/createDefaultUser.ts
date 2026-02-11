import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function createDefaultUser() {
  try {
    // Check if admin user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'admin' },
    });

    if (existingUser) {
      console.log('Admin user already exists');
      return;
    }

    // Create default admin user
    const password_hash = await bcrypt.hash('admin123', 10);
    
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        password_hash,
        role: 'admin',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });

    console.log('✅ Default admin user created successfully!');
    console.log('Username: admin');
    console.log('Password: admin123');
    console.log('⚠️  Please change the password after first login!');
  } catch (error) {
    console.error('Error creating default user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createDefaultUser();

