'use client';

import { useState } from 'react';

import { supabase } from '@/lib/supabase';

export type BankTransfer = {
  id: string;
  reference: string;
  amount_cents: number;
  email: string | null;
  status: 'pending' | 'confirmed' | 'discarded';
  created_at: string;
  reviewed_at: string | null;
  thanked_at: string | null;
};

const PAYMENTS_API = process.env.NEXT_PUBLIC_PAYMENTS_API ?? 'https://zakat-rates-api.vercel.app/api';

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', useGrouping: 'always' }).format(cents / 100);
}

function date(value: string) {
  return new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

// Los cambios pasan por la API de pagos (es la que envía el agradecimiento), con la sesión del panel.
async function review(id: string, action: 'confirm' | 'discard' | 'thank', amount?: number) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('La sesión ha caducado. Vuelve a entrar.');
  const response = await fetch(`${PAYMENTS_API}/transfers/review`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
    body: JSON.stringify({ id, action, ...(amount ? { amount } : {}) }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? 'No se pudo guardar el cambio.');
  return data as { thanked?: boolean; thanksError?: string };
}

// «250», «250,5» o «1.250,50» → céntimos.
function parseEuros(value: string) {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.');
  const euros = Number(normalized);
  return Number.isFinite(euros) && euros > 0 ? Math.round(euros * 100) : null;
}

export function ZakatTransfers({ transfers, onChanged }: { transfers: BankTransfer[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const pending = transfers.filter((t) => t.status === 'pending');
  const unthanked = transfers.filter((t) => t.status === 'confirmed' && t.email && !t.thanked_at);

  async function run(transfer: BankTransfer, action: 'confirm' | 'discard' | 'thank') {
    let amount: number | undefined;
    if (action === 'confirm') {
      const typed = amounts[transfer.id];
      if (typed !== undefined && typed.trim() !== '') {
        const parsed = parseEuros(typed);
        if (!parsed) {
          setMessage({ kind: 'error', text: 'Revisa el importe recibido.' });
          return;
        }
        amount = parsed;
      }
      const final = amount ?? transfer.amount_cents;
      if (!window.confirm(`¿Confirmar que ha llegado la transferencia ${transfer.reference} de ${money(final)}?`)) return;
    }
    if (action === 'discard' && !window.confirm(`¿Descartar el aviso ${transfer.reference}? No se enviará agradecimiento.`)) return;

    setBusy(transfer.id);
    setMessage(null);
    try {
      const result = await review(transfer.id, action, amount);
      if (action === 'discard') setMessage({ kind: 'ok', text: `Aviso ${transfer.reference} descartado.` });
      else if (result.thanksError) setMessage({ kind: 'error', text: `${transfer.reference} confirmada, pero ${result.thanksError.charAt(0).toLowerCase()}${result.thanksError.slice(1)}` });
      else if (result.thanked) setMessage({ kind: 'ok', text: `${transfer.reference} confirmada. Agradecimiento enviado.` });
      else setMessage({ kind: 'ok', text: `${transfer.reference} confirmada (sin correo para el agradecimiento).` });
      onChanged();
    } catch (error) {
      setMessage({ kind: 'error', text: error instanceof Error ? error.message : 'No se pudo guardar el cambio.' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-8">
      <h2 className="mb-1 text-xl font-bold text-primary-dark">Transferencias del Zakat pendientes</h2>
      <p className="mb-4 text-sm text-gray-500">
        Avisos desde la app. Busca la referencia en el concepto de los movimientos del banco y confirma solo las que hayan llegado.
      </p>

      {message ? (
        <div className={`mb-4 rounded-2xl border p-4 text-sm ${message.kind === 'ok' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      ) : null}

      {pending.length === 0 ? (
        <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm">No hay transferencias pendientes.</div>
      ) : (
        <div className="overflow-x-auto rounded-3xl bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-gray-500">
                <th className="px-5 py-3 font-semibold">Aviso</th>
                <th className="px-5 py-3 font-semibold">Referencia</th>
                <th className="px-5 py-3 font-semibold">Importe</th>
                <th className="px-5 py-3 font-semibold">Recibido</th>
                <th className="px-5 py-3 font-semibold">Agradecimiento</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {pending.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-3 text-gray-600">{date(t.created_at)}</td>
                  <td className="px-5 py-3 font-mono font-semibold text-primary-dark">{t.reference}</td>
                  <td className="px-5 py-3 text-gray-900">{money(t.amount_cents)}</td>
                  <td className="px-5 py-3">
                    <input
                      value={amounts[t.id] ?? ''}
                      onChange={(event) => setAmounts((prev) => ({ ...prev, [t.id]: event.target.value }))}
                      placeholder="Igual"
                      inputMode="decimal"
                      className="w-24 rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900 outline-none focus:border-primary"
                    />
                  </td>
                  <td className="px-5 py-3 text-gray-600">{t.email ?? <span className="text-gray-400">Sin correo</span>}</td>
                  <td className="px-5 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => run(t, 'discard')}
                        disabled={busy !== null}
                        className="rounded-xl border border-gray-300 px-3 py-1.5 text-xs font-bold text-gray-600 disabled:opacity-50"
                      >
                        Descartar
                      </button>
                      <button
                        onClick={() => run(t, 'confirm')}
                        disabled={busy !== null}
                        className="rounded-xl bg-primary px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                      >
                        {busy === t.id ? 'Guardando…' : 'Confirmar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {unthanked.length > 0 ? (
        <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <p className="mb-3 font-semibold">Confirmadas sin agradecimiento enviado</p>
          {unthanked.map((t) => (
            <div key={t.id} className="flex items-center justify-between gap-3 py-1">
              <span><span className="font-mono">{t.reference}</span> · {money(t.amount_cents)} · {t.email}</span>
              <button
                onClick={() => run(t, 'thank')}
                disabled={busy !== null}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-bold text-amber-800 disabled:opacity-50"
              >
                {busy === t.id ? 'Enviando…' : 'Reenviar agradecimiento'}
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
