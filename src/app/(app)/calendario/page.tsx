import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui";
import { ReservationCalendar, type CalView } from "@/components/calendar";

export const metadata = { title: "Calendario" };
export const dynamic = "force-dynamic";

export default async function CalendarioPage({ searchParams }: { searchParams: { view?: string; date?: string } }) {
  const user = await requireUser();
  const view = (["day", "week", "month"].includes(searchParams.view ?? "") ? searchParams.view : "week") as CalView;
  return (
    <div>
      <PageHeader title="Calendario de reservas" subtitle="Disponibilidad de toda la flota" back="/reservas" actions={<Link href="/reservar" className="btn-primary"><CalendarPlus className="h-4 w-4" /> Reservar</Link>} />
      <ReservationCalendar user={user} view={view} date={searchParams.date} basePath="/calendario" />
    </div>
  );
}
