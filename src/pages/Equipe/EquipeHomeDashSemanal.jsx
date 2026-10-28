// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashSemanal
// Purpose: Dashboard semanal responsivo com metas, dias sem avaliacao, Curva S e detalhes.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './EquipeHomeDashSemanal.css';

const CFG = {
  tableHeaderPx: 11,
  tableValuePx: 12,
  activityPx: 12,
  dayHeaderPx: 12,
  dayValuePx: 10,
  periodButtonPx: 11,
  weekModalTitlePx: 16,
  detailTextPx: 11,
  lotTextPx: 10,
  percentageTextPx: 12,
  rowHeightPx: 40,
  minTableWidthPx: 1320,
  activityColumnPx: 250,
  staleColumnPx: 72,
  metaDayColumnPx: 80,
  dayColumnPx: 60,
  weekTotalColumnPx: 80,
  monthMetaColumnPx: 80,
  monthTotalColumnPx: 80,
  remainingColumnPx: 82,
  percentColumnPx: 220,
};

const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS = [
  { key: 'seg', label: 'SEG' },
  { key: 'ter', label: 'TER' },
  { key: 'qua', label: 'QUA' },
  { key: 'qui', label: 'QUI' },
  { key: 'sex', label: 'SEX' },
  { key: 'sab', label: 'SAB' },
  { key: 'dom', label: 'DOM' },
];

const num = (value) => Number(value || 0);
const fmt = (value, decimals = 1) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
const periodKey = (year, month) => Number(year) * 100 + Number(month);
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const parseDate = (value) => {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day, 12);
};
const formatDate = (value) => {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};
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
const businessDaysInMonth = (year, month) => Array.from(
  { length: new Date(year, month, 0).getDate() },
  (_, index) => new Date(year, month - 1, index + 1),
).filter((date) => ![0, 6].includes(date.getDay()));
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

const buildWeekDates = (rows, week) => {
  const weekRows = rows.filter((row) => Number(row.semana_iso) === Number(week));
  const reference = weekRows
    .map((row) => parseDate(row.data_apontamento))
    .filter(Boolean)
    .sort((a, b) => a - b)[0];

  if (!reference) return DAYS.map((day) => ({ ...day, date: null }));

  const monday = new Date(reference);
  monday.setDate(reference.getDate() + (reference.getDay() === 0 ? -6 : 1 - reference.getDay()));

  return DAYS.map((day, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return {
      ...day,
      date: isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()),
    };
  });
};

const latestDataDate = (rows) => rows
  .map((row) => row.data_apontamento)
  .filter(Boolean)
  .sort()
  .at(-1) || null;

const daysWithoutEvaluation = (activityRows, referenceDate) => {
  if (!referenceDate) return null;
  const lastActivityDate = activityRows
    .map((row) => row.data_apontamento)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
  return businessDaysBetween(lastActivityDate, referenceDate);
};

function StaleBadge({ days }) {
  return (
    <span
      className={`weekly-stale is-${staleTone(days)}`}
      title={days === 0 ? 'Atividade realizada na data mais recente da base' : `${days} dia(s) util(eis) sem avaliacao`}
    >
      {days == null ? '—' : days}
    </span>
  );
}

function WeeklyPercent({ percent }) {
  const capped = percent == null ? 0 : Math.min(110, Math.max(0, percent));
  const tone = tonePercent(percent);
  return (
    <div className="equipe-week-percent">
      <div className="equipe-week-percent__track">
        <i className={`is-${tone}`} style={{ width: `${(capped / 110) * 100}%` }} />
      </div>
      <strong className={`is-${tone}`}>{percent == null ? '—' : `${fmt(percent)}%`}</strong>
    </div>
  );
}

function WeekSelectorModal({ weeks, selectedWeek, month, year, onSelect, onClose }) {
  return (
    <div className="equipe-week-picker-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-week-picker-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="equipe-page__eyebrow">Periodo semanal</span>
            <h3>Selecionar semana</h3>
            <p>{MONTHS[month - 1]} / {year}</p>
          </div>
          <button type="button" onClick={onClose}>×</button>
        </header>
        <div className="equipe-week-picker-grid">
          {weeks.map((week) => (
            <button
              key={week}
              type="button"
              className={week === selectedWeek ? 'is-active' : ''}
              onClick={() => { onSelect(week); onClose(); }}
            >
              <span>Semana</span>
              <strong>{week}</strong>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function DayDetailModal({ detail, onClose }) {
  if (!detail) return null;
  const total = detail.rows.reduce((sum, row) => sum + num(row.qnt), 0);
  return (
    <div className="equipe-week-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-week-detail-modal">
        <header><div><span className="equipe-page__eyebrow">Detalhamento realizado</span><h3>{detail.activity}</h3><p>{formatDate(detail.date)} · {total.toLocaleString('pt-BR')} ponto(s)</p></div><button type="button" onClick={onClose}>×</button></header>
        <div className="equipe-week-detail-list">
          {detail.rows.slice().sort((a, b) => String(a.campo || a.nro_eb || '').localeCompare(String(b.campo || b.nro_eb || ''), 'pt-BR')).map((row, index) => {
            const isPump = row.nro_eb != null && String(row.nro_eb).trim() !== '';
            const location = isPump ? `Casa de Bomba ${row.nro_eb}` : `${row.codigo_campo ? `${row.codigo_campo} · ` : ''}${row.campo || 'Campo nao informado'}`;
            return <article key={row.id ?? `${location}-${index}`}><div><strong>{location}</strong>{!isPump && row.lotes && <small>Lotes: {row.lotes}</small>}</div><b>{num(row.qnt).toLocaleString('pt-BR')}</b></article>;
          })}
        </div>
        <footer><span>{detail.rows.length} registro(s)</span><button type="button" className="equipe-button equipe-button--ghost" onClick={onClose}>Fechar</button></footer>
      </section>
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
  const total = item.monthTotal;
  const remaining = item.hasMeta ? Math.max(0, item.meta - total) : null;
  const percent = item.percent;
  const max = Math.max(item.hasMeta ? item.meta : 0, total, 1);
  const width = 760;
  const height = 270;
  const pad = { l: 42, r: 18, t: 18, b: 34 };
  const points = (key) => data.map((point, index) => `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, data.length - 1))},${pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)}`).join(' ');
  return (
    <div className="equipe-curve-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-curve-modal">
        <header><div><span className="equipe-page__eyebrow">Curva S · {MONTHS[month - 1]} / {year}</span><h3>{item.atividade}</h3></div><button type="button" onClick={onClose}>×</button></header>
        <div className="equipe-curve-cards"><article><span>Meta mes</span><strong>{item.hasMeta ? fmt(item.meta, 0) : '—'}</strong></article><article><span>Total realizado</span><strong>{fmt(total, 0)}</strong></article><article><span>Restante</span><strong>{fmt(remaining, 0)}</strong></article><article className={`is-${tonePercent(percent)}`}><span>Percentual</span><strong>{percent == null ? '—' : `${fmt(percent)}%`}</strong></article></div>
        <div className="equipe-curve-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} /><line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />{item.hasMeta && <polyline className="is-planned" points={points('planned')} />}<polyline className="is-realized" points={points('realized')} /></svg><div className="equipe-curve-axis"><span>01</span><span>{String(data.at(-1)?.day || '').padStart(2, '0')}</span></div><div className="equipe-curve-legend">{item.hasMeta && <span><i className="is-planned" />Planejado</span>}<span><i className="is-realized" />Realizado</span></div></div>
      </section>
    </div>
  );
}

function WeeklyCell({ item, day, onOpen }) {
  const result = item.days[day.key];
  const hasValue = result.total > 0;
  const reached = hasValue && item.hasMeta ? result.total >= item.metaDay : null;
  const state = !hasValue || !item.hasMeta ? 'is-neutral' : reached ? 'is-good' : 'is-warning';
  return <td className={`is-day-result ${['sab', 'dom'].includes(day.key) ? 'is-weekend' : ''} ${state}`}><button type="button" disabled={!hasValue} className="equipe-week-grid-value" onClick={(event) => { event.stopPropagation(); if (hasValue) onOpen({ activity: item.atividade, date: day.date, rows: result.rows }); }}>{hasValue ? fmt(result.total, 0) : '·'}</button></td>;
}

function WeeklyMobileCards({ items, days, onDetail, onCurve }) {
  return (
    <div className="weekly-mobile-list">
      {items.map((item) => (
        <article key={item.id} className={`weekly-mobile-card ${item.weekTotal > 0 ? 'is-done' : 'is-empty'}`}>
          <button type="button" className="weekly-mobile-card__head" onClick={() => onCurve(item)}><strong>{item.atividade}</strong><StaleBadge days={item.daysWithoutEvaluation} /></button>
          <div className="weekly-mobile-days">
            {days.map((day) => {
              const result = item.days[day.key];
              const hasValue = result.total > 0;
              const reached = hasValue && item.hasMeta ? result.total >= item.metaDay : null;
              const state = !hasValue || !item.hasMeta ? 'is-neutral' : reached ? 'is-good' : 'is-warning';
              return <button type="button" key={day.key} disabled={!hasValue} className={`${state} ${['sab', 'dom'].includes(day.key) ? 'is-weekend' : ''}`} onClick={() => hasValue && onDetail({ activity: item.atividade, date: day.date, rows: result.rows })}><small>{day.label}</small><b>{hasValue ? fmt(result.total, 0) : '·'}</b></button>;
            })}
          </div>
          <div className="weekly-mobile-summary"><span><small>Meta/Dia</small><b>{fmt(item.metaDay)}</b></span><span><small>Total Sem.</small><b>{fmt(item.weekTotal, 0)}</b></span><span><small>Meta Mês</small><b>{fmt(item.meta, 0)}</b></span><span><small>Total Mês</small><b>{fmt(item.monthTotal, 0)}</b></span><span><small>Restante</small><b>{fmt(item.remaining, 0)}</b></span></div>
          <WeeklyPercent percent={item.percent} />
        </article>
      ))}
    </div>
  );
}

export default function EquipeHomeDashSemanal({ rows = [], goals = [], ano, mes, isLoading, error }) {
  const tableWidth = CFG.activityColumnPx + CFG.staleColumnPx + CFG.metaDayColumnPx + CFG.dayColumnPx * 7 + CFG.weekTotalColumnPx + CFG.monthMetaColumnPx + CFG.monthTotalColumnPx + CFG.remainingColumnPx + CFG.percentColumnPx;
  const styles = {
    '--weekly-table-header-px': `${CFG.tableHeaderPx}px`, '--weekly-table-value-px': `${CFG.tableValuePx}px`, '--weekly-activity-px': `${CFG.activityPx}px`, '--weekly-day-header-px': `${CFG.dayHeaderPx}px`, '--weekly-day-value-px': `${CFG.dayValuePx}px`, '--weekly-period-button-px': `${CFG.periodButtonPx}px`, '--weekly-modal-title-px': `${CFG.weekModalTitlePx}px`, '--weekly-detail-text-px': `${CFG.detailTextPx}px`, '--weekly-lot-text-px': `${CFG.lotTextPx}px`, '--weekly-percentage-text-px': `${CFG.percentageTextPx}px`, '--weekly-row-height': `${CFG.rowHeightPx}px`, '--weekly-table-width': `${Math.max(tableWidth, CFG.minTableWidthPx)}px`, '--weekly-activity-width': `${CFG.activityColumnPx}px`, '--weekly-stale-width': `${CFG.staleColumnPx}px`, '--weekly-meta-day-width': `${CFG.metaDayColumnPx}px`, '--weekly-day-width': `${CFG.dayColumnPx}px`, '--weekly-week-total-width': `${CFG.weekTotalColumnPx}px`, '--weekly-month-meta-width': `${CFG.monthMetaColumnPx}px`, '--weekly-month-total-width': `${CFG.monthTotalColumnPx}px`, '--weekly-remaining-width': `${CFG.remainingColumnPx}px`, '--weekly-percent-width': `${CFG.percentColumnPx}px`,
  };
  const weeks = useMemo(() => [...new Set(rows.map((row) => Number(row.semana_iso)).filter(Number.isFinite))].sort((a, b) => a - b), [rows]);
  const [selectedWeek, setSelectedWeek] = useState(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [curveItem, setCurveItem] = useState(null);
  useEffect(() => { setSelectedWeek(weeks.at(-1) || null); setDetail(null); setCurveItem(null); }, [ano, mes, weeks.join('|')]);
  const days = useMemo(() => buildWeekDates(rows, selectedWeek), [rows, selectedWeek]);
  const globalReferenceDate = useMemo(() => latestDataDate(rows), [rows]);
  const tableRows = useMemo(() => {
    if (!selectedWeek || !ano || !mes) return [];
    const goalMap = effectiveGoals(goals, ano, mes);
    const weekRows = rows.filter((row) => Number(row.semana_iso) === Number(selectedWeek));
    const activities = new Set([...goalMap.keys(), ...weekRows.map((row) => row.atividade).filter(Boolean)]);
    const workingDays = businessDaysInMonth(ano, mes).length;
    const weekEnd = days.map((day) => day.date).filter(Boolean).sort().at(-1) || '';
    return [...activities].map((atividade) => {
      const goal = goalMap.get(atividade);
      const meta = goal ? num(goal.meta) : 0;
      const hasMeta = meta > 0;
      const metaDay = hasMeta && workingDays ? meta / workingDays : null;
      const activityMonth = rows.filter((row) => row.atividade === atividade);
      const activityWeek = weekRows.filter((row) => row.atividade === atividade);
      const dayData = Object.fromEntries(days.map((day) => {
        const detailRows = day.date ? activityWeek.filter((row) => row.data_apontamento === day.date) : [];
        return [day.key, { rows: detailRows, total: detailRows.reduce((sum, row) => sum + num(row.qnt), 0) }];
      }));
      const weekTotal = activityWeek.reduce((sum, row) => sum + num(row.qnt), 0);
      const monthTotal = activityMonth.filter((row) => !weekEnd || row.data_apontamento <= weekEnd).reduce((sum, row) => sum + num(row.qnt), 0);
      const remaining = hasMeta ? Math.max(0, meta - monthTotal) : null;
      const percent = hasMeta ? (monthTotal / meta) * 100 : null;
      const stale = daysWithoutEvaluation(activityMonth, globalReferenceDate);
      return { id: goal?.id || `weekly-${atividade}`, atividade, meta: hasMeta ? meta : null, hasMeta, metaDay, days: dayData, weekTotal, monthTotal, remaining, percent, daysWithoutEvaluation: stale };
    }).filter((item) => item.hasMeta || item.weekTotal > 0).sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano, mes, selectedWeek, days, globalReferenceDate]);
  const weekEnd = days.map((day) => day.date).filter(Boolean).sort().at(-1) || '';
  if (isLoading) return <div className="equipe-dash__placeholder"><strong>Carregando visao semanal...</strong></div>;
  if (error) return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  if (!weeks.length) return <div className="equipe-dash__placeholder"><strong>Nao existem semanas avaliadas neste periodo.</strong></div>;
  return (
    <div className="equipe-weekly-dashboard" style={styles}>
      <section className="equipe-weekly-toolbar"><div><h3>Semana {selectedWeek} - {MONTHS[mes - 1]} / {ano}</h3><p>{formatDate(days[0]?.date)} ate {formatDate(days.at(-1)?.date)} · Sem Av. calculado ate {formatDate(globalReferenceDate)}</p></div><button type="button" className="equipe-week-picker-button" onClick={() => setPickerOpen(true)}><span>Semana</span><strong>{selectedWeek}</strong></button></section>
      <section className="equipe-weekly-grid-panel">
        <div className="equipe-weekly-grid-scroll">
          <table className="equipe-weekly-grid-table">
            <colgroup><col className="col-activity" /><col className="col-stale" /><col className="col-meta-day" />{days.map((day) => <col key={day.key} className="col-day" />)}<col className="col-week-total" /><col className="col-month-meta" /><col className="col-month-total" /><col className="col-remaining" /><col className="col-percent" /></colgroup>
            <thead><tr><th>Atividade</th><th>Sem Av.</th><th>Meta/Dia</th>{days.map((day) => <th key={day.key} className={['sab', 'dom'].includes(day.key) ? 'is-weekend' : ''}><strong>{day.label}</strong><small>{day.date?.slice(8, 10) || '—'}</small></th>)}<th>Total Sem.</th><th>Meta Mes</th><th>Total Mes</th><th>Restante</th><th>Percentual</th></tr></thead>
            <tbody>{tableRows.map((item) => <tr key={item.id} className={item.weekTotal > 0 ? 'is-done-week' : 'is-empty-week'} onClick={() => setCurveItem(item)}><td>{item.atividade}</td><td><StaleBadge days={item.daysWithoutEvaluation} /></td><td>{fmt(item.metaDay)}</td>{days.map((day) => <WeeklyCell key={day.key} item={item} day={day} onOpen={setDetail} />)}<td className="is-week-total">{fmt(item.weekTotal, 0)}</td><td>{fmt(item.meta, 0)}</td><td>{fmt(item.monthTotal, 0)}</td><td>{fmt(item.remaining, 0)}</td><td><WeeklyPercent percent={item.percent} /></td></tr>)}</tbody>
          </table>
        </div>
        <WeeklyMobileCards items={tableRows} days={days} onDetail={setDetail} onCurve={setCurveItem} />
        <footer className="equipe-weekly-legend"><span><i className="is-good" />Atingiu a Meta/Dia</span><span><i className="is-warning" />Abaixo da Meta/Dia</span><span><i className="is-stale" />Sem avaliação</span></footer>
      </section>
      {pickerOpen && <WeekSelectorModal weeks={weeks} selectedWeek={selectedWeek} month={mes} year={ano} onSelect={setSelectedWeek} onClose={() => setPickerOpen(false)} />}
      <DayDetailModal detail={detail} onClose={() => setDetail(null)} />
      {curveItem && <CurveModal item={curveItem} rows={rows} year={ano} month={mes} selectedDate={weekEnd} onClose={() => setCurveItem(null)} />}
    </div>
  );
}
