import React from 'react';
import { User, Sparkles, HeartPulse, CheckCircle2 } from 'lucide-react';

export default function UserSelector({ onSelectUser }) {
  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-3xl p-6 md:p-8 max-w-sm w-full shadow-2xl text-center border border-gray-100 space-y-6">
        <div>
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-full flex items-center justify-center mx-auto mb-3 shadow-inner">
            <User className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">¡Hola! 👋</h2>
          <p className="text-sm text-gray-500 mt-1">¿Quién está usando la aplicación?</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => onSelectUser('nati')}
            className="w-full p-4 rounded-2xl border-2 border-brand-500 bg-brand-50/50 hover:bg-brand-50 text-brand-900 font-semibold flex items-center justify-between transition-all transform active:scale-95 shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                N
              </span>
              <div className="text-left">
                <p className="text-base font-bold text-gray-900">Soy Nati</p>
                <p className="text-xs text-brand-700">Limpieza & Control de Salud</p>
              </div>
            </div>
            <CheckCircle2 className="w-5 h-5 text-brand-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => onSelectUser('gina')}
            className="w-full p-4 rounded-2xl border-2 border-purple-300 bg-purple-50/50 hover:bg-purple-50 text-purple-900 font-semibold flex items-center justify-between transition-all transform active:scale-95 shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                G
              </span>
              <div className="text-left">
                <p className="text-base font-bold text-gray-900">Soy Gina</p>
                <p className="text-xs text-purple-700">Espacio de Gina</p>
              </div>
            </div>
            <Sparkles className="w-5 h-5 text-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        <p className="text-xs text-gray-400">Podrás cambiar de usuario en cualquier momento.</p>
      </div>
    </div>
  );
}
