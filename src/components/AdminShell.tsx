'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const navigation = [
  { href: '/', label: 'Inicio', icon: '⌂' },
  { href: '/avisos', label: 'Avisos', icon: '●' },
  { href: '/configuracion', label: 'Configuración', icon: '⚙' },
  { href: '/destacados', label: 'Destacados', icon: '★' },
];

type AdminShellProps = {
  children: React.ReactNode;
  title?: string;
  description?: string;
};

export function AdminShell({
  children,
  title,
  description,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-[#f5f6f3]">
      {/* Barra móvil */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-5 py-4 lg:hidden">
        <div>
          <p className="text-[9px] font-black tracking-[0.22em] text-[#b28b45]">
            MEZQUITA MAYOR
          </p>
          <p className="font-bold text-[#18392e]">
            Administración
          </p>
        </div>

        <button
          onClick={logout}
          className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600"
        >
          Salir
        </button>
      </header>

      {/* Navegación móvil */}
      <nav className="flex gap-2 overflow-x-auto border-b border-gray-200 bg-white px-4 py-3 lg:hidden">
        {navigation.map((item) => {
          const active =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${
                active
                  ? 'bg-[#18543e] text-white'
                  : 'bg-[#f5f6f3] text-gray-600'
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Sidebar escritorio */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#153d30] p-6 text-white lg:flex">
        <div>
          <p className="text-[10px] font-black tracking-[0.25em] text-[#d8b66f]">
            MEZQUITA MAYOR
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            Granada
          </h1>

          <p className="mt-1 text-sm text-white/60">
            Administración
          </p>
        </div>

        <nav className="mt-10 space-y-2">
          {navigation.map((item) => {
            const active =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition ${
                  active
                    ? 'bg-white text-[#18543e]'
                    : 'text-white/75 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="w-5 text-center">
                  {item.icon}
                </span>

                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <button
            onClick={logout}
            className="w-full rounded-xl px-4 py-3 text-left text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white"
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Contenido */}
      <main className="lg:ml-64">
        <div className="mx-auto max-w-7xl p-5 md:p-8 lg:p-10">
          {title ? (
            <header className="mb-8">
              <p className="text-[10px] font-black tracking-[0.22em] text-[#b28b45]">
                MEZQUITA MAYOR DE GRANADA
              </p>

              <h2 className="mt-2 text-3xl font-bold text-[#18392e]">
                {title}
              </h2>

              {description ? (
                <p className="mt-2 text-sm text-gray-500">
                  {description}
                </p>
              ) : null}
            </header>
          ) : null}

          {children}
        </div>
      </main>
    </div>
  );
}
