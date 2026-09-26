import type { Metadata } from "next";
import { calendarEvents } from "@/lib/data";

export const metadata: Metadata = { title: "Calendar" };

const DAYS = Array.from({ length: 30 }, (_, i) => i + 1);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function CalendarPage() {
  const events = calendarEvents();
  const byDay = new Map<number, typeof events>();
  for (const e of events) byDay.set(e.day, [...(byDay.get(e.day) ?? []), e]);

  return (
    <main id="app-root" data-app="calendar" data-page-title="Calendar" className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">September</h1>
      <p className="text-sm text-stone-600">{events.length} events. Days are simulated days 1–30.</p>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-stone-300 bg-stone-300">
        {WEEKDAYS.map((w) => (
          <div key={w} className="bg-stone-100 px-2 py-1 text-xs font-medium text-stone-600">
            {w}
          </div>
        ))}
        {DAYS.map((day) => {
          const list = (byDay.get(day) ?? []).sort((a, b) => a.start.localeCompare(b.start));
          return (
            <div key={day} data-day={day} className="min-h-24 bg-white p-2">
              <div className="mb-1 text-xs font-medium text-stone-500">{day}</div>
              <ul className="flex flex-col gap-1">
                {list.map((e) => (
                  <li key={e._id} data-event-id={e._id} className="rounded bg-stone-100 px-1.5 py-0.5 text-xs leading-4" title={`${e.title} ${e.start}–${e.end}${e.location ? ` · ${e.location}` : ""}`}>
                    <span className="text-stone-500">{e.start}</span> {e.title}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </main>
  );
}
