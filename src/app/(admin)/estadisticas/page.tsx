'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

// Datos de app_stats_report() (sql/app_stats.sql): totales anónimos, sin nada de cada persona.
type Daily = { day: string; active: number | null; opens: number | null };
type Item = { event: 'screen' | 'section' | 'action'; name: string; total: number };
type Share = { key: string; total: number };
type Report = { daily: Daily[]; items: Item[]; platforms: Share[]; versions: Share[]; languages: Share[] };

const RANGES = [7, 30, 90] as const;

// App publicada, app de pruebas (canal preview, versiones X.Y.Z-preview) o las dos.
const CHANNELS = [
  { key: 'production', label: 'Producción' },
  { key: 'preview', label: 'Preview' },
  { key: 'all', label: 'Producción y preview' },
] as const;
type Channel = (typeof CHANNELS)[number]['key'];

const LABELS: Record<string, string> = {
  inicio: 'Inicio',
  oraciones: 'Oraciones',
  agenda: 'Agenda',
  contenido: 'Contenido',
  mas: 'Más',
  quran: 'Corán',
  guide: 'Guía para nuevos musulmanes',
  learn: 'Aprender',
  dua: 'Du\'a nasiri',
  qibla: 'Qibla',
  zakat: 'Zakat',
  favorites: 'Favoritos',
  editorial: 'Madrasa Editorial',
  fiqh: 'Consultas de fiqh',
  about: 'Acerca de',
  fiqh_sent: 'Consultas de fiqh enviadas',
  registration_sent: 'Inscripciones en actividades',
  khutbah_play: 'Jutbah escuchada',
  dua_audio_play: 'Du\'a escuchado',
  donation_paid: 'Donativos pagados',
  zakat_paid: 'Zakat pagado',
  place_changed: 'Cambios de ciudad',
  month_sheet_shared: 'Hoja del mes compartida',
  ios: 'iOS',
  android: 'Android',
  es: 'Español',
  en: 'Inglés',
};

const label = (key: string) => LABELS[key] ?? key.replace(/-preview$/, ' (preview)');
const number = (value: number) => new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 }).format(value);

// Hoy en Madrid (AAAA-MM-DD), el mismo día que usa track_events().
function madridToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());
}

function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function Bars({ rows }: { rows: { key: string; total: number }[] }) {
  const max = Math.max(1, ...rows.map((row) => row.total));
  if (rows.length === 0) {
    return <p className="text-sm text-gray-500">Sin datos en este periodo.</p>;
  }
  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li key={row.key}>
          <div className="flex justify-between gap-3 text-sm">
            <span className="font-semibold text-gray-700">{label(row.key)}</span>
            <span className="tabular-nums text-gray-500">{number(row.total)}</span>
          </div>
          <div className="mt-1 h-2 rounded-full bg-[#f5f6f3]">
            <div className="h-2 rounded-full bg-primary" style={{ width: `${(row.total / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function FilterSelect({
  value,
  onChange,
  options,
  allLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  allLabel: string;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`rounded-xl px-3 py-2 text-sm font-semibold ${
        value ? 'bg-primary text-white' : 'bg-[#f5f6f3] text-gray-600'
      }`}
    >
      <option value="">{allLabel}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {label(option)}
        </option>
      ))}
    </select>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-bold text-primary-dark">{title}</h2>
      {children}
    </section>
  );
}

export default function EstadisticasPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [channel, setChannel] = useState<Channel>('production');
  // Filtros opcionales; '' = todos.
  const [platform, setPlatform] = useState('');
  const [version, setVersion] = useState('');
  const [lang, setLang] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const to = madridToday();
  const from = addDays(to, -(days - 1));

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      const { data, error } = await supabase.rpc('app_stats_report', {
        p_from: from,
        p_to: to,
        p_include_preview: channel === 'all',
        ...(channel === 'preview' ? { p_preview_only: true } : {}),
        // Solo los filtros elegidos, para que sin filtros la llamada sea la misma de antes.
        ...(platform ? { p_platform: platform } : {}),
        ...(version ? { p_version: version } : {}),
        ...(lang ? { p_lang: lang } : {}),
      });
      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setReport(data as Report);
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [from, to, channel, platform, version, lang]);

  // Todos los días del periodo, también los que no tienen datos, para que la gráfica no se salte huecos.
  const daily = useMemo(() => {
    const byDay = new Map((report?.daily ?? []).map((row) => [row.day, row]));
    return Array.from({ length: days }, (_, index) => {
      const day = addDays(from, index);
      const row = byDay.get(day);
      return { day, active: Number(row?.active ?? 0), opens: Number(row?.opens ?? 0) };
    });
  }, [report, days, from]);

  const totals = useMemo(() => {
    const active = daily.reduce((sum, row) => sum + row.active, 0);
    const opens = daily.reduce((sum, row) => sum + row.opens, 0);
    // Media de los días con datos: los anteriores al arranque de las estadísticas no cuentan como días sin usuarios.
    const daysWithData = daily.filter((row) => row.active > 0).length;
    return {
      averageActive: daysWithData ? active / daysWithData : 0,
      maxActive: Math.max(0, ...daily.map((row) => row.active)),
      opens,
    };
  }, [daily]);

  const itemsOf = (event: Item['event']) =>
    (report?.items ?? [])
      .filter((item) => item.event === event)
      .map((item) => ({ key: item.name, total: Number(item.total) }));
  const shares = (rows: Share[] | undefined) => (rows ?? []).map((row) => ({ key: row.key, total: Number(row.total) }));

  // Opciones de cada filtro: las que tienen usuarios con los otros filtros puestos (el informe no aplica a cada
  // reparto su propio filtro), más la elegida aunque se haya quedado sin datos.
  const optionsOf = (rows: Share[] | undefined, selected: string, sort?: (a: string, b: string) => number) => {
    const keys = (rows ?? []).map((row) => row.key);
    if (selected && !keys.includes(selected)) keys.push(selected);
    return sort ? keys.sort(sort) : keys;
  };
  const newestFirst = (a: string, b: string) => b.localeCompare(a, 'en', { numeric: true });
  const filtered = Boolean(platform || version || lang);

  const maxDaily = Math.max(1, ...daily.map((row) => row.active));
  const dayFormat = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <AdminShell
      title="Estadísticas"
      description="Uso de la app, anónimo: solo totales por día, sin datos de las personas ni de sus móviles."
    >
      <section className="mb-6 flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
        <div className="flex gap-2">
          {RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDays(range)}
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                days === range ? 'bg-primary text-white' : 'bg-[#f5f6f3] text-gray-600'
              }`}
            >
              {range} días
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <FilterSelect value={platform} onChange={setPlatform} allLabel="Todas las plataformas"
            options={optionsOf(report?.platforms, platform)} />
          <FilterSelect value={version} onChange={setVersion} allLabel="Todas las versiones"
            options={optionsOf(report?.versions, version, newestFirst)} />
          <FilterSelect value={lang} onChange={setLang} allLabel="Todos los idiomas"
            options={optionsOf(report?.languages, lang)} />
          {filtered ? (
            <button
              onClick={() => {
                setPlatform('');
                setVersion('');
                setLang('');
              }}
              className="px-2 text-sm font-semibold text-primary"
            >
              Quitar filtros
            </button>
          ) : null}
        </div>

        <select
          value={channel}
          onChange={(event) => {
            const next = event.target.value as Channel;
            setChannel(next);
            // La versión elegida puede no existir en el canal nuevo.
            if ((next === 'production' && version.endsWith('-preview')) || (next === 'preview' && !version.endsWith('-preview'))) {
              setVersion('');
            }
          }}
          className="rounded-xl bg-[#f5f6f3] px-3 py-2 text-sm font-semibold text-gray-600"
        >
          {CHANNELS.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Usuarios al día (media)</p>
          <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : number(totals.averageActive)}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Día con más usuarios</p>
          <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : number(totals.maxActive)}</p>
        </div>
        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Aperturas de la app</p>
          <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : number(totals.opens)}</p>
        </div>
      </section>

      <div className="mt-6">
        <Panel title="Usuarios por día">
          <div className="flex h-40 items-end gap-[2px]">
            {daily.map((row) => (
              <div
                key={row.day}
                className="flex-1 rounded-t bg-primary/80 hover:bg-primary"
                style={{ height: `${(row.active / maxDaily) * 100}%`, minHeight: row.active ? 2 : 0 }}
                title={`${dayFormat.format(new Date(`${row.day}T12:00:00Z`))}: ${row.active} usuarios, ${row.opens} aperturas`}
              />
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-gray-400">
            <span>{dayFormat.format(new Date(`${from}T12:00:00Z`))}</span>
            <span>{dayFormat.format(new Date(`${to}T12:00:00Z`))}</span>
          </div>
        </Panel>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panel title="Pestañas">
          <Bars rows={itemsOf('screen')} />
        </Panel>
        <Panel title="Secciones de Más">
          <Bars rows={itemsOf('section')} />
        </Panel>
        <Panel title="Acciones">
          <Bars rows={itemsOf('action')} />
        </Panel>
        <Panel title="Usuarios por plataforma, versión e idioma">
          <div className="space-y-6">
            <Bars rows={shares(report?.platforms)} />
            <Bars rows={shares(report?.versions)} />
            <Bars rows={shares(report?.languages)} />
          </div>
        </Panel>
      </div>

      <p className="mt-6 text-xs text-gray-400">
        Cada móvil cuenta como usuario una vez al día. En el reparto por plataforma, versión e idioma, una persona que usa
        la app varios días cuenta una vez por día. Con filtros, cada reparto aplica los demás filtros pero no el suyo.
      </p>
    </AdminShell>
  );
}
