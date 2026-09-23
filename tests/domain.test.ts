import { describe, expect, it } from "vitest";
import { evaluatePlan, computeNextDue, levelForKm } from "@/lib/domain/maintenance";
import { documentStatus, documentAlertMilestone } from "@/lib/domain/documents";
import { checkCheckinReading, checkCheckoutReading, checkManualAdjustment } from "@/lib/domain/odometer";
import { rangesOverlap, validateReservationWindow, canCheckoutReservation } from "@/lib/domain/reservations";
import { effectiveStatus, reservableReason } from "@/lib/domain/vehicle-status";
import { DEFAULT_SETTINGS as S } from "@/lib/domain/settings-defaults";
import { normalizePlate, displayPlate } from "@/lib/format";
import { validRut } from "@/lib/validation";
import { sniff } from "@/lib/storage/sniff";

const T = S.maintenanceKmThresholds;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("mantenciones", () => {
  it("ejemplo del requerimiento: 47.350 → 50.000 = 2.650 km restantes", () => {
    const e = evaluatePlan({ mode: "KM", nextDueKm: 50000, nextDueDate: null, lastDoneKm: 40000, intervalKm: 10000 }, 47350, S);
    expect(e.kmRemaining).toBe(2650);
    expect(e.level).toBe("INFO");
    expect(e.progressPct).toBe(74);
  });
  it("umbrales configurables 5000/2000/1000/500/0", () => {
    expect(levelForKm(6000, T)).toBe("OK");
    expect(levelForKm(5000, T)).toBe("INFO");
    expect(levelForKm(2000, T)).toBe("WARNING");
    expect(levelForKm(1000, T)).toBe("IMPORTANT");
    expect(levelForKm(500, T)).toBe("CRITICAL");
    expect(levelForKm(0, T)).toBe("OVERDUE");
    expect(levelForKm(-100, T)).toBe("OVERDUE");
  });
  it("modo km+fecha toma el peor de ambos", () => {
    const now = new Date("2026-09-23T15:00:00Z");
    const e = evaluatePlan({ mode: "KM_AND_DATE", nextDueKm: 90000, nextDueDate: d("2026-09-25"), lastDoneKm: 80000, intervalKm: 10000 }, 81000, S, now);
    expect(e.daysRemaining).toBe(2);
    expect(e.level).toBe("CRITICAL");
  });
  it("calcula próximo vencimiento según intervalo", () => {
    const n = computeNextDue({ mode: "KM_AND_DATE", intervalKm: 10000, intervalMonths: 6 }, 52587, d("2026-09-23"));
    expect(n.nextDueKm).toBe(62587);
    expect(n.nextDueDate?.toISOString().slice(0, 10)).toBe("2027-03-23");
  });
});

describe("documentos", () => {
  const now = new Date("2026-09-23T15:00:00Z");
  it("estados vigente / próximo / vencido", () => {
    expect(documentStatus(d("2027-03-31"), 30, now).status).toBe("VALID");
    expect(documentStatus(d("2026-10-10"), 30, now).status).toBe("EXPIRING");
    expect(documentStatus(d("2026-09-22"), 30, now).status).toBe("EXPIRED");
    expect(documentStatus(null, 30, now).status).toBe("NO_EXPIRY");
  });
  it("hitos 60/30/15/7 días", () => {
    expect(documentAlertMilestone(90, [60, 30, 15, 7])).toBeNull();
    expect(documentAlertMilestone(45, [60, 30, 15, 7])).toBe(60);
    expect(documentAlertMilestone(7, [60, 30, 15, 7])).toBe(7);
    expect(documentAlertMilestone(-1, [60, 30, 15, 7])).toBe("EXPIRED");
  });
});

describe("kilometraje", () => {
  it("no permite km final menor al inicial", () => {
    expect(checkCheckinReading(52000, 52450, { tripKmConfirm: 800, maxAvgSpeedKmh: 120, hoursElapsed: 8 }).ok).toBe(false);
  });
  it("ejemplo: 52.450 → 52.587 = 137 km sin confirmación", () => {
    const r = checkCheckinReading(52587, 52450, { tripKmConfirm: 800, maxAvgSpeedKmh: 120, hoursElapsed: 8 });
    expect(r).toEqual({ ok: true });
  });
  it("pide confirmación ante valores anómalos", () => {
    const r = checkCheckinReading(53450, 52450, { tripKmConfirm: 800, maxAvgSpeedKmh: 120, hoursElapsed: 8 });
    expect(r.ok && r.confirm).toBeTruthy();
    const fast = checkCheckinReading(52850, 52450, { tripKmConfirm: 800, maxAvgSpeedKmh: 120, hoursElapsed: 1 });
    expect(fast.ok && fast.confirm).toBeTruthy();
  });
  it("retiro: no retrocede y confirma saltos", () => {
    expect(checkCheckoutReading(52000, 52450, 50).ok).toBe(false);
    const gap = checkCheckoutReading(52600, 52450, 50);
    expect(gap.ok && gap.confirm).toBeTruthy();
    expect(checkCheckoutReading(52460, 52450, 50)).toEqual({ ok: true });
  });
  it("ajuste manual exige motivo", () => {
    expect(checkManualAdjustment(1000, "").ok).toBe(false);
    expect(checkManualAdjustment(1000, "corrección lectura").ok).toBe(true);
  });
});

describe("reservas", () => {
  const h = (hh: number) => new Date(Date.UTC(2026, 8, 24, hh));
  it("detecta superposición en rango semiabierto", () => {
    expect(rangesOverlap(h(9), h(12), h(11), h(13))).toBe(true);
    expect(rangesOverlap(h(9), h(12), h(12), h(14))).toBe(false);
    expect(rangesOverlap(h(9), h(18), h(10), h(11))).toBe(true);
  });
  it("valida ventana", () => {
    const now = h(8);
    expect(validateReservationWindow(h(10), h(9), { maxHours: 48, now })).toMatch(/posterior/);
    expect(validateReservationWindow(h(5), h(9), { maxHours: 48, now })).toMatch(/pasado/);
    expect(validateReservationWindow(h(9), h(12), { maxHours: 48, now })).toBeNull();
  });
  it("retiro permitido desde 60 min antes", () => {
    const r = { status: "CONFIRMED", startAt: h(9), endAt: h(17) };
    expect(canCheckoutReservation(r, 60, new Date(Date.UTC(2026, 8, 24, 7, 30)))).not.toBeNull();
    expect(canCheckoutReservation(r, 60, new Date(Date.UTC(2026, 8, 24, 8, 15)))).toBeNull();
    expect(canCheckoutReservation({ ...r, status: "PENDING" }, 60, h(10))).toMatch(/aprobada/);
  });
});

describe("estado del vehículo", () => {
  it("RESERVADO se deriva de una reserva vigente", () => {
    expect(effectiveStatus("AVAILABLE", true)).toBe("RESERVED");
    expect(effectiveStatus("IN_USE", true)).toBe("IN_USE");
  });
  it("no reservable en mantención, fuera de servicio, bloqueado o mantención vencida", () => {
    expect(reservableReason({ status: "MAINTENANCE", blocked: false })).toBeTruthy();
    expect(reservableReason({ status: "OUT_OF_SERVICE", blocked: false })).toBeTruthy();
    expect(reservableReason({ status: "AVAILABLE", blocked: true })).toBeTruthy();
    expect(reservableReason({ status: "AVAILABLE", blocked: false, overdueBlockingMaintenance: true })).toBeTruthy();
    expect(reservableReason({ status: "AVAILABLE", blocked: false })).toBeNull();
  });
});

describe("utilidades", () => {
  it("patentes chilenas", () => {
    expect(normalizePlate("rt-kp 45")).toBe("RTKP45");
    expect(displayPlate("RTKP45")).toBe("RTKP-45");
    expect(displayPlate("AB1234")).toBe("AB-1234");
  });
  it("RUT", () => {
    expect(validRut("11.111.111-1")).toBe(true);
    expect(validRut("12.345.678-5")).toBe(true);
    expect(validRut("12.345.678-9")).toBe(false);
  });
  it("detección de tipo real de archivo", () => {
    expect(sniff(Buffer.from("%PDF-1.7 xxxxxxxx"))?.mime).toBe("application/pdf");
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]))?.mime).toBe("image/jpeg");
    expect(sniff(Buffer.from("<html><script>alert(1)</script>"))).toBeNull();
  });
});
