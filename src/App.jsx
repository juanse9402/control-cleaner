import { useState } from 'react';
import { PlusCircle, Users, BarChart3 } from 'lucide-react';
import LogWork from './components/LogWork';
import Clients from './components/Clients';
import MonthlyReport from './components/MonthlyReport';
import ReloadPrompt from './components/ReloadPrompt';

function App() {
  const [activeTab, setActiveTab] = useState('logwork');

  const renderContent = () => {
    switch (activeTab) {
      case 'logwork':
        return <LogWork />;
      case 'clients':
        return <Clients />;
      case 'reports':
        return <MonthlyReport />;
      default:
        return <LogWork />;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans pb-16 md:pb-0">
      <ReloadPrompt />
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-100 p-4 sticky top-0 z-10">
        <h1 className="text-xl font-semibold text-center text-brand-600">Control Horas</h1>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-lg mx-auto p-4 md:py-8">
        {renderContent()}
      </main>

      {/* Bottom Navigation (Mobile First) */}
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
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center p-2 rounded-lg transition-colors ${
            activeTab === 'reports' ? 'text-brand-600 bg-brand-50' : 'text-gray-500 hover:text-gray-900'
          }`}
        >
          <BarChart3 className="w-6 h-6 mb-1" />
          <span className="text-xs font-medium">Reportes</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
