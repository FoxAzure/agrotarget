// ================================= DOCUMENTATION ------------------------------------------
// Script: PreparoDetail
// Purpose: Gerenciador das abas de detalhamento das avaliações de Preparo de Solo.
// Tabs:
//   - Diário
//   - Campos
//   - Histórico
// Relationships:
//   - CardPreparo
//   - PreparoDetailDiario
//   - PreparoDetailCampos
//   - PreparoDetailHistorico
// Route:
//   - /qualyflow/preparo
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';

import '../Style.css';
import './PreparoDetail.css';

// Descomente os imports quando os componentes das abas forem criados:
import PreparoDetailDiario from './PreparoDetailDiario';
import PreparoDetailCampos from './PreparoDetailCampos';
import PreparoDetailHistorico from './PreparoDetailHistorico';

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
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : getTodayIso();
};

const formatDisplayDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return '--/--/----';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

// ================================= TEMPORARY COMPONENTS -----------------------------------

const DetailPlaceholder = ({ title, description, reference }) => (
  <div className="qf-preparo-detail-placeholder">
    <strong>{title}</strong>
    <span>{description}</span>
    <small>{reference}</small>
  </div>
);

const DiarioEmDesenvolvimento = ({ initialDate }) => (
  <PreparoDetailDiario initialDate={initialDate} />
);

const CamposEmDesenvolvimento = ({ initialYear }) => (
  <PreparoDetailCampos initialYear={initialYear} />
);

const HistoricoEmDesenvolvimento = ({ initialYear }) => (
  <PreparoDetailHistorico initialYear={initialYear} />
);

// ================================= COMPONENT ----------------------------------------------

const PreparoDetail = () => {
  const location = useLocation();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');
  const [initialDate] = useState(() => normalizeInitialDate(location.state?.selectedDate));
  const initialYear = Number(initialDate.slice(0, 4));

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;

    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`qf-preparo-panel-${id}`}
        id={`qf-preparo-tab-${id}`}
        tabIndex={isActive ? 0 : -1}
        onClick={() => setActiveTab(id)}
        className={`qf-preparo-detail-tab ${isActive ? 'is-active' : ''}`}
      >
        <span>{label}</span>
      </button>
    );
  };

  return (
    <div className="qf-preparo-detail-page">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="qf-preparo-detail-main">
        <header className="qf-preparo-detail-heading">
          <span>Qualidade Agrícola</span>
          <h1>Avaliação <b>Preparo de Solo</b></h1>
        </header>

        <nav className="qf-preparo-detail-tabs" role="tablist" aria-label="Detalhamento do Preparo de Solo">
          <TabButton id="diario" label="Diário" />
          <TabButton id="campos" label="Campos" />
          <TabButton id="historico" label="Histórico" />
        </nav>

        {/* As três abas permanecem montadas para preservar filtros, dados e seleções. */}
        <section className="qf-preparo-detail-content">
          <div
            id="qf-preparo-panel-diario"
            role="tabpanel"
            aria-labelledby="qf-preparo-tab-diario"
            className={activeTab === 'diario' ? 'block w-full' : 'hidden'}
          >
            <DiarioEmDesenvolvimento initialDate={initialDate} />
          </div>

          <div
            id="qf-preparo-panel-campos"
            role="tabpanel"
            aria-labelledby="qf-preparo-tab-campos"
            className={activeTab === 'campos' ? 'block w-full' : 'hidden'}
          >
            <CamposEmDesenvolvimento initialYear={initialYear} />
          </div>

          <div
            id="qf-preparo-panel-historico"
            role="tabpanel"
            aria-labelledby="qf-preparo-tab-historico"
            className={activeTab === 'historico' ? 'block w-full' : 'hidden'}
          >
            <HistoricoEmDesenvolvimento initialYear={initialYear} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default PreparoDetail;
