import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Calendar, User, Clock, DollarSign } from 'lucide-react';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('weekly'); // 'weekly' or 'monthly'
  const [weeklyData, setWeeklyData] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setIsLoading(true);
    if (activeTab === 'weekly') {
      const { data, error } = await supabase
        .from('reporte_semanal_clientes')
        .select('*');
      if (!error && data) setWeeklyData(data);
    } else {
      const { data, error } = await supabase
        .from('reporte_mensual_clientes')
        .select('*');
      if (!error && data) setMonthlyData(data);
    }
    setIsLoading(false);
  };

  const renderData = () => {
    const dataList = activeTab === 'weekly' ? weeklyData : monthlyData;

    if (isLoading) {
      return (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        </div>
      );
    }

    if (dataList.length === 0) {
      return (
        <div className="text-center py-10 text-gray-500 bg-white rounded-xl shadow-sm border border-gray-100 mt-4">
          No hay datos para este período.
        </div>
      );
    }

    return (
      <div className="space-y-3 mt-4">
        {dataList.map((item, index) => (
          <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 transition-all hover:shadow-md">
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-brand-50 p-2 rounded-lg">
                <User className="w-4 h-4 text-brand-600" />
              </div>
              <h3 className="font-semibold text-gray-900">{item.cliente_nombre || item.nombre_cliente}</h3>
            </div>
            
            <div className="flex divide-x divide-gray-100">
              <div className="flex-1 pr-4">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Total Horas
                </p>
                <p className="font-medium text-gray-900">{Number(item.total_horas).toFixed(1)}h</p>
              </div>
              <div className="flex-1 pl-4">
                <p className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                  <DollarSign className="w-3 h-3" />
                  Monto a Cobrar
                </p>
                <p className="font-medium text-brand-600">${Number(item.total_monto).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
        
        {/* Total General */}
        <div className="bg-gray-900 text-white p-4 rounded-xl shadow-md mt-6 flex justify-between items-center">
          <div>
            <p className="text-gray-400 text-xs mb-1">Total {activeTab === 'weekly' ? 'Semanal' : 'Mensual'}</p>
            <p className="font-bold text-xl">
              ${dataList.reduce((acc, curr) => acc + Number(curr.total_monto), 0).toFixed(2)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-gray-400 text-xs mb-1">Total Horas</p>
            <p className="font-medium">
              {dataList.reduce((acc, curr) => acc + Number(curr.total_horas), 0).toFixed(1)}h
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Calendar className="w-5 h-5 text-brand-600" />
        Reportes
      </h2>

      {/* Tabs */}
      <div className="flex p-1 bg-gray-200/50 rounded-xl">
        <button
          onClick={() => setActiveTab('weekly')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'weekly' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Esta Semana
        </button>
        <button
          onClick={() => setActiveTab('monthly')}
          className={`flex-1 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
            activeTab === 'monthly' 
              ? 'bg-white text-gray-900 shadow-sm' 
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Este Mes
        </button>
      </div>

      {renderData()}
    </div>
  );
}
