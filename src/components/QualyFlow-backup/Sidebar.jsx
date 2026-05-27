import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  
  // Estado para controlar qual grupo está aberto (Acordeão)
  const [openGroup, setOpenGroup] = useState(null);

  // Estrutura de dados fácil de alterar e expandir
  const menuGroups = [
    {
      title: "Irrigação",
      items: [
        { label: "CUC Gotejo", path: "/qualyflow/cuc" },
        { label: "Casa de Bomba", path: "/qualyflow/casabomba" },
        { label: "CheckList Gotejo", path: "/qualyflow/checklist" },
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
    // Lógica: se clicar no que já está aberto, fecha. Se for outro, abre ele e fecha o resto.
    setOpenGroup(openGroup === groupTitle ? null : groupTitle);
  };

  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" 
          onClick={onClose} 
        />
      )}

      <aside className={`fixed top-0 right-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[22%] border-l border-slate-100 flex flex-col`}>
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-agro-green uppercase tracking-[0.2em] leading-none">
              QualyFlow
            </span>
          </div>
          <button onClick={onClose} className="text-agro-orange hover:text-red-500 font-bold text-2xl">×</button>
        </div>

        <nav className="p-4 flex flex-col gap-2 overflow-y-auto custom-scrollbar flex-1">
          {menuGroups.map((group) => (
            <div key={group.title} className="flex flex-col gap-1">
              {/* Botão Retrátil (Pastel Green) */}
              <button
                onClick={() => toggleGroup(group.title)}
                className={`w-full flex justify-between items-center p-3 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all
                  ${openGroup === group.title 
                    ? 'bg-emerald-100 text-agro-green border-emerald-200' 
                    : 'bg-emerald-50/60 text-slate-600 border-transparent hover:bg-emerald-50'} 
                  border`}
              >
                {group.title}
                <span className={`transition-transform duration-300 font-bold ${openGroup === group.title ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>

              {/* Sub-itens com animação simples */}
              <div className={`flex flex-col gap-1 overflow-hidden transition-all duration-300 px-1
                ${openGroup === group.title ? 'max-h-60 opacity-100 mt-1 mb-2' : 'max-h-0 opacity-0'}`}>
                {group.items.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => handleNavigation(item.path)}
                    className="w-full text-left p-3 rounded-lg text-xs font-bold text-slate-500 hover:text-agro-green hover:bg-slate-50 transition-all border border-transparent hover:border-slate-100 flex justify-between items-center group"
                  >
                    {item.label}
                    <span className="opacity-0 group-hover:opacity-100 text-[10px]">→</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="p-6 border-t border-slate-100 bg-slate-50/50">
          <div className="flex flex-col gap-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase tracking-[0.2em]">
              Qualidade Agrícola • Agrovale
            </span>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;