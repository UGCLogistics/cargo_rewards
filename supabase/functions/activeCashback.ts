import { createClient } from 'npm:@supabase/supabase-js@2';

export const config = {
  // dijalankan berkala (misal 90 hari sekali, atau sesuai scheduled job)
  schedule: '0 0 0 */90 * *',
};

Deno.serve(async (_req) => {
  const url = Deno.env.get('SUPABASE_URL');
  const key =
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE');

  if (!url || !key) {
    console.error('Missing SUPABASE_URL or SERVICE_ROLE key');
    return new Response('Missing environment variables', { status: 500 });
  }

  const supabase = createClient(url, key);

  const today = new Date();
  const end = today.toISOString();
  const startDate = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000);
  const start = startDate.toISOString();

  // agregasi total publish_rate 90 hari terakhir per user
  const { data, error } = await supabase
    .from('transactions')
    .select('user_id, sum(publish_rate) as total_rate')
    .gte('date', start)
    .lte('date', end)
    .group('user_id');

  if (error) {
    console.error('Error fetching transactions', error);
    return new Response('Error fetching transactions', { status: 500 });
  }

  for (const row of data ?? []) {
    const userId = row.user_id;
    const totalRate = Number(row.total_rate) || 0;

    // 1) CARI TANGGAL TRANSAKSI PERTAMA USER
    const { data: firstTx, error: firstTxError } = await supabase
      .from('transactions')
      .select('date')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (firstTxError || !firstTx) {
      console.error('Tidak bisa ambil transaksi pertama user', userId, firstTxError);
      continue;
    }

    const firstDate = new Date(firstTx.date);
    const promoEnd = new Date(firstDate.getTime() + 90 * 24 * 60 * 60 * 1000);

    // 2) CEK: kalau hari ini sudah lewat 90 hari sejak transaksi pertama → skip
    if (today > promoEnd) {
      console.log(
        `User ${userId} sudah lewat masa promo (berakhir ${promoEnd.toISOString().substring(0, 10)}), tidak hitung cashback.`
      );
      continue;
    }

    // 3) LOGIC CASHBACK & TIER HANYA UNTUK USER YANG MASIH DALAM 90 HARI PERTAMA
    let cashbackPercent = 0;
    let tier = 'SILVER';
    let multiplier = 1;

    if (totalRate >= 50_000_000) {
      cashbackPercent = 0.075;
      tier = 'PLATINUM';
      multiplier = 1.5;
    } else if (totalRate >= 25_000_000) {
      cashbackPercent = 0.05;
      tier = 'GOLD';
      multiplier = 1.2;
    } else {
      cashbackPercent = 0.0;
      tier = 'SILVER';
      multiplier = 1.0;
    }

    const cashbackAmount = totalRate * cashbackPercent;

    if (cashbackAmount > 0) {
      const { error: ledgerError } = await supabase.from('reward_ledgers').insert({
        user_id: userId,
        type: 'CASHBACK',
        amount: cashbackAmount,
        points: 0,
        note: `Cashback ${cashbackPercent * 100}% untuk periode berakhir ${end.substring(
          0,
          10
        )}`,
      });

      if (ledgerError) {
        console.error('Error insert reward_ledgers', ledgerError);
      }
    }

    const { error: snapshotError } = await supabase.from('tier_snapshots').insert({
      user_id: userId,
      tier,
      quarter_start: start.substring(0, 10),
      quarter_end: end.substring(0, 10),
      multiplier,
      points_quarter: 0,
    });

    if (snapshotError) {
      console.error('Error insert tier_snapshots', snapshotError);
    }
  }

  return new Response('Cashback & tier evaluation completed (90-day user window)', {
    status: 200,
  });
});
