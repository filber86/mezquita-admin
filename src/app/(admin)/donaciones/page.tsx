'use client';

import { useEffect, useMemo, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

type Payment = {
  id: string;
  purpose: 'zakat' | 'donation';
  amount_cents: number;
  currency: string;
  status: 'succeeded' | 'failed';
  created_at: string;
};

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function money(cents: number) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

function toCsv(rows: Payment[]) {
  const header = ['Fecha', 'Concepto', 'Importe', 'Estado'];
  const lines = rows.map((row) => [
    new Date(row.created_at).toISOString(),
    row.purpose === 'zakat' ? 'Zakat' : 'Donación',
    (row.amount_cents / 100).toFixed(2).replace('.', ','),
    row.status === 'succeeded' ? 'Completado' : 'Fallido',
  ]);

  return [header, ...lines].map((line) => line.join(';')).join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function DonacionesPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [year, setYear] = useState<number | 'all'>('all');
  const [month, setMonth] = useState<number | 'all'>('all');
  const [purpose, setPurpose] = useState<Payment['purpose'] | 'all'>('all');

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('payments')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
    } else {
      setPayments((data ?? []) as Payment[]);
    }

    setLoading(false);
  }

  const years = useMemo(() => {
    const set = new Set(payments.map((p) => new Date(p.created_at).getFullYear()));
    set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((p) => {
      const date = new Date(p.created_at);
      if (year !== 'all' && date.getFullYear() !== year) return false;
      if (month !== 'all' && date.getMonth() !== month) return false;
      if (purpose !== 'all' && p.purpose !== purpose) return false;
      return true;
    });
  }, [payments, year, month, purpose]);

  const totals = useMemo(() => {
    const succeeded = filtered.filter((p) => p.status === 'succeeded');
    const zakat = succeeded.filter((p) => p.purpose === 'zakat').reduce((sum, p) => sum + p.amount_cents, 0);
    const donation = succeeded.filter((p) => p.purpose === 'donation').reduce((sum, p) => sum + p.amount_cents, 0);
    const failedCount = filtered.filter((p) => p.status === 'failed').length;
    return { zakat, donation, failedCount };
  }, [filtered]);

  function exportCsv() {
    const label = [
      purpose === 'all' ? 'todos' : purpose === 'zakat' ? 'zakat' : 'donaciones',
      year === 'all' ? 'todos' : year,
      month === 'all' ? '' : MONTHS[month].toLowerCase(),
    ].filter(Boolean).join('-');
    downloadCsv(toCsv(filtered), `donaciones-${label}.csv`);
  }

  return (
    <AdminShell
      title="Donaciones"
      description="Zakat y donaciones recibidas a través de Stripe, separadas por concepto."
    >
      <section className="mb-6 flex flex-col gap-3 rounded-3xl bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          <select
            value={year}
            onChange={(event) => setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"
          >
            <option value="all">Todos los años</option>
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <select
            value={month}
            onChange={(event) => setMonth(event.target.value === 'all' ? 'all' : Number(event.target.value))}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"
          >
            <option value="all">Todos los meses</option>
            {MONTHS.map((m, index) => (
              <option key={m} value={index}>{m}</option>
            ))}
          </select>

          <select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as Payment['purpose'] | 'all')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 outline-none focus:border-primary"
          >
            <option value="all">Zakat y Donaciones</option>
            <option value="zakat">Solo Zakat</option>
            <option value="donation">Solo Donaciones</option>
          </select>
        </div>

        <button
          onClick={exportCsv}
          disabled={filtered.length === 0}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          Exportar CSV
        </button>
      </section>

      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {purpose !== 'donation' ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Total Zakat</p>
            <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : money(totals.zakat)}</p>
          </div>
        ) : null}

        {purpose !== 'zakat' ? (
          <div className="rounded-3xl bg-white p-6 shadow-sm">
            <p className="text-sm font-semibold text-gray-500">Total Donaciones</p>
            <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : money(totals.donation)}</p>
          </div>
        ) : null}

        <div className="rounded-3xl bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold text-gray-500">Pagos fallidos</p>
          <p className="mt-3 text-2xl font-bold text-primary-dark">{loading ? '—' : totals.failedCount}</p>
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-xl font-bold text-primary-dark">Movimientos</h2>

        {loading ? (
          <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl bg-white p-8 text-center text-gray-500 shadow-sm">
            No hay movimientos en este periodo.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-gray-500">
                  <th className="px-5 py-3 font-semibold">Fecha</th>
                  <th className="px-5 py-3 font-semibold">Concepto</th>
                  <th className="px-5 py-3 font-semibold">Importe</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((payment) => (
                  <tr key={payment.id} className="border-b border-gray-50 last:border-0">
                    <td className="px-5 py-3 text-gray-600">
                      {new Intl.DateTimeFormat('es-ES', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(payment.created_at))}
                    </td>
                    <td className="px-5 py-3 font-semibold text-primary-dark">
                      {payment.purpose === 'zakat' ? 'Zakat' : 'Donación'}
                    </td>
                    <td className="px-5 py-3 text-gray-900">{money(payment.amount_cents)}</td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                          payment.status === 'succeeded'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-red-50 text-red-700'
                        }`}
                      >
                        {payment.status === 'succeeded' ? 'Completado' : 'Fallido'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}
