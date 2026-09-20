import { NextResponse } from 'next/server';
import ical from 'node-ical';

import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const DEFAULT_CALENDAR_ICS = 'https://mezquita-calendar.vercel.app/api/calendar';

// La fuente que muestra este panel se guarda en Supabase (admin_calendar_ics)
// en vez de en una variable de entorno, para poder cambiarla desde Calendario
// sin redeploy. Si no hay valor configurado, usa el calendario combinado.
async function getDisplayIcs() {
  const { data } = await supabase
    .from('app_config')
    .select('value')
    .eq('key', 'admin_calendar_ics')
    .maybeSingle();

  return typeof data?.value === 'string' && data.value.trim()
    ? data.value.trim()
    : process.env.CALENDAR_ICS_URL || DEFAULT_CALENDAR_ICS;
}

type ParsedCalendarEvent = {
  type: 'VEVENT';
  uid?: string;
  summary?: string;
  description?: string;
  location?: string;
  start: Date;
  end?: Date;
  rrule?: { between(after: Date, before: Date, inclusive?: boolean): Date[] };
  exdate?: Record<string, Date>;
};

function isCalendarEvent(
  item: unknown
): item is ParsedCalendarEvent {
  if (!item || typeof item !== 'object') {
    return false;
  }

  const candidate = item as Record<string, unknown>;

  return (
    candidate.type === 'VEVENT' &&
    candidate.start instanceof Date
  );
}

// Para un evento con RRULE, node-ical solo rellena start/end con la primera
// aparición histórica — hay que pedirle a la propia rrule todas las
// ocurrencias futuras dentro del horizonte, si no, un evento semanal que
// empezó hace meses (p. ej. las clases de Corán o la Yumu'ah) se descarta por
// "pasado", o solo se ve una vez en vez de cada semana.
function occurrences(event: ParsedCalendarEvent, from: Date, to: Date): { start: Date; end?: Date }[] {
  if (!event.rrule) {
    if ((event.end ?? event.start) < from) return [];
    if (event.start > to) return [];
    return [{ start: event.start, end: event.end }];
  }

  const duration = event.end ? event.end.getTime() - event.start.getTime() : 0;
  const excluded = new Set(Object.keys(event.exdate ?? {}));

  return event.rrule
    .between(from, to, true)
    .filter((date) => !excluded.has(date.toISOString().slice(0, 10)))
    .map((date) => ({ start: date, end: duration ? new Date(date.getTime() + duration) : undefined }));
}

const ALLOWED_LIMITS = [10, 20, 30, 50];

export async function GET(request: Request) {
  try {
    const requestedLimit = Number(new URL(request.url).searchParams.get('limit'));
    const limit = ALLOWED_LIMITS.includes(requestedLimit) ? requestedLimit : 30;

    const calendarUrl = await getDisplayIcs();

    const response = await fetch(calendarUrl, {
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(
        `Error calendario: ${response.status}`
      );
    }

    const icsText = await response.text();
    const parsed = ical.sync.parseICS(icsText);

    // IMPORTANTE:
    // Convertimos explícitamente a unknown[]
    // para que nuestro type guard pueda estrechar el tipo.
    const components: unknown[] =
      Object.values(parsed);

    const now = new Date();
    const horizon = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000);

    const events = components
      .filter(isCalendarEvent)
      .flatMap((event) =>
        occurrences(event, now, horizon).map((occurrence) => ({
          id:
            typeof event.uid === 'string'
              ? `${event.uid}-${occurrence.start.toISOString()}`
              : `${occurrence.start.toISOString()}-${event.summary ?? ''}`,

          title:
            typeof event.summary === 'string'
              ? event.summary
              : 'Evento',

          description:
            typeof event.description === 'string'
              ? event.description
              : '',

          location:
            typeof event.location === 'string'
              ? event.location
              : '',

          start: occurrence.start.toISOString(),

          end: occurrence.end ? occurrence.end.toISOString() : null,
        }))
      )
      .sort(
        (a, b) =>
          new Date(a.start).getTime() -
          new Date(b.start).getTime()
      )
      .slice(0, limit);

    return NextResponse.json({
      connected: true,
      updatedAt: new Date().toISOString(),
      count: events.length,
      events,
    });
  } catch (error) {
    console.error('Calendar API error:', error);

    return NextResponse.json(
      {
        connected: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}