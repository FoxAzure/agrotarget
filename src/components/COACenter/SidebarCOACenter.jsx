import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const SidebarCOACenter = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState('Painéis');

  const menuGroups = [
    {
      title: 'Painéis',
      items: [
        { label: 'Home', path: '/coacenter' },
        { label: 'Operações', path: '/coacenter/operacoes' },
        { label: 'Detalhe', path: '/coacenter/detalhe' },
        { label: 'Comboio', path: '/coacenter/comboio' },
      ],
    },
    {
      title: 'Indicadores',
      items: [
        { label: 'Motor Ocioso', path: '/coacenter/motorocioso' },
        { label: 'Auditoria de Dados', path: '/coacenter/audit' },
      ],
    },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    onClose?.();
  };

  const toggleGroup = (groupTitle) => {
    setOpenGroup((prev) => (prev === groupTitle ? null : groupTitle));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="coa-sidebar-backdrop" onClick={onClose} />

      <aside className="coa-sidebar coa-fade-in">
        <div className="coa-sidebar__top">
          <div className="coa-sidebar__brand">
            <span className="coa-sidebar__sub">Navegação</span>
            <span className="coa-sidebar__title">COA Center</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="coa-btn coa-sidebar__close"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <nav className="coa-sidebar__nav coa-no-scrollbar">
          {menuGroups.map((group) => {
            const isOpenGroup = openGroup === group.title;

            return (
              <div key={group.title} className="coa-menu-group">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  className={`coa-btn coa-menu-group__button ${isOpenGroup ? 'is-open' : ''}`}
                >
                  <span>{group.title}</span>
                  <span className="coa-menu-group__chevron">▾</span>
                </button>

                {isOpenGroup && (
                  <div className="coa-menu-group__items">
                    {group.items.map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        onClick={() => handleNavigation(item.path)}
                        className="coa-btn coa-menu-item"
                      >
                        <span>{item.label}</span>
                        <span>→</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="coa-sidebar__footer">
          <div className="flex flex-col gap-1">
            <span className="coa-text-micro">Módulo Operacional</span>
            <span className="coa-text-subtitle">COA Center • AgroTarget</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SidebarCOACenter;