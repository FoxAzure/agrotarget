import React from 'react';

const DateSelector = ({ date, onPrev, onNext, disablePrev, disableNext }) => (
  <div className="w-full flex flex-col items-center py-4">
    <div className="flex items-center gap-4">
      
      {/* Botão Voltar (<) */}
      <button 
        onClick={onPrev} 
        disabled={disablePrev}
        className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all ${
          disablePrev 
            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed' 
            : 'bg-agro-green/10 text-agro-green border border-agro-green/20 hover:bg-agro-green hover:text-white active:scale-95 cursor-pointer shadow-sm'
        }`}
      >
        {"<"}
      </button>

      {/* Título e Data (Mais compactos) */}
      <div className="text-center flex flex-col items-center justify-center">
        <span className="text-sm font-mono font-black text-agro-green bg-white px-4 py-1.5 rounded border border-slate-200 shadow-sm leading-none">
          {date}
        </span>
      </div>

      {/* Botão Avançar (>) */}
      <button 
        onClick={onNext} 
        disabled={disableNext}
        className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all ${
          disableNext 
            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed' 
            : 'bg-agro-green/10 text-agro-green border border-agro-green/20 hover:bg-agro-green hover:text-white active:scale-95 cursor-pointer shadow-sm'
        }`}
      >
        {">"}
      </button>

    </div>
    {/* Linha separadora mais sutil */}
    <div className="w-full h-[1px] bg-slate-200 mt-5 max-w-[200px]" />
  </div>
);

export default DateSelector;