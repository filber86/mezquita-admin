'use client';

import { FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

// Fotos del carrusel de Inicio de la app (tabla home_gallery + bucket home-gallery, ver
// sql/home_gallery.sql). La app solo lee las visibles, en el orden de sort_order.

const BUCKET = 'home-gallery';
// Las fotos se reducen en el navegador antes de subirlas: suficiente para el móvil y ligeras.
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 0.82;

type LinkType = 'none' | 'web' | 'horarios' | 'agenda' | 'contenido' | 'coran' | 'guia' | 'dua' | 'qibla' | 'zakat' | 'donar';

type GalleryItem = {
  id: number;
  image_path: string;
  title: string | null;
  subtitle: string | null;
  link_type: LinkType;
  link_url: string | null;
  active: boolean;
  sort_order: number;
};

const LINK_LABELS: Record<LinkType, string> = {
  none: 'Nada (solo la foto)',
  web: 'Enlace web',
  horarios: 'Horarios',
  agenda: 'Agenda',
  contenido: 'Contenido (jutbahs, noticias, vídeos)',
  coran: 'Corán',
  guia: 'Guía para nuevos musulmanes',
  dua: "Du'a an-Nasiri",
  qibla: 'Qibla',
  zakat: 'Zakat',
  donar: 'Donar',
};

const emptyForm = {
  title: '',
  subtitle: '',
  link_type: 'none' as LinkType,
  link_url: '',
  active: true,
};

function publicUrl(path: string) {
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function resizeToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('No se pudo preparar la imagen.'))), 'image/jpeg', JPEG_QUALITY)
  );
}

export default function GaleriaPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadItems();
  }, []);

  function chooseFile(next: File | null) {
    if (preview?.startsWith('blob:')) URL.revokeObjectURL(preview);
    setFile(next);
    if (next) setPreview(URL.createObjectURL(next));
  }

  async function loadItems() {
    setLoading(true);
    setError('');
    const { data, error } = await supabase
      .from('home_gallery')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('id', { ascending: true });
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
    setFile(null);
    setPreview(null);
  }

  function editItem(item: GalleryItem) {
    setEditingId(item.id);
    setForm({
      title: item.title ?? '',
      subtitle: item.subtitle ?? '',
      link_type: item.link_type,
      link_url: item.link_url ?? '',
      active: item.active,
    });
    setFile(null);
    setPreview(publicUrl(item.image_path));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function uploadImage(source: File) {
    const blob = await resizeToJpeg(source);
    const path = `${crypto.randomUUID()}.jpg`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' });
    if (error) throw error;
    return path;
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');

    const linkUrl = form.link_url.trim();
    if (!editingId && !file) {
      setError('Elige una foto.');
      return;
    }
    if (form.link_type === 'web' && !/^https:\/\//i.test(linkUrl)) {
      setError('El enlace web debe empezar por https://');
      return;
    }

    setSaving(true);
    try {
      const editing = items.find((item) => item.id === editingId);
      const imagePath = file ? await uploadImage(file) : editing?.image_path;
      const payload = {
        image_path: imagePath,
        title: form.title.trim() || null,
        subtitle: form.subtitle.trim() || null,
        link_type: form.link_type,
        link_url: form.link_type === 'web' ? linkUrl : null,
        active: form.active,
      };

      const result = editingId
        ? await supabase.from('home_gallery').update(payload).eq('id', editingId)
        : await supabase.from('home_gallery').insert({
            ...payload,
            // Las nuevas van al final del carrusel.
            sort_order: items.length ? Math.max(...items.map((item) => item.sort_order)) + 10 : 0,
          });
      if (result.error) throw result.error;

      // Si se cambió la foto, la anterior ya no la usa nadie.
      if (editing && file && editing.image_path !== imagePath) {
        await supabase.storage.from(BUCKET).remove([editing.image_path]);
      }

      setMessage(editingId ? 'Foto actualizada.' : 'Foto añadida al carrusel.');
      resetForm();
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo guardar.');
    }
    setSaving(false);
  }

  async function toggleActive(item: GalleryItem) {
    setError('');
    const { error } = await supabase.from('home_gallery').update({ active: !item.active }).eq('id', item.id);
    if (error) {
      setError(error.message);
      return;
    }
    await loadItems();
  }

  // Mueve una foto un puesto arriba o abajo y renumera el orden de todas (0, 10, 20…).
  async function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const reordered = [...items];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setItems(reordered);
    setError('');
    const updates = reordered.map((item, position) =>
      supabase.from('home_gallery').update({ sort_order: position * 10 }).eq('id', item.id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);
    if (failed?.error) setError(failed.error.message);
    await loadItems();
  }

  async function deleteItem(item: GalleryItem) {
    if (!window.confirm('¿Seguro que quieres quitar esta foto del carrusel?')) return;
    setError('');
    const { error } = await supabase.from('home_gallery').delete().eq('id', item.id);
    if (error) {
      setError(error.message);
      return;
    }
    await supabase.storage.from(BUCKET).remove([item.image_path]);
    if (editingId === item.id) resetForm();
    await loadItems();
  }

  function destination(item: GalleryItem) {
    return item.link_type === 'web' ? item.link_url ?? '' : LINK_LABELS[item.link_type];
  }

  return (
    <AdminShell
      title="Galería de Inicio"
      description="Fotos del carrusel de la pantalla de Inicio de la app. Si no hay ninguna visible, el carrusel no aparece."
    >
      {error ? (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}
      {message ? (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">{message}</div>
      ) : null}

      <section className="rounded-3xl bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-primary-dark">{editingId ? 'Editar foto' : 'Nueva foto'}</h2>
            <p className="mt-2 text-sm text-gray-500">
              Mejor en horizontal. Se reduce y comprime automáticamente antes de subirla.
            </p>
          </div>
          {editingId ? (
            <button type="button" onClick={resetForm} className="text-sm font-bold text-gray-500">
              Cancelar
            </button>
          ) : null}
        </div>

        <form onSubmit={saveItem} className="mt-6 grid gap-5">
          <div className="grid gap-5 md:grid-cols-[220px_1fr] md:items-start">
            <div className="aspect-[16/10] overflow-hidden rounded-2xl bg-gray-100">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-400">Sin foto</div>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                {editingId ? 'Cambiar la foto (opcional)' : 'Foto'}
              </label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => chooseFile(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Título (opcional)</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="El jardín de la Mezquita"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Texto corto (opcional)</label>
              <input
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                placeholder="Abierto todos los días"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">Al tocar la foto, abrir</label>
              <select
                value={form.link_type}
                onChange={(e) => setForm({ ...form, link_type: e.target.value as LinkType })}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3"
              >
                {(Object.keys(LINK_LABELS) as LinkType[]).map((type) => (
                  <option key={type} value={type}>{LINK_LABELS[type]}</option>
                ))}
              </select>
            </div>
            {form.link_type === 'web' ? (
              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">Dirección web</label>
                <input
                  value={form.link_url}
                  onChange={(e) => setForm({ ...form, link_url: e.target.value })}
                  placeholder="https://mezquitadegranada.com/…"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-primary"
                />
              </div>
            ) : null}
          </div>

          <label className="flex items-center gap-3">
            <input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} />
            <span className="text-sm font-semibold text-gray-700">Visible en la app</span>
          </label>

          <div>
            <button type="submit" disabled={saving} className="rounded-xl bg-primary px-5 py-3 font-bold text-white disabled:opacity-50">
              {saving ? 'Guardando…' : editingId ? 'Guardar cambios' : 'Añadir al carrusel'}
            </button>
          </div>
        </form>
      </section>

      <section className="mt-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-primary-dark">Fotos del carrusel</h2>
          <button onClick={loadItems} className="text-sm font-bold text-primary">Actualizar</button>
        </div>

        {loading ? <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Cargando…</div> : null}
        {!loading && items.length === 0 ? (
          <div className="rounded-2xl bg-white p-8 text-center text-gray-500">Todavía no hay fotos. Mientras no haya ninguna visible, el carrusel no aparece en la app.</div>
        ) : null}

        <div className="grid gap-4">
          {items.map((item, index) => (
            <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm md:flex-row md:items-center">
              <div className="flex gap-1 md:flex-col">
                <button type="button" onClick={() => move(index, -1)} disabled={index === 0} className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30" aria-label="Subir">↑</button>
                <button type="button" onClick={() => move(index, 1)} disabled={index === items.length - 1} className="h-8 w-8 rounded-lg border border-gray-200 text-gray-600 disabled:opacity-30" aria-label="Bajar">↓</button>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(item.image_path)} alt="" className="h-20 w-32 flex-none rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="font-bold text-primary-dark">{item.title || <span className="text-gray-400">Sin título</span>}</p>
                {item.subtitle ? <p className="text-sm text-gray-500">{item.subtitle}</p> : null}
                <p className="mt-1 truncate text-xs text-gray-400">Al tocar: {destination(item)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleActive(item)}
                  className={`rounded-full px-3 py-1 text-xs font-bold ${item.active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}
                >
                  {item.active ? 'Visible' : 'Oculta'}
                </button>
                <button type="button" onClick={() => editItem(item)} className="text-sm font-bold text-primary">Editar</button>
                <button type="button" onClick={() => deleteItem(item)} className="text-sm font-bold text-red-600">Quitar</button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
