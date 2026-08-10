// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetail
// Purpose: Gerenciador de Abas de Perdas Mecanizada (Forçando 4 abas na mesma linha com cache)
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';
import PerdaMecDetailDiario from './PerdaMecDetailDiario';
import PerdaMecDetailRank from './PerdaMecDetailRank';
import '../Style.css';

const PerdaMecDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('diario');
  
  // Pega a data que veio lá do Card da Home, ou pega a de hoje se entrar direto
  const [initialDate] = useState(location.state?.selectedDate || new Date().toISOString().split('T')[0]);

  const TabButton = ({ id, label }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`py-3 px-1 flex-1 text-[11px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest transition-all border-b-[3px] text-center flex items-center justify-center ${
        activeTab === id 
          ? 'text-[var(--q-green)] border-[var(--q-green)] bg-white' 
          : 'text-[var(--q-gray)] border-transparent hover:text-[var(--q-orange)] hover:bg-slate-50'
      }`}
    >
      <span className="truncate block w-full">{label}</span>
    </button>
  );

  // Componente temporário para deixar o código limpo
  const EmDesenvolvimento = () => (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
       <div className="bg-slate-50 border border-slate-200 border-dashed rounded-xl p-10 flex flex-col items-center justify-center text-slate-400 mt-4">
        <span className="text-xs font-bold uppercase tracking-widest">🚧 Em Desenvolvimento 🚧</span>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-10 font-sans">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full max-w-5xl px-4 flex flex-col mt-6 animate-in fade-in duration-500">
        
        {/* TÍTULO GLOBAL FIXO */}
        <div className="flex flex-col mb-4 px-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Operacional</span>
          <h1 className="text-[18px] font-black text-[var(--q-dark)] uppercase tracking-tighter leading-none">
            Perdas <span className="text-[var(--q-green)]">Mecanizada</span>
          </h1>
        </div>

        {/* NAVEGAÇÃO DE ABAS (Forçando as 4 colarem lado a lado) */}
        <div className="flex w-full border-b border-slate-200 mb-6 bg-slate-50/30 rounded-t-lg">
          <TabButton id="diario" label="Diário" />
          <TabButton id="ranking" label="Ranking" />
          <TabButton id="historico" label="Histórico" />
          <TabButton id="campos" label="Campos" />
        </div>

        {/* RENDERIZAÇÃO DAS ABAS (Mantidas no DOM para não recarregar dados atoa) */}
        <div className={activeTab === 'diario' ? 'block' : 'hidden'}>
          {/* Futuramente: <PerdaMecDetailDiario initialDate={initialDate} /> */}
          <PerdaMecDetailDiario />
        </div>

        <div className={activeTab === 'ranking' ? 'block' : 'hidden'}>
          <PerdaMecDetailRank />
        </div>

        <div className={activeTab === 'historico' ? 'block' : 'hidden'}>
          <EmDesenvolvimento />
        </div>

        <div className={activeTab === 'campos' ? 'block' : 'hidden'}>
          <EmDesenvolvimento />
        </div>

      </main>
    </div>
  );
};

export default PerdaMecDetail;