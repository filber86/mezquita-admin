'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { supabase } from '@/lib/supabase';

export function AdminGuard({
  children,
}: {
  children: ReactNode;
}) {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    async function checkAdmin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.replace('/');
        return;
      }

      const { data: isAdmin, error } =
        await supabase.rpc('is_admin');

      if (error || !isAdmin) {
        await supabase.auth.signOut();
        router.replace('/');
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkAdmin();
  }, [router]);

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f6f3]">
        <div className="text-center">
          <p className="text-xs font-black tracking-[0.22em] text-[#b28b45]">
            MEZQUITA MAYOR
          </p>

          <p className="mt-3 text-sm text-gray-500">
            Comprobando acceso…
          </p>
        </div>
      </main>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
