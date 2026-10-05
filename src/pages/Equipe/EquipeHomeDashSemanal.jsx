// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashSemanal
// Purpose: Dashboard semanal em grade, com metas, Curva S e detalhes por local.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';

const DASH_WEEKLY_CONFIG = {
  tableHeaderPx: 11,
  tableValuePx: 12,
  activityPx: 12,
  dayHeaderPx: 12,
  dayValuePx: 10,
  periodButtonPx: 11,
  weekModalTitlePx: 16,
  detailTitlePx: 13,
  detailTextPx: 11,
  lotTextPx: 9,
  percentageTextPx: 12,
  rowHeightPx: 38,
  activityColumnPx: 250,
  metaDayColumnPx: 80,
  dayColumnPx: 60,
  weekTotalColumnPx: 80,
  monthMetaColumnPx: 80,
  monthTotalColumnPx: 80,
  percentColumnPx: 235,
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

const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const DAYS = [
  { key: 'seg', label: 'SEG', jsDay: 1 }, { key: 'ter', label: 'TER', jsDay: 2 },
  { key: 'qua', label: 'QUA', jsDay: 3 }, { key: 'qui', label: 'QUI', jsDay: 4 },
  { key: 'sex', label: 'SEX', jsDay: 5 }, { key: 'sab', label: 'SAB', jsDay: 6 },
  { key: 'dom', label: 'DOM', jsDay: 0 },
];

const num = (value) => Number(value || 0);
const fmt = (value, decimals = 1) => value == null || !Number.isFinite(Number(value)) ? '—' : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const periodKey = (year, month) => Number(year) * 100 + Number(month);
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const businessDaysInMonth = (year, month) => Array.from({ length: new Date(year, month, 0).getDate() }, (_, index) => new Date(year, month - 1, index + 1)).filter((date) => ![0, 6].includes(date.getDay()));
const parseDate = (value) => { if (!value) return null; const [year, month, day] = String(value).slice(0, 10).split('-').map(Number); return new Date(year, month - 1, day, 12); };
const formatDate = (value) => { if (!value) return '—'; const [year, month, day] = String(value).slice(0, 10).split('-'); return `${day}/${month}/${year}`; };
const tonePercent = (percent) => { if (percent == null) return 'neutral'; if (percent > 110) return 'blue'; if (percent >= 90) return 'green'; if (percent >= 80) return 'yellow'; return 'red'; };

const effectiveGoals = (goals, year, month) => {
  const limit = periodKey(year, month);
  const map = new Map();
  (goals || []).filter((goal) => periodKey(goal.ano, goal.mes) <= limit)
    .sort((a, b) => periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) || Number(a.id) - Number(b.id))
    .forEach((goal) => map.set(goal.atividade, goal));
  return map;
};

const buildWeekDates = (rows, week) => {
  const weekRows = rows.filter((row) => Number(row.semana_iso) === Number(week));
  const reference = weekRows.map((row) => parseDate(row.data_apontamento)).filter(Boolean).sort((a, b) => a - b)[0];
  if (!reference) return DAYS.map((day) => ({ ...day, date: null }));
  const monday = new Date(reference);
  monday.setDate(reference.getDate() + (reference.getDay() === 0 ? -6 : 1 - reference.getDay()));
  return DAYS.map((day, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return { ...day, date: isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate()) }; });
};

function WeekSelectorModal({ weeks, selectedWeek, month, year, onSelect, onClose }) {
  return <div className="equipe-week-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="equipe-week-picker-modal" role="dialog" aria-modal="true">
      <header><div><span className="equipe-page__eyebrow">Periodo semanal</span><h3>Selecionar semana</h3><p>{MONTHS[month - 1]} / {year}</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="equipe-week-picker-grid">{weeks.map((week) => <button key={week} type="button" className={week === selectedWeek ? 'is-active' : ''} onClick={() => { onSelect(week); onClose(); }}><span>Semana</span><strong>{week}</strong></button>)}</div>
    </section>
  </div>;
}

function DayDetailModal({ detail, onClose }) {
  if (!detail) return null;
  const total = detail.rows.reduce((sum, row) => sum + num(row.qnt), 0);
  return <div className="equipe-week-detail-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="equipe-week-detail-modal" role="dialog" aria-modal="true">
      <header><div><span className="equipe-page__eyebrow">Detalhamento realizado</span><h3>{detail.activity}</h3><p>{formatDate(detail.date)} · {total.toLocaleString('pt-BR')} ponto(s)</p></div><button type="button" onClick={onClose}>×</button></header>
      <div className="equipe-week-detail-list">{detail.rows.slice().sort((a, b) => String(a.campo || a.nro_eb || '').localeCompare(String(b.campo || b.nro_eb || ''), 'pt-BR')).map((row, index) => {
        const isPump = row.nro_eb != null && String(row.nro_eb).trim() !== '';
        const location = isPump ? `Casa de Bomba ${row.nro_eb}` : `${row.codigo_campo ? `${row.codigo_campo} · ` : ''}${row.campo || 'Campo nao informado'}`;
        return <article key={row.id ?? `${location}-${index}`}><div><strong>{location}</strong>{!isPump && row.lotes && <small>Lotes: {row.lotes}</small>}</div><b>{num(row.qnt).toLocaleString('pt-BR')}</b></article>;
      })}</div>
      <footer><span>{detail.rows.length} registro(s) agregado(s)</span><button type="button" className="equipe-button equipe-button--ghost" onClick={onClose}>Fechar</button></footer>
    </section>
  </div>;
}

function CurveModal({ item, rows, year, month, selectedDate, onClose }) {
  const data = useMemo(() => {
    const working = businessDaysInMonth(year, month); const byDate = new Map(); let cumulative = 0;
    rows.filter((row) => row.atividade === item.atividade).forEach((row) => byDate.set(row.data_apontamento, (byDate.get(row.data_apontamento) || 0) + num(row.qnt)));
    return working.map((date, index) => { const iso = isoDate(year, month, date.getDate()); if (iso <= selectedDate) cumulative += byDate.get(iso) || 0; return { day: date.getDate(), planned: item.hasMeta ? (item.meta / working.length) * (index + 1) : 0, realized: cumulative }; });
  }, [item, rows, year, month, selectedDate]);
  const total = item.monthTotal; const remaining = item.hasMeta ? Math.max(0, item.meta - total) : null; const percent = item.percent;
  const max = Math.max(item.hasMeta ? item.meta : 0, total, 1); const width = 760; const height = 270; const pad = { l: 42, r: 18, t: 18, b: 34 };
  const points = (key) => data.map((point, index) => `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, data.length - 1))},${pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)}`).join(' ');
  return <div className="equipe-curve-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="equipe-curve-modal">
    <header><div><span className="equipe-page__eyebrow">Curva S · {MONTHS[month - 1]} / {year}</span><h3>{item.atividade}</h3></div><button type="button" onClick={onClose}>×</button></header>
    <div className="equipe-curve-cards"><article><span>Meta mes</span><strong>{item.hasMeta ? fmt(item.meta, 0) : '—'}</strong></article><article><span>Total realizado</span><strong>{fmt(total, 0)}</strong></article><article><span>Restante</span><strong>{remaining == null ? '—' : fmt(remaining, 0)}</strong></article><article className={`is-${tonePercent(percent)}`}><span>Percentual</span><strong>{percent == null ? '—' : `${fmt(percent)}%`}</strong></article></div>
    <div className="equipe-curve-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b}/><line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b}/>{item.hasMeta && <polyline className="is-planned" points={points('planned')}/>}<polyline className="is-realized" points={points('realized')}/></svg><div className="equipe-curve-axis"><span>01</span><span>{String(data.at(-1)?.day || '').padStart(2, '0')}</span></div><div className="equipe-curve-legend">{item.hasMeta && <span><i className="is-planned"/>Planejado</span>}<span><i className="is-realized"/>Realizado</span></div></div>
  </section></div>;
}

function WeeklyCell({ item, day, onOpen }) {
  const result = item.days[day.key];
  const hasValue = result.total > 0;
  const reached = item.hasMeta && day.date ? result.total >= item.metaDay : null;
  const state = !hasValue || !item.hasMeta ? 'is-neutral' : reached ? 'is-good' : 'is-warning';
  return <td className={`is-day-result ${['sab', 'dom'].includes(day.key) ? 'is-weekend' : ''} ${state}`}><button type="button" disabled={!hasValue} className="equipe-week-grid-value" onClick={(event) => { event.stopPropagation(); if (hasValue) onOpen({ activity: item.atividade, date: day.date, rows: result.rows }); }}>{hasValue ? fmt(result.total, 0) : '·'}</button></td>;
}

function WeeklyPercent({ percent }) {
  const capped = percent == null ? 0 : Math.min(110, Math.max(0, percent)); const width = (capped / 110) * 100; const tone = tonePercent(percent);
  return <div className="equipe-week-percent"><div className="equipe-week-percent__track"><i className={`is-${tone}`} style={{ width: `${width}%` }}/></div><strong className={`is-${tone}`}>{percent == null ? '—' : `${fmt(percent)}%`}</strong></div>;
}

export default function EquipeHomeDashSemanal({ rows = [], goals = [], ano, mes, isLoading, error }) {
  const tableWidthPx = DASH_WEEKLY_CONFIG.activityColumnPx + DASH_WEEKLY_CONFIG.metaDayColumnPx + (DASH_WEEKLY_CONFIG.dayColumnPx * 7) + DASH_WEEKLY_CONFIG.weekTotalColumnPx + DASH_WEEKLY_CONFIG.monthMetaColumnPx + DASH_WEEKLY_CONFIG.monthTotalColumnPx + DASH_WEEKLY_CONFIG.percentColumnPx;
  const styles = {
    '--weekly-table-header-px': `${DASH_WEEKLY_CONFIG.tableHeaderPx}px`, '--weekly-table-value-px': `${DASH_WEEKLY_CONFIG.tableValuePx}px`, '--weekly-activity-px': `${DASH_WEEKLY_CONFIG.activityPx}px`, '--weekly-day-header-px': `${DASH_WEEKLY_CONFIG.dayHeaderPx}px`, '--weekly-day-value-px': `${DASH_WEEKLY_CONFIG.dayValuePx}px`, '--weekly-period-button-px': `${DASH_WEEKLY_CONFIG.periodButtonPx}px`, '--weekly-modal-title-px': `${DASH_WEEKLY_CONFIG.weekModalTitlePx}px`, '--weekly-detail-title-px': `${DASH_WEEKLY_CONFIG.detailTitlePx}px`, '--weekly-detail-text-px': `${DASH_WEEKLY_CONFIG.detailTextPx}px`, '--weekly-lot-text-px': `${DASH_WEEKLY_CONFIG.lotTextPx}px`, '--weekly-percentage-text-px': `${DASH_WEEKLY_CONFIG.percentageTextPx}px`, '--weekly-row-height': `${DASH_WEEKLY_CONFIG.rowHeightPx}px`, '--weekly-table-width': `${tableWidthPx}px`, '--weekly-activity-width': `${DASH_WEEKLY_CONFIG.activityColumnPx}px`, '--weekly-meta-day-width': `${DASH_WEEKLY_CONFIG.metaDayColumnPx}px`, '--weekly-day-width': `${DASH_WEEKLY_CONFIG.dayColumnPx}px`, '--weekly-week-total-width': `${DASH_WEEKLY_CONFIG.weekTotalColumnPx}px`, '--weekly-month-meta-width': `${DASH_WEEKLY_CONFIG.monthMetaColumnPx}px`, '--weekly-month-total-width': `${DASH_WEEKLY_CONFIG.monthTotalColumnPx}px`, '--weekly-percent-width': `${DASH_WEEKLY_CONFIG.percentColumnPx}px`, '--weekly-good-bg': DASH_WEEKLY_CONFIG.achievedCellBg, '--weekly-good-border': DASH_WEEKLY_CONFIG.achievedCellBorder, '--weekly-good-text': DASH_WEEKLY_CONFIG.achievedCellText, '--weekly-warning-bg': DASH_WEEKLY_CONFIG.warningCellBg, '--weekly-warning-border': DASH_WEEKLY_CONFIG.warningCellBorder, '--weekly-warning-text': DASH_WEEKLY_CONFIG.warningCellText, '--weekly-neutral-bg': DASH_WEEKLY_CONFIG.neutralCellBg, '--weekly-neutral-text': DASH_WEEKLY_CONFIG.neutralCellText, '--weekly-weekend-text': DASH_WEEKLY_CONFIG.weekendHeaderText, '--weekly-weekend-bg': DASH_WEEKLY_CONFIG.weekendHeaderBg,
  };
  const weeks = useMemo(() => [...new Set(rows.map((row) => Number(row.semana_iso)).filter(Number.isFinite))].sort((a, b) => a - b), [rows]);
  const [selectedWeek, setSelectedWeek] = useState(null); const [pickerOpen, setPickerOpen] = useState(false); const [detail, setDetail] = useState(null); const [curveItem, setCurveItem] = useState(null);
  useEffect(() => { setSelectedWeek(weeks.at(-1) || null); setDetail(null); setCurveItem(null); }, [ano, mes, weeks.join('|')]);
  const days = useMemo(() => buildWeekDates(rows, selectedWeek), [rows, selectedWeek]);
  const tableRows = useMemo(() => {
    if (!selectedWeek || !ano || !mes) return [];
    const goalMap = effectiveGoals(goals, ano, mes); const weekRows = rows.filter((row) => Number(row.semana_iso) === Number(selectedWeek));
    const activities = new Set([...goalMap.keys(), ...weekRows.map((row) => row.atividade).filter(Boolean)]); const workingDays = businessDaysInMonth(ano, mes).length; const weekEnd = days.map((day) => day.date).filter(Boolean).sort().at(-1) || '';
    return [...activities].map((atividade) => {
      const goal = goalMap.get(atividade); const meta = goal ? num(goal.meta) : 0; const hasMeta = meta > 0; const metaDay = hasMeta && workingDays ? meta / workingDays : null;
      const activityMonth = rows.filter((row) => row.atividade === atividade); const activityWeek = weekRows.filter((row) => row.atividade === atividade);
      const dayData = Object.fromEntries(days.map((day) => { const detailRows = day.date ? activityWeek.filter((row) => row.data_apontamento === day.date) : []; return [day.key, { rows: detailRows, total: detailRows.reduce((sum, row) => sum + num(row.qnt), 0) }]; }));
      const weekTotal = activityWeek.reduce((sum, row) => sum + num(row.qnt), 0); const monthTotal = activityMonth.filter((row) => !weekEnd || row.data_apontamento <= weekEnd).reduce((sum, row) => sum + num(row.qnt), 0); const percent = hasMeta ? (monthTotal / meta) * 100 : null;
      return { id: goal?.id || `weekly-${atividade}`, atividade, meta: hasMeta ? meta : null, hasMeta, metaDay, days: dayData, weekTotal, monthTotal, percent };
    }).filter((item) => item.hasMeta || item.weekTotal > 0).sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano, mes, selectedWeek, days]);
  const selectedWeekEnd = days.map((day) => day.date).filter(Boolean).sort().at(-1) || '';
  if (isLoading) return <div className="equipe-dash__placeholder"><strong>Carregando visao semanal...</strong></div>;
  if (error) return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  if (!weeks.length) return <div className="equipe-dash__placeholder"><strong>Nao existem semanas avaliadas neste periodo.</strong></div>;
  return <div className="equipe-weekly-dashboard" style={styles}>
    <section className="equipe-weekly-toolbar"><div><h3>Semana {selectedWeek} - {MONTHS[mes - 1]} / {ano}</h3><p>{formatDate(days[0]?.date)} ate {formatDate(days.at(-1)?.date)}</p></div><button type="button" className="equipe-week-picker-button" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', textAlign: 'center' }} onClick={() => setPickerOpen(true)}><span style={{ textAlign: 'center' }}>Semana</span><strong style={{ textAlign: 'center' }}>{selectedWeek}</strong></button></section>
    <section className="equipe-weekly-grid-panel"><div className="equipe-weekly-grid-scroll"><table className="equipe-weekly-grid-table"><colgroup><col className="col-activity"/><col className="col-meta-day"/>{days.map((day) => <col key={day.key} className="col-day"/>)}<col className="col-week-total"/><col className="col-month-meta"/><col className="col-month-total"/><col className="col-percent"/></colgroup><thead><tr><th>Atividade</th><th>Meta/Dia</th>{days.map((day) => <th key={day.key} className={['sab', 'dom'].includes(day.key) ? 'is-weekend' : ''}><strong>{day.label}</strong><small>{day.date?.slice(8, 10) || '—'}</small></th>)}<th>Total Sem.</th><th>Meta Mes</th><th>Total Mes</th><th>Percentual</th></tr></thead><tbody>{tableRows.map((item) => <tr key={item.id} onClick={() => setCurveItem(item)} title="Clique na linha para visualizar a Curva S"><td>{item.atividade}</td><td>{fmt(item.metaDay)}</td>{days.map((day) => <WeeklyCell key={day.key} item={item} day={day} onOpen={setDetail}/>)}<td className="is-week-total">{fmt(item.weekTotal, 0)}</td><td>{fmt(item.meta, 0)}</td><td>{fmt(item.monthTotal, 0)}</td><td><WeeklyPercent percent={item.percent}/></td></tr>)}</tbody></table></div><footer className="equipe-weekly-legend"><span><i className="is-good"/>Atingiu a Meta/Dia</span><span><i className="is-warning"/>Abaixo da Meta/Dia</span></footer></section>
    {pickerOpen && <WeekSelectorModal weeks={weeks} selectedWeek={selectedWeek} month={mes} year={ano} onSelect={setSelectedWeek} onClose={() => setPickerOpen(false)}/>}<DayDetailModal detail={detail} onClose={() => setDetail(null)}/>{curveItem && <CurveModal item={curveItem} rows={rows} year={ano} month={mes} selectedDate={selectedWeekEnd} onClose={() => setCurveItem(null)}/>} 
  </div>;
}
