// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashDiario
// Purpose: Dashboard diario responsivo com controle de dias sem avaliacao por atividade.
// Relationships: EquipeHomeDash, vw_q_equipe_atvrealizadas, tb_q_equipemetas
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './EquipeHomeDashDiario.css';

const DASH_DAILY_CONFIG = {
  tableHeaderPx: 10,
  tableValuePx: 12,
  activityPx: 12,
  calendarTitlePx: 14,
  calendarDayPx: 11,
  cardLabelPx: 10,
  cardValuePx: 19,
  chartLabelPx: 10,
  rowHeightPx: 46,
  activityColumnPx: 180,
  staleDaysColumnPx: 68,
  numberColumnPx: 76,
  percentColumnPx: 220,
  remainingLabelPx: 10,
  remainingValuePx: 12,
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
};

const MONTHS = ['Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAYS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const STATUS_GROUPS = [
  { key: 'red', label: 'Fora da Meta', color: '#ef4444' },
  { key: 'yellow', label: 'Atencao', color: '#f59e0b' },
  { key: 'green', label: 'Dentro da Meta', color: '#10b981' },
  { key: 'blue', label: 'Acima da Meta', color: '#38bdf8' },
];

const num = (value) => Number(value || 0);
const fmt = (value, decimals = 1) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const parseIsoDate = (value) => new Date(`${String(value).slice(0, 10)}T12:00:00`);
const isBusinessDay = (date) => date.getDay() !== 0 && date.getDay() !== 6;
const businessDaysInMonth = (year, month) => Array.from(
  { length: new Date(year, month, 0).getDate() },
  (_, index) => new Date(year, month - 1, index + 1),
).filter(isBusinessDay);
const periodKey = (year, month) => Number(year) * 100 + Number(month);
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
    .sort((a, b) => periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) || Number(a.id) - Number(b.id))
    .forEach((goal) => map.set(goal.atividade, goal));
  return map;
};

const countBusinessDaysWithoutEvaluation = (activityRows, selectedDate, workingDays) => {
  if (!selectedDate) return null;
  const dates = [...new Set(
    activityRows
      .map((row) => row.data_apontamento)
      .filter((date) => date && date <= selectedDate),
  )].sort();
  const lastDate = dates.at(-1) || null;
  if (lastDate === selectedDate) return 0;
  return workingDays.filter((date) => {
    const iso = isoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
    return iso <= selectedDate && (!lastDate || iso > lastDate);
  }).length;
};

const staleTone = (days) => {
  if (days == null) return 'neutral';
  if (days === 0) return 'fresh';
  if (days === 1) return 'attention';
  if (days <= 3) return 'warning';
  return 'critical';
};

function DonutChart({ distribution }) {
  const total = distribution.reduce((sum, item) => sum + item.count, 0);
  let offset = 0;
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="equipe-donut-wrap">
      <svg className="equipe-donut" viewBox="0 0 110 110">
        <circle className="equipe-donut__track" cx="55" cy="55" r={radius} />
        {distribution.map((item) => {
          const size = (total ? item.count / total : 0) * circumference;
          const currentOffset = offset;
          offset += size;
          return <circle key={item.key} className="equipe-donut__segment" cx="55" cy="55" r={radius} style={{ stroke: item.color, strokeDasharray: `${size} ${circumference - size}`, strokeDashoffset: -currentOffset }} />;
        })}
        <text x="55" y="52" textAnchor="middle">{total}</text>
        <text x="55" y="66" textAnchor="middle" className="is-small">metas</text>
      </svg>
      <div className="equipe-donut-legend">
        {distribution.map((item) => <div key={item.key}><i style={{ background: item.color }} /><span>{item.label}</span><strong>{item.count}</strong></div>)}
      </div>
    </div>
  );
}

function PercentageChart({ items }) {
  return (
    <section className="equipe-percentage-panel equipe-percentage-panel--full">
      <header><div><span className="equipe-page__eyebrow">Comparativo das atividades</span><h3>Percentual mensal por atividade</h3></div><span>Linha de referencia: 90%</span></header>
      <div className="equipe-percentage-chart-scroll">
        <div className="equipe-percentage-chart" style={{ '--activity-count': Math.max(items.length, 8) }}>
          <div className="equipe-percentage-target" style={{ bottom: `${(90 / 110) * 100}%` }}><span>90%</span></div>
          {items.map((item) => {
            const capped = Math.min(110, Math.max(0, item.percent || 0));
            return <article key={item.atividade}><div className="equipe-percentage-bar-area"><strong>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</strong><i className={`is-${tonePercent(item.percent)}`} style={{ height: item.percent == null ? '3%' : `${(capped / 110) * 100}%` }} /></div><span title={item.atividade}>{item.atividade}</span></article>;
          })}
        </div>
      </div>
    </section>
  );
}

function DailyPercent({ percent }) {
  const capped = percent == null ? 0 : Math.min(110, Math.max(0, percent));
  const tone = tonePercent(percent);
  return <div className="equipe-daily-percent"><div className="equipe-daily-percent__track"><i className={`is-${tone}`} style={{ width: `${(capped / 110) * 100}%` }} /></div><strong className={`is-${tone}`}>{percent == null ? '—' : `${fmt(percent)}%`}</strong></div>;
}

function StaleDays({ days }) {
  const tone = staleTone(days);
  return <span className={`equipe-daily-stale is-${tone}`} title={days === 0 ? 'Avaliada na data selecionada' : `${days} dia(s) util(eis) sem avaliacao`}>{days == null ? '—' : days}</span>;
}

function RemainingBusinessDays({ total, remaining }) {
  const width = Math.max(0, Math.min(100, (remaining / Math.max(1, total)) * 100));
  return <div className="equipe-business-days"><div className="equipe-business-days__text"><strong>{total} dias uteis totais</strong><span>/</span><b>{remaining} dias uteis restantes</b></div><div className="equipe-business-days__track" aria-label={`${remaining} de ${total} dias uteis restantes`}><i style={{ width: `${width}%` }} /></div></div>;
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
  const total = item.total;
  const remaining = item.hasMeta ? Math.max(0, item.meta - total) : null;
  const percent = item.percent;
  const max = Math.max(item.hasMeta ? item.meta : 0, total, 1);
  const width = 760; const height = 270; const pad = { l: 42, r: 18, t: 18, b: 34 };
  const points = (key) => data.map((point, index) => `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, data.length - 1))},${pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)}`).join(' ');
  return <div className="equipe-curve-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="equipe-curve-modal"><header><div><span className="equipe-page__eyebrow">Curva S · {MONTHS[month - 1]} / {year}</span><h3>{item.atividade}</h3></div><button type="button" onClick={onClose}>×</button></header><div className="equipe-curve-cards"><article><span>Meta mes</span><strong>{item.hasMeta ? fmt(item.meta, 0) : '—'}</strong></article><article><span>Total realizado</span><strong>{fmt(total, 0)}</strong></article><article><span>Restante</span><strong>{remaining == null ? '—' : fmt(remaining, 0)}</strong></article><article className={`is-${tonePercent(percent)}`}><span>Percentual</span><strong>{percent == null ? '—' : `${fmt(percent)}%`}</strong></article></div><div className="equipe-curve-chart"><svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} /><line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />{item.hasMeta && <polyline className="is-planned" points={points('planned')} />}<polyline className="is-realized" points={points('realized')} /></svg><div className="equipe-curve-axis"><span>01</span><span>{String(data.at(-1)?.day || '').padStart(2, '0')}</span></div><div className="equipe-curve-legend">{item.hasMeta && <span><i className="is-planned" />Planejado</span>}<span><i className="is-realized" />Realizado</span></div></div></section></div>;
}

function DayCalendar({ year, month, availableDates, selectedDate, onSelect, summary }) {
  const firstDay = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const available = new Set(availableDates);
  return <aside className="equipe-daily-sidebar"><div className="equipe-day-calendar"><header><span className="equipe-page__eyebrow">Dias avaliados</span><h3>{MONTHS[month - 1]} {year}</h3></header><div className="equipe-day-calendar__grid">{WEEKDAYS.map((day, index) => <b key={`${day}-${index}`}>{day}</b>)}{Array.from({ length: firstDay }, (_, index) => <span key={`empty-${index}`} />)}{Array.from({ length: days }, (_, index) => { const day = index + 1; const iso = isoDate(year, month, day); const enabled = available.has(iso); return <button key={iso} type="button" disabled={!enabled} className={selectedDate === iso ? 'is-active' : ''} onClick={() => onSelect(iso)}>{day}</button>; })}</div><footer><i />Somente dias com avaliacao</footer></div><div className="equipe-daily-summary-cards"><article><span>Meta mes</span><strong>{fmt(summary.metaMonth, 0)}</strong></article><article><span>Realizado mes</span><strong>{fmt(summary.realizedMonth, 0)}</strong></article><article><span>Metas atingidas</span><strong>{summary.goalsReached}</strong><small>de {summary.goalsWithTarget}</small></article></div><section className="equipe-daily-distribution"><header><span className="equipe-page__eyebrow">Distribuicao das metas</span><h3>Faixas de desempenho</h3></header><DonutChart distribution={summary.distribution} /></section></aside>;
}

function MobileDailyCards({ items, onOpen }) {
  return (
    <div className="equipe-daily-mobile-list">
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={`equipe-daily-mobile-card ${item.daily > 0 ? 'is-done-today' : 'is-not-done-today'}`}
          onClick={() => onOpen(item)}
        >
          <header><strong>{item.atividade}</strong><StaleDays days={item.daysWithoutEvaluation} /></header>
          <div className="equipe-daily-mobile-metrics">
            <span><small>Realizado</small><b>{fmt(item.daily, 0)}</b></span>
            <span><small>Meta/Dia</small><b>{fmt(item.metaDay)}</b></span>
            <span><small>Total Mês</small><b>{fmt(item.total, 0)}</b></span>
            <span><small>Meta</small><b>{fmt(item.meta, 0)}</b></span>
            <span className="is-remaining"><small>Restante</small><b>{fmt(item.remaining, 0)}</b></span>
          </div>
          <DailyPercent percent={item.percent} />
        </button>
      ))}
    </div>
  );
}

export default function EquipeHomeDashDiario({ rows = [], goals = [], ano, mes, isLoading, error }) {
  const styles = {
    '--daily-table-header-px': `${DASH_DAILY_CONFIG.tableHeaderPx}px`, '--daily-table-value-px': `${DASH_DAILY_CONFIG.tableValuePx}px`, '--daily-activity-px': `${DASH_DAILY_CONFIG.activityPx}px`, '--daily-calendar-title-px': `${DASH_DAILY_CONFIG.calendarTitlePx}px`, '--daily-calendar-day-px': `${DASH_DAILY_CONFIG.calendarDayPx}px`, '--daily-card-label-px': `${DASH_DAILY_CONFIG.cardLabelPx}px`, '--daily-card-value-px': `${DASH_DAILY_CONFIG.cardValuePx}px`, '--daily-chart-label-px': `${DASH_DAILY_CONFIG.chartLabelPx}px`, '--daily-row-height': `${DASH_DAILY_CONFIG.rowHeightPx}px`, '--daily-activity-width': `${DASH_DAILY_CONFIG.activityColumnPx}px`, '--daily-stale-width': `${DASH_DAILY_CONFIG.staleDaysColumnPx}px`, '--daily-number-width': `${DASH_DAILY_CONFIG.numberColumnPx}px`, '--daily-percent-width': `${DASH_DAILY_CONFIG.percentColumnPx}px`, '--daily-remaining-label-px': `${DASH_DAILY_CONFIG.remainingLabelPx}px`, '--daily-remaining-value-px': `${DASH_DAILY_CONFIG.remainingValuePx}px`, '--daily-business-days-width': `${DASH_DAILY_CONFIG.businessDaysWidthPx}px`, '--daily-business-days-bar-height': `${DASH_DAILY_CONFIG.businessDaysBarHeightPx}px`, '--daily-good-bg': DASH_DAILY_CONFIG.achievedCellBg, '--daily-good-border': DASH_DAILY_CONFIG.achievedCellBorder, '--daily-good-text': DASH_DAILY_CONFIG.achievedCellText, '--daily-warning-bg': DASH_DAILY_CONFIG.warningCellBg, '--daily-warning-border': DASH_DAILY_CONFIG.warningCellBorder, '--daily-warning-text': DASH_DAILY_CONFIG.warningCellText, '--daily-neutral-bg': DASH_DAILY_CONFIG.neutralCellBg, '--daily-neutral-text': DASH_DAILY_CONFIG.neutralCellText,
  };
  const availableDates = useMemo(() => [...new Set(rows.map((row) => row.data_apontamento).filter(Boolean))].sort(), [rows]);
  const [selectedDate, setSelectedDate] = useState('');
  const [curveItem, setCurveItem] = useState(null);
  useEffect(() => { setSelectedDate(availableDates.at(-1) || ''); setCurveItem(null); }, [ano, mes, availableDates.join('|')]);
  const workingDays = useMemo(() => ano && mes ? businessDaysInMonth(ano, mes) : [], [ano, mes]);
  const selectedDateObject = selectedDate ? parseIsoDate(selectedDate) : null;
  const remainingDays = selectedDateObject ? workingDays.filter((date) => date >= selectedDateObject).length : 0;
  const tableRows = useMemo(() => {
    if (!ano || !mes || !selectedDate) return [];
    const goalMap = effectiveGoals(goals, ano, mes);
    const activities = new Set([...goalMap.keys(), ...rows.map((row) => row.atividade).filter(Boolean)]);
    return [...activities].map((atividade) => {
      const goal = goalMap.get(atividade) || null;
      const activityRows = rows.filter((row) => row.atividade === atividade);
      const daily = activityRows.filter((row) => row.data_apontamento === selectedDate).reduce((sum, row) => sum + num(row.qnt), 0);
      const total = activityRows.filter((row) => row.data_apontamento <= selectedDate).reduce((sum, row) => sum + num(row.qnt), 0);
      const rawMeta = goal ? num(goal.meta) : 0;
      const hasMeta = rawMeta > 0;
      const metaDay = hasMeta && workingDays.length ? rawMeta / workingDays.length : null;
      const remaining = hasMeta ? Math.max(0, rawMeta - total) : null;
      const neededDay = hasMeta ? (remainingDays ? remaining / remainingDays : remaining) : null;
      const percent = hasMeta ? (total / rawMeta) * 100 : null;
      const daysWithoutEvaluation = countBusinessDaysWithoutEvaluation(activityRows, selectedDate, workingDays);
      return { id: goal?.id || `activity-${atividade}`, atividade, meta: hasMeta ? rawMeta : null, hasMeta, daily, total, remaining, metaDay, neededDay, percent, daysWithoutEvaluation, reachedDay: hasMeta && daily > 0 ? daily >= metaDay : null };
    }).filter((item) => item.hasMeta || item.daily > 0).sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano, mes, selectedDate, workingDays, remainingDays]);
  const summary = useMemo(() => {
    const withTarget = tableRows.filter((item) => item.hasMeta);
    return { metaMonth: withTarget.reduce((sum, item) => sum + item.meta, 0), realizedMonth: tableRows.reduce((sum, item) => sum + item.total, 0), goalsReached: withTarget.filter((item) => item.percent >= 90).length, goalsWithTarget: withTarget.length, distribution: STATUS_GROUPS.map((group) => ({ ...group, count: withTarget.filter((item) => tonePercent(item.percent) === group.key).length })) };
  }, [tableRows]);
  if (isLoading) return <div className="equipe-dash__placeholder"><strong>Carregando visao diaria...</strong></div>;
  if (error) return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  if (!availableDates.length) return <div className="equipe-dash__placeholder"><strong>Nao existem avaliacoes neste periodo.</strong></div>;
  return <div className="equipe-daily-dashboard" style={styles}><div className="equipe-daily-layout"><DayCalendar year={ano} month={mes} availableDates={availableDates} selectedDate={selectedDate} onSelect={setSelectedDate} summary={summary} /><section className="equipe-daily-panel"><header><div className="equipe-daily-panel__identity"><span className="equipe-page__eyebrow">Controle diario</span><h3>{selectedDate.split('-').reverse().join('/')}</h3></div><RemainingBusinessDays total={workingDays.length} remaining={remainingDays} /></header><div className="equipe-daily-table-wrap"><table className="equipe-daily-table"><colgroup><col className="col-activity" /><col className="col-stale" /><col className="col-number" /><col className="col-number" /><col className="col-number" /><col className="col-number" /><col className="col-number" /><col className="col-number" /><col className="col-percent" /></colgroup><thead><tr><th>Atividade</th><th>Sem Av.</th><th>Meta/Dia</th><th>Necessario/Dia</th><th>Realizado</th><th>Meta Mes</th><th>Total Mes</th><th>Restante</th><th>Percentual</th></tr></thead><tbody>{tableRows.map((item) => <tr key={item.id} className={item.daily > 0 ? 'is-done-today' : 'is-not-done-today'} onClick={() => setCurveItem(item)} title="Clique na linha para visualizar a Curva S"><td>{item.atividade}</td><td><StaleDays days={item.daysWithoutEvaluation} /></td><td>{fmt(item.metaDay)}</td><td>{fmt(item.neededDay)}</td><td className={`is-daily-result ${item.reachedDay === true ? 'is-good' : item.reachedDay === false ? 'is-warning' : 'is-neutral'}`}><button type="button" disabled={item.daily <= 0} onClick={(event) => { event.stopPropagation(); if (item.daily > 0) setCurveItem(item); }}>{item.daily > 0 ? fmt(item.daily, 0) : '·'}</button></td><td>{fmt(item.meta, 0)}</td><td>{fmt(item.total, 0)}</td><td>{fmt(item.remaining, 0)}</td><td><DailyPercent percent={item.percent} /></td></tr>)}</tbody></table></div><MobileDailyCards items={tableRows} onOpen={setCurveItem} /><footer className="equipe-daily-legend"><span><i className="is-good" />Atingiu a Meta/Dia</span><span><i className="is-warning" />Abaixo da Meta/Dia</span><span><i className="is-neutral" />Sem realizado</span></footer></section></div><div className="equipe-daily-analytics"><PercentageChart items={tableRows} /></div>{curveItem && <CurveModal item={curveItem} rows={rows} year={ano} month={mes} selectedDate={selectedDate} onClose={() => setCurveItem(null)} />}</div>;
}
