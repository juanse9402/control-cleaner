import { useState, useEffect } from 'react';
import { PlusCircle, Clock, CalendarDays, CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function Dashboard() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [clients, setClients] = useState([]);
  const [weeklyTotal, setWeeklyTotal] = useState(0);
  const [weeklyHours, setWeeklyHours] = useState(0);
  
  // Form state
  const [selectedClient, setSelectedClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    fetchClients();
    fetchWeeklySummary();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('id, nombre, tarifa_hora')
      .order('nombre');
    
    if (data) setClients(data);
    if (error) console.error('Error fetching clients:', error);
  };

  const fetchWeeklySummary = async () => {
    // In a real app with proper dates, we would query the 'reporte_semanal_clientes' view
    // Or just query 'servicios' for the current week and aggregate.
    // Assuming 'reporte_semanal_clientes' view exists and returns total_horas and total_monto.
    const { data, error } = await supabase
      .from('reporte_semanal_clientes')
      .select('total_horas, total_monto');
    
    if (data && data.length > 0) {
      const totalH = data.reduce((acc, curr) => acc + Number(curr.total_horas), 0);
      const totalM = data.reduce((acc, curr) => acc + Number(curr.total_monto), 0);
      setWeeklyHours(totalH);
      setWeeklyTotal(totalM);
    }
    if (error) console.error('Error fetching weekly summary:', error);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClient || !date || !hours) return;

    // Validate date is not Sunday
    const selectedDate = new Date(date);
    if (selectedDate.getUTCDay() === 0) {
      alert('No se pueden registrar servicios los Domingos.');
      return;
    }

    setIsSubmitting(true);
    
    const client = clients.find(c => c.id === selectedClient);
    const subtotal = Number(hours) * client.tarifa_hora;

    const { error } = await supabase
      .from('servicios')
      .insert([
        {
          cliente_id: selectedClient,
          fecha: date,
          horas: Number(hours),
          nota: notes,
          subtotal: subtotal
        }
      ]);

    setIsSubmitting(false);

    if (error) {
      console.error('Error saving service:', error);
      alert('Error al guardar. Intenta de nuevo.');
    } else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setIsModalOpen(false);
      // Reset form
      setSelectedClient('');
      setHours('');
      setNotes('');
      // Refresh summary
      fetchWeeklySummary();
    }
  };

  return (
    <div className="space-y-6">
      {/* Weekly Summary Card */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center text-center">
        <h2 className="text-gray-500 font-medium text-sm mb-2">Acumulado de la Semana</h2>
        <p className="text-4xl font-bold text-gray-900 mb-1">${weeklyTotal.toFixed(2)}</p>
        <p className="text-brand-600 text-sm font-medium flex items-center justify-center gap-1">
          <Clock className="w-4 h-4" />
          {weeklyHours} horas registradas
        </p>
      </div>

      {/* Main Action */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-xl p-4 font-semibold text-lg flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] transition-all active:scale-[0.98]"
      >
        <PlusCircle className="w-6 h-6" />
        Registrar Día
      </button>

      {/* Success Feedback */}
      {showSuccess && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-green-50 text-green-800 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 z-50 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-medium">¡Registro Guardado!</span>
        </div>
      )}

      {/* Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 sm:p-0">
          <div className="bg-white w-full max-w-md rounded-3xl md:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">Nuevo Registro</h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cliente</label>
                <select 
                  required
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                >
                  <option value="">Selecciona un cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.nombre}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha</label>
                <div className="relative">
                  <CalendarDays className="absolute left-3 top-3.5 w-5 h-5 text-gray-400" />
                  <input 
                    type="date" 
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de Horas</label>
                <input 
                  type="number" 
                  step="0.5"
                  min="0.5"
                  required
                  placeholder="Ej: 2.5"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nota (Opcional)</label>
                <textarea 
                  rows="2"
                  placeholder="Detalles del servicio..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all resize-none"
                ></textarea>
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 hover:bg-black text-white rounded-xl p-4 font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
