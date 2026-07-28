import React from 'react';
import { useNavigate } from 'react-router-dom';
import agroToolsLogo from '../../gallery/logo/agrotools.png';

const HeaderAgroTools = ({ onMenuOpen, children }) => {
  const navigate = useNavigate();

  return (
    <header className="at-header">
      <div className="at-container at-header__inner">
        <div
          className="at-header__brand"
          onClick={() => navigate('/agrotools')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate('/agrotools');
            }
          }}
        >
          <img
            src={agroToolsLogo}
            alt="AgroTools"
            className="at-header__logo"
          />

          <h1 className="at-header__title uppercase">
            Agro<span className="at-header__title-highlight">Tools</span>
          </h1>
        </div>

        {children && (
          <div className="hidden md:flex flex-1 justify-center items-center px-4">
            {children}
          </div>
        )}

        <div className="at-header__actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="at-btn at-btn--ghost"
          >
            Início
          </button>

          <button
            type="button"
            onClick={onMenuOpen}
            className="at-btn at-btn--primary"
          >
            Menu
          </button>
        </div>
      </div>

      {children && (
        <div className="md:hidden w-full border-t" style={{ borderColor: 'var(--at-border)' }}>
          <div className="at-container py-3">
            {children}
          </div>
        </div>
      )}
    </header>
  );
};

export default HeaderAgroTools;