'use client';

import { FormEvent, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

type MonthStart = { year: number; month: number; start: string };

const MONTH_NAMES = [
  'Muharram', 'Safar', "Rabi' al-awwal", "Rabi' al-thani", 'Jumada al-awwal', 'Jumada al-thani',
  'Rajab', "Sha'ban", 'Ramadan', 'Shawwal', "Dhu al-Qa'da", 'Dhu al-Hijja',
];
const MAX_ENTRIES = 36;

function isRealDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseEntries(raw: unknown): MonthStart[] {
  let source: unknown = raw;
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  const months = source && typeof source === 'object' ? (source as { months?: unknown }).months : undefined;
  if (!Array.isArray(months)) return [];
  return months
    .filter((e): e is MonthStart => {
      if (!e || typeof e !== 'object') return false;
      const { year, month, start } = e as Record<string, unknown>;
      return Number.isInteger(year) && Number.isInteger(month) && (month as number) >= 1 && (month as number) <= 12 && typeof start === 'string' && isRealDate(start);
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

function formatDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function HijriCalendarForm({ value, onSaved }: { value: unknown; onSaved: (entries: MonthStart[]) => void }) {
  const [entries, setEntries] = useState<MonthStart[]>(() => parseEntries(value));
  const latest = entries[entries.length - 1];

  // Sugiere el mes siguiente al último cargado (con cambio de año tras Dhu al-Hijja).
  const suggested = useMemo(() => {
    if (!latest) return { year: 1448, month: 1 };
    return latest.month === 12 ? { year: latest.year + 1, month: 1 } : { year: latest.year, month: latest.month + 1 };
  }, [latest]);

  const [year, setYear] = useState(String(suggested.year));
  const [month, setMonth] = useState(String(suggested.month));
  const [start, setStart] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loadedAt] = useState(() => Date.now());

  const daysSinceLatest = latest ? Math.floor((loadedAt - new Date(`${latest.start}T00:00:00Z`).getTime()) / 86_400_000) : null;
  const stale = daysSinceLatest === null || daysSinceLatest > 29;

  async function persist(next: MonthStart[]) {
    setSaving(true);
    setError('');
    setMessage('');
    const trimmed = next.slice(-MAX_ENTRIES);
    const { error: saveError } = await supabase
      .from('app_config')
      .upsert({ key: 'hijri_calendar', value: { months: trimmed }, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return false;
    }
    setEntries(trimmed);
    onSaved(trimmed);
    return true;
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const y = Number(year);
    const m = Number(month);
    if (!Number.isInteger(y) || y < 1300 || y > 1700) return setError('El año hijri debe estar entre 1300 y 1700.');
    if (!isRealDate(start)) return setError('Elige el día en que cae el día 1 del mes.');

    const without = entries.filter((e) => !(e.year === y && e.month === m));
    const next = [...without, { year: y, month: m, start }].sort((a, b) => a.start.localeCompare(b.start));
    if (await persist(next)) {
      setMessage(`Guardado: 1 de ${MONTH_NAMES[m - 1]} de ${y} = ${formatDay(start)}. La app lo recoge al abrirse o volver a primer plano.`);
      setStart('');
      const following = m === 12 ? { year: y + 1, month: 1 } : { year: y, month: m + 1 };
      setYear(String(following.year));
      setMonth(String(following.month));
    }
  }

  async function remove(entry: MonthStart) {
    if (await persist(entries.filter((e) => e !== entry))) setMessage('Mes eliminado.');
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-xl font-bold text-primary-dark">Calendario hijri (Marruecos)</h2>
      <p className="mt-2 text-sm text-gray-500">
        Cuando el Ministerio de Habous anuncie el inicio de un mes, introduce aquí el día del calendario normal en que cae su día 1. La app
        muestra la fecha hijri en Inicio (el día cambia al Maghrib).
      </p>

      {stale ? (
        <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {latest
            ? `El último mes cargado empezó hace ${daysSinceLatest} días: falta introducir el mes en curso. Mientras tanto la app no muestra fecha hijri.`
            : 'Todavía no hay ningún mes cargado: la app no muestra fecha hijri.'}
        </p>
      ) : null}

      <form onSubmit={add} className="mt-5 grid gap-4 sm:grid-cols-[1fr_120px_1fr_auto] sm:items-end">
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Mes</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900">
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>{index + 1}. {name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Año hijri</span>
          <input value={year} onChange={(e) => setYear(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-gray-800">Día 1 cae el…</span>
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-3 text-sm text-gray-900" />
        </label>
        <button type="submit" disabled={saving || !start} className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
          {saving ? 'Guardando…' : 'Añadir mes'}
        </button>
      </form>

      {message ? <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p> : null}
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}

      {entries.length > 0 ? (
        <ul className="mt-6 divide-y divide-gray-100 text-sm">
          {[...entries].reverse().slice(0, 8).map((entry) => (
            <li key={`${entry.year}-${entry.month}`} className="flex items-center justify-between gap-3 py-2">
              <span>
                <strong className="text-primary-dark">{MONTH_NAMES[entry.month - 1]} {entry.year}</strong>
                <span className="ml-2 text-gray-500">empieza el {formatDay(entry.start)}</span>
              </span>
              <button type="button" onClick={() => remove(entry)} disabled={saving} className="text-xs font-semibold text-red-600 underline disabled:opacity-50">
                Quitar
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
