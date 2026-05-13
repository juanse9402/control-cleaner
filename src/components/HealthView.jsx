// HealthView.jsx — Sección de Salud completamente independiente.
// NO importa nada de App.jsx. Solo depende de supabaseClient y MigraineChart.
import { useState, useEffect, useMemo } from 'react';
import { Pill, Syringe, TrendingDown, TrendingUp, AlertCircle, Clock, FileText, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import MigraineChart from './MigraineChart';

function getNowMonthStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default function HealthView() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [trends, setTrends] = useState({ currentMonth: { Naproxeno: 0, Imigran: 0 }, lastMonth: { Naproxeno: 0, Imigran: 0 } });
  const [allRecords, setAllRecords] = useState([]);
  const [allCycles, setAllCycles] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(getNowMonthStr);

  // ─── Fetch ───────────────────────────────────────────────────
  const fetchData = async () => {
    try {
      const [logsRes, trendRes, recordsRes, cyclesRes] = await Promise.all([
        supabase.from('migraña_registros').select('*').order('fecha', { ascending: false }).limit(5),
        supabase.from('vista_tendencia_migraña').select('*'),
        supabase.from('migraña_registros').select('*'),
        supabase.from('ciclo_menstrual').select('*'),
      ]);

      setLogs(logsRes.data || []);
      setAllRecords(recordsRes.data || []);
      setAllCycles(cyclesRes.data || []);

      // Trends
      const now = new Date();
      const current = { Naproxeno: 0, Imigran: 0 };
      const previous = { Naproxeno: 0, Imigran: 0 };
      (trendRes.data || []).forEach((row) => {
        const d = new Date(row.mes);
        const isNow = d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        const isLast = d.getFullYear() === new Date(now.getFullYear(), now.getMonth() - 1).getFullYear()
          && d.getMonth() === new Date(now.getFullYear(), now.getMonth() - 1).getMonth();
        const type = row.tipo_tratamiento.includes('Imigran') || row.tipo_tratamiento.includes('Inyección') ? 'Imigran' : 'Naproxeno';
        if (isNow) current[type] += Number(row.cantidad);
        if (isLast) previous[type] += Number(row.cantidad);
      });
      setTrends({ currentMonth: current, lastMonth: previous });
    } catch (err) {
      console.error('HealthView fetchData error:', err);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // ─── Handlers ────────────────────────────────────────────────
  const handleLog = async (tipo) => {
    setLoading(true);
    try {
      // fecha en formato YYYY-MM-DD para compatibilidad con la columna
      const today = new Date();
      const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { error } = await supabase
        .from('migraña_registros')
        .insert([{ fecha, tipo_tratamiento: tipo }]);
      if (error) {
        console.error('Error detallado (migraña_registros):', error);
        throw error;
      }
      await fetchData();
    } catch (err) {
      console.error('handleLog catch:', err);
      alert(`Error al guardar el registro: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegla = async () => {
    setLoading(true);
    try {
      const today = new Date();
      const fecha = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const { error } = await supabase
        .from('ciclo_menstrual')
        .insert([{ fecha }]);
      if (error) {
        console.error('Error detallado (ciclo_menstrual):', error);
        throw error;
      }
      await fetchData();
    } catch (err) {
      console.error('handleRegla catch:', err);
      alert(`Error al guardar día de regla: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  // ─── Helpers ─────────────────────────────────────────────────
  const formatDate = (iso) =>
    new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const Trend = ({ cur, prev }) => {
    if (cur > prev) return <span className="flex items-center text-xs text-red-500 font-medium"><TrendingUp className="w-3 h-3 mr-1" /> Sube (+{cur - prev})</span>;
    if (cur < prev) return <span className="flex items-center text-xs text-green-600 font-medium"><TrendingDown className="w-3 h-3 mr-1" /> Baja ({prev - cur})</span>;
    return <span className="text-xs text-gray-400 font-medium">Igual</span>;
  };

  // ─── Chart data ───────────────────────────────────────────────
  const { dailyData, reglaStats, refAreasRegla, refAreasPredicted, avgCycleLength } = useMemo(() => {
    const fallback = { dailyData: [], reglaStats: { diasDolor: 0, diasDolorEnRegla: 0 }, refAreasRegla: [], refAreasPredicted: [], avgCycleLength: 28 };
    if (!selectedMonth) return fallback;

    const [year, month] = selectedMonth.split('-').map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // Average cycle length
    const sorted = [...allCycles].map((c) => new Date(c.fecha)).sort((a, b) => a - b);
    let avgLength = 28;
    if (sorted.length > 1) {
      const total = sorted.reduce((acc, d, i) => i === 0 ? 0 : acc + (d - sorted[i - 1]) / 86400000, 0);
      avgLength = Math.round(total / (sorted.length - 1));
    }

    // Period days: start + 4
    const periodSet = new Set();
    sorted.forEach((d) => {
      for (let i = 0; i <= 4; i++) {
        const pd = new Date(d);
        pd.setDate(pd.getDate() + i);
        periodSet.add(`${pd.getFullYear()}-${pd.getMonth() + 1}-${pd.getDate()}`);
      }
    });

    // Predicted next period
    const predictedSet = new Set();
    if (sorted.length > 0) {
      const next = new Date(sorted[sorted.length - 1]);
      next.setDate(next.getDate() + avgLength);
      for (let i = 0; i <= 4; i++) {
        const pd = new Date(next);
        pd.setDate(pd.getDate() + i);
        predictedSet.add(`${pd.getFullYear()}-${pd.getMonth() + 1}-${pd.getDate()}`);
      }
    }

    // Build daily map
    const map = {};
    for (let i = 1; i <= daysInMonth; i++) {
      const key = `${year}-${month}-${i}`;
      map[i] = { name: String(i), day: i, Naproxeno: 0, Imigran: 0, isRegla: periodSet.has(key), isPredicted: predictedSet.has(key) };
    }

    allRecords.forEach((r) => {
      const d = new Date(r.fecha);
      if (d.getFullYear() === year && d.getMonth() + 1 === month && map[d.getDate()]) {
        const type = r.tipo_tratamiento.includes('Imigran') || r.tipo_tratamiento.includes('Inyección') ? 'Imigran' : 'Naproxeno';
        map[d.getDate()][type] += 1;
      }
    });

    // Continuous reference area ranges
    const areasRegla = [];
    const areasPred = [];
    let sR = null, sP = null;
    for (let i = 1; i <= daysInMonth; i++) {
      if (map[i].isRegla && !sR) sR = String(i);
      if (!map[i].isRegla && sR) { areasRegla.push({ start: sR, end: String(i - 1) }); sR = null; }
      if (map[i].isPredicted && !sP) sP = String(i);
      if (!map[i].isPredicted && sP) { areasPred.push({ start: sP, end: String(i - 1) }); sP = null; }
    }
    if (sR) areasRegla.push({ start: sR, end: String(daysInMonth) });
    if (sP) areasPred.push({ start: sP, end: String(daysInMonth) });

    // Stats
    let diasDolor = 0, diasDolorEnRegla = 0;
    Object.values(map).forEach((d) => {
      if (d.Naproxeno > 0 || d.Imigran > 0) {
        diasDolor++;
        if (d.isRegla) diasDolorEnRegla++;
      }
    });

    return {
      dailyData: Object.values(map),
      reglaStats: { diasDolor, diasDolorEnRegla },
      refAreasRegla: areasRegla,
      refAreasPredicted: areasPred,
      avgCycleLength: avgLength,
    };
  }, [selectedMonth, allRecords, allCycles]);

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-8">

      {/* Tratamiento Diario */}
      <div className="bg-purple-100/60 rounded-xl p-4 border border-purple-200 flex items-center gap-4 shadow-sm">
        <div className="bg-purple-200/80 p-2.5 rounded-full">
          <Pill className="w-6 h-6 text-purple-700" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1">Tratamiento diario</h3>
          <p className="text-base text-purple-800 font-bold">Tryptizol (1 pastilla)</p>
        </div>
      </div>

      {/* Registro Rápido */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-purple-600" /> Registro Rápido
        </h2>
        <div className="flex flex-col gap-3">
          <button onClick={() => handleLog('Naproxeno (Dolor Leve)')} disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95">
            <Pill className="w-6 h-6" /> + Naproxeno (Dolor Leve)
          </button>
          <button onClick={() => handleLog('Imigran (Inyección - Dolor Fuerte)')} disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95">
            <Syringe className="w-6 h-6" /> + Imigran (Inyección - Dolor Fuerte)
          </button>
          <button onClick={handleRegla} disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-pink-500 hover:bg-pink-600 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95 mt-1">
            <CalendarDays className="w-6 h-6" /> Marcar día de Regla
          </button>
        </div>
      </section>

      {/* Resumen del Mes */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-purple-600" /> Resumen de Mes Actual
        </h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <h3 className="text-xs text-orange-600 font-semibold mb-2 uppercase tracking-wider">Naproxeno</h3>
            <div className="flex items-end justify-between mb-1">
              <p className="text-3xl font-bold text-orange-800">{trends.currentMonth.Naproxeno}</p>
              <Trend cur={trends.currentMonth.Naproxeno} prev={trends.lastMonth.Naproxeno} />
            </div>
            <p className="text-[10px] text-orange-500 font-medium">Mes anterior: {trends.lastMonth.Naproxeno}</p>
          </div>
          <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
            <h3 className="text-xs text-rose-600 font-semibold mb-2 uppercase tracking-wider">Imigran</h3>
            <div className="flex items-end justify-between mb-1">
              <p className="text-3xl font-bold text-rose-900">{trends.currentMonth.Imigran}</p>
              <Trend cur={trends.currentMonth.Imigran} prev={trends.lastMonth.Imigran} />
            </div>
            <p className="text-[10px] text-rose-500 font-medium">Mes anterior: {trends.lastMonth.Imigran}</p>
          </div>
        </div>
      </section>

      {/* Informe Médico — Gráfica */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-lg font-semibold text-purple-900 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-600" /> Informe Médico
          </h2>
          <input type="month" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}
            className="border border-purple-200 text-purple-800 text-sm rounded-lg px-2 py-1 bg-purple-50 focus:outline-none focus:border-purple-500" />
        </div>

        <div className="h-64 w-full mb-4">
          {dailyData.length > 0
            ? <MigraineChart dailyData={dailyData} refAreasRegla={refAreasRegla} refAreasPredicted={refAreasPredicted} />
            : <div className="h-full flex items-center justify-center text-purple-300 text-sm">Cargando datos de salud...</div>
          }
        </div>

        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 flex flex-col gap-2">
          <p className="text-sm text-purple-800 font-medium leading-relaxed">
            Este mes tuviste <strong className="text-purple-900">{reglaStats.diasDolor}</strong> días de dolor.{' '}
            <strong className="text-pink-600">{reglaStats.diasDolorEnRegla}</strong> de esos días coincidieron con tu ciclo menstrual.
          </p>
          <div className="bg-white/70 p-3 rounded-lg border border-purple-100 text-xs text-purple-700">
            <strong>Análisis del Ciclo:</strong> Tu promedio entre reglas es de <strong>{avgCycleLength} días</strong>.
            He marcado con gris la predicción de tu próximo ciclo para que estés prevenida.
          </div>
        </div>
      </section>

      {/* Últimos Registros */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" /> Últimos Registros
        </h2>
        <div className="flex flex-col gap-3">
          {logs.length === 0
            ? <p className="text-gray-500 text-sm text-center py-4">No hay registros aún.</p>
            : logs.map((log) => (
              <div key={log.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className={`p-2 rounded-full ${log.tipo_tratamiento.includes('Imigran') || log.tipo_tratamiento.includes('Inyección') ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                  {log.tipo_tratamiento.includes('Imigran') || log.tipo_tratamiento.includes('Inyección')
                    ? <Syringe className="w-4 h-4" />
                    : <Pill className="w-4 h-4" />}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{log.tipo_tratamiento}</p>
                  <p className="text-xs text-gray-500">{formatDate(log.fecha)}</p>
                </div>
              </div>
            ))}
        </div>
      </section>
    </div>
  );
}
