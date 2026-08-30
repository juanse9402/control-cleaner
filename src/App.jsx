import { useState, useEffect } from 'react';
import { PlusCircle, Users, BarChart3, ClipboardList, HeartPulse, Sparkles, User, RefreshCw } from 'lucide-react';
import LogWork from './components/LogWork';
import Clients from './components/Clients';
import MonthlyReport from './components/MonthlyReport';
import History from './components/History';
import Health from './components/HealthView';
import ReloadPrompt from './components/ReloadPrompt';
import UserSelector from './components/UserSelector';
import GinaView from './components/GinaView';

function App() {
  const [currentUser, setCurrentUser] = useState(() => {
    return localStorage.getItem('control_horas_user') || null;
  });
  const [showUserSelector, setShowUserSelector] = useState(!currentUser);
  const [appMode, setAppMode] = useState('limpieza'); // 'limpieza' | 'salud'
  const [activeTab, setActiveTab] = useState('logwork');

  const handleSelectUser = (user) => {
    setCurrentUser(user);
    localStorage.setItem('control_horas_user', user);
    setShowUserSelector(false);
  };

  const renderContent = () => {
    if (currentUser === 'gina') {
      return <GinaView onChangeUser={() => handleSelectUser('nati')} />;
    }

    if (appMode === 'salud') {
      return <Health />;
    }
    switch (activeTab) {
      case 'logwork':
        return <LogWork />;
      case 'clients':
        return <Clients />;
      case 'history':
        return <History />;
      case 'reports':
        return <MonthlyReport />;
      default:
        return <LogWork />;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans pb-16 md:pb-0 ${appMode === 'salud' && currentUser === 'nati' ? 'bg-purple-50/30' : 'bg-gray-50'}`}>
      <ReloadPrompt />

      {/* User Selection Modal on start or request */}
      {(showUserSelector || !currentUser) && (
        <UserSelector onSelectUser={handleSelectUser} />
      )}

      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 p-4 sticky top-0 z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between max-w-lg mx-auto w-full relative">
          <h1 className={`text-xl font-bold ${appMode === 'salud' && currentUser === 'nati' ? 'text-purple-700' : 'text-brand-600'}`}>
            {currentUser === 'gina' ? 'Espacio de Gina' : appMode === 'salud' ? 'Control de Salud' : 'Control Horas'}
          </h1>

          {/* Current Profile Badge */}
          {currentUser && (
            <button
              onClick={() => setShowUserSelector(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 hover:bg-gray-200 transition-all border border-gray-200 shadow-2xs"
              title="Cambiar usuario"
            >
              <User className="w-3.5 h-3.5 text-brand-600" />
              <span>{currentUser === 'nati' ? 'Soy Nati' : 'Soy Gina'}</span>
              <RefreshCw className="w-3 h-3 text-gray-400 ml-0.5" />
            </button>
          )}
        </div>
        
        {/* Main Menu Toggle for Nati */}
        {currentUser === 'nati' && (
          <div className="flex bg-gray-100 p-1 rounded-xl max-w-sm mx-auto w-full">
            <button 
              onClick={() => setAppMode('limpieza')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${appMode === 'limpieza' ? 'bg-white text-brand-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <Sparkles className="w-4 h-4" />
              Limpieza
            </button>
            <button 
              onClick={() => setAppMode('salud')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-lg transition-all ${appMode === 'salud' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <HeartPulse className="w-4 h-4" />
              Salud
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 md:py-8">
        {renderContent()}
      </main>

      {/* Bottom Navigation (Mobile First for Nati) */}
      {currentUser === 'nati' && appMode === 'limpieza' && (
        <nav className="fixed bottom-0 w-full bg-white border-t border-gray-200 flex justify-around p-2 md:relative md:max-w-lg md:mx-auto md:border md:rounded-t-2xl md:shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20">
          <button
            onClick={() => setActiveTab('logwork')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === 'logwork' ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <PlusCircle className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Registro</span>
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === 'clients' ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <Users className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Clientes</span>
          </button>
          <button
            onClick={() => setActiveTab('history')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === 'history' ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <ClipboardList className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Historial</span>
          </button>
          <button
            onClick={() => setActiveTab('reports')}
            className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
              activeTab === 'reports' ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-900'
            }`}
          >
            <BarChart3 className="w-6 h-6 mb-1" />
            <span className="text-xs font-medium">Reportes</span>
          </button>
        </nav>
      )}
    </div>
  );
}

export default App;
