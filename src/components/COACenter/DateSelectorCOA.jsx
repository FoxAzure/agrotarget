import React, { useEffect, useMemo, useState } from 'react';

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

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseIsoDate = (value) => {
  if (!value || typeof value !== 'string' || !value.includes('-')) {
    return new Date();
  }

  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};

const formatDisplayDate = (value) => {
  if (!value) return '--/--/----';
  const [y, m, d] = value.split('-');
  return `${d}/${m}/${y}`;
};

const clampToToday = (isoDate) => {
  const todayIso = toIsoDate(new Date());
  return isoDate > todayIso ? todayIso : isoDate;
};

const normalizeAvailableDate = (value) => {
  if (!value || typeof value !== 'string') return null;

  // DD/MM/AAAA
  if (value.includes('/')) {
    const [dd, mm, yyyy] = value.split('/');
    if (!dd || !mm || !yyyy) return null;
    return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
  }

  // YYYY-MM-DD
  if (value.includes('-')) {
    return value.slice(0, 10);
  }

  return null;
};

const DateSelectorCOA = ({
  value,
  onChange,
  minDate = null,
  maxDate = toIsoDate(new Date()),
  availableDates = [],
}) => {
  const normalizedAvailableDates = useMemo(() => {
    const unique = [
      ...new Set(
        (availableDates || [])
          .map(normalizeAvailableDate)
          .filter(Boolean)
          .map(clampToToday)
      ),
    ];

    return unique.sort((a, b) => a.localeCompare(b));
  }, [availableDates]);

  const availableDatesSet = useMemo(() => {
    return new Set(normalizedAvailableDates);
  }, [normalizedAvailableDates]);

  const computedMinDate = useMemo(() => {
    if (normalizedAvailableDates.length) return normalizedAvailableDates[0];
    return minDate;
  }, [normalizedAvailableDates, minDate]);

  const computedMaxDate = useMemo(() => {
    if (normalizedAvailableDates.length) {
      return normalizedAvailableDates[normalizedAvailableDates.length - 1];
    }
    return clampToToday(maxDate);
  }, [normalizedAvailableDates, maxDate]);

  const safeValue = useMemo(() => {
    if (normalizedAvailableDates.length) {
      if (value && availableDatesSet.has(value)) return value;
      return computedMaxDate || normalizedAvailableDates[normalizedAvailableDates.length - 1];
    }

    if (!value) return clampToToday(toIsoDate(new Date()));
    return clampToToday(value);
  }, [value, normalizedAvailableDates, availableDatesSet, computedMaxDate]);

  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const selected = parseIsoDate(safeValue);
    setViewYear(selected.getFullYear());
    setViewMonth(selected.getMonth());
  }, [safeValue]);

  const selectedDateObj = useMemo(() => parseIsoDate(safeValue), [safeValue]);

  const currentIndex = useMemo(() => {
    if (!normalizedAvailableDates.length) return -1;
    return normalizedAvailableDates.indexOf(safeValue);
  }, [normalizedAvailableDates, safeValue]);

  const prevDateIso = useMemo(() => {
    if (normalizedAvailableDates.length) {
      if (currentIndex > 0) return normalizedAvailableDates[currentIndex - 1];
      return '';
    }

    const prev = new Date(selectedDateObj);
    prev.setDate(prev.getDate() - 1);
    return toIsoDate(prev);
  }, [normalizedAvailableDates, currentIndex, selectedDateObj]);

  const nextDateIso = useMemo(() => {
    if (normalizedAvailableDates.length) {
      if (currentIndex >= 0 && currentIndex < normalizedAvailableDates.length - 1) {
        return normalizedAvailableDates[currentIndex + 1];
      }
      return '';
    }

    const next = new Date(selectedDateObj);
    next.setDate(next.getDate() + 1);
    return toIsoDate(next);
  }, [normalizedAvailableDates, currentIndex, selectedDateObj]);

  const disablePrev = useMemo(() => {
    if (normalizedAvailableDates.length) return !prevDateIso;
    return !!computedMinDate && prevDateIso < computedMinDate;
  }, [normalizedAvailableDates, prevDateIso, computedMinDate]);

  const disableNext = useMemo(() => {
    if (normalizedAvailableDates.length) return !nextDateIso;
    return !nextDateIso || nextDateIso > computedMaxDate;
  }, [normalizedAvailableDates, nextDateIso, computedMaxDate]);

  const handlePrev = () => {
    if (disablePrev || !prevDateIso) return;
    onChange?.(prevDateIso);
  };

  const handleNext = () => {
    if (disableNext || !nextDateIso) return;
    onChange?.(nextDateIso);
  };

  const getDaysInMonth = (month, year) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (month, year) => {
    return new Date(year, month, 1).getDay();
  };

  const canSelectDate = (isoDate) => {
    if (normalizedAvailableDates.length) {
      return availableDatesSet.has(isoDate);
    }

    if (isoDate > computedMaxDate) return false;
    if (computedMinDate && isoDate < computedMinDate) return false;
    return true;
  };

  const renderCalendarDays = () => {
    const totalDays = getDaysInMonth(viewMonth, viewYear);
    const firstDay = getFirstDayOfMonth(viewMonth, viewYear);
    const days = [];

    for (let i = 0; i < firstDay; i += 1) {
      days.push(<div key={`empty-${i}`} className="coa-calendar__day-empty" />);
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const isoDate = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const isSelected = isoDate === safeValue;
      const disabled = !canSelectDate(isoDate);

      days.push(
        <button
          key={isoDate}
          type="button"
          disabled={disabled}
          onClick={() => {
            onChange?.(isoDate);
            setIsOpen(false);
          }}
          className={`coa-btn coa-calendar__day ${isSelected ? 'is-selected' : ''}`}
        >
          {day}
        </button>
      );
    }

    return days;
  };

  const availableYears = useMemo(() => {
    if (normalizedAvailableDates.length) {
      const years = [
        ...new Set(normalizedAvailableDates.map((date) => parseIsoDate(date).getFullYear())),
      ];
      return years.sort((a, b) => a - b);
    }

    const currentYear = new Date().getFullYear();
    const startYear = computedMinDate ? parseIsoDate(computedMinDate).getFullYear() : currentYear - 3;
    const endYear = parseIsoDate(computedMaxDate).getFullYear();

    const years = [];
    for (let y = startYear; y <= endYear; y += 1) {
      years.push(y);
    }
    return years;
  }, [normalizedAvailableDates, computedMinDate, computedMaxDate]);

  const handleToday = () => {
    const targetDate = normalizedAvailableDates.length ? computedMaxDate : computedMaxDate;
    if (!targetDate) return;
    onChange?.(targetDate);
    setIsOpen(false);
  };

  return (
    <div className="coa-date-shell">
      <div className="coa-date-inline">
        <button
          type="button"
          onClick={handlePrev}
          disabled={disablePrev}
          className="coa-btn coa-date-nav"
          aria-label="Data anterior"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="coa-btn coa-date-chip"
        >
          {formatDisplayDate(safeValue)}
        </button>

        <button
          type="button"
          onClick={handleNext}
          disabled={disableNext}
          className="coa-btn coa-date-nav"
          aria-label="Próxima data"
        >
          ›
        </button>
      </div>

      {isOpen && (
        <div className="coa-calendar-backdrop" onClick={() => setIsOpen(false)}>
          <div
            className="coa-calendar coa-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="coa-calendar__top">
              <div className="flex flex-col">
                <span className="coa-text-overline">Selecionar Data</span>
                <span className="coa-text-subtitle">COA Center</span>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="coa-btn coa-sidebar__close"
                aria-label="Fechar calendário"
              >
                ×
              </button>
            </div>

            <div className="coa-calendar__body">
              <div className="coa-calendar__controls">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  className="coa-calendar__select flex-1"
                >
                  {MONTHS.map((month, idx) => (
                    <option key={month} value={idx}>
                      {month}
                    </option>
                  ))}
                </select>

                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  className="coa-calendar__select w-24"
                >
                  {availableYears.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>

              <div className="coa-calendar__grid">
                {WEEK_DAYS.map((day) => (
                  <div key={day} className="coa-calendar__week">
                    {day}
                  </div>
                ))}

                {renderCalendarDays()}
              </div>
            </div>

            <div className="coa-calendar__footer">
              <button
                type="button"
                onClick={handleToday}
                className="coa-btn coa-btn--secondary w-full"
              >
                Última data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DateSelectorCOA;
