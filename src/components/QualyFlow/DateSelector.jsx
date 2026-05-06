import React, { useState, useRef, useEffect } from 'react';

const DateSelector = ({ date, onPrev, onNext, disablePrev, disableNext, availableDates = [], onSelectDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Fecha o dropdown se o mestre clicar fora dele
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Helpers para formatar a data visualmente caso ela venha como YYYY-MM-DD
  const formatDisplayDate = (d) => {
    if (!d) return "";
    if (d.includes("-")) {
      const [y, m, dDay] = d.split("-");
      return `${dDay}/${m}/${y}`;
    }
    return d;
  };

  return (
    <div className="w-full flex flex-col items-center py-4 font-sans" ref={dropdownRef}>
      <div className="flex items-center gap-4">
        
        {/* Botão Voltar (<) */}
        <button 
          onClick={onPrev} 
          disabled={disablePrev}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
            disablePrev 
              ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
              : 'bg-agro-green/10 text-agro-green border border-agro-green/20 hover:bg-agro-green hover:text-white active:scale-95 cursor-pointer shadow-sm'
          }`}
        >
          {"<"}
        </button>

        {/* Exibição da Data - Agora é um Botão Interativo! */}
        <div className="relative text-center flex flex-col items-center justify-center px-4">
          <p className="text-[7px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 leading-none">
            Data de Referência
          </p>
          <button 
            onClick={() => setIsOpen(!isOpen)}
            className={`flex items-center gap-2 text-sm font-extrabold tracking-tighter transition-all px-3 py-1.5 rounded-md border shadow-sm leading-none min-w-[100px] ${
              isOpen 
                ? 'bg-agro-green text-white border-agro-green' 
                : 'bg-white text-agro-green border-slate-200 hover:border-agro-green/50'
            }`}
          >
            {formatDisplayDate(date)}
            <span className={`text-[9px] transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
          </button>

          {/* DROPDOWN DO CALENDÁRIO (Lista de Datas) */}
          {isOpen && availableDates.length > 0 && (
            <div className="absolute top-[110%] left-1/2 -translate-x-1/2 mt-1 w-36 bg-white border border-slate-200 shadow-2xl rounded-xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 shadow-inner">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Histórico</span>
              </div>
              <div className="flex flex-col max-h-[180px] overflow-y-auto custom-scrollbar">
                {availableDates.map((d, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (onSelectDate) onSelectDate(d);
                      setIsOpen(false);
                    }}
                    className={`text-center px-4 py-2.5 text-xs font-bold transition-colors border-b border-slate-50 last:border-0 ${
                      date === d 
                        ? 'bg-agro-green/10 text-agro-green' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-agro-green'
                    }`}
                  >
                    {formatDisplayDate(d)}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Botão Avançar (>) */}
        <button 
          onClick={onNext} 
          disabled={disableNext}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
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
};

export default DateSelector;