import React from 'react';
import { Sparkles, UserCheck, Heart } from 'lucide-react';

export default function GinaView({ onChangeUser }) {
  return (
    <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-purple-100 max-w-md mx-auto text-center space-y-6 animate-in fade-in">
      <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
        <Sparkles className="w-10 h-10" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">¡Hola Gina! 👋✨</h2>
        <p className="text-sm text-purple-700 font-medium mt-1">Bienvenida a tu espacio personalizado</p>
      </div>

      <div className="bg-purple-50/70 p-4 rounded-2xl border border-purple-100 text-left space-y-2">
        <div className="flex items-center gap-2 text-purple-900 font-semibold text-sm">
          <Heart className="w-4 h-4 text-purple-600 fill-purple-600" />
          <span>Espacio de Gina preparado</span>
        </div>
        <p className="text-xs text-gray-600 leading-relaxed">
          Ya hemos configurado la selección de usuario. Todo el control de horas actual está asignado al perfil de Nati.
        </p>
        <p className="text-xs font-medium text-purple-800 pt-1">
          📌 Cuando estés lista para construir lo de Gina, solo avísame qué funciones quieres agregar.
        </p>
      </div>

      <button
        onClick={onChangeUser}
        className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl text-sm transition-all flex items-center justify-center gap-2"
      >
        <UserCheck className="w-4 h-4" />
        Cambiar a perfil de Nati
      </button>
    </div>
  );
}
