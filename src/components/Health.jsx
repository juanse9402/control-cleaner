import { useState, useEffect } from 'react';
import { Pill, Syringe, TrendingDown, TrendingUp, AlertCircle, Clock, FileText } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { supabase } from '../lib/supabase';

const Health = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [trends, setTrends] = useState({ currentMonth: {}, lastMonth: {} });
  const [chartData, setChartData] = useState([]);

  const fetchData = async () => {
    try {
      // Fetch latest 5 logs
      const { data: recentLogs, error: logsError } = await supabase
        .from('migraña_registros')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(5);
      
      if (logsError) throw logsError;
      setLogs(recentLogs || []);

      // Fetch trends using the view
      const { data: trendData, error: trendError } = await supabase
        .from('vista_tendencia_migraña')
        .select('*');

      if (trendError) throw trendError;

      // Process trends
      const now = new Date();
      const currentMonthStr = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthStr = lastMonthDate.toISOString();

      const current = { 'Naproxeno': 0, 'Imigran': 0 };
      const previous = { 'Naproxeno': 0, 'Imigran': 0 };

      // Initialize chart data for the last 6 months
      const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const chartMap = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        chartMap[key] = {
          name: monthNames[d.getMonth()],
          Naproxeno: 0,
          Imigran: 0,
          timestamp: d.getTime()
        };
      }

      trendData?.forEach(row => {
        // Simple string matching for month comparison
        const rowDate = new Date(row.mes);
        const isCurrentMonth = rowDate.getFullYear() === now.getFullYear() && rowDate.getMonth() === now.getMonth();
        const isLastMonth = rowDate.getFullYear() === lastMonthDate.getFullYear() && rowDate.getMonth() === lastMonthDate.getMonth();

        let type = 'Naproxeno';
        if (row.tipo_tratamiento.includes('Imigran') || row.tipo_tratamiento.includes('Inyección')) {
          type = 'Imigran';
        }

        if (isCurrentMonth) current[type] += Number(row.cantidad);
        if (isLastMonth) previous[type] += Number(row.cantidad);

        // Chart mapping
        const key = `${rowDate.getFullYear()}-${rowDate.getMonth()}`;
        if (chartMap[key]) {
          chartMap[key][type] += Number(row.cantidad);
        }
      });

      setTrends({ currentMonth: current, lastMonth: previous });
      
      const processedChartData = Object.values(chartMap).sort((a, b) => a.timestamp - b.timestamp);
      setChartData(processedChartData);

    } catch (error) {
      console.error('Error fetching health data:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLog = async (tipoTratamiento) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('migraña_registros')
        .insert([{ 
          fecha: new Date().toISOString(), 
          tipo_tratamiento: tipoTratamiento 
        }]);

      if (error) throw error;
      await fetchData();
    } catch (error) {
      console.error('Error logging treatment:', error);
      alert('Hubo un error al guardar el registro.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (isoString) => {
    const date = new Date(isoString);
    return date.toLocaleString('es-ES', { 
      day: '2-digit', month: 'short', 
      hour: '2-digit', minute: '2-digit' 
    });
  };

  const getTrendComparison = (current, last) => {
    if (current > last) {
      return <span className="flex items-center text-xs text-red-500 font-medium"><TrendingUp className="w-3 h-3 mr-1" /> Sube (+{current - last})</span>;
    }
    if (current < last) {
      return <span className="flex items-center text-xs text-green-600 font-medium"><TrendingDown className="w-3 h-3 mr-1" /> Baja ({current - last})</span>;
    }
    return <span className="text-xs text-gray-400 font-medium">Igual</span>;
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in pb-8">
      
      {/* Encabezado Informativo */}
      <div className="bg-purple-100/60 rounded-xl p-4 border border-purple-200 flex items-center gap-4 shadow-sm">
        <div className="bg-purple-200/80 p-2.5 rounded-full">
          <Pill className="w-6 h-6 text-purple-700" />
        </div>
        <div>
          <h3 className="text-xs font-semibold text-purple-900 uppercase tracking-wider mb-1">Tratamiento diario</h3>
          <p className="text-base text-purple-800 font-bold">Tryptizol (1 pastilla)</p>
        </div>
      </div>

      {/* Quick Action Buttons */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-purple-600" />
          Registro Rápido
        </h2>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => handleLog('Naproxeno (Dolor Leve)')}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
          >
            <Pill className="w-6 h-6" />
            + Naproxeno (Dolor Leve)
          </button>

          <button
            onClick={() => handleLog('Imigran (Inyección - Dolor Fuerte)')}
            disabled={loading}
            className="flex items-center justify-center gap-3 w-full py-4 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-medium transition-colors shadow-sm active:scale-95"
          >
            <Syringe className="w-6 h-6" />
            + Imigran (Inyección - Dolor Fuerte)
          </button>
        </div>
      </section>

      {/* Trends Section */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <TrendingDown className="w-5 h-5 text-purple-600" />
          Resumen de Mes Actual
        </h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-orange-50 rounded-xl p-4 border border-orange-100">
            <h3 className="text-xs text-orange-600 font-semibold mb-2 uppercase tracking-wider">Naproxeno</h3>
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-3xl font-bold text-orange-800">{trends.currentMonth['Naproxeno']}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                {getTrendComparison(trends.currentMonth['Naproxeno'], trends.lastMonth['Naproxeno'])}
              </div>
            </div>
            <p className="text-[10px] text-orange-500 font-medium">Mes anterior: {trends.lastMonth['Naproxeno']}</p>
          </div>

          <div className="bg-rose-50 rounded-xl p-4 border border-rose-100">
            <h3 className="text-xs text-rose-600 font-semibold mb-2 uppercase tracking-wider">Imigran</h3>
            <div className="flex items-end justify-between mb-1">
              <div>
                <p className="text-3xl font-bold text-rose-900">{trends.currentMonth['Imigran']}</p>
              </div>
              <div className="text-right flex flex-col items-end">
                {getTrendComparison(trends.currentMonth['Imigran'], trends.lastMonth['Imigran'])}
              </div>
            </div>
            <p className="text-[10px] text-rose-500 font-medium">Mes anterior: {trends.lastMonth['Imigran']}</p>
          </div>
        </div>
      </section>

      {/* Informe Médico (Gráfica) */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-purple-600" />
          Informe Médico
        </h2>
        
        <div className="h-64 w-full mb-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#6b7280' }} />
              <Tooltip cursor={{fill: '#f3f4f6'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                content={() => (
                  <div className="flex justify-center gap-4 text-xs font-medium mt-4">
                    <span className="flex items-center gap-1 text-orange-700">🟠 Naproxeno (Leve)</span>
                    <span className="flex items-center gap-1 text-rose-700">🔴 Imigran (Fuerte)</span>
                  </div>
                )} 
              />
              <ReferenceLine y={30} stroke="#9333ea" strokeDasharray="3 3" label={{ position: 'top', value: 'Tryptizol diario', fill: '#9333ea', fontSize: 10 }} />
              <Bar dataKey="Naproxeno" fill="#f97316" radius={[4, 4, 0, 0]} maxBarSize={40} />
              <Bar dataKey="Imigran" fill="#e11d48" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100 mt-2">
          <p className="text-sm text-purple-800 font-medium leading-relaxed">
            Este mes: <strong className="text-orange-700">{trends.currentMonth['Naproxeno']} Naproxenos</strong> y <strong className="text-rose-700">{trends.currentMonth['Imigran']} Imigran</strong>. <br/>
            Evolución vs mes anterior: <strong>{
              (trends.currentMonth['Naproxeno'] + trends.currentMonth['Imigran']) > 
              (trends.lastMonth['Naproxeno'] + trends.lastMonth['Imigran']) ? 'Subió ⬆️' : 
              (trends.currentMonth['Naproxeno'] + trends.currentMonth['Imigran']) < 
              (trends.lastMonth['Naproxeno'] + trends.lastMonth['Imigran']) ? 'Bajó ⬇️' : 'Se mantuvo igual'
            }</strong>
          </p>
        </div>
      </section>

      {/* History Section */}
      <section className="bg-white rounded-2xl p-5 shadow-sm border border-purple-100">
        <h2 className="text-lg font-semibold text-purple-900 mb-4 flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          Últimos Registros
        </h2>
        
        <div className="flex flex-col gap-3">
          {logs.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No hay registros aún.</p>
          ) : (
            logs.map(log => (
              <div key={log.id} className="flex justify-between items-center p-3 rounded-lg border border-gray-100 bg-gray-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full ${log.tipo_tratamiento.includes('Imigran') || log.tipo_tratamiento.includes('Inyección') ? 'bg-rose-100 text-rose-600' : 'bg-orange-100 text-orange-600'}`}>
                    {log.tipo_tratamiento.includes('Imigran') || log.tipo_tratamiento.includes('Inyección') ? <Syringe className="w-4 h-4" /> : <Pill className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.tipo_tratamiento}</p>
                    <p className="text-xs text-gray-500">{formatDate(log.fecha)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
      
    </div>
  );
};

export default Health;
