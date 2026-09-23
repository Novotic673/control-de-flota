import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getSessionUser } from "@/lib/auth/session";
import { hasPermission, PERMISSIONS as P } from "@/lib/auth/permissions";
import { buildReport, parseReportFilters } from "@/lib/services/reports";
import { reportTables } from "@/lib/services/report-tables";
import { audit } from "@/lib/audit";
import { rateLimit } from "@/lib/rate-limit";
import { fmtCLP, fmtKm } from "@/lib/format";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user || !hasPermission(user.permissions, P.REPORT_VIEW)) return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  if (!rateLimit(`export:${user.id}`, 20, 60_000).ok) return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });

  const sp = Object.fromEntries(new URL(req.url).searchParams);
  const format = sp.format === "xlsx" || sp.format === "pdf" ? sp.format : "csv";
  const filters = parseReportFilters(sp);
  const report = await buildReport(filters);
  const tables = reportTables(report);
  const stamp = `${filters.from}_${filters.to}`;
  await audit({ action: "DOCUMENT_DOWNLOAD", userId: user.id, entity: "Report", summary: `Exportación reporte ${format.toUpperCase()} ${filters.from} → ${filters.to}`, metadata: filters });

  if (format === "csv") {
    const t = tables.find((x) => x.key === sp.section) ?? tables[0];
    const esc = (v: unknown) => {
      const s = v == null ? "" : String(v);
      return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    // BOM + ";" para que Excel en configuración regional chilena lo abra correctamente.
    const body = "﻿" + [t.columns, ...t.rows].map((r) => r.map(esc).join(";")).join("\r\n");
    return new NextResponse(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="novotic-fleet-${t.key}-${stamp}.csv"` } });
  }

  if (format === "xlsx") {
    const wb = new ExcelJS.Workbook();
    wb.creator = "Novotic Fleet";
    const summary = wb.addWorksheet("Resumen");
    summary.addRows([
      ["Novotic Fleet — Reporte de flota"], [`Período: ${filters.from} a ${filters.to}`], [],
      ["Vehículos", report.summary.vehicles], ["Viajes", report.summary.trips], ["Kilómetros", report.summary.km],
      ["Costo total CLP", report.summary.cost], ["Costo por km CLP", report.summary.costPerKm ?? "—"],
      ["Mantenciones", report.summary.maintenanceCount], ["Costo mantenciones CLP", report.summary.maintenanceCost],
      ["Incidencias", report.summary.incidents], ["Reservas", report.summary.reservations], ["Documentos vencidos", report.summary.expiredDocs],
    ]);
    summary.getCell("A1").font = { bold: true, size: 14 };
    summary.getColumn(1).width = 28;
    summary.getColumn(2).width = 18;
    for (const t of tables) {
      const ws = wb.addWorksheet(t.title.slice(0, 31));
      ws.addRow(t.columns).font = { bold: true, color: { argb: "FFFFFFFF" } };
      ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF124CC2" } };
      t.rows.forEach((r) => ws.addRow(r));
      ws.columns.forEach((c, i) => {
        c.width = Math.min(45, Math.max(12, t.columns[i].length + 4, ...t.rows.map((r) => String(r[i] ?? "").length + 2)));
        if (/CLP|Km|Costo/.test(t.columns[i])) c.numFmt = "#,##0";
      });
      ws.views = [{ state: "frozen", ySplit: 1 }];
      ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: t.columns.length } };
    }
    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(Buffer.from(buf), { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="novotic-fleet-reporte-${stamp}.xlsx"` } });
  }

  // PDF
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(16).setFont("helvetica", "bold").text("Novotic Fleet — Reporte de flota", 40, 44);
  doc.setFontSize(10).setFont("helvetica", "normal").text(`Período: ${filters.from} a ${filters.to}   ·   Generado por ${user.name}`, 40, 62);
  const s = report.summary;
  autoTable(doc, {
    startY: 76, theme: "plain", styles: { fontSize: 10 },
    body: [[`Vehículos: ${s.vehicles}`, `Viajes: ${s.trips}`, `Km: ${fmtKm(s.km)}`, `Costo: ${fmtCLP(s.cost)}`, `Costo/km: ${s.costPerKm != null ? fmtCLP(s.costPerKm) : "—"}`, `Incidencias: ${s.incidents}`]],
  });
  for (const t of tables) {
    if (!t.rows.length) continue;
    const y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 22;
    doc.setFontSize(12).setFont("helvetica", "bold").text(t.title, 40, y);
    autoTable(doc, {
      startY: y + 6, head: [t.columns], body: t.rows.map((r) => r.map((v) => (typeof v === "number" ? v.toLocaleString("es-CL") : v ?? "—"))),
      styles: { fontSize: 8, cellPadding: 4 }, headStyles: { fillColor: [18, 76, 194] }, alternateRowStyles: { fillColor: [244, 246, 249] }, margin: { left: 40, right: 40 },
    });
  }
  const pdf = Buffer.from(doc.output("arraybuffer"));
  return new NextResponse(pdf, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="novotic-fleet-reporte-${stamp}.pdf"` } });
}
