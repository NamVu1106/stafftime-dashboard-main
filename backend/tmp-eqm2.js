const { PrismaClient } = require('./node_modules/.prisma/client');
const prisma = new PrismaClient();
(async () => {
  const dept = 'EQM';
  const date = '2025-12-17';
  const recs = await prisma.timekeepingRecord.findMany({ where: { is_archived: 0, date, department: dept }, select: { employee_code: true, employee_name: true, department: true }, take: 20 });
  console.log(recs);
  await prisma.$disconnect();
})();
