// ================================= DOCUMENTATION ------------------------------------------
// Script: PlantioMecDetail
// Purpose: Gerenciador das abas de detalhamento das avaliações do Plantio Mecanizado.
// Tabs:
//   - Diário
//   - Campo
//   - Histórico
// Relationships:
//   - CardPlantioMec
//   - PlantioMecDetailDiario
//   - PlantioMecDetailCampo
//   - PlantioMecDetailHistorico
// Route:
//   - /qualyflow/plantio-mecanizado
// ==========================================================================================

import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';

import HeaderQualyFlow from '../../../components/QualyFlow/HeaderQualyFlow';
import Sidebar from '../../../components/QualyFlow/Sidebar';

import '../Style.css';
import './PlantioMecDetail.css';

// Descomente quando os componentes das abas forem criados:
import PlantioMecDetailDiario from './PlantioMecDetailDiario';
// import PlantioMecDetailCampo from './PlantioMecDetailCampo';
// import PlantioMecDetailHistorico from './PlantioMecDetailHistorico';

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

const normalizeInitialField = (value) => {
  if (value === null || value === undefined) return '';
  return String(value).trim();
};

// ================================= TEMPORARY COMPONENTS -----------------------------------
// Estes placeholders deixam a rota funcional enquanto as três views são desenvolvidas.
// Depois, basta substituir o conteúdo pelo componente correspondente.

const DetailPlaceholder = ({ title, description, meta }) => (
  <section className="qf-plantio-mec-detail-placeholder">
    <strong>{title}</strong>
    <span>{description}</span>
    {meta && <small>{meta}</small>}
  </section>
);

const DiarioEmDesenvolvimento = ({ initialDate }) => (
  <PlantioMecDetailDiario initialDate={initialDate} />
  // Substituir por:
  // <PlantioMecDetailDiario initialDate={initialDate} />
);

const CampoEmDesenvolvimento = ({ initialField }) => (
  <DetailPlaceholder
    title="Visão por campo em desenvolvimento"
    description="Aqui serão consolidados os indicadores, pontos e lotes do campo selecionado."
    meta={initialField ? `Campo inicial: ${initialField}` : 'Selecione um campo'}
  />
  // Substituir por:
  // <PlantioMecDetailCampo initialField={initialField} />
);

const HistoricoEmDesenvolvimento = ({ initialYear }) => (
  <DetailPlaceholder
    title="Histórico em desenvolvimento"
    description="Aqui será exibida a evolução anual das avaliações do Plantio Mecanizado."
    meta={`Ano inicial: ${initialYear}`}
  />
  // Substituir por:
  // <PlantioMecDetailHistorico initialYear={initialYear} />
);

// ================================= COMPONENT ---------------------------------------------

const PlantioMecDetail = () => {
  const location = useLocation();

  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('diario');

  // Recupera os dados enviados pelo CardPlantioMec.
  // No acesso direto à rota, utiliza a data atual e nenhum campo inicial.
  const [initialDate] = useState(() =>
    normalizeInitialDate(location.state?.selectedDate),
  );

  const [initialField] = useState(() =>
    normalizeInitialField(
      location.state?.selectedField ?? location.state?.selectedCampo,
    ),
  );

  const initialYear = Number(initialDate.slice(0, 4));

  const tabs = [
    { id: 'diario', label: 'Diário' },
    { id: 'campo', label: 'Campo' },
    { id: 'historico', label: 'Histórico' },
  ];

  // ================================= TAB BUTTON -------------------------------------------

  const TabButton = ({ id, label }) => {
    const isActive = activeTab === id;

    return (
      <button
        type="button"
        role="tab"
        aria-selected={isActive}
        aria-controls={`qf-plantio-mec-panel-${id}`}
        id={`qf-plantio-mec-tab-${id}`}
        tabIndex={isActive ? 0 : -1}
        onClick={() => setActiveTab(id)}
        className={`qf-plantio-mec-detail-tab ${isActive ? 'is-active' : ''}`}
      >
        <span>{label}</span>
      </button>
    );
  };

  // ================================= KEYBOARD NAVIGATION ---------------------------------

  const handleTabsKeyDown = (event) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;

    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex === currentIndex) return;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    setActiveTab(nextTab.id);

    requestAnimationFrame(() => {
      document.getElementById(`qf-plantio-mec-tab-${nextTab.id}`)?.focus();
    });
  };

  // ================================= RENDER -----------------------------------------------

  return (
    <div className="qf-plantio-mec-detail-page">
      <HeaderQualyFlow onMenuOpen={() => setSidebarOpen(true)} />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <main className="qf-plantio-mec-detail-main">
        <header className="qf-plantio-mec-detail-heading">
          <span>Qualidade Agrícola</span>

          <h1>
            Avaliação <b>Plantio Mecanizado</b>
          </h1>
        </header>

        <nav
          className="qf-plantio-mec-detail-tabs"
          role="tablist"
          aria-label="Detalhamento do Plantio Mecanizado"
          onKeyDown={handleTabsKeyDown}
        >
          {tabs.map((tab) => (
            <TabButton key={tab.id} id={tab.id} label={tab.label} />
          ))}
        </nav>

        {/*
          As abas permanecem montadas no DOM para preservar filtros,
          seleções e dados carregados durante a navegação.
        */}
        <section className="qf-plantio-mec-detail-content">
          <div
            id="qf-plantio-mec-panel-diario"
            role="tabpanel"
            aria-labelledby="qf-plantio-mec-tab-diario"
            hidden={activeTab !== 'diario'}
          >
            <DiarioEmDesenvolvimento initialDate={initialDate} />
          </div>

          <div
            id="qf-plantio-mec-panel-campo"
            role="tabpanel"
            aria-labelledby="qf-plantio-mec-tab-campo"
            hidden={activeTab !== 'campo'}
          >
            <CampoEmDesenvolvimento initialField={initialField} />
          </div>

          <div
            id="qf-plantio-mec-panel-historico"
            role="tabpanel"
            aria-labelledby="qf-plantio-mec-tab-historico"
            hidden={activeTab !== 'historico'}
          >
            <HistoricoEmDesenvolvimento initialYear={initialYear} />
          </div>
        </section>
      </main>
    </div>
  );
};

export default PlantioMecDetail;
