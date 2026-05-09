import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, User, Clock, DollarSign } from 'lucide-react';

export default function MonthlyReport() {
  const [reportData, setReportData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMonthlyData = async () => {
      setIsLoading(true);
      
      const date = new Date();
      const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).toISOString().split('T')[0];
      const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('servicios')
        .select(`
          horas,
          total_pago,
          cliente_id,
          clientes (
            nombre,
            tarifa_hora
          )
        `)
        .gte('fecha', firstDay)
        .lte('fecha', lastDay);
      
      if (!error && data) {
        const grouped = data.reduce((acc, curr) => {
          const clientId = curr.cliente_id;
          if (!acc[clientId]) {
            acc[clientId] = {
              nombre: curr.clientes?.nombre || 'Desconocido',
              total_horas: 0,
              total_monto: 0
            };
          }
          
          const horas = Number(curr.horas) || 0;
          let pago = Number(curr.total_pago);
          
          if (!curr.total_pago || isNaN(pago)) {
             const tarifa = Number(curr.clientes?.tarifa_hora) || 0;
             pago = horas * tarifa;
          }
          
          acc[clientId].total_horas += horas;
          acc[clientId].total_monto += pago;
          
          return acc;
        }, {});

        const reportArray = Object.values(grouped).sort((a, b) => b.total_monto - a.total_monto);
        setReportData(reportArray);
      } else {
        console.error('Error fetching monthly report:', error);
      }
      setIsLoading(false);
    };

    fetchMonthlyData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (reportData.length === 0) {
    return (
      <div className="text-center py-10 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100 max-w-lg mx-auto">
        No hay datos para este mes aún.
      </div>
    );
  }

  const grandTotalMonto = reportData.reduce((acc, curr) => acc + Number(curr.total_monto), 0);
  const grandTotalHoras = reportData.reduce((acc, curr) => acc + Number(curr.total_horas), 0);

  return (
    <div className="max-w-lg mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-brand-600" />
        Reporte Mensual
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-gray-50 text-gray-500 border-b border-gray-100">
              <tr>
                <th className="font-medium p-4 flex items-center gap-2"><User className="w-4 h-4"/> Cliente</th>
                <th className="font-medium p-4"><Clock className="w-4 h-4 inline mr-1"/> Horas</th>
                <th className="font-medium p-4 text-right"><DollarSign className="w-4 h-4 inline mr-1"/> Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {reportData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 font-medium text-gray-900">
                    {item.nombre}
                  </td>
                  <td className="p-4 text-gray-600">
                    {Number(item.total_horas).toFixed(1)}h
                  </td>
                  <td className="p-4 text-right font-semibold text-brand-600">
                    ${Number(item.total_monto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-900 text-white">
              <tr>
                <td className="p-4 font-semibold rounded-bl-2xl">Total General</td>
                <td className="p-4 font-medium">{Number(grandTotalHoras).toFixed(1)}h</td>
                <td className="p-4 text-right font-bold text-lg rounded-br-2xl">${Number(grandTotalMonto).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}
