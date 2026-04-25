import React from 'react';

// Helper local para garantir que a exibição seja sempre BR
const formatToBR = (dateStr) => {
  if (!dateStr) return "--/--/----";
  // Se já for DD/MM/AAAA, mantém
  if (dateStr.includes('/') && dateStr.indexOf('/') === 2) return dateStr;
  // Se for ISO (AAAA-MM-DD), inverte
  if (dateStr.includes('-')) {
    const [y, m, d] = dateStr.split('-');
    return `${d}/${m}/${y}`;
  }
  return dateStr;
};

const COADateSelector = ({ date, onPrev, onNext, disablePrev, disableNext }) => (
  <div className="w-full flex flex-col items-center py-6 font-sans bg-transparent">
    <div className="flex items-center gap-4">
      
      {/* Botão Voltar (<) */}
      <button 
        onClick={onPrev} 
        disabled={disablePrev}
        className={`flex items-center justify-center w-9 h-9 rounded-xl font-black transition-all ${
          disablePrev 
            ? 'bg-[#161B22] text-slate-700 border border-slate-800 cursor-not-allowed opacity-40' 
            : 'bg-[#1C2128] text-emerald-500 border border-slate-700 hover:bg-emerald-600 hover:text-white active:scale-95 cursor-pointer shadow-lg'
        }`}
      >
        {"<"}
      </button>

      {/* Exibição da Data */}
      <div className="text-center flex flex-col items-center justify-center px-4">
        <p className="text-[8px] font-black text-slate-600 uppercase tracking-[0.3em] mb-1.5 leading-none">
          Data Operacional
        </p>
        <span className="text-sm font-black tracking-tight text-slate-200 bg-[#161B22] px-4 py-2 rounded-xl border border-slate-700 shadow-inner min-w-[120px]">
          {/* A mágica acontece aqui: Traduzimos o 'date' recebido para o visual BR */}
          {formatToBR(date)}
        </span>
      </div>

      {/* Botão Avançar (>) */}
      <button 
        onClick={onNext} 
        disabled={disableNext}
        className={`flex items-center justify-center w-9 h-9 rounded-xl font-black transition-all ${
          disableNext 
            ? 'bg-[#161B22] text-slate-700 border border-slate-800 cursor-not-allowed opacity-40' 
            : 'bg-[#1C2128] text-emerald-500 border border-slate-700 hover:bg-emerald-600 hover:text-white active:scale-95 cursor-pointer shadow-lg'
        }`}
      >
        {">"}
      </button>

    </div>
    
    {/* Separador High-Tech */}
    <div className="w-full h-[1px] bg-slate-800 mt-6 max-w-[200px] relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-full bg-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.5)] rounded-full" />
    </div>
  </div>
);

export default COADateSelector;