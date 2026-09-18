import { NextResponse } from 'next/server';
import ical from 'node-ical';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const calendarUrl = process.env.CALENDAR_ICS_URL;

    if (!calendarUrl) {
      return NextResponse.json(
        { error: 'CALENDAR_ICS_URL no está configurada' },
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

    const now = new Date();

    const events = Object.values(parsed)
      .filter(
        (item): item is ical.VEvent =>
          item.type === 'VEVENT' &&
          item.start instanceof Date
      )
      .map((event) => ({
        id:
          typeof event.uid === 'string'
            ? event.uid
            : `${event.start.toISOString()}-${event.summary ?? ''}`,

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

        start: event.start.toISOString(),

        end:
          event.end instanceof Date
            ? event.end.toISOString()
            : null,
      }))
      .filter(
        (event) =>
          new Date(event.end ?? event.start) >= now
      )
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
    console.error(error);

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
