-- CSDL kiểm tra an ninh — tên bảng/cột tiếng Việt (tự tạo: ensureVnSecuritySchema)

-- BoPhan (bộ phận)
-- NhomHangMuc (nhóm hạng mục theo bộ phận)
-- HangMucKiemTra (câu hỏi: kieu_du_lieu, nguong_min/max, don_vi, bat_buoc, yeu_cau_an_loi)
-- ThietBi (ma_qr, ten_thiet_bi)
-- PhienKiemTra (phiên kiểm tra: chữ ký, ca, offline client_id, trang_thai_phien nhap|da_gui)
-- KetQuaKiemTra (kết quả: trang_thai OK|NOT_OK|NA, gia_tri_do, url_anh, thoi_gian_xu_ly)
-- NguoiDungBoPhan (phân quyền manager)
-- LichSuMaQrThietBi (đổi mã QR)

-- Migrate tự động từ sec_* khi BoPhan trống và sec_departments còn dữ liệu.
