// ================================= DOCUMENTATION ------------------------------------------
// Script: EquipeHomeDashAnual
// Purpose: Visao anual responsiva por atividade, com percentual mensal, detalhes e Curva S.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import './EquipeHomeDashAnual.css';

const CFG = {
  tableHeaderPx: 10,
  tableValuePx: 11,
  activityPx: 12,
  rowHeightPx: 48,
  activityColumnPx: 230,
  monthColumnPx: 83,
  modalTitlePx: 16,
  modalTextPx: 11,
  locationTextPx: 10,
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
const fmt = (value, decimals = 1) => value == null || !Number.isFinite(Number(value))
  ? '—'
  : Number(value).toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
const periodKey = (year, month) => Number(year) * 100 + Number(month);
const isoDate = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
const businessDaysInMonth = (year, month) => Array.from(
  { length: new Date(year, month, 0).getDate() },
  (_, index) => new Date(year, month - 1, index + 1),
).filter((date) => ![0, 6].includes(date.getDay()));
const rowMonth = (row) => {
  const direct = Number(row?.mes);
  if (Number.isInteger(direct) && direct >= 1 && direct <= 12) return direct;
  const dateMonth = Number(String(row?.data_apontamento || '').slice(5, 7));
  return Number.isInteger(dateMonth) && dateMonth >= 1 && dateMonth <= 12 ? dateMonth : null;
};
const tonePercent = (percent) => percent == null
  ? 'neutral'
  : percent > 110
    ? 'blue'
    : percent >= 90
      ? 'green'
      : percent >= 80
        ? 'yellow'
        : 'red';

const effectiveGoalForMonth = (goals, activity, year, month) => {
  const limit = periodKey(year, month);
  return (goals || [])
    .filter((goal) => goal.atividade === activity && periodKey(goal.ano, goal.mes) <= limit)
    .sort((a, b) => periodKey(a.ano, a.mes) - periodKey(b.ano, b.mes) || Number(a.id || 0) - Number(b.id || 0))
    .at(-1) || null;
};

function AnnualPercent({ percent }) {
  return (
    <span className={`equipe-annual-percent is-${tonePercent(percent)}`}>
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
      const key = isPump ? `CB-${row.nro_eb}` : `${row.codigo_campo || ''}-${row.campo || 'Campo nao informado'}`;
      const label = isPump ? `Casa de Bomba ${row.nro_eb}` : `${row.codigo_campo ? `${row.codigo_campo} · ` : ''}${row.campo || 'Campo nao informado'}`;
      const current = map.get(key) || { key, label, lots: new Set(), total: 0 };
      String(row.lotes || row.lote || '').split(',').map((value) => value.trim()).filter(Boolean).forEach((value) => current.lots.add(value));
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
  const points = (key) => curveData.map((point, index) => `${pad.l + index * ((width - pad.l - pad.r) / Math.max(1, curveData.length - 1))},${pad.t + (1 - point[key] / max) * (height - pad.t - pad.b)}`).join(' ');

  return (
    <div className="equipe-annual-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="equipe-annual-modal" role="dialog" aria-modal="true">
        <header>
          <div><span className="equipe-page__eyebrow">Detalhamento mensal · {month.full} / {year}</span><h3>{item.atividade}</h3></div>
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
            <header><div><span className="equipe-page__eyebrow">Locais avaliados</span><h4>Campos e casas de bomba</h4></div><b>{locations.length}</b></header>
            <div className="equipe-annual-locations__list">
              {locations.length ? locations.map((location) => (
                <article key={location.key}>
                  <div><strong>{location.label}</strong>{location.lots.size > 0 && <small>Lotes: {[...location.lots].join(', ')}</small>}</div>
                  <b>{fmt(location.total, 0)}</b>
                </article>
              )) : <p>Nenhum campo ou casa de bomba informado neste mes.</p>}
            </div>
          </section>

          <section className="equipe-annual-curve">
            <header><div><span className="equipe-page__eyebrow">Curva S do mes</span><h4>Planejado x realizado</h4></div></header>
            <div className="equipe-annual-curve__chart">
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
                <line x1={pad.l} y1={height - pad.b} x2={width - pad.r} y2={height - pad.b} />
                <line x1={pad.l} y1={pad.t} x2={pad.l} y2={height - pad.b} />
                {item.hasMeta && <polyline className="is-planned" points={points('planned')} />}
                <polyline className="is-realized" points={points('realized')} />
              </svg>
              <div className="equipe-annual-curve__axis"><span>01</span><span>{String(curveData.at(-1)?.day || '').padStart(2, '0')}</span></div>
              <div className="equipe-annual-curve__legend">{item.hasMeta && <span><i className="is-planned" />Planejado</span>}<span><i className="is-realized" />Realizado</span></div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function MobileAnnualSelector({ items, selectedActivity, onSelect }) {
  return (
    <section className="annual-mobile-selector">
      <header>
        <div>
          <span className="equipe-page__eyebrow">Selecionar atividade</span>
          <h3>{selectedActivity ? 'Toque novamente para desmarcar' : 'Escolha uma atividade'}</h3>
        </div>
        <b>{items.length}</b>
      </header>

      <div className="annual-mobile-selector__list">
        {items.map((item) => (
          <button
            type="button"
            key={item.atividade}
            className={selectedActivity === item.atividade ? 'is-active' : ''}
            onClick={() => onSelect(selectedActivity === item.atividade ? null : item.atividade)}
          >
            <strong title={item.atividade}>{item.atividade}</strong>

            <span className="annual-mobile-selector__months" aria-label={`Resultados mensais de ${item.atividade}`}>
              {MONTHS.map((month) => {
                const monthItem = item.months[month.number];
                const tone = tonePercent(monthItem.percent);

                return (
                  <i
                    key={month.number}
                    className={`is-${tone}`}
                    title={`${month.full}: ${monthItem.percent == null ? 'sem percentual' : `${fmt(monthItem.percent)}%`}`}
                  >
                    {month.short.slice(0, 1)}
                  </i>
                );
              })}
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

function MobileAnnualMonths({ item, year, onOpen }) {
  return (
    <section className="annual-mobile-months">
      <header>
        <div>
          <span className="equipe-page__eyebrow">Resultado mensal</span>
          <h3>{item ? item.atividade : `Resultados de ${year}`}</h3>
        </div>
      </header>

      <div className="annual-mobile-bars">
        {MONTHS.map((month) => {
          const monthItem = item?.months[month.number] || null;
          const percent = monthItem?.percent ?? null;
          const tone = tonePercent(percent);
          const width = percent == null ? 0 : Math.max(2, Math.min(100, (percent / 120) * 100));

          return (
            <button
              type="button"
              key={month.number}
              className={`is-${tone}`}
              disabled={!item}
              onClick={() => item && onOpen({
                item: { ...monthItem, atividade: item.atividade },
                month,
                year,
              })}
            >
              <span>{month.short}</span>
              <div className="annual-mobile-bars__track">
                <i style={{ width: `${width}%` }} />
              </div>
              <strong>{item ? (percent == null ? '—' : `${fmt(percent)}%`) : '—'}</strong>
            </button>
          );
        })}
      </div>

      {!item && <p>Selecione uma atividade acima para visualizar os resultados de janeiro a dezembro.</p>}

      <footer className="annual-mobile-bars__legend">
        <span><i className="is-red" />&lt; 80%</span>
        <span><i className="is-yellow" />80% a 89,9%</span>
        <span><i className="is-green" />90% a 110%</span>
        <span><i className="is-blue" />&gt; 110%</span>
      </footer>
    </section>
  );
}

export default function EquipeHomeDashAnual({ rows = [], goals = [], ano, isLoading, error }) {
  const [detail, setDetail] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedActivity, setSelectedActivity] = useState(null);

  useEffect(() => {
    setDetail(null);
    setSearchTerm('');
    setSelectedActivity(null);
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
          const sourceRows = rows.filter((row) => row.atividade === atividade && rowMonth(row) === month.number);
          const realized = sourceRows.reduce((sum, row) => sum + num(row.qnt), 0);
          const hasRecords = sourceRows.length > 0;
          const percent = hasMeta && hasRecords ? (realized / meta) * 100 : null;
          return [month.number, { meta: hasMeta ? meta : 0, hasMeta, realized, percent, sourceRows }];
        }));

        const monthValues = MONTHS.map((month) => months[month.number]);
        const yearMeta = monthValues.reduce((sum, item) => sum + (item.hasMeta ? item.meta : 0), 0);
        const yearRealized = monthValues.reduce((sum, item) => sum + item.realized, 0);
        const yearRemaining = Math.max(0, yearMeta - yearRealized);
        const yearPercent = yearMeta > 0 ? (yearRealized / yearMeta) * 100 : null;
        const monthsWithMeta = monthValues.filter((item) => item.hasMeta).length;
        const monthsOnTarget = monthValues.filter((item) => item.percent != null && item.percent >= 90).length;
        const latestMonthResult = [...MONTHS]
          .reverse()
          .map((month) => ({ month, ...months[month.number] }))
          .find((item) => item.percent != null || item.realized > 0) || null;

        return {
          atividade,
          months,
          yearMeta,
          yearRealized,
          yearRemaining,
          yearPercent,
          monthsWithMeta,
          monthsOnTarget,
          latestMonthResult,
        };
      })
      .filter((item) => MONTHS.some((month) => item.months[month.number].hasMeta || item.months[month.number].realized > 0))
      .sort((a, b) => a.atividade.localeCompare(b.atividade, 'pt-BR'));
  }, [rows, goals, ano]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.trim().toLocaleLowerCase('pt-BR');
    return search ? tableRows.filter((item) => item.atividade.toLocaleLowerCase('pt-BR').includes(search)) : tableRows;
  }, [tableRows, searchTerm]);

  const selectedItem = tableRows.find((item) => item.atividade === selectedActivity) || null;
  const tableWidth = CFG.activityColumnPx + CFG.monthColumnPx * 12;
  const styles = {
    '--annual-table-width': `${tableWidth}px`,
    '--annual-header-px': `${CFG.tableHeaderPx}px`,
    '--annual-value-px': `${CFG.tableValuePx}px`,
    '--annual-activity-px': `${CFG.activityPx}px`,
    '--annual-row-height': `${CFG.rowHeightPx}px`,
    '--annual-activity-width': `${CFG.activityColumnPx}px`,
    '--annual-month-width': `${CFG.monthColumnPx}px`,
    '--annual-modal-title-px': `${CFG.modalTitlePx}px`,
    '--annual-modal-text-px': `${CFG.modalTextPx}px`,
    '--annual-location-text-px': `${CFG.locationTextPx}px`,
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

      <MobileAnnualSelector items={filteredRows} selectedActivity={selectedActivity} onSelect={setSelectedActivity} />
      <MobileAnnualMonths item={selectedItem} year={ano} onOpen={setDetail} />

      <section className="equipe-annual-grid-panel">
        <div className="equipe-annual-grid-scroll">
          <table className="equipe-annual-grid-table">
            <colgroup><col className="col-activity" />{MONTHS.map((month) => <col key={month.number} className="col-month" />)}</colgroup>
            <thead><tr><th>Atividade</th>{MONTHS.map((month) => <th key={month.number}>{month.short}</th>)}</tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.atividade} className={row.yearRealized > 0 ? 'is-done-year' : 'is-empty-year'}>
                  <td title={row.atividade}>{row.atividade}</td>
                  {MONTHS.map((month) => {
                    const item = row.months[month.number];
                    const tone = tonePercent(item.percent);
                    return (
                      <td key={`${row.atividade}-${month.number}`} className={`is-annual-result is-${tone}`}>
                        <button type="button" onClick={() => setDetail({ item: { ...item, atividade: row.atividade }, month, year: ano })}>
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
        <footer className="equipe-annual-legend"><span><i className="is-red" />Abaixo de 80%</span><span><i className="is-yellow" />80% a 89,9%</span><span><i className="is-green" />90% a 110%</span><span><i className="is-blue" />Acima de 110%</span><span><i className="is-neutral" />Sem meta</span></footer>
      </section>

      {detail && <MonthDetailModal detail={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}
