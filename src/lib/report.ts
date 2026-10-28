/**
 * The end-of-lesson report: a PDF with a picture of the student's page and all
 * of their code, made in this browser and downloaded for them to hand in.
 * Nothing is uploaded. The libraries are only loaded when a report is made.
 */

export interface ReportLevel {
  label: string;
  done: number;
  total: number;
  cleared: boolean;
}

export interface ReportData {
  name: string;
  hobby: string;
  code: string;
  /** The preview HTML (sanitised, with <base>), so pictures resolve. */
  html: string;
  title: string;
  levels: ReportLevel[];
}

export interface CodeRow {
  /** The line number, or null when a long line carries on. */
  line: number | null;
  text: string;
}

/** Width the page is laid out at for the picture, in CSS pixels. */
const CAPTURE_WIDTH = 1000;
const MAX_CAPTURE_HEIGHT = 9000;

const SWAPS: Record<string, string> = {
  '\t': '  ',
  '\u00a0': ' ',
  '\u2018': "'",
  '\u2019': "'",
  '\u201c': '"',
  '\u201d': '"',
  '\u2013': '-',
  '\u2014': '-',
  '\u2026': '...',
};

/** The PDF's built-in fonts only cover Latin-1, so anything else becomes "?". */
export function pdfSafe(text: string): string {
  return Array.from(text, (ch) => SWAPS[ch] ?? (/[\x20-\x7e\xa1-\xff]/.test(ch) ? ch : '?')).join('');
}

/** Split code into numbered rows no wider than `cols` characters, breaking at spaces where possible. */
export function codeRows(code: string, cols: number): CodeRow[] {
  const lines = code.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 1 && lines.at(-1) === '') lines.pop();
  const rows: CodeRow[] = [];
  lines.forEach((raw, i) => {
    let rest = pdfSafe(raw);
    let line: number | null = i + 1;
    while (rest.length > cols) {
      const space = rest.lastIndexOf(' ', cols);
      const cut = space > cols / 2 ? space + 1 : cols;
      rows.push({ line, text: rest.slice(0, cut) });
      rest = rest.slice(cut);
      line = null;
    }
    rows.push({ line, text: rest });
  });
  return rows;
}

export function reportFileName(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '');
  return slug ? `my-hobby-page-report-${slug}.pdf` : 'my-hobby-page-report.pdf';
}

type Html2Canvas = (typeof import('html2canvas-pro'))['default'];

interface Capture {
  canvas: HTMLCanvasElement;
  /** True when the page uses pictures from other websites, which may be missing. */
  externalImages: boolean;
}

/** Lay the page out off screen at a fixed width and paint all of it to a canvas. */
async function capturePage(html: string, html2canvas: Html2Canvas): Promise<Capture> {
  const frame = document.createElement('iframe');
  frame.setAttribute('sandbox', 'allow-same-origin');
  frame.setAttribute('aria-hidden', 'true');
  frame.tabIndex = -1;
  frame.style.cssText = `position:fixed;left:-10000px;top:0;width:${CAPTURE_WIDTH}px;height:800px;border:0;background:#fff`;
  document.body.append(frame);
  try {
    await new Promise<void>((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
      frame.srcdoc = html;
    });
    const doc = frame.contentDocument!;
    const images = Array.from(doc.images);
    images.forEach((img) => (img.loading = 'eager'));
    await Promise.race([
      Promise.all(
        images.map((img) =>
          img.complete
            ? null
            : new Promise((r) => {
                img.addEventListener('load', r, { once: true });
                img.addEventListener('error', r, { once: true });
              }),
        ),
      ),
      new Promise((r) => setTimeout(r, 5000)),
    ]);
    await doc.fonts?.ready;
    const measure = () => Math.max(doc.documentElement.scrollHeight, doc.body?.scrollHeight ?? 0, 400);
    frame.style.height = `${Math.min(MAX_CAPTURE_HEIGHT, measure())}px`;
    const height = Math.min(MAX_CAPTURE_HEIGHT, measure());
    frame.style.height = `${height}px`;
    const painted = await html2canvas(doc.documentElement, {
      width: CAPTURE_WIDTH,
      height,
      windowWidth: CAPTURE_WIDTH,
      windowHeight: height,
      scale: 1.5,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      imageTimeout: 8000,
    });
    // The painted canvas belongs to the frame's document and goes blank when the frame is removed.
    const canvas = document.createElement('canvas');
    canvas.width = painted.width;
    canvas.height = painted.height;
    canvas.getContext('2d')!.drawImage(painted, 0, 0);
    const externalImages = images.some((img) => {
      try {
        return new URL(img.src).origin !== location.origin;
      } catch {
        return false;
      }
    });
    return { canvas, externalImages };
  } finally {
    frame.remove();
  }
}

const NAVY: [number, number, number] = [10, 27, 46];
const MUTED: [number, number, number] = [74, 85, 98];
const GREEN: [number, number, number] = [15, 110, 58];
const GOLD: [number, number, number] = [242, 181, 51];
const LINE: [number, number, number] = [215, 227, 239];

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 16;
const TOP = 26;
const BOTTOM = PAGE_H - 16;
const WIDTH = PAGE_W - MARGIN * 2;

/** Build the PDF and start the download. Resolves with the file name. */
export async function downloadReport(data: ReportData): Promise<string> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas-pro')]);
  const shot = await capturePage(data.html, html2canvas);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const name = pdfSafe(data.name.trim());
  pdf.setProperties({ title: 'My hobby page report', creator: 'Na<>y Builds' });

  const heading = (text: string, y: number) => {
    pdf.setFont('helvetica', 'bold').setFontSize(16).setTextColor(...NAVY);
    pdf.text(text, MARGIN, y);
  };

  /* -------------------------------------------------------- summary */
  pdf.setFont('helvetica', 'bold').setFontSize(24).setTextColor(...NAVY);
  pdf.text('My hobby page', MARGIN, TOP + 10);
  let y = TOP + 22;
  const made = new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });
  const facts: [string, string][] = [
    ...(name ? ([['Name', name]] as [string, string][]) : []),
    ['Hobby', pdfSafe(data.hobby)],
    ['Page title', pdfSafe(data.title) || '(no title yet)'],
    ['Made', made],
  ];
  pdf.setFontSize(12);
  for (const [label, value] of facts) {
    pdf.setFont('helvetica', 'bold').setTextColor(...MUTED);
    pdf.text(label, MARGIN, y);
    pdf.setFont('helvetica', 'normal').setTextColor(...NAVY);
    const lines = pdf.splitTextToSize(value, WIDTH - 32) as string[];
    pdf.text(lines, MARGIN + 32, y);
    y += 7 * lines.length;
  }

  y += 8;
  heading('Levels', y);
  y += 4;
  const cleared = data.levels.filter((l) => l.cleared).length;
  pdf.setFont('helvetica', 'normal').setFontSize(11).setTextColor(...MUTED);
  pdf.text(`${cleared} of ${data.levels.length} levels cleared. Goals are checked against the code in this report.`, MARGIN, y + 5);
  y += 10;
  for (const level of data.levels) {
    pdf.setDrawColor(...LINE).setLineWidth(0.3).line(MARGIN, y + 3, PAGE_W - MARGIN, y + 3);
    y += 9;
    pdf.setFont('helvetica', 'normal').setFontSize(12).setTextColor(...NAVY);
    pdf.text(pdfSafe(level.label), MARGIN, y);
    pdf.setTextColor(...MUTED);
    pdf.text(`${level.done} of ${level.total} goals`, MARGIN + 110, y);
    pdf.setFont('helvetica', 'bold').setTextColor(...(level.cleared ? GREEN : MUTED));
    pdf.text(level.cleared ? 'Cleared' : 'Not yet', PAGE_W - MARGIN, y, { align: 'right' });
  }
  pdf.setDrawColor(...LINE).line(MARGIN, y + 4, PAGE_W - MARGIN, y + 4);

  /* -------------------------------------------------------- picture */
  pdf.addPage();
  heading('What my page looks like', TOP + 6);
  y = TOP + 12;
  if (shot.externalImages) {
    pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
    pdf.text('Pictures from other websites may be missing from this picture.', MARGIN, y + 2);
    y += 6;
  }
  // A browser tab, like the preview, showing the page's <title>.
  pdf.setFillColor(...NAVY).rect(MARGIN, y, WIDTH, 9, 'F');
  pdf.setFillColor(...GOLD).rect(MARGIN + 3, y + 2.75, 3.5, 3.5, 'F');
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(255, 255, 255);
  const tab = (pdf.splitTextToSize(pdfSafe(data.title) || 'Untitled', WIDTH - 14) as string[])[0];
  pdf.text(tab, MARGIN + 9, y + 6);
  y += 9;

  const { canvas } = shot;
  const pxPerMm = canvas.width / WIDTH;
  let from = 0;
  while (from < canvas.height) {
    const room = Math.floor((BOTTOM - y) * pxPerMm);
    const slice = Math.min(room, canvas.height - from);
    const part = document.createElement('canvas');
    part.width = canvas.width;
    part.height = slice;
    part.getContext('2d')!.drawImage(canvas, 0, from, canvas.width, slice, 0, 0, canvas.width, slice);
    const h = slice / pxPerMm;
    pdf.addImage(part.toDataURL('image/jpeg', 0.88), 'JPEG', MARGIN, y, WIDTH, h);
    pdf.setDrawColor(...LINE).setLineWidth(0.3).rect(MARGIN, y, WIDTH, h);
    from += slice;
    if (from < canvas.height) {
      pdf.addPage();
      y = TOP;
    }
  }

  /* ----------------------------------------------------------- code */
  pdf.addPage();
  heading('My code', TOP + 6);
  const fontSize = 8.5;
  const rowH = fontSize * 0.3528 * 1.4;
  const gutter = 11;
  const charW = fontSize * 0.3528 * 0.6;
  const rows = codeRows(data.code, Math.floor((WIDTH - gutter) / charW));
  const lineCount = rows.filter((r) => r.line !== null).length;
  pdf.setFont('helvetica', 'normal').setFontSize(10).setTextColor(...MUTED);
  pdf.text(`my-hobby-page.html, ${lineCount} ${lineCount === 1 ? 'line' : 'lines'}`, MARGIN, TOP + 12);
  y = TOP + 20;
  pdf.setFont('courier', 'normal').setFontSize(fontSize);
  for (const row of rows) {
    if (y > BOTTOM) {
      pdf.addPage();
      pdf.setFont('courier', 'normal').setFontSize(fontSize);
      y = TOP + 4;
    }
    if (row.line !== null) {
      pdf.setTextColor(...MUTED);
      pdf.text(String(row.line), MARGIN + gutter - 3, y, { align: 'right' });
    }
    pdf.setTextColor(...NAVY);
    pdf.text(row.text, MARGIN + gutter, y);
    y += rowH;
  }

  /* -------------------------------------------- header and footer */
  const pages = pdf.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'bold').setFontSize(9).setTextColor(...NAVY);
    pdf.text('NA<>Y BUILDS', MARGIN, 12);
    pdf.setFont('helvetica', 'normal').setTextColor(...MUTED);
    pdf.text(name ? `My hobby page report: ${name}` : 'My hobby page report', PAGE_W - MARGIN, 12, { align: 'right' });
    pdf.setDrawColor(...GOLD).setLineWidth(0.8).line(MARGIN, 15, PAGE_W - MARGIN, 15);
    pdf.text(`Page ${p} of ${pages}`, PAGE_W - MARGIN, PAGE_H - 8, { align: 'right' });
  }

  const file = reportFileName(data.name);
  pdf.save(file);
  return file;
}
