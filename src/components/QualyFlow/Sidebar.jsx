import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const [openGroup, setOpenGroup] = useState(null);

  const menuGroups = [
    {
      title: "Relatórios",
      items: [
        { label: "Dashboards", path: "/qualyflow/dashboard" },
      ]
    },
    {
      title: "Irrigação",
      items: [
        { label: "CUC Gotejo", path: "/qualyflow/cuc" },
        { label: "Casa de Bomba", path: "/qualyflow/casabomba" },
        { label: "CheckList Gotejo", path: "/qualyflow/checklist" },
        { label: "Avaliação Hidroroll", path: "/qualyflow/hidroroll" },
      ]
    },
    {
      title: "Preparo",
      items: [
        { label: "Preparo de Solo", path: "/qualyflow/preparo" },
        { label: "Adubação Sulcamento", path: "/qualyflow/adubsulc" },
        { label: "Aplicação Composto", path: "/qualyflow/composto" },
      ]
    },
    {
      title: "Plantio",
      items: [
        { label: "Semente Mecanizada", path: "/qualyflow/semente" },
        { label: "Plantio Mecanizado", path: "/qualyflow/plantiomec" },
        { label: "Plantio Manual", path: "/qualyflow/plantioman" },
      ]
    },
    {
      title: "Colheita",
      items: [
        { label: "Perdas Mecanizada", path: "/qualyflow/perdasmec" },
      ]
    },
    {
      title: "Tratos Culturais",
      items: [
        { label: "Avaliação Drone", path: "/qualyflow/drone" },
        { label: "Adubação Cobertura", path: "/qualyflow/adubcob" },
      ]
    }
  ];

  const handleNavigation = (path) => {
    navigate(path);
    onClose(); 
  };

  const toggleGroup = (groupTitle) => {
    setOpenGroup(openGroup === groupTitle ? null : groupTitle);
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity" 
          onClick={onClose} 
        />
      )}

      <aside className={`fixed top-0 right-0 h-full bg-white z-[60] shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[320px] border-l border-slate-200 flex flex-col font-sans`}>
        
        {/* Topo do Sidebar */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-[var(--q-bg)]">
          <div className="flex flex-col">
            <span className="text-[14px] font-black uppercase tracking-[0.1em] text-[var(--q-green)] leading-none">
              Qualy<span className="text-[var(--q-orange)]">Flow</span>
            </span>
          </div>
          <button onClick={onClose} className="text-[var(--q-gray)] hover:text-[var(--q-danger)] font-bold text-3xl transition-colors leading-none mb-1">
            ×
          </button>
        </div>

        {/* Menu Acordeão */}
        <nav className="p-4 flex flex-col gap-3 overflow-y-auto no-scrollbar flex-1">
          {menuGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              {/* Botão Retrátil Poderoso */}
              <button
                onClick={() => toggleGroup(group.title)}
                className={`w-full flex justify-between items-center p-3.5 rounded-xl text-[12px] font-black uppercase tracking-wider transition-all
                  ${openGroup === group.title 
                    ? 'bg-[var(--q-green)] text-white shadow-md' 
                    : 'bg-white text-[var(--q-dark)] border border-slate-200 hover:border-[var(--q-green)]'}`}
              >
                {group.title}
                <span className={`transition-transform duration-300 font-bold ${openGroup === group.title ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Sub-itens com Animação */}
              <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300
                ${openGroup === group.title ? 'max-h-60 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleNavigation(item.path)}
                    className="w-full text-left py-3 px-4 rounded-lg text-xs font-bold text-[var(--q-gray)] hover:text-[var(--q-orange)] hover:bg-[var(--q-bg)] transition-all flex justify-between items-center group"
                  >
                    {item.label}
                    <span className="opacity-0 group-hover:opacity-100 text-[10px] text-[var(--q-orange)] transform group-hover:translate-x-1 transition-all">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        {/* Rodapé do Sidebar */}
        <div className="p-6 border-t border-slate-100 bg-[var(--q-bg)]">
          <div className="flex flex-col gap-1 text-center">
            <span className="text-micro text-[var(--q-gray)]">
              Qualidade Agrícola
            </span>
            <span className="text-[10px] font-bold text-[var(--q-dark)]">Agrovale</span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;