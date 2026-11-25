import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';

// Endpoint crona / keep-alive dla Vercela
// Pingowany automatycznie przez Vercel Cron lub zewnętrzne serwisy (np. cron-job.org / UptimeKuma)
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Jeśli ustawiono CRON_SECRET w Vercel, weryfikujemy nagłówek
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Nieautoryzowany dostęp do crona' }, { status: 401 });
  }

  const timestamp = new Date().toISOString();

  // 1. Sprawdzenie / ping do bazy PostgreSQL przez Prismę
  let dbStatus = 'disconnected';
  let dbLatencyMs: number | null = null;
  const start = Date.now();

  try {
    if (process.env.POSTGRES_PRISMA_URL) {
      await prisma.$queryRaw`SELECT 1`;
      dbStatus = 'active';
      dbLatencyMs = Date.now() - start;
    }
  } catch (err: any) {
    dbStatus = `unreachable: ${err.message?.split('\n')[0] || 'timeout'}`;
  }

  // 2. Opcjonalny ping do API Supabase REST
  let supabaseApiStatus = 'skipped';
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    try {
      const restRes = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`, {
        headers: {
          apikey: process.env.SUPABASE_ANON_KEY || ''
        },
        signal: AbortSignal.timeout(5000)
      });
      supabaseApiStatus = `HTTP ${restRes.status}`;
    } catch (e: any) {
      supabaseApiStatus = e.message;
    }
  }

  return NextResponse.json({
    status: 'ok',
    service: 'barpulse-keepalive',
    timestamp,
    database: {
      status: dbStatus,
      latencyMs: dbLatencyMs
    },
    supabaseRest: supabaseApiStatus
  });
}
