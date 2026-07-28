import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const SidebarAgroTools = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const location = useLocation(); // Para sabermos qual rota está ativa

  // Menu plano e direto ao ponto
  const menuItems = [
    { label: 'Home', path: '/agrotools' },
    { label: 'Perdas', path: '/agrotools/perdas' },
    { label: 'Adubação', path: '/agrotools/adubacao' },
    { label: 'CUC Gotejo', path: '/agrotools/cuc' },
    { label: 'Vinhaça', path: '/agrotools/vinhaca' },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Fundo escuro ao abrir o menu */}
      <div className="at-sidebar-backdrop" onClick={onClose} />

      {/* Menu Lateral */}
      <aside className="at-sidebar fade-in-right flex flex-col h-full bg-white shadow-2xl absolute top-0 right-0 w-72 z-50">
        
        {/* TOPO DO MENU */}
        <div className="at-sidebar-top p-5 flex justify-between items-center border-b border-slate-100">
          <div className="at-sidebar-brand flex flex-col">
            <span className="at-sidebar-sub text-[10px] font-bold text-slate-400 uppercase tracking-widest">Navegação</span>
            <span className="at-sidebar-title text-xl font-black text-slate-800 tracking-tight">AgroTools</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="at-sidebar-close text-3xl font-light text-slate-400 hover:text-red-500 transition-colors"
            aria-label="Fechar menu"
          >
            &times;
          </button>
        </div>

        {/* ITENS DO MENU (FLAT) */}
        <nav className="at-sidebar-nav flex-1 p-4 overflow-y-auto no-scrollbar flex flex-col gap-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavigation(item.path)}
                className={`at-menu-item-simple ${isActive ? 'active' : ''}`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* RODAPÉ DO MENU */}
        <div className="at-sidebar-footer p-5 border-t border-slate-100 bg-slate-50">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Módulo Operacional</span>
            <span className="text-xs font-bold text-slate-600">AgroTools • AgroTarget</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default SidebarAgroTools;