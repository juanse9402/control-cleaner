import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Calendar, User, Clock, DollarSign, Filter, MessageCircle, 
  FileText, CheckCircle2, XCircle, Loader2, ArrowLeft, CalendarRange 
} from 'lucide-react';

const getCurrentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getPastMonth = (monthsAgo) => {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthName = (monthStr) => {
  if (!monthStr || !monthStr.includes('-')) return monthStr || '';
  const [year, month] = monthStr.split('-');
  const date = new Date(Number(year), Number(month) - 1, 15);
  const name = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return name.charAt(0).toUpperCase() + name.slice(1);
};

const getMonthsInRange = (start, end) => {
  if (!start || !end) return [];
  let [sY, sM] = start.split('-').map(Number);
  let [eY, eM] = end.split('-').map(Number);
  if (sY > eY || (sY === eY && sM > eM)) {
    [sY, eY] = [eY, sY];
    [sM, eM] = [eM, sM];
  }
  const months = [];
  let curY = sY;
  let curM = sM;
  while (curY < eY || (curY === eY && curM <= eM)) {
    months.push(`${curY}-${String(curM).padStart(2, '0')}`);
    curM++;
    if (curM > 12) {
      curM = 1;
      curY++;
    }
  }
  return months;
};

export default function MonthlyReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [rawServices, setRawServices] = useState([]);
  const [allClients, setAllClients] = useState([]);
  const [payments, setPayments] = useState({}); // { [cliente_id]: { [mes_año]: boolean } }
  const [paymentLoading, setPaymentLoading] = useState(null); // `${cliente_id}_${mes}`
  const [fetchError, setFetchError] = useState(null);

  // Filter modes: 'single' | 'range' | 'all'
  const [filterMode, setFilterMode] = useState('single');
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth);
  const [startMonth, setStartMonth] = useState(() => getPastMonth(2));
  const [endMonth, setEndMonth] = useState(getCurrentMonth);
  const [selectedClient, setSelectedClient] = useState('all');

  // ─── Fetch all registered clients once ──────────────────────────────
  useEffect(() => {
    const fetchClientsList = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('id, nombre, tarifa_hora')
          .order('nombre');
        if (data && !error) {
          setAllClients(data);
        }
      } catch (err) {
        console.error('Error fetching clients:', err);
      }
    };
    fetchClientsList();
  }, []);

  // ─── Fetch services + payments ───────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);

      try {
        let servicesQuery = supabase
          .from('servicios')
          .select(`id, fecha, horas, total_pago, cliente_id, clientes (nombre, tarifa_hora)`)
          .order('fecha', { ascending: true });

        let monthsList = [];

        if (filterMode === 'single') {
          if (selectedMonth) {
            const [year, month] = selectedMonth.split('-');
            const firstDay = `${selectedMonth}-01`;
            const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
            const lastDay = `${selectedMonth}-${String(daysInMonth).padStart(2, '0')}`;
            servicesQuery = servicesQuery.gte('fecha', firstDay).lte('fecha', lastDay);
            monthsList = [selectedMonth];
          }
        } else if (filterMode === 'range') {
          let s = startMonth;
          let e = endMonth;
          if (s && e) {
            if (s > e) [s, e] = [e, s];
            const firstDay = `${s}-01`;
            const [eYear, eMonth] = e.split('-');
            const daysInMonth = new Date(Number(eYear), Number(eMonth), 0).getDate();
            const lastDay = `${e}-${String(daysInMonth).padStart(2, '0')}`;
            servicesQuery = servicesQuery.gte('fecha', firstDay).lte('fecha', lastDay);
            monthsList = getMonthsInRange(s, e);
          }
        }

        let paymentsQuery = supabase.from('pagos_mensuales').select('*');
        if (filterMode !== 'all' && monthsList.length > 0) {
          paymentsQuery = paymentsQuery.in('mes_año', monthsList);
        }

        const [servicesRes, paymentsRes] = await Promise.all([
          servicesQuery,
          paymentsQuery,
        ]);

        if (servicesRes.error) {
          setFetchError(servicesRes.error.message);
        } else if (servicesRes.data) {
          setFetchError(null);
          const processed = servicesRes.data.map(curr => {
            let pago = Number(curr.total_pago);
            if (!curr.total_pago || isNaN(pago)) {
              const tarifa = Number(curr.clientes?.tarifa_hora) || 0;
              pago = (Number(curr.horas) || 0) * tarifa;
            }
            return { ...curr, total_pago: pago };
          });
          setRawServices(processed);
        }

        if (!paymentsRes.error && paymentsRes.data) {
          const map = {};
          paymentsRes.data.forEach(p => {
            if (!map[p.cliente_id]) map[p.cliente_id] = {};
            map[p.cliente_id][p.mes_año] = p.pagado;
          });
          setPayments(map);
        }
      } catch (err) {
        setFetchError(err.message);
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [filterMode, selectedMonth, startMonth, endMonth]);

  // ─── Toggle payment status ────────────────────────────────────────────
  const togglePayment = async (clienteId, clienteNombre, targetMonth) => {
    const month = targetMonth || selectedMonth;
    const isPaid = !!payments[clienteId]?.[month];

    if (isPaid) {
      const confirmed = window.confirm(`¿Quieres marcar el pago de ${clienteNombre} (${formatMonthName(month)}) como Pendiente?`);
      if (!confirmed) return;
    }

    const toggleKey = `${clienteId}_${month}`;
    setPaymentLoading(toggleKey);
    try {
      const { data: existing } = await supabase
        .from('pagos_mensuales')
        .select('id')
        .eq('cliente_id', clienteId)
        .eq('mes_año', month)
        .maybeSingle();

      let dbError = null;
      if (existing) {
        const { error } = await supabase
          .from('pagos_mensuales')
          .update({ pagado: !isPaid })
          .eq('id', existing.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('pagos_mensuales')
          .insert({ cliente_id: clienteId, mes_año: month, pagado: !isPaid });
        dbError = error;
      }

      if (dbError) {
        console.error('Supabase save error:', dbError);
        throw dbError;
      }

      setPayments(prev => ({
        ...prev,
        [clienteId]: {
          ...(prev[clienteId] || {}),
          [month]: !isPaid
        }
      }));
    } catch (err) {
      console.error('Error toggling payment:', err);
      alert('Error al actualizar el estado de pago. ' + err.message);
    } finally {
      setPaymentLoading(null);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────
  const clientsList = useMemo(() => {
    const map = new Map();
    allClients.forEach(c => map.set(c.id, c.nombre));
    rawServices.forEach(s => {
      if (!map.has(s.cliente_id)) {
        map.set(s.cliente_id, s.clientes?.nombre || 'Desconocido');
      }
    });
    return Array.from(map.entries())
      .map(([id, nombre]) => ({ id, nombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [allClients, rawServices]);

  const selectedClientObj = useMemo(() => {
    if (selectedClient === 'all') return null;
    return clientsList.find(c => c.id === selectedClient) || null;
  }, [selectedClient, clientsList]);

  const groupedData = useMemo(() => {
    if (selectedClient !== 'all') return [];
    const grouped = rawServices.reduce((acc, curr) => {
      const id = curr.cliente_id;
      if (!acc[id]) {
        acc[id] = {
          id,
          nombre: curr.clientes?.nombre || 'Desconocido',
          total_horas: 0,
          total_monto: 0,
          months: new Set(),
        };
      }
      acc[id].total_horas += Number(curr.horas) || 0;
      acc[id].total_monto += curr.total_pago;
      if (curr.fecha) {
        acc[id].months.add(curr.fecha.substring(0, 7));
      }
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total_monto - a.total_monto);
  }, [rawServices, selectedClient]);

  const clientServices = useMemo(() => {
    if (selectedClient === 'all') return [];
    return rawServices.filter(s => s.cliente_id === selectedClient);
  }, [rawServices, selectedClient]);

  // Group services by month for the selected client
  const clientServicesByMonth = useMemo(() => {
    if (selectedClient === 'all') return [];
    const groups = {};
    clientServices.forEach(s => {
      const monthKey = s.fecha ? s.fecha.substring(0, 7) : 'Sin fecha';
      if (!groups[monthKey]) {
        groups[monthKey] = {
          monthKey,
          services: [],
          total_horas: 0,
          total_monto: 0
        };
      }
      groups[monthKey].services.push(s);
      groups[monthKey].total_horas += Number(s.horas) || 0;
      groups[monthKey].total_monto += s.total_pago;
    });
    // Sort months descending (most recent first)
    return Object.values(groups).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [clientServices]);

  // ─── Period Label & WhatsApp ──────────────────────────────────────────
  const getPeriodLabel = () => {
    if (filterMode === 'single') {
      return formatMonthName(selectedMonth);
    }
    if (filterMode === 'range') {
      return `${formatMonthName(startMonth)} a ${formatMonthName(endMonth)}`;
    }
    return 'Histórico Completo';
  };

  const handleWhatsApp = () => {
    if (clientServices.length === 0) return;
    const clientName = selectedClientObj?.nombre || clientServices[0]?.clientes?.nombre || 'Cliente';
    const periodLabel = getPeriodLabel();
    let msg = `Hola *${clientName}*, este es el resumen de servicios de limpieza (${periodLabel}):\n\n`;

    if (clientServicesByMonth.length > 1) {
      clientServicesByMonth.forEach(group => {
        msg += `🗓️ *${formatMonthName(group.monthKey)}* (${group.total_horas.toFixed(1)}h - $${group.total_monto.toLocaleString('en-US', { minimumFractionDigits: 2 })}):\n`;
        group.services.forEach(s => {
          const d = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
          msg += `  • ${d}: ${s.horas}h -> $${s.total_pago.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
        });
        msg += '\n';
      });
    } else {
      clientServices.forEach(s => {
        const d = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        msg += `🗓️ ${d}: ${s.horas}h -> $${s.total_pago.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
      });
    }

    const totalH = clientServices.reduce((acc, curr) => acc + Number(curr.horas), 0);
    const totalM = clientServices.reduce((acc, curr) => acc + curr.total_pago, 0);
    msg += `*⏱️ Total de horas:* ${totalH.toFixed(1)}h\n`;
    msg += `*💰 Total a pagar:* $${totalM.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-600" /> Reporte de Cobros
      </h2>

      {fetchError && (
        <div className="mb-4 bg-red-50 text-red-800 px-4 py-3 rounded-xl text-sm border border-red-200">
          <strong className="block mb-1 font-semibold">Error de conexión con Supabase:</strong>
          <span className="font-mono text-xs block mb-1">{fetchError}</span>
          <p className="mt-2 text-xs opacity-90 leading-relaxed">
            {fetchError.includes('Failed to fetch') ? (
              <>
                ⚠️ <strong>El proyecto de Supabase está pausado o inaccesible.</strong>
                <br />
                Ve a <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="underline font-semibold">supabase.com/dashboard</a> y haz clic en <strong>"Restore project"</strong>.
              </>
            ) : (
              '* Revisa la configuración de Supabase y políticas RLS.'
            )}
          </p>
        </div>
      )}

      {/* Filters Card */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-gray-800 font-semibold text-sm">
            <Filter className="w-4 h-4 text-brand-600" />
            <span>Filtros</span>
          </div>
          <span className="text-[11px] font-medium px-2.5 py-0.5 rounded-full bg-brand-50 text-brand-700 border border-brand-100">
            {getPeriodLabel()}
          </span>
        </div>

        {/* Filter Mode Selector Pills */}
        <div className="grid grid-cols-3 gap-1.5 p-1 bg-gray-100 rounded-xl text-xs font-medium">
          <button
            type="button"
            onClick={() => setFilterMode('single')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              filterMode === 'single'
                ? 'bg-white text-brand-700 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Mes único
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('range')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              filterMode === 'range'
                ? 'bg-white text-brand-700 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Rango de meses
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`py-1.5 rounded-lg transition-all text-center ${
              filterMode === 'all'
                ? 'bg-white text-brand-700 shadow-xs font-semibold'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todo el historial
          </button>
        </div>

        {/* Quick Presets for Range Mode */}
        {filterMode === 'range' && (
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setStartMonth(getPastMonth(2));
                setEndMonth(getCurrentMonth());
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
            >
              Últimos 3 meses
            </button>
            <button
              type="button"
              onClick={() => {
                setStartMonth(getPastMonth(5));
                setEndMonth(getCurrentMonth());
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
            >
              Últimos 6 meses
            </button>
            <button
              type="button"
              onClick={() => {
                const curY = new Date().getFullYear();
                setStartMonth(`${curY}-01`);
                setEndMonth(getCurrentMonth());
              }}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 border border-gray-200 transition-colors"
            >
              Este año ({new Date().getFullYear()})
            </button>
          </div>
        )}

        {/* Date Inputs & Client Dropdown */}
        {filterMode === 'single' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Mes y Año</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
              >
                <option value="all">Todos (Resumen)</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        ) : filterMode === 'range' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mes Desde</label>
                <input
                  type="month"
                  value={startMonth}
                  onChange={(e) => setStartMonth(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Mes Hasta</label>
                <input
                  type="month"
                  value={endMonth}
                  onChange={(e) => setEndMonth(e.target.value)}
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
              >
                <option value="all">Todos (Resumen)</option>
                {clientsList.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Cliente</label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
            >
              <option value="all">Todos (Resumen)</option>
              {clientsList.map(c => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : rawServices.length === 0 ? (
        <div className="text-center py-10 px-4 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
          <p className="font-medium text-gray-700">No hay datos registrados para este período.</p>
          <p className="text-xs text-gray-400 mt-1">Prueba seleccionando otro rango de meses o "Todo el historial".</p>
        </div>
      ) : selectedClient === 'all' ? (

        /* ── Todos View — Table with payment summary ── */
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
                <tr>
                  <th className="font-medium p-4">
                    <span className="flex items-center gap-1"><User className="w-4 h-4" /> Cliente</span>
                  </th>
                  <th className="font-medium p-4">
                    <Clock className="w-4 h-4 inline mr-1" /> Horas
                  </th>
                  <th className="font-medium p-4 text-right">
                    <DollarSign className="w-4 h-4 inline mr-1" /> Total
                  </th>
                  <th className="font-medium p-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {groupedData.map((item) => {
                  const isPaidSingle = !!payments[item.id]?.[selectedMonth];
                  const isToggling = paymentLoading === `${item.id}_${selectedMonth}`;
                  
                  // For multi-month range
                  const monthsArr = Array.from(item.months || []);
                  const totalMonthsCount = monthsArr.length;
                  const paidMonthsCount = monthsArr.filter(m => payments[item.id]?.[m]).length;

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setSelectedClient(item.id)}
                      className={`group transition-colors cursor-pointer ${
                        filterMode === 'single' && isPaidSingle 
                          ? 'bg-green-50/70 hover:bg-green-100/60' 
                          : 'hover:bg-blue-50/40'
                      }`}
                      title="Haz clic para ver el detalle de servicios de este cliente"
                    >
                      <td className="p-4 font-medium text-gray-900">
                        <div className="flex items-center justify-between gap-2">
                          <span>{item.nombre}</span>
                          <span className="text-[11px] text-brand-600 font-normal opacity-0 group-hover:opacity-100 transition-opacity">
                            Ver detalle →
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600">{Number(item.total_horas).toFixed(1)}h</td>
                      <td className="p-4 text-right font-semibold text-brand-600">
                        ${Number(item.total_monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        {filterMode === 'single' ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePayment(item.id, item.nombre, selectedMonth);
                            }}
                            disabled={isToggling}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                              isToggling 
                                ? 'bg-gray-100 text-gray-600'
                                : isPaidSingle
                                  ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                  : 'bg-red-100 text-red-600 hover:bg-red-200'
                            } ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
                          >
                            {isToggling ? (
                              <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Guardando...</>
                            ) : isPaidSingle ? (
                              <><CheckCircle2 className="w-3.5 h-3.5" /> Pagado</>
                            ) : (
                              <><XCircle className="w-3.5 h-3.5" /> Pendiente</>
                            )}
                          </button>
                        ) : (
                          <div className="inline-flex items-center">
                            {paidMonthsCount === totalMonthsCount && totalMonthsCount > 0 ? (
                              <span className="inline-flex items-center gap-1 text-green-700 bg-green-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Al día ({paidMonthsCount}/{totalMonthsCount})
                              </span>
                            ) : paidMonthsCount === 0 ? (
                              <span className="inline-flex items-center gap-1 text-red-600 bg-red-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <XCircle className="w-3.5 h-3.5" /> Pendiente (0/{totalMonthsCount})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full text-xs font-semibold">
                                <Clock className="w-3.5 h-3.5" /> Parcial ({paidMonthsCount}/{totalMonthsCount})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-900 text-white">
                <tr>
                  <td className="p-4 font-semibold rounded-bl-2xl">Total General</td>
                  <td className="p-4 font-medium">
                    {Number(groupedData.reduce((acc, curr) => acc + curr.total_horas, 0)).toFixed(1)}h
                  </td>
                  <td className="p-4 text-right font-bold text-lg">
                    ${Number(groupedData.reduce((acc, curr) => acc + curr.total_monto, 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-4 text-center text-xs text-gray-400 rounded-br-2xl">
                    {filterMode === 'single'
                      ? `${groupedData.filter(i => payments[i.id]?.[selectedMonth]).length}/${groupedData.length} pagados`
                      : `${groupedData.length} clientes`}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      ) : (
        /* ── Specific Client View ── */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setSelectedClient('all')}
              className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-800 transition-colors p-1"
            >
              <ArrowLeft className="w-4 h-4" /> Volver a Todos (Resumen)
            </button>
            <span className="text-xs text-gray-500 font-medium">
              {clientServices.length} {clientServices.length === 1 ? 'servicio' : 'servicios'}
            </span>
          </div>

          <div className="flex items-center justify-between px-1">
            <h3 className="font-semibold text-gray-900 text-base">
              {selectedClientObj?.nombre || clientServices[0]?.clientes?.nombre || 'Cliente'}
            </h3>
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {getPeriodLabel()}
            </span>
          </div>

          {clientServices.length === 0 ? (
            <div className="text-center py-10 px-4 bg-white rounded-2xl shadow-sm border border-gray-100">
              <p className="text-gray-700 font-medium">No hay servicios registrados para este cliente en el período seleccionado.</p>
              <p className="text-xs text-gray-400 mt-1">Prueba ampliando el rango o seleccionando "Todo el historial".</p>
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                className="mt-3 px-3 py-1.5 text-xs font-semibold text-brand-600 bg-brand-50 hover:bg-brand-100 rounded-xl transition-all"
              >
                Ver todo el historial de este cliente
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {clientServicesByMonth.map(group => {
                const isPaid = !!payments[selectedClient]?.[group.monthKey];
                const isToggling = paymentLoading === `${selectedClient}_${group.monthKey}`;

                return (
                  <div key={group.monthKey} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 space-y-3">
                    {/* Month Group Header */}
                    <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                      <div>
                        <span className="font-semibold text-gray-900 text-sm">
                          {formatMonthName(group.monthKey)}
                        </span>
                        <span className="text-xs text-gray-500 ml-2 font-medium">
                          ({group.total_horas.toFixed(1)}h • ${group.total_monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })})
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePayment(selectedClient, selectedClientObj?.nombre || 'Cliente', group.monthKey)}
                        disabled={isToggling}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                          isToggling 
                            ? 'bg-gray-100 text-gray-500' 
                            : isPaid 
                              ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                        } ${isToggling ? 'opacity-70 cursor-not-allowed' : ''}`}
                      >
                        {isToggling ? (
                          <><Loader2 className="w-3 h-3 animate-spin" /> Guardando...</>
                        ) : isPaid ? (
                          <><CheckCircle2 className="w-3.5 h-3.5" /> Pagado</>
                        ) : (
                          <><XCircle className="w-3.5 h-3.5" /> Pendiente</>
                        )}
                      </button>
                    </div>

                    {/* Services inside this month */}
                    <div className="space-y-2">
                      {group.services.map(service => (
                        <div 
                          key={service.id} 
                          className="bg-gray-50/70 p-3 rounded-xl border border-gray-100 flex justify-between items-center hover:bg-gray-50 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className="bg-brand-50 p-2 rounded-lg text-brand-600">
                              <Calendar className="w-4 h-4" />
                            </div>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">
                                {new Date(service.fecha + 'T12:00:00').toLocaleDateString('es-ES', { 
                                  weekday: 'short', 
                                  day: 'numeric', 
                                  month: 'short' 
                                }).replace(/^\w/, c => c.toUpperCase())}
                              </p>
                              <p className="text-xs text-gray-500 mt-0.5">{service.horas} horas trabajadas</p>
                            </div>
                          </div>
                          <p className="font-bold text-gray-900 text-sm">
                            ${Number(service.total_pago).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Client Summary Box */}
              <div className="bg-gradient-to-br from-gray-900 to-black text-white p-5 rounded-2xl shadow-lg mt-6">
                <h4 className="text-gray-400 text-xs mb-4 font-semibold uppercase tracking-wider">
                  Resumen Total ({getPeriodLabel()})
                </h4>
                <div className="flex justify-between items-end mb-6">
                  <div>
                    <p className="text-3xl font-bold">
                      ${clientServices.reduce((acc, curr) => acc + curr.total_pago, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="text-gray-400 text-sm mt-1">Total del Período</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-medium">
                      {clientServices.reduce((acc, curr) => acc + Number(curr.horas), 0).toFixed(1)}h
                    </p>
                    <p className="text-gray-400 text-sm mt-1">
                      {clientServices.length} {clientServices.length === 1 ? 'servicio' : 'servicios'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleWhatsApp}
                  className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl p-3.5 font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md cursor-pointer"
                >
                  <MessageCircle className="w-5 h-5" /> Enviar Resumen por WhatsApp
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
