import React from 'react';

const COASidebar = ({ isOpen, onClose, onNavigate }) => {
  const menuItems = ["Operações", "Motor Ocioso", "Horas de Corte", "Velocidade"];

  return (
    <>
      {/* Overlay com blur sutil */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}

      {/* Container do Menu em Grafite */}
      <aside className={`fixed top-0 right-0 h-full bg-[#161B22] z-50 shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[20%] border-l border-slate-800`}>
        
        <div className="p-6 border-b border-slate-800 flex justify-between items-center">
          <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Menu COA Center</span>
          <button onClick={onClose} className="text-slate-500 hover:text-emerald-400 transition-colors font-bold text-xl">×</button>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          {menuItems.map((item) => (
            <button
              key={item}
              onClick={() => { onNavigate(item); onClose(); }}
              className="w-full text-left p-4 rounded-xl text-xs font-bold text-slate-400 hover:bg-[#1C2128] hover:text-emerald-400 transition-all active:scale-95 border border-transparent hover:border-slate-700"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default COASidebar;