// ================================= DOCUMENTATION ------------------------------------------
// Script: CucDetail
// Purpose: Gerenciador de Abas do CUC Gotejo (Agora forçando 4 abas na mesma linha)
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';

import CucDetailDiario from './CucDetailDiario';
import CucDetailHst from './CucDetailHst';
import CucDetailAvaliacoes from './CucDetailAvaliacoes';
import CucDetailComparativo from './CucDetailComparativo';
import '../Style.css';

const CucDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  
  const [activeTab, setActiveTab] = useState('diario');
  
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

  return (
    <div className="min-h-screen bg-[var(--q-bg)] flex flex-col items-center pb-10 font-sans">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="w-full max-w-5xl px-4 flex flex-col mt-6 animate-in fade-in duration-500">
        
        {/* TÍTULO GLOBAL FIXO */}
        <div className="flex flex-col mb-4 px-1">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Operacional</span>
          <h1 className="text-[18px] font-black text-[var(--q-dark)] uppercase tracking-tighter leading-none">
            CUC <span className="text-[var(--q-green)]">Gotejo</span>
          </h1>
        </div>

        {/* NAVEGAÇÃO DE ABAS (Forçando as 4 colarem lado a lado) */}
        <div className="flex w-full border-b border-slate-200 mb-6 bg-slate-50/30 rounded-t-lg">
          <TabButton id="diario" label="Diário" />
          <TabButton id="comparativo" label="Comparativo" />
          <TabButton id="avaliacoes" label="Avaliações" />
          <TabButton id="historico" label="Histórico" />
        </div>

        {/* RENDERIZAÇÃO DAS ABAS */}
        <div className={activeTab === 'diario' ? 'block' : 'hidden'}>
          <CucDetailDiario initialDate={initialDate} />
        </div>

        <div className={activeTab === 'comparativo' ? 'block' : 'hidden'}>
          <CucDetailComparativo />
        </div>

        <div className={activeTab === 'avaliacoes' ? 'block' : 'hidden'}>
          <CucDetailAvaliacoes />
        </div>

        <div className={activeTab === 'historico' ? 'block' : 'hidden'}>
          <CucDetailHst />
        </div>

      </main>
    </div>
  );
};

export default CucDetail;