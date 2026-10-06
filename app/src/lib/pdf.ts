/**
 * Минимальный PDF из картинок страниц (JPEG как есть, без перекодирования — фильтр DCTDecode).
 * Вместо jsPDF (~350 КБ): страницам «Скачать PDF» больше ничего не нужно — по картинке на лист A4.
 */
export interface PdfPage {
  /** Байты JPEG */
  jpeg: Uint8Array;
  /** Размер картинки в пикселях */
  width: number;
  height: number;
}

/** A4 в пунктах PDF (1/72 дюйма) */
const A4 = [595.28, 841.89] as const;

/** Строка PDF в UTF-16BE с BOM — для кириллицы в названии документа */
function pdfText(text: string): string {
  let hex = 'FEFF';
  for (let index = 0; index < text.length; index++) hex += text.charCodeAt(index).toString(16).toUpperCase().padStart(4, '0');
  return `<${hex}>`;
}

export function buildPdf(pages: PdfPage[], title: string): Blob {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (part: string | Uint8Array) => {
    const bytes = typeof part === 'string' ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string | Uint8Array[]) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    if (typeof body === 'string') push(body);
    else body.forEach(push);
    push('\nendobj\n');
  };

  // 1 — каталог, 2 — список страниц, 3 — сведения; у страницы n: лист, картинка, содержимое
  const pageId = (n: number) => 4 + n * 3;
  push('%PDF-1.4\n');
  // Двоичная метка во второй строке — байтами: TextEncoder превратил бы их в UTF-8
  push(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, n) => `${pageId(n)} 0 R`).join(' ')}] >>`);
  object(3, `<< /Title ${pdfText(title)} /Producer (M3102) >>`);
  pages.forEach((page, n) => {
    const id = pageId(n);
    const draw = `q ${A4[0]} 0 0 ${A4[1]} 0 0 cm /Im Do Q`;
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4[0]} ${A4[1]}] /Resources << /XObject << /Im ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`,
    );
    object(id + 1, [
      encoder.encode(
        `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      ),
      page.jpeg,
      encoder.encode('\nendstream'),
    ]);
    object(id + 2, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
  });

  const count = pageId(pages.length);
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}
