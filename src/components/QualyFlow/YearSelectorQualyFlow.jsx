// ================================= DOCUMENTATION ------------------------------------------
// Script: YearSelectorQualyFlow
// Purpose: Seletor limpo e padronizado para Anos (Safras), estruturalmente idêntico ao DateSelector.
// ==========================================================================================

import React, { useState, useMemo, useEffect } from 'react';

const YearSelectorQualyFlow = ({ value, onChange, availableYears = [], isLoading = false }) => {
  
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Garante que a lista esteja ordenada do maior para o menor (Mais recente primeiro)
  const sortedYears = useMemo(() => {
    return [...new Set(availableYears)].sort((a, b) => b - a);
  }, [availableYears]);

  // Filtra as safras com base na busca
  const filteredYears = useMemo(() => {
    if (!searchTerm) return sortedYears;
    return sortedYears.filter(year => String(year).includes(searchTerm));
  }, [sortedYears, searchTerm]);

  // Reseta a busca sempre que o modal fechar ou abrir
  useEffect(() => {
    if (!isOpen) setSearchTerm('');
  }, [isOpen]);

  const currentIndex = useMemo(() => sortedYears.indexOf(value), [sortedYears, value]);
  
  // Lógica de navegação: "Anterior" (<) vai para a safra MAIS ANTIGA (avança no array DESC)
  // "Próximo" (>) vai para a safra MAIS RECENTE (retrocede no array DESC)
  const handlePrev = () => { if (currentIndex < sortedYears.length - 1) onChange(sortedYears[currentIndex + 1]); };
  const handleNext = () => { if (currentIndex > 0) onChange(sortedYears[currentIndex - 1]); };

  return (
    <div className="qf-date-shell">
      <div className="qf-date-inline">
        
        <button
          type="button"
          className="qf-date-nav"
          disabled={isLoading || currentIndex >= sortedYears.length - 1 || sortedYears.length === 0}
          onClick={handlePrev}
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => !isLoading && setIsOpen(true)}
          className={`qf-date-chip ${isLoading ? 'is-loading' : ''}`}
          disabled={isLoading}
        >
          {isLoading ? (
            <>
              <span className="qf-date-spinner"></span>
              <span>Buscando...</span>
            </>
          ) : (
            <div className="flex flex-col items-center leading-none justify-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-0.5">Safra</span>
              <span className="text-sm font-black">{value || '----'}</span>
            </div>
          )}
        </button>

        <button
          type="button"
          className="qf-date-nav"
          disabled={isLoading || currentIndex <= 0 || sortedYears.length === 0}
          onClick={handleNext}
        >
          ›
        </button>

      </div>

      {isOpen && (
        <div className="qf-calendar-backdrop" onClick={() => setIsOpen(false)}>
          <div className="qf-calendar" onClick={(e) => e.stopPropagation()}>
            
            <div className="qf-calendar__top">
              <span className="qf-calendar__title">Selecione a Safra</span>
              <button onClick={() => setIsOpen(false)} className="text-[var(--q-gray)] hover:text-[var(--q-danger)] font-bold transition-colors">✕</button>
            </div>

            <div className="p-3 bg-white">
              {/* Barra de Busca */}
              <div className="relative mb-3">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40 text-xs">🔍</span>
                <input 
                  type="text" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar safra..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-[var(--q-green)] focus:ring-1 focus:ring-[var(--q-green)] transition-all"
                />
              </div>

              {/* Lista de Safras com tamanho fixo */}
              <div className="flex flex-col h-[200px] overflow-y-auto custom-scrollbar pr-1 border border-slate-100 rounded-lg p-1 bg-slate-50">
                {filteredYears.length > 0 ? (
                  filteredYears.map(year => (
                    <button
                      key={year}
                      onClick={() => { onChange(year); setIsOpen(false); }}
                      className={`py-2.5 px-4 mb-1 text-center rounded-md text-xs font-black uppercase tracking-widest transition-colors last:mb-0 ${
                        value === year 
                          ? 'bg-[var(--q-green-soft)] text-[var(--q-green-dark)] shadow-sm border border-[var(--q-green)]' 
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-transparent'
                      }`}
                    >
                      Safra {year}
                    </button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <span className="text-xl mb-1 grayscale opacity-50">🍂</span>
                    <span className="text-[9px] font-black uppercase tracking-widest">Nenhuma encontrada</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--q-border)] bg-[var(--q-bg-hover)]">
                <button 
                  onClick={() => { if(sortedYears.length > 0) onChange(sortedYears[0]); setIsOpen(false); }}
                  className="w-full py-2 bg-[var(--q-orange-soft)] text-[var(--q-orange-dark)] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[var(--q-orange)] hover:text-white transition-colors"
                >
                  Ir para Safra mais Recente
                </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default YearSelectorQualyFlow;