'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

// Avisos (tarjetas dentro de la app) y notificaciones push comparten
// entrada en el menú; cada pestaña es su propia página.
const tabs = [
  { href: '/avisos', label: 'Avisos en la app' },
  { href: '/notificaciones', label: 'Notificaciones push' },
];

export function AvisosTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-6 flex gap-1 border-b border-gray-200">
      {tabs.map((tab) => {
        const active = pathname.startsWith(tab.href);

        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-semibold transition ${
              active
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-primary-dark'
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
