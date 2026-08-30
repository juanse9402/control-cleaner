import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  Clock,
  PlusCircle,
  ClipboardList,
  BarChart3,
  Calendar,
  Edit2,
  Trash2,
  CheckCircle2,
  Star,
  PartyPopper,
  Palmtree,
  Briefcase,
  UserCheck,
  Save,
  X,
  AlertCircle,
  FileCode
} from 'lucide-react';

// Helper to format float hours (e.g. 3.25 -> "3h 15min", 4 -> "4h")
function formatHours(val) {
  const num = Number(val) || 0;
  const hrs = Math.floor(num);
  const mins = Math.round((num - hrs) * 60);
  if (mins === 0) return `${hrs}h`;
  if (hrs === 0) return `${mins}min`;
  return `${hrs}h ${mins}min`;
}

export default function GinaView({ onChangeUser }) {
  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'history' | 'audit'

  // Form State
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [hoursInt, setHoursInt] = useState(4);
  const [minsInt, setMinsInt] = useState(0);
  const [tipoDia, setTipoDia] = useState('normal'); // 'normal' | 'horas_mas' | 'festivo' | 'vacaciones'
  const [notas, setNotas] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  // Data State
  const [records, setRecords] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Edit Modal State
  const [editingRecord, setEditingRecord] = useState(null);
  const [editDate, setEditDate] = useState('');
  const [editHoursInt, setEditHoursInt] = useState(0);
  const [editMinsInt, setEditMinsInt] = useState(0);
  const [editTipoDia, setEditTipoDia] = useState('normal');
  const [editNotas, setEditNotas] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Filter State
  const [selectedMonth, setSelectedMonth] = useState('all');

  useEffect(() => {
    fetchGinaRecords();
  }, []);

  const fetchGinaRecords = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('gina_horas')
        .select('*')
        .order('fecha', { ascending: false })
        .order('id', { ascending: false });

      if (error) {
        console.error('Error fetching gina_horas:', error);
        setFetchError(error.message);
      } else if (data) {
        setRecords(data);
        setFetchError(null);
      }
    } catch (err) {
      console.error('Unexpected error:', err);
      setFetchError(err.message);
    }
    setIsLoading(false);
  };

  const calculatedHours = Number(hoursInt) + (Number(minsInt) / 60);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (calculatedHours <= 0) {
      alert('Por favor especifica una cantidad de horas mayor a 0.');
      return;
    }

    setIsSubmitting(true);

    const recordData = {
      fecha: date,
      horas: Number(calculatedHours.toFixed(2)),
      tipo_dia: tipoDia,
      notas: notas.trim()
    };

    const { error } = await supabase
      .from('gina_horas')
      .insert([recordData]);

    setIsSubmitting(false);

    if (error) {
      console.error('Error guardando en gina_horas:', error);
      setFetchError('Error al guardar: ' + error.message);
    } else {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);

      // Reset form
      setNotas('');
      fetchGinaRecords();
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('¿Estás segura de eliminar este registro de Gina?')) {
      const { error } = await supabase
        .from('gina_horas')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Error al eliminar: ' + error.message);
      } else {
        fetchGinaRecords();
      }
    }
  };

  const openEditModal = (record) => {
    setEditingRecord(record);
    setEditDate(record.fecha);
    const total = Number(record.horas) || 0;
    const hrs = Math.floor(total);
    const mins = Math.round((total - hrs) * 60);
    setEditHoursInt(hrs);
    setEditMinsInt(mins);
    setEditTipoDia(record.tipo_dia || 'normal');
    setEditNotas(record.notas || '');
  };

  const handleSaveEdit = async () => {
    if (!editingRecord) return;
    const totalEditHours = Number(editHoursInt) + (Number(editMinsInt) / 60);
    if (totalEditHours <= 0) {
      alert('Por favor especifica una cantidad de horas mayor a 0.');
      return;
    }

    setIsSavingEdit(true);

    const { error } = await supabase
      .from('gina_horas')
      .update({
        fecha: editDate,
        horas: Number(totalEditHours.toFixed(2)),
        tipo_dia: editTipoDia,
        notas: editNotas.trim()
      })
      .eq('id', editingRecord.id);

    setIsSavingEdit(false);

    if (error) {
      alert('Error al actualizar: ' + error.message);
    } else {
      setEditingRecord(null);
      fetchGinaRecords();
    }
  };

  // Filtered records for History & Audit
  const filteredRecords = useMemo(() => {
    if (selectedMonth === 'all') return records;
    return records.filter(r => r.fecha && r.fecha.startsWith(selectedMonth));
  }, [records, selectedMonth]);

  // Derived Audit Metrics
  const auditMetrics = useMemo(() => {
    let totalHoras = 0;
    let totalHorasMas = 0;
    let diasTrabajados = 0;
    let festivosCount = 0;
    let vacacionesCount = 0;

    // Map for formula breakdown: e.g. "33 días x 4h = 132h"
    const breakdownMap = {};

    filteredRecords.forEach(r => {
      const h = Number(r.horas) || 0;
      totalHoras += h;

      if (r.tipo_dia === 'horas_mas') {
        totalHorasMas += h;
      } else if (r.tipo_dia === 'festivo') {
        festivosCount += 1;
      } else if (r.tipo_dia === 'vacaciones') {
        vacacionesCount += 1;
      } else {
        diasTrabajados += 1;
      }

      // Grouping key for formula breakdown
      const key = `${formatHours(h)} (${r.tipo_dia === 'horas_mas' ? 'Horas de más' : r.tipo_dia === 'festivo' ? 'Festivo' : r.tipo_dia === 'vacaciones' ? 'Vacaciones' : 'Normal'})`;
      if (!breakdownMap[key]) {
        breakdownMap[key] = { count: 0, hoursPerDay: h, total: 0, label: key };
      }
      breakdownMap[key].count += 1;
      breakdownMap[key].total += h;
    });

    return {
      totalHoras: totalHoras.toFixed(2),
      totalHorasMas: totalHorasMas.toFixed(2),
      diasTrabajados,
      festivosCount,
      vacacionesCount,
      totalRegistros: filteredRecords.length,
      breakdownList: Object.values(breakdownMap)
    };
  }, [filteredRecords]);

  // Month options for filter
  const monthOptions = useMemo(() => {
    const set = new Set();
    records.forEach(r => {
      if (r.fecha && r.fecha.length >= 7) {
        set.add(r.fecha.slice(0, 7));
      }
    });
    return Array.from(set).sort().reverse();
  }, [records]);

  const renderTipoBadge = (tipo) => {
    switch (tipo) {
      case 'horas_mas':
        return (
          <span className="bg-amber-100 text-amber-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
            Horas de Más
          </span>
        );
      case 'festivo':
        return (
          <span className="bg-purple-100 text-purple-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <PartyPopper className="w-3.5 h-3.5 text-purple-600" />
            Festivo / Fiesta
          </span>
        );
      case 'vacaciones':
        return (
          <span className="bg-teal-100 text-teal-800 text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Palmtree className="w-3.5 h-3.5 text-teal-600" />
            Vacaciones
          </span>
        );
      default:
        return (
          <span className="bg-sky-100 text-sky-800 text-xs font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
            <Briefcase className="w-3.5 h-3.5 text-sky-600" />
            Jornada Normal
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-lg mx-auto pb-12">
      {/* Top Banner Gina */}
      <div className="bg-gradient-to-r from-sky-600 to-blue-700 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 opacity-10">
          <Star className="w-40 h-40 fill-white" />
        </div>
        <div className="flex justify-between items-start relative z-10">
          <div>
            <span className="bg-white/20 text-white text-xs font-bold px-3 py-1 rounded-full backdrop-blur-sm flex items-center gap-1.5 w-max mb-2">
              <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
              Perfil de Gina
            </span>
            <h2 className="text-2xl font-bold">Control Horas Laborales</h2>
            <p className="text-xs text-sky-100 mt-1">Registra tu jornada diaria y audita tus horas de más ⭐</p>
          </div>
          <button
            onClick={onChangeUser}
            className="bg-white/10 hover:bg-white/20 text-white text-xs px-3 py-1.5 rounded-xl backdrop-blur-sm transition-all flex items-center gap-1 border border-white/20"
          >
            <UserCheck className="w-3.5 h-3.5" />
            Cambiar
          </button>
        </div>
      </div>

      {/* Supabase Error Alert if table missing or fetch fails */}
      {fetchError && (
        <div className="bg-amber-50 text-amber-900 p-4 rounded-2xl border border-amber-200 text-sm space-y-2">
          <div className="flex items-center gap-2 font-bold text-amber-800">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>Configuración de Supabase requerida</span>
          </div>
          <p className="text-xs text-amber-800/90 leading-relaxed">
            {fetchError.includes('relation "gina_horas" does not exist') || fetchError.includes('gina_horas') ? (
              <>
                Falta crear la tabla <strong>`gina_horas`</strong> en Supabase.
                <br />
                Ejecuta el script SQL <code className="bg-amber-100 px-1 py-0.5 rounded font-mono">supabase-gina-setup.sql</code> en el editor SQL de Supabase Dashboard.
              </>
            ) : fetchError.includes('Failed to fetch') ? (
              <>
                El servidor de Supabase está reactivándose. Por favor espera 1 minuto y recarga la página.
              </>
            ) : (
              fetchError
            )}
          </p>
        </div>
      )}

      {/* Internal Navigation Tabs */}
      <div className="flex bg-gray-100 p-1.5 rounded-2xl">
        <button
          onClick={() => setActiveTab('log')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'log' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <PlusCircle className="w-4 h-4" />
          Registrar
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'history' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <ClipboardList className="w-4 h-4" />
          Historial
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'audit' ? 'bg-white text-sky-700 shadow-sm' : 'text-gray-500 hover:text-gray-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Auditoría
        </button>
      </div>

      {/* TAB 1: REGISTRAR TRABAJO */}
      {activeTab === 'log' && (
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 space-y-5 animate-in fade-in">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Clock className="w-5 h-5 text-sky-600" />
            Registrar Horas de Hoy
          </h3>

          {showSuccess && (
            <div className="bg-green-50 text-green-800 px-4 py-3 rounded-2xl flex items-center gap-2 text-sm font-medium animate-in fade-in">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              ¡Registro de Gina guardado con éxito!
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">Fecha</label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-3.5 w-4 h-4 text-gray-400" />
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Tipo de Jornada / Día
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTipoDia('normal')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    tipoDia === 'normal'
                      ? 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Briefcase className="w-4 h-4 text-sky-600" />
                  Día Normal
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDia('horas_mas')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    tipoDia === 'horas_mas'
                      ? 'border-amber-500 bg-amber-50 text-amber-900 shadow-xs'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                  Horas de más
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDia('festivo')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    tipoDia === 'festivo'
                      ? 'border-purple-500 bg-purple-50 text-purple-900 shadow-xs'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <PartyPopper className="w-4 h-4 text-purple-600" />
                  Festivo / Fiesta
                </button>

                <button
                  type="button"
                  onClick={() => setTipoDia('vacaciones')}
                  className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                    tipoDia === 'vacaciones'
                      ? 'border-teal-500 bg-teal-50 text-teal-900 shadow-xs'
                      : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  <Palmtree className="w-4 h-4 text-teal-600" />
                  Vacaciones
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Duración del Trabajo
              </label>

              {/* Preset Buttons */}
              <div className="flex gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => { setHoursInt(4); setMinsInt(0); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-sky-100 text-xs font-bold text-gray-700 hover:text-sky-800 transition-all border border-gray-200"
                >
                  4 Horas
                </button>
                <button
                  type="button"
                  onClick={() => { setHoursInt(3); setMinsInt(15); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-sky-100 text-xs font-bold text-gray-700 hover:text-sky-800 transition-all border border-gray-200"
                >
                  3h 15min
                </button>
                <button
                  type="button"
                  onClick={() => { setHoursInt(8); setMinsInt(0); }}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-sky-100 text-xs font-bold text-gray-700 hover:text-sky-800 transition-all border border-gray-200"
                >
                  8 Horas
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[11px] text-gray-500 block mb-1">Horas</span>
                  <select
                    value={hoursInt}
                    onChange={(e) => setHoursInt(Number(e.target.value))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-semibold"
                  >
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                      <option key={h} value={h}>{h} h</option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[11px] text-gray-500 block mb-1">Minutos</span>
                  <select
                    value={minsInt}
                    onChange={(e) => setMinsInt(Number(e.target.value))}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm font-semibold"
                  >
                    <option value={0}>00 min</option>
                    <option value={15}>15 min (0.25h)</option>
                    <option value={30}>30 min (0.50h)</option>
                    <option value={45}>45 min (0.75h)</option>
                  </select>
                </div>
              </div>

              <div className="mt-2 text-right">
                <span className="text-xs font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg border border-sky-100">
                  Total: {formatHours(calculatedHours)} ({calculatedHours.toFixed(2)} hrs)
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Notas / Observaciones (Opcional)
              </label>
              <textarea
                rows="2"
                placeholder="Ej. Fiestas La Blanca, 28 de Abril..."
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-sky-500 outline-none text-sm resize-none"
              ></textarea>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-sky-600 hover:bg-sky-500 text-white rounded-xl p-3.5 font-bold shadow-md transition-all active:scale-[0.98] disabled:opacity-70 flex justify-center items-center gap-2"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Guardar Registro
                </>
              )}
            </button>
          </form>
        </div>
      )}

      {/* TAB 2: HISTORIAL Y EDICIÓN */}
      {activeTab === 'history' && (
        <div className="space-y-4 animate-in fade-in">
          {/* Month Filter */}
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between gap-4">
            <span className="text-xs font-bold text-gray-700">Filtrar por Mes:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="all">Todos los meses</option>
              {monthOptions.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-10">
              <div className="w-8 h-8 border-4 border-sky-200 border-t-sky-600 rounded-full animate-spin"></div>
            </div>
          ) : filteredRecords.length === 0 ? (
            <div className="text-center py-10 text-gray-500 bg-white rounded-2xl border border-gray-100">
              No hay registros ingresados para este período.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRecords.map(item => (
                <div
                  key={item.id}
                  className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-2"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-400 font-mono block">
                        {item.fecha}
                      </span>
                      <h4 className="text-base font-bold text-gray-900 mt-0.5">
                        {formatHours(item.horas)}
                      </h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {renderTipoBadge(item.tipo_dia)}
                      <button
                        onClick={() => openEditModal(item)}
                        className="p-1.5 text-gray-400 hover:text-sky-600 hover:bg-sky-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {item.notas && (
                    <p className="text-xs text-gray-600 italic bg-gray-50 p-2.5 rounded-xl border border-gray-100">
                      "{item.notas}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: AUDITORÍA Y RESUMEN ("Días y Horas de más") */}
      {activeTab === 'audit' && (
        <div className="space-y-5 animate-in fade-in">
          {/* Audit Metrics Header */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-sky-100 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-sky-600" />
                Resumen de Auditoría
              </h3>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="p-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="all">Ver Todo</option>
                {monthOptions.map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>

            {/* Stat Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-sky-50/80 p-3.5 rounded-2xl border border-sky-100">
                <span className="text-[11px] font-semibold text-sky-800 block">Total Horas</span>
                <span className="text-2xl font-black text-sky-900">
                  {formatHours(auditMetrics.totalHoras)}
                </span>
                <span className="text-[10px] text-sky-700 block mt-0.5">({auditMetrics.totalHoras}h)</span>
              </div>

              <div className="bg-amber-50/80 p-3.5 rounded-2xl border border-amber-100">
                <span className="text-[11px] font-semibold text-amber-800 block flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                  Horas de Más
                </span>
                <span className="text-2xl font-black text-amber-900">
                  {formatHours(auditMetrics.totalHorasMas)}
                </span>
                <span className="text-[10px] text-amber-700 block mt-0.5">({auditMetrics.totalHorasMas}h)</span>
              </div>

              <div className="bg-gray-50 p-3.5 rounded-2xl border border-gray-100">
                <span className="text-[11px] font-semibold text-gray-600 block">Días Normales</span>
                <span className="text-xl font-bold text-gray-800">
                  {auditMetrics.diasTrabajados} días
                </span>
              </div>

              <div className="bg-purple-50 p-3.5 rounded-2xl border border-purple-100">
                <span className="text-[11px] font-semibold text-purple-800 block">Festivos / Vacaciones</span>
                <span className="text-xl font-bold text-purple-900">
                  {auditMetrics.festivosCount + auditMetrics.vacacionesCount} días
                </span>
              </div>
            </div>
          </div>

          {/* Formula Breakdown List (Matching Handwritten Note) */}
          <div className="bg-white p-5 rounded-3xl shadow-sm border border-gray-100 space-y-3">
            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
              <FileCode className="w-4 h-4 text-sky-600" />
              Desglose de Auditoría (Fórmulas)
            </h4>

            {auditMetrics.breakdownList.length === 0 ? (
              <p className="text-xs text-gray-400">No hay datos suficientes para calcular desgloses.</p>
            ) : (
              <div className="space-y-2">
                {auditMetrics.breakdownList.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 rounded-2xl border border-gray-100 flex justify-between items-center text-xs"
                  >
                    <span className="font-semibold text-gray-700">
                      {item.count} días × {formatHours(item.hoursPerDay)}
                    </span>
                    <span className="font-mono font-bold text-sky-800">
                      = {formatHours(item.total)} ({item.total.toFixed(2)}h)
                    </span>
                  </div>
                ))}

                <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-sm font-black text-sky-900 bg-sky-50/50 p-3 rounded-2xl">
                  <span>Total Acumulado Auditoría:</span>
                  <span>{formatHours(auditMetrics.totalHoras)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {editingRecord && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 border border-gray-100">
            <div className="flex justify-between items-center">
              <h3 className="text-base font-bold text-gray-900">Editar Registro</h3>
              <button
                onClick={() => setEditingRecord(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Fecha</label>
              <input
                type="date"
                value={editDate}
                onChange={(e) => setEditDate(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Tipo de Día</label>
              <select
                value={editTipoDia}
                onChange={(e) => setEditTipoDia(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold outline-none"
              >
                <option value="normal">Día Normal</option>
                <option value="horas_mas">Horas de más</option>
                <option value="festivo">Festivo / Fiesta</option>
                <option value="vacaciones">Vacaciones</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Horas y Minutos</label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={editHoursInt}
                  onChange={(e) => setEditHoursInt(Number(e.target.value))}
                  className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(h => (
                    <option key={h} value={h}>{h} hrs</option>
                  ))}
                </select>
                <select
                  value={editMinsInt}
                  onChange={(e) => setEditMinsInt(Number(e.target.value))}
                  className="p-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
                >
                  <option value={0}>00 min</option>
                  <option value={15}>15 min</option>
                  <option value={30}>30 min</option>
                  <option value={45}>45 min</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Notas</label>
              <textarea
                rows="2"
                value={editNotas}
                onChange={(e) => setEditNotas(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs outline-none resize-none"
              ></textarea>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                className="flex-1 py-2.5 bg-gray-100 text-gray-700 text-xs font-bold rounded-xl"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                disabled={isSavingEdit}
                className="flex-1 py-2.5 bg-sky-600 text-white text-xs font-bold rounded-xl shadow-sm flex items-center justify-center gap-1"
              >
                {isSavingEdit ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
