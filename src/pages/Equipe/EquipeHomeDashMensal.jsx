// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashMensal
// Purpose: Dashboard mensal em grade, com metas, dias do mes, Curva S e percentual.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';

const DASH_MONTHLY_CONFIG = {
  tableHeaderPx: 10,
  tableValuePx: 10,
  activityPx: 11,
  dayHeaderPx: 10,
  dayValuePx: 10,
  percentageTextPx: 11,
  rowHeightPx: 38,
  activityColumnPx: 150,
  dayColumnPx: 35,
  metaDayColumnPx: 70,
  realizedColumnPx: 80,
  remainingColumnPx: 80,
  neededDayColumnPx: 110,
  metaColumnPx: 82,
  percentColumnPx: 210,
  businessDaysWidthPx: 500,
  businessDaysBarHeightPx: 10,
  achievedCellBg: 'rgba(134, 239, 172, 0.18)',
  achievedCellBorder: 'rgba(134, 239, 172, 0.32)',
  achievedCellText: '#bbf7d0',
  warningCellBg: 'rgba(253, 230, 138, 0.16)',
  warningCellBorder: 'rgba(253, 230, 138, 0.30)',
  warningCellText: '#fde68a',
  neutralCellBg: 'rgba(148, 163, 184, 0.07)',
  neutralCellText: '#94a3b8',
  weekendHeaderText: '#f87171',
  weekendHeaderBg: '#172234',
};

const MONTHS = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];

const num = (value) => Number(value || 0);

const fmt = (value, decimals = 1) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

const isoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const periodKey = (year, month) => Number(year) * 100 + Number(month);

const businessDaysInMonth = (year, month) =>
  Array.from(
    { length: new Date(year, month, 0).getDate() },
    (_, index) => new Date(year, month - 1, index + 1)
  ).filter((date) => ![0, 6].includes(date.getDay()));

const tonePercent = (percent) => {
  if (percent == null) return 'neutral';
  if (percent > 110) return 'blue';
  if (percent >= 90) return 'green';
  if (percent >= 80) return 'yellow';
  return 'red';
};

const effectiveGoals = (goals, year, month) => {
  const limit = periodKey(year, month);
  const map = new Map();

  (goals || [])
    .filter((goal) => periodKey(goal.ano, goal.mes) <= limit)
    .sort(
      (a, b) =>
        periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) ||
        Number(a.id) - Number(b.id)
    )
    .forEach((goal) => map.set(goal.atividade, goal));

  return map;
};

function RemainingBusinessDays({ total, remaining }) {
  const width = Math.max(0, Math.min(100, (remaining / Math.max(1, total)) * 100));

  return (
    <div className="equipe-month-business-days">
      <div className="equipe-month-business-days__text">
        <strong>{total} dias uteis totais</strong>
        <span>/</span>
        <b>{remaining} dias uteis restantes</b>
      </div>
      <div
        className="equipe-month-business-days__track"
        aria-label={`${remaining} de ${total} dias uteis restantes`}
      >
        <i style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function MonthlyPercent({ percent }) {
  const capped = percent == null ? 0 : Math.min(110, Math.max(0, percent));
  const tone = tonePercent(percent);

  return (
    <div className="equipe-month-percent">
      <div className="equipe-month-percent__track">
        <i className={`is-${tone}`} style={{ width: `${(capped / 110) * 100}%` }} />
      </div>
      <strong className={`is-${tone}`}>
        {percent == null ? '—' : `${fmt(percent)}%`}
      </strong>
    </div>
  );
}

function PercentageChart({ items }) {
  return (
    <section className="equipe-percentage-panel equipe-percentage-panel--full">
      <header>
        <div>
          <span className="equipe-page__eyebrow">Comparativo das atividades</span>
          <h3>Percentual mensal por atividade</h3>
        </div>
        <span>Linha de referencia: 90%</span>
      </header>

      <div className="equipe-percentage-chart-scroll">
        <div
          className="equipe-percentage-chart"
          style={{ '--activity-count': Math.max(items.length, 8) }}
        >
          <div className="equipe-percentage-target" style={{ bottom: `${(90 / 110) * 100}%` }}>
            <span>90%</span>
          </div>

          {items.map((item) => {
            const capped = Math.min(110, Math.max(0, item.percent || 0));

            return (
              <article key={item.atividade}>
                <div className="equipe-percentage-bar-area">
                  <strong>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</strong>
                  <i
                    className={`is-${tonePercent(item.percent)}`}
                    style={{ height: item.percent == null ? '3%' : `${(capped / 110) * 100}%` }}
                  />
                </div>
                <span title={item.atividade}>{item.atividade}</span>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function CurveModal({ item, rows, year, month, selectedDate, onClose }) {
  const data = useMemo(() => {
    const working = businessDaysInMonth(year, month);
    const byDate = new Map();
    let cumulative = 0;

    rows
      .filter((row) => row.atividade === item.atividade)
      .forEach((row) => {
        byDate.set(
          row.data_apontamento,
          (byDate.get(row.data_apontamento) || 0) + num(row.qnt)
        );
      });

    return working.map((date, index) => {
      const iso = isoDate(year, month, date.getDate());
      if (iso <= selectedDate) cumulative += byDate.get(iso) || 0;

      return {
        day: date.getDate(),
        planned: item.hasMeta ? (item.meta / working.length) * (index + 1) : 0,
        realized: cumulative,
      };
    });
  }, [item, rows, year, month, selectedDate]);

  const total = item.realized;
  const remaining = item.hasMeta ? Math.max(0, item.meta - total) : null;
  const max = Math.max(item.hasMeta ? item.meta : 0, total, 1);
  const width = 760;
  const height = 270;
  const pad = { l: 42, r: 18, t: 18, b: 34 };

  const points = (key) =>
    data
      .map(
        (point, index) =>
          `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, data.length - 1))},${
            pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)
          }`
      )
      .join(' ');

  return (
    <div
      className="equipe-curve-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="equipe-curve-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="equipe-page__eyebrow">
              Curva S · {MONTHS[month - 1]} / {year}
            </span>
            <h3>{item.atividade}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="equipe-curve-cards">
          <article>
            <span>Meta mes</span>
            <strong>{item.hasMeta ? fmt(item.meta, 0) : '—'}</strong>
          </article>
          <article>
            <span>Total realizado</span>
            <strong>{fmt(total, 0)}</strong>
          </article>
          <article>
            <span>Restante</span>
            <strong>{remaining == null ? '—' : fmt(remaining, 0)}</strong>
          </article>
          <article className={`is-${tonePercent(item.percent)}`}>
            <span>Percentual</span>
            <strong>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</strong>
          </article>
        </div>

        <div className="equipe-curve-chart">
          <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            <line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} />
            <line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />
            {item.hasMeta && <polyline className="is-planned" points={points('planned')} />}
            <polyline className="is-realized" points={points('realized')} />
          </svg>
          <div className="equipe-curve-axis">
            <span>01</span>
            <span>{String(data.at(-1)?.day || '').padStart(2, '0')}</span>
          </div>
          <div className="equipe-curve-legend">
            {item.hasMeta && <span><i className="is-planned" />Planejado</span>}
            <span><i className="is-realized" />Realizado</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function EquipeHomeDashMensal({
  rows = [],
  goals = [],
  ano,
  mes,
  isLoading,
  error,
}) {
  const [curveItem, setCurveItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const monthDays = useMemo(() => {
    if (!ano || !mes) return [];

    const actualDaysInMonth = new Date(ano, mes, 0).getDate();

    return Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const available = day <= actualDaysInMonth;
      const date = available ? new Date(ano, mes - 1, day) : null;

      return {
        day,
        available,
        date: available ? isoDate(ano, mes, day) : null,
        weekday: available ? WEEKDAYS[date.getDay()] : '',
        weekend: available ? [0, 6].includes(date.getDay()) : false,
      };
    });
  }, [ano, mes]);

  const availableDates = useMemo(
    () => [...new Set(rows.map((row) => row.data_apontamento).filter(Boolean))].sort(),
    [rows]
  );

  const selectedDate = availableDates.at(-1) || isoDate(ano, mes, 1);
  const workingDays = useMemo(
    () => (ano && mes ? businessDaysInMonth(ano, mes) : []),
    [ano, mes]
  );

  const selectedDateObject = selectedDate ? new Date(`${selectedDate}T12:00:00`) : null;
  const remainingDays = selectedDateObject
    ? workingDays.filter((date) => date >= selectedDateObject).length
    : workingDays.length;

  const tableRows = useMemo(() => {
    if (!ano || !mes) return [];

    const goalMap = effectiveGoals(goals, ano, mes);
    const activities = new Set([
      ...goalMap.keys(),
      ...rows.map((row) => row.atividade).filter(Boolean),
    ]);

    return [...activities]
      .map((atividade) => {
        const goal = goalMap.get(atividade) || null;
        const meta = goal ? num(goal.meta) : 0;
        const hasMeta = meta > 0;
        const metaDay = hasMeta && workingDays.length ? meta / workingDays.length : null;
        const activityRows = rows.filter((row) => row.atividade === atividade);

        const days = Object.fromEntries(
          monthDays
            .filter((day) => day.available)
            .map((day) => {
              const dayRows = activityRows.filter(
                (row) => row.data_apontamento === day.date
              );

              return [
                day.date,
                dayRows.reduce((sum, row) => sum + num(row.qnt), 0),
              ];
            })
        );

        const realized = activityRows.reduce((sum, row) => sum + num(row.qnt), 0);
        const remaining = hasMeta ? Math.max(0, meta - realized) : null;
        const neededDay = hasMeta
          ? (remainingDays > 0 ? remaining / remainingDays : remaining)
          : null;
        const percent = hasMeta ? (realized / meta) * 100 : null;

        return {
          id: goal?.id || `monthly-${atividade}`,
          atividade,
          meta: hasMeta ? meta : null,
          hasMeta,
          metaDay,
          days,
          realized,
          remaining,
          neededDay,
          percent,
        };
      })
      .filter((item) => item.hasMeta || item.realized > 0)
      .sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano, mes, monthDays, workingDays, remainingDays]);

  const filteredTableRows = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    if (!search) return tableRows;

    return tableRows.filter((item) =>
      item.atividade.toLocaleLowerCase('pt-BR').includes(search)
    );
  }, [tableRows, searchTerm]);

  useEffect(() => {
    setCurveItem(null);
    setSearchTerm('');
  }, [ano, mes]);

  const tableWidthPx =
    DASH_MONTHLY_CONFIG.activityColumnPx +
    DASH_MONTHLY_CONFIG.metaDayColumnPx +
    monthDays.length * DASH_MONTHLY_CONFIG.dayColumnPx +
    DASH_MONTHLY_CONFIG.metaColumnPx +
    DASH_MONTHLY_CONFIG.realizedColumnPx +
    DASH_MONTHLY_CONFIG.remainingColumnPx +
    DASH_MONTHLY_CONFIG.neededDayColumnPx +
    DASH_MONTHLY_CONFIG.percentColumnPx;

  const styles = {
    '--monthly-table-header-px': `${DASH_MONTHLY_CONFIG.tableHeaderPx}px`,
    '--monthly-table-value-px': `${DASH_MONTHLY_CONFIG.tableValuePx}px`,
    '--monthly-activity-px': `${DASH_MONTHLY_CONFIG.activityPx}px`,
    '--monthly-day-header-px': `${DASH_MONTHLY_CONFIG.dayHeaderPx}px`,
    '--monthly-day-value-px': `${DASH_MONTHLY_CONFIG.dayValuePx}px`,
    '--monthly-percentage-text-px': `${DASH_MONTHLY_CONFIG.percentageTextPx}px`,
    '--monthly-row-height': `${DASH_MONTHLY_CONFIG.rowHeightPx}px`,
    '--monthly-table-width': `${tableWidthPx}px`,
    '--monthly-activity-width': `${DASH_MONTHLY_CONFIG.activityColumnPx}px`,
    '--monthly-day-width': `${DASH_MONTHLY_CONFIG.dayColumnPx}px`,
    '--monthly-meta-day-width': `${DASH_MONTHLY_CONFIG.metaDayColumnPx}px`,
    '--monthly-realized-width': `${DASH_MONTHLY_CONFIG.realizedColumnPx}px`,
    '--monthly-remaining-width': `${DASH_MONTHLY_CONFIG.remainingColumnPx}px`,
    '--monthly-needed-day-width': `${DASH_MONTHLY_CONFIG.neededDayColumnPx}px`,
    '--monthly-meta-width': `${DASH_MONTHLY_CONFIG.metaColumnPx}px`,
    '--monthly-percent-width': `${DASH_MONTHLY_CONFIG.percentColumnPx}px`,
    '--monthly-business-days-width': `${DASH_MONTHLY_CONFIG.businessDaysWidthPx}px`,
    '--monthly-business-days-bar-height': `${DASH_MONTHLY_CONFIG.businessDaysBarHeightPx}px`,
    '--monthly-good-bg': DASH_MONTHLY_CONFIG.achievedCellBg,
    '--monthly-good-border': DASH_MONTHLY_CONFIG.achievedCellBorder,
    '--monthly-good-text': DASH_MONTHLY_CONFIG.achievedCellText,
    '--monthly-warning-bg': DASH_MONTHLY_CONFIG.warningCellBg,
    '--monthly-warning-border': DASH_MONTHLY_CONFIG.warningCellBorder,
    '--monthly-warning-text': DASH_MONTHLY_CONFIG.warningCellText,
    '--monthly-neutral-bg': DASH_MONTHLY_CONFIG.neutralCellBg,
    '--monthly-neutral-text': DASH_MONTHLY_CONFIG.neutralCellText,
    '--monthly-weekend-text': DASH_MONTHLY_CONFIG.weekendHeaderText,
    '--monthly-weekend-bg': DASH_MONTHLY_CONFIG.weekendHeaderBg,
  };

  if (isLoading) {
    return <div className="equipe-dash__placeholder"><strong>Carregando visao mensal...</strong></div>;
  }

  if (error) {
    return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  }

  if (!tableRows.length) {
    return <div className="equipe-dash__placeholder"><strong>Nao existem avaliacoes ou metas neste periodo.</strong></div>;
  }

  return (
    <div className="equipe-monthly-dashboard" style={styles}>
      <section className="equipe-monthly-toolbar">
        <label className="equipe-search">
          <span className="sr-only">Buscar atividade</span>
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Buscar atividade"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              aria-label="Limpar busca"
            >
              ×
            </button>
          )}
        </label>
        <RemainingBusinessDays total={workingDays.length} remaining={remainingDays} />
      </section>

      <section className="equipe-monthly-grid-panel">
        <div className="equipe-monthly-grid-scroll">
          <table className="equipe-monthly-grid-table">
            <colgroup>
              <col className="col-activity" />
              <col style={{ width: 'var(--monthly-meta-day-width)' }} />
              {monthDays.map((day) => <col key={day.date} className="col-day" />)}
              <col className="col-meta" />
              <col className="col-realized" />
              <col style={{ width: 'var(--monthly-remaining-width)' }} />
              <col style={{ width: 'var(--monthly-needed-day-width)' }} />
              <col className="col-percent" />
            </colgroup>
            <thead>
              <tr>
                <th>Atividade</th>
                <th>Meta Dia</th>
                {monthDays.map((day) => (
                  <th
                    key={`day-header-${day.day}`}
                    className={`${day.weekend ? 'is-weekend' : ''} ${
                      !day.available ? 'is-unavailable' : ''
                    }`.trim()}
                  >
                    <strong>{String(day.day).padStart(2, '0')}</strong>
                    <small>{day.available ? day.weekday : '—'}</small>
                  </th>
                ))}
                <th>Meta</th>
                <th>Realizado</th>
                <th>Restante</th>
                <th>Necessario/Dia</th>
                <th>Percentual</th>
              </tr>
            </thead>
            <tbody>
              {filteredTableRows.map((item) => (
                <tr
                  key={item.id}
                  onClick={() => setCurveItem(item)}
                  title="Clique na linha para visualizar a Curva S"
                >
                  <td title={item.atividade}>{item.atividade}</td>
                  <td>{fmt(item.metaDay)}</td>
                  {monthDays.map((day) => {
                    const value = day.available ? item.days[day.date] || 0 : 0;
                    const state =
                      !day.available || value <= 0 || !item.hasMeta
                        ? 'is-neutral'
                        : value >= item.metaDay
                          ? 'is-good'
                          : 'is-warning';

                    return (
                      <td
                        key={`day-${item.id}-${day.day}`}
                        className={`is-day-result ${day.weekend ? 'is-weekend' : ''} ${
                          !day.available ? 'is-unavailable' : ''
                        } ${state}`.trim()}
                      >
                        <button
                          type="button"
                          disabled={!day.available || value <= 0}
                          aria-label={
                            day.available
                              ? `${item.atividade}, dia ${day.day}: ${fmt(value, 0)}`
                              : `Dia ${day.day} indisponivel neste mes`
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            if (day.available && value > 0) setCurveItem(item);
                          }}
                        >
                          {day.available ? (value > 0 ? fmt(value, 0) : '·') : ''}
                        </button>
                      </td>
                    );
                  })}
                  <td>{fmt(item.meta, 0)}</td>
                  <td className="is-realized">{fmt(item.realized, 0)}</td>
                  <td>{fmt(item.remaining, 0)}</td>
                  <td>{fmt(item.neededDay)}</td>
                  <td><MonthlyPercent percent={item.percent} /></td>
                </tr>
              ))}
              {filteredTableRows.length === 0 && (
                <tr>
                  <td
                    colSpan={monthDays.length + 7}
                    style={{ textAlign: 'center', color: 'var(--equipe-muted)' }}
                  >
                    Nenhuma atividade encontrada.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <footer className="equipe-monthly-legend">
          <span><i className="is-good" />Maior ou igual a Meta/Dia</span>
          <span><i className="is-warning" />Abaixo da Meta/Dia</span>
          <span><i className="is-neutral" />Sem realizado</span>
        </footer>
      </section>

      <div className="equipe-monthly-analytics">
        <PercentageChart items={filteredTableRows} />
      </div>

      {curveItem && (
        <CurveModal
          item={curveItem}
          rows={rows}
          year={ano}
          month={mes}
          selectedDate={selectedDate}
          onClose={() => setCurveItem(null)}
        />
      )}
    </div>
  );
}
