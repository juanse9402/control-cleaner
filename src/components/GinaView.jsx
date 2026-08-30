import React from 'react';
import { Star, UserCheck, Clock } from 'lucide-react';

export default function GinaView({ onChangeUser }) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-sky-100 max-w-md mx-auto text-center space-y-6 animate-in fade-in">
      <div className="w-20 h-20 bg-sky-100 text-sky-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <Star className="w-10 h-10 fill-amber-400 text-amber-400" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">¡Hola Gina! 👋⭐</h2>
        <p className="text-sm text-sky-700 font-medium mt-1">Control Horas - Perfil de Gina</p>
      </div>

      <div className="bg-sky-50/70 p-4 rounded-2xl border border-sky-100 text-left space-y-2">
        <div className="flex items-center gap-2 text-sky-900 font-semibold text-sm">
          <Clock className="w-4 h-4 text-sky-600" />
          <span>Control Horas de Gina preparado</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Hemos configurado tu perfil de <strong>Control Horas</strong> con el color azul y la estrella ⭐.
        </p>
        <p className="text-xs font-medium text-sky-800 pt-1">
          📌 Cuando estés lista para construir lo de Gina, avísame qué campos y funciones quieres agregar.
        </p>
      </div>

      <button
        onClick={onChangeUser}
        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
      >
        <UserCheck className="w-4 h-4 text-sky-600" />
        Cambiar a perfil de Nati
      </button>
    </div>
  );
}
