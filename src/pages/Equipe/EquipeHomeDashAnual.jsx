// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashAnual
// Purpose: Visao anual por atividade, com percentual mensal, detalhe e Curva S por mes.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';

const DASH_ANNUAL_CONFIG = {
  tableHeaderPx: 10,
  tableValuePx: 11,
  activityPx: 12,
  rowHeightPx: 48,
  activityColumnPx: 230,
  monthColumnPx: 83,
  modalTitlePx: 16,
  modalTextPx: 11,
  locationTextPx: 10,
  achievedCellBg: 'rgba(134, 239, 172, 0.18)',
  achievedCellBorder: 'rgba(134, 239, 172, 0.32)',
  warningCellBg: 'rgba(253, 230, 138, 0.16)',
  warningCellBorder: 'rgba(253, 230, 138, 0.30)',
  neutralCellBg: 'rgba(148, 163, 184, 0.07)',
};

const MONTHS = [
  { number: 1, short: 'JAN', full: 'Janeiro' },
  { number: 2, short: 'FEV', full: 'Fevereiro' },
  { number: 3, short: 'MAR', full: 'Marco' },
  { number: 4, short: 'ABR', full: 'Abril' },
  { number: 5, short: 'MAI', full: 'Maio' },
  { number: 6, short: 'JUN', full: 'Junho' },
  { number: 7, short: 'JUL', full: 'Julho' },
  { number: 8, short: 'AGO', full: 'Agosto' },
  { number: 9, short: 'SET', full: 'Setembro' },
  { number: 10, short: 'OUT', full: 'Outubro' },
  { number: 11, short: 'NOV', full: 'Novembro' },
  { number: 12, short: 'DEZ', full: 'Dezembro' },
];

const num = (value) => Number(value || 0);
const fmt = (value, decimals = 1) =>
  value == null || !Number.isFinite(Number(value))
    ? '—'
    : Number(value).toLocaleString('pt-BR', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      });

const periodKey = (year, month) => Number(year) * 100 + Number(month);
const isoDate = (year, month, day) =>
  `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

const businessDaysInMonth = (year, month) =>
  Array.from(
    { length: new Date(year, month, 0).getDate() },
    (_, index) => new Date(year, month - 1, index + 1)
  ).filter((date) => ![0, 6].includes(date.getDay()));

const rowMonth = (row) => {
  const direct = Number(row?.mes);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 12) return direct;
  const dateMonth = Number(String(row?.data_apontamento || '').slice(5, 7));
  return Number.isInteger(dateMonth) && dateMonth >= 1 && dateMonth <= 12 ? dateMonth : null;
};

const tonePercent = (percent) => {
  if (percent == null) return 'neutral';
  if (percent > 110) return 'blue';
  if (percent >= 90) return 'green';
  if (percent >= 80) return 'yellow';
  return 'red';
};

// Para cada mes, utiliza a ultima meta cadastrada ate aquele periodo.
// Exemplo: meta 30 em janeiro e 40 em junho => 30 de JAN a MAI e 40 de JUN em diante.
const effectiveGoalForMonth = (goals, activity, year, month) => {
  const limit = periodKey(year, month);
  return (goals || [])
    .filter(
      (goal) =>
        goal.atividade === activity &&
        periodKey(goal.ano, goal.mes) <= limit
    )
    .sort(
      (a, b) =>
        periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) ||
        Number(a.id || 0) - Number(b.id || 0)
    )
    .at(-1) || null;
};

function AnnualPercent({ percent }) {
  const tone = tonePercent(percent);
  return (
    <span className={`equipe-annual-percent is-${tone}`}>
      {percent == null ? '—' : `${fmt(percent)}%`}
    </span>
  );
}

function MonthDetailModal({ detail, onClose }) {
  const { item, month, year } = detail;
  const workingDays = useMemo(() => businessDaysInMonth(year, month.number), [year, month.number]);

  const curveData = useMemo(() => {
    const byDate = new Map();
    item.sourceRows.forEach((row) => {
      const date = String(row.data_apontamento || '').slice(0, 10);
      if (date) byDate.set(date, (byDate.get(date) || 0) + num(row.qnt));
    });

    let cumulative = 0;
    return workingDays.map((date, index) => {
      const iso = isoDate(year, month.number, date.getDate());
      cumulative += byDate.get(iso) || 0;
      return {
        day: date.getDate(),
        planned: item.hasMeta ? (item.meta / Math.max(1, workingDays.length)) * (index + 1) : 0,
        realized: cumulative,
      };
    });
  }, [item, workingDays, year, month.number]);

  const locations = useMemo(() => {
    const map = new Map();
    item.sourceRows.forEach((row) => {
      const isPump = row.nro_eb != null && String(row.nro_eb).trim() !== '';
      const key = isPump
        ? `CB-${row.nro_eb}`
        : `${row.codigo_campo || ''}-${row.campo || 'Campo nao informado'}`;
      const label = isPump
        ? `Casa de Bomba ${row.nro_eb}`
        : `${row.codigo_campo ? `${row.codigo_campo} · ` : ''}${row.campo || 'Campo nao informado'}`;
      const current = map.get(key) || { key, label, lots: new Set(), total: 0 };
      String(row.lotes || row.lote || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .forEach((value) => current.lots.add(value));
      current.total += num(row.qnt);
      map.set(key, current);
    });
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'));
  }, [item]);

  const remaining = item.hasMeta ? Math.max(0, item.meta - item.realized) : null;
  const max = Math.max(item.hasMeta ? item.meta : 0, item.realized, 1);
  const width = 760;
  const height = 260;
  const pad = { l: 42, r: 18, t: 18, b: 34 };
  const points = (key) =>
    curveData
      .map(
        (point, index) =>
          `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, curveData.length - 1))},${
            pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)
          }`
      )
      .join(' ');

  return (
    <div className="equipe-annual-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-annual-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <span className="equipe-page__eyebrow">Detalhamento mensal · {month.full} / {year}</span>
            <h3>{item.atividade}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar">×</button>
        </header>

        <div className="equipe-annual-modal__cards">
          <article><span>Realizado</span><strong>{fmt(item.realized, 0)}</strong></article>
          <article><span>Meta do mes</span><strong>{item.hasMeta ? fmt(item.meta, 0) : 'Sem meta'}</strong></article>
          <article><span>Restante</span><strong>{remaining == null ? '—' : fmt(remaining, 0)}</strong></article>
          <article className={`is-${tonePercent(item.percent)}`}><span>Percentual</span><strong>{item.percent == null ? '—' : `${fmt(item.percent)}%`}</strong></article>
        </div>

        <div className="equipe-annual-modal__content">
          <section className="equipe-annual-locations">
            <header>
              <div><span className="equipe-page__eyebrow">Locais avaliados</span><h4>Campos e casas de bomba</h4></div>
              <b>{locations.length}</b>
            </header>
            <div className="equipe-annual-locations__list">
              {locations.length ? locations.map((location) => (
                <article key={location.key}>
                  <div>
                    <strong>{location.label}</strong>
                    {location.lots.size > 0 && <small>Lotes: {[...location.lots].join(', ')}</small>}
                  </div>
                  <b>{fmt(location.total, 0)}</b>
                </article>
              )) : <p>Nenhum campo ou casa de bomba informado neste mes.</p>}
            </div>
          </section>

          <section className="equipe-annual-curve">
            <header><span className="equipe-page__eyebrow">Curva S do mes</span><h4>Planejado x realizado</h4></header>
            <div className="equipe-annual-curve__chart">
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} />
                <line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />
                {item.hasMeta && <polyline className="is-planned" points={points('planned')} />}
                <polyline className="is-realized" points={points('realized')} />
              </svg>
              <div className="equipe-annual-curve__axis"><span>01</span><span>{String(curveData.at(-1)?.day || '').padStart(2, '0')}</span></div>
              <div className="equipe-annual-curve__legend">
                {item.hasMeta && <span><i className="is-planned" />Planejado</span>}
                <span><i className="is-realized" />Realizado</span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

export default function EquipeHomeDashAnual({ rows = [], goals = [], ano, isLoading, error }) {
  const [detail, setDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    setDetail(null);
    setSearchTerm('');
  }, [ano]);

  const tableRows = useMemo(() => {
    if (!ano) return [];
    const activities = new Set([
      ...goals.map((goal) => goal.atividade).filter(Boolean),
      ...rows.map((row) => row.atividade).filter(Boolean),
    ]);

    return [...activities]
      .map((atividade) => {
        const months = Object.fromEntries(MONTHS.map((month) => {
          const goal = effectiveGoalForMonth(goals, atividade, ano, month.number);
          const meta = goal ? num(goal.meta) : 0;
          const hasMeta = meta > 0;
          const sourceRows = rows.filter(
            (row) => row.atividade === atividade && rowMonth(row) === month.number
          );
          const realized = sourceRows.reduce((sum, row) => sum + num(row.qnt), 0);
          const hasRecords = sourceRows.length > 0;
          const percent = hasMeta && hasRecords ? (realized / meta) * 100 : null;
          return [month.number, { meta: hasMeta ? meta : 0, hasMeta, realized, percent, sourceRows }];
        }));
        return { atividade, months };
      })
      .filter((item) => MONTHS.some((month) => item.months[month.number].hasMeta || item.months[month.number].realized > 0))
      .sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return search ? tableRows.filter((item) => item.atividade.toLocaleLowerCase('pt-BR').includes(search)) : tableRows;
  }, [tableRows, searchTerm]);

  const tableWidth = DASH_ANNUAL_CONFIG.activityColumnPx + DASH_ANNUAL_CONFIG.monthColumnPx * 12;
  const styles = {
    '--annual-table-width': `${tableWidth}px`,
    '--annual-header-px': `${DASH_ANNUAL_CONFIG.tableHeaderPx}px`,
    '--annual-value-px': `${DASH_ANNUAL_CONFIG.tableValuePx}px`,
    '--annual-activity-px': `${DASH_ANNUAL_CONFIG.activityPx}px`,
    '--annual-row-height': `${DASH_ANNUAL_CONFIG.rowHeightPx}px`,
    '--annual-activity-width': `${DASH_ANNUAL_CONFIG.activityColumnPx}px`,
    '--annual-month-width': `${DASH_ANNUAL_CONFIG.monthColumnPx}px`,
    '--annual-modal-title-px': `${DASH_ANNUAL_CONFIG.modalTitlePx}px`,
    '--annual-modal-text-px': `${DASH_ANNUAL_CONFIG.modalTextPx}px`,
    '--annual-location-text-px': `${DASH_ANNUAL_CONFIG.locationTextPx}px`,
    '--annual-good-bg': DASH_ANNUAL_CONFIG.achievedCellBg,
    '--annual-good-border': DASH_ANNUAL_CONFIG.achievedCellBorder,
    '--annual-warning-bg': DASH_ANNUAL_CONFIG.warningCellBg,
    '--annual-warning-border': DASH_ANNUAL_CONFIG.warningCellBorder,
    '--annual-neutral-bg': DASH_ANNUAL_CONFIG.neutralCellBg,
  };

  if (isLoading) return <div className="equipe-dash__placeholder"><strong>Carregando visao anual...</strong></div>;
  if (error) return <div className="equipe-dash__placeholder"><strong>{error}</strong></div>;
  if (!tableRows.length) return <div className="equipe-dash__placeholder"><strong>Nao existem avaliacoes ou metas neste ano.</strong></div>;

  return (
    <div className="equipe-annual-dashboard" style={styles}>
      <section className="equipe-annual-toolbar">
        <label className="equipe-search">
          <span className="sr-only">Buscar atividade</span>
          <input type="search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Buscar atividade" />
          {searchTerm && <button type="button" onClick={() => setSearchTerm('')} aria-label="Limpar busca">×</button>}
        </label>
        <div><span className="equipe-page__eyebrow">Visao anual</span><strong>Resultados de {ano}</strong></div>
      </section>

      <section className="equipe-annual-grid-panel">
        <div className="equipe-annual-grid-scroll">
          <table className="equipe-annual-grid-table">
            <colgroup><col className="col-activity" />{MONTHS.map((month) => <col key={month.number} className="col-month" />)}</colgroup>
            <thead><tr><th>Atividade</th>{MONTHS.map((month) => <th key={month.number}>{month.short}</th>)}</tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.atividade}>
                  <td title={row.atividade}>{row.atividade}</td>
                  {MONTHS.map((month) => {
                    const item = row.months[month.number];
                    const tone = tonePercent(item.percent);
                    return (
                      <td key={`${row.atividade}-${month.number}`} className={`is-annual-result is-${tone}`}>
                        <button type="button" onClick={() => setDetail({ item: { ...item, atividade: row.atividade }, month, year: ano })} aria-label={`${row.atividade}, ${month.full}: ${item.percent == null ? 'sem meta' : `${fmt(item.percent)} por cento`}`}>
                          <AnnualPercent percent={item.percent} />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
              {!filteredRows.length && <tr><td colSpan={13} className="equipe-annual-empty">Nenhuma atividade encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
        <footer className="equipe-annual-legend">
          <span><i className="is-red" />Abaixo de 80%</span><span><i className="is-yellow" />80% a 89,9%</span><span><i className="is-green" />90% a 110%</span><span><i className="is-blue" />Acima de 110%</span><span><i className="is-neutral" />Sem meta</span>
        </footer>
      </section>

      {detail && <MonthDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
