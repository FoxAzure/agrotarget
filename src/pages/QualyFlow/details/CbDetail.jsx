// ================================= DOCUMENTATION ------------------------------------------
// Script: CbDetail
// Purpose: Gerenciador das abas de acompanhamento das Casas de Bomba.
// Tabs:
//   - Diário
//   - Histórico
// Relationships:
//   - CardCb
//   - CbDetailDiario
//   - CbDetailHist
// Route:
//   - /qualyflow/casabomba
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';
import CbDetailDiario from './CbDetailDiario';
import CbDetailHist from './CbDetailHist';

import '../Style.css';

// Quando os dois componentes forem criados, descomentar:
//
// import CbDetailDiario from './CbDetailDiario';
// import CbDetailHist from './CbDetailHist';

// ================================= HELPERS ------------------------------------------------

const getTodayIso = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

// ================================= TEMPORARY COMPONENTS -----------------------------------

// Componentes temporários para a página funcionar antes da criação
// dos arquivos CbDetailDiario.jsx e CbDetailHist.jsx.

const DiarioEmDesenvolvimento = ({ initialDate }) => (
  <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
    <div
      className="
        bg-slate-50
        border
        border-slate-200
        border-dashed
        rounded-xl
        p-10
        flex
        flex-col
        items-center
        justify-center
        text-slate-400
        mt-4
      "
    >
      <span className="text-xs font-bold uppercase tracking-widest text-center">
        Diário das Casas de Bomba
      </span>

      <span className="text-[10px] font-bold text-slate-400 mt-2">
        Data inicial: {initialDate}
      </span>

      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-4">
        Em desenvolvimento
      </span>
    </div>
  </div>
);

const HistoricoEmDesenvolvimento = ({ initialYear }) => (
  <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
    <div
      className="
        bg-slate-50
        border
        border-slate-200
        border-dashed
        rounded-xl
        p-10
        flex
        flex-col
        items-center
        justify-center
        text-slate-400
        mt-4
      "
    >
      <span className="text-xs font-bold uppercase tracking-widest text-center">
        Histórico das Casas de Bomba
      </span>

      <span className="text-[10px] font-bold text-slate-400 mt-2">
        Ano inicial: {initialYear}
      </span>

      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-wider mt-4">
        Em desenvolvimento
      </span>
    </div>
  </div>
);

// ================================= COMPONENT ----------------------------------------------

const CbDetail = () => {
  const location = useLocation();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  // Recupera a data enviada pelo CardCb.
  // Caso o usuário acesse a rota diretamente, utiliza a data atual.
  const [initialDate] = useState(
    location.state?.selectedDate || getTodayIso()
  );

  const initialYear = Number(initialDate.split('-')[0]);

  // ================================= TAB BUTTON -------------------------------------------

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;

    return (
      <button
        type="button"
        onClick={() => setActiveTab(id)}
        className={`
          flex-1
          flex
          items-center
          justify-center
          py-3
          px-2
          border-b-[3px]
          text-[11px]
          font-black
          uppercase
          tracking-widest
          text-center
          transition-all
          duration-200
          ${
            isActive
              ? `
                text-[var(--q-green)]
                border-[var(--q-green)]
                bg-white
              `
              : `
                text-[var(--q-gray)]
                border-transparent
                hover:text-[var(--q-orange)]
                hover:bg-slate-50
              `
          }
        `}
      >
        <span className="block w-full truncate">
          {label}
        </span>
      </button>
    );
  };

  // ================================= RENDER -----------------------------------------------

  return (
    <div
      className="
        min-h-screen
        bg-[var(--q-bg)]
        flex
        flex-col
        items-center
        pb-10
        font-sans
      "
    >
      <HeaderQualyFlow
        onMenuOpen={() => setSidebarOpen(true)}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main
        className="
          w-full
          max-w-5xl
          px-4
          flex
          flex-col
          mt-6
          animate-in
          fade-in
          duration-500
        "
      >
        {/* ==================================================
            TÍTULO DA PÁGINA
        =================================================== */}

        <div className="flex flex-col mb-4 px-1">
          <span
            className="
              text-[10px]
              font-black
              text-slate-400
              uppercase
              tracking-widest
              mb-0.5
            "
          >
            Qualidade Agrícola
          </span>

          <h1
            className="
              text-[18px]
              font-black
              text-[var(--q-dark)]
              uppercase
              tracking-tighter
              leading-none
            "
          >
            Casas de{' '}
            <span className="text-[var(--q-green)]">
              Bomba
            </span>
          </h1>
        </div>

        {/* ==================================================
            NAVEGAÇÃO DAS ABAS
        =================================================== */}

        <div
          className="
            flex
            w-full
            border-b
            border-slate-200
            mb-6
            bg-slate-50/30
            rounded-t-lg
            overflow-hidden
          "
        >
          <TabButton
            id="diario"
            label="Diário"
          />

          <TabButton
            id="historico"
            label="Histórico"
          />
        </div>

        {/* ==================================================
            CONTEÚDO DAS ABAS

            As abas permanecem montadas no DOM.
            Isso evita recarregar os dados ao alternar entre elas.
        =================================================== */}

        <div
          className={
            activeTab === 'diario'
              ? 'block w-full'
              : 'hidden'
          }
        >
          {/* Futuramente substituir por:
          
          <CbDetailDiario initialDate={initialDate} /></div>
          
          */}

          <CbDetailDiario
            initialDate={initialDate}
          />
        </div>

        <div
          className={
            activeTab === 'historico'
              ? 'block w-full'
              : 'hidden'
          }
        >
          {/* Futuramente substituir por:
          
          <CbDetailHist
            initialYear={initialYear}
          />
          
          */}

          <CbDetailHist
            initialYear={initialYear}
          />
        </div>
      </main>
    </div>
  );
};

export default CbDetail;