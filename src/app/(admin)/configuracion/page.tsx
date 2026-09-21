'use client';

import { FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

const COMBINED_CALENDAR_URL = 'https://mezquita-calendar.vercel.app/api/calendar';

type ConfigItem = {
  key: string;
  value: unknown;
  description: string | null;
  updated_at?: string | null;
};

const sections = [
  {
    key: 'news_enabled',
    title: 'Noticias',
    description: 'Mostrar las noticias de la web en la app.',
  },
  {
    key: 'events_enabled',
    title: 'Eventos',
    description: 'Mostrar la agenda y los próximos eventos.',
  },
  {
    key: 'youtube_enabled',
    title: 'YouTube',
    description: 'Mostrar vídeos y jutbahs de YouTube.',
  },
  {
    key: 'donations_enabled',
    title: 'Donativos',
    description: 'Mostrar la donación general (sadaqa) en la app.',
  },
  {
    key: 'zakat_enabled',
    title: 'Zakat',
    description: 'Mostrar la calculadora y el pago de Zakat. Actívalo solo cuando un experto haya verificado los cálculos.',
  },
  {
    key: 'qibla_enabled',
    title: 'Qibla',
    description: 'Mostrar la futura sección de orientación de la Qibla.',
  },
  {
    key: 'announcements_enabled',
    title: 'Avisos',
    description: 'Permitir mostrar avisos administrados desde Supabase.',
  },
];

export default function ConfiguracionPage() {
  const [config, setConfig] = useState<Record<string, ConfigItem>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [sourceIcs, setSourceIcs] = useState('');
  const [savingSource, setSavingSource] = useState(false);
  const [sourceMessage, setSourceMessage] = useState('');
  const [sourceError, setSourceError] = useState('');

  useEffect(() => {
    loadConfig();
  }, []);

  useEffect(() => {
    if (typeof config.calendar_source_ics?.value === 'string') {
      setSourceIcs(config.calendar_source_ics.value);
    }
  }, [config.calendar_source_ics]);

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

  async function loadConfig() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('app_config')
      .select('*')
      .order('key');

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    const mapped = Object.fromEntries(
      (data ?? []).map((item) => [item.key, item])
    );

    setConfig(mapped);
    setLoading(false);
  }

  function enabled(key: string) {
    const value = config[key]?.value;

    return value === true || value === 'true';
  }

  async function toggle(key: string) {
    const newValue = !enabled(key);

    setSavingKey(key);
    setError('');
    setMessage('');

    const { error } = await supabase
      .from('app_config')
      .upsert(
        { key, value: newValue, updated_at: new Date().toISOString() },
        { onConflict: 'key' }
      );

    if (error) {
      setError(error.message);
      setSavingKey(null);
      return;
    }

    setConfig((current) => ({
      ...current,
      [key]: {
        ...current[key],
        key,
        value: newValue,
      },
    }));

    setMessage('Configuración guardada.');
    setSavingKey(null);
  }

  return (
    <AdminShell
      title="Configuración"
      description="Controla las funciones y el comportamiento general de la app."
    >
      {loading ? (
        <div className="rounded-3xl bg-white p-8 text-gray-500 shadow-sm">
          Cargando configuración…
        </div>
      ) : (
        <>
          {error ? (
            <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
              {message}
            </div>
          ) : null}

          <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-bold text-primary-dark">
                Secciones de la app
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Activa o desactiva las distintas funciones disponibles.
              </p>
            </div>

            <div className="mt-6 divide-y divide-gray-100">
              {sections.map((section) => {
                const active = enabled(section.key);
                const saving = savingKey === section.key;

                return (
                  <div
                    key={section.key}
                    className="flex flex-col gap-4 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-bold text-primary-dark">
                          {section.title}
                        </h3>

                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            active
                              ? 'bg-emerald-50 text-emerald-700'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {active ? 'Activo' : 'Inactivo'}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-gray-500">
                        {section.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggle(section.key)}
                      className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                        active
                          ? 'bg-primary'
                          : 'bg-gray-300'
                      } disabled:opacity-50`}
                      aria-label={`${active ? 'Desactivar' : 'Activar'} ${section.title}`}
                    >
                      <span
                        className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                          active
                            ? 'left-7'
                            : 'left-1'
                        }`}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-bold text-primary-dark">
                Calendario
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                El ICS real de la mezquita (Outlook u otro proveedor). Se
                combina con el Wird para generar el calendario que usan la
                app y el panel.
              </p>
            </div>

            <form onSubmit={saveSourceIcs} className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                value={sourceIcs}
                onChange={(event) => setSourceIcs(event.target.value)}
                placeholder="https://.../calendar.ics"
                className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary"
              />

              <button
                type="submit"
                disabled={savingSource || !sourceIcs.trim()}
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
                Dirección que ya usan la app y el panel — se genera sola a partir
                del calendario real de arriba, no hace falta configurarla.
              </p>
              <code className="mt-3 block break-all rounded-lg bg-primary-light px-4 py-3 text-sm text-primary-dark">
                {COMBINED_CALENDAR_URL}
              </code>
            </div>
          </section>

          <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div>
              <h2 className="text-xl font-bold text-primary-dark">
                Sistema
              </h2>

              <p className="mt-2 text-sm text-gray-500">
                Opciones generales de funcionamiento.
              </p>
            </div>

            <div className="mt-6">
              <div className="flex flex-col gap-4 rounded-2xl border border-amber-100 bg-amber-50/50 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="font-bold text-primary-dark">
                      Modo mantenimiento
                    </h3>

                    {enabled('maintenance_mode') ? (
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-800">
                        ACTIVO
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1 text-sm text-gray-600">
                    Permite indicar a la app que se encuentra temporalmente en mantenimiento.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={savingKey === 'maintenance_mode'}
                  onClick={() => toggle('maintenance_mode')}
                  className={`relative h-8 w-14 shrink-0 rounded-full transition ${
                    enabled('maintenance_mode')
                      ? 'bg-amber-600'
                      : 'bg-gray-300'
                  } disabled:opacity-50`}
                >
                  <span
                    className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow transition-all ${
                      enabled('maintenance_mode')
                        ? 'left-7'
                        : 'left-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </section>

          <section className="mt-6 rounded-3xl border border-[#d8b66f]/30 bg-[#fffdf8] p-6">
            <p className="text-xs font-black tracking-[0.18em] text-[#b28b45]">
              BACKEND
            </p>

            <h2 className="mt-2 font-bold text-primary-dark">
              Supabase conectado
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Los cambios realizados aquí se guardan directamente en
              <code className="mx-1 rounded bg-gray-100 px-1.5 py-0.5">
                app_config
              </code>
              .
            </p>
          </section>
        </>
      )}
    </AdminShell>
  );
}
