import { useState, useEffect } from 'react';
import { CalendarDays, CheckCircle2, Clock, Star } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

export default function LogWork() {
  const [clients, setClients] = useState([]);
  const [selectedClient, setSelectedClient] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hours, setHours] = useState('');
  const [notes, setNotes] = useState('');
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [todayServices, setTodayServices] = useState([]);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    const fetchClients = async () => {
      try {
        const { data, error } = await supabase
          .from('clientes')
          .select('*')
          .order('nombre');
        
        if (error) {
          console.error('Error fetching clients:', error);
          setFetchError(error.message);
        } else if (data) {
          setClients(data);
          setFetchError(null);
        }
      } catch (err) {
        console.error('Unexpected error fetching clients:', err);
        setFetchError(err.message);
      }
    };

    fetchClients();
    fetchTodayServices();
  }, []);

  const fetchTodayServices = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('servicios')
      .select(`
        id,
        horas,
        nota,
        subtotal,
        cliente_id,
        clientes (
          nombre,
          tarifa_hora
        )
      `)
      .eq('fecha', today)
      .order('id', { ascending: false });
      
    if (data) setTodayServices(data);
    if (error) console.error('Error fetching today services:', error);
  };

  const selectedClientData = clients.find(c => c.id === selectedClient);
  const calculatedTotal = selectedClientData && hours 
    ? (Number(hours) * selectedClientData.tarifa_hora).toFixed(2) 
    : '0.00';

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
    
    const subtotal = Number(hours) * selectedClientData.tarifa_hora;

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
      
      // Reset form
      setSelectedClient('');
      setHours('');
      setNotes('');
      setDate(new Date().toISOString().split('T')[0]);
      
      // Update agenda
      fetchTodayServices();
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 max-w-md mx-auto">
      <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
        <Clock className="w-5 h-5 text-brand-600" />
        Registrar Trabajo
      </h2>

      {showSuccess && (
        <div className="mb-4 bg-green-50 text-green-800 px-4 py-3 rounded-xl flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-medium text-sm">¡Registro guardado exitosamente!</span>
        </div>
      )}

      {fetchError && (
        <div className="mb-4 bg-red-50 text-red-800 px-4 py-3 rounded-xl text-sm border border-red-200 animate-in fade-in">
          <strong className="block mb-1">Error de conexión con Supabase:</strong>
          {fetchError}
          <p className="mt-2 text-xs opacity-80">
            * Revisa que las políticas RLS (Row Level Security) en Supabase estén desactivadas o que permitan "Select".
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente</label>
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
          {selectedClientData && (
            <p className="text-xs text-brand-600 mt-1.5 font-medium">
              Tarifa: ${selectedClientData.tarifa_hora.toFixed(2)} / hora
            </p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha</label>
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
          <p className="text-xs text-gray-400 mt-1.5">No se permite registrar domingos.</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Horas Trabajadas</label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nota (Opcional)</label>
          <textarea 
            rows="2"
            placeholder="Detalles del servicio..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all resize-none"
          ></textarea>
        </div>

        <div className="pt-2 bg-gray-50 rounded-xl p-4 border border-gray-100 flex justify-between items-center mb-4">
          <span className="text-sm font-medium text-gray-600">Total a registrar:</span>
          <span className="text-2xl font-bold text-gray-900">${calculatedTotal}</span>
        </div>

        <button 
          type="submit" 
          disabled={isSubmitting}
          className="w-full bg-brand-600 hover:bg-brand-500 text-white rounded-xl p-4 font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center"
        >
          {isSubmitting ? (
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          ) : (
            'Guardar Registro'
          )}
        </button>
      </form>

      {/* Agenda de hoy */}
      <div className="mt-8 border-t border-gray-100 pt-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Agenda de hoy</h3>
        {todayServices.length === 0 ? (
          <p className="text-sm text-gray-500">No hay servicios registrados hoy.</p>
        ) : (
          <div className="space-y-3">
            {todayServices.map(service => {
              // Mark as premium if the client pays 14/hr (Esti, Laura S, Monica)
              const isPremium = service.clientes?.tarifa_hora === 14;
              
              return (
                <div 
                  key={service.id} 
                  className={`p-4 rounded-xl shadow-sm border transition-all ${
                    isPremium 
                      ? 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-200' 
                      : 'bg-white border-gray-100'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className={`font-semibold ${isPremium ? 'text-amber-900' : 'text-gray-900'} flex items-center gap-2`}>
                        {service.clientes?.nombre || 'Cliente eliminado'}
                        {isPremium && (
                          <span className="bg-amber-100 text-amber-800 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                            Premium
                          </span>
                        )}
                      </h4>
                      <p className={`text-sm mt-1 ${isPremium ? 'text-amber-700/80' : 'text-gray-500'}`}>
                        {service.horas} horas • ${service.subtotal}
                      </p>
                    </div>
                  </div>
                  {service.nota && (
                    <p className={`text-xs mt-2 italic ${isPremium ? 'text-amber-600' : 'text-gray-400'}`}>
                      "{service.nota}"
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
