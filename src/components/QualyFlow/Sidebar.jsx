import React from 'react';

const Sidebar = ({ isOpen, onClose, onNavigate }) => {
  const menuItems = ["Preparo", "Plantio", "Semente", "Irrigação", "Tratos", "Colheita"];

  return (
    <>
      {/* Overlay para fechar ao clicar fora */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      )}

      {/* Container do Menu */}
      <aside className={`fixed top-0 right-0 h-full bg-white z-50 shadow-2xl transition-transform duration-300 transform 
        ${isOpen ? 'translate-x-0' : 'translate-x-full'} 
        w-[80%] md:w-[20%]`}>
        
        <div className="p-6 border-b border-slate-100 flex justify-between items-center">
          <span className="text-[10px] font-black text-agro-green uppercase tracking-widest">Menu QualyFlow</span>
          <button onClick={onClose} className="text-agro-orange font-bold text-xl">×</button>
        </div>

        <nav className="p-4 flex flex-col gap-2">
          {menuItems.map((item) => (
            <button
              key={item}
              onClick={() => { onNavigate(item); onClose(); }}
              className="w-full text-left p-4 rounded-xl text-xs font-bold text-slate-600 hover:bg-agro-green/5 hover:text-agro-green transition-all active:scale-95"
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>
    </>
  );
};

export default Sidebar;