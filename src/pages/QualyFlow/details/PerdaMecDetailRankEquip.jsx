// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRankEquip
// Purpose: Modal para exibir o detalhamento/histórico da colhedora selecionada no Ranking.
// ==========================================================================================

import React from 'react';

const PerdaMecDetailRankEquip = ({ colhedora, ano, onClose }) => {
  if (!colhedora) return null;

  return (
    <div 
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div className="flex flex-col pr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Histórico da Máquina</span>
            <h3 className="text-lg font-black text-[var(--q-dark)] uppercase leading-tight">
              {colhedora.shortName}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 mt-1 line-clamp-1">{colhedora.fullName}</span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-8 flex flex-col items-center justify-center gap-4 text-center bg-slate-50/30">
          <span className="text-5xl grayscale opacity-50">📖</span>
          <p className="text-xs font-bold text-slate-500">
            Histórico da colhedora <strong className="text-[var(--q-dark)]">{colhedora.shortName}</strong> para a safra <strong className="text-[var(--q-orange)]">{ano}</strong> em desenvolvimento.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PerdaMecDetailRankEquip;