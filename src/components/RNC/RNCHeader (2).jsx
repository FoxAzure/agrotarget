import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import rncLogo from '../../gallery/logo/rnc.png';

const RNCHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();
  const { user, logout } = useRNCAuth();
  const goToRNC = () => navigate('/rnc');

  const handleBrandKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToRNC();
    }
  };

  const handleAuth = () => {
    if (user) {
      logout();
      navigate('/rnc');
    } else {
      navigate('/rnc/login');
    }
  };

  return (
    <header className="rnc-header">
      <div className="rnc-header__inner">
        <div className="rnc-header__brand" onClick={goToRNC} onKeyDown={handleBrandKeyDown} role="button" tabIndex={0} aria-label="Ir para o início do RNC">
          <img src={rncLogo} alt="RNC" className="rnc-header__logo" />
          <div className="rnc-header__brand-text"><strong>RNC</strong><span>Não Conformidades</span></div>
        </div>

        <div className="rnc-header__actions">
          {user && <span className="rnc-header__user">{user.nick}</span>}
          <button type="button" className="rnc-header__button rnc-header__button--ghost" onClick={() => navigate('/')}>Início</button>
          <button type="button" className="rnc-header__button rnc-header__button--login" onClick={handleAuth}>{user ? 'Sair' : 'Entrar'}</button>
          <button type="button" className="rnc-header__menu" onClick={onMenuOpen} aria-label="Abrir menu do RNC">☰</button>
        </div>
      </div>
    </header>
  );
};

export default RNCHeader;
