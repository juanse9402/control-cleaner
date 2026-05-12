import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, User, Clock, DollarSign, Filter, MessageCircle, FileText, CheckCircle2, XCircle } from 'lucide-react';

export default function MonthlyReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [rawServices, setRawServices] = useState([]);
  const [payments, setPayments] = useState({}); // { cliente_id: true/false }
  const [paymentLoading, setPaymentLoading] = useState(null); // cliente_id being toggled

  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedClient, setSelectedClient] = useState('all');

  // ─── Fetch services + payments ───────────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);

      const [year, month] = selectedMonth.split('-');
      const firstDay = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const lastDay  = new Date(year, month, 0).toISOString().split('T')[0];

      const [servicesRes, paymentsRes] = await Promise.all([
        supabase
          .from('servicios')
          .select(`id, fecha, horas, total_pago, cliente_id, clientes (nombre, tarifa_hora)`)
          .gte('fecha', firstDay)
          .lte('fecha', lastDay)
          .order('fecha', { ascending: true }),
        supabase
          .from('pagos_mensuales')
          .select('*')
          .eq('mes', selectedMonth),
      ]);

      if (!servicesRes.error && servicesRes.data) {
        const processed = servicesRes.data.map(curr => {
          let pago = Number(curr.total_pago);
          if (!curr.total_pago || isNaN(pago)) {
            const tarifa = Number(curr.clientes?.tarifa_hora) || 0;
            pago = (Number(curr.horas) || 0) * tarifa;
          }
          return { ...curr, total_pago: pago };
        });
        setRawServices(processed);
        if (selectedClient !== 'all' && !processed.some(s => s.cliente_id === selectedClient)) {
          setSelectedClient('all');
        }
      }

      if (!paymentsRes.error && paymentsRes.data) {
        const map = {};
        paymentsRes.data.forEach(p => { map[p.cliente_id] = p.pagado; });
        setPayments(map);
      }

      setIsLoading(false);
    };

    fetchAll();
  }, [selectedMonth]);

  // ─── Toggle payment status ────────────────────────────────────────────
  const togglePayment = async (clienteId, clienteNombre) => {
    const isPaid = !!payments[clienteId];

    if (isPaid) {
      const confirmed = window.confirm(`¿Quieres marcar el pago de ${clienteNombre} como Pendiente?`);
      if (!confirmed) return;
    }

    setPaymentLoading(clienteId);
    try {
      if (isPaid) {
        // Delete payment record
        await supabase
          .from('pagos_mensuales')
          .delete()
          .eq('cliente_id', clienteId)
          .eq('mes', selectedMonth);
        setPayments(prev => { const n = { ...prev }; delete n[clienteId]; return n; });
      } else {
        // Upsert payment record
        await supabase
          .from('pagos_mensuales')
          .upsert([{ cliente_id: clienteId, mes: selectedMonth, pagado: true }], { onConflict: 'cliente_id,mes' });
        setPayments(prev => ({ ...prev, [clienteId]: true }));
      }
    } catch (err) {
      console.error('Error toggling payment:', err);
      alert('Error al actualizar el estado de pago.');
    } finally {
      setPaymentLoading(null);
    }
  };

  // ─── Derived data ─────────────────────────────────────────────────────
  const clientsList = useMemo(() => {
    const unique = [];
    const seen = new Set();
    rawServices.forEach(s => {
      if (!seen.has(s.cliente_id)) {
        seen.add(s.cliente_id);
        unique.push({ id: s.cliente_id, nombre: s.clientes?.nombre || 'Desconocido' });
      }
    });
    return unique.sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [rawServices]);

  const groupedData = useMemo(() => {
    if (selectedClient !== 'all') return [];
    const grouped = rawServices.reduce((acc, curr) => {
      const id = curr.cliente_id;
      if (!acc[id]) {
        acc[id] = { id, nombre: curr.clientes?.nombre || 'Desconocido', total_horas: 0, total_monto: 0 };
      }
      acc[id].total_horas += Number(curr.horas) || 0;
      acc[id].total_monto += curr.total_pago;
      return acc;
    }, {});
    return Object.values(grouped).sort((a, b) => b.total_monto - a.total_monto);
  }, [rawServices, selectedClient]);

  const clientServices = useMemo(() => {
    if (selectedClient === 'all') return [];
    return rawServices.filter(s => s.cliente_id === selectedClient);
  }, [rawServices, selectedClient]);

  // ─── WhatsApp ─────────────────────────────────────────────────────────
  const handleWhatsApp = () => {
    if (clientServices.length === 0) return;
    const clientName = clientServices[0].clientes?.nombre || '';
    let msg = `Hola *${clientName}*, este es el resumen de servicios de limpieza de este mes:\n\n`;
    clientServices.forEach(s => {
      const d = new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
      msg += `🗓️ ${d}: ${s.horas}h -> $${s.total_pago.toLocaleString('en-US', { minimumFractionDigits: 2 })}\n`;
    });
    const totalH = clientServices.reduce((acc, curr) => acc + Number(curr.horas), 0);
    const totalM = clientServices.reduce((acc, curr) => acc + curr.total_pago, 0);
    msg += `\n*⏱️ Total de horas:* ${totalH}h\n`;
    msg += `*💰 Total a pagar:* $${totalM.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
  };

  // ─── Render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-lg mx-auto pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-600" /> Reporte de Cobros
      </h2>

      {/* Filters */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 space-y-4">
        <div className="flex items-center gap-2 text-gray-700 font-medium text-sm mb-2">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Mes y Año</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 outline-none transition-all text-sm"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
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
      </div>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin" />
        </div>
      ) : rawServices.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
          No hay datos para este mes.
        </div>
      ) : selectedClient === 'all' ? (

        /* ── Todos View — Table with payment column ── */
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
                  const isPaid = !!payments[item.id];
                  const isToggling = paymentLoading === item.id;
                  return (
                    <tr
                      key={item.id}
                      className={`transition-colors ${isPaid ? 'bg-green-50/70 hover:bg-green-50' : 'hover:bg-gray-50/50'}`}
                    >
                      <td className="p-4 font-medium text-gray-900">{item.nombre}</td>
                      <td className="p-4 text-gray-600">{Number(item.total_horas).toFixed(1)}h</td>
                      <td className="p-4 text-right font-semibold text-brand-600">
                        ${Number(item.total_monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="p-4 text-center">
                        <button
                          onClick={() => togglePayment(item.id, item.nombre)}
                          disabled={isToggling}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all active:scale-95 ${
                            isPaid
                              ? 'bg-green-100 text-green-700 hover:bg-green-200'
                              : 'bg-red-100 text-red-600 hover:bg-red-200'
                          } ${isToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          {isPaid
                            ? <><CheckCircle2 className="w-3.5 h-3.5" /> Pagado</>
                            : <><XCircle className="w-3.5 h-3.5" /> Pendiente</>
                          }
                        </button>
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
                    {groupedData.filter(i => payments[i.id]).length}/{groupedData.length} pagados
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

      ) : (
        /* ── Specific Client View ── */
        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
          <h3 className="font-medium text-gray-700 px-1">Detalle de Servicios: {clientServices[0]?.clientes?.nombre}</h3>

          <div className="space-y-3">
            {clientServices.map(service => (
              <div key={service.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center hover:shadow-md transition-all">
                <div className="flex items-center gap-3">
                  <div className="bg-brand-50 p-2.5 rounded-lg text-brand-600">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {new Date(service.fecha + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/^\w/, c => c.toUpperCase())}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{service.horas} horas trabajadas</p>
                  </div>
                </div>
                <p className="font-bold text-gray-900">
                  ${service.total_pago.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            ))}
          </div>

          {/* Client Summary Box */}
          <div className="bg-gradient-to-br from-gray-900 to-black text-white p-5 rounded-2xl shadow-lg mt-6">
            <h4 className="text-gray-400 text-sm mb-4 font-medium uppercase tracking-wider">Resumen del Cliente</h4>
            <div className="flex justify-between items-end mb-6">
              <div>
                <p className="text-3xl font-bold">
                  ${clientServices.reduce((acc, curr) => acc + curr.total_pago, 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-gray-400 text-sm mt-1">Total a Cobrar</p>
              </div>
              <div className="text-right">
                <p className="text-xl font-medium">{clientServices.reduce((acc, curr) => acc + Number(curr.horas), 0)}h</p>
                <p className="text-gray-400 text-sm mt-1">Total Horas</p>
              </div>
            </div>
            <button
              onClick={handleWhatsApp}
              className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white rounded-xl p-3.5 font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-md"
            >
              <MessageCircle className="w-5 h-5" /> Enviar Resumen por WhatsApp
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
