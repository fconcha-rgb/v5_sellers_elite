import { useEffect, useMemo, useState } from 'react';
import {
BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
LineChart, Line, ComposedChart, LabelList,
} from 'recharts';
import { supabase } from './api';

/* ──────────────────────────────────────────────────────────────
TYPES
────────────────────────────────────────────────────────────── */
type RendSubtab = 'general' | 'kam' | 'seller';
type Periodo = '7d' | '30d' | '90d' | 'custom';

type MasterDaily = {
fecha: string;
seller_id: string;
seller_name: string | null;
kam: string | null;
es_se: string | null;
tipo_seller: string | null;
nmv: number;
units: number;
ordenes: number;
nmv_venta: number;
nmv_sin_promo: number;
content_score_avg: number | null;
final_score_avg: number | null;
total_spend: number;
impresiones: number;
clics: number;
conversiones: number;
promise_24h_fbs: number;
promise_total_fbs: number;
promise_24h_fbf: number;
promise_total_fbf: number;
promise_total: number;
ou_autogestionado: number;
fs_autogestionado: number;
ou_cofinanciado: number;
fs_cofinanciado: number;
};

type SkusRow = {
seller_id: string;
skus_branded: number;
skus_generico: number;
};

type YoyRow = {
fecha: string;
seller_id: string;
seller_name: string | null;
nmv: number | null;
nmv_ly: number | null;
units: number | null;
units_ly: number | null;
ordenes: number | null;
ordenes_ly: number | null;
modelo: string | null;
se_flag: boolean | null;
};

type SellerKPIs = {
seller_id: string;
seller_name: string;
kam: string;
nmv: number;
units: number;
ordenes: number;
fplus_avg: number;
fplus_real: number;
content_score: number;
total_spend: number;
sp_ratio: number;
olt_24h_fbs: number;
olt_24h_fbf: number;
olt_24h_total: number;
promo_ratio: number;
nmv_sin_promo: number;
nmv_ou: number;
nmv_fs: number;
skus_branded: number;
skus_generico: number;
skus_pct_generico: number;
yoy: number;
nmv_ly: number;
};

/* ──────────────────────────────────────────────────────────────
PALETTE (matches V1)
────────────────────────────────────────────────────────────── */
const C = {
bg: '#F8F9FB',
bgCard: '#FFFFFF',
bgAlt: '#F1F3F6',
bgDark: '#E8ECF0',
border: '#E5E8EC',
borderLight: '#EEF0F3',
text: '#1B1F24',
textSec: '#5A6473',
textMuted: '#8E96A3',
primary: '#16A34A',
primaryLight: '#DCFCE7',
primaryDark: '#15803D',
primaryBg: '#F0FDF4',
secondary: '#64748B',
tertiary: '#3B82F6',
tertiaryLight: '#DBEAFE',
tertiaryBg: '#EFF6FF',
danger: '#EF4444',
dangerLight: '#FEE2E2',
warning: '#F59E0B',
warningLight: '#FEF9C3',
warningBg: '#FFFBEB',
purple: '#7C3AED',
purpleLight: '#EDE9FE',
};

/* ──────────────────────────────────────────────────────────────
FORMATTERS
────────────────────────────────────────────────────────────── */
const fmt = (n: number) => {
if (!n && n !== 0) return '-';
if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
if (Math.abs(n) >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
return '$' + Math.round(n);
};
const fmtNum = (n: number) => new Intl.NumberFormat('es-CL').format(Math.round(n || 0));
const fmtPct = (n: number) => {
if (!isFinite(n) || isNaN(n)) return '-';
return (n * 100).toFixed(1) + '%';
};
const fmtScore = (n: number | null) => (n == null ? '-' : n.toFixed(1));

/* ──────────────────────────────────────────────────────────────
DATE UTILS
────────────────────────────────────────────────────────────── */
const todayStr = () => new Date().toISOString().slice(0, 10);
const daysAgoStr = (n: number) => {
const d = new Date();
d.setDate(d.getDate() - n);
return d.toISOString().slice(0, 10);
};

const periodoToDates = (p: Periodo, customFrom: string, customTo: string): [string, string] => {
if (p === 'custom') return [customFrom, customTo];
const days = p === '7d' ? 7 : p === '30d' ? 30 : 90;
return [daysAgoStr(days), todayStr()];
};

/* ──────────────────────────────────────────────────────────────
KPI CALCULATIONS
────────────────────────────────────────────────────────────── */
const calcSellerKPIs = (
daily: MasterDaily[],
skus: SkusRow[],
yoy: YoyRow[]
): SellerKPIs[] => {
const bySeller = new Map<string, MasterDaily[]>();
daily.forEach((r) => {
const arr = bySeller.get(r.seller_id) || [];
arr.push(r);
bySeller.set(r.seller_id, arr);
});

const skusMap = new Map(skus.map((s) => [s.seller_id, s]));

const yoyMap = new Map<string, { nmv: number; nmv_ly: number }>();
yoy.forEach((r) => {
const cur = yoyMap.get(r.seller_id) || { nmv: 0, nmv_ly: 0 };
cur.nmv += r.nmv || 0;
cur.nmv_ly += r.nmv_ly || 0;
yoyMap.set(r.seller_id, cur);
});

const result: SellerKPIs[] = [];
bySeller.forEach((rows, seller_id) => {
const sortedByDate = [...rows].sort((a, b) => b.fecha.localeCompare(a.fecha));
const latest = sortedByDate[0];


const nmv = rows.reduce((s, r) => s + (r.nmv || 0), 0);
const units = rows.reduce((s, r) => s + (r.units || 0), 0);
const ordenes = rows.reduce((s, r) => s + (r.ordenes || 0), 0);

const fplusVals = rows.map((r) => r.final_score_avg).filter((v): v is number => v != null);
const fplus_avg = fplusVals.length ? fplusVals.reduce((a, b) => a + b, 0) / fplusVals.length : 0;
const fplus_real = latest?.final_score_avg ?? 0;

const csVals = rows.map((r) => r.content_score_avg).filter((v): v is number => v != null);
const content_score = csVals.length ? csVals.reduce((a, b) => a + b, 0) / csVals.length : 0;

const total_spend = rows.reduce((s, r) => s + (r.total_spend || 0), 0);
const sp_ratio = nmv > 0 ? total_spend / nmv : 0;

const p24_fbs = rows.reduce((s, r) => s + (r.promise_24h_fbs || 0), 0);
const pt_fbs = rows.reduce((s, r) => s + (r.promise_total_fbs || 0), 0);
const p24_fbf = rows.reduce((s, r) => s + (r.promise_24h_fbf || 0), 0);
const pt_fbf = rows.reduce((s, r) => s + (r.promise_total_fbf || 0), 0);
const pt = rows.reduce((s, r) => s + (r.promise_total || 0), 0);

const olt_24h_fbs = pt_fbs > 0 ? p24_fbs / pt_fbs : 0;
const olt_24h_fbf = pt_fbf > 0 ? p24_fbf / pt_fbf : 0;
const olt_24h_total = pt > 0 ? (p24_fbs + p24_fbf) / pt : 0;

const ou = rows.reduce((s, r) => s + (r.ou_autogestionado || 0), 0);
const fs = rows.reduce((s, r) => s + (r.fs_autogestionado || 0), 0);
const nmv_sin_promo = rows.reduce((s, r) => s + (r.nmv_sin_promo || 0), 0);
const promo_ratio = nmv > 0 ? (ou + fs) / nmv : 0;

const sku = skusMap.get(seller_id);
const sb = sku?.skus_branded || 0;
const sg = sku?.skus_generico || 0;
const skus_pct_generico = sb + sg > 0 ? sg / (sb + sg) : 0;

const y = yoyMap.get(seller_id);
const nmv_ly = y?.nmv_ly || 0;
const yoyVal = nmv_ly > 0 ? (nmv - nmv_ly) / nmv_ly : 0;

result.push({
  seller_id,
  seller_name: latest?.seller_name || seller_id,
  kam: latest?.kam || 'Sin KAM',
  nmv, units, ordenes,
  fplus_avg, fplus_real,
  content_score,
  total_spend, sp_ratio,
  olt_24h_fbs, olt_24h_fbf, olt_24h_total,
  promo_ratio, nmv_sin_promo,
  nmv_ou: ou, nmv_fs: fs,
  skus_branded: sb, skus_generico: sg, skus_pct_generico,
  yoy: yoyVal, nmv_ly,
});


});

return result.sort((a, b) => b.nmv - a.nmv);
};

/* ──────────────────────────────────────────────────────────────
DATA HOOK
────────────────────────────────────────────────────────────── */
const useRendimientoData = (from: string, to: string) => {
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);
const [daily, setDaily] = useState<MasterDaily[]>([]);
const [skus, setSkus] = useState<SkusRow[]>([]);
const [yoy, setYoy] = useState<YoyRow[]>([]);

useEffect(() => {
let cancel = false;
const load = async () => {
setLoading(true);
setError(null);
try {
const fetchAll = async <T,>(table: string, build: (q: any) => any): Promise<T[]> => {
const out: T[] = [];
let from_ = 0;
const pageSize = 1000;
while (true) {
const { data, error } = await build(supabase.from(table).select('*'))
.range(from_, from_ + pageSize - 1);
if (error) throw error;
if (!data || data.length === 0) break;
out.push(...(data as T[]));
if (data.length < pageSize) break;
from_ += pageSize;
}
return out;
};


    const dailyP = fetchAll<MasterDaily>('master_se_daily', (q) =>
      q.gte('fecha', from).lte('fecha', to)
    );
    const skusP = fetchAll<SkusRow>('master_se_skus', (q) => q);
    const yoyP = fetchAll<YoyRow>('yoy_se', (q) =>
      q.gte('fecha', from).lte('fecha', to)
    );

    const [d, s, y] = await Promise.all([dailyP, skusP, yoyP]);
    if (cancel) return;
    setDaily(d);
    setSkus(s);
    setYoy(y);
  } catch (e: any) {
    if (!cancel) setError(e?.message || 'Error cargando datos');
  } finally {
    if (!cancel) setLoading(false);
  }
};
load();
return () => {
  cancel = true;
};


}, [from, to]);

return { loading, error, daily, skus, yoy };
};

/* ──────────────────────────────────────────────────────────────
UI HELPERS
────────────────────────────────────────────────────────────── */
const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (

  <div
    style={{
      background: C.bgCard,
      borderRadius: 14,
      border: '1px solid ' + C.borderLight,
      padding: 18,
      boxShadow: '0 1px 4px rgba(0,0,0,.03)',
      ...style,
    }}
  >
    {children}
  </div>
);

const KpiCard: React.FC<{
label: string;
value: string;
sub?: string;
alert?: boolean;
positive?: boolean;
}> = ({ label, value, sub, alert, positive }) => (
<Card>
<div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
{label}
</div>
<div
style={{
fontSize: 26,
fontWeight: 800,
color: alert ? C.danger : positive ? C.primary : C.text,
marginTop: 6,
letterSpacing: '-0.5px',
}}
> 
{value}
</div>
{sub && (
<div style={{ fontSize: 12, color: alert ? C.danger : C.textMuted, marginTop: 4, fontWeight: 500 }}>
{sub}
</div>
)}
</Card>
);

const SectionTitle: React.FC<{ children: React.ReactNode; sub?: string }> = ({ children, sub }) => (

  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>{children}</div>
    {sub && <div style={{ fontSize: 11, color: C.textMuted, marginTop: 2 }}>{sub}</div>}
  </div>
);

const Spinner: React.FC = () => (

  <div style={{ padding: 40, textAlign: 'center', color: C.textMuted }}>
    <div
      style={{
        display: 'inline-block',
        width: 24,
        height: 24,
        border: '3px solid ' + C.bgDark,
        borderTopColor: C.primary,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
    <style>{@keyframes spin { to { transform: rotate(360deg); } }}</style>
    <div style={{ marginTop: 12, fontSize: 13 }}>Cargando datos...</div>
  </div>
);

const Stat: React.FC<{ label: string; value: string; warning?: boolean }> = ({ label, value, warning }) => (

  <div>
    <div style={{ fontSize: 11, color: C.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>
      {label}
    </div>
    <div style={{ fontSize: 16, fontWeight: 700, color: warning ? C.warning : C.text, marginTop: 4 }}>{value}</div>
  </div>
);

/* ──────────────────────────────────────────────────────────────
PERIOD SELECTOR
────────────────────────────────────────────────────────────── */
const PeriodSelector: React.FC<{
periodo: Periodo;
setPeriodo: (p: Periodo) => void;
customFrom: string;
customTo: string;
setCustomFrom: (s: string) => void;
setCustomTo: (s: string) => void;
}> = ({ periodo, setPeriodo, customFrom, customTo, setCustomFrom, setCustomTo }) => (

  <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
    {(['7d', '30d', '90d', 'custom'] as Periodo[]).map((p) => (
      <button
        key={p}
        onClick={() => setPeriodo(p)}
        style={{
          padding: '7px 14px',
          borderRadius: 8,
          border: '1px solid ' + (periodo === p ? C.primary : C.border),
          background: periodo === p ? C.primary : C.bgCard,
          color: periodo === p ? '#fff' : C.textSec,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {p === 'custom' ? 'Custom' : 'Últimos ' + p}
      </button>
    ))}
    {periodo === 'custom' && (
      <>
        <input
          type="date"
          value={customFrom}
          onChange={(e) => setCustomFrom(e.target.value)}
          style={{ padding: 6, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13 }}
        />
        <span style={{ color: C.textMuted, fontSize: 13 }}>→</span>
        <input
          type="date"
          value={customTo}
          onChange={(e) => setCustomTo(e.target.value)}
          style={{ padding: 6, border: '1px solid ' + C.border, borderRadius: 6, fontSize: 13 }}
        />
      </>
    )}
  </div>
);

/* ──────────────────────────────────────────────────────────────
VISTA GENERAL
────────────────────────────────────────────────────────────── */
const VistaGeneral: React.FC<{ kpis: SellerKPIs[] }> = ({ kpis }) => {
const totals = useMemo(() => {
const nmv = kpis.reduce((s, k) => s + k.nmv, 0);
const nmv_ly = kpis.reduce((s, k) => s + k.nmv_ly, 0);
const fplus = kpis.length ? kpis.reduce((s, k) => s + k.fplus_avg, 0) / kpis.length : 0;
const content = kpis.length ? kpis.reduce((s, k) => s + k.content_score, 0) / kpis.length : 0;
const olt = kpis.length ? kpis.reduce((s, k) => s + k.olt_24h_total, 0) / kpis.length : 0;
const promo = kpis.length ? kpis.reduce((s, k) => s + k.promo_ratio, 0) / kpis.length : 0;
const sp = kpis.length ? kpis.reduce((s, k) => s + k.sp_ratio, 0) / kpis.length : 0;
const fplusAlerts = kpis.filter((k) => k.fplus_avg < 5 && k.fplus_avg > 0).length;
const yoy = nmv_ly > 0 ? (nmv - nmv_ly) / nmv_ly : 0;
return { nmv, nmv_ly, fplus, content, olt, promo, sp, fplusAlerts, yoy };
}, [kpis]);

const fplusData = useMemo(
() =>
[...kpis]
.filter((k) => k.fplus_avg > 0)
.sort((a, b) => a.fplus_avg - b.fplus_avg)
.slice(0, 15)
.map((k) => ({
name: k.seller_name.slice(0, 14),
fplus: Number(k.fplus_avg.toFixed(2)),
fill: k.fplus_avg < 5 ? C.danger : C.primary,
})),
[kpis]
);

const spData = useMemo(
() =>
[...kpis]
.filter((k) => k.nmv > 0)
.sort((a, b) => a.sp_ratio - b.sp_ratio)
.slice(0, 15)
.map((k) => ({
name: k.seller_name.slice(0, 14),
spend: k.total_spend / 1e6,
ratio: Number((k.sp_ratio * 100).toFixed(2)),
})),
[kpis]
);

const oltData = useMemo(
() =>
[...kpis]
.filter((k) => k.olt_24h_total > 0)
.sort((a, b) => a.olt_24h_total - b.olt_24h_total)
.slice(0, 15)
.map((k) => ({
name: k.seller_name.slice(0, 14),
fbs: Number((k.olt_24h_fbs * 100).toFixed(1)),
fbf: Number((k.olt_24h_fbf * 100).toFixed(1)),
total: Number((k.olt_24h_total * 100).toFixed(1)),
fill: k.olt_24h_total < 0.6 ? C.danger : k.olt_24h_total < 0.75 ? C.warning : C.primary,
})),
[kpis]
);

const promoData = useMemo(
() =>
[...kpis]
.filter((k) => k.nmv > 0)
.sort((a, b) => a.promo_ratio - b.promo_ratio)
.slice(0, 15)
.map((k) => ({
name: k.seller_name.slice(0, 14),
sin_promo: k.nmv_sin_promo / 1e6,
ou: k.nmv_ou / 1e6,
fs: k.nmv_fs / 1e6,
ratio: Number((k.promo_ratio * 100).toFixed(2)),
})),
[kpis]
);

const skusData = useMemo(
() =>
[...kpis]
.filter((k) => k.skus_branded + k.skus_generico > 0)
.sort((a, b) => b.skus_pct_generico - a.skus_pct_generico)
.slice(0, 15)
.map((k) => ({
name: k.seller_name.slice(0, 14),
branded: k.skus_branded,
generico: k.skus_generico,
pct: Number((k.skus_pct_generico * 100).toFixed(1)),
})),
[kpis]
);

return (
<>
<div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 18 }}>
<KpiCard
label="NMV Total"
value={fmt(totals.nmv)}
sub={(totals.yoy >= 0 ? '+' : '') + (totals.yoy * 100).toFixed(1) + '% YoY'}
positive={totals.yoy >= 0}
/>
<KpiCard
label=“Fplus Promedio”
value={fmtScore(totals.fplus)}
sub={totals.fplusAlerts + ' sellers bajo 5'}
alert={totals.fplus < 5}
/>
<KpiCard label="OLT 24h" value={fmtPct(totals.olt)} sub="FBS + FBF promedio" />
<KpiCard label="Content Score" value={totals.content.toFixed(0)} sub="Promedio sellers" />
<KpiCard label="Ratio SP" value={fmtPct(totals.sp)} sub="Inversión / NMV" />
<KpiCard label="Promo Autogestionada" value={fmtPct(totals.promo)} sub="OU + FS / NMV" />
</div>


  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: 14 }}>
    <Card>
      <SectionTitle sub="Sellers con peor puntaje primero — rojo: bajo 5">Envío Fplus por seller</SectionTitle>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={fplusData} layout="vertical" margin={{ left: 70 }}>
          <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
          <Tooltip />
          <Bar dataKey="fplus" radius={[0, 4, 4, 0]}>
            {fplusData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList dataKey="fplus" position="right" style={{ fontSize: 10, fill: C.textSec }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="Spend en M$ + ratio SP/NMV — sellers con menor inversión primero">
        Inversión Sponsored Products
      </SectionTitle>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={spData} margin={{ bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 9 }} angle={-40} textAnchor="end" height={70} interval={0} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => v + 'M'} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => v + '%'} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="spend" fill={C.tertiary} name="Spend (M$)" radius={[4, 4, 0, 0]} />
          <Line yAxisId="right" type="monotone" dataKey="ratio" stroke={C.danger} strokeWidth={2} name="Ratio %" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="% productos con despacho < 24h (FBS+FBF combinado)">OLT 24 horas</SectionTitle>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={oltData} layout="vertical" margin={{ left: 70 }}>
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => v + '%'} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
          <Tooltip formatter={(v: any) => v + '%'} />
          <Bar dataKey="total" radius={[0, 4, 4, 0]}>
            {oltData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
            <LabelList dataKey="total" position="right" formatter={(v: number) => v + '%'} style={{ fontSize: 10, fill: C.textSec }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="Promedio del periodo">Content Score por seller</SectionTitle>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart
          data={[...kpis]
            .filter((k) => k.content_score > 0)
            .sort((a, b) => a.content_score - b.content_score)
            .slice(0, 15)
            .map((k) => ({ name: k.seller_name.slice(0, 14), cs: Number(k.content_score.toFixed(1)) }))}
          layout="vertical"
          margin={{ left: 70 }}
        >
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
          <Tooltip />
          <Bar dataKey="cs" fill={C.purple} radius={[0, 4, 4, 0]}>
            <LabelList dataKey="cs" position="right" style={{ fontSize: 10, fill: C.textSec }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>

    <Card style={{ gridColumn: '1 / -1' }}>
      <SectionTitle sub="Stack: NMV sin promo + OU + FS — línea: ratio inversión total">
        Inversión en promoción autogestionada
      </SectionTitle>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={promoData} margin={{ bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={70} interval={0} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} tickFormatter={(v) => v + 'M'} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => v + '%'} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="sin_promo" stackId="a" fill={C.secondary} name="Sin promo" />
          <Bar yAxisId="left" dataKey="ou" stackId="a" fill={C.primary} name="Oportunidad Única" />
          <Bar yAxisId="left" dataKey="fs" stackId="a" fill={C.tertiary} name="Free Shipping" />
          <Line yAxisId="right" type="monotone" dataKey="ratio" stroke={C.danger} strokeWidth={2} name="Ratio %" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>

    <Card style={{ gridColumn: '1 / -1' }}>
      <SectionTitle sub="Branded vs genéricos — ordenado por mayor % genérico">SKUs por seller</SectionTitle>
      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={skusData} margin={{ bottom: 60 }}>
          <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-40} textAnchor="end" height={70} interval={0} />
          <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
          <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} tickFormatter={(v) => v + '%'} />
          <Tooltip />
          <Bar yAxisId="left" dataKey="branded" stackId="a" fill={C.primary} name="Con marca" />
          <Bar yAxisId="left" dataKey="generico" stackId="a" fill={C.warning} name="Genéricos" />
          <Line yAxisId="right" type="monotone" dataKey="pct" stroke={C.danger} strokeWidth={2} name="% genéricos" />
        </ComposedChart>
      </ResponsiveContainer>
    </Card>
  </div>
</>


);
};

/* ──────────────────────────────────────────────────────────────
POR KAM
────────────────────────────────────────────────────────────── */
const PorKAM: React.FC<{ kpis: SellerKPIs[] }> = ({ kpis }) => {
const kamData = useMemo(() => {
const map = new Map<string, SellerKPIs[]>();
kpis.forEach((k) => {
const arr = map.get(k.kam) || [];
arr.push(k);
map.set(k.kam, arr);
});
const out: any[] = [];
map.forEach((sellers, kam) => {
const nmv = sellers.reduce((s, x) => s + x.nmv, 0);
const nmv_ly = sellers.reduce((s, x) => s + x.nmv_ly, 0);
const totalSpend = sellers.reduce((s, x) => s + x.total_spend, 0);
const fplusVals = sellers.map((s) => s.fplus_avg).filter((v) => v > 0);
const csVals = sellers.map((s) => s.content_score).filter((v) => v > 0);
const oltVals = sellers.map((s) => s.olt_24h_total).filter((v) => v > 0);
const promoVals = sellers.map((s) => s.promo_ratio).filter((v) => v > 0);
out.push({
kam,
sellers: sellers.length,
nmv,
yoy: nmv_ly > 0 ? (nmv - nmv_ly) / nmv_ly : 0,
fplus: fplusVals.length ? fplusVals.reduce((a, b) => a + b, 0) / fplusVals.length : 0,
fplus_alerts: sellers.filter((s) => s.fplus_avg < 5 && s.fplus_avg > 0).length,
olt: oltVals.length ? oltVals.reduce((a, b) => a + b, 0) / oltVals.length : 0,
content: csVals.length ? csVals.reduce((a, b) => a + b, 0) / csVals.length : 0,
sp_ratio: nmv > 0 ? totalSpend / nmv : 0,
promo: promoVals.length ? promoVals.reduce((a, b) => a + b, 0) / promoVals.length : 0,
});
});
return out.sort((a, b) => b.nmv - a.nmv);
}, [kpis]);

return (
<Card>
<SectionTitle sub="Comparativa de KPIs por KAM — Sellers Elite">Rendimiento por KAM</SectionTitle>
<div style={{ overflowX: 'auto' }}>
<table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
<thead>
<tr style={{ background: C.bgAlt, textAlign: 'left' }}>
<th style={{ padding: 10, fontWeight: 700 }}>KAM</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>Sellers</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>NMV</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>YoY</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>Fplus</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>OLT 24h</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>Content</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>Ratio SP</th>
<th style={{ padding: 10, fontWeight: 700, textAlign: 'right' }}>Promo</th>
</tr>
</thead>
<tbody>
{kamData.map((k) => (
<tr key={k.kam} style={{ borderTop: '1px solid ' + C.border }}>
<td style={{ padding: 10, fontWeight: 600 }}>{k.kam}</td>
<td style={{ padding: 10, textAlign: 'right' }}>{k.sellers}</td>
<td style={{ padding: 10, textAlign: 'right', fontWeight: 600 }}>{fmt(k.nmv)}</td>
<td style={{ padding: 10, textAlign: 'right', color: k.yoy >= 0 ? C.primary : C.danger, fontWeight: 700 }}>
{(k.yoy * 100).toFixed(1)}%
</td>
<td style={{ padding: 10, textAlign: 'right', color: k.fplus < 5 ? C.danger : C.text, fontWeight: 600 }}>
{fmtScore(k.fplus)}
{k.fplus_alerts > 0 && (
<span style={{ fontSize: 10, color: C.danger, marginLeft: 4 }}>({k.fplus_alerts})</span>
)}
</td>
<td style={{ padding: 10, textAlign: 'right' }}>{fmtPct(k.olt)}</td>
<td style={{ padding: 10, textAlign: 'right' }}>{k.content.toFixed(0)}</td>
<td style={{ padding: 10, textAlign: 'right' }}>{fmtPct(k.sp_ratio)}</td>
<td style={{ padding: 10, textAlign: 'right' }}>{fmtPct(k.promo)}</td>
</tr>
))}
</tbody>
</table>
</div>
</Card>
);
};

/* ──────────────────────────────────────────────────────────────
POR SELLER
────────────────────────────────────────────────────────────── */
const PorSeller: React.FC<{ kpis: SellerKPIs[]; daily: MasterDaily[]; yoy: YoyRow[] }> = ({ kpis, daily, yoy }) => {
const [selected, setSelected] = useState<string>(kpis[0]?.seller_id || '');

useEffect(() => {
if (!selected && kpis.length > 0) setSelected(kpis[0].seller_id);
}, [kpis, selected]);

const seller = kpis.find((k) => k.seller_id === selected);

const trendData = useMemo(() => {
const sellerDaily = daily.filter((d) => d.seller_id === selected).sort((a, b) => a.fecha.localeCompare(b.fecha));
return sellerDaily.map((d) => ({
fecha: d.fecha.slice(5),
nmv: (d.nmv || 0) / 1e6,
fplus: d.final_score_avg || 0,
content: d.content_score_avg || 0,
}));
}, [daily, selected]);

const yoyTrend = useMemo(() => {
const sellerYoy = yoy.filter((y) => y.seller_id === selected).sort((a, b) => a.fecha.localeCompare(b.fecha));
return sellerYoy.map((y) => ({
fecha: y.fecha.slice(5),
nmv: (y.nmv || 0) / 1e6,
nmv_ly: (y.nmv_ly || 0) / 1e6,
}));
}, [yoy, selected]);

if (!seller) return <Card>No hay sellers en este periodo</Card>;

return (
<>
<Card style={{ marginBottom: 16 }}>
<div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
<span style={{ fontWeight: 700, fontSize: 14 }}>Seller:</span>
<select
value={selected}
onChange={(e) => setSelected(e.target.value)}
style={{
padding: 8,
border: '1px solid ' + C.border,
borderRadius: 8,
fontSize: 14,
minWidth: 280,
fontFamily: 'inherit',
}}
> 
{kpis.map((s)=> (
<option key={s.seller_id} value={s.seller_id}>
{s.seller_name} — {s.kam}
</option>
))}
</select>
<span style={{ fontSize: 12, color: C.textMuted }}>ID: {seller.seller_id}</span>
</div>
</Card>


  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
    <KpiCard
      label="NMV"
      value={fmt(seller.nmv)}
      sub={(seller.yoy >= 0 ? '+' : '') + (seller.yoy * 100).toFixed(1) + '% YoY'}
      positive={seller.yoy >= 0}
    />
    <KpiCard
      label="Fplus Real"
      value={fmtScore(seller.fplus_real)}
      sub={'Promedio: ' + fmtScore(seller.fplus_avg)}
      alert={seller.fplus_real < 5}
    />
    <KpiCard label="OLT 24h" value={fmtPct(seller.olt_24h_total)} sub="FBS+FBF" />
    <KpiCard label="Content Score" value={seller.content_score.toFixed(0)} sub="Promedio" />
    <KpiCard label="Ratio SP" value={fmtPct(seller.sp_ratio)} sub={fmt(seller.total_spend) + ' invertidos'} />
    <KpiCard label="Promo Auto" value={fmtPct(seller.promo_ratio)} sub="OU + FS / NMV" />
  </div>

  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: 14 }}>
    <Card>
      <SectionTitle sub="NMV diario (M$)">Tendencia NMV</SectionTitle>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trendData}>
          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(0) + 'M'} />
          <Tooltip formatter={(v: any) => '$' + (v as number).toFixed(2) + 'M'} />
          <Line type="monotone" dataKey="nmv" stroke={C.primary} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="vs año anterior (M$)">YoY diario</SectionTitle>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={yoyTrend}>
          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => v.toFixed(0) + 'M'} />
          <Tooltip formatter={(v: any) => '$' + (v as number).toFixed(2) + 'M'} />
          <Line type="monotone" dataKey="nmv" stroke={C.primary} strokeWidth={2} dot={false} name="Este año" />
          <Line type="monotone" dataKey="nmv_ly" stroke={C.textMuted} strokeWidth={2} strokeDasharray="4 4" dot={false} name="Año anterior" />
        </LineChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="Final score diario (puede variar día a día)">Fplus diario</SectionTitle>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trendData}>
          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 10]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="fplus" stroke={C.tertiary} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>

    <Card>
      <SectionTitle sub="Promedio diario">Content Score diario</SectionTitle>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={trendData}>
          <XAxis dataKey="fecha" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip />
          <Line type="monotone" dataKey="content" stroke={C.purple} strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </Card>

    <Card style={{ gridColumn: '1 / -1' }}>
      <SectionTitle>Detalle operacional</SectionTitle>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16 }}>
        <Stat label="OLT FBS" value={fmtPct(seller.olt_24h_fbs)} />
        <Stat label="OLT FBF" value={fmtPct(seller.olt_24h_fbf)} />
        <Stat label="Unidades" value={fmtNum(seller.units)} />
        <Stat label="Órdenes" value={fmtNum(seller.ordenes)} />
        <Stat label="SKUs con marca" value={fmtNum(seller.skus_branded)} />
        <Stat
          label="SKUs genéricos"
          value={fmtNum(seller.skus_generico) + ' (' + fmtPct(seller.skus_pct_generico) + ')'}
          warning={seller.skus_pct_generico > 0.1}
        />
        <Stat label="NMV sin promo" value={fmt(seller.nmv_sin_promo)} />
        <Stat label="NMV OU" value={fmt(seller.nmv_ou)} />
        <Stat label="NMV FS" value={fmt(seller.nmv_fs)} />
      </div>
    </Card>
  </div>
</>


);
};

/* ──────────────────────────────────────────────────────────────
MAIN COMPONENT
────────────────────────────────────────────────────────────── */
const Rendimiento: React.FC = () => {
const [subtab, setSubtab] = useState<RendSubtab>('general');
const [periodo, setPeriodo] = useState<Periodo>('30d');
const [customFrom, setCustomFrom] = useState(daysAgoStr(30));
const [customTo, setCustomTo] = useState(todayStr());

const [from, to] = periodoToDates(periodo, customFrom, customTo);
const { loading, error, daily, skus, yoy } = useRendimientoData(from, to);

const kpis = useMemo(() => calcSellerKPIs(daily, skus, yoy), [daily, skus, yoy]);

return (
<div>
<div style={{ marginBottom: 16 }}>
<h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: C.primary, letterSpacing: '-0.5px' }}>
RENDIMIENTO
</h1>
<p style={{ margin: '2px 0 0', fontSize: 12, color: C.textMuted }}>
KPIs operacionales — solo Sellers Elite
</p>
</div>


  <div
    style={{
      display: 'flex',
      gap: 2,
      marginBottom: 16,
      background: C.bgAlt,
      padding: 3,
      borderRadius: 10,
      width: 'fit-content',
    }}
  >
    {(
      [
        ['general', 'Vista General'],
        ['kam', 'Por KAM'],
        ['seller', 'Por Seller'],
      ] as [RendSubtab, string][]
    ).map((item) => (
      <button
        key={item[0]}
        onClick={() => setSubtab(item[0])}
        style={{
          padding: '7px 16px',
          borderRadius: 8,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          border: 'none',
          fontFamily: 'inherit',
          transition: 'all .2s',
          background: subtab === item[0] ? C.primary : 'transparent',
          color: subtab === item[0] ? '#fff' : C.textSec,
          boxShadow: subtab === item[0] ? '0 2px 8px rgba(22,163,74,.2)' : 'none',
        }}
      >
        {item[1]}
      </button>
    ))}
  </div>

  <PeriodSelector
    periodo={periodo}
    setPeriodo={setPeriodo}
    customFrom={customFrom}
    customTo={customTo}
    setCustomFrom={setCustomFrom}
    setCustomTo={setCustomTo}
  />

  {loading && <Spinner />}
  {error && (
    <Card style={{ background: C.dangerLight, borderColor: C.danger }}>
      <div style={{ color: C.danger, fontWeight: 600 }}>Error: {error}</div>
    </Card>
  )}
  {!loading && !error && kpis.length === 0 && (
    <Card>
      <div style={{ color: C.textMuted, textAlign: 'center', padding: 20 }}>
        No hay datos para este periodo. Verifica que la data esté cargada en Supabase.
      </div>
    </Card>
  )}

  {!loading && !error && kpis.length > 0 && (
    <>
      {subtab === 'general' && <VistaGeneral kpis={kpis} />}
      {subtab === 'kam' && <PorKAM kpis={kpis} />}
      {subtab === 'seller' && <PorSeller kpis={kpis} daily={daily} yoy={yoy} />}
    </>
  )}
</div>


);
};

export default Rendimiento;
