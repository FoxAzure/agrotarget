import React from 'react';
import { useNavigate } from 'react-router-dom';

const COASidebar = ({ isOpen, onClose }) => {
  const navigate = useNavigate();

  // Mapeamento de rótulos para suas rotas específicas
  const menuItems = [
    { label: "Operações", path: "/coacenter/operacoes" },
    { label: "Motor Ocioso", path: "/coacenter/motorocioso" },
    { label: "Comboios", path: "/coacenter/comboio" },
    //{ label: "Horas de Corte", path: "/coacenter/horascorte" },
    //{ label: "Velocidade", path: "/coacenter/velocidade" },
  ];

  const handleNavigation = (path) => {
    navigate(path);
    onClose(); // Fecha a barra lateral após clicar
  };

  return (
    <>
      {/* Overlay com blur sutil */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" 
          onClick={onClose} 
        />
      )}

      {/* Container do Menu em Grafite */}
      <aside className={`fixed top-0 right-0 h-full bg-[#161B22] z-50 shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[20%] border-l border-slate-800 flex flex-col`}>
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-[#11151D]">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">
            COA Center
          </span>
          <button 
            onClick={onClose} 
            className="text-slate-500 hover:text-red-400 transition-colors font-bold text-xl"
          >
            ×
          </button>
        </div>

        <nav className="p-4 flex flex-col gap-2 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavigation(item.path)}
              className="w-full text-left p-3 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1C2128] hover:text-emerald-400 transition-all active:scale-95 border border-transparent hover:border-slate-700 group flex justify-between items-center"
            >
              {item.label}
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-emerald-500">→</span>
            </button>
          ))}
        </nav>

        {/* Rodapé do Menu */}
        <div className="mt-auto p-6 border-t border-slate-800 bg-[#11151D]/50">
          <span className="text-[8px] font-bold text-slate-600 uppercase tracking-[0.2em]">
            COA • Agrovale
          </span>
        </div>
      </aside>
    </>
  );
};

export default COASidebar;