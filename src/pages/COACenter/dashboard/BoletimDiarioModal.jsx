// ================================= DOCUMENTATION ------------------------------------------
// Script: BoletimDiarioModal V4
// Purpose: Detalhamento fullscreen do equipamento, operador e operações.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../../lib/supabaseClient';

const HISTORY_DAYS = 7;
const PAGE_SIZE = 1000;

const SECOND_FIELDS = [
  'produtivo_seg', 'improdutivo_seg', 'auxiliar_seg', 's_apont_seg',
  'indeter_seg', 'manutencao_seg', 'clima_seg', 'fabrica_parada_seg',
  'sem_turno_seg', 'hrs_operacionais_seg', 'hrs_disp_seg',
  'hrs_motor_ligado_seg', 'hrs_ocioso_seg',
];

const KPI_CONFIG = [
  { key: 'eficiencia_operacional', label: 'Ef. Operacional', inverse: false },
  { key: 'eficiencia_real', label: 'Ef. Real', inverse: false },
  { key: 'sem_apontamento', label: 'S. Apontamento', inverse: true },
  { key: 'indeterminado', label: 'Indeterminado', inverse: true },
  { key: 'disponibilidade_mecanica', label: 'Disp. Mecânica', inverse: false },
  { key: 'motor_ocioso', label: 'Motor Ocioso', inverse: true },
];

// Ajustes rápidos do modal e tooltip.
const MODAL_CONFIG = {
  tooltipWidth: 330,
  tooltipHeight: 220,
  tooltipTitlePx: 14,
  tooltipTextPx: 11,
  tooltipValuePx: 12,
  chartHeight: 92,
};

// Cores dos grupos operacionais. Ajuste somente aqui.
const GROUP_COLORS = {
  PRODUTIVO: '#3ddc97',
  IMPRODUTIVO: '#a8b6c8',
  AUXILIAR: '#a8b6c8',
  'SEM APONTAMENTO': '#f59e0b',
  INDETERMINADO: '#f59e0b',
  'MANUTENÇÃO': '#a78bfa',
  MANUTENCAO: '#a78bfa',
  CLIMA: '#94a3b8',
  'FÁBRICA PARADA': '#94a3b8',
  'FABRICA PARADA': '#94a3b8',
  'SEM TURNO DE TRABALHO': '#64748b',
  'SEM TURNO': '#64748b',
  DEFAULT: '#94a3b8',
};

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeRows = (rows) => (Array.isArray(rows) ? rows : []).map((row) => {
  const normalized = { ...row };
  SECOND_FIELDS.forEach((field) => { normalized[field] = num(row[field]); });
  return normalized;
});

const sumRows = (rows) => rows.reduce((acc, row) => {
  SECOND_FIELDS.forEach((field) => { acc[field] += num(row[field]); });
  return acc;
}, Object.fromEntries(SECOND_FIELDS.map((field) => [field, 0])));

const safePercent = (numerator, denominator) => denominator > 0 ? (numerator / denominator) * 100 : null;

const calculateIndicators = (totals) => ({
  eficiencia_operacional: safePercent(totals.produtivo_seg, totals.hrs_disp_seg),
  eficiencia_real: safePercent(totals.produtivo_seg, totals.hrs_operacionais_seg),
  sem_apontamento: safePercent(totals.s_apont_seg, totals.hrs_operacionais_seg),
  indeterminado: safePercent(totals.indeter_seg, totals.hrs_operacionais_seg),
  disponibilidade_mecanica: totals.hrs_operacionais_seg > 0 ? (1 - totals.manutencao_seg / totals.hrs_operacionais_seg) * 100 : null,
  motor_ocioso: safePercent(totals.hrs_ocioso_seg, totals.hrs_operacionais_seg),
});

const kpiTone = (key, value) => {
  if (value == null) return 'neutral';
  if (key === 'eficiencia_real') return 'reference';
  if (key === 'eficiencia_operacional') return value >= 65 ? 'good' : value >= 50 ? 'warning' : 'bad';
  if (key === 'disponibilidade_mecanica') return value >= 90 ? 'good' : value >= 80 ? 'warning' : 'bad';
  if (key === 'sem_apontamento') return value <= 2 ? 'good' : 'bad';
  if (key === 'indeterminado') return value <= 10 ? 'good' : 'bad';
  if (key === 'motor_ocioso') return value <= 5 ? 'good' : 'bad';
  return 'neutral';
};

const formatPercent = (value, decimals = 1) => value == null || !Number.isFinite(value) ? '—' : `${value.toFixed(decimals).replace('.', ',')}%`;

const formatDuration = (seconds) => {
  const totalMinutes = Math.max(0, Math.round(num(seconds) / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const formatDateShort = (isoDate) => {
  if (!isoDate) return '—';
  const [, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}`;
};

const formatDateFull = (isoDate) => {
  if (!isoDate) return '—';
  const [year, month, day] = isoDate.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
};

const minusDaysIso = (isoDate, days) => {
  const [year, month, day] = String(isoDate || '').slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
};

const splitOperator = (value) => {
  const raw = String(value || '').trim();
  const separator = raw.indexOf(' - ');
  if (separator < 0) return { code: raw || '—', fullName: '' };
  return { code: raw.slice(0, separator).trim() || '—', fullName: raw.slice(separator + 3).trim() };
};

const isUnavailableOperator = (value) => {
  const { code, fullName } = splitOperator(value);
  return !fullName || code === '9999' || code === '—';
};

const shortOperatorName = (value) => {
  if (isUnavailableOperator(value)) return 'NÃO DISPONÍVEL';
  const parts = splitOperator(value).fullName.toLocaleUpperCase('pt-BR').split(/\s+/).filter(Boolean);
  if (parts.length <= 2) return parts.join(' ');
  return parts[1].length <= 3 ? parts.slice(0, 3).join(' ') : parts.slice(0, 2).join(' ');
};

const groupKey = (value) => String(value || 'NÃO CLASSIFICADO').trim().toLocaleUpperCase('pt-BR');
const groupColor = (value) => GROUP_COLORS[groupKey(value)] || GROUP_COLORS.DEFAULT;

const fetchAllPages = async (queryFactory) => {
  const allRows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await queryFactory().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    const page = Array.isArray(data) ? data : [];
    allRows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }
  return allRows;
};

function KpiTooltip({ tooltip }) {
  if (!tooltip || typeof document === 'undefined') return null;

  const { config, history, loading, currentValue, position } = tooltip;
  const historyPoints = history
    .map((item) => ({
      data: item.data,
      value: item.indicators[config.key],
    }))
    .filter((item) => item.value != null && Number.isFinite(item.value));

  const values = historyPoints.map((item) => item.value);
  const average = values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : null;

  const delta = average == null || currentValue == null
    ? null
    : currentValue - average;

  const better = delta == null
    ? null
    : config.inverse
      ? delta <= 0
      : delta >= 0;

  const averageTone = kpiTone(config.key, average);
  const width = 290;
  const height = MODAL_CONFIG.chartHeight;
  const padX = 18;
  const padTop = 25;
  const padBottom = 13;
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = Math.max(0.01, max - min);

  const chartPoints = historyPoints.map((item, index) => {
    const x = padX + index * ((width - padX * 2) / Math.max(1, historyPoints.length - 1));
    const y = padTop + ((max - item.value) / range) * (height - padTop - padBottom);
    return {
      ...item,
      x,
      y,
      tone: kpiTone(config.key, item.value),
    };
  });

  const linePoints = chartPoints.map((item) => `${item.x},${item.y}`).join(' ');

  return createPortal(
    <div
      className="bd-kpi-floating-tooltip"
      style={{
        left: position.left,
        top: position.top,
        width: MODAL_CONFIG.tooltipWidth,
        minHeight: MODAL_CONFIG.tooltipHeight,
        '--tooltip-title-px': `${MODAL_CONFIG.tooltipTitlePx}px`,
        '--tooltip-text-px': `${MODAL_CONFIG.tooltipTextPx}px`,
        '--tooltip-value-px': `${MODAL_CONFIG.tooltipValuePx}px`,
      }}
    >
      <div className="bd-kpi-floating-tooltip__head">
        <strong>Histórico {config.label}</strong>
      </div>

      {loading ? (
        <div className="bd-kpi-floating-tooltip__empty">Carregando histórico...</div>
      ) : chartPoints.length ? (
        <>
          <svg
            className="bd-kpi-tooltip-line"
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
          >
            <line
              x1={padX}
              x2={width - padX}
              y1={height - padBottom}
              y2={height - padBottom}
            />

            <polyline points={linePoints} />

            {chartPoints.map((item) => (
              <g key={item.data}>
                <circle
                  cx={item.x}
                  cy={item.y}
                  r="3.5"
                  className={`is-${item.tone}`}
                />
                <text
                  x={item.x}
                  y={Math.max(10, item.y - 8)}
                  textAnchor="middle"
                  className={`is-${item.tone}`}
                >
                  {formatPercent(item.value)}
                </text>
              </g>
            ))}
          </svg>

          <div className="bd-kpi-tooltip-dates">
            {chartPoints.map((item) => (
              <span key={item.data}>{formatDateShort(item.data)}</span>
            ))}
          </div>

          <div className="bd-kpi-tooltip-comparison">
            <span>
              Média{' '}
              <b className={`is-${averageTone}`}>{formatPercent(average)}</b>
            </span>

            <strong
              className={
                better === false
                  ? 'is-bad'
                  : better === null
                    ? 'is-reference'
                    : 'is-good'
              }
            >
              {delta == null
                ? '—'
                : `${delta >= 0 ? '+' : ''}${delta.toFixed(1).replace('.', ',')} p.p.`}
            </strong>
          </div>
        </>
      ) : (
        <div className="bd-kpi-floating-tooltip__empty">
          Histórico não disponível.
        </div>
      )}
    </div>,
    document.body
  );
}

export default function BoletimDiarioModal({ equipment, operations, selectedDate: selectedDateProp, onRequestDateChange, onClose }) {
  const [selectedOperator, setSelectedOperator] = useState('TODOS');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);
  const selectedDate = selectedDateProp || equipment.rows[0]?.data || '';

  useEffect(() => {
    let active = true;
    (async () => {
      setHistoryLoading(true);
      try {
        const rows = await fetchAllPages(() => supabase.from('vw_c_boletimdiario_equipamento').select('*').eq('cod_equip', equipment.code).gte('data', minusDaysIso(selectedDate, HISTORY_DAYS - 1)).lte('data', selectedDate).order('data', { ascending: true }));
        if (active) setHistoryRows(normalizeRows(rows));
      } catch (error) {
        console.error('[COA] Histórico do equipamento:', error);
        if (active) setHistoryRows([]);
      } finally {
        if (active) setHistoryLoading(false);
      }
    })();
    return () => { active = false; };
  }, [equipment.code, selectedDate]);

  useEffect(() => {
    const handleEscape = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  useEffect(() => { setSelectedGroup(''); setTooltip(null); }, [selectedOperator]);

  const equipmentOperations = useMemo(() => operations.filter((row) => row.cod_equip === equipment.code), [operations, equipment.code]);
  const operators = useMemo(() => [...new Set(equipmentOperations.map((row) => row.cod_op).filter(Boolean))].sort((a,b) => { if (isUnavailableOperator(a)) return 1; if (isUnavailableOperator(b)) return -1; return shortOperatorName(a).localeCompare(shortOperatorName(b), 'pt-BR'); }), [equipmentOperations]);
  const operatorOperations = useMemo(() => selectedOperator === 'TODOS' ? equipmentOperations : equipmentOperations.filter((row) => row.cod_op === selectedOperator), [equipmentOperations, selectedOperator]);
  const filteredOperations = useMemo(() => selectedGroup ? operatorOperations.filter((row) => groupKey(row.desc_grupo_op) === selectedGroup) : operatorOperations, [operatorOperations, selectedGroup]);
  const baseRows = selectedOperator === 'TODOS' ? equipment.rows : equipment.rows.filter((row) => row.cod_op === selectedOperator);
  const totals = useMemo(() => sumRows(baseRows), [baseRows]);
  const indicators = useMemo(() => calculateIndicators(totals), [totals]);

  const history = useMemo(() => {
    const source = selectedOperator === 'TODOS' ? historyRows : historyRows.filter((row) => row.cod_op === selectedOperator);
    const map = new Map();
    source.forEach((row) => { if (!map.has(row.data)) map.set(row.data, []); map.get(row.data).push(row); });
    return [...map.entries()].sort(([a],[b]) => a.localeCompare(b)).map(([data, rows]) => ({ data, indicators: calculateIndicators(sumRows(rows)) }));
  }, [historyRows, selectedOperator]);

  const operationGroups = useMemo(() => {
    const map = new Map();
    operatorOperations.forEach((row) => { const key = groupKey(row.desc_grupo_op); if (!map.has(key)) map.set(key, { label: row.desc_grupo_op || 'NÃO CLASSIFICADO', seconds: 0 }); map.get(key).seconds += num(row.hrs_operacionais_seg); });
    return [...map.entries()].map(([key,value]) => ({ key, ...value })).sort((a,b) => b.seconds-a.seconds);
  }, [operatorOperations]);
  const maxGroup = Math.max(1, ...operationGroups.map((item) => item.seconds));

  const operationSummary = useMemo(() => {
    const map = new Map();
    filteredOperations.forEach((row) => {
      const key = `${groupKey(row.desc_grupo_op)}|${row.desc_operacao || 'OPERAÇÃO NÃO INFORMADA'}`;
      if (!map.has(key)) map.set(key, { group: row.desc_grupo_op || 'NÃO CLASSIFICADO', operation: row.desc_operacao || 'OPERAÇÃO NÃO INFORMADA', total: 0, idle: 0 });
      const item = map.get(key);
      item.total += num(row.hrs_operacionais_seg);
      if (String(row.categoria || '').toUpperCase() !== 'EMPACOTAMENTO' && groupKey(row.desc_grupo_op) !== 'PRODUTIVO') item.idle += num(row.hrs_ocioso_seg);
    });
    return [...map.values()].sort((a,b) => b.total-a.total);
  }, [filteredOperations]);

  const equipmentOffenders = useMemo(() => {
    const map = new Map();
    operatorOperations
      .filter((row) => ['IMPRODUTIVO', 'AUXILIAR'].includes(groupKey(row.desc_grupo_op)))
      .forEach((row) => {
        const name = row.desc_operacao || 'NÃO INFORMADA';
        map.set(name, (map.get(name) || 0) + num(row.hrs_operacionais_seg));
      });
    return [...map.entries()]
      .map(([name, seconds]) => ({ name, seconds }))
      .sort((a, b) => b.seconds - a.seconds)
      .slice(0, 10);
  }, [operatorOperations]);

  const equipmentOffenderTotal = useMemo(
    () => equipmentOffenders.reduce((sum, item) => sum + item.seconds, 0),
    [equipmentOffenders]
  );

  const greatestIdleOperation = useMemo(() => [...operationSummary].sort((a,b) => b.idle-a.idle)[0] || null, [operationSummary]);
  const selectedOperatorName = selectedOperator === 'TODOS' ? '' : shortOperatorName(selectedOperator);

  const openTooltip = (event, config) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const left = Math.min(window.innerWidth - MODAL_CONFIG.tooltipWidth - 12, Math.max(12, rect.left + rect.width / 2 - MODAL_CONFIG.tooltipWidth / 2));
    let top = rect.top - MODAL_CONFIG.tooltipHeight - 12;
    if (top < 12) top = rect.bottom + 12;
    setTooltip({ config, history, loading: historyLoading, currentValue: indicators[config.key], position: { left, top } });
  };

  return <>
    <div className="bd-modal-backdrop" onMouseDown={onClose}>
      <div className="bd-modal bd-modal--fixed" onMouseDown={(event) => event.stopPropagation()}>
        <header className="bd-modal__header"><div><span className="bd-overline">Detalhamento operacional</span><h2>{equipment.code} <small>{equipment.rows[0]?.desc_equip}</small></h2><p>{equipment.rows[0]?.desc_area} / {equipment.rows[0]?.desc_grupo}{selectedOperatorName ? ` / ${selectedOperatorName}` : ''}</p></div><div className="bd-modal__date"><span>Data analisada</span><div><strong>{formatDateFull(selectedDate)}</strong><button type="button" onClick={onRequestDateChange} title="Selecionar outra data">📆</button><button type="button" className="bd-modal__close" onClick={onClose}>×</button></div></div></header>
        <div className="bd-modal__body bd-modal__body--fixed">
          <section className="bd-operator-picker bd-operator-picker--compact"><span className="bd-overline">Operadores</span><div className="bd-operator-tabs coa-no-scrollbar"><button type="button" className={selectedOperator === 'TODOS' ? 'is-active' : ''} onClick={() => setSelectedOperator('TODOS')}>TODOS</button>{operators.map((operator) => <button type="button" key={operator} className={`${selectedOperator === operator ? 'is-active' : ''} ${isUnavailableOperator(operator) ? 'is-unavailable' : ''}`} onClick={() => setSelectedOperator(operator)} title={splitOperator(operator).fullName || 'Operador não disponível'}>{shortOperatorName(operator)}</button>)}</div></section>
          <section className="bd-modal-kpis bd-modal-kpis--colored">{KPI_CONFIG.map((config) => <article key={config.key} className={`is-${kpiTone(config.key, indicators[config.key])}`} onMouseEnter={(event) => openTooltip(event, config)} onMouseLeave={() => setTooltip(null)}><span>{config.label}</span><strong>{formatPercent(indicators[config.key])}</strong></article>)}</section>
          <section className="bd-modal-analysis-grid">
            <article className="bd-panel bd-modal-distribution-panel"><header><div><span className="bd-overline">Distribuição</span></div><span>{formatDuration(totals.hrs_operacionais_seg)}</span></header><div className="bd-modal-bars bd-modal-bars--clickable coa-no-scrollbar">{operationGroups.map((item) => <button type="button" key={item.key} className={selectedGroup === item.key ? 'is-active' : ''} onClick={() => setSelectedGroup((current) => current === item.key ? '' : item.key)}><span>{item.label}</span><div><i style={{ width: `${(item.seconds/maxGroup)*100}%`, background: groupColor(item.key) }}/></div><strong>{formatDuration(item.seconds)}</strong></button>)}</div></article>
            <article className="bd-panel bd-modal-operations-panel"><header><div><span className="bd-overline">Operações</span></div><span>{selectedGroup || `${operationSummary.length} operações`}</span></header><div className="bd-operation-summary-wrap coa-no-scrollbar"><div className="bd-operation-summary__head"><span>Operação</span><b>Total</b><b>Ocioso</b><b>%</b></div><div className="bd-operation-summary">{operationSummary.map((item) => <div key={`${item.group}|${item.operation}`} style={{ '--operation-color': groupColor(item.group) }}><span><i/><strong>{item.operation}</strong></span><b>{formatDuration(item.total)}</b><b className={item.idle > 0 ? 'has-idle' : ''}>{formatDuration(item.idle)}</b><b>{formatPercent(safePercent(item.total, totals.hrs_operacionais_seg))}</b></div>)}{!operationSummary.length && <div className="coa-empty">Nenhuma operação encontrada.</div>}</div></div></article>
            <article className="bd-panel bd-modal-offenders-panel"><header><div><span className="bd-overline">Top 10 Ofensores</span></div><span>{formatDuration(equipmentOffenderTotal)}</span></header><div className="bd-modal-offenders coa-no-scrollbar">{equipmentOffenders.map((item,index)=><div className="bd-modal-offender" key={item.name}><span>{String(index+1).padStart(2,'0')}</span><div><strong>{item.name}</strong><div><i style={{width:`${equipmentOffenders[0]?.seconds?item.seconds/equipmentOffenders[0].seconds*100:0}%`}}/></div></div><b>{formatDuration(item.seconds)}</b><b>{formatPercent(safePercent(item.seconds,totals.hrs_operacionais_seg))}</b></div>)}{!equipmentOffenders.length&&<div className="coa-empty">Sem ofensores neste filtro.</div>}</div></article>
          </section>
          <section className="bd-modal-insights"><div>{indicators.indeterminado > 10 && <p className="is-warning">Equipamento com <strong>{formatPercent(indicators.indeterminado)}</strong> de Indeterminado, dados estão sujeitos a recálculo após atualização dos dados.</p>}{greatestIdleOperation && greatestIdleOperation.idle > 0 ? <p>A operação <strong className="bd-insight-danger">{greatestIdleOperation.operation}</strong> é a maior em motor ocioso, com <strong className="bd-insight-danger">{formatDuration(greatestIdleOperation.idle)}</strong> no total.</p> : <p>Nenhuma operação com motor ocioso foi identificada neste filtro.</p>}</div></section>
        </div>
      </div>
    </div>
    <KpiTooltip tooltip={tooltip}/>
  </>;
}
