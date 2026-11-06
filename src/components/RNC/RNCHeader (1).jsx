import React from 'react';
import { useNavigate } from 'react-router-dom';
import rncLogo from '../../gallery/logo/rnc.png';

const RNCHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();

  const goToRNC = () => navigate('/rnc');

  const handleBrandKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToRNC();
    }
  };

  return (
    <header className="rnc-header">
      <div className="rnc-header__inner">
        <div
          className="rnc-header__brand"
          onClick={goToRNC}
          onKeyDown={handleBrandKeyDown}
          role="button"
          tabIndex={0}
          aria-label="Ir para o início do RNC"
        >
          <img src={rncLogo} alt="RNC" className="rnc-header__logo" />

          <div className="rnc-header__brand-text">
            <strong>RNC</strong>
            <span>Não Conformidades</span>
          </div>
        </div>

        <div className="rnc-header__actions">
          <button
            type="button"
            className="rnc-header__button rnc-header__button--ghost"
            onClick={() => navigate('/')}
          >
            Início
          </button>

          <button
            type="button"
            className="rnc-header__button rnc-header__button--login"
            onClick={() => navigate('/rnc/login')}
          >
            Entrar
          </button>

          <button
            type="button"
            className="rnc-header__menu"
            onClick={onMenuOpen}
            aria-label="Abrir menu do RNC"
          >
            ☰
          </button>
        </div>
      </div>
    </header>
  );
};

export default RNCHeader;
