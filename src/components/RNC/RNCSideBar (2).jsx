import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useRNCAuth } from '../../lib/RNCAuthContext';
import rncLogo from '../../gallery/logo/rnc.png';

const RNCSideBar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin } = useRNCAuth();

  const menuItems = [
    { label: 'RNC - Não Conformidade', path: '/rnc', visible: true },
    { label: 'Plano de Ação', path: '/rnc/plano-acao', visible: Boolean(user) },
    { label: 'Acompanhamento', path: '/rnc/acompanhamento', visible: Boolean(user) },
    { label: 'Gerenciar Usuários', path: '/rnc/usuarios', visible: isAdmin },
  ];

  useEffect(() => {
    if (!isOpen) return undefined;
    const handleEscape = (event) => { if (event.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleNavigation = (path) => { navigate(path); onClose?.(); };
  const handleAuth = () => {
    if (user) logout();
    handleNavigation(user ? '/rnc' : '/rnc/login');
  };

  return (
    <>
      <div className={`rnc-sidebar-overlay ${isOpen ? 'is-open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`rnc-sidebar ${isOpen ? 'is-open' : ''}`} aria-label="Menu do RNC" aria-hidden={!isOpen}>
        <div className="rnc-sidebar__head">
          <button type="button" className="rnc-sidebar__brand" onClick={() => handleNavigation('/rnc')}>
            <img src={rncLogo} alt="RNC" />
            <span><strong>RNC</strong><small>{user ? `${user.nick} · ${user.nivel}` : 'Não Conformidades'}</small></span>
          </button>
          <button type="button" className="rnc-sidebar__close" onClick={onClose} aria-label="Fechar menu">×</button>
        </div>

        <nav className="rnc-sidebar__nav">
          {menuItems.filter((item) => item.visible).map((item) => (
            <button type="button" key={item.path} className={`rnc-sidebar__item ${location.pathname === item.path ? 'is-active' : ''}`} onClick={() => handleNavigation(item.path)}>
              <span>{item.label}</span><b>→</b>
            </button>
          ))}
        </nav>

        <div className="rnc-sidebar__footer">
          <button type="button" onClick={handleAuth}>{user ? 'Sair' : 'Entrar'}</button>
          <small>Qualidade Agrícola · Agrovale</small>
        </div>
      </aside>
    </>
  );
};

export default RNCSideBar;
