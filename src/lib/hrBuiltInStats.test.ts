import { describe, expect, it } from 'vitest';
import { extractHrBuiltInStats, type HrGridResponse } from './hrBuiltInStats';

const sheetGrid = (rows: (string | number)[][]): HrGridResponse => ({
  sheets: [{ name: 'Tổng quan', rows }],
});

describe('extractHrBuiltInStats', () => {
  it('extracts attendance-count summary rows', () => {
    const grid = sheetGrid([
      ['Title'],
      ['Subtitle'],
      ['Nhóm', 'Chỉ số', '1', '2', 'Tổng/TB', 'Ghi chú'],
      ['Chính thức', 'Số đi làm', 10, 20, 30, 'Người'],
      ['Thời vụ', 'Số đi làm', 5, 7, 12, 'Người'],
      ['Hệ thống', 'Nhân viên mới', 1, 2, 3, 'Người'],
    ]);

    expect(extractHrBuiltInStats('attendance-count', grid)).toEqual({
      attendanceCount: {
        sums: {
          official: 30,
          seasonal: 12,
          newEmployees: 3,
        },
      },
    });
  });

  it('extracts official timesheet work and paid hours', () => {
    const grid = sheetGrid([
      ['Title'],
      ['Subtitle'],
      ['Nhóm', 'Chỉ số', '1', '2', 'Tổng/TB', 'Ghi chú'],
      ['Chính thức', 'Số NV đi làm', 20, 22, 42, 'Người/ngày'],
      ['Chính thức', 'Tổng công', 8, 9, 17, 'Công'],
      ['Chính thức', 'Tổng giờ công', 80, 90, 170, 'Giờ'],
      ['Chính thức', 'Total tính lương', 88, 96, 184, 'Giờ'],
    ]);

    expect(extractHrBuiltInStats('official-timesheet', grid)).toEqual({
      timesheet: {
        employeesCount: 42,
        sums: {
          workDays: 17,
          workHours: 170,
          overtimeHours: 0,
          paidHours: 184,
        },
      },
    });
  });

  it('extracts payroll and daily wage totals', () => {
    const payrollGrid = sheetGrid([
      ['Title'],
      ['Subtitle'],
      ['Nhóm', 'Chỉ số', '1', '2', 'Tổng/TB', 'Ghi chú'],
      ['Chi trả', 'Tổng gross theo ngày', 100, 200, 300, 'VND'],
      ['Thuế', 'Thuế TNCN theo ngày', 10, 20, 30, 'VND'],
      ['Thực nhận', 'Tổng net theo ngày', 90, 180, 270, 'VND'],
    ]);
    const dailyWageGrid = sheetGrid([
      ['Title'],
      ['Subtitle'],
      ['Nhóm', 'Chỉ số', '1', '2', 'Tổng/TB', 'Ghi chú'],
      ['Chi trả', 'Tổng chi trả', 1000, 2500, 3500, 'VND'],
    ]);

    expect(extractHrBuiltInStats('payroll', payrollGrid)).toEqual({
      payroll: {
        tax: { totalSum: 30 },
        overview: { gross: 300, net: 270 },
      },
    });
    expect(extractHrBuiltInStats('daily-wage', dailyWageGrid)).toEqual({
      dailyWage: { grandTotal: 3500 },
    });
  });

  it('aggregates attendance-rate from vendor rows', () => {
    const grid = sheetGrid([
      ['BÁO CÁO TỈ LỆ ĐI LÀM THỜI VỤ THEO NCC'],
      ['Khoảng lọc'],
      ['No', 'Vendor', 'Tháng 03', '', '', '3/19/26', '', '', '', '', '', '', '', 'W3/T3', '', ''],
      ['', '', 'Tổng', '', '', 'Tổng', '', '', 'Ca ngày', '', '', 'Ca đêm', '', 'Tổng', '', ''],
      ['', '', 'Số lượng', 'Đi làm', 'Tỉ lệ', 'Số lượng', 'Đi làm', 'Tỉ lệ', 'Số lượng', 'Đi làm', 'Tỉ lệ', 'Số lượng', 'Đi làm', 'Số lượng', 'Đi làm', 'Tỉ lệ'],
      ['', 'Total', 30, 18, '60%', 30, 18, '60%', 18, 12, '66.7%', 12, 6, 30, 18, '60%'],
      [1, 'Vendor A', 10, 8, '80%', 10, 8, '80%', 6, 5, '83.3%', 4, 3, 10, 8, '80%'],
      [2, 'Vendor B', 20, 10, '50%', 20, 10, '50%', 12, 7, '58.3%', 8, 3, 20, 10, '50%'],
    ]);

    expect(extractHrBuiltInStats('attendance-rate', grid)).toEqual({
      overall: {
        total: 30,
        attended: 18,
        rate: 60,
      },
    });
  });
});
