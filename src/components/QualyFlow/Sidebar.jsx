import React from 'react';
import { useNavigate } from 'react-router-dom';

const Sidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Lógica do COA: Mapeamento de rótulos para rotas específicas
  const menuItems = [
    { label: "CUC Gotejo", path: "/qualyflow/cuc" },//ok
    { label: "Casa de Bomba", path: "/qualyflow/casabomba" },
    { label: "CheckList Gotejo", path: "/qualyflow/checklist" },
    { label: "Preparo de Solo", path: "/qualyflow/preparo" },//ok
    { label: "Adubação Sulcamento", path: "/qualyflow/adubsulc" },
    { label: "Aplicação Composto", path: "/qualyflow/composto" },
    { label: "Semente Mecanizada", path: "/qualyflow/semente" },
    { label: "Plantio Mecanizado", path: "/qualyflow/plantiomec" },
    { label: "Plantio Manual", path: "/qualyflow/plantioman" },
    { label: "Avaliação Drone", path: "/qualyflow/drone" },//ok
    { label: "Adubação Cobertura", path: "/qualyflow/adubcob" },
  ];


  const handleNavigation = (path) => {
    navigate(path);
    onClose(); // Fecha a barra lateral após clicar
  };

  return (
    <>
      {/* Overlay: Mantendo o blur sutil do QualyFlow */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" 
          onClick={onClose} 
        />
      )}

      {/* Container do Menu: CSS Light do QualyFlow (bg-white) */}
      <aside className={`fixed top-0 right-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[20%] border-l border-slate-100 flex flex-col`}>
        
        {/* Header: Cores do QualyFlow */}
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[10px] font-black text-agro-green uppercase tracking-widest leading-none">
              QualyFlow
            </span>
          </div>
          <button 
            onClick={onClose} 
            className="text-agro-orange hover:text-red-500 transition-colors font-bold text-2xl"
          >
            ×
          </button>
        </div>

        {/* Navegação: Lógica de mapeamento com Estilo Light */}
        <nav className="p-4 flex flex-col gap-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.path)}
              className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-agro-green/5 hover:text-agro-green transition-all active:scale-95 border border-transparent hover:border-agro-green/10 group flex justify-between items-center"
            >
              {item.label}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-agro-green">→</span>
            </button>
          ))}
        </nav>

        {/* Rodapé: Identidade Agrovale no padrão light */}
        <div className="mt-auto p-6 border-t border-slate-100 bg-slate-50/50">
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