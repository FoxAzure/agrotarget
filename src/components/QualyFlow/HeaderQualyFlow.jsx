
import React from 'react';
import { useNavigate } from 'react-router-dom';
import qualyflowLogo from '../../gallery/logo/qualyflow.png';

const HeaderQualyFlow = ({ onMenuOpen, children }) => {
  const navigate = useNavigate();

  const handleBrandKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate('/qualyflow');
    }
  };

  return (
    <header className="qf-header">

      {/* LINHA PRINCIPAL */}
      <div className="qf-header__inner">

        {/* LOGO + NOME */}
        <div
          className="qf-header__brand"
          onClick={() => navigate('/qualyflow')}
          role="button"
          tabIndex={0}
          onKeyDown={handleBrandKeyDown}
        >
          <img
            src={qualyflowLogo}
            alt="QualyFlow"
            className="qf-header__logo"
          />

          <h1 className="qf-header__title">
            Qualy<span>Flow</span>
          </h1>
        </div>

        {/* CONTEÚDO CENTRAL - DESKTOP */}
        {children && (
          <div className="qf-header__center">
            {children}
          </div>
        )}

        {/* AÇÕES */}
        <div className="qf-header__actions">

          <button
            type="button"
            onClick={() => navigate('/')}
            className="qf-btn qf-btn--ghost"
          >
            Início
          </button>

          <button
            type="button"
            onClick={onMenuOpen}
            className="qf-btn qf-btn--menu"
            aria-label="Abrir Menu"
          >
            <span className="qf-menu-icon">☰</span>
          </button>

        </div>

      </div>

      {/* CONTEÚDO MOBILE */}
      {children && (
        <div className="qf-header__mobile-content">
          <div className="qf-container">
            {children}
          </div>
        </div>
      )}

    </header>
  );
};

export default HeaderQualyFlow;