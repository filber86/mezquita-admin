import { NextResponse } from 'next/server';
import ical from 'node-ical';

export const dynamic = 'force-dynamic';

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
// aparición histórica — hay que pedirle a la propia rrule la próxima
// ocurrencia futura, si no, un evento semanal que empezó hace meses (p. ej.
// la Yumu'ah) se descarta por "pasado" aunque siga repitiéndose cada semana.
function nextOccurrence(event: ParsedCalendarEvent, from: Date): { start: Date; end?: Date } | null {
  if (!event.rrule) {
    return { start: event.start, end: event.end };
  }

  const duration = event.end ? event.end.getTime() - event.start.getTime() : 0;
  const horizon = new Date(from.getTime() + 365 * 24 * 60 * 60 * 1000);
  const excluded = new Set(Object.keys(event.exdate ?? {}));

  const occurrence = event.rrule
    .between(from, horizon, true)
    .find((date) => !excluded.has(date.toISOString().slice(0, 10)));

  if (!occurrence) return null;

  return { start: occurrence, end: duration ? new Date(occurrence.getTime() + duration) : undefined };
}

export async function GET() {
  try {
    const calendarUrl = process.env.CALENDAR_ICS_URL;

    if (!calendarUrl) {
      return NextResponse.json(
        {
          connected: false,
          error: 'CALENDAR_ICS_URL no está configurada',
        },
        { status: 500 }
      );
    }

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

    const events = components
      .filter(isCalendarEvent)
      .flatMap((event) => {
        const occurrence = nextOccurrence(event, now);
        if (!occurrence) return [];
        if ((occurrence.end ?? occurrence.start) < now) return [];

        return [
          {
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
          },
        ];
      })
      .sort(
        (a, b) =>
          new Date(a.start).getTime() -
          new Date(b.start).getTime()
      )
      .slice(0, 30);

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