import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { History as HistoryIcon, Edit2, Trash2, CalendarDays, Clock, Save } from 'lucide-react';

export default function History() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Edit Modal State
  const [editingService, setEditingService] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editHours, setEditHours] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('servicios')
      .select(`
        id,
        fecha,
        horas,
        notas,
        total_pago,
        cliente_id,
        clientes (
          nombre,
          tarifa_hora
        )
      `)
      .order('fecha', { ascending: false })
      .order('id', { ascending: false });
    
    if (data) setHistory(data);
    if (error) console.error('Error fetching history:', error);
    setIsLoading(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.')) {
      const { error } = await supabase
        .from('servicios')
        .delete()
        .eq('id', id);
      
      if (error) {
        alert('Error al borrar: ' + error.message);
      } else {
        fetchHistory();
      }
    }
  };

  const openEditModal = (service) => {
    setEditingService(service);
    setEditDate(service.fecha);
    setEditHours(service.horas);
  };

  const closeEditModal = () => {
    setEditingService(null);
    setEditDate('');
    setEditHours('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editDate || !editHours) return;

    setIsSaving(true);
    
    const tarifa = editingService.clientes?.tarifa_hora || 0;
    const nuevoTotal = Number(editHours) * tarifa;

    const { error } = await supabase
      .from('servicios')
      .update({
        fecha: editDate,
        horas: Number(editHours),
        total_pago: nuevoTotal
      })
      .eq('id', editingService.id);

    setIsSaving(false);

    if (error) {
      console.error('Error actualizando servicio:', error);
      alert('Error al actualizar: ' + error.message);
    } else {
      closeEditModal();
      fetchHistory();
    }
  };

  return (
    <div className="max-w-lg mx-auto pb-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <HistoryIcon className="w-5 h-5 text-brand-600" />
        Historial de Servicios
      </h2>

      {isLoading ? (
        <div className="flex justify-center py-10">
          <div className="w-8 h-8 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin"></div>
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-10 text-gray-500 bg-white rounded-2xl shadow-sm border border-gray-100">
          No hay servicios registrados.
        </div>
      ) : (
        <div className="space-y-3">
          {history.map(service => {
            const isPremium = service.clientes?.tarifa_hora === 14;
            
            return (
              <div 
                key={service.id} 
                className={`bg-white p-4 rounded-xl shadow-sm border ${isPremium ? 'border-amber-200' : 'border-gray-100'} transition-all`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className={`font-semibold ${isPremium ? 'text-amber-900' : 'text-gray-900'}`}>
                      {service.clientes?.nombre || 'Cliente eliminado'}
                    </h3>
                    <div className="flex gap-4 mt-1 text-sm text-gray-500">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="w-3 h-3" />
                        {service.fecha}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {service.horas}h
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex gap-1">
                    <button 
                      onClick={() => openEditModal(service)}
                      className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(service.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Borrar"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {editingService && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 sm:p-0">
          <div className="bg-white w-full max-w-md rounded-3xl md:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Editar Registro</h3>
              <button 
                onClick={closeEditModal}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <input 
                  type="text" 
                  disabled
                  value={editingService.clientes?.nombre || 'Desconocido'}
                  className="w-full p-3 bg-gray-100 text-gray-500 border border-gray-200 rounded-xl outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    type="date" 
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Horas</label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  required
                  value={editHours}
                  onChange={(e) => setEditHours(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              <div className="pt-4">
                <button 
                  type="submit" 
                  disabled={isSaving}
                  className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-xl p-4 font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2"
                >
                  <Save className="w-5 h-5" />
                  {isSaving ? 'Guardando...' : 'Actualizar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
