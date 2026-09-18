'use client';

import { FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

type FeaturedItem = {
  id: number;
  type: string;
  external_id: string;
  title: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

const emptyForm = {
  type: 'youtube',
  external_id: '',
  title: '',
  active: true,
  sort_order: 0,
};

export default function DestacadosPage() {
  const [items, setItems] = useState<FeaturedItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  async function loadItems() {
    setLoading(true);
    setError('');

    const { data, error } = await supabase
      .from('featured_content')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      setError(error.message);
      setItems([]);
    } else {
      setItems(data ?? []);
    }

    setLoading(false);
  }

  function resetForm() {
    setEditingId(null);
    setForm(emptyForm);
  }

  function editItem(item: FeaturedItem) {
    setEditingId(item.id);

    setForm({
      type: item.type,
      external_id: item.external_id,
      title: item.title ?? '',
      active: item.active,
      sort_order: item.sort_order,
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();

    setSaving(true);
    setError('');
    setMessage('');

    const payload = {
      type: form.type,
      external_id: form.external_id.trim(),
      title: form.title.trim() || null,
      active: form.active,
      sort_order: Number(form.sort_order) || 0,
    };

    if (!payload.external_id) {
      setError('El identificador del contenido es obligatorio.');
      setSaving(false);
      return;
    }

    let result;

    if (editingId) {
      result = await supabase
        .from('featured_content')
        .update(payload)
        .eq('id', editingId);
    } else {
      result = await supabase
        .from('featured_content')
        .insert(payload);
    }

    if (result.error) {
      setError(result.error.message);
      setSaving(false);
      return;
    }

    setMessage(
      editingId
        ? 'Destacado actualizado.'
        : 'Destacado creado.'
    );

    resetForm();
    await loadItems();

    setSaving(false);
  }

  async function toggleActive(item: FeaturedItem) {
    setError('');

    const { error } = await supabase
      .from('featured_content')
      .update({
        active: !item.active,
      })
      .eq('id', item.id);

    if (error) {
      setError(error.message);
      return;
    }

    await loadItems();
  }

  async function deleteItem(id: number) {
    const confirmed = window.confirm(
      '¿Seguro que quieres eliminar este contenido destacado?'
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('featured_content')
      .delete()
      .eq('id', id);

    if (error) {
      setError(error.message);
      return;
    }

    if (editingId === id) {
      resetForm();
    }

    await loadItems();
  }

  function typeLabel(type: string) {
    switch (type) {
      case 'youtube':
        return 'YouTube';

      case 'event':
        return 'Evento';

      case 'news':
        return 'Noticia';

      default:
        return type;
    }
  }

  return (
    <AdminShell
      title="Destacados"
      description="Selecciona contenido que quieras resaltar en la app."
    >
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
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#18392e]">
              {editingId
                ? 'Editar destacado'
                : 'Nuevo destacado'}
            </h2>

            <p className="mt-2 text-sm text-gray-500">
              Indica qué contenido quieres destacar.
            </p>
          </div>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="text-sm font-bold text-gray-500"
            >
              Cancelar
            </button>
          ) : null}
        </div>

        <form
          onSubmit={saveItem}
          className="mt-6 grid gap-5"
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Tipo
              </label>

              <select
                value={form.type}
                onChange={(e) =>
                  setForm({
                    ...form,
                    type: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                <option value="youtube">
                  YouTube
                </option>

                <option value="event">
                  Evento
                </option>

                <option value="news">
                  Noticia
                </option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Orden
              </label>

              <input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({
                    ...form,
                    sort_order: Number(e.target.value),
                  })
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3"
              />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              ID del contenido
            </label>

            <input
              value={form.external_id}
              onChange={(e) =>
                setForm({
                  ...form,
                  external_id: e.target.value,
                })
              }
              placeholder="Ej. ID del vídeo, evento o noticia"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#24634c]"
            />

            <p className="mt-2 text-xs text-gray-400">
              Es el identificador que usa la fuente original.
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-gray-700">
              Título opcional
            </label>

            <input
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                })
              }
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#24634c]"
            />
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
              Destacado activo
            </span>
          </label>

          <div>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-[#18543e] px-5 py-3 font-bold text-white disabled:opacity-50"
            >
              {saving
                ? 'Guardando…'
                : editingId
                  ? 'Guardar cambios'
                  : 'Crear destacado'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#18392e]">
            Contenido destacado
          </h2>

          <button
            onClick={loadItems}
            className="text-sm font-bold text-[#18543e]"
          >
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
            Cargando…
          </div>
        ) : null}

        {!loading && items.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">
            No hay contenido destacado todavía.
          </div>
        ) : null}

        <div className="grid gap-4">
          {items.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-[#edf5f1] px-2.5 py-1 text-xs font-bold text-[#18543e]">
                      {typeLabel(item.type)}
                    </span>

                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                        item.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {item.active
                        ? 'Activo'
                        : 'Inactivo'}
                    </span>
                  </div>

                  <h3 className="mt-3 font-bold text-[#18392e]">
                    {item.title ||
                      item.external_id}
                  </h3>

                  <p className="mt-1 text-xs text-gray-500">
                    ID: {item.external_id}
                  </p>

                  <p className="mt-1 text-xs font-semibold text-[#b28b45]">
                    Orden {item.sort_order}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      toggleActive(item)
                    }
                    className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold text-gray-700"
                  >
                    {item.active
                      ? 'Desactivar'
                      : 'Activar'}
                  </button>

                  <button
                    onClick={() =>
                      editItem(item)
                    }
                    className="rounded-lg bg-[#edf5f1] px-3 py-2 text-xs font-bold text-[#18543e]"
                  >
                    Editar
                  </button>

                  <button
                    onClick={() =>
                      deleteItem(item.id)
                    }
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
