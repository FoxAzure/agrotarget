import React, { useState, useEffect } from 'react';

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const DateSelector = ({ date, onPrev, onNext, disablePrev, disableNext, availableDates = [], onSelectDate }) => {
  const [isOpen, setIsOpen] = useState(false);
  
  // Estado interno do calendário
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // Sincroniza o calendário com a data selecionada ao abrir
  useEffect(() => {
    if (isOpen && date) {
      const [y, m] = date.split('-');
      if (y && m) {
        setViewYear(parseInt(y));
        setViewMonth(parseInt(m) - 1);
      }
    }
  }, [isOpen, date]);

  const formatDisplayDate = (d) => {
    if (!d) return "";
    const [y, m, dDay] = d.split("-");
    return `${dDay}/${m}/${y}`;
  };

  // Gerador de Dias do Mês
  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const daysArray = [];

    // Espaços vazios antes do primeiro dia
    for (let i = 0; i < firstDay; i++) {
      daysArray.push(<div key={`empty-${i}`} className="w-8 h-8"></div>);
    }

    // Dias do mês
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const hasData = availableDates.includes(dateStr);
      const isSelected = date === dateStr;

      daysArray.push(
        <button
          key={day}
          disabled={!hasData}
          onClick={() => {
            onSelectDate(dateStr);
            setIsOpen(false);
          }}
          className={`relative flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold transition-all
            ${isSelected ? 'bg-[var(--q-green)] text-white shadow-md scale-110 z-10' : ''}
            ${!isSelected && hasData ? 'text-[var(--q-dark)] hover:bg-[var(--q-bg)] hover:text-[var(--q-green)] cursor-pointer' : ''}
            ${!hasData ? 'text-slate-300 cursor-not-allowed' : ''}
          `}
        >
          {day}
          {/* Marcador laranja sutil para dias com apontamento */}
          {hasData && !isSelected && (
            <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--q-orange)] opacity-60"></span>
          )}
        </button>
      );
    }
    return daysArray;
  };

  return (
    <div className="w-full flex flex-col items-center py-2 font-sans relative">
      <div className="flex items-center gap-4">
        
        <button 
          onClick={onPrev} disabled={disablePrev}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
            disablePrev ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-[var(--q-bg)] text-[var(--q-green)] border border-[var(--q-green)] hover:bg-[var(--q-green)] hover:text-white active:scale-95 shadow-sm'
          }`}
        >{"<"}</button>

        <div className="text-center flex flex-col items-center justify-center px-2">
          <p className="text-micro mb-1">Data de Referência</p>
          <button 
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2 text-sm font-extrabold tracking-tighter transition-all px-4 py-1.5 rounded-md border shadow-sm min-w-[110px] justify-center bg-white text-[var(--q-dark)] border-slate-200 hover:border-[var(--q-green)] active:scale-95"
          >
            {formatDisplayDate(date)}
          </button>
        </div>

        <button 
          onClick={onNext} disabled={disableNext}
          className={`flex items-center justify-center w-8 h-8 rounded-lg font-black transition-all z-10 ${
            disableNext ? 'bg-slate-100 text-slate-300 border border-slate-200 cursor-not-allowed opacity-50' 
            : 'bg-[var(--q-bg)] text-[var(--q-green)] border border-[var(--q-green)] hover:bg-[var(--q-green)] hover:text-white active:scale-95 shadow-sm'
          }`}
        >{">"}</button>
      </div>

      {/* OVERLAY MODAL DO CALENDÁRIO */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[320px] overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
            {/* Header do Modal */}
            <div className="bg-[var(--q-green)] p-4 text-white flex justify-between items-center shadow-inner">
              <span className="font-black tracking-widest uppercase text-xs">Calendário</span>
              <button onClick={() => setIsOpen(false)} className="text-white hover:text-slate-200 font-bold text-xl leading-none">×</button>
            </div>

            <div className="p-5">
              {/* Controles de Mês e Ano */}
              <div className="flex gap-2 mb-4">
                <select 
                  value={viewMonth} 
                  onChange={(e) => setViewMonth(parseInt(e.target.value))}
                  className="flex-1 bg-slate-50 border border-slate-200 text-[var(--q-dark)] text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-[var(--q-green)] cursor-pointer"
                >
                  {MONTHS.map((m, idx) => <option key={m} value={idx}>{m}</option>)}
                </select>
                
                <select 
                  value={viewYear} 
                  onChange={(e) => setViewYear(parseInt(e.target.value))}
                  className="w-24 bg-slate-50 border border-slate-200 text-[var(--q-dark)] text-xs font-bold rounded-lg px-2 py-2 outline-none focus:border-[var(--q-green)] cursor-pointer"
                >
                  {/* Gera anos de 2024 até 2030 */}
                  {Array.from({length: 7}, (_, i) => 2024 + i).map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>

              {/* Grid de Dias */}
              <div className="grid grid-cols-7 gap-y-2 gap-x-1 mb-2">
                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                  <div key={d} className="text-center text-[9px] font-black uppercase text-slate-400 tracking-wider mb-1">{d}</div>
                ))}
                {renderCalendarDays()}
              </div>
            </div>

            {/* Rodapé: Último Levantamento */}
            <div className="p-4 bg-[var(--q-bg)] border-t border-slate-100 flex justify-center">
              <button 
                onClick={() => {
                  if(availableDates.length > 0) onSelectDate(availableDates[0]);
                  setIsOpen(false);
                }}
                className="w-full py-2.5 bg-white border border-[var(--q-orange)] text-[var(--q-orange)] text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-[var(--q-orange)] hover:text-white transition-colors shadow-sm"
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

export default DateSelector;