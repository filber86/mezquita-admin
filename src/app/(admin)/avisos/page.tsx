'use client';

import { AdminShell } from '@/components/AdminShell';
import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type Announcement = {
  id: number;
  title: string;
  message: string;
  active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
};

const emptyForm = {
  title: '',
  message: '',
  active: true,
  priority: 0,
  starts_at: '',
  ends_at: '',
};

export default function AvisosPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');

  async function loadAnnouncements() {
    setLoading(true);

    const { data, error } = await supabase
      .from('announcements')
      .select('*')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setError('');
      setItems(data ?? []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadAnnouncements();
  }, []);

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
    setError('');
  }

  function editItem(item: Announcement) {
    setEditingId(item.id);

    setForm({
      title: item.title,
      message: item.message,
      active: item.active,
      priority: item.priority,
      starts_at: item.starts_at
        ? item.starts_at.slice(0, 16)
        : '',
      ends_at: item.ends_at
        ? item.ends_at.slice(0, 16)
        : '',
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function saveAnnouncement(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');

    const payload = {
      title: form.title.trim(),
      message: form.message.trim(),
      active: form.active,
      priority: Number(form.priority) || 0,
      starts_at: form.starts_at
        ? new Date(form.starts_at).toISOString()
        : null,
      ends_at: form.ends_at
        ? new Date(form.ends_at).toISOString()
        : null,
      updated_at: new Date().toISOString(),
    };

    if (!payload.title || !payload.message) {
      setError('El título y el mensaje son obligatorios.');
      setSaving(false);
      return;
    }

    let result;

    if (editingId) {
      result = await supabase
        .from('announcements')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('announcements')
        .insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    resetForm();
    await loadAnnouncements();
    setSaving(false);
  }

  async function toggleActive(item: Announcement) {
    const { error } = await supabase
      .from('announcements')
      .update({
        active: !item.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadAnnouncements();
  }

  async function deleteItem(id: number) {
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar este aviso?'
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('announcements')
      .delete()
      .eq('id', id);

    if (error) {
      setError(error.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadAnnouncements();
  }

  return (
  <AdminShell
    title="Avisos"
    description="Gestiona los avisos que se muestran en la app."
  >
        
        <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm md:p-8">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-dark">
              {editingId ? 'Editar aviso' : 'Nuevo aviso'}
            </h2>

            {editingId ? (
              <button
                onClick={resetForm}
                className="text-sm font-semibold text-gray-500"
              >
                Cancelar edición
              </button>
            ) : null}
          </div>

          <form
            onSubmit={saveAnnouncement}
            className="mt-6 grid gap-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Título
              </label>

              <input
                value={form.title}
                onChange={(e) =>
                  setForm({
                    ...form,
                    title: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Mensaje
              </label>

              <textarea
                rows={4}
                value={form.message}
                onChange={(e) =>
                  setForm({
                    ...form,
                    message: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Prioridad
                </label>

                <input
                  type="number"
                  value={form.priority}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      priority: Number(e.target.value),
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Inicio
                </label>

                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      starts_at: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Fin
                </label>

                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      ends_at: e.target.value,
                    })
                  }
                  className="w-full rounded-xl border border-gray-200 px-4 py-3"
                />
              </div>
            </div>

            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({
                    ...form,
                    active: e.target.checked,
                  })
                }
              />

              <span className="text-sm font-semibold text-gray-700">
                Aviso activo
              </span>
            </label>

            {error ? (
              <p className="text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <div>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50"
              >
                {saving
                  ? 'Guardando…'
                  : editingId
                    ? 'Guardar cambios'
                    : 'Crear aviso'}
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-primary-dark">
              Avisos existentes
            </h2>

            <button
              onClick={loadAnnouncements}
              className="text-sm font-semibold text-primary"
            >
              Actualizar
            </button>
          </div>

          {loading ? (
            <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
              Cargando avisos…
            </div>
          ) : null}

          {!loading && items.length === 0 ? (
            <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
              No hay avisos todavía.
            </div>
          ) : null}

          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-bold text-primary-dark">
                        {item.title}
                      </h3>

                      <span
                        className={
                          item.active
                            ? 'rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700'
                            : 'rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-500'
                        }
                      >
                        {item.active
                          ? 'Activo'
                          : 'Inactivo'}
                      </span>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">
                      {item.message}
                    </p>

                    <p className="mt-3 text-xs font-semibold text-[#b28b45]">
                      Prioridad {item.priority}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => toggleActive(item)}
                      className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700"
                    >
                      {item.active
                        ? 'Desactivar'
                        : 'Activar'}
                    </button>

                    <button
                      onClick={() => editItem(item)}
                      className="rounded-lg bg-primary-light px-3 py-2 text-xs font-bold text-primary"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => deleteItem(item.id)}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-600"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
        </AdminShell>
);
}
