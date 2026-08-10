// ================================= DOCUMENTATION ------------------------------------------
// Script: YearSelectorQualyFlow
// Purpose: Seletor limpo e dedicado apenas para Anos (Safras).
// ==========================================================================================

import React, { useState, useMemo } from 'react';

const YearSelectorQualyFlow = ({ value, onChange, availableYears = [], isLoading = false }) => {
  
  const [isOpen, setIsOpen] = useState(false);

  // Garante que a lista esteja ordenada do maior para o menor
  const sortedYears = useMemo(() => {
    return [...new Set(availableYears)].sort((a, b) => b - a);
  }, [availableDates, availableYears]);

  const currentIndex = useMemo(() => sortedYears.indexOf(value), [sortedYears, value]);
  
  const handlePrev = () => { if (currentIndex < sortedYears.length - 1) onChange(sortedYears[currentIndex + 1]); };
  const handleNext = () => { if (currentIndex > 0) onChange(sortedYears[currentIndex - 1]); };

  return (
    <div className="relative inline-flex flex-col items-center z-50">
      <div className="flex items-center bg-white border border-slate-200 rounded-full shadow-sm p-1">
        
        <button
          type="button"
          disabled={isLoading || currentIndex >= sortedYears.length - 1}
          onClick={handlePrev}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 transition-colors font-bold text-lg"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => !isLoading && setIsOpen(!isOpen)}
          disabled={isLoading}
          className="px-6 py-1.5 flex flex-col items-center justify-center min-w-[120px] rounded-full hover:bg-slate-50 transition-colors"
        >
          {isLoading ? (
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest animate-pulse">Buscando...</span>
          ) : (
            <>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Safra</span>
              <span className="text-sm font-black text-[var(--q-dark)] leading-tight">{value || '----'}</span>
            </>
          )}
        </button>

        <button
          type="button"
          disabled={isLoading || currentIndex <= 0}
          onClick={handleNext}
          className="w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30 transition-colors font-bold text-lg"
        >
          ›
        </button>

      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute top-[110%] left-1/2 -translate-x-1/2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-3 bg-slate-50 border-b border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block text-center">Selecione a Safra</span>
            </div>
            <div className="flex flex-col max-h-[250px] overflow-y-auto custom-scrollbar p-1">
              {sortedYears.map(year => (
                <button
                  key={year}
                  onClick={() => { onChange(year); setIsOpen(false); }}
                  className={`py-3 px-4 text-center rounded-lg text-sm font-black transition-colors ${
                    value === year 
                      ? 'bg-[var(--q-green-soft)] text-[var(--q-green-dark)]' 
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {year}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default YearSelectorQualyFlow;