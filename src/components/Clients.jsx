import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { UserPlus, Edit2, Trash2, MapPin, DollarSign } from 'lucide-react';

export default function Clients() {
  const [clients, setClients] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  
  // Form State
  const [nombre, setNombre] = useState('');
  const [direccion, setDireccion] = useState('');
  const [tarifaHora, setTarifaHora] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .order('nombre');
    
    if (data) setClients(data);
    if (error) console.error('Error fetching clients:', error);
  };

  const openModal = (client = null) => {
    if (client) {
      setEditingClient(client);
      setNombre(client.nombre);
      setDireccion(client.direccion || '');
      setTarifaHora(client.tarifa_hora);
    } else {
      setEditingClient(null);
      setNombre('');
      setDireccion('');
      setTarifaHora('');
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const clientData = {
      nombre,
      direccion,
      tarifa_hora: Number(tarifaHora)
    };

    if (editingClient) {
      const { error } = await supabase
        .from('clientes')
        .update(clientData)
        .eq('id', editingClient.id);
      
      if (!error) {
        setIsModalOpen(false);
        fetchClients();
      } else {
        alert('Error updating client');
      }
    } else {
      const { error } = await supabase
        .from('clientes')
        .insert([clientData]);
      
      if (!error) {
        setIsModalOpen(false);
        fetchClients();
      } else {
        alert('Error creating client');
      }
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás seguro de eliminar este cliente?')) {
      const { error } = await supabase
        .from('clientes')
        .delete()
        .eq('id', id);
      
      if (!error) {
        fetchClients();
      } else {
        alert('Error deleting client');
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Mis Clientes</h2>
        <button 
          onClick={() => openModal()}
          className="bg-brand-50 text-brand-600 p-2 rounded-lg hover:bg-brand-100 transition-colors"
        >
          <UserPlus className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-3">
        {clients.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            No hay clientes registrados aún.
          </div>
        ) : (
          clients.map(client => (
            <div key={client.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center transition-all hover:shadow-md">
              <div>
                <h3 className="font-semibold text-gray-900">{client.nombre}</h3>
                <div className="flex items-center text-gray-500 text-sm mt-1 gap-1">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[150px] sm:max-w-xs">{client.direccion || 'Sin dirección'}</span>
                </div>
                <div className="flex items-center text-brand-600 text-sm font-medium mt-1 gap-1">
                  <DollarSign className="w-3 h-3" />
                  <span>${Number(client.tarifa_hora).toFixed(2)} / hora</span>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => openModal(client)}
                  className="p-2 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => handleDelete(client.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4 sm:p-0">
          <div className="bg-white w-full max-w-md rounded-3xl md:rounded-2xl p-6 shadow-2xl animate-in slide-in-from-bottom-8 md:slide-in-from-bottom-0 md:zoom-in-95">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingClient ? 'Editar Cliente' : 'Nuevo Cliente'}
              </h3>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-2"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre</label>
                <input 
                  type="text" 
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
                <input 
                  type="text"
                  value={direccion}
                  onChange={(e) => setDireccion(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tarifa por Hora ($)</label>
                <input 
                  type="number" 
                  step="0.01"
                  min="0"
                  required
                  value={tarifaHora}
                  onChange={(e) => setTarifaHora(e.target.value)}
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-brand-500 focus:border-brand-500 outline-none transition-all"
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full bg-gray-900 hover:bg-black text-white rounded-xl p-4 font-semibold shadow-md transition-all active:scale-[0.98] disabled:opacity-70"
                >
                  {isSubmitting ? 'Guardando...' : 'Guardar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
