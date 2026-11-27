import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import rncLogo from '../../gallery/logo/rnc.png';

const RNCHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useRNCAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef(null);

  const goToRNC = () => navigate('/rnc');

  const handleBrandKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      goToRNC();
    }
  };

  const handleAuth = () => {
    setIsProfileOpen(false);

    if (user) {
      logout();
      navigate('/rnc');
      return;
    }

    navigate('/rnc/login');
  };

  useEffect(() => {
    if (!isProfileOpen) return undefined;

    const handleOutsideClick = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setIsProfileOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') setIsProfileOpen(false);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isProfileOpen]);

  const userInitial = user?.nick?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <>
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
            {user && (
              <div
                ref={profileRef}
                className={`rnc-header__profile ${isProfileOpen ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className="rnc-header__profile-trigger"
                  onClick={() => setIsProfileOpen((current) => !current)}
                  aria-label={`Exibir informações de ${user.nick}`}
                  aria-expanded={isProfileOpen}
                  aria-haspopup="true"
                >
                  <span className="rnc-header__avatar" aria-hidden="true">
                    {userInitial}
                  </span>

                  <span className="rnc-header__profile-text">
                    <strong>{user.nick}</strong>
                    {isAdmin && <small>{user.nivel}</small>}
                  </span>
                </button>

                <div className="rnc-header__profile-popover" role="tooltip">
                  <span className="rnc-header__profile-popover-arrow" aria-hidden="true" />
                  <small>Usuário conectado</small>
                  <strong>{user.nick}</strong>
                  {isAdmin && <span>{user.nivel}</span>}
                </div>
              </div>
            )}

            <div className="rnc-header__buttons">
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
                onClick={handleAuth}
              >
                {user ? 'Sair' : 'Entrar'}
              </button>

              <button
                type="button"
                className="rnc-header__menu"
                onClick={onMenuOpen}
                aria-label="Abrir menu do RNC"
              >
                <span aria-hidden="true">☰</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <style>{`
        .rnc-header__actions,
        .rnc-header__buttons {
          display: flex;
          align-items: center;
        }

        .rnc-header__actions {
          min-width: 0;
          gap: 18px;
        }

        .rnc-header__buttons {
          gap: 10px;
        }

        .rnc-header__profile {
          position: relative;
          min-width: 0;
        }

        .rnc-header__profile-trigger {
          display: flex;
          align-items: center;
          gap: 10px;
          max-width: 250px;
          padding: 4px 18px 4px 4px;
          border: 0;
          border-right: 1px solid rgba(15, 23, 42, 0.12);
          border-radius: 999px 0 0 999px;
          color: inherit;
          background: transparent;
          cursor: pointer;
          font: inherit;
          text-align: left;
        }

        .rnc-header__profile-trigger:focus-visible {
          outline: 3px solid rgba(0, 47, 142, 0.2);
          outline-offset: 3px;
        }

        .rnc-header__avatar {
          width: 40px;
          height: 40px;
          flex: 0 0 40px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          color: #ffffff;
          background: #002f8e;
          box-shadow: 0 4px 10px rgba(0, 47, 142, 0.2);
          font-size: 0.95rem;
          font-weight: 800;
        }

        .rnc-header__profile-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
          line-height: 1.15;
        }

        .rnc-header__profile-text strong {
          overflow: hidden;
          color: inherit;
          font-size: 0.86rem;
          font-weight: 700;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .rnc-header__profile-text small {
          margin-top: 3px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .rnc-header__profile-popover {
          position: absolute;
          top: calc(100% + 13px);
          right: 12px;
          z-index: 60;
          width: max-content;
          min-width: 190px;
          max-width: min(280px, calc(100vw - 24px));
          padding: 14px 16px;
          border: 1px solid rgba(0, 47, 142, 0.13);
          border-radius: 14px;
          color: #1e293b;
          background: #ffffff;
          box-shadow: 0 14px 34px rgba(15, 23, 42, 0.16);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-5px);
          transition: opacity 150ms ease, transform 150ms ease, visibility 150ms ease;
          pointer-events: none;
        }

        .rnc-header__profile-popover-arrow {
          position: absolute;
          top: -7px;
          right: 17px;
          width: 13px;
          height: 13px;
          border-top: 1px solid rgba(0, 47, 142, 0.13);
          border-left: 1px solid rgba(0, 47, 142, 0.13);
          background: #ffffff;
          transform: rotate(45deg);
        }

        .rnc-header__profile-popover small,
        .rnc-header__profile-popover strong,
        .rnc-header__profile-popover > span:not(.rnc-header__profile-popover-arrow) {
          display: block;
        }

        .rnc-header__profile-popover small {
          margin-bottom: 5px;
          color: #64748b;
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
        }

        .rnc-header__profile-popover strong {
          overflow-wrap: anywhere;
          color: #002f8e;
          font-size: 0.9rem;
          line-height: 1.3;
        }

        .rnc-header__profile-popover > span:not(.rnc-header__profile-popover-arrow) {
          margin-top: 5px;
          color: #64748b;
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: capitalize;
        }

        .rnc-header__profile.is-open .rnc-header__profile-popover,
        .rnc-header__profile:hover .rnc-header__profile-popover,
        .rnc-header__profile:focus-within .rnc-header__profile-popover {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
          pointer-events: auto;
        }

        @media (max-width: 760px) {
          .rnc-header__actions {
            gap: 12px;
          }

          .rnc-header__buttons {
            gap: 10px;
          }

          .rnc-header__profile-trigger {
            max-width: none;
            padding: 0;
            border-right: 0;
            border-radius: 50%;
          }

          .rnc-header__profile-text {
            display: none;
          }

          .rnc-header__avatar {
            width: 44px;
            height: 44px;
            flex-basis: 44px;
            font-size: 1.12rem;
          }

          .rnc-header__profile-popover {
            right: -8px;
          }

          .rnc-header__profile-popover-arrow {
            right: 22px;
          }

          .rnc-header__button,
          .rnc-header__menu {
            min-height: 46px;
          }

          .rnc-header__menu {
            width: 50px;
            min-width: 50px;
          }

          .rnc-header__button--ghost {
            display: none;
          }
        }

        @media (max-width: 430px) {
          .rnc-header__actions,
          .rnc-header__buttons {
            gap: 8px;
          }

          .rnc-header__avatar {
            width: 40px;
            height: 40px;
            flex-basis: 40px;
          }

          .rnc-header__button {
            min-width: 66px;
            padding-inline: 12px;
          }

          .rnc-header__menu {
            width: 48px;
            min-width: 48px;
          }
        }
      `}</style>
    </>
  );
};

export default RNCHeader;
