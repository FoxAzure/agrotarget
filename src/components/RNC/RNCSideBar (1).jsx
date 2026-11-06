import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import rncLogo from '../../gallery/logo/rnc.png';

const MENU_ITEMS = [
  { label: 'RNC - Não Conformidade', path: '/rnc' },
  { label: 'Plano de Ação', path: '/rnc/plano-acao' },
  { label: 'Acompanhamento', path: '/rnc/acompanhamento' },
];

const RNCSideBar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose?.();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleNavigation = (path) => {
    navigate(path);
    onClose?.();
  };

  return (
    <>
      <div
        className={`rnc-sidebar-overlay ${isOpen ? 'is-open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={`rnc-sidebar ${isOpen ? 'is-open' : ''}`}
        aria-label="Menu do RNC"
        aria-hidden={!isOpen}
      >
        <div className="rnc-sidebar__head">
          <button
            type="button"
            className="rnc-sidebar__brand"
            onClick={() => handleNavigation('/rnc')}
          >
            <img src={rncLogo} alt="RNC" />
            <span>
              <strong>RNC</strong>
              <small>Não Conformidades</small>
            </span>
          </button>

          <button
            type="button"
            className="rnc-sidebar__close"
            onClick={onClose}
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="rnc-sidebar__nav">
          {MENU_ITEMS.map((item) => {
            const active = location.pathname === item.path;

            return (
              <button
                type="button"
                key={item.path}
                className={`rnc-sidebar__item ${active ? 'is-active' : ''}`}
                onClick={() => handleNavigation(item.path)}
              >
                <span>{item.label}</span>
                <b>→</b>
              </button>
            );
          })}
        </nav>

        <div className="rnc-sidebar__footer">
          <button type="button" onClick={() => handleNavigation('/rnc/login')}>
            Entrar
          </button>
          <small>Qualidade Agrícola · Agrovale</small>
        </div>
      </aside>
    </>
  );
};

export default RNCSideBar;
