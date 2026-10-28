import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { GCRow } from '../screens/GCDashboard';

type RGB = [number, number, number];

// Legacy PM Assistant palette, as RGB (see tailwind.config.js).
const BLUE_DARK: RGB = [0, 48, 88];       // #003058: header, primary text
const BLUE_LIGHT: RGB = [24, 56, 95];     // #18385f: secondary text
const TINT: RGB = [243, 245, 247];        // blue-light at 5% over white
const LINE: RGB = [214, 220, 227];        // blue-light at ~15% over white
const WHITE: RGB = [255, 255, 255];

// Score → text color (mirrors the dashboard: green / amber / Legacy red)
function scoreColor(v: number): RGB {
  if (v >= 3.5) return [4, 120, 87];      // emerald-700
  if (v >= 2.0) return [217, 119, 6];     // amber-600
  return [238, 52, 40];                    // legacy-red
}

function fmtScore(v: number | null): string {
  if (v == null || v === 0) return '—';
  return v.toFixed(1);
}

export function generatePeriodicReport(rows: GCRow[]): void {
  const eligible = rows
    .filter((r) => r.rating_count > 0 && r.overall_score != null)
    .sort((a, b) => (b.overall_score ?? 0) - (a.overall_score ?? 0));

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'letter' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 36;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // ── Header band ──────────────────────────────────────────────────────────
  doc.setFillColor(...BLUE_DARK);
  doc.rect(0, 0, pageW, 72, 'F');

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(...WHITE);
  doc.text('GC Performance Report', margin, 30);

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(215, 225, 236);
  doc.text('All-time data · Ranked by Overall Score (highest to lowest)', margin, 46);

  // Date (right-aligned)
  doc.setFontSize(9);
  doc.setTextColor(190, 205, 222);
  doc.text(`Generated ${dateStr}`, pageW - margin, 30, { align: 'right' });

  // GC count
  doc.text(
    `${eligible.length} contractor${eligible.length !== 1 ? 's' : ''} with PM reports`,
    pageW - margin, 46, { align: 'right' },
  );

  // Score key strip
  doc.setFillColor(...TINT);
  doc.rect(0, 72, pageW, 20, 'F');
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.line(0, 92, pageW, 92);
  doc.setFontSize(7.5);
  const keyItems: [string, RGB][] = [
    ['Score key:', BLUE_LIGHT],
    ['3.5 – 5.0  Excellent', scoreColor(5)],
    ['2.0 – 3.4  Satisfactory', scoreColor(3)],
    ['1.0 – 1.9  Poor', scoreColor(1)],
    ['—  No data', BLUE_LIGHT],
  ];
  let kx = margin;
  for (const [text, color] of keyItems) {
    doc.setTextColor(...color);
    doc.text(text, kx, 85);
    kx += doc.getTextWidth(text) + 18;
  }

  // ── Table ────────────────────────────────────────────────────────────────
  const top5Ids = new Set(eligible.slice(0, 5).map((r) => r.id));

  const COLS = [
    { header: 'Rank', key: null as null },
    { header: 'GC Name', key: null as null },
    { header: 'Overall', key: 'overall_score' as keyof GCRow },
    { header: 'Payment', key: 'payment_timeline' as keyof GCRow },
    { header: 'CO Appr.', key: 'co_approval_timeline' as keyof GCRow },
    { header: 'CO Neg.', key: 'co_negotiations' as keyof GCRow },
    { header: 'Contract', key: 'contract_terms' as keyof GCRow },
    { header: 'Conflict', key: 'conflict_mitigation' as keyof GCRow },
    { header: 'Stacking', key: 'schedule_trade_stacking' as keyof GCRow },
    { header: 'Accuracy', key: 'schedule_accuracy' as keyof GCRow },
    { header: 'Site', key: 'site_control' as keyof GCRow },
    { header: 'PM Rel.', key: 'relationship' as keyof GCRow },
    { header: 'Safety', key: 'safety' as keyof GCRow },
    { header: 'Est Rel.', key: 'est_relationship' as keyof GCRow },
    { header: 'Bids', key: 'total_bids' as keyof GCRow },
    { header: 'Hit Rate ($)', key: 'hit_rate_dollar_score' as keyof GCRow },
    { header: '# Reports', key: 'rating_count' as keyof GCRow },
  ];

  const bodyData = eligible.map((row, idx) => [
    String(idx + 1),
    row.name,
    ...COLS.slice(2).map((c) => fmtScore(row[c.key!] as number | null)),
  ]);

  autoTable(doc, {
    startY: 100,
    head: [COLS.map((c) => c.header)],
    body: bodyData,
    margin: { left: margin, right: margin },
    tableWidth: pageW - margin * 2,
    styles: {
      fontSize: 7.5,
      cellPadding: { top: 4, bottom: 4, left: 4, right: 4 },
      font: 'helvetica',
      textColor: BLUE_DARK,
      fillColor: WHITE,
      lineColor: LINE,
      lineWidth: 0.5,
      halign: 'center',
      valign: 'middle',
    },
    headStyles: {
      fillColor: TINT,
      textColor: BLUE_LIGHT,
      fontStyle: 'bold',
      fontSize: 7,
    },
    columnStyles: {
      0: { cellWidth: 28, halign: 'center' },
      1: { cellWidth: 130, halign: 'left', fontStyle: 'normal' },
    },
    didParseCell(data) {
      if (data.section === 'body') {
        const row = eligible[data.row.index];
        const isTop5 = top5Ids.has(row.id);

        if (isTop5) {
          data.cell.styles.fillColor = TINT;
        }

        if (data.column.index >= 2 && data.cell.text[0] !== '—') {
          const v = parseFloat(data.cell.text[0]);
          if (!isNaN(v)) {
            data.cell.styles.textColor = scoreColor(v);
            data.cell.styles.fontStyle = 'bold';
          }
        }

        if (data.column.index === 1 && isTop5) {
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
  });

  // ── "View online" block on last page ─────────────────────────────────────
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
  const blockTop = finalY + 18;
  const blockH = 32;
  const blockX = pageW / 2 - 140;
  const blockW = 280;

  // Subtle background pill
  doc.setFillColor(...TINT);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.5);
  doc.roundedRect(blockX, blockTop, blockW, blockH, 4, 4, 'FD');

  // Label
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...BLUE_LIGHT);
  doc.text('View live data & full contractor profiles at', pageW / 2, blockTop + 12, { align: 'center' });

  // Link — slightly larger, dark blue, underlined
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...BLUE_DARK);
  const linkText = 'gc-rating-project.vercel.app';
  const linkX = pageW / 2 - doc.getTextWidth(linkText) / 2;
  const linkY = blockTop + 24;
  doc.textWithLink(linkText, pageW / 2, linkY, { align: 'center', url: 'https://gc-rating-project.vercel.app/' });
  // Underline
  doc.setDrawColor(...BLUE_DARK);
  doc.setLineWidth(0.4);
  doc.line(linkX, linkY + 1.5, linkX + doc.getTextWidth(linkText), linkY + 1.5);

  // ── Footer on every page ─────────────────────────────────────────────────
  // Stamped once the table is done, so the total page count is known.
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(...BLUE_LIGHT);
    doc.text(`Page ${page} of ${totalPages}`, pageW / 2, pageH - 14, { align: 'center' });
    doc.text('Confidential — Internal Use Only', margin, pageH - 14);
  }

  const fileName = `GC-Performance-Report-${now.toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
