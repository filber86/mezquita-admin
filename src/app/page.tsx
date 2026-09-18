'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';

import { AdminShell } from '@/components/AdminShell';
import { supabase } from '@/lib/supabase';

type AppConfig = Record<string, unknown>;

export default function Home() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [loggedIn, setLoggedIn] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const [loading, setLoading] = useState(true);
  const [dashboardLoading, setDashboardLoading] = useState(true);

  const [error, setError] = useState('');

  const [activeAnnouncements, setActiveAnnouncements] = useState(0);
  const [config, setConfig] = useState<AppConfig>({});

  useEffect(() => {
    checkSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setLoggedIn(false);
        setIsAdmin(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function checkSession() {
    const { data } = await supabase.auth.getSession();

    if (!data.session) {
      setLoading(false);
      return;
    }

    setLoggedIn(true);

    const { data: admin } = await supabase.rpc('is_admin');

    setIsAdmin(Boolean(admin));
    setLoading(false);

    if (admin) {
      await loadDashboard();
    }
  }

  async function login(event: FormEvent) {
    event.preventDefault();

    setError('');
    setLoading(true);

    const { error: loginError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (loginError) {
      setError('Email o contraseña incorrectos.');
      setLoading(false);
      return;
    }

    const { data: admin, error: adminError } =
      await supabase.rpc('is_admin');

    if (adminError || !admin) {
      setError(
        'Este usuario no tiene permisos de administración.'
      );

      await supabase.auth.signOut();

      setLoggedIn(false);
      setIsAdmin(false);
      setLoading(false);

      return;
    }

    setLoggedIn(true);
    setIsAdmin(true);
    setLoading(false);

    await loadDashboard();
  }

  async function loadDashboard() {
    setDashboardLoading(true);

    const [announcementsResult, configResult] =
      await Promise.all([
        supabase
          .from('announcements')
          .select('*', {
            count: 'exact',
            head: true,
          })
          .eq('active', true),

        supabase
          .from('app_config')
          .select('key,value'),
      ]);

    if (announcementsResult.error) {
      console.error(
        'Error cargando avisos:',
        announcementsResult.error
      );
    }

    if (configResult.error) {
      console.error(
        'Error cargando configuración:',
        configResult.error
      );
    }

    setActiveAnnouncements(
      announcementsResult.count ?? 0
    );

    const configObject = Object.fromEntries(
      (configResult.data ?? []).map((item) => [
        item.key,
        item.value,
      ])
    );

    setConfig(configObject);

    setDashboardLoading(false);
  }

  function enabled(key: string) {
    const value = config[key];

    if (typeof value === 'boolean') {
      return value;
    }

    return value === 'true';
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3]">
        <p className="text-sm text-gray-500">
          Cargando…
        </p>
      </main>
    );
  }

  // LOGIN
  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3] p-6">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-lg">
          <p className="text-center text-xs font-bold tracking-[0.25em] text-[#b28b45]">
            MEZQUITA MAYOR
          </p>

          <h1 className="mt-2 text-center text-3xl font-bold text-[#18392e]">
            Granada
          </h1>

          <p className="mt-3 text-center text-gray-500">
            Administración de la app
          </p>

          <form
            onSubmit={login}
            className="mt-8 space-y-5"
          >
            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Email
              </label>

              <input
                type="email"
                required
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#24634c]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-gray-700">
                Contraseña
              </label>

              <input
                type="password"
                required
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
                className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#24634c]"
              />
            </div>

            {error ? (
              <p className="text-sm text-red-600">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              className="w-full rounded-xl bg-[#18543e] px-4 py-3 font-bold text-white"
            >
              Iniciar sesión
            </button>
          </form>
        </div>
      </main>
    );
  }

  // NO ADMIN
  if (!isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3]">
        <p className="text-red-600">
          No tienes permisos de administración.
        </p>
      </main>
    );
  }

  // DASHBOARD
  return (
    <AdminShell
      title="Inicio"
      description="Estado general y accesos rápidos de la app."
    >
      {dashboardLoading ? (
        <div className="rounded-3xl bg-white p-8 text-gray-500 shadow-sm">
          Cargando información…
        </div>
      ) : (
        <>
          {/* ESTADÍSTICAS */}
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <DashboardCard
              label="Avisos activos"
              value={String(activeAnnouncements)}
              href="/avisos"
            />

            <DashboardCard
              label="Noticias"
              value={
                enabled('news_enabled')
                  ? 'Activo'
                  : 'Inactivo'
              }
              active={enabled('news_enabled')}
            />

            <DashboardCard
              label="Eventos"
              value={
                enabled('events_enabled')
                  ? 'Activo'
                  : 'Inactivo'
              }
              active={enabled('events_enabled')}
            />

            <DashboardCard
              label="YouTube"
              value={
                enabled('youtube_enabled')
                  ? 'Activo'
                  : 'Inactivo'
              }
              active={enabled('youtube_enabled')}
            />
          </section>

          {/* MODO MANTENIMIENTO */}
          {enabled('maintenance_mode') ? (
            <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-bold text-amber-800">
                ⚠ Modo mantenimiento activo
              </p>

              <p className="mt-1 text-sm text-amber-700">
                La aplicación está configurada actualmente
                en modo mantenimiento.
              </p>
            </section>
          ) : null}

          {/* ACCIONES */}
          <section className="mt-8">
            <h2 className="text-xl font-bold text-[#18392e]">
              Acciones rápidas
            </h2>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <QuickAction
                href="/avisos"
                title="Gestionar avisos"
                description="Crear, editar y activar avisos."
              />

              <QuickAction
                href="/configuracion"
                title="Configuración"
                description="Controlar las secciones de la app."
              />

              <QuickAction
                href="/destacados"
                title="Destacados"
                description="Gestionar el contenido destacado."
              />
            </div>
          </section>

          {/* ESTADO DE LA APP */}
          <section className="mt-8 rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#18392e]">
                  Estado de la app
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  Configuración obtenida directamente de
                  Supabase.
                </p>
              </div>

              <button
                onClick={loadDashboard}
                className="text-sm font-bold text-[#18543e]"
              >
                Actualizar
              </button>
            </div>

            <div className="mt-6 divide-y divide-gray-100">
              <StatusRow
                name="Noticias"
                enabled={enabled('news_enabled')}
              />

              <StatusRow
                name="Eventos"
                enabled={enabled('events_enabled')}
              />

              <StatusRow
                name="YouTube"
                enabled={enabled('youtube_enabled')}
              />

              <StatusRow
                name="Donativos"
                enabled={enabled(
                  'donations_enabled'
                )}
              />

              <StatusRow
                name="Qibla"
                enabled={enabled('qibla_enabled')}
              />

              <StatusRow
                name="Avisos"
                enabled={enabled(
                  'announcements_enabled'
                )}
              />
            </div>
          </section>
        </>
      )}
    </AdminShell>
  );
}

function DashboardCard({
  label,
  value,
  active,
  href,
}: {
  label: string;
  value: string;
  active?: boolean;
  href?: string;
}) {
  const card = (
    <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm transition hover:shadow-md">
      <p className="text-sm font-semibold text-gray-500">
        {label}
      </p>

      <div className="mt-4 flex items-center gap-3">
        {active !== undefined ? (
          <span
            className={`h-3 w-3 rounded-full ${
              active
                ? 'bg-emerald-500'
                : 'bg-gray-300'
            }`}
          />
        ) : null}

        <p className="text-3xl font-bold text-[#18392e]">
          {value}
        </p>
      </div>
    </div>
  );

  if (href) {
    return <Link href={href}>{card}</Link>;
  }

  return card;
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="font-bold text-[#18392e]">
        {title}
      </p>

      <p className="mt-2 text-sm leading-5 text-gray-500">
        {description}
      </p>

      <p className="mt-4 text-sm font-bold text-[#18543e]">
        Abrir →
      </p>
    </Link>
  );
}

function StatusRow({
  name,
  enabled,
}: {
  name: string;
  enabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-4">
      <span className="text-sm font-semibold text-gray-700">
        {name}
      </span>

      <span
        className={`rounded-full px-3 py-1 text-xs font-bold ${
          enabled
            ? 'bg-emerald-50 text-emerald-700'
            : 'bg-gray-100 text-gray-500'
        }`}
      >
        {enabled ? 'Activo' : 'Inactivo'}
      </span>
    </div>
  );
}