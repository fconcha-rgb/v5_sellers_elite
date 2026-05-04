import { supabase } from './api';

/* ============================================================
   TIPOS
============================================================ */
export type MasterDailyRow = {
  fecha: string;
  seller_id: string;
  seller_name: string | null;
  kam: string | null;
  es_se: string | null;
  tipo_seller: string | null;
  nmv: number | null;
  units: number | null;
  ordenes: number | null;
  nmv_venta: number | null;
  nmv_sin_promo: number | null;
  content_score_avg: number | null;
  final_score_avg: number | null;
  total_spend: number | null;
  impresiones: number | null;
  clics: number | null;
  conversiones: number | null;
  promise_24h_fbs: number | null;
  promise_total_fbs: number | null;
  promise_24h_fbf: number | null;
  promise_total_fbf: number | null;
  promise_total: number | null;
  ou_autogestionado: number | null;
  fs_autogestionado: number | null;
  ou_cofinanciado: number | null;
  fs_cofinanciado: number | null;
};

export type SkusRow = {
  seller_id: string;
  skus_branded: number | null;
  skus_generico: number | null;
};

export type YoYRow = {
  fecha: string;
  seller_id: string;
  seller_name: string | null;
  gmv: number | null;
  nmv: number | null;
  units: number | null;
  ordenes: number | null;
  gmv_ly: number | null;
  nmv_ly: number | null;
  units_ly: number | null;
  ordenes_ly: number | null;
  modelo: string | null;
  se_flag: boolean | null;
  tipo_seller: string | null;
};

/* ============================================================
   FETCH FUNCTIONS
   IMPORTANTE: Supabase limita por defecto a 1000 filas por
   request. Usamos paginación manual con range() para traer todo.
============================================================ */

const PAGE_SIZE = 1000;

async function fetchAllPaginated<T>(
  tableName: string,
  filterFn?: (q: any) => any
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  let keepGoing = true;

  while (keepGoing) {
    let query = supabase.from(tableName).select('*').range(from, from + PAGE_SIZE - 1);
    if (filterFn) query = filterFn(query);

    const { data, error } = await query;
    if (error) {
      console.error(`Error fetching ${tableName}:`, error);
      break;
    }
    if (!data || data.length === 0) break;

    all.push(...(data as T[]));
    if (data.length < PAGE_SIZE) keepGoing = false;
    else from += PAGE_SIZE;
  }
  return all;
}

export async function fetchMasterDaily(daysBack = 90): Promise<MasterDailyRow[]> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().slice(0, 10);
  return fetchAllPaginated<MasterDailyRow>('master_se_daily', (q) =>
    q.gte('fecha', fromStr)
  );
}

export async function fetchSkus(): Promise<SkusRow[]> {
  return fetchAllPaginated<SkusRow>('master_se_skus');
}

export async function fetchYoY(daysBack = 90): Promise<YoYRow[]> {
  const from = new Date();
  from.setDate(from.getDate() - daysBack);
  const fromStr = from.toISOString().slice(0, 10);
  return fetchAllPaginated<YoYRow>('yoy_se', (q) => q.gte('fecha', fromStr));
}
