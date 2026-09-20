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

  const [limit, setLimit] = useState(30);

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
      const response = await fetch(`/api/calendar?limit=${limit}`, {
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
  }, [limit]);

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
        <h2 className="text-xl font-bold text-primary-dark">Calendario real (Outlook)</h2>
        <p className="mt-2 text-sm text-gray-500">
          El ICS original de la mezquita. Se combina con el Wird para generar el
          calendario que usan la app y este panel.
        </p>

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

        <div className="mt-6 border-t border-gray-100 pt-5">
          <p className="text-sm font-semibold text-gray-500">
            Calendario combinado (Outlook + Wird)
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Esta es la dirección que ya usan la app y este panel — no hace falta
            configurarla en ningún sitio, se genera sola a partir del calendario real de arriba.
          </p>
          <code className="mt-3 block break-all rounded-lg bg-primary-light px-4 py-3 text-sm text-primary-dark">
            https://mezquita-calendar.vercel.app/api/calendar
          </code>
        </div>
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

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-500">
              Mostrar
              <select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                disabled={loading}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"
              >
                <option value={10}>10 eventos</option>
                <option value={20}>20 eventos</option>
                <option value={30}>30 eventos</option>
                <option value={50}>50 eventos</option>
              </select>
            </label>

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
