// ================================= DOCUMENTATION ------------------------------------------
// Script: PerdaMecDetailRankEquipCampo
// Purpose: Modal base para exibir os detalhes do campo de uma colhedora selecionada.
// ==========================================================================================

import React from 'react';

const PerdaMecDetailRankEquipCampo = ({ campoNome, dataApontamento, colhedora, turno, ano, onClose }) => {
  if (!campoNome || !colhedora) return null;

  return (
    <div 
      className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in zoom-in-95 duration-200" 
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" 
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-slate-100 flex justify-between items-start bg-slate-50">
          <div className="flex flex-col pr-4">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detalhe do Campo</span>
            <h3 className="text-lg font-black text-[var(--q-dark)] uppercase leading-tight">
              {campoNome}
            </h3>
            <span className="text-[9px] font-bold text-slate-400 mt-1 line-clamp-1">{colhedora.shortName} | {turno}</span>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-full bg-slate-200 text-slate-500 hover:bg-red-100 hover:text-red-500 font-bold transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="p-8 flex flex-col items-center justify-center gap-4 text-center bg-slate-50/30">
          <span className="text-5xl grayscale opacity-50">🌱</span>
          <p className="text-xs font-bold text-slate-500">
            Dados do campo <strong className="text-[var(--q-dark)]">{campoNome}</strong> avaliado em <strong className="text-[var(--q-orange)]">{dataApontamento}</strong>.
          </p>
          
          {/* Debugzinho maroto pra você conferir se tudo chegou bem */}
          <div className="bg-slate-100 p-3 rounded-lg text-[10px] text-slate-600 font-mono w-full mt-4 text-left border border-slate-200 shadow-inner">
            <span className="block font-black text-slate-400 mb-1 uppercase">Props Recebidas:</span>
            <p><strong>Máquina:</strong> {colhedora.shortName}</p>
            <p><strong>Turno:</strong> {turno}</p>
            <p><strong>Ano/Safra:</strong> {ano}</p>
            <p><strong>Campo:</strong> {campoNome}</p>
            <p><strong>Data:</strong> {dataApontamento}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PerdaMecDetailRankEquipCampo;