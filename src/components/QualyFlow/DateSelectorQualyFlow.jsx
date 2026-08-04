import React, { useEffect, useMemo, useState } from 'react';

// ================================= HELPERS ------------------------------------------------
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parseIsoDate = (value) => {
  if (!value || typeof value !== 'string') return new Date();
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDisplayDate = (value) => {
  if (!value) return '--/--/----';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

// ================================= COMPONENT ----------------------------------------------
const DateSelectorQualyFlow = ({ 
  value, 
  onChange, 
  availableDates = [],
  activeYear,          
  onYearChange,        
  yearsList = [],
  isLoading = false       
}) => {
  
  const availableDatesSet = useMemo(() => new Set(availableDates), [availableDates]);

  // A primeira data do array (índice 0) já é a mais recente devido à sua View
  const computedMaxDate = useMemo(() => {
    if (availableDates.length) return availableDates[0];
    return null;
  }, [availableDates]);

  const safeValue = useMemo(() => {
    if (availableDates.length) {
      if (value && availableDatesSet.has(value)) return value;
      return computedMaxDate;
    }
    return value;
  }, [value, availableDates, availableDatesSet, computedMaxDate]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(activeYear || new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  useEffect(() => {
    if (safeValue) {
      const selected = parseIsoDate(safeValue);
      setViewYear(activeYear);
      setViewMonth(selected.getMonth());
    }
  }, [safeValue, activeYear]);

  const currentIndex = useMemo(() => availableDates.indexOf(safeValue), [availableDates, safeValue]);

  // Navegação: Como o array está em ordem DESC, "anterior" cronologicamente é avançar no array
  const prevDateIso = useMemo(() => {
    if (availableDates.length && currentIndex >= 0 && currentIndex < availableDates.length - 1) {
      return availableDates[currentIndex + 1];
    }
    return '';
  }, [availableDates, currentIndex]);

  const nextDateIso = useMemo(() => {
    if (availableDates.length && currentIndex > 0) {
      return availableDates[currentIndex - 1];
    }
    return '';
  }, [availableDates, currentIndex]);

  const handlePrev = () => { if (prevDateIso) onChange?.(prevDateIso); };
  const handleNext = () => { if (nextDateIso) onChange?.(nextDateIso); };

  const getDaysInMonth = (month, year) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (month, year) => new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<div key={`empty-${i}`} />);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = isoDate === safeValue;
      const disabled = availableDates.length > 0 ? !availableDatesSet.has(isoDate) : false;

      days.push(
        <button
          key={isoDate}
          type="button"
          disabled={disabled}
          onClick={() => { onChange?.(isoDate); setIsOpen(false); }}
          className={`qf-btn qf-calendar__day ${isSelected ? 'is-selected' : ''}`}
        >
          {day}
        </button>
      );
    }
    return days;
  };

  return (
    <div className="qf-date-shell">
      <div className="qf-date-inline">

        <button
          type="button"
          className="qf-date-nav"
          disabled={isLoading || !prevDateIso}
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
            formatDisplayDate(safeValue)
          )}

        </button>

        <button
          type="button"
          className="qf-date-nav"
          disabled={isLoading || !nextDateIso}
          onClick={handleNext}
        >
          ›
        </button>

      </div>

      {isOpen && (
        <div className="qf-calendar-backdrop" onClick={() => setIsOpen(false)}>
          <div className="qf-calendar" onClick={(e) => e.stopPropagation()}>
            <div className="qf-calendar__top">
              <span className="qf-calendar__title">Data de Avaliação</span>
              <button onClick={() => setIsOpen(false)} className="text-[var(--q-gray)] hover:text-[var(--q-danger)] font-bold">✕</button>
            </div>

            <div className="qf-calendar__body">
              <div className="qf-calendar__controls">
                <select value={viewMonth} onChange={(e) => setViewMonth(Number(e.target.value))} className="qf-calendar__select">
                  {MONTHS.map((month, idx) => (<option key={month} value={idx}>{month}</option>))}
                </select>
                
                <select 
                  value={viewYear} 
                  onChange={(e) => {
                    const newYear = Number(e.target.value);
                    setViewYear(newYear);
                    if (onYearChange) onYearChange(newYear); 
                  }} 
                  className="qf-calendar__select w-24"
                >
                  {yearsList.map((year) => (<option key={year} value={year}>{year}</option>))}
                </select>
              </div>

              <div className="qf-calendar__grid">
                {WEEK_DAYS.map((day) => (<div key={day} className="qf-calendar__week">{day}</div>))}
                {renderCalendarDays()}
              </div>
            </div>
            
            <div className="p-3 border-t border-[var(--q-border)] bg-[var(--q-bg-hover)]">
                <button 
                  onClick={() => { if(computedMaxDate) onChange?.(computedMaxDate); setIsOpen(false); }}
                  className="w-full py-2 bg-[var(--q-orange-soft)] text-[var(--q-orange-dark)] rounded-lg text-xs font-bold uppercase tracking-widest hover:bg-[var(--q-orange)] hover:text-white transition-colors"
                >
                  Ir para Última Avaliação
                </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateSelectorQualyFlow;