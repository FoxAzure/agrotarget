import React from 'react';
import { useNavigate } from 'react-router-dom';
import coaCenterLogo from '../../gallery/logo/coacenter.png';

const HeaderCOACenter = ({ onMenuOpen, children }) => {
  const navigate = useNavigate();

  return (
    <header className="coa-header">
      <div className="coa-container coa-header__inner">
        <div
          className="coa-header__brand"
          onClick={() => navigate('/coacenter')}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              navigate('/coacenter');
            }
          }}
        >
          <img
            src={coaCenterLogo}
            alt="COA Center"
            className="coa-header__logo"
          />

          <h1 className="coa-header__title uppercase">
            <span className="coa-header__title-highlight">COA</span> CENTER
          </h1>
        </div>

        {children && (
          <div className="hidden md:flex flex-1 justify-center items-center px-4">
            {children}
          </div>
        )}

        <div className="coa-header__actions">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="coa-btn coa-btn--ghost"
          >
            Início
          </button>

          <button
            type="button"
            onClick={onMenuOpen}
            className="coa-btn coa-btn--primary"
          >
            Menu
          </button>
        </div>
      </div>

      {children && (
        <div className="md:hidden w-full border-t" style={{ borderColor: 'var(--coa-divider)' }}>
          <div className="coa-container py-3">
            {children}
          </div>
        </div>
      )}
    </header>
  );
};

export default HeaderCOACenter;