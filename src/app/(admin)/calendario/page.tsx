'use client';

import { FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  location: string;
  start: string;
  end: string | null;
};

type CalendarResponse = {
  connected: boolean;
  updatedAt?: string;
  count?: number;
  events?: CalendarEvent[];
  error?: string;
};

export default function CalendarioPage() {
  const [data, setData] =
    useState<CalendarResponse | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [sourceIcs, setSourceIcs] = useState('');
  const [sourceLoading, setSourceLoading] = useState(true);
  const [savingSource, setSavingSource] = useState(false);
  const [sourceMessage, setSourceMessage] = useState('');
  const [sourceError, setSourceError] = useState('');

  async function loadSourceIcs() {
    setSourceLoading(true);

    const { data, error } = await supabase
      .from('app_config')
      .select('value')
      .eq('key', 'calendar_source_ics')
      .maybeSingle();

    if (error) {
      setSourceError(error.message);
    } else if (typeof data?.value === 'string') {
      setSourceIcs(data.value);
    }

    setSourceLoading(false);
  }

  async function saveSourceIcs(event: FormEvent) {
    event.preventDefault();

    setSourceError('');
    setSourceMessage('');

    if (/mezquita-calendar[a-z0-9-]*\.vercel\.app/i.test(sourceIcs)) {
      setSourceError('Esta es la dirección del propio calendario combinado — pon aquí el ICS original (p. ej. el de Outlook), no esta URL.');
      return;
    }

    setSavingSource(true);

    const { error } = await supabase
      .from('app_config')
      .update({ value: sourceIcs.trim(), updated_at: new Date().toISOString() })
      .eq('key', 'calendar_source_ics');

    if (error) {
      setSourceError(error.message);
    } else {
      setSourceMessage('Guardado. El nuevo calendario se aplica en la próxima actualización (hasta 30 minutos).');
    }

    setSavingSource(false);
  }

  useEffect(() => {
    loadSourceIcs();
  }, []);

  async function loadCalendar() {
    setLoading(true);

    try {
      const response = await fetch('/api/calendar', {
        cache: 'no-store',
      });

      const result =
        (await response.json()) as CalendarResponse;

      setData(result);
    } catch {
      setData({
        connected: false,
        error: 'No se pudo conectar con el calendario.',
      });
    }

    setLoading(false);
  }

  useEffect(() => {
    loadCalendar();
  }, []);

  function formatDate(value: string) {
    return new Intl.DateTimeFormat('es-ES', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  return (
    <AdminShell
      title="Calendario"
      description="Consulta los eventos publicados en el calendario oficial."
    >
      <section className="mb-8 rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <h2 className="text-xl font-bold text-primary-dark">Calendario de origen</h2>

        <form onSubmit={saveSourceIcs} className="mt-5 flex flex-col gap-3 sm:flex-row">
          <input
            value={sourceIcs}
            onChange={(event) => setSourceIcs(event.target.value)}
            disabled={sourceLoading}
            placeholder="https://.../calendar.ics"
            className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary"
          />

          <button
            type="submit"
            disabled={savingSource || sourceLoading || !sourceIcs.trim()}
            className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
          >
            {savingSource ? 'Guardando…' : 'Guardar'}
          </button>
        </form>

        {sourceMessage ? <p className="mt-3 text-sm font-semibold text-emerald-700">{sourceMessage}</p> : null}
        {sourceError ? <p className="mt-3 text-sm text-red-600">{sourceError}</p> : null}
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Estado
          </p>

          <p className="mt-3 text-xl font-bold text-primary-dark">
            {loading
              ? 'Comprobando…'
              : data?.connected
                ? '✓ Conectado'
                : '✕ Sin conexión'}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Próximos eventos
          </p>

          <p className="mt-3 text-3xl font-bold text-primary-dark">
            {data?.count ?? '—'}
          </p>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">
            Última actualización
          </p>

          <p className="mt-3 text-sm font-bold text-primary-dark">
            {data?.updatedAt
              ? new Intl.DateTimeFormat('es-ES', {
                  hour: '2-digit',
                  minute: '2-digit',
                  day: 'numeric',
                  month: 'short',
                }).format(
                  new Date(data.updatedAt)
                )
              : '—'}
          </p>
        </div>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">
              Próximos eventos
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Información obtenida directamente del calendario.
            </p>
          </div>

          <button
            onClick={loadCalendar}
            disabled={loading}
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading
              ? 'Actualizando…'
              : 'Actualizar'}
          </button>
        </div>

        {!loading && !data?.connected ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {data?.error ??
              'No se pudo cargar el calendario.'}
          </div>
        ) : null}

        <div className="space-y-4">
          {(data?.events ?? []).map((event) => (
            <article
              key={event.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-[#b28b45]">
                    {formatDate(event.start)}
                  </p>

                  <h3 className="mt-2 text-lg font-bold text-primary-dark">
                    {event.title}
                  </h3>

                  {event.location ? (
                    <p className="mt-2 text-sm text-gray-500">
                      {event.location}
                    </p>
                  ) : null}

                  {event.description ? (
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600">
                      {event.description}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
        </div>

        {!loading &&
        data?.connected &&
        data.events?.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
            No hay próximos eventos publicados.
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
