import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import type { Writable } from 'stream';

export type LabelAsset = {
  qr_code: string;
  name: string;
  department_name: string;
};

/** Tem QR A4 — 3 cột, khuyến nghị in decal nhựa chống nước/dầu */
export async function writeQrLabelsPdf(
  stream: Writable,
  assets: LabelAsset[]
): Promise<void> {
  const doc = new PDFDocument({ size: 'A4', margin: 36 });
  doc.pipe(stream);

  const colW = 170;
  const rowH = 120;
  const cols = 3;
  let col = 0;
  let row = 0;
  const startX = 36;
  let y = 36;

  for (const asset of assets) {
    const x = startX + col * colW;
    const qrBuf = await QRCode.toBuffer(asset.qr_code, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: 'M',
    });
    doc.image(qrBuf, x, y, { width: 72, height: 72 });
    doc
      .fontSize(8)
      .font('Helvetica-Bold')
      .text(asset.name.slice(0, 40), x, y + 76, { width: colW - 8 });
    doc.font('Helvetica').fontSize(7).text(asset.qr_code, x, y + 92, { width: colW - 8 });
    doc.fontSize(6).fillColor('#555555').text(asset.department_name, x, y + 104, {
      width: colW - 8,
    });
    doc.fillColor('#000000');

    col += 1;
    if (col >= cols) {
      col = 0;
      row += 1;
      y = 36 + row * rowH;
      if (y + rowH > doc.page.height - 36) {
        doc.addPage();
        row = 0;
        y = 36;
      }
    }
  }

  doc.end();
}
