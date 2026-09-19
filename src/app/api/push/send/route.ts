import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

type PushTarget = {
  kind: 'home' | 'evento' | 'noticia' | 'jutbah' | 'video' | 'zakat' | 'aviso';
  id?: string;
};

type PushRequest = {
  title?: string;
  message?: string;
  target?: PushTarget;
};

const targetsWithId: PushTarget['kind'][] = ['evento', 'noticia', 'jutbah', 'video', 'aviso'];

function normalizeTarget(target: PushTarget | undefined): PushTarget {
  if (!target || !target.kind) return { kind: 'home' };
  if (targetsWithId.includes(target.kind) && !target.id?.trim()) return { kind: 'home' };
  return targetsWithId.includes(target.kind) ? { kind: target.kind, id: target.id!.trim() } : { kind: target.kind };
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const accessToken = authorization.slice(7);

    const supabaseUrl =
      process.env.NEXT_PUBLIC_SUPABASE_URL;

    const supabaseKey =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Supabase no está configurado' },
        { status: 500 }
      );
    }

    const supabase = createClient(
      supabaseUrl,
      supabaseKey,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return NextResponse.json(
        { error: 'Sesión no válida' },
        { status: 401 }
      );
    }

    const { data: isAdmin, error: adminError } =
      await supabase.rpc('is_admin');

    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const body = (await request.json()) as PushRequest;

    const title = body.title?.trim();
    const message = body.message?.trim();

    if (!title || !message) {
      return NextResponse.json(
        { error: 'Título y mensaje son obligatorios' },
        { status: 400 }
      );
    }

    const { data: devices, error: devicesError } =
      await supabase
        .from('push_devices')
        .select('expo_push_token')
        .eq('enabled', true);

    if (devicesError) {
      throw devicesError;
    }

    const tokens =
      devices
        ?.map((device) => device.expo_push_token)
        .filter(Boolean) ?? [];

    if (tokens.length === 0) {
      return NextResponse.json(
        { error: 'No hay dispositivos registrados' },
        { status: 400 }
      );
    }

    const data = normalizeTarget(body.target);

    const messages = tokens.map((token) => ({
      to: token,
      sound: 'default',
      title,
      body: message,
      data,
    }));

    const expoResponse = await fetch(
      'https://exp.host/--/api/v2/push/send',
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messages),
      }
    );

    const expoResult = await expoResponse.json();

    if (!expoResponse.ok) {
      return NextResponse.json(
        {
          error: 'Expo rechazó el envío',
          details: expoResult,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      devices: tokens.length,
      result: expoResult,
    });
  } catch (error) {
    console.error('Push send error:', error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Error enviando la notificación',
      },
      { status: 500 }
    );
  }
}
