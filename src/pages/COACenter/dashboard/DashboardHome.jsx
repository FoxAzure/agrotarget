// ================================= DOCUMENTATION ------------------------------------------
// Script: DashboardHome
// Purpose: Container fullscreen com motor de playlist dos dashboards do COA Center.
// Relationships:
//   - BoletimDiario
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './DashboardHome.css';

// Dashboards modulares
import BoletimDiario from './BoletimDiario';
import DashMotorOcioso from './DashMotorOcioso'
import DashSemApontamento from './DashSemApontamento'
import BoletimSemanal from './BoletimSemanal'

// Lista central dos dashboards disponíveis.
// Para incluir um novo dashboard, importe o componente e adicione um item neste array.
const DASH_MODULES = [
  {
    id: 'boletim-diario',
    name: 'Boletim Diário',
    description: 'Visão geral dos indicadores e equipamentos',
    component: <BoletimDiario />,
  },
  {
    id: 'motor-ocioso',
    name: 'Motor Ocioso',
    description: 'Visão geral dos indicadores e equipamentos',
    component: <DashMotorOcioso />,
  },
  {
    id: 'sem-apontamento',
    name: 'Sem Apontamento',
    description: 'Visão geral dos indicadores e equipamentos',
    component: <DashSemApontamento />,
  },
  {
    id: 'boletim-semanal',
    name: 'Boletim Semanal',
    description: 'Visão geral dos indicadores e equipamentos',
    component: <BoletimSemanal />,
  },
];

const TIME_OPTIONS = [
  { label: '30 seg', value: 30 },
  { label: '1 min', value: 60 },
  { label: '2 min', value: 120 },
  { label: '5 min', value: 300 },
  { label: '15 min', value: 900 },
  { label: '1 hora', value: 3600 },
];

const DashboardHomeCOA = () => {
  const navigate = useNavigate();

  const [activeDash, setActiveDash] = useState(DASH_MODULES[0].id);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [playlist, setPlaylist] = useState(DASH_MODULES.map((module) => module.id));
  const [intervalSecs, setIntervalSecs] = useState(30);

  const currentDashInfo = useMemo(
    () => DASH_MODULES.find((module) => module.id === activeDash) || DASH_MODULES[0],
    [activeDash]
  );

  useEffect(() => {
    if (!isPlaying || playlist.length === 0) return undefined;

    const timer = window.setInterval(() => {
      setActiveDash((currentId) => {
        const currentPosition = playlist.indexOf(currentId);
        const nextPosition = currentPosition >= 0
          ? (currentPosition + 1) % playlist.length
          : 0;

        return playlist[nextPosition];
      });
    }, intervalSecs * 1000);

    return () => window.clearInterval(timer);
  }, [isPlaying, playlist, intervalSecs]);

  useEffect(() => {
    if (isPlaying && playlist.length === 0) {
      setIsPlaying(false);
    }
  }, [isPlaying, playlist]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setSidebarOpen(false);
      setModalOpen(false);
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  const handleManualNav = (id) => {
    setIsPlaying(false);
    setActiveDash(id);
    setSidebarOpen(false);
  };

  const handlePlaylistAction = () => {
    if (isPlaying) {
      setIsPlaying(false);
      return;
    }

    setModalOpen(true);
  };

  const startPlaylist = () => {
    if (playlist.length === 0) return;

    if (!playlist.includes(activeDash)) {
      setActiveDash(playlist[0]);
    }

    setIsPlaying(true);
    setModalOpen(false);
  };

  const toggleDashInPlaylist = (id) => {
    setPlaylist((previous) => (
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    ));
  };

  return (
    <div className="coa-dash-layout coa-theme">
      <header className="coa-dash-header">
        <div className="coa-dash-header__identity">
          <span className="coa-text-overline">COA Center</span>
          <div className="coa-dash-header__title-row">
            <h1 className="coa-dash-header__title">{currentDashInfo.name}</h1>
            {isPlaying && (
              <span className="coa-dash-live" title="Playlist em execução">
                <span className="coa-dash-live__dot" />
                Playlist ativa
              </span>
            )}
          </div>
          <p className="coa-dash-header__description">
            {currentDashInfo.description}
          </p>
        </div>

        <div className="coa-dash-header__actions">
          <button
            type="button"
            className={`coa-btn ${isPlaying ? 'coa-dash-btn--stop' : 'coa-btn--ghost'}`}
            onClick={handlePlaylistAction}
          >
            {isPlaying ? 'Parar playlist' : 'Playlist'}
          </button>

          <button
            type="button"
            className="coa-btn coa-btn--ghost coa-dash-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir lista de dashboards"
          >
            <span aria-hidden="true">☰</span>
            <span className="coa-dash-menu-button__label">Dashboards</span>
          </button>

          <button
            type="button"
            className="coa-btn coa-dash-back-button"
            onClick={() => navigate('/coacenter')}
          >
            Voltar
          </button>
        </div>
      </header>

      <main className="coa-dash-content">
        {DASH_MODULES.map((module) => (
          <section
            key={module.id}
            className={`coa-dash-module ${activeDash === module.id ? 'is-active' : ''}`}
            aria-hidden={activeDash !== module.id}
          >
            {module.component}
          </section>
        ))}
      </main>

      {isSidebarOpen && (
        <button
          type="button"
          className="coa-dash-overlay"
          aria-label="Fechar lista de dashboards"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`coa-dash-sidebar ${isSidebarOpen ? 'is-open' : ''}`}>
        <div className="coa-dash-sidebar__header">
          <div>
            <span className="coa-text-overline">Navegação</span>
            <h2 className="coa-dash-sidebar__title">Dashboards</h2>
          </div>

          <button
            type="button"
            className="coa-dash-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="coa-dash-sidebar__nav">
          {DASH_MODULES.map((module, index) => (
            <button
              key={module.id}
              type="button"
              className={`coa-dash-nav-item ${activeDash === module.id ? 'is-active' : ''}`}
              onClick={() => handleManualNav(module.id)}
            >
              <span className="coa-dash-nav-item__number">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="coa-dash-nav-item__content">
                <strong>{module.name}</strong>
                <small>{module.description}</small>
              </span>
            </button>
          ))}
        </nav>

        <div className="coa-dash-sidebar__footer">
          <span>{DASH_MODULES.length}</span>
          {DASH_MODULES.length === 1 ? ' dashboard disponível' : ' dashboards disponíveis'}
        </div>
      </aside>

      {isModalOpen && (
        <div
          className="coa-dash-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setModalOpen(false);
          }}
        >
          <div
            className="coa-dash-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="playlist-title"
          >
            <div className="coa-dash-modal__header">
              <div>
                <span className="coa-text-overline">Exibição automática</span>
                <h2 id="playlist-title">Configurar playlist</h2>
              </div>

              <button
                type="button"
                className="coa-dash-close"
                onClick={() => setModalOpen(false)}
                aria-label="Fechar configurações da playlist"
              >
                ×
              </button>
            </div>

            <div className="coa-dash-modal__body">
              <div className="coa-dash-fieldset">
                <span className="coa-dash-fieldset__label">Tempo por dashboard</span>
                <div className="coa-dash-time-grid">
                  {TIME_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`coa-dash-time-option ${intervalSecs === option.value ? 'is-active' : ''}`}
                      onClick={() => setIntervalSecs(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="coa-dash-fieldset">
                <span className="coa-dash-fieldset__label">Dashboards incluídos</span>
                <div className="coa-dash-playlist-list">
                  {DASH_MODULES.map((module) => (
                    <label key={module.id} className="coa-dash-check-option">
                      <input
                        type="checkbox"
                        checked={playlist.includes(module.id)}
                        onChange={() => toggleDashInPlaylist(module.id)}
                      />
                      <span className="coa-dash-check-option__control" aria-hidden="true" />
                      <span className="coa-dash-check-option__text">
                        <strong>{module.name}</strong>
                        <small>{module.description}</small>
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {playlist.length === 0 && (
                <p className="coa-dash-modal__warning">
                  Selecione ao menos um dashboard para iniciar a playlist.
                </p>
              )}
            </div>

            <div className="coa-dash-modal__footer">
              <button
                type="button"
                className="coa-btn coa-btn--ghost"
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="coa-btn coa-btn--primary"
                onClick={startPlaylist}
                disabled={playlist.length === 0}
              >
                Iniciar playlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardHomeCOA;
