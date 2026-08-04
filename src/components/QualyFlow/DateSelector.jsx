import React, { useState, useEffect, useMemo } from 'react';

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", 
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

// Converte DD/MM/AAAA para AAAA-MM-DD
const toIso = (ptbrDate) => {
  if (!ptbrDate || typeof ptbrDate !== 'string' || !ptbrDate.includes('/')) return "";
  const [d, m, y] = ptbrDate.split('/');
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
};

// Converte AAAA-MM-DD para DD/MM/AAAA
const toPtBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return "";
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y}`;
};

const DateSelectorQualyFlow = ({ 
  value, 
  onChange, 
  availableDatesData = [],
  isLoading = false 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // 1. Processa as datas recebidas da Home
  const { sortedIsoDates, availableSetIso } = useMemo(() => {
    if (!availableDatesData || availableDatesData.length === 0) {
      return { sortedIsoDates: [], availableSetIso: new Set() };
    }

    const uniqueIso = [...new Set(availableDatesData.map(toIso))].filter(d => d !== "");
    uniqueIso.sort((a, b) => a.localeCompare(b)); 

    return {
      sortedIsoDates: uniqueIso,
      availableSetIso: new Set(uniqueIso)
    };
  }, [availableDatesData]);

  // 2. AUTO-SELECT: Se carregou as datas da Home e o value tá vazio, avisa a Home a data mais nova
  useEffect(() => {
    if (!isLoading && !value && sortedIsoDates.length > 0) {
      const ultimaDataIso = sortedIsoDates[sortedIsoDates.length - 1];
      onChange(toPtBr(ultimaDataIso));
    }
  }, [isLoading, value, sortedIsoDates, onChange]);

  // 3. Valor de segurança interno
  const safeValueIso = useMemo(() => {
    if (value) return toIso(value);
    if (sortedIsoDates.length > 0) return sortedIsoDates[sortedIsoDates.length - 1];
    return "";
  }, [value, sortedIsoDates]);

  // 4. Sincroniza calendário
  useEffect(() => {
    if (isOpen && safeValueIso) {
      const [y, m] = safeValueIso.split('-');
      if (y && m) {
        setViewYear(parseInt(y, 10));
        setViewMonth(parseInt(m, 10) - 1);
      }
    }
  }, [isOpen, safeValueIso]);

  // 5. Controles Prev/Next
  const currentIndex = sortedIsoDates.indexOf(safeValueIso);
  const disablePrev = sortedIsoDates.length === 0 || currentIndex <= 0;
  const disableNext = sortedIsoDates.length === 0 || currentIndex === -1 || currentIndex >= sortedIsoDates.length - 1;

  const handlePrev = () => {
    if (!disablePrev) onChange(toPtBr(sortedIsoDates[currentIndex - 1]));
  };
  const handleNext = () => {
    if (!disableNext) onChange(toPtBr(sortedIsoDates[currentIndex + 1]));
  };
  const handleUltimoLevantamento = () => {
    if (sortedIsoDates.length > 0) {
      onChange(toPtBr(sortedIsoDates[sortedIsoDates.length - 1]));
    }
    setIsOpen(false);
  };

  // 6. Grid do Calendário
  const renderCalendarDays = () => {
    const totalDays = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysArray = [];

    for (let i = 0; i < firstDay; i++) daysArray.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);

    for (let day = 1; day <= totalDays; day++) {
      const currentDayIso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasData = availableSetIso.has(currentDayIso);
      const isSelected = safeValueIso === currentDayIso;

      daysArray.push(
        <button
          key={day}
          disabled={!hasData}
          onClick={() => {
            onChange(toPtBr(currentDayIso));
            setIsOpen(false);
          }}
          className={`relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
            ${isSelected ? 'bg-[var(--q-green)] text-white shadow-md scale-110 z-10' : ''}
            ${!isSelected && hasData ? 'text-[var(--q-dark)] hover:bg-[var(--q-bg)] hover:text-[var(--q-green)] cursor-pointer' : ''}
            ${!hasData ? 'text-slate-200 cursor-not-allowed' : ''}
          `}
        >
          {day}
          {hasData && !isSelected && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--q-orange)] opacity-60"></span>
          )}
        </button>
      );
    }
    return daysArray;
  };

  const availableYears = useMemo(() => {
    if (sortedIsoDates.length === 0) return [new Date().getFullYear()];
    const years = [...new Set(sortedIsoDates.map(iso => parseInt(iso.split('-')[0], 10)))];
    return years.sort((a, b) => a - b);
  }, [sortedIsoDates]);

  return (
    <div className="w-full flex flex-col items-center py-2 font-sans relative">
      <div className="flex items-center gap-4">
        <button 
          onClick={handlePrev} 
          disabled={disablePrev || isLoading}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
            (disablePrev || isLoading) ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-[var(--q-bg)] text-[var(--q-green)] border border-[var(--q-green)] hover:bg-[var(--q-green)] hover:text-white active:scale-95 shadow-sm'
          }`}
        >{"<"}</button>

        <div className="text-center flex flex-col items-center justify-center px-2">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1 tracking-widest">Data de Referência</p>
          <button 
            onClick={() => setIsOpen(true)}
            disabled={isLoading}
            className="flex items-center gap-2 text-sm font-extrabold tracking-tighter transition-all rounded-md border shadow-sm bg-white text-[var(--q-dark)] border-slate-200 hover:border-[var(--q-green)] active:scale-95 w-[120px] h-[36px] justify-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-slate-200 border-t-slate-400 rounded-full animate-spin"></div>
            ) : (
              value || "Sem dados"
            )}
          </button>
        </div>

        <button 
          onClick={handleNext} 
          disabled={disableNext || isLoading}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
            (disableNext || isLoading) ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-[var(--q-bg)] text-[var(--q-green)] border border-[var(--q-green)] hover:bg-[var(--q-green)] hover:text-white active:scale-95 shadow-sm'
          }`}
        >{">"}</button>
      </div>

      {isOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <div className="bg-[var(--q-green)] p-4 text-white flex justify-between items-center shadow-inner">
              <span className="font-black tracking-widest uppercase text-xs">AgroTarget Datas</span>
              <button onClick={() => setIsOpen(false)} className="text-white hover:text-slate-200 font-bold text-2xl leading-none">×</button>
            </div>

            <div className="p-5">
              <div className="flex gap-2 mb-4">
                <select value={viewMonth} onChange={(e) => setViewMonth(parseInt(e.target.value, 10))} className="flex-1 bg-slate-50 border border-slate-200 text-[var(--q-dark)] text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-[var(--q-green)] cursor-pointer">
                  {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                </select>
                <select value={viewYear} onChange={(e) => setViewYear(parseInt(e.target.value, 10))} className="w-24 bg-slate-50 border border-slate-200 text-[var(--q-dark)] text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-[var(--q-green)] cursor-pointer">
                  {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-7 gap-y-2 gap-x-1 mb-2">
                {WEEK_DAYS.map(d => (
                  <div key={d} className="text-center text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{d}</div>
                ))}
                {renderCalendarDays()}
              </div>
            </div>

            <div className="p-4 bg-[var(--q-bg)] border-t border-slate-100 flex justify-center">
              <button 
                onClick={handleUltimoLevantamento}
                disabled={sortedIsoDates.length === 0}
                className="w-full py-2.5 bg-white border border-[var(--q-orange)] text-[var(--q-orange)] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[var(--q-orange)] hover:text-white transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Último Levantamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateSelectorQualyFlow;