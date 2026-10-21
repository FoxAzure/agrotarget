// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHome
// Purpose: Container principal do Gerenciador da Equipe de Qualidade Agricola.
// Relationships: EquipeHomeDash, EquipeHomeMetas, EquipeHomeCoberta, qualyflow.png
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './EquipeHome.css';

import qualyFlowLogo from '../../gallery/logo/qualyflow.png';
import EquipeHomeDash from './EquipeHomeDash';
import EquipeHomeMetas from './EquipeHomeMetas';
import EquipeHomeCoberta from './EquipeHomeCoberta';

const PAGE_DASH = 'dashboard';
const PAGE_METAS = 'metas';
const PAGE_COBERTA = 'coberta';

const EQUIPE_MODULES = [
  { id: PAGE_DASH, label: 'Dashboard da Equipe', description: 'Acompanhamento diario, semanal, mensal e anual.', number: '01' },
  { id: PAGE_METAS, label: 'Metas e Atividades', description: 'Cadastro, vigencia e administracao das metas da equipe.', number: '02' },
  { id: PAGE_COBERTA, label: 'Cobertura do Plantio', description: 'Acompanhamento da coberta realizada pela equipe.', number: '03' },
];

const EquipeHome = () => {
  const navigate = useNavigate();
  const [activePage, setActivePage] = useState(PAGE_DASH);
  const [isMenuOpen, setMenuOpen] = useState(false);

  const activeModule = useMemo(() => EQUIPE_MODULES.find((module) => module.id === activePage) || EQUIPE_MODULES[0], [activePage]);

  useEffect(() => {
    const handleEscape = (event) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('equipe-menu-is-open', isMenuOpen);
    return () => document.body.classList.remove('equipe-menu-is-open');
  }, [isMenuOpen]);

  const handlePageChange = (pageId) => { if (pageId !== activePage) setActivePage(pageId); setMenuOpen(false); };

  const ActivePage = activePage === PAGE_METAS
    ? EquipeHomeMetas
    : activePage === PAGE_COBERTA
      ? EquipeHomeCoberta
      : EquipeHomeDash;

  return (
    <div className="equipe-home">
      <header className="equipe-app-header">
        <div className="equipe-app-header__identity">
          <div className="equipe-app-header__logo-wrap"><img src={qualyFlowLogo} alt="QualyFlow" className="equipe-app-header__logo" /></div>
          <h1 className="equipe-app-header__title">{activeModule.label}</h1>
        </div>
        <div className="equipe-app-header__actions">
          <button type="button" className="equipe-header-button equipe-header-button--menu" onClick={() => setMenuOpen(true)} aria-label="Abrir navegacao do modulo Equipe" aria-expanded={isMenuOpen}><span aria-hidden="true">☰</span><span className="equipe-header-button__label">Navegacao</span></button>
          <button type="button" className="equipe-header-button equipe-header-button--back" onClick={() => navigate('/qualyflow')}>Voltar</button>
        </div>
      </header>

      <main className="equipe-home__main"><section key={activeModule.id} className="equipe-home__module" aria-label={activeModule.label}><ActivePage /></section></main>
      {isMenuOpen && <button type="button" className="equipe-drawer-backdrop" onClick={() => setMenuOpen(false)} aria-label="Fechar navegacao" />}

      <aside className={`equipe-drawer ${isMenuOpen ? 'is-open' : ''}`} aria-hidden={!isMenuOpen}>
        <div className="equipe-drawer__header"><div><span className="equipe-drawer__overline">Navegacao</span><h2>Equipe</h2></div><button type="button" className="equipe-drawer__close" onClick={() => setMenuOpen(false)} aria-label="Fechar menu">×</button></div>
        <nav className="equipe-drawer__nav" aria-label="Areas da Equipe">
          {EQUIPE_MODULES.map((module) => (
            <button key={module.id} type="button" className={`equipe-drawer__item ${activePage === module.id ? 'is-active' : ''}`} onClick={() => handlePageChange(module.id)} aria-current={activePage === module.id ? 'page' : undefined}>
              <span className="equipe-drawer__item-number">{module.number}</span>
              <span className="equipe-drawer__item-content"><strong>{module.label}</strong><small>{module.description}</small></span>
            </button>
          ))}
        </nav>
        <div className="equipe-drawer__footer"><span>{EQUIPE_MODULES.length}</span>{EQUIPE_MODULES.length === 1 ? ' area disponivel' : ' areas disponiveis'}</div>
      </aside>
    </div>
  );
};

export default EquipeHome;
