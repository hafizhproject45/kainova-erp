import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

export interface ReportColumn<T> {
  key: keyof T;
  header: string;
  width?: number;
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toLocaleString('id-ID');
  return String(value);
}

/** Render laporan jadi file Excel (.xlsx) — dipakai untuk `?format=xlsx`. */
export async function renderExcelBuffer<T extends Record<string, unknown>>(
  sheetName: string,
  columns: ReportColumn<T>[],
  rows: T[],
  totals?: Partial<Record<keyof T, unknown>>,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'KaiNova ERP';
  const sheet = workbook.addWorksheet(sheetName);

  sheet.columns = columns.map((c) => ({ header: c.header, key: String(c.key), width: c.width ?? 20 }));
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) sheet.addRow(row);

  if (totals) {
    const totalRow = sheet.addRow(totals as Record<string, unknown>);
    totalRow.font = { bold: true };
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/** Render laporan jadi file PDF sederhana (tabel + totals) — dipakai untuk `?format=pdf`. */
export function renderPdfBuffer<T extends Record<string, unknown>>(
  title: string,
  columns: ReportColumn<T>[],
  rows: T[],
  totals?: Partial<Record<keyof T, unknown>>,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const startX = doc.page.margins.left;
    const usableWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const colWidth = usableWidth / columns.length;
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    doc.fontSize(14).font('Helvetica-Bold').text(title, startX, doc.page.margins.top);
    doc.fontSize(8).font('Helvetica').text(`Dicetak: ${new Date().toLocaleString('id-ID')}`, startX);
    let y = doc.y + 10;

    function drawHeader() {
      doc.font('Helvetica-Bold').fontSize(8);
      columns.forEach((col, i) => {
        doc.text(col.header, startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
      });
      y += 14;
      doc.moveTo(startX, y - 2).lineTo(startX + usableWidth, y - 2).stroke();
    }

    drawHeader();
    doc.font('Helvetica').fontSize(7.5);

    for (const row of rows) {
      if (y > bottomLimit - 20) {
        doc.addPage();
        y = doc.page.margins.top;
        drawHeader();
        doc.font('Helvetica').fontSize(7.5);
      }
      columns.forEach((col, i) => {
        doc.text(displayValue(row[col.key]), startX + i * colWidth, y, { width: colWidth - 4, ellipsis: true });
      });
      y += 13;
    }

    if (totals) {
      y += 4;
      doc.moveTo(startX, y).lineTo(startX + usableWidth, y).stroke();
      y += 4;
      doc.font('Helvetica-Bold').fontSize(7.5);
      columns.forEach((col, i) => {
        const value = totals[col.key];
        doc.text(value === undefined ? '' : displayValue(value), startX + i * colWidth, y, {
          width: colWidth - 4,
          ellipsis: true,
        });
      });
    }

    doc.end();
  });
}

/** Header HTTP standar untuk response file binary (bukan JSON envelope). */
export function fileResponse(buffer: Buffer, contentType: string, filename: string): Response {
  return new Response(buffer, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}

export const EXCEL_CONTENT_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
export const PDF_CONTENT_TYPE = 'application/pdf';
