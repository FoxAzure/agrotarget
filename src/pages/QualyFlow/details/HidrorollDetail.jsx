// ================================= DOCUMENTATION ------------------------------------------
// Script: HidrorollDetail
// Purpose: Gerenciador das abas de detalhamento das avaliações Hidroroll.
// Tabs:
//   - Diário
//   - Histórico
// Relationships:
//   - CardHidroroll
//   - HidrorollDetailDiario
//   - HidrorollDetailHistorico
// Route:
//   - /qualyflow/hidroroll
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';
import HidrorollDetailDiario from './HidrorollDetailDiario';
import HidrorollDetailHistorico from './HidrorollDetailHistorico';

import '../Style.css';
import './HidrorollDetail.css';

// Descomente quando os componentes das abas forem criados:
// import HidrorollDetailDiario from './HidrorollDetailDiario';
// import HidrorollDetailHistorico from './HidrorollDetailHistorico';

// ================================= HELPERS ------------------------------------------------

const getTodayIso = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const normalizeInitialDate = (value) => {
  if (typeof value !== 'string') return getTodayIso();

  const normalized = value.trim();

  return /^\d{4}-\d{2}-\d{2}$/.test(normalized)
    ? normalized
    : getTodayIso();
};

// ================================= TEMPORARY COMPONENTS -----------------------------------

const DiarioEmDesenvolvimento = ({ initialDate }) => (
    <HidrorollDetailDiario initialDate={initialDate} />

);

const HistoricoEmDesenvolvimento = ({ initialYear }) => (
  <HidrorollDetailHistorico initialYear={initialYear} />
);

// ================================= COMPONENT ------------------------------------------------

const HidrorollDetail = () => {
  const location = useLocation();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  // Recupera a data enviada pelo CardHidroroll.
  // Se a rota for acessada diretamente, utiliza a data atual.
  const [initialDate] = useState(() =>
    normalizeInitialDate(location.state?.selectedDate),
  );

  const initialYear = Number(initialDate.slice(0, 4));

  // ================================= TAB BUTTON -------------------------------------------

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;

    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`qf-hidro-panel-${id}`}
        id={`qf-hidro-tab-${id}`}
        onClick={() => setActiveTab(id)}
        className={`qf-hidro-detail-tab ${isActive ? 'is-active' : ''}`}
      >
        <span>{label}</span>
      </button>
    );
  };

  // ================================= RENDER -----------------------------------------------

  return (
    <div className="qf-hidro-detail-page">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="qf-hidro-detail-main">
        {/* TÍTULO GLOBAL */}
        <header className="qf-hidro-detail-heading">
          <span>Qualidade Agrícola</span>

          <h1>
            Avaliação <b>Hidroroll</b>
          </h1>
        </header>

        {/* NAVEGAÇÃO DAS ABAS */}
        <nav
          className="qf-hidro-detail-tabs"
          role="tablist"
          aria-label="Detalhamento Hidroroll"
        >
          <TabButton id="diario" label="Diário" />
          <TabButton id="historico" label="Histórico" />
        </nav>

        {/*
          As abas permanecem montadas no DOM.
          Isso preserva datas, filtros e dados carregados ao alternar abas.
        */}
        <section className="qf-hidro-detail-content">
          <div
            id="qf-hidro-panel-diario"
            role="tabpanel"
            aria-labelledby="qf-hidro-tab-diario"
            className={activeTab === 'diario' ? 'block w-full' : 'hidden'}
          >
            {/* Substituir futuramente por:
                <HidrorollDetailDiario initialDate={initialDate} />

                O DateSelectorQualyFlow ficará dentro do componente diário,
                seguindo o mesmo padrão usado no CucDetailDiario.
            */}
            <DiarioEmDesenvolvimento initialDate={initialDate} />
          </div>

          <div
            id="qf-hidro-panel-historico"
            role="tabpanel"
            aria-labelledby="qf-hidro-tab-historico"
            className={activeTab === 'historico' ? 'block w-full' : 'hidden'}
          >
            {/* Substituir futuramente por:
                <HidrorollDetailHistorico initialYear={initialYear} />
            */}
            <HistoricoEmDesenvolvimento initialYear={initialYear} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default HidrorollDetail;
