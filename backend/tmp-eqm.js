const { PrismaClient } = require('./node_modules/.prisma/client');
const prisma = new PrismaClient();
(async () => {
  const dept = 'EQM';
  const emps = await prisma.employee.findMany({ where: { department: dept }, select: { employee_code: true, name: true } });
  console.log('dept employees', emps.length, emps.slice(0, 5));
  const date = '2025-12-17';
  const recs = await prisma.timekeepingRecord.findMany({ where: { is_archived: 0, date }, select: { employee_code: true, employee_name: true, department: true }, take: 200 });
  const inDept = recs.filter(r => ((r.department || '').trim().toUpperCase() === dept));
  console.log('records with dept field = EQM', inDept.length);
  const codesInDept = new Set(emps.map(e => (e.employee_code || '').trim().toUpperCase()));
  const byCode = recs.filter(r => codesInDept.has((r.employee_code || '').trim().toUpperCase()));
  console.log('records matching employee_code', byCode.length);
  const byName = recs.filter(r => codesInDept.has((r.employee_name || '').trim().toUpperCase()));
  console.log('records matching employee_name', byName.length);
  console.log('sample recs', recs.slice(0, 10));
  await prisma.$disconnect();
})();
