import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Upload, Trash2, Plus, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { vendorAssignmentsAPI } from '@/services/api';

const VendorAssignmentsPage = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [code, setCode] = useState('');
  const [vendor, setVendor] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['vendor-assignments'],
    queryFn: () => vendorAssignmentsAPI.list(),
  });

  const uploadMut = useMutation({
    mutationFn: (f: File) => vendorAssignmentsAPI.upload(f),
    onSuccess: (r) => {
      toast({ title: 'Thành công', description: r.message || `Đã cập nhật ${r.upserted} dòng` });
      qc.invalidateQueries({ queryKey: ['vendor-assignments'] });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'hrTemplates' });
      setExcelFile(null);
    },
    onError: (e: Error) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });

  const addMut = useMutation({
    mutationFn: () => vendorAssignmentsAPI.save([{ employee_code: code.trim(), vendor_name: vendor.trim() }]),
    onSuccess: () => {
      toast({ title: 'Đã lưu' });
      setCode('');
      setVendor('');
      qc.invalidateQueries({ queryKey: ['vendor-assignments'] });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'hrTemplates' });
    },
    onError: (e: Error) => toast({ title: 'Lỗi', description: e.message, variant: 'destructive' }),
  });

  const delMut = useMutation({
    mutationFn: (c: string) => vendorAssignmentsAPI.delete(c),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['vendor-assignments'] });
      qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === 'hrTemplates' });
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="p-6 space-y-8 max-w-5xl">
      <PageHeader
        title="Gán Vendor (Nhà cung cấp)"
        description="Mỗi mã NV thời vụ gắn với một NCC — dùng cho báo cáo «Tỉ lệ đi làm» (không dùng phòng ban làm Vendor)."
        breadcrumbs={[{ label: 'Gán Vendor (NCC)' }]}
      />

      <Card>
        <CardHeader>
          <CardTitle>Upload Excel</CardTitle>
          <CardDescription>
            Cột 1: Mã NV — Cột 2: Tên nhà cung cấp (Vendor / NCC). Có thể đặt tên cột «Mã NV», «Vendor» hoặc «Nhà cung
            cấp».{' '}
            <Link to="/hr/attendance-rate" className="text-primary underline">
              Xem báo cáo Tỉ lệ đi làm
            </Link>
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-center">
          <input
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            id="va-upload"
            onChange={(e) => setExcelFile(e.target.files?.[0] || null)}
          />
          <label htmlFor="va-upload">
            <Button variant="outline" type="button" asChild>
              <span className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2 inline" />
                Chọn file Excel
              </span>
            </Button>
          </label>
          {excelFile && <span className="text-sm text-muted-foreground">{excelFile.name}</span>}
          <Button
            disabled={uploadMut.isPending || !excelFile}
            onClick={() => excelFile && uploadMut.mutate(excelFile)}
          >
            {uploadMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Tải lên'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thêm từng dòng</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="text-sm text-muted-foreground">Mã NV</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="VD: 12345" className="w-40" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="text-sm text-muted-foreground">Nhà cung cấp (Vendor)</label>
            <Input value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Tên NCC" />
          </div>
          <Button
            onClick={() => code.trim() && vendor.trim() && addMut.mutate()}
            disabled={!code.trim() || !vendor.trim() || addMut.isPending}
          >
            <Plus className="w-4 h-4 mr-1" />
            Lưu
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({items.length})</CardTitle>
          <CardDescription>Sắp xếp theo Vendor. Xóa để bỏ gán — NV đó sẽ vào nhóm «Chưa gán NCC» trên báo cáo.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Đang tải…</div>
          ) : items.length === 0 ? (
            <p className="text-muted-foreground">Chưa có gán nào. Upload Excel hoặc thêm tay.</p>
          ) : (
            <div className="overflow-x-auto border rounded-md">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b">
                    <th className="text-left p-2">Mã NV</th>
                    <th className="text-left p-2">Vendor (NCC)</th>
                    <th className="w-12 p-2" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((row) => (
                    <tr key={row.employee_code} className="border-b">
                      <td className="p-2 font-mono">{row.employee_code}</td>
                      <td className="p-2">{row.vendor_name}</td>
                      <td className="p-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => delMut.mutate(row.employee_code)}
                          disabled={delMut.isPending}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default VendorAssignmentsPage;
