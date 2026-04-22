import React from 'react';

const DateSelector = ({ date, onPrev, onNext, disablePrev, disableNext }) => (
  <div className="w-full flex flex-col items-center py-4 font-sans">
    <div className="flex items-center gap-4">
      
      {/* Botão Voltar (<) - Estilo Box Compacto */}
      <button 
        onClick={onPrev} 
        disabled={disablePrev}
        className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all ${
          disablePrev 
            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-agro-green/10 text-agro-green border border-agro-green/20 hover:bg-agro-green hover:text-white active:scale-95 cursor-pointer shadow-sm'
        }`}
      >
        {"<"}
      </button>

      {/* Exibição da Data - Foco Total na Leitura Técnica */}
      <div className="text-center flex flex-col items-center justify-center px-4">
        <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 leading-none">
          Data de Referência
        </p>
        <span className="text-sm font-extrabold tracking-tighter text-agro-green bg-white px-3 py-1.5 rounded-md border border-slate-200 shadow-sm leading-none min-w-[100px]">
          {date}
        </span>
      </div>

      {/* Botão Avançar (>) */}
      <button 
        onClick={onNext} 
        disabled={disableNext}
        className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all ${
          disableNext 
            ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-agro-green/10 text-agro-green border border-agro-green/20 hover:bg-agro-green hover:text-white active:scale-95 cursor-pointer shadow-sm'
        }`}
      >
        {">"}
      </button>

    </div>
    
    {/* Separador Sutil com a cor da marca */}
    <div className="w-full h-[1.5px] bg-slate-200/60 mt-5 max-w-[180px] rounded-full relative">
       <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-full bg-agro-orange opacity-40 rounded-full" />
    </div>
  </div>
);

export default DateSelector;