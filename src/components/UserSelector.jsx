import React from 'react';
import { User, Cloud, Star, CheckCircle2 } from 'lucide-react';

export default function UserSelector({ onSelectUser }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border border-gray-100 space-y-6">
        <div>
          <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Hola! 👋</h2>
          <p className="text-sm text-gray-500 mt-1">¿Quién está usando la aplicación?</p>
        </div>

        <div className="space-y-3">
          {/* Nati: Azul con Nube */}
          <button
            onClick={() => onSelectUser('nati')}
            className="w-full p-4 rounded-2xl border-2 border-blue-500 bg-blue-50/70 hover:bg-blue-100 text-blue-950 font-semibold flex items-center justify-between transition-all transform active:scale-95 shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Cloud className="w-6 h-6 fill-white/20 text-white" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  Soy Nati <Cloud className="w-4 h-4 text-blue-500 fill-blue-100" />
                </p>
                <p className="text-xs text-blue-700 font-medium">Limpieza & Control de Salud</p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          {/* Gina: Azul con Estrella, subtítulo 'Control Horas' */}
          <button
            onClick={() => onSelectUser('gina')}
            className="w-full p-4 rounded-2xl border-2 border-sky-500 bg-sky-50/70 hover:bg-sky-100 text-sky-950 font-semibold flex items-center justify-between transition-all transform active:scale-95 shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center font-bold shadow-sm">
                <Star className="w-6 h-6 fill-amber-300 text-amber-300" />
              </div>
              <div className="text-left">
                <p className="text-base font-bold text-gray-900 flex items-center gap-1.5">
                  Soy Gina <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
                </p>
                <p className="text-xs text-sky-700 font-medium">Control Horas</p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-sky-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <p className="text-xs text-gray-400">Podrás cambiar de usuario en cualquier momento.</p>
      </div>
    </div>
  );
}
