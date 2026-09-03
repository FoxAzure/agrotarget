import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// ============================================================================
// DASH CUC — V1 REFINADA
// ============================================================================
// OBJETIVO
// Dashboard fullscreen para análise histórica de CUC, vazão e entupimento.
// A leitura principal segue: CAMPO -> AVALIAÇÃO -> LOTES -> DEPA.
//
// FONTES
// - vw_q_cucgeral: histórico consolidado por campo/avaliação.
// - tb_q_agrotarget: detalhe bruto por lote/emissor.
//
// REGRAS DE COMPARAÇÃO
// - Cada avaliação compara com a avaliação cronologicamente anterior do mesmo campo.
// - CUC: subir = bom (verde), descer = ruim (vermelho).
// - Entupimento: descer = bom (verde), subir = ruim (vermelho).
// - Quando não existe base: "Sem Histórico".
//
// DEPA
// - O card abre um modal analítico.
// - O ano mais recente do DEPA é selecionado automaticamente.
// - O gráfico mensal pode filtrar a lista de campos pelo mês clicado.
// - A lista de variações mostra as mudanças mais relevantes da avaliação mais
//   recente do campo contra sua avaliação imediatamente anterior.
// ============================================================================

// =============================== CONFIGURAÇÕES ==============================
const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = Array.from({ length: 12 }, (_, i) => `${i + 1}º Emissor`);

const META_CUC = 90;
const META_ENTUP = 5;

// Ajuste global de tipografia aqui.
const FONT_SIZE = {
  base: 10,
  xs: 8,
  sm: 9,
  md: 11,
  lg: 14,
  xl: 18,
  title: 26,
  kpi: 23,
  chartLabel: 8,
  chartValue: 9,
};

// Ajuste de tamanhos estruturais aqui.
const LAYOUT = {
  sidebarWidth: 270,
  contentPadding: 12,
  gap: 10,
  radius: 12,
  evalCardWidth: 144,
  historyHeight: 178,
  lotChartHeight: 215,
  histogramHeight: 215,
};

// Paleta centralizada.
const COLORS = {
  bg: '#eef3f8',
  bgSoft: '#f7f9fc',
  card: '#ffffff',
  text: '#0f172a',
  muted: '#475569',
  faint: '#94a3b8',
  border: '#dfe6ee',
  borderSoft: '#edf1f5',
  blue: '#2563eb',
  blueDark: '#1e40af',
  green: '#16a34a',
  greenSoft: '#ecfdf5',
  orange: '#d97706',
  orangeSoft: '#fffbeb',
  red: '#dc2626',
  redSoft: '#fef2f2',
  sky: '#0284c7',
  shadow: '0 1px 2px rgba(15,23,42,.04), 0 8px 20px rgba(15,23,42,.035)',
};

// ================================ HELPERS ==================================
const num = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = '') => String(value ?? fallback).trim();

const formatValue = (value, decimals = 1) => {
  if (value === null || value === undefined || value === '') return '—';
  return num(value).toFixed(decimals).replace('.', ',');
};

const dateTime = value => {
  const raw = text(value);
  if (!raw) return 0;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return new Date(`${raw.slice(0, 10)}T12:00:00`).getTime();
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const [day, month, year] = raw.slice(0, 10).split('/');
    return new Date(`${year}-${month}-${day}T12:00:00`).getTime();
  }
  return 0;
};

const formatDate = value => {
  const raw = text(value);
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const [year, month, day] = raw.slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
  }
  return raw;
};

const monthOf = value => {
  const raw = text(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return num(raw.slice(5, 7), null);
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return num(raw.slice(3, 5), null);
  return null;
};

const fieldKey = row => text(row?.codigo_campo || row?.campo);
const evaluationKey = row => row ? `${fieldKey(row)}|${row.ano}|${row.avaliacao}|${text(row.dt_final)}` : '';

const sortEvaluationsNewest = (a, b) =>
  dateTime(b.dt_final) - dateTime(a.dt_final) ||
  num(b.ano) - num(a.ano) ||
  num(b.avaliacao) - num(a.avaliacao);

const sortEvaluationsOldest = (a, b) =>
  dateTime(a.dt_final) - dateTime(b.dt_final) ||
  num(a.ano) - num(b.ano) ||
  num(a.avaliacao) - num(b.avaliacao);

const cucColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return COLORS.faint;
  if (v >= META_CUC) return COLORS.green;
  if (v >= 80) return COLORS.orange;
  return COLORS.red;
};

const entupColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return COLORS.faint;
  if (v <= META_ENTUP) return COLORS.green;
  if (v <= 10) return COLORS.orange;
  return COLORS.red;
};

const vazaoColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return COLORS.faint;
  if (v >= 0.9 && v <= 1.1) return COLORS.green;
  if (v >= 0.8 && v < 0.9) return '#ea580c';
  if (v > 1.1 && v <= 1.2) return COLORS.orange;
  return v > 1.2 ? COLORS.sky : COLORS.red;
};

const getStatus = row => {
  if (num(row?.cuc) >= META_CUC && num(row?.['entup%']) <= META_ENTUP) return 'ESTÁVEL';
  if (num(row?.cuc) >= 80 && num(row?.['entup%']) <= 10) return 'ATENÇÃO';
  return 'CRÍTICO';
};

const statusTone = status => ({
  ESTÁVEL: [COLORS.greenSoft, '#bbf7d0', '#15803d'],
  ATENÇÃO: [COLORS.orangeSoft, '#fde68a', '#b45309'],
  CRÍTICO: [COLORS.redSoft, '#fecaca', '#b91c1c'],
}[status] || ['#f8fafc', COLORS.border, COLORS.muted]);

const calcularCuc = values => {
  const valid = (values || []).map(num).filter(value => value > 0);
  if (!valid.length) return 0;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  const deviation = valid.reduce((sum, value) => sum + Math.abs(value - mean), 0);
  return 100 * (1 - deviation / (valid.length * mean));
};

const smoothPath = points => {
  if (!points.length) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i += 1) {
    const prev = points[i - 1];
    const curr = points[i];
    const middle = (prev.x + curr.x) / 2;
    path += ` C ${middle} ${prev.y}, ${middle} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  return path;
};

const deltaValue = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  return num(current) - num(previous);
};

// ============================== UI PRIMITIVES ================================
function StatusBadge({ row, compact = false }) {
  const status = getStatus(row);
  const [background, borderColor, color] = statusTone(status);
  return (
    <span className={`cuc-status ${compact ? 'is-compact' : ''}`} style={{ background, borderColor, color }}>
      {status}
    </span>
  );
}

function Delta({ current, previous, inverse = false }) {
  const value = deltaValue(current, previous);
  if (value === null) return <span className="cuc-delta is-empty">Sem Histórico</span>;
  if (Math.abs(value) < 0.01) return <span className="cuc-delta is-neutral">• 0,0 p.p.</span>;
  const up = value > 0;
  const good = inverse ? !up : up;
  return (
    <span className={`cuc-delta ${good ? 'is-good' : 'is-bad'}`}>
      {up ? '▲' : '▼'} {up ? '+' : ''}{formatValue(value)} p.p.
    </span>
  );
}

function Kpi({ label, value, color, unit = '', delta, inverse = false }) {
  return (
    <div className="cuc-kpi">
      <span>{label}</span>
      <strong style={{ color }}>{value}{unit}</strong>
      {delta !== undefined && <small><Delta current={value} previous={delta} inverse={inverse} /></small>}
    </div>
  );
}

function EvaluationCard({ row, previous, selected, onSelect }) {
  return (
    <button className={`cuc-evaluation ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="cuc-evaluation-top">
        <strong>{row.avaliacao}ª Av/{row.ano}</strong>
        <StatusBadge row={row} compact />
      </div>
      <div className="cuc-evaluation-main">
        <div>
          <strong>{formatDate(row.dt_final)}</strong>
          <span>CUC</span>
        </div>
        <em style={{ color: cucColor(row.cuc) }}>{formatValue(row.cuc)}%</em>
      </div>
      <div className="cuc-evaluation-foot">
        <Delta current={row.cuc} previous={previous?.cuc} />
      </div>
    </button>
  );
}

// =============================== CHART FIELD ================================
function HistoryChart({ evaluations, selectedKey }) {
  const data = [...evaluations].sort(sortEvaluationsOldest);
  const [hovered, setHovered] = useState(null);
  const width = 560;
  const height = LAYOUT.historyHeight;
  const padding = { left: 34, right: 16, top: 24, bottom: 32 };
  const plotHeight = height - padding.top - padding.bottom;

  const y = value => {
    const clamped = Math.max(70, Math.min(100, num(value)));
    return padding.top + (100 - clamped) / 30 * plotHeight;
  };
  const x = index => data.length <= 1
    ? width / 2
    : padding.left + index * ((width - padding.left - padding.right) / (data.length - 1));

  const points = data.map((row, index) => ({ x: x(index), y: y(row.cuc), row, index }));
  const path = smoothPath(points);

  return (
    <div className="cuc-history-wrap" onMouseLeave={() => setHovered(null)}>
      <div className="cuc-history-header">
        <div>
          <strong>Evolução do CUC</strong>
          <span>Meta {META_CUC}%</span>
        </div>
        <small>{data.length} avaliações</small>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[80, 90, 100].map(tick => (
          <g key={tick}>
            <line x1={padding.left} x2={width - padding.right} y1={y(tick)} y2={y(tick)} className={tick === META_CUC ? 'is-meta' : ''} />
            <text x={padding.left - 7} y={y(tick) + 3} textAnchor="end">{tick}</text>
          </g>
        ))}
        <path d={path} />
        {points.map(point => {
          const key = evaluationKey(point.row);
          const selected = key === selectedKey;
          return (
            <g key={key} onMouseEnter={() => setHovered(point)}>
              <circle cx={point.x} cy={point.y} r={selected ? 5.5 : 4} className={selected ? 'is-selected' : ''} />
              <circle cx={point.x} cy={point.y} r="13" fill="transparent" />
              <text x={point.x} y={height - 9} textAnchor="middle" className={selected ? 'is-current' : ''}>
                {point.row.avaliacao}ª/{point.row.ano}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered && (() => {
        const current = hovered.row;
        const previous = hovered.index > 0 ? data[hovered.index - 1] : null;
        return (
          <div
            className="cuc-chart-tooltip"
            style={{ left: `${(hovered.x / width) * 100}%`, top: `${(hovered.y / height) * 100}%` }}
          >
            <div className="tooltip-head">
              <strong>{current.avaliacao}ª Av/{current.ano}</strong>
              <StatusBadge row={current} compact />
            </div>
            <div className="tooltip-grid">
              <div><span>CUC</span><b style={{ color: cucColor(current.cuc) }}>{formatValue(current.cuc)}%</b></div>
              <div><span>Vazão</span><b style={{ color: vazaoColor(current.vazao) }}>{formatValue(current.vazao, 2)} L/h</b></div>
              <div><span>Entupidos</span><b style={{ color: entupColor(current['entup%']) }}>{formatValue(current['entup%'])}%</b></div>
            </div>
            <div className="tooltip-compare">
              <span>Comparado à anterior</span>
              <div><b>CUC</b><Delta current={current.cuc} previous={previous?.cuc} /></div>
              <div><b>Entup.</b><Delta current={current['entup%']} previous={previous?.['entup%']} inverse /></div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

// ================================ LOT CHART =================================
function LotChart({ lots, onSelect }) {
  return (
    <div className="cuc-lot-scroll">
      <div className="cuc-lot-chart" style={{ minWidth: Math.max(560, lots.length * 48) }}>
        <div className="cuc-lot-line line-90"><span>90%</span></div>
        <div className="cuc-lot-line line-80"><span>80%</span></div>
        <div className="cuc-lot-bars">
          {lots.map(lot => (
            <button key={lot.loteRaw} onClick={() => onSelect(lot)} title={`Lote ${lot.loteFormatado}`}>
              <em>{formatValue(lot.cuc, 0)}%</em>
              <i style={{ height: `${Math.max(4, Math.min(100, lot.cuc))}%`, background: cucColor(lot.cuc) }} />
              <strong>{lot.loteFormatado}</strong>
            </button>
          ))}
          {!lots.length && <div className="cuc-empty">Nenhum lote encontrado.</div>}
        </div>
      </div>
    </div>
  );
}

// ================================= HISTOGRAMA ===============================
function Histogram({ data }) {
  const items = [
    ['red', '<0,8', data?.red || 0],
    ['orange', '0,8–0,9', data?.orange || 0],
    ['green', '0,9–1,1', data?.green || 0],
    ['yellow', '1,1–1,2', data?.yellow || 0],
    ['blue', '>1,2', data?.blue || 0],
  ];
  const max = Math.max(1, ...items.map(item => item[2]));
  return (
    <div className="cuc-histogram">
      {items.map(([tone, label, value]) => (
        <div className="hist-col" key={tone}>
          <b>{value}</b>
          <span><i className={tone} style={{ height: `${Math.max(4, value / max * 100)}%` }} /></span>
          <small>{label}</small>
        </div>
      ))}
    </div>
  );
}

// ================================ LOTE MODAL ================================
function LoteModal({ evaluation, lot, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState('L/h');

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('tb_q_agrotarget')
        .select('lote,indicador,valor,turno')
        .eq('ano', num(evaluation.ano))
        .eq('campo', text(evaluation.campo))
        .eq('extra1', text(evaluation.avaliacao))
        .eq('lote', text(lot.loteRaw))
        .in('ocorrencia', CUC_OCORRENCIAS);
      if (error) console.error('CUC lote:', error);
      if (active) {
        setRows(data || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [evaluation, lot]);

  const emitters = useMemo(() => (
    rows
      .filter(row => EMISSORES_VALIDOS.includes(text(row.indicador)))
      .sort((a, b) => EMISSORES_VALIDOS.indexOf(a.indicador) - EMISSORES_VALIDOS.indexOf(b.indicador))
  ), [rows]);

  return (
    <div className="cuc-modal-backdrop" onMouseDown={onClose}>
      <div className="cuc-modal cuc-modal-lot" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <strong>Lote {lot.loteFormatado}</strong>
            <small>{evaluation.campo} • {evaluation.ano} • {evaluation.avaliacao}ª Av • {lot.turno}</small>
          </div>
          <button className="cuc-close-btn" onClick={onClose}>×</button>
        </header>
        <main>
          {loading ? (
            <div className="cuc-empty">Consultando emissores…</div>
          ) : (
            <>
              <div className="cuc-modal-kpis">
                <Kpi label="CUC" value={formatValue(lot.cuc)} unit="%" color={cucColor(lot.cuc)} />
                <Kpi label="Vazão" value={formatValue(lot.vazao, 2)} unit=" L/h" color={vazaoColor(lot.vazao)} />
                <Kpi label="Entupimento" value={formatValue(lot.entupPerc)} unit="%" color={entupColor(lot.entupPerc)} />
                <Kpi label="Emissores" value={emitters.length} color={COLORS.text} />
              </div>

              <section className="cuc-modal-card">
                <div className="cuc-panel-heading">
                  <strong>Emissores coletados</strong>
                  <div className="cuc-unit">
                    {['mL', 'L/h'].map(item => (
                      <button key={item} className={unit === item ? 'is-active' : ''} onClick={() => setUnit(item)}>{item}</button>
                    ))}
                  </div>
                </div>
                <div className="cuc-emitter-grid">
                  {emitters.map((row, index) => {
                    const ml = num(row.valor);
                    const lh = ml * 0.02;
                    return (
                      <div key={`${row.indicador}-${index}`}>
                        <strong style={{ color: vazaoColor(lh) }}>{unit === 'mL' ? formatValue(ml, 0) : formatValue(lh, 2)}</strong>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// ================================ DEPA MODAL ================================
function DepaModal({ depaName, allRows, preferredYear, onClose, onSelectField }) {
  const [selectedYear, setSelectedYear] = useState(null);
  const [metric, setMetric] = useState('cuc');
  const [selectedMonth, setSelectedMonth] = useState(null);

  const depaRows = useMemo(() => allRows.filter(row => row.depa === depaName), [allRows, depaName]);

  const years = useMemo(
    () => [...new Set(depaRows.map(row => row.ano).filter(Boolean))].sort((a, b) => b - a),
    [depaRows]
  );

  useEffect(() => {
    if (!years.length) return;
    const defaultYear = preferredYear && years.includes(Number(preferredYear)) ? Number(preferredYear) : years[0];
    setSelectedYear(defaultYear);
    setSelectedMonth(null);
  }, [depaName, preferredYear, years]);

  const yearRows = useMemo(
    () => depaRows.filter(row => row.ano === Number(selectedYear)),
    [depaRows, selectedYear]
  );

  const monthlyData = useMemo(() => {
    const months = Array.from({ length: 12 }, (_, index) => ({ mes: index + 1, avg: null, rows: [] }));
    yearRows.forEach(row => {
      const month = monthOf(row.dt_final);
      if (month && month >= 1 && month <= 12) months[month - 1].rows.push(row);
    });
    months.forEach(month => {
      if (!month.rows.length) return;
      const key = metric === 'entup' ? 'entup%' : metric;
      month.avg = month.rows.reduce((sum, row) => sum + num(row[key]), 0) / month.rows.length;
    });
    return months;
  }, [yearRows, metric]);

  const visibleFields = useMemo(() => {
    if (!selectedMonth) return yearRows;
    return yearRows.filter(row => monthOf(row.dt_final) === selectedMonth);
  }, [yearRows, selectedMonth]);

  const monthlyPoints = useMemo(() => {
    const active = monthlyData.filter(month => month.avg !== null);
    if (!active.length) return [];
    const values = active.map(month => month.avg);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = Math.max((max - min) * 0.15, metric === 'cuc' ? 3 : 0.05);
    const minValue = min - pad;
    const maxValue = max + pad;
    const chartWidth = 720;
    const chartHeight = 185;
    const left = 34;
    const right = 14;
    const top = 18;
    const bottom = 34;
    const x = index => left + index * ((chartWidth - left - right) / 11);
    const y = value => top + (maxValue - value) / (maxValue - minValue || 1) * (chartHeight - top - bottom);
    return monthlyData.map((month, index) => month.avg === null ? null : ({
      x: x(index),
      y: y(month.avg),
      month,
      value: month.avg,
      chartWidth,
      chartHeight,
    })).filter(Boolean);
  }, [monthlyData, metric]);

  const monthlyPath = smoothPath(monthlyPoints);

  const fieldChanges = useMemo(() => {
    const grouped = new Map();
    depaRows.forEach(row => {
      const key = fieldKey(row);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    const changes = [];
    grouped.forEach(evals => {
      const sorted = [...evals].sort(sortEvaluationsNewest);
      const current = sorted[0];
      const previous = sorted[1] || null;
      if (!current || current.ano !== Number(selectedYear)) return;
      changes.push({
        campo: current.campo,
        current,
        previous,
        deltaCuc: deltaValue(current.cuc, previous?.cuc),
        deltaEntup: deltaValue(current['entup%'], previous?.['entup%']),
      });
    });
    return changes.sort((a, b) => {
      const scoreA = Math.abs(a.deltaCuc || 0) + Math.abs(a.deltaEntup || 0) * 0.7;
      const scoreB = Math.abs(b.deltaCuc || 0) + Math.abs(b.deltaEntup || 0) * 0.7;
      return scoreB - scoreA;
    });
  }, [depaRows, selectedYear]);

  const average = useMemo(() => {
    if (!yearRows.length) return { cuc: 0, vazao: 0, entup: 0 };
    return {
      cuc: yearRows.reduce((sum, row) => sum + num(row.cuc), 0) / yearRows.length,
      vazao: yearRows.reduce((sum, row) => sum + num(row.vazao), 0) / yearRows.length,
      entup: yearRows.reduce((sum, row) => sum + num(row['entup%']), 0) / yearRows.length,
    };
  }, [yearRows]);

  const monthLabels = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

  return (
    <div className="cuc-modal-backdrop" onMouseDown={onClose}>
      <div className="cuc-modal cuc-modal-depa" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <strong>{depaName}</strong>
            <small>Visão geral do desempenho</small>
          </div>
          <div className="depa-year-tabs">
            {years.map(year => (
              <button key={year} className={Number(selectedYear) === Number(year) ? 'is-active' : ''} onClick={() => { setSelectedYear(year); setSelectedMonth(null); }}>
                {year}
              </button>
            ))}
            <button className="cuc-close-btn" onClick={onClose}>×</button>
          </div>
        </header>

        <main>
          <div className="depa-metric-tabs">
            <button className={metric === 'cuc' ? 'is-active' : ''} onClick={() => setMetric('cuc')}>CUC</button>
            <button className={metric === 'vazao' ? 'is-active' : ''} onClick={() => setMetric('vazao')}>Vazão L/h</button>
            <button className={metric === 'entup' ? 'is-active' : ''} onClick={() => setMetric('entup')}>Entupidos</button>
          </div>

          <section className="depa-chart-card">
            <div className="depa-chart-meta">
              <div>
                <strong>Média mensal</strong>
                <span>{selectedMonth ? `${monthLabels[selectedMonth - 1]} selecionado` : 'Clique em um mês para filtrar os campos'}</span>
              </div>
              <b>{metric === 'cuc' ? `${formatValue(average.cuc)}%` : metric === 'vazao' ? `${formatValue(average.vazao, 2)} L/h` : `${formatValue(average.entup)}%`}</b>
            </div>
            <div className="depa-chart-wrap">
              <svg viewBox="0 0 720 185" preserveAspectRatio="none">
                <line x1="34" x2="706" y1="146" y2="146" className="base-line" />
                <path d={monthlyPath} className="depa-trend-path" />
                {monthlyData.map((month, index) => {
                  if (month.avg === null) return <text key={month.mes} x={34 + index * ((720 - 34 - 14) / 11)} y="175" textAnchor="middle" className="month-label">{monthLabels[index]}</text>;
                  const point = monthlyPoints.find(item => item.month.mes === month.mes);
                  const selected = selectedMonth === month.mes;
                  return (
                    <g key={month.mes} onClick={() => setSelectedMonth(selected ? null : month.mes)} style={{ cursor: 'pointer' }}>
                      <circle cx={point.x} cy={point.y} r={selected ? 6 : 4} className={selected ? 'selected-point' : ''} />
                      <text x={point.x} y={Math.max(12, point.y - 10)} textAnchor="middle" className="depa-value">{formatValue(month.avg, metric === 'vazao' ? 2 : 1)}</text>
                      <text x={point.x} y="175" textAnchor="middle" className="month-label">{monthLabels[index]}</text>
                    </g>
                  );
                })}
              </svg>
            </div>
          </section>

          <section className="depa-average-row">
            <div><span>CUC médio</span><b style={{ color: cucColor(average.cuc) }}>{formatValue(average.cuc)}%</b></div>
            <div><span>Vazão média</span><b style={{ color: vazaoColor(average.vazao) }}>{formatValue(average.vazao, 2)}</b></div>
            <div><span>Entupimento médio</span><b style={{ color: entupColor(average.entup) }}>{formatValue(average.entup)}%</b></div>
            <div><span>Campos</span><b>{visibleFields.length}</b></div>
          </section>

          <div className="depa-bottom-grid">
            <section className="depa-list-card">
              <header><strong>{selectedMonth ? `Campos de ${monthLabels[selectedMonth - 1]}` : 'Campos avaliados'}</strong><span>{visibleFields.length}</span></header>
              <div className="depa-list-scroll">
                {visibleFields.sort((a, b) => sortEvaluationsNewest(a, b)).map(row => (
                  <button
                    key={evaluationKey(row)}
                    onClick={() => { onSelectField(row); onClose(); }}
                    className="depa-field-row"
                  >
                    <div>
                      <strong>{row.campo}</strong>
                      <small>{row.avaliacao}ª Av/{row.ano}</small>
                    </div>
                    <span style={{ color: cucColor(row.cuc) }}>{formatValue(row.cuc)}%</span>
                    <span style={{ color: entupColor(row['entup%']) }}>{formatValue(row['entup%'])}%</span>
                    <StatusBadge row={row} compact />
                  </button>
                ))}
                {!visibleFields.length && <div className="cuc-empty">Sem campos para este filtro.</div>}
              </div>
            </section>

            <section className="depa-list-card">
              <header><strong>Variações mais relevantes</strong><span>{fieldChanges.length}</span></header>
              <div className="depa-list-scroll">
                {fieldChanges.slice(0, 14).map((change, index) => (
                  <button key={`${change.campo}-${index}`} className="depa-change-row" onClick={() => { onSelectField(change.current); onClose(); }}>
                    <div>
                      <strong>{change.campo}</strong>
                      <small>{change.previous ? `${change.previous.avaliacao}ª/${change.previous.ano} → ${change.current.avaliacao}ª/${change.current.ano}` : 'Sem avaliação anterior'}</small>
                    </div>
                    <div><span>CUC</span><Delta current={change.current.cuc} previous={change.previous?.cuc} /></div>
                    <div><span>Entup.</span><Delta current={change.current['entup%']} previous={change.previous?.['entup%']} inverse /></div>
                  </button>
                ))}
                {!fieldChanges.length && <div className="cuc-empty">Sem variações para o ano.</div>}
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}

// ================================ MAIN DASH =================================
export default function DashCUC() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [selectedFieldKey, setSelectedFieldKey] = useState('');
  const [selectedEvaluationKey, setSelectedEvaluationKey] = useState('');

  const [selectedLot, setSelectedLot] = useState(null);
  const [lots, setLots] = useState([]);
  const [histogram, setHistogram] = useState(null);
  const [loadingLots, setLoadingLots] = useState(false);
  const [openedDepa, setOpenedDepa] = useState(null);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError('');
      const { data, error: queryError } = await supabase
        .from('vw_q_cucgeral')
        .select('*')
        .order('dt_final', { ascending: false });
      if (!active) return;
      if (queryError) {
        setError(queryError.message);
      } else {
        setRows((data || []).map(row => ({
          ...row,
          ano: num(row.ano),
          avaliacao: text(row.avaliacao),
          codigo_campo: text(row.codigo_campo),
          campo: text(row.campo || row.codigo_campo),
          depa: text(row.depa, 'SEM DEPA'),
          setor: text(row.setor, 'SEM SETOR'),
          cuc: num(row.cuc),
          vazao: num(row.vazao),
          'entup%': num(row['entup%']),
          total_lotes: num(row.total_lotes),
          emissores: num(row.emissores),
          entupido: num(row.entupido),
        })));
      }
      setLoading(false);
    })();
    return () => { active = false; };
  }, []);

  const fields = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const key = fieldKey(row);
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          key,
          codigo_campo: row.codigo_campo,
          campo: row.campo,
          depa: row.depa,
          setor: row.setor,
          evaluations: [],
        });
      }
      map.get(key).evaluations.push(row);
    });
    map.forEach(field => field.evaluations.sort(sortEvaluationsNewest));
    return [...map.values()].sort((a, b) => dateTime(b.evaluations[0]?.dt_final) - dateTime(a.evaluations[0]?.dt_final));
  }, [rows]);

  const filteredFields = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return fields;
    return fields.filter(field => `${field.campo} ${field.codigo_campo}`.toLowerCase().includes(term));
  }, [fields, search]);

  useEffect(() => {
    if (fields.length && !fields.some(field => field.key === selectedFieldKey)) {
      setSelectedFieldKey(fields[0].key);
    }
  }, [fields, selectedFieldKey]);

  const activeField = fields.find(field => field.key === selectedFieldKey) || fields[0] || null;

  useEffect(() => {
    if (activeField && !activeField.evaluations.some(row => evaluationKey(row) === selectedEvaluationKey)) {
      setSelectedEvaluationKey(evaluationKey(activeField.evaluations[0]));
    }
  }, [activeField, selectedEvaluationKey]);

  const selectedEvaluation = activeField?.evaluations.find(row => evaluationKey(row) === selectedEvaluationKey) || activeField?.evaluations[0] || null;
  const selectedIndex = activeField?.evaluations.findIndex(row => evaluationKey(row) === evaluationKey(selectedEvaluation)) ?? -1;
  const previousEvaluation = selectedIndex >= 0 ? activeField?.evaluations[selectedIndex + 1] || null : null;

  useEffect(() => {
    let active = true;
    (async () => {
      if (!selectedEvaluation) {
        setLots([]);
        setHistogram(null);
        return;
      }
      setLoadingLots(true);
      const { data, error: queryError } = await supabase
        .from('tb_q_agrotarget')
        .select('lote,indicador,valor,turno')
        .eq('ano', num(selectedEvaluation.ano))
        .eq('campo', text(selectedEvaluation.campo))
        .eq('extra1', text(selectedEvaluation.avaliacao))
        .in('ocorrencia', CUC_OCORRENCIAS);
      if (queryError) console.error('CUC lotes:', queryError);
      if (!active) return;

      const map = new Map();
      const hist = { red: 0, orange: 0, green: 0, yellow: 0, blue: 0 };

      (data || []).forEach(row => {
        const raw = text(row.lote, '0');
        if (!map.has(raw)) {
          map.set(raw, {
            loteRaw: raw,
            emissores: [],
            entupidos: 0,
            turno: text(row.turno, 'SEM TURNO'),
          });
        }
        const lot = map.get(raw);
        const value = num(row.valor);
        if (EMISSORES_VALIDOS.includes(text(row.indicador))) {
          lot.emissores.push(value);
          const lh = value * 0.02;
          if (lh < 0.8) hist.red += 1;
          else if (lh < 0.9) hist.orange += 1;
          else if (lh <= 1.1) hist.green += 1;
          else if (lh <= 1.2) hist.yellow += 1;
          else hist.blue += 1;
        }
        if (text(row.indicador) === 'Emissores Entupidos') lot.entupidos += value;
      });

      const processed = [...map.values()].map(lot => {
        const average = lot.emissores.length ? lot.emissores.reduce((a, b) => a + b, 0) / lot.emissores.length : 0;
        const lotNumber = parseInt(lot.loteRaw, 10);
        return {
          ...lot,
          loteNum: Number.isNaN(lotNumber) ? 999999 : lotNumber,
          loteFormatado: Number.isNaN(lotNumber) ? lot.loteRaw : String(lotNumber).padStart(2, '0'),
          cuc: calcularCuc(lot.emissores),
          vazao: average * 0.02,
          entupPerc: lot.emissores.length ? (lot.entupidos / lot.emissores.length) * 100 : 0,
        };
      }).sort((a, b) => a.loteNum - b.loteNum);

      setLots(processed);
      setHistogram(hist);
      setLoadingLots(false);
    })();
    return () => { active = false; };
  }, [selectedEvaluation]);

  const depaStats = useMemo(() => {
    const groups = new Map();
    fields.forEach(field => {
      const current = field.evaluations[0];
      if (!groups.has(field.depa)) groups.set(field.depa, []);
      groups.get(field.depa).push(current);
    });
    return [...groups].map(([depa, list]) => ({
      depa,
      total: list.length,
      cuc: list.reduce((sum, row) => sum + num(row.cuc), 0) / list.length,
      ent: list.reduce((sum, row) => sum + num(row['entup%']), 0) / list.length,
      critical: list.filter(row => getStatus(row) === 'CRÍTICO').length,
      attention: list.filter(row => getStatus(row) === 'ATENÇÃO').length,
      stable: list.filter(row => getStatus(row) === 'ESTÁVEL').length,
    })).sort((a, b) => a.cuc - b.cuc);
  }, [fields]);

  const chronologicalEvaluations = useMemo(
    () => activeField ? [...activeField.evaluations].sort(sortEvaluationsOldest) : [],
    [activeField]
  );

  const selectField = field => {
    setSelectedFieldKey(field.key || fieldKey(field));
    setSelectedEvaluationKey(evaluationKey(field.evaluations ? field.evaluations[0] : field));
    setSelectedLot(null);
  };

  if (loading) return <div className="cuc-loading">Carregando histórico CUC…</div>;
  if (error) return <div className="cuc-loading is-error">Erro ao carregar CUC: {error}</div>;

  return (
    <div className="dash-cuc-v1">
      <style>{CSS}</style>

      <div className="cuc-layout">
        <aside className="cuc-sidebar">
          <div className="cuc-search-wrap">
            <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar campo…" />
            {search && <button className="cuc-clear-search" onClick={() => setSearch('')} aria-label="Limpar busca">×</button>}
          </div>

          <div className="cuc-field-list">
            {filteredFields.map(field => {
              const latest = field.evaluations[0];
              const selected = field.key === activeField?.key;
              return (
                <button key={field.key} className={`cuc-field-row ${selected ? 'is-selected' : ''}`} onClick={() => selectField(field)}>
                  <span className="field-left">
                    <span className="field-eval">{latest.avaliacao}º Av/{latest.ano}</span>
                    <strong>{field.campo}</strong>
                  </span>
                  <span className="field-cuc" style={{ color: cucColor(latest.cuc) }}>{formatValue(latest.cuc)}%</span>
                </button>
              );
            })}
            {!filteredFields.length && <div className="cuc-empty">Nenhum campo encontrado.</div>}
          </div>
        </aside>

        <main className="cuc-content">
          <section className="cuc-top-card">
            <div className="cuc-field-summary">
              <div className="cuc-title-row">
                <div>
                  <div className="cuc-context-line">
                    <span>{selectedEvaluation?.depa}</span>
                    <span>{selectedEvaluation?.setor}</span>
                    <StatusBadge row={selectedEvaluation} compact />
                  </div>
                  <h1>{selectedEvaluation?.campo || '—'}</h1>
                  <p>{selectedEvaluation?.avaliacao || '—'}ª avaliação de {selectedEvaluation?.ano || '—'} • {formatDate(selectedEvaluation?.dt_final)}</p>
                </div>
              </div>

              <div className="cuc-main-metrics">
                <Kpi label="CUC" value={formatValue(selectedEvaluation?.cuc)} unit="%" color={cucColor(selectedEvaluation?.cuc)} delta={previousEvaluation?.cuc} />
                <Kpi label="Vazão L/h" value={formatValue(selectedEvaluation?.vazao, 2)} color={vazaoColor(selectedEvaluation?.vazao)} delta={previousEvaluation?.vazao} />
                <Kpi label="Entupidos" value={formatValue(selectedEvaluation?.['entup%'])} unit="%" color={entupColor(selectedEvaluation?.['entup%'])} delta={previousEvaluation?.['entup%']} inverse />
              </div>
            </div>

            <HistoryChart evaluations={activeField?.evaluations || []} selectedKey={selectedEvaluationKey} />
          </section>

          <section className="cuc-panel cuc-evaluations-panel">
            <div className="cuc-section-head"><strong>Avaliações do campo</strong><span>{chronologicalEvaluations.length}</span></div>
            <div className="cuc-evaluations-row">
              {chronologicalEvaluations.map((row, index) => (
                <EvaluationCard
                  key={evaluationKey(row)}
                  row={row}
                  previous={chronologicalEvaluations[index - 1]}
                  selected={evaluationKey(row) === selectedEvaluationKey}
                  onSelect={() => { setSelectedEvaluationKey(evaluationKey(row)); setSelectedLot(null); }}
                />
              ))}
            </div>
          </section>

          <div className="cuc-chart-grid">
            <section className="cuc-panel">
              <div className="cuc-section-head">
                <strong>Desempenho por lote</strong>
                <span>{loadingLots ? 'Atualizando…' : `${lots.length} lotes`}</span>
              </div>
              <LotChart lots={lots} onSelect={setSelectedLot} />
            </section>

            <section className="cuc-panel">
              <div className="cuc-section-head">
                <strong>Distribuição de vazão</strong>
                <span>Emissores</span>
              </div>
              <Histogram data={histogram} />
            </section>
          </div>

          <section className="cuc-panel">
            <div className="cuc-section-head">
              <strong>Visão Geral por DEPA</strong>
              <span>clique para analisar</span>
            </div>
            <div className="cuc-depa-grid">
              {depaStats.map(item => {
                const status = item.critical > 0 ? 'CRÍTICO' : item.attention > 0 ? 'ATENÇÃO' : 'ESTÁVEL';
                const [background, borderColor, color] = statusTone(status);
                return (
                  <button key={item.depa} className="cuc-depa-card" onClick={() => setOpenedDepa(item.depa)}>
                    <div className="depa-main">
                      <div className="depa-name-row"><strong>{item.depa}</strong><span className="cuc-mini-status" style={{ background, borderColor, color }}>{status}</span></div>
                      <small>{item.total} campos</small>
                    </div>
                    <div><span>CUC</span><b style={{ color: cucColor(item.cuc) }}>{formatValue(item.cuc)}%</b></div>
                    <div><span>Ent.</span><b style={{ color: entupColor(item.ent) }}>{formatValue(item.ent)}%</b></div>
                    <div><span>Crít.</span><b style={{ color: item.critical ? COLORS.red : COLORS.green }}>{item.critical}</b></div>
                  </button>
                );
              })}
            </div>
          </section>
        </main>
      </div>

      {selectedLot && selectedEvaluation && <LoteModal evaluation={selectedEvaluation} lot={selectedLot} onClose={() => setSelectedLot(null)} />}

      {openedDepa && (
        <DepaModal
          depaName={openedDepa}
          allRows={rows}
          preferredYear={selectedEvaluation?.ano}
          onClose={() => setOpenedDepa(null)}
          onSelectField={row => {
            const target = fields.find(field => field.key === fieldKey(row));
            if (target) selectField(target);
          }}
        />
      )}
    </div>
  );
}

// ================================== CSS =====================================
const CSS = `
.dash-cuc-v1{
  --bg:${COLORS.bg};
  --bg-soft:${COLORS.bgSoft};
  --card:${COLORS.card};
  --text:${COLORS.text};
  --muted:${COLORS.muted};
  --faint:${COLORS.faint};
  --border:${COLORS.border};
  --border-soft:${COLORS.borderSoft};
  --blue:${COLORS.blue};
  --green:${COLORS.green};
  --orange:${COLORS.orange};
  --red:${COLORS.red};
  --radius:${LAYOUT.radius}px;
  font-family:Arial,sans-serif;
  font-size:${FONT_SIZE.base}px;
  color:var(--text);
  background:linear-gradient(135deg,#eef3f8 0%,#f7f9fc 52%,#edf4f1 100%);
  width:100%;
  height:100%;
  min-height:0;
  overflow:hidden;
}
.dash-cuc-v1 *{box-sizing:border-box}
.dash-cuc-v1 button,.dash-cuc-v1 input,.dash-cuc-v1 select{font:inherit}
.dash-cuc-v1 button{cursor:pointer}
.cuc-loading{width:100%;height:100%;display:grid;place-items:center;background:${COLORS.bgSoft};font:700 12px Arial;color:${COLORS.muted}}
.cuc-loading.is-error{color:${COLORS.red}}

/* ================================ SHELL ================================== */
.cuc-layout{display:grid;grid-template-columns:${LAYOUT.sidebarWidth}px minmax(0,1fr);width:100%;height:100%;min-height:0}
.cuc-sidebar{display:flex;flex-direction:column;min-height:0;background:rgba(255,255,255,.94);border-right:1px solid var(--border)}
.cuc-search-wrap{position:relative;padding:10px;border-bottom:1px solid var(--border);background:rgba(255,255,255,.9)}
.cuc-search-wrap input{width:100%;height:34px;padding:0 34px 0 10px;border:1px solid #cfd8e3;border-radius:8px;background:#fbfcfe;outline:none;color:var(--text);font-size:${FONT_SIZE.md}px;font-weight:700}
.cuc-search-wrap input:focus{border-color:#93c5fd;background:#fff;box-shadow:0 0 0 3px rgba(37,99,235,.06)}
.cuc-search-wrap input::placeholder{color:#a0aec0;font-weight:600}
.cuc-clear-search{position:absolute;right:15px;top:13px;width:28px;height:28px;border:0;border-radius:6px;background:transparent;color:var(--faint);font-size:17px;font-weight:900}
.cuc-clear-search:hover{color:var(--text);background:#eef2f7}
.cuc-field-list{flex:1;min-height:0;overflow-y:auto;padding:6px}
.cuc-field-list::-webkit-scrollbar,.cuc-content::-webkit-scrollbar,.depa-list-scroll::-webkit-scrollbar,.cuc-lot-scroll::-webkit-scrollbar{width:6px;height:6px}
.cuc-field-list::-webkit-scrollbar-thumb,.cuc-content::-webkit-scrollbar-thumb,.depa-list-scroll::-webkit-scrollbar-thumb,.cuc-lot-scroll::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
.cuc-field-row{width:100%;min-height:42px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:7px 9px;margin:0 0 3px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:left}
.cuc-field-row:hover{background:#f7faff;border-color:#e2e8f0}
.cuc-field-row.is-selected{background:#eef5ff;border-color:#bfdbfe;box-shadow:inset 2px 0 0 #2563eb}
.field-left{min-width:0;display:flex;align-items:center;gap:7px}
.field-eval{flex:0 0 auto;font-size:${FONT_SIZE.xs}px;font-weight:700;color:#93a0af;white-space:nowrap}
.cuc-field-row strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:${FONT_SIZE.md}px;font-weight:800;text-transform:uppercase;color:#1e293b}
.cuc-field-row.is-selected strong{color:#0f3f88}
.field-cuc{font-size:13px;font-weight:900;white-space:nowrap}

/* =============================== CONTENT ================================= */
.cuc-content{min-width:0;min-height:0;overflow-y:auto;padding:${LAYOUT.contentPadding}px;display:flex;flex-direction:column;gap:${LAYOUT.gap}px}
.cuc-content::-webkit-scrollbar{width:7px}
.cuc-top-card,.cuc-panel{border:1px solid var(--border);border-radius:var(--radius);background:rgba(255,255,255,.96);box-shadow:${COLORS.shadow}}
.cuc-top-card{display:grid;grid-template-columns:minmax(0,1fr) minmax(360px,.95fr);gap:12px;padding:12px;min-height:${LAYOUT.historyHeight + 24}px}
.cuc-field-summary{min-width:0;display:flex;flex-direction:column;justify-content:space-between}
.cuc-title-row{min-width:0}
.cuc-context-line{display:flex;align-items:center;gap:5px;margin-bottom:7px}
.cuc-context-line>span:not(.cuc-status){height:19px;display:inline-flex;align-items:center;padding:0 7px;border:1px solid var(--border-soft);border-radius:999px;background:#f8fafc;color:var(--muted);font-size:${FONT_SIZE.xs}px;font-weight:800}
.cuc-title-row h1{margin:0;font-size:${FONT_SIZE.title}px;line-height:1.02;font-weight:900;letter-spacing:-.6px;text-transform:uppercase;color:#111827}
.cuc-title-row p{margin:5px 0 0;font-size:${FONT_SIZE.sm}px;font-weight:700;color:#7b8795}
.cuc-main-metrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--border-soft);margin-top:12px;padding-top:10px}
.cuc-kpi{min-width:0;padding:0 11px;border-right:1px solid var(--border)}
.cuc-kpi:first-child{padding-left:0}
.cuc-kpi:last-child{padding-right:0;border-right:0}
.cuc-kpi>span{display:block;font-size:${FONT_SIZE.xs}px;font-weight:900;color:#9aa5b3;text-transform:uppercase;letter-spacing:.1em}
.cuc-kpi>strong{display:block;margin-top:4px;font-size:${FONT_SIZE.kpi}px;line-height:1;font-weight:900;letter-spacing:-.3px}
.cuc-kpi>small{display:block;margin-top:5px;min-height:13px}
.cuc-status{height:20px;display:inline-flex;align-items:center;justify-content:center;padding:0 7px;border:1px solid;border-radius:999px;font-size:${FONT_SIZE.xs}px;font-weight:900;white-space:nowrap}
.cuc-status.is-compact{height:18px;padding:0 6px;font-size:7px}
.cuc-delta{display:inline-flex;align-items:center;white-space:nowrap;font-size:${FONT_SIZE.sm}px;font-weight:900}
.cuc-delta.is-good{color:var(--green)}
.cuc-delta.is-bad{color:var(--red)}
.cuc-delta.is-neutral,.cuc-delta.is-empty{color:#9aa5b3}

/* ============================ FIELD HISTORY ============================== */
.cuc-history-wrap{position:relative;height:100%;min-height:${LAYOUT.historyHeight}px;padding:7px 8px;border:1px solid var(--border-soft);border-radius:10px;background:linear-gradient(180deg,#fbfdff,#f7fafc)}
.cuc-history-header{display:flex;align-items:center;justify-content:space-between;padding:2px 3px 0}
.cuc-history-header strong{display:block;font-size:${FONT_SIZE.md}px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:.08em}
.cuc-history-header span{display:block;margin-top:2px;font-size:7px;font-weight:800;color:#6b7280}
.cuc-history-header>small{font-size:${FONT_SIZE.xs}px;font-weight:800;color:var(--faint)}
.cuc-history-wrap svg{width:100%;height:${LAYOUT.historyHeight - 31}px;display:block;overflow:visible}
.cuc-history-wrap line{stroke:#e5eaf0;stroke-dasharray:2 4}
.cuc-history-wrap line.is-meta{stroke:#86efac;stroke-width:1.3;stroke-dasharray:5 4}
.cuc-history-wrap path{fill:none;stroke:${COLORS.green};stroke-width:3.2;stroke-linecap:round}
.cuc-history-wrap circle{fill:#fff;stroke:${COLORS.green};stroke-width:2}
.cuc-history-wrap circle.is-selected{stroke:${COLORS.blueDark};stroke-width:3}
.cuc-history-wrap text{font-size:${FONT_SIZE.chartLabel}px;font-weight:900;fill:#a0acb9}
.cuc-history-wrap text.is-current{fill:${COLORS.blueDark}}
.cuc-chart-tooltip{position:absolute;z-index:40;transform:translate(-50%,-108%);min-width:220px;padding:9px 10px;border:1px solid #d6dee8;border-radius:10px;background:#fff;box-shadow:0 12px 30px rgba(15,23,42,.14);pointer-events:none}
.tooltip-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-bottom:7px;border-bottom:1px solid var(--border-soft)}
.tooltip-head strong{font-size:${FONT_SIZE.md}px;font-weight:900;color:#1e293b}
.tooltip-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;padding:8px 0;border-bottom:1px solid var(--border-soft)}
.tooltip-grid div span,.tooltip-grid div b{display:block}
.tooltip-grid div span{font-size:7px;text-transform:uppercase;font-weight:900;color:#9aa5b3}
.tooltip-grid div b{margin-top:2px;font-size:${FONT_SIZE.sm}px;font-weight:900}
.tooltip-compare{padding-top:7px}
.tooltip-compare>span{display:block;margin-bottom:4px;font-size:7px;text-transform:uppercase;font-weight:900;color:#9aa5b3}
.tooltip-compare>div{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:3px}
.tooltip-compare>div b{font-size:8px;color:#64748b}

/* ============================= EVALUATIONS ================================ */
.cuc-panel{padding:10px}
.cuc-section-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:7px}
.cuc-section-head strong{font-size:${FONT_SIZE.md}px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#3e4c5e}
.cuc-section-head span{height:18px;display:inline-flex;align-items:center;padding:0 6px;border:1px solid var(--border-soft);border-radius:999px;background:#f8fafc;color:#99a4b1;font-size:7px;font-weight:900}
.cuc-evaluations-row{display:flex;gap:6px;overflow-x:auto;padding:1px 0 2px}
.cuc-evaluations-row::-webkit-scrollbar{height:5px}
.cuc-evaluations-row::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:99px}
.cuc-evaluation{flex:0 0 ${LAYOUT.evalCardWidth}px;width:${LAYOUT.evalCardWidth}px;height:78px;padding:7px 8px;border:1px solid var(--border);border-radius:9px;background:#fff;text-align:left;box-shadow:0 1px 2px rgba(15,23,42,.02)}
.cuc-evaluation:hover{background:#fbfdff;border-color:#cbd5e1}
.cuc-evaluation.is-selected{background:#eff6ff;border-color:#93c5fd;box-shadow:inset 0 0 0 1px #bfdbfe}
.cuc-evaluation-top{display:flex;align-items:center;justify-content:space-between;gap:4px}
.cuc-evaluation-top>strong{font-size:${FONT_SIZE.sm}px;font-weight:900;color:#526174}
.cuc-evaluation-main{display:flex;align-items:flex-end;justify-content:space-between;gap:8px;margin-top:7px}
.cuc-evaluation-main>div>strong,.cuc-evaluation-main>div>span{display:block}
.cuc-evaluation-main>div>strong{font-size:${FONT_SIZE.sm}px;color:#27364a}
.cuc-evaluation-main>div>span{margin-top:2px;font-size:7px;font-weight:900;color:#a0acb9;text-transform:uppercase}
.cuc-evaluation-main>em{font-size:13px;font-style:normal;font-weight:900}
.cuc-evaluation-foot{margin-top:5px;padding-top:5px;border-top:1px solid var(--border-soft)}
.cuc-evaluation-foot .cuc-delta{font-size:7px}

/* =========================== LOT + HISTOGRAM ============================== */
.cuc-chart-grid{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(330px,.9fr);gap:${LAYOUT.gap}px}
.cuc-lot-scroll{overflow-x:auto;padding-bottom:2px}
.cuc-lot-chart{height:${LAYOUT.lotChartHeight}px;position:relative;padding:14px 4px 0}
.cuc-lot-line{position:absolute;left:4px;right:4px;border-top:1px dashed #e3e8ee;z-index:0}
.cuc-lot-line span{position:absolute;top:-10px;left:0;padding-right:4px;background:#fff;font-size:7px;font-weight:900;color:#9aa5b3}
.cuc-lot-line.line-90{top:54px;border-color:#9ae6bf}
.cuc-lot-line.line-90 span{color:${COLORS.green}}
.cuc-lot-line.line-80{top:94px}
.cuc-lot-bars{position:absolute;inset:14px 4px 0;display:flex;align-items:stretch;gap:7px;min-width:max-content}
.cuc-lot-bars>button{width:42px;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding:0 0 7px;border:0;background:transparent}
.cuc-lot-bars>button:hover i{filter:brightness(1.06)}
.cuc-lot-bars em{height:14px;font-size:7px;font-style:normal;font-weight:900;color:#64748b}
.cuc-lot-bars i{width:24px;max-height:145px;border-radius:5px 5px 2px 2px;transition:filter .15s ease}
.cuc-lot-bars strong{margin-top:4px;font-size:8px;font-weight:900;color:#334155}
.cuc-histogram{height:${LAYOUT.histogramHeight}px;display:grid;grid-template-columns:repeat(5,1fr);gap:7px;align-items:end;padding:12px 2px 8px}
.hist-col{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end}
.hist-col>b{height:17px;font-size:10px;font-weight:900;color:#334155}
.hist-col>span{width:100%;height:144px;display:flex;align-items:flex-end;justify-content:center;border-bottom:1px solid var(--border);background:linear-gradient(to top,rgba(226,232,240,.25),transparent)}
.hist-col>span>i{display:block;width:74%;min-height:4px;border-radius:5px 5px 1px 1px}
.hist-col>span>i.red{background:#ef4444}.hist-col>span>i.orange{background:#f97316}.hist-col>span>i.green{background:#10b981}.hist-col>span>i.yellow{background:#f59e0b}.hist-col>span>i.blue{background:#3b82f6}
.hist-col>small{height:17px;padding-top:4px;font-size:7px;font-weight:900;color:#64748b;white-space:nowrap}

/* ================================= DEPA =================================== */
.cuc-depa-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.cuc-depa-card{display:grid;grid-template-columns:minmax(0,1.6fr) repeat(3,auto);align-items:center;gap:11px;min-height:58px;padding:8px 9px;border:1px solid var(--border);border-radius:9px;background:#fff;text-align:left}
.cuc-depa-card:hover{background:#fbfdff;border-color:#bfdbfe;box-shadow:0 4px 12px rgba(15,23,42,.05)}
.depa-name-row{display:flex;align-items:center;gap:6px;min-width:0}
.depa-main strong{display:block;font-size:${FONT_SIZE.md}px;font-weight:900;color:#253348;white-space:nowrap}
.depa-main small,.cuc-depa-card>div>span{display:block;margin-top:2px;font-size:7px;font-weight:900;color:#9aa5b3;text-transform:uppercase}
.cuc-depa-card>div>b{display:block;margin-top:2px;font-size:11px;font-weight:900}
.cuc-mini-status{height:17px;display:inline-flex;align-items:center;padding:0 5px;border:1px solid;border-radius:999px;font-size:7px;font-weight:900;white-space:nowrap}

/* ================================ MODALS ================================= */
.cuc-modal-backdrop{position:fixed;inset:0;z-index:500;display:grid;place-items:center;padding:16px;background:rgba(15,23,42,.54);backdrop-filter:blur(5px)}
.cuc-modal{width:min(760px,94vw);max-height:92vh;overflow:hidden;border:1px solid #d5dde7;border-radius:13px;background:#fff;box-shadow:0 24px 70px rgba(15,23,42,.23)}
.cuc-modal-lot{width:min(640px,94vw)}
.cuc-modal-depa{width:min(980px,96vw)}
.cuc-modal>header{display:flex;align-items:center;justify-content:space-between;gap:15px;padding:11px 13px;border-bottom:1px solid var(--border);background:#fbfcfe}
.cuc-modal>header strong,.cuc-modal>header small{display:block}
.cuc-modal>header strong{font-size:${FONT_SIZE.lg}px;font-weight:900;text-transform:uppercase;color:#233148}
.cuc-modal>header small{margin-top:2px;font-size:7px;font-weight:800;color:#9aa5b3}
.cuc-modal>header>div:first-child{min-width:0}
.cuc-close-btn{width:28px;height:28px;display:grid;place-items:center;border:0;border-radius:7px;background:#eef2f7;color:#64748b;font-size:17px;font-weight:900}
.cuc-close-btn:hover{background:#e2e8f0;color:#334155}
.cuc-modal>main{max-height:calc(92vh - 56px);overflow-y:auto;padding:10px;background:#f7f9fc}
.cuc-modal-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}
.cuc-modal-kpis .cuc-kpi{padding:9px;border:1px solid var(--border);border-radius:8px;background:#fff}
.cuc-modal-kpis .cuc-kpi:first-child{padding-left:9px}
.cuc-modal-card{margin-top:8px;padding:9px;border:1px solid var(--border);border-radius:9px;background:#fff}
.cuc-panel-heading{display:flex;align-items:center;justify-content:space-between;gap:8px}
.cuc-panel-heading>strong{font-size:${FONT_SIZE.sm}px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:.08em}
.cuc-unit{display:flex;padding:2px;border-radius:6px;background:#f1f5f9}
.cuc-unit button{height:22px;padding:0 8px;border:0;border-radius:4px;background:transparent;color:#94a3b8;font-size:7px;font-weight:900}
.cuc-unit button.is-active{background:#fff;color:#334155;box-shadow:0 1px 2px rgba(15,23,42,.08)}
.cuc-emitter-grid{display:grid;grid-template-columns:repeat(6,1fr);gap:5px;margin-top:8px}
.cuc-emitter-grid>div{border:1px solid var(--border);border-radius:6px;background:#fbfcfe;overflow:hidden;text-align:center}
.cuc-emitter-grid strong{display:block;padding:9px 3px;font-size:10px}

/* =============================== DEPA MODAL ============================== */
.depa-year-tabs{display:flex;align-items:center;gap:4px}
.depa-year-tabs>button:not(.cuc-close-btn){height:28px;padding:0 9px;border:1px solid var(--border);border-radius:7px;background:#fff;color:#64748b;font-size:8px;font-weight:900}
.depa-year-tabs>button:not(.cuc-close-btn):hover{border-color:#bfdbfe}
.depa-year-tabs>button.is-active{background:#eff6ff;border-color:#93c5fd;color:#1d4ed8}
.depa-metric-tabs{display:flex;gap:4px;margin-bottom:8px;padding:3px;width:max-content;border:1px solid var(--border-soft);border-radius:8px;background:#f1f5f9}
.depa-metric-tabs button{height:25px;padding:0 9px;border:0;border-radius:6px;background:transparent;color:#64748b;font-size:7px;font-weight:900;text-transform:uppercase}
.depa-metric-tabs button.is-active{background:#fff;color:#1d4ed8;box-shadow:0 1px 2px rgba(15,23,42,.06)}
.depa-chart-card{border:1px solid var(--border);border-radius:9px;background:#fff;padding:9px}
.depa-chart-meta{display:flex;align-items:center;justify-content:space-between;padding:1px 2px 4px}
.depa-chart-meta strong,.depa-chart-meta span{display:block}
.depa-chart-meta strong{font-size:${FONT_SIZE.sm}px;font-weight:900;color:#334155;text-transform:uppercase;letter-spacing:.08em}
.depa-chart-meta span{margin-top:2px;font-size:7px;font-weight:800;color:#9aa5b3}
.depa-chart-meta>b{font-size:14px;font-weight:900;color:#334155}
.depa-chart-wrap{height:195px}
.depa-chart-wrap svg{width:100%;height:100%;overflow:visible}
.depa-chart-wrap .base-line{stroke:#e5eaf0;stroke-dasharray:3 5}
.depa-trend-path{fill:none;stroke:#2563eb;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.depa-chart-wrap circle{fill:#fff;stroke:#2563eb;stroke-width:2}
.depa-chart-wrap circle.selected-point{fill:#2563eb;stroke:#fff;stroke-width:2.5}
.depa-value{font-size:8px;font-weight:900;fill:#64748b}
.month-label{font-size:7px;font-weight:900;fill:#9aa5b3}
.depa-average-row{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:8px}
.depa-average-row>div{padding:8px 9px;border:1px solid var(--border);border-radius:8px;background:#fff}
.depa-average-row span,.depa-average-row b{display:block}
.depa-average-row span{font-size:7px;font-weight:900;text-transform:uppercase;color:#9aa5b3}
.depa-average-row b{margin-top:3px;font-size:12px;font-weight:900;color:#334155}
.depa-bottom-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px}
.depa-list-card{min-height:280px;display:flex;flex-direction:column;border:1px solid var(--border);border-radius:9px;background:#fff;overflow:hidden}
.depa-list-card>header{display:flex;align-items:center;justify-content:space-between;padding:8px 9px;border-bottom:1px solid var(--border-soft);background:#fbfcfe}
.depa-list-card>header strong{font-size:${FONT_SIZE.sm}px;font-weight:900;color:#334155;text-transform:uppercase}
.depa-list-card>header span{font-size:7px;font-weight:900;color:#a0acb9}
.depa-list-scroll{flex:1;min-height:0;max-height:330px;overflow-y:auto;padding:4px}
.depa-field-row,.depa-change-row{width:100%;display:grid;align-items:center;gap:7px;padding:7px 6px;border:0;border-bottom:1px solid #f1f4f7;background:#fff;text-align:left}
.depa-field-row{grid-template-columns:minmax(0,1fr) 54px 54px auto}
.depa-change-row{grid-template-columns:minmax(0,1fr) 72px 72px}
.depa-field-row:hover,.depa-change-row:hover{background:#f8fbff}
.depa-field-row>div strong,.depa-field-row>div small,.depa-change-row>div strong,.depa-change-row>div small{display:block}
.depa-field-row>div strong,.depa-change-row>div strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:8px;font-weight:900;color:#334155}
.depa-field-row>div small,.depa-change-row>div small{margin-top:2px;font-size:7px;font-weight:800;color:#a0acb9}
.depa-field-row>span:not(.cuc-status){font-size:9px;font-weight:900;text-align:right}
.depa-change-row>div>span{display:block;font-size:7px;font-weight:900;color:#9aa5b3;text-transform:uppercase}
.depa-change-row .cuc-delta{font-size:7px;margin-top:2px}

/* ============================= RESPONSIVE ================================ */
@media(max-width:1100px){
  .cuc-top-card{grid-template-columns:1fr}
  .cuc-history-wrap{min-height:170px}
  .cuc-chart-grid{grid-template-columns:1fr}
  .cuc-depa-grid{grid-template-columns:1fr 1fr}
}
@media(max-width:760px){
  .cuc-layout{grid-template-columns:1fr}
  .cuc-sidebar{display:none}
  .cuc-content{padding:8px}
  .cuc-top-card{padding:9px}
  .cuc-title-row h1{font-size:21px}
  .cuc-main-metrics{grid-template-columns:1fr}
  .cuc-kpi{padding:7px 0;border-right:0;border-bottom:1px solid var(--border-soft)}
  .cuc-kpi:last-child{border-bottom:0}
  .cuc-depa-grid{grid-template-columns:1fr}
  .depa-bottom-grid,.depa-average-row{grid-template-columns:1fr}
  .cuc-modal-kpis{grid-template-columns:repeat(2,1fr)}
  .cuc-emitter-grid{grid-template-columns:repeat(3,1fr)}
}
`;
