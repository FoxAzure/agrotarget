import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';

import CucDetailDiario from './CucDetailDiario';
import CucDetailHst from './CucDetailHst';
import '../Style.css';

const CucDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  // Controle de Abas
  const [activeTab, setActiveTab] = useState('diario');
  
  // Recupera a data do CardCUC ou usa uma padrão inicial
  const [selectedDate, setSelectedDate] = useState(location.state?.selectedDate || '2026-05-27');

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`py-3 px-6 text-[11px] font-black uppercase tracking-widest transition-all border-b-[3px] flex-1 sm:flex-none text-center ${
        activeTab === id 
          ? 'text-[var(--q-green)] border-[var(--q-green)] bg-white' 
          : 'text-[var(--q-gray)] border-transparent hover:text-[var(--q-orange)] hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-10 font-sans">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full max-w-5xl px-4 flex flex-col mt-6 animate-in fade-in duration-500">
        
        {/* TÍTULO GLOBAL FIXO */}
        <div className="flex flex-col mb-4 px-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Operacional</span>
          <h1 className="text-2xl font-black text-[var(--q-dark)] uppercase tracking-tighter leading-none">
            CUC <span className="text-[var(--q-green)]">Gotejo</span>
          </h1>
        </div>

        {/* NAVEGAÇÃO DE ABAS */}
        <div className="flex flex-wrap w-full border-b border-slate-200 mb-6">
          <TabButton id="diario" label="Diário" />
          <TabButton id="comparativo" label="Comparativo" />
          <TabButton id="historico" label="Histórico" />
        </div>

        {/* RENDERIZAÇÃO DAS ABAS */}
        {activeTab === 'diario' && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 mt-4">
              <span className="text-xs font-bold uppercase tracking-widest">🚧 Em Desenvolvimento 🚧</span>
            </div>
          </div>
        )}

        {activeTab === 'comparativo' && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
             <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 mt-4">
              <span className="text-xs font-bold uppercase tracking-widest">🚧 Em Desenvolvimento 🚧</span>
            </div>
          </div>
        )}

        {activeTab === 'historico' && (
          <CucDetailHst />
        )}

      </main>
    </div>
  );
};

export default CucDetail;