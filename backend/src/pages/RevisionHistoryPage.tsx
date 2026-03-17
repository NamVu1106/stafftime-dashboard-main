import { useI18n } from '@/contexts/I18nContext';
import { PageHeader } from '@/components/shared/PageHeader';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Mock data - YS-Smart 재·개정 이력 style
const revisionData = [
  { ed: '00', date: '2017.01.05', content: '최초 작성', author: '이범세' },
  { ed: '01', date: '2018.03.15', content: 'Đã cập nhật giao diện dashboard', author: 'Admin' },
  { ed: '02', date: '2020.06.20', content: 'Thêm module báo cáo HR', author: 'IT Team' },
  { ed: '03', date: '2024.01.10', content: 'Nâng cấp giao diện YS-Smart', author: 'Dev Team' },
];

const RevisionHistoryPage = () => {
  const { t, language } = useI18n();

  const headers = {
    ed: language === 'vi' ? 'ED' : 'ED',
    date: language === 'vi' ? 'Ngày' : '날짜',
    content: language === 'vi' ? 'Nội dung' : '내용',
    author: language === 'vi' ? 'Tác giả' : '작성자',
  };

  return (
    <div>
      <PageHeader
        title={language === 'vi' ? 'Lịch sử sửa đổi' : 'YS-Smart 재·개정 이력'}
        description={language === 'vi' ? 'Bảng theo dõi các phiên bản và thay đổi hệ thống' : '시스템 개정 이력'}
      />

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="bg-[hsl(215,75%,32%)] px-6 py-4">
          <h2 className="text-lg font-semibold text-white">
            {language === 'vi' ? 'Bảng lịch sử sửa đổi' : 'YS-Smart 재·개정 이력'}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="w-20 font-semibold">{headers.ed}</TableHead>
                <TableHead className="w-32 font-semibold">{headers.date}</TableHead>
                <TableHead className="font-semibold">{headers.content}</TableHead>
                <TableHead className="w-40 font-semibold">{headers.author}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {revisionData.map((row, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-sm">{row.ed}</TableCell>
                  <TableCell>{row.date}</TableCell>
                  <TableCell>{row.content}</TableCell>
                  <TableCell>{row.author}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <p className="mt-4 text-sm text-muted-foreground text-center">
        New Idea, NO.1 Production
      </p>
    </div>
  );
};

export default RevisionHistoryPage;
