-- Galería de Inicio: fotos del carrusel de la pantalla de Inicio de la app.
-- Pegar entero en el editor SQL de Supabase y ejecutar una vez (se puede repetir sin romper nada).
-- Lectura: cualquiera, solo las visibles. Escritura: solo administradores (public.is_admin(), como el
-- resto del panel).

create table if not exists public.home_gallery (
  id bigint generated always as identity primary key,
  image_path text not null,                -- ruta del archivo dentro del bucket home-gallery
  title text,
  subtitle text,
  link_type text not null default 'none'
    check (link_type in ('none', 'web', 'horarios', 'agenda', 'contenido', 'coran', 'guia', 'dua', 'qibla', 'zakat', 'donar')),
  link_url text,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  constraint home_gallery_web_link check (link_type <> 'web' or link_url ~* '^https://')
);

alter table public.home_gallery enable row level security;

grant select on public.home_gallery to anon, authenticated;
grant insert, update, delete on public.home_gallery to authenticated;

drop policy if exists "home_gallery_public_read" on public.home_gallery;
create policy "home_gallery_public_read" on public.home_gallery
  for select using (active);

drop policy if exists "home_gallery_admin_read" on public.home_gallery;
create policy "home_gallery_admin_read" on public.home_gallery
  for select to authenticated using (public.is_admin());

drop policy if exists "home_gallery_admin_insert" on public.home_gallery;
create policy "home_gallery_admin_insert" on public.home_gallery
  for insert to authenticated with check (public.is_admin());

drop policy if exists "home_gallery_admin_update" on public.home_gallery;
create policy "home_gallery_admin_update" on public.home_gallery
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "home_gallery_admin_delete" on public.home_gallery;
create policy "home_gallery_admin_delete" on public.home_gallery
  for delete to authenticated using (public.is_admin());

-- Fotos: bucket público (la app las descarga por su URL pública), hasta 2 MB, solo imágenes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('home-gallery', 'home-gallery', true, 2097152, array['image/jpeg', 'image/webp', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "home_gallery_files_admin_read" on storage.objects;
create policy "home_gallery_files_admin_read" on storage.objects
  for select to authenticated using (bucket_id = 'home-gallery' and public.is_admin());

drop policy if exists "home_gallery_files_admin_insert" on storage.objects;
create policy "home_gallery_files_admin_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'home-gallery' and public.is_admin());

drop policy if exists "home_gallery_files_admin_update" on storage.objects;
create policy "home_gallery_files_admin_update" on storage.objects
  for update to authenticated using (bucket_id = 'home-gallery' and public.is_admin());

drop policy if exists "home_gallery_files_admin_delete" on storage.objects;
create policy "home_gallery_files_admin_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'home-gallery' and public.is_admin());
