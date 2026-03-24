import { transaction } from './sqlServer';

type Fam = { relation: string; name: string; occupation: string };

export async function upsertEmployeeWithFamily(data: {
  employee_code: string;
  name: string;
  gender: string;
  date_of_birth: string;
  age: number;
  department: string;
  employment_type: string;
  cccd: string | null;
  phone: string | null;
  hometown: string | null;
  permanent_residence: string | null;
  temporary_residence: string | null;
  marital_status: string | null;
  familyMembers: Fam[];
}): Promise<any> {
  const now = new Date().toISOString();
  return transaction(async (run, runExec) => {
    const ex = await run<{ id: number }>(
      'SELECT id FROM employees WHERE employee_code = @c',
      { c: data.employee_code }
    );
    let id: number;
    if (ex[0]) {
      id = ex[0].id;
      await runExec(
        `UPDATE employees SET name=@name, gender=@gender, date_of_birth=@dob, age=@age, department=@dept,
         employment_type=@et, cccd=@cccd, phone=@phone, hometown=@ht, permanent_residence=@pr,
         temporary_residence=@tr, marital_status=@ms, updated_at=@u WHERE id=@id`,
        {
          name: data.name,
          gender: data.gender,
          dob: data.date_of_birth,
          age: data.age,
          dept: data.department,
          et: data.employment_type,
          cccd: data.cccd,
          phone: data.phone,
          ht: data.hometown,
          pr: data.permanent_residence,
          tr: data.temporary_residence,
          ms: data.marital_status,
          u: now,
          id,
        }
      );
    } else {
      const ins = await run<{ id: number }>(
        `INSERT INTO employees (employee_code, name, gender, date_of_birth, age, department, employment_type,
          cccd, phone, hometown, permanent_residence, temporary_residence, marital_status, created_at, updated_at)
         OUTPUT INSERTED.id AS id
         VALUES (@ec, @name, @gender, @dob, @age, @dept, @et, @cccd, @phone, @ht, @pr, @tr, @ms, @c, @u)`,
        {
          ec: data.employee_code,
          name: data.name,
          gender: data.gender,
          dob: data.date_of_birth,
          age: data.age,
          dept: data.department,
          et: data.employment_type,
          cccd: data.cccd,
          phone: data.phone,
          ht: data.hometown,
          pr: data.permanent_residence,
          tr: data.temporary_residence,
          ms: data.marital_status,
          c: now,
          u: now,
        }
      );
      id = ins[0].id;
    }
    await runExec('DELETE FROM family_members WHERE employee_id = @id', { id });
    for (const fm of data.familyMembers) {
      await runExec(
        'INSERT INTO family_members (employee_id, relation, name, occupation) VALUES (@id, @r, @n, @o)',
        { id, r: fm.relation, n: fm.name, o: fm.occupation || '' }
      );
    }
    const emp = await run('SELECT * FROM employees WHERE id = @id', { id });
    const fam = await run('SELECT * FROM family_members WHERE employee_id = @id', { id });
    return { ...emp[0], family_members: fam };
  });
}
