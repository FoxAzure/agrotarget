// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashMensal
// Purpose: Dashboard mensal responsivo com grade desktop e selecao por atividade no mobile.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './EquipeHomeDashMensal.css';

const CFG = {
  tableHeaderPx: 10,
  tableValuePx: 10,
  activityPx: 11,
  dayHeaderPx: 10,
  dayValuePx: 10,
  percentageTextPx: 11,
  rowHeightPx: 38,
  activityColumnPx: 170,
  staleColumnPx: 68,
  dayColumnPx: 36,
  metaDayColumnPx: 70,
  realizedColumnPx: 80,
  remainingColumnPx: 80,
  neededDayColumnPx: 105,
  metaColumnPx: 82,
  percentColumnPx: 210,
  businessDaysWidthPx: 500,
  businessDaysBarHeightPx: 10,
};

const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SAB'];
const WEEKDAYS_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const num = (value) => Number(value || 0);
const fmt = (value, decimals = 1) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const parseDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const periodKey = (year, month) => Number(year) * 100 + Number(month);
const businessDaysInMonth = (year, month) => Array.from(
  { length: new Date(year, month, 0).getDate() },
  (_, index) => new Date(year, month - 1, index + 1),
).filter((date) => ![0, 6].includes(date.getDay()));
const businessDaysBetween = (startIso, endIso) => {
  if (!endIso) return null;
  const end = parseDate(endIso);
  const start = startIso ? parseDate(startIso) : null;
  if (!end) return null;
  if (start && start >= end) return 0;
  let count = 0;
  const cursor = start ? new Date(start) : new Date(end.getFullYear(), end.getMonth(), 1, 12);
  cursor.setDate(cursor.getDate() + (start ? 1 : 0));
  while (cursor <= end) {
    if (![0, 6].includes(cursor.getDay())) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};
const tonePercent = (percent) => percent == null ? 'neutral' : percent > 110 ? 'blue' : percent >= 90 ? 'green' : percent >= 80 ? 'yellow' : 'red';
const staleTone = (days) => days == null ? 'neutral' : days === 0 ? 'fresh' : days === 1 ? 'attention' : days <= 3 ? 'warning' : 'critical';
const effectiveGoals = (goals, year, month) => {
  const limit = periodKey(year, month);
  const map = new Map();
  (goals || [])
    .filter((goal) => periodKey(goal.ano, goal.mes) <= limit)
    .sort((a, b) => periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) || Number(a.id) - Number(b.id))
    .forEach((goal) => map.set(goal.atividade, goal));
  return map;
};

function StaleBadge({ days }) {
  return <span className={`monthly-stale is-${staleTone(days)}`}>{days == null ? '—' : days}</span>;
}

function RemainingBusinessDays({ total, remaining }) {
  const width = Math.max(0, Math.min(100, (remaining / Math.max(1, total)) * 100));
  return (
    <div className="equipe-month-business-days">
      <div className="equipe-month-business-days__text"><strong>{total} dias uteis totais</strong><span>/</span><b>{remaining} dias uteis restantes</b></div>
      <div className="equipe-month-business-days__track"><i style={{ width: `${width}%` }} /></div>
    </div>
  );
}

function MonthlyPercent({ percent }) {
  const capped = percent == null ? 0 : Math.min(110, Math.max(0, percent));
  const tone = tonePercent(percent);
  return (
    <div className="equipe-month-percent">
      <div className="equipe-month-percent__track"><i className={`is-${tone}`} style={{ width: `${(capped / 110) * 100}%` }} /></div>
      <strong className={`is-${tone}`}>{percent == null ? '—' : `${fmt(percent)}%`}</strong>
    </div>
  );
}

function CurveModal({ item, rows, year, month, selectedDate, onClose }) {
  const data = useMemo(() => {
    const working = businessDaysInMonth(year, month);
    const byDate = new Map();
    let cumulative = 0;
    rows.filter((row) => row.atividade === item.atividade).forEach((row) => byDate.set(row.data_apontamento, (byDate.get(row.data_apontamento) || 0) + num(row.qnt)));
    return working.map((date, index) => {
      const iso = isoDate(year, month, date.getDate());
      if (iso <= selectedDate) cumulative += byDate.get(iso) || 0;
      return { day: date.getDate(), planned: item.hasMeta ? (item.meta / working.length) * (index + 1) : 0, realized: cumulative };
    });
  }, [item, rows, year, month, selectedDate]);

  const total = item.realized;
  const max = Math.max(item.hasMeta ? item.meta : 0, total, 1);
  const width = 760;
  const height = 270;
  const pad = { l: 42, r: 18, t: 18, b: 34 };
  const points = (key) => data.map((point, index) => `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, data.length - 1))},${pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)}`).join(' ');

  return (
    <div className="equipe-curve-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-curve-modal" role="dialog" aria-modal="true">
        <header><div><span className="equipe-page__eyebrow">Curva S · {MONTHS[month - 1]} / {year}</span><h3>{item.atividade}</h3></div><button type="button" onClick={onClose}>×</button></header>
        <div className="equipe-curve-cards"><article><span>Meta mes</span><strong>{fmt(item.meta, 0)}</strong></article><article><span>Total realizado</span><strong>{fmt(total, 0)}</strong></article><article><span>Restante</span><strong>{fmt(item.remaining, 0)}</strong></article><article className={`is-${tonePercent(item.percent)}`}><span>Percentual</span><strong>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</strong></article></div>
        <div className="equipe-curve-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} /><line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />{item.hasMeta && <polyline className="is-planned" points={points('planned')} />}<polyline className="is-realized" points={points('realized')} /></svg><div className="equipe-curve-axis"><span>01</span><span>{String(data.at(-1)?.day || '').padStart(2, '0')}</span></div><div className="equipe-curve-legend">{item.hasMeta && <span><i className="is-planned" />Planejado</span>}<span><i className="is-realized" />Realizado</span></div></div>
      </section>
    </div>
  );
}

function MobileActivitySelector({ items, selectedId, onSelect }) {
  return (
    <section className="monthly-mobile-selector">
      <header><div><span className="equipe-page__eyebrow">Selecionar atividade</span><h3>{selectedId ? 'Toque novamente para desmarcar' : 'Escolha uma atividade'}</h3></div><b>{items.length}</b></header>
      <div className="monthly-mobile-selector__list">
        {items.map((item) => (
          <button type="button" key={item.id} className={selectedId === item.id ? 'is-active' : ''} onClick={() => onSelect(selectedId === item.id ? null : item.id)}>
            <strong>{item.atividade}</strong>
            <span><small>Sem Av.</small><StaleBadge days={item.daysWithoutEvaluation} /></span>
            <span><small>Meta</small><b>{fmt(item.meta, 0)}</b></span>
            <span><small>Realizado</small><b>{fmt(item.realized, 0)}</b></span>
            <span><small>Restante</small><b>{fmt(item.remaining, 0)}</b></span>
            <span className={`is-percent is-${tonePercent(item.percent)}`}><small>Percentual</small><b>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</b></span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MobileCalendar({ item, monthDays, year, month }) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  return (
    <section className="monthly-mobile-calendar">
      <header><div><span className="equipe-page__eyebrow">Calendario mensal</span><h3>{item ? item.atividade : `${MONTHS[month - 1]} / ${year}`}</h3></div>{item && <span>Meta/Dia {fmt(item.metaDay)}</span>}</header>
      <div className="monthly-mobile-calendar__weekdays">{WEEKDAYS_SHORT.map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}</div>
      <div className="monthly-mobile-calendar__grid">
        {Array.from({ length: firstDay }, (_, index) => <i key={`blank-${index}`} />)}
        {monthDays.filter((day) => day.available).map((day) => {
          const value = item ? item.days[day.date] || 0 : 0;
          const state = !item || value <= 0 || !item.hasMeta ? 'is-neutral' : value >= item.metaDay ? 'is-good' : 'is-warning';
          return <article key={day.date} className={`${state} ${day.weekend ? 'is-weekend' : ''}`}><small>{day.day}</small><strong>{item ? (value > 0 ? fmt(value, 0) : '·') : '·'}</strong></article>;
        })}
      </div>
      {!item && <p>Selecione uma atividade acima para visualizar os resultados por dia.</p>}
    </section>
  );
}

function MobileSummary({ item, onCurve }) {
  if (!item) return null;
  return (
    <section className="monthly-mobile-summary">
      <header><div><span className="equipe-page__eyebrow">Resumo da atividade</span><h3>{item.atividade}</h3></div><button type="button" onClick={() => onCurve(item)}>Curva S</button></header>
      <div className="monthly-mobile-summary__metrics"><span><small>Meta/Dia</small><b>{fmt(item.metaDay)}</b></span><span><small>Nec./Dia</small><b>{fmt(item.neededDay)}</b></span><span><small>Realizado</small><b>{fmt(item.realized, 0)}</b></span><span><small>Meta</small><b>{fmt(item.meta, 0)}</b></span><span><small>Restante</small><b>{fmt(item.remaining, 0)}</b></span></div>
      <MonthlyPercent percent={item.percent} />
    </section>
  );
}

export default function EquipeHomeDashMensal({ rows = [], goals = [], ano, mes, isLoading, error }) {
  const [curveItem, setCurveItem] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivityId, setSelectedActivityId] = useState(null);

  const monthDays = useMemo(() => {
    if (!ano || !mes) return [];
    const total = new Date(ano, mes, 0).getDate();
    return Array.from({ length: 31 }, (_, index) => {
      const day = index + 1;
      const available = day <= total;
      const date = available ? new Date(ano, mes - 1, day) : null;
      return { day, available, date: available ? isoDate(ano, mes, day) : null, weekday: available ? WEEKDAYS[date.getDay()] : '', weekend: available ? [0, 6].includes(date.getDay()) : false };
    });
  }, [ano, mes]);

  const availableDates = useMemo(() => [...new Set(rows.map((row) => row.data_apontamento).filter(Boolean))].sort(), [rows]);
  const selectedDate = availableDates.at(-1) || isoDate(ano, mes, 1);
  const workingDays = useMemo(() => ano && mes ? businessDaysInMonth(ano, mes) : [], [ano, mes]);
  const selectedDateObject = parseDate(selectedDate);
  const remainingDays = selectedDateObject ? workingDays.filter((date) => date >= selectedDateObject).length : workingDays.length;

  const tableRows = useMemo(() => {
    if (!ano || !mes) return [];
    const goalMap = effectiveGoals(goals, ano, mes);
    const activities = new Set([...goalMap.keys(), ...rows.map((row) => row.atividade).filter(Boolean)]);
    return [...activities].map((atividade) => {
      const goal = goalMap.get(atividade) || null;
      const meta = goal ? num(goal.meta) : 0;
      const hasMeta = meta > 0;
      const metaDay = hasMeta && workingDays.length ? meta / workingDays.length : null;
      const activityRows = rows.filter((row) => row.atividade === atividade);
      const days = Object.fromEntries(monthDays.filter((day) => day.available).map((day) => [day.date, activityRows.filter((row) => row.data_apontamento === day.date).reduce((sum, row) => sum + num(row.qnt), 0)]));
      const realized = activityRows.reduce((sum, row) => sum + num(row.qnt), 0);
      const remaining = hasMeta ? Math.max(0, meta - realized) : null;
      const neededDay = hasMeta ? (remainingDays > 0 ? remaining / remainingDays : remaining) : null;
      const percent = hasMeta ? (realized / meta) * 100 : null;
      const lastActivityDate = activityRows.map((row) => row.data_apontamento).filter(Boolean).sort().at(-1) || null;
      const stale = businessDaysBetween(lastActivityDate, selectedDate);
      return { id: goal?.id || `monthly-${atividade}`, atividade, meta: hasMeta ? meta : null, hasMeta, metaDay, days, realized, remaining, neededDay, percent, daysWithoutEvaluation: stale };
    }).filter((item) => item.hasMeta || item.realized > 0).sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano, mes, monthDays, workingDays, remainingDays, selectedDate]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return search ? tableRows.filter((item) => item.atividade.toLocaleLowerCase('pt-BR').includes(search)) : tableRows;
  }, [tableRows, searchTerm]);

  const selectedActivity = tableRows.find((item) => item.id === selectedActivityId) || null;

  useEffect(() => {
    setCurveItem(null);
    setSearchTerm('');
    setSelectedActivityId(null);
  }, [ano, mes]);

  const tableWidth = CFG.activityColumnPx + CFG.staleColumnPx + CFG.metaDayColumnPx + monthDays.length * CFG.dayColumnPx + CFG.metaColumnPx + CFG.realizedColumnPx + CFG.remainingColumnPx + CFG.neededDayColumnPx + CFG.percentColumnPx;
  const styles = {
    '--monthly-table-header-px': `${CFG.tableHeaderPx}px`, '--monthly-table-value-px': `${CFG.tableValuePx}px`, '--monthly-activity-px': `${CFG.activityPx}px`, '--monthly-day-header-px': `${CFG.dayHeaderPx}px`, '--monthly-day-value-px': `${CFG.dayValuePx}px`, '--monthly-percentage-text-px': `${CFG.percentageTextPx}px`, '--monthly-row-height': `${CFG.rowHeightPx}px`, '--monthly-table-width': `${tableWidth}px`, '--monthly-activity-width': `${CFG.activityColumnPx}px`, '--monthly-stale-width': `${CFG.staleColumnPx}px`, '--monthly-day-width': `${CFG.dayColumnPx}px`, '--monthly-meta-day-width': `${CFG.metaDayColumnPx}px`, '--monthly-realized-width': `${CFG.realizedColumnPx}px`, '--monthly-remaining-width': `${CFG.remainingColumnPx}px`, '--monthly-needed-day-width': `${CFG.neededDayColumnPx}px`, '--monthly-meta-width': `${CFG.metaColumnPx}px`, '--monthly-percent-width': `${CFG.percentColumnPx}px`, '--monthly-business-days-width': `${CFG.businessDaysWidthPx}px`, '--monthly-business-days-bar-height': `${CFG.businessDaysBarHeightPx}px`,
  };

  if (isLoading) return <div className="equipe-dash__placeholder"><strong>Carregando visao mensal...</strong></div>;
  if (error) return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  if (!tableRows.length) return <div className="equipe-dash__placeholder"><strong>Nao existem avaliacoes ou metas neste periodo.</strong></div>;

  return (
    <div className="equipe-monthly-dashboard" style={styles}>
      <section className="equipe-monthly-toolbar">
        <label className="equipe-search"><span className="sr-only">Buscar atividade</span><input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar atividade" />{searchTerm && <button type="button" onClick={() => setSearchTerm('')}>×</button>}</label>
        <RemainingBusinessDays total={workingDays.length} remaining={remainingDays} />
      </section>

      <MobileActivitySelector items={filteredRows} selectedId={selectedActivityId} onSelect={setSelectedActivityId} />
      <MobileCalendar item={selectedActivity} monthDays={monthDays} year={ano} month={mes} />
      <MobileSummary item={selectedActivity} onCurve={setCurveItem} />

      <section className="equipe-monthly-grid-panel">
        <div className="equipe-monthly-grid-scroll">
          <table className="equipe-monthly-grid-table">
            <colgroup><col className="col-activity" /><col className="col-stale" /><col className="col-meta-day" />{monthDays.map((day) => <col key={`col-${day.day}`} className="col-day" />)}<col className="col-meta" /><col className="col-realized" /><col className="col-remaining" /><col className="col-needed" /><col className="col-percent" /></colgroup>
            <thead><tr><th>Atividade</th><th>Sem Av.</th><th>Meta Dia</th>{monthDays.map((day) => <th key={`head-${day.day}`} className={`${day.weekend ? 'is-weekend' : ''} ${!day.available ? 'is-unavailable' : ''}`}><strong>{String(day.day).padStart(2, '0')}</strong><small>{day.available ? day.weekday : '—'}</small></th>)}<th>Meta</th><th>Realizado</th><th>Restante</th><th>Necessario/Dia</th><th>Percentual</th></tr></thead>
            <tbody>{filteredRows.map((item) => <tr key={item.id} className={item.realized > 0 ? 'is-done-month' : 'is-empty-month'} onClick={() => setCurveItem(item)}><td>{item.atividade}</td><td><StaleBadge days={item.daysWithoutEvaluation} /></td><td>{fmt(item.metaDay)}</td>{monthDays.map((day) => { const value = day.available ? item.days[day.date] || 0 : 0; const state = !day.available || value <= 0 || !item.hasMeta ? 'is-neutral' : value >= item.metaDay ? 'is-good' : 'is-warning'; return <td key={`${item.id}-${day.day}`} className={`is-day-result ${day.weekend ? 'is-weekend' : ''} ${!day.available ? 'is-unavailable' : ''} ${state}`}><button type="button" disabled={!day.available || value <= 0} onClick={(event) => { event.stopPropagation(); if (value > 0) setCurveItem(item); }}>{day.available ? (value > 0 ? fmt(value, 0) : '·') : ''}</button></td>; })}<td>{fmt(item.meta, 0)}</td><td className="is-realized">{fmt(item.realized, 0)}</td><td>{fmt(item.remaining, 0)}</td><td>{fmt(item.neededDay)}</td><td><MonthlyPercent percent={item.percent} /></td></tr>)}</tbody>
          </table>
        </div>
        <footer className="equipe-monthly-legend"><span><i className="is-good" />Maior ou igual a Meta/Dia</span><span><i className="is-warning" />Abaixo da Meta/Dia</span><span><i className="is-neutral" />Sem realizado</span></footer>
      </section>

      {curveItem && <CurveModal item={curveItem} rows={rows} year={ano} month={mes} selectedDate={selectedDate} onClose={() => setCurveItem(null)} />}
    </div>
  );
}
