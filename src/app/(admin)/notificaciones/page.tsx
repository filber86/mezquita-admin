'use client';

import { AdminShell } from '@/components/AdminShell';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const TARGET_OPTIONS: { value: TargetKind; label: string; needsId: boolean }[] = [
  { value: 'home', label: 'Inicio', needsId: false },
  { value: 'evento', label: 'Evento', needsId: true },
  { value: 'noticia', label: 'Noticia', needsId: true },
  { value: 'jutbah', label: 'Jutbah', needsId: true },
  { value: 'video', label: 'Vídeo', needsId: true },
  { value: 'zakat', label: 'Zakat', needsId: false },
  { value: 'aviso', label: 'Aviso', needsId: true },
];

type TargetKind = 'home' | 'evento' | 'noticia' | 'jutbah' | 'video' | 'zakat' | 'aviso';

type AvisoOption = { id: number; title: string };

export default function NotificationsPage() {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [targetKind, setTargetKind] = useState<TargetKind>('home');
  const [targetId, setTargetId] = useState('');
  const [avisos, setAvisos] = useState<AvisoOption[]>([]);
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const targetOption = TARGET_OPTIONS.find((option) => option.value === targetKind)!;

  async function loadDeviceCount() {
    const { count, error } = await supabase
      .from('push_devices')
      .select('*', { count: 'exact', head: true })
      .eq('enabled', true);

    if (error) {
      console.error('Error loading push devices:', error);
      return;
    }

    setDeviceCount(count ?? 0);
  }

  async function loadAvisos() {
    const { data, error } = await supabase
      .from('announcements')
      .select('id,title')
      .order('id', { ascending: false });

    if (error) {
      console.error('Error loading announcements:', error);
      return;
    }

    setAvisos(data ?? []);
  }

  useEffect(() => {
    loadDeviceCount();
    loadAvisos();
  }, []);

  useEffect(() => {
    setTargetId('');
  }, [targetKind]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSending(true);
    setResult(null);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error('No hay una sesión de administrador activa.');
      }

      const response = await fetch('/api/push/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          title,
          message,
          target: targetOption.needsId
            ? { kind: targetKind, id: targetId.trim() }
            : { kind: targetKind },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'No se pudo enviar la notificación.');
      }

      setResult(
        `Notificación enviada a ${data.devices} dispositivo${
          data.devices === 1 ? '' : 's'
        }.`
      );

      setTitle('');
      setMessage('');
      setTargetKind('home');
      setTargetId('');
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Error enviando la notificación.'
      );
    } finally {
      setSending(false);
    }
  }

return (
  <AdminShell
    title="Notificaciones"
    description="Envía notificaciones push a los dispositivos que tienen instalada la app."
  >
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <p className="text-sm text-gray-500">Dispositivos activos</p>

        <p className="mt-1 text-3xl font-semibold text-gray-900">
          {deviceCount === null ? '—' : deviceCount}
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <div>
          <label
            htmlFor="title"
            className="block text-sm font-medium text-gray-700"
          >
            Título
          </label>

          <input
            id="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            maxLength={100}
            placeholder="Ej. Jutbah de este viernes"
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div className="mt-5">
          <label
            htmlFor="message"
            className="block text-sm font-medium text-gray-700"
          >
            Mensaje
          </label>

          <textarea
            id="message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            required
            maxLength={500}
            rows={5}
            placeholder="Escribe el contenido de la notificación..."
            className="mt-2 w-full resize-none rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-500"
          />
        </div>

        <div className="mt-5">
          <label className="block text-sm font-medium text-gray-700">
            Destino
          </label>

          <select
            value={targetKind}
            onChange={(event) => setTargetKind(event.target.value as TargetKind)}
            className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-500"
          >
            {TARGET_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {targetOption.needsId && targetKind === 'aviso' ? (
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              Aviso
            </label>

            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              required
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-500"
            >
              <option value="">Selecciona un aviso…</option>
              {avisos.map((aviso) => (
                <option key={aviso.id} value={aviso.id}>
                  {aviso.title}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {targetOption.needsId && targetKind !== 'aviso' ? (
          <div className="mt-5">
            <label className="block text-sm font-medium text-gray-700">
              ID del {targetOption.label.toLowerCase()}
            </label>

            <input
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              required
              placeholder={
                targetKind === 'evento'
                  ? 'UID del evento en el .ics'
                  : targetKind === 'video'
                    ? 'ID del vídeo de YouTube'
                    : 'ID del post de WordPress'
              }
              className="mt-2 w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 outline-none focus:border-gray-500"
            />
          </div>
        ) : null}

        {result && (
          <div className="mt-5 rounded-lg bg-green-50 p-4 text-sm text-green-800">
            {result}
          </div>
        )}

        {error && (
          <div className="mt-5 rounded-lg bg-red-50 p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={sending || !title.trim() || !message.trim() || (targetOption.needsId && !targetId.trim())}
          className="mt-6 rounded-lg bg-primary px-5 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'Enviando...' : 'Enviar a todos'}
        </button>
      </form>
    </div>
  </AdminShell>
);
}
