import React, { useEffect, useMemo, useState } from 'react';

// ================================= HELPERS =================================
const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

const WEEK_DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const parseIsoDate = (value) => {
  if (!value || typeof value !== 'string') return new Date();

  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const formatDisplayDate = (value) => {
  if (!value) return '--/--/----';

  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
};

// ================================= COMPONENT ================================
const DateSelectorQualyFlow = ({
  value,
  onChange,
  availableDates = [],
  activeYear,
  onYearChange,
  yearsList = [],
  isLoading = false,
}) => {
  const availableDatesSet = useMemo(
    () => new Set(availableDates),
    [availableDates]
  );

  // A primeira data do array já é a mais recente, pois a View retorna em DESC.
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

  const initialDate = safeValue ? parseIsoDate(safeValue) : new Date();

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(
    activeYear || initialDate.getFullYear()
  );
  const [viewMonth, setViewMonth] = useState(initialDate.getMonth());

  useEffect(() => {
    if (!safeValue) return;

    const selected = parseIsoDate(safeValue);
    setViewYear(activeYear || selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [safeValue, activeYear]);

  const currentIndex = useMemo(
    () => availableDates.indexOf(safeValue),
    [availableDates, safeValue]
  );

  // Como o array está em ordem DESC, a data anterior está no próximo índice.
  const prevDateIso = useMemo(() => {
    if (
      availableDates.length &&
      currentIndex >= 0 &&
      currentIndex < availableDates.length - 1
    ) {
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

  const handlePrev = () => {
    if (prevDateIso) onChange?.(prevDateIso);
  };

  const handleNext = () => {
    if (nextDateIso) onChange?.(nextDateIso);
  };

  const getDaysInMonth = (month, year) =>
    new Date(year, month + 1, 0).getDate();

  const getFirstDayOfMonth = (month, year) =>
    new Date(year, month, 1).getDay();

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days = [];

    for (let index = 0; index < firstDay; index += 1) {
      days.push(
        <div
          key={`empty-${index}`}
          aria-hidden="true"
          style={{ minWidth: 0 }}
        />
      );
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDate = `${viewYear}-${String(viewMonth + 1).padStart(
        2,
        '0'
      )}-${String(day).padStart(2, '0')}`;

      const isSelected = isoDate === safeValue;
      const disabled = availableDates.length > 0
        ? !availableDatesSet.has(isoDate)
        : false;

      days.push(
        <button
          key={isoDate}
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange?.(isoDate);
            setIsOpen(false);
          }}
          className={`qf-btn qf-calendar__day ${
            isSelected ? 'is-selected' : ''
          }`}
          style={{
            width: '100%',
            minWidth: 0,
            boxSizing: 'border-box',
          }}
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
          aria-label="Ir para a avaliação anterior"
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
              <span className="qf-date-spinner" />
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
          aria-label="Ir para a próxima avaliação"
        >
          ›
        </button>
      </div>

      {isOpen && (
        <div
          className="qf-calendar-backdrop"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="qf-calendar"
            onClick={(event) => event.stopPropagation()}
            style={{
              width: 'min(92vw, 360px)',
              maxWidth: '360px',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <div className="qf-calendar__top">
              <span className="qf-calendar__title">Data de Avaliação</span>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="text-[var(--q-gray)] hover:text-[var(--q-danger)] font-bold"
                aria-label="Fechar calendário"
              >
                ✕
              </button>
            </div>

            <div
              className="qf-calendar__body"
              style={{
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div className="qf-calendar__controls">
                <select
                  value={viewMonth}
                  onChange={(event) =>
                    setViewMonth(Number(event.target.value))
                  }
                  className="qf-calendar__select"
                  aria-label="Selecionar mês"
                >
                  {MONTHS.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(event) => {
                    const newYear = Number(event.target.value);
                    setViewYear(newYear);
                    onYearChange?.(newYear);
                  }}
                  className="qf-calendar__select w-24"
                  aria-label="Selecionar ano"
                >
                  {yearsList.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div
                className="qf-calendar__grid"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
                  width: '100%',
                  boxSizing: 'border-box',
                }}
              >
                {WEEK_DAYS.map((day, index) => (
                  <div
                    key={`${day}-${index}`}
                    className="qf-calendar__week"
                    style={{
                      minWidth: 0,
                      textAlign: 'center',
                    }}
                  >
                    {day}
                  </div>
                ))}

                {renderCalendarDays()}
              </div>
            </div>

            <div className="p-3 border-t border-[var(--q-border)] bg-[var(--q-bg-hover)]">
              <button
                type="button"
                onClick={() => {
                  if (computedMaxDate) onChange?.(computedMaxDate);
                  setIsOpen(false);
                }}
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
