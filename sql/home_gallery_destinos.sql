-- Galería de Inicio: amplía los destinos de las fotos (Contenido, Corán, Guía, Du'a, Qibla, Donar).
-- Solo hace falta si home_gallery ya estaba creada con home_gallery.sql antes de este cambio.
-- No borra ni modifica ninguna foto: solo cambia la lista de destinos permitidos.

alter table public.home_gallery drop constraint if exists home_gallery_link_type_check;
alter table public.home_gallery add constraint home_gallery_link_type_check
  check (link_type in ('none', 'web', 'horarios', 'agenda', 'contenido', 'coran', 'guia', 'dua', 'qibla', 'zakat', 'donar'));
