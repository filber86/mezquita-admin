-- Estadísticas de uso de la app, anónimas.
-- Pegar entero en el editor SQL de Supabase y ejecutar una vez (se puede repetir sin romper nada).
--
-- No se guarda nada de la persona ni del móvil: ni id, ni IP, ni eventos sueltos. Solo totales por día
-- (hora de Madrid), evento, nombre, plataforma, versión e idioma. La app manda sus eventos agrupados con
-- track_events(); nadie puede escribir en la tabla directamente, y solo los administradores la leen.
--
-- «active» lo manda cada móvil una sola vez al día (lo decide la app con una fecha guardada en local que no
-- sale del móvil), así que su total es el número de usuarios de ese día. «open» cuenta las aperturas.

create table if not exists public.app_stats (
  day date not null,
  event text not null,
  name text not null default '',
  platform text not null,
  app_version text not null,
  lang text not null,
  count bigint not null default 0,
  primary key (day, event, name, platform, app_version, lang)
);

alter table public.app_stats enable row level security;

revoke all on public.app_stats from anon, authenticated;
grant select on public.app_stats to authenticated;

drop policy if exists "app_stats_admin_read" on public.app_stats;
create policy "app_stats_admin_read" on public.app_stats
  for select to authenticated using (public.is_admin());

-- Lista cerrada de eventos: cualquier otro se descarta sin error. Al añadir uno en la app
-- (src/services/statsService.ts) hay que añadirlo también aquí y volver a ejecutar el archivo.
create or replace function public.track_events(p_platform text, p_version text, p_lang text, p_events jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  item jsonb;
  ev text;
  nm text;
  n integer;
  today date := (now() at time zone 'Europe/Madrid')::date;
begin
  if p_platform not in ('ios', 'android')
     or p_lang not in ('es', 'en')
     or p_version !~ '^[0-9]{1,2}\.[0-9]{1,3}\.[0-9]{1,3}(-preview)?$'
     or jsonb_typeof(p_events) <> 'array'
     or jsonb_array_length(p_events) > 60 then
    return;
  end if;

  for item in select value from jsonb_array_elements(p_events) loop
    if jsonb_typeof(item) <> 'object' then
      continue;
    end if;
    ev := item->>'e';
    nm := coalesce(item->>'n', '');
    -- Un móvil no puede sumar más de 50 de lo mismo en un envío.
    n := case when jsonb_typeof(item->'c') = 'number' then least(greatest((item->>'c')::numeric, 0), 50)::integer else 0 end;
    if n < 1 then
      continue;
    end if;

    if not (
      (ev in ('active', 'open') and nm = '')
      or (ev = 'screen' and nm in ('inicio', 'oraciones', 'agenda', 'contenido', 'mas'))
      or (ev = 'section' and nm in ('quran', 'guide', 'learn', 'dua', 'qibla', 'zakat', 'favorites', 'editorial', 'fiqh', 'about'))
      or (ev = 'action' and nm in ('fiqh_sent', 'registration_sent', 'khutbah_play', 'dua_audio_play',
                                    'donation_paid', 'zakat_paid', 'place_changed', 'month_sheet_shared'))
    ) then
      continue;
    end if;

    insert into public.app_stats (day, event, name, platform, app_version, lang, count)
    values (today, ev, nm, p_platform, p_version, p_lang, n)
    on conflict (day, event, name, platform, app_version, lang)
    do update set count = public.app_stats.count + excluded.count;
  end loop;
end;
$$;

revoke all on function public.track_events(text, text, text, jsonb) from public;
grant execute on function public.track_events(text, text, text, jsonb) to anon, authenticated;

-- Resumen para el panel (sección Estadísticas). Corre con los permisos de quien llama, así que la RLS de
-- arriba hace que solo un administrador vea datos. Agrupa en el servidor para no traer miles de filas.
-- Los filtros de plataforma, versión e idioma son opcionales (null = todos). Cada reparto de usuarios aplica
-- los otros dos filtros pero no el suyo, para que el panel siga pudiendo ofrecer todas las opciones.
-- p_preview_only deja solo la app de pruebas (versiones -preview); p_include_preview, las dos.
drop function if exists public.app_stats_report(date, date, boolean);
drop function if exists public.app_stats_report(date, date, boolean, text, text, text);
create or replace function public.app_stats_report(
  p_from date,
  p_to date,
  p_include_preview boolean default false,
  p_platform text default null,
  p_version text default null,
  p_lang text default null,
  p_preview_only boolean default false
)
returns jsonb
language sql
stable
set search_path = ''
as $$
  with base as (
    select * from public.app_stats
    where day between p_from and p_to
      and case
        when p_preview_only then app_version like '%-preview'
        else p_include_preview or app_version not like '%-preview'
      end
  ),
  stats as (
    select * from base
    where (p_platform is null or platform = p_platform)
      and (p_version is null or app_version = p_version)
      and (p_lang is null or lang = p_lang)
  )
  select jsonb_build_object(
    'daily', coalesce((
      select jsonb_agg(d order by d.day) from (
        select day,
               sum(count) filter (where event = 'active') as active,
               sum(count) filter (where event = 'open') as opens
        from stats group by day
      ) d
    ), '[]'::jsonb),
    'items', coalesce((
      select jsonb_agg(i order by i.event, i.total desc) from (
        select event, name, sum(count) as total
        from stats where event in ('screen', 'section', 'action')
        group by event, name
      ) i
    ), '[]'::jsonb),
    'platforms', coalesce((
      select jsonb_agg(p order by p.total desc) from (
        select platform as key, sum(count) as total from base
        where event = 'active'
          and (p_version is null or app_version = p_version)
          and (p_lang is null or lang = p_lang)
        group by platform
      ) p
    ), '[]'::jsonb),
    'versions', coalesce((
      select jsonb_agg(v order by v.total desc) from (
        select app_version as key, sum(count) as total from base
        where event = 'active'
          and (p_platform is null or platform = p_platform)
          and (p_lang is null or lang = p_lang)
        group by app_version
      ) v
    ), '[]'::jsonb),
    'languages', coalesce((
      select jsonb_agg(l order by l.total desc) from (
        select lang as key, sum(count) as total from base
        where event = 'active'
          and (p_platform is null or platform = p_platform)
          and (p_version is null or app_version = p_version)
        group by lang
      ) l
    ), '[]'::jsonb)
  );
$$;

-- Supabase da permiso de ejecución a anon en las funciones nuevas: se le quita explícitamente.
revoke all on function public.app_stats_report(date, date, boolean, text, text, text, boolean) from public, anon;
grant execute on function public.app_stats_report(date, date, boolean, text, text, text, boolean) to authenticated;
