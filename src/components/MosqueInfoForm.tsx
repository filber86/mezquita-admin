'use client';

import { FormEvent, useState } from 'react';

import { supabase } from '@/lib/supabase';

type Info = {
  addressLine: string;
  city: string;
  mapQuery: string;
  visitHours: string;
  jumuahTime: string;
  phone: string;
  whatsapp: string;
  instagramUrl: string;
  email: string;
  donationWebUrl: string;
  zakatWebUrl: string;
};

// Mismos valores de fábrica que la app (mezquita-app/src/config/mosqueInfo.ts):
// lo que no se rellene aquí se queda con ellos.
const DEFAULTS: Info = {
  addressLine: 'Plaza San Nicolás, s/n',
  city: '18010 Granada',
  mapQuery: '37.1815171,-3.5921474',
  visitHours: "Jardín · Todos los días de 11:00 a 14:00 y desde 'Asr hasta Maghrib",
  jumuahTime: '14:30',
  phone: '+34958202526',
  whatsapp: '34958202526',
  instagramUrl: 'https://www.instagram.com/mezquitagranada/',
  email: 'info@mezquitadegranada.com',
  donationWebUrl: 'https://donaciones.mezquitadegranada.com/',
  zakatWebUrl: 'https://mezquitadegranada.com/pagar-el-zakat/',
};

type FieldDef = { key: keyof Info; label: string; hint?: string; check: (value: string) => string | null };

const required = (max: number) => (v: string) => (!v ? 'Obligatorio.' : v.length > max ? `Máximo ${max} caracteres.` : null);
const https = (v: string) => (/^https:\/\/[^\s<>"']+$/i.test(v) && v.length <= 300 ? null : 'Debe empezar por https:// y no contener espacios.');

const SECTIONS: { title: string; fields: FieldDef[] }[] = [
  {
    title: 'Visitas y ubicación',
    fields: [
      { key: 'addressLine', label: 'Calle', check: required(120) },
      { key: 'city', label: 'Código postal y ciudad', check: required(80) },
      {
        key: 'mapQuery',
        label: 'Coordenadas para "Cómo llegar"',
        hint: 'Latitud,longitud. Ej.: 37.1815171,-3.5921474',
        check: (v) => (/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/.test(v.replace(/\s/g, '')) ? null : 'Formato: latitud,longitud'),
      },
      { key: 'visitHours', label: 'Horario de visitas (jardín)', hint: 'Texto libre que se ve en Más.', check: required(220) },
    ],
  },
  {
    title: 'Jumuʿah',
    fields: [
      {
        key: 'jumuahTime',
        label: 'Hora de la jutbah del viernes',
        hint: 'Formato 24 h, ej.: 14:30. Se ve en Horarios.',
        check: (v) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? null : 'Formato HH:MM, ej.: 14:30'),
      },
    ],
  },
  {
    title: 'Contacto',
    fields: [
      {
        key: 'phone',
        label: 'Teléfono',
        hint: 'Con prefijo, ej.: +34958202526',
        check: (v) => (/^\+?\d{6,15}$/.test(v.replace(/[\s-]/g, '')) ? null : 'Entre 6 y 15 dígitos, con + opcional.'),
      },
      {
        key: 'whatsapp',
        label: 'WhatsApp',
        hint: 'Con prefijo y sin +, ej.: 34958202526',
        check: (v) => (/^\d{6,15}$/.test(v.replace(/[\s+-]/g, '')) ? null : 'Entre 6 y 15 dígitos.'),
      },
      { key: 'instagramUrl', label: 'Instagram (enlace)', check: https },
      { key: 'email', label: 'Correo', check: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Correo no válido.') },
    ],
  },
  {
    title: 'Donativos en iOS (se hacen en la web)',
    fields: [
      { key: 'donationWebUrl', label: 'Página de donativos', check: https },
      { key: 'zakatWebUrl', label: 'Página de pago del Zakat', check: https },
    ],
  },
];

function normalize(key: keyof Info, value: string) {
  if (key === 'mapQuery') return value.replace(/\s/g, '');
  if (key === 'phone') return value.replace(/[\s-]/g, '');
  if (key === 'whatsapp') return value.replace(/[\s+-]/g, '');
  return value;
}

function initialInfo(raw: unknown): Info {
  let source: unknown = raw;
  if (typeof raw === 'string') {
    try {
      source = JSON.parse(raw);
    } catch {
      source = null;
    }
  }
  const input = source && typeof source === 'object' ? (source as Record<string, unknown>) : {};
  const info = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Info)[]) {
    if (typeof input[key] === 'string') info[key] = input[key] as string;
  }
  return info;
}

export function MosqueInfoForm({ value, onSaved }: { value: unknown; onSaved: (info: Info) => void }) {
  const [info, setInfo] = useState<Info>(() => initialInfo(value));
  const [errors, setErrors] = useState<Partial<Record<keyof Info, string>>>({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function save(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setError('');

    const cleaned = {} as Info;
    const nextErrors: Partial<Record<keyof Info, string>> = {};
    for (const section of SECTIONS) {
      for (const field of section.fields) {
        const trimmed = info[field.key].trim();
        const problem = field.check(trimmed);
        if (problem) nextErrors[field.key] = problem;
        cleaned[field.key] = normalize(field.key, trimmed);
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    const { error: saveError } = await supabase
      .from('app_config')
      .upsert({ key: 'mosque_info', value: cleaned, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setInfo(cleaned);
    onSaved(cleaned);
    setMessage('Guardado. La app lo recoge la próxima vez que se abra o vuelva a primer plano.');
  }

  return (
    <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm md:p-8">
      <h2 className="text-xl font-bold text-primary-dark">Datos de la mezquita</h2>
      <p className="mt-2 text-sm text-gray-500">
        Información que ve la gente en la app (horario de visitas, hora de la jutbah, contacto). Cambiarla aquí no requiere publicar
        una versión nueva.
      </p>

      <form onSubmit={save} className="mt-6 space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.title}>
            <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">{section.title}</h3>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              {section.fields.map((field) => (
                <label key={field.key} className={`block ${field.key === 'visitHours' ? 'md:col-span-2' : ''}`}>
                  <span className="text-sm font-semibold text-gray-800">{field.label}</span>
                  <input
                    value={info[field.key]}
                    onChange={(event) => setInfo((current) => ({ ...current, [field.key]: event.target.value }))}
                    className={`mt-1 w-full rounded-lg border px-4 py-3 text-sm text-gray-900 outline-none focus:border-primary ${
                      errors[field.key] ? 'border-red-400' : 'border-gray-300'
                    }`}
                  />
                  {errors[field.key] ? (
                    <span className="mt-1 block text-xs text-red-600">{errors[field.key]}</span>
                  ) : field.hint ? (
                    <span className="mt-1 block text-xs text-gray-500">{field.hint}</span>
                  ) : null}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" disabled={saving} className="rounded-lg bg-primary px-5 py-3 text-sm font-bold text-white disabled:opacity-50">
            {saving ? 'Guardando…' : 'Guardar datos'}
          </button>
          <button type="button" onClick={() => setInfo(DEFAULTS)} className="text-sm font-semibold text-gray-500 underline">
            Restablecer valores de fábrica
          </button>
        </div>

        {message ? <p className="text-sm font-semibold text-emerald-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </form>
    </section>
  );
}
