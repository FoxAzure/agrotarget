import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import './BaseDash.css';

// ============================================================================
// DASH CUC — V2 CORRIGIDO
// Baseado na estrutura de dados validada do vw_q_cucgeral + tb_q_agrotarget.
// ============================================================================

// =============================== CONFIGURAÇÕES ===============================
const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor'
];

const META_CUC = 90;
const META_VAZAO = 1.0;
const META_ENTUP = 5;

// Ajustes principais do layout. Altere somente aqui para testar proporções.
const LAYOUT = {
  sidebarWidth: 260,
  contentPadding: 10,
  gap: 8,
  topHeight: 232,
  lotChartHeight: 235,
  lowerHeight: 250,
  historyHeight: 250,
  evaluationCardWidth: 112,

  // Quantidade fixa de lotes que ocupa espaço antes de liberar scroll horizontal.
  LOTES_VISIVEIS: 0,

  // Largura padronizada das barras do histograma e do gráfico de lotes.
  GRAFICO_BAR_WIDTH: 30,
  GRAFICO_BAR_GAP: 14,

  // Espessura da rosca e tamanho do indicador central.
  DONUT_RADIUS: 48,
  DONUT_STROKE: 16,
  DONUT_SIZE: 144,

  // Espaçamento visual entre as duas colunas do bloco Dia/Safra.
  KPI_BAR_GAP: 14,
};

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

// ============================================================================
// HELPERS
// ============================================================================
const asArray = value => Array.isArray(value) ? value : [];

const num = (value, fallback = 0) => {
  const parsed = Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const text = (value, fallback = '') => {
  const result = String(value ?? '').trim();
  return result || fallback;
};

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric.toFixed(decimals).replace('.', ',') : '—';
};

const getDateValue = row => row?.dt_final ?? row?.dtfinal ?? '';
const getFieldCode = row => text(row?.codigo_campo ?? row?.codigocampo ?? '');
const getFieldName = row => text(row?.campo ?? getFieldCode(row));
const getEvaluationNumber = row => text(row?.avaliacao ?? '');

const dateTime = value => {
  const raw = text(value);
  if (!raw) return 0;
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parts = raw.slice(0, 10).split('-');
    if (parts.length !== 3) return 0;
    return new Date(`${parts[0]}-${parts[1]}-${parts[2]}T12:00:00`).getTime();
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const parts = raw.slice(0, 10).split('/');
    if (parts.length !== 3) return 0;
    return new Date(`${parts[2]}-${parts[1]}-${parts[0]}T12:00:00`).getTime();
  }
  return 0;
};

const formatDate = value => {
  const raw = text(value);
  if (!raw) return '—';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parts = raw.slice(0, 10).split('-');
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(0, 10);
  return raw;
};

const monthYear = value => {
  const raw = text(value);
  let year = '';
  let month = null;

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const parts = raw.slice(0, 10).split('-');
    year = parts[0];
    month = Number(parts[1]);
  } else if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) {
    const parts = raw.slice(0, 10).split('/');
    year = parts[2];
    month = Number(parts[1]);
  }

  return year && month >= 1 && month <= 12 ? `${MONTHS[month - 1]}/${year}` : '—';
};

const evaluationKey = row => {
  if (!row) return '';
  return `${getFieldCode(row)}|${row.ano}|${getEvaluationNumber(row)}|${getDateValue(row)}`;
};

const fieldKey = row => getFieldCode(row) || getFieldName(row);

const compareNewest = (a, b) => {
  const dateDiff = dateTime(getDateValue(b)) - dateTime(getDateValue(a));
  if (dateDiff !== 0) return dateDiff;
  const yearDiff = num(b?.ano) - num(a?.ano);
  if (yearDiff !== 0) return yearDiff;
  return num(b?.avaliacao) - num(a?.avaliacao);
};

const compareOldest = (a, b) => compareNewest(b, a);

const cucColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return 'var(--text-muted)';
  if (v >= META_CUC) return 'var(--q-green)';
  if (v >= 80) return 'var(--q-warning)';
  return 'var(--q-danger)';
};

const vazaoColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return 'var(--text-muted)';
  if (v > 1.2) return '#38bdf8';
  if (v > 1.1) return 'var(--q-warning)';
  if (v >= 0.9) return 'var(--q-green)';
  if (v >= 0.8) return '#f97316';
  return 'var(--q-danger)';
};

const entupColor = value => {
  const v = num(value, NaN);
  if (!Number.isFinite(v)) return 'var(--text-muted)';
  if (v <= 5) return 'var(--q-green)';
  if (v <= 10) return 'var(--q-warning)';
  return 'var(--q-danger)';
};

const deltaValue = (current, previous) => {
  if (previous === null || previous === undefined) return null;
  return num(current) - num(previous);
};

const deltaInfo = (current, previous, inverse = false) => {
  const delta = deltaValue(current, previous);
  if (delta === null) return { tone: 'neutral', symbol: '', text: 'S/Histórico' };
  if (Math.abs(delta) < 0.01) return { tone: 'neutral', symbol: '•', text: '0,0 p.p.' };
  const up = delta > 0;
  const good = inverse ? !up : up;
  return {
    tone: good ? 'good' : 'bad',
    symbol: up ? '▲' : '▼',
    text: `${up ? '+' : ''}${formatValue(delta)} p.p.`,
  };
};

const deltaStyle = tone => {
  if (tone === 'good') return { background: 'var(--q-green-glow)', borderColor: 'rgba(16,185,129,.45)', color: 'var(--q-green)' };
  if (tone === 'bad') return { background: 'var(--q-danger-glow)', borderColor: 'rgba(239,68,68,.45)', color: 'var(--q-danger)' };
  return { background: 'rgba(100,116,139,.14)', borderColor: 'var(--border-color)', color: 'var(--text-muted)' };
};

const calcularCuc = values => {
  const valid = asArray(values).map(num).filter(value => value > 0);
  if (valid.length === 0) return 0;
  const mean = valid.reduce((sum, value) => sum + value, 0) / valid.length;
  if (!mean) return 0;
  const deviation = valid.reduce((sum, value) => sum + Math.abs(value - mean), 0);
  return 100 * (1 - deviation / (valid.length * mean));
};

const getConcentrationClass = lh => {
  if (lh < 0.8) return 'red';
  if (lh < 0.9) return 'orange';
  if (lh <= 1.1) return 'green';
  if (lh <= 1.2) return 'yellow';
  return 'blue';
};

// ============================================================================
// COMPONENTES VISUAIS
// ============================================================================
function DeltaBadge({ current, previous, inverse = false, unit = 'p.p.' }) {
  const info = deltaInfo(current, previous, inverse);
  const style = deltaStyle(info.tone);

  if (info.tone === 'neutral' && info.symbol === '') {
    return <span className="cuc-delta is-empty">S/Histórico</span>;
  }

  return (
    <span className="cuc-delta" style={style}>
      {info.symbol} {info.text.replace('p.p.', unit)}
    </span>
  );
}

function EvaluationCard({ row, previous, selected, onSelect }) {
  return (
    <button type="button" className={`cuc-evaluation ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="cuc-evaluation-top">
        <strong>{getEvaluationNumber(row)}ª Av/{row.ano}</strong>
      </div>
      <strong className="cuc-evaluation-value" style={{ color: cucColor(row.cuc) }}>{formatValue(row.cuc, 2)}%</strong>
      <span>{monthYear(getDateValue(row))}</span>
      <DeltaBadge current={row.cuc} previous={previous?.cuc} />
    </button>
  );
}

function Histogram({ data }) {
  const safeData = data && typeof data === 'object' ? data : null;
  const items = [
    { key: 'red', label: '<0,8', value: num(safeData?.red) },
    { key: 'orange', label: '0,8–0,9', value: num(safeData?.orange) },
    { key: 'green', label: '0,9–1,1', value: num(safeData?.green) },
    { key: 'yellow', label: '1,1–1,2', value: num(safeData?.yellow) },
    { key: 'blue', label: '>1,2', value: num(safeData?.blue) },
  ];
  const maxValue = Math.max(1, items[0].value, items[1].value, items[2].value, items[3].value, items[4].value);

  return (
    <section className="cuc-panel cuc-chart-panel">
      <div className="cuc-panel-title">Histograma de Vazão</div>
      <div className="cuc-histogram">
        {items.map(item => (
          <div className="cuc-hist-col" key={item.key}>
            <strong>{item.value}</strong>
            <div className="cuc-hist-track">
              <i className={item.key} style={{ height: `${Math.max(4, (item.value / maxValue) * 100)}%`, width: `${LAYOUT.GRAFICO_BAR_WIDTH}px` }} />
            </div>
            <small>{item.label}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

function CucDonut({ value, previous }) {
  const safe = Math.max(0, Math.min(100, num(value)));
  const color = cucColor(value);
  const radius = LAYOUT.DONUT_RADIUS;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;

  return (
    <section className="cuc-panel cuc-kpi-panel">
      <div className="cuc-panel-title">CUC Geral</div>
      <div className="cuc-donut-wrap">
        <svg viewBox="0 0 120 120" preserveAspectRatio="xMidYMid meet" style={{ width: `${LAYOUT.DONUT_SIZE}px`, height: `${LAYOUT.DONUT_SIZE}px` }}>
          <circle cx="60" cy="60" r={radius} className="cuc-donut-track" />
          <circle cx="60" cy="60" r={radius} className="cuc-donut-value" stroke={color} strokeDasharray={circumference} strokeDashoffset={offset} />
        </svg>
        <div className="cuc-donut-center">
          <strong style={{ color }}>{formatValue(value, 2)}%</strong>
          <small>Meta {META_CUC}%</small>
        </div>
      </div>
      <div className="cuc-kpi-footer">
        <span>Comparação</span>
        <DeltaBadge current={value} previous={previous} />
      </div>
    </section>
  );
}

function MetricColumn({ title, value, previous, type }) {
  const inverse = type === 'entup';
  const color = type === 'vazao' ? vazaoColor(value) : entupColor(value);
  const meta = type === 'vazao' ? 'Meta 1,00 L/h' : 'Meta 0–5%';
  const maxVisual = type === 'vazao' ? 1.4 : 20;
  const current = Math.max(0, Math.min(maxVisual, num(value)));
  const fill = (current / maxVisual) * 100;

  return (
    <section className="cuc-panel cuc-kpi-panel">
      <div className="cuc-panel-title">{title}</div>
      <div className="cuc-column-chart">
        <small>{meta}</small>
        <div className="cuc-column-track">
          <i style={{ height: `${Math.max(5, fill)}%`, width: `${LAYOUT.GRAFICO_BAR_WIDTH}px`, background: color }} />
        </div>
        <strong style={{ color }}>{formatValue(value, type === 'vazao' ? 2 : 2)}{type === 'vazao' ? ' L/h' : '%'}</strong>
      </div>
      <div className="cuc-kpi-footer">
        <span>Comparação</span>
        <DeltaBadge current={value} previous={previous} inverse={inverse} />
      </div>
    </section>
  );
}

// ============================================================================
// GRÁFICO DE LOTES
// ============================================================================
function LotChart({ lots, onSelect }) {
  const safeLots = asArray(lots);
  const slotCount = Math.max(LAYOUT.LOTES_VISIVEIS, safeLots.length);
  const slotWidth = LAYOUT.GRAFICO_BAR_WIDTH + LAYOUT.GRAFICO_BAR_GAP;
  const chartMinWidth = slotCount * slotWidth + 20;

  return (
    <section className="cuc-panel cuc-lot-panel">
      <div className="cuc-section-head">
        <strong>Desempenho por Lote</strong>
        <span>{safeLots.length} lote(s)</span>
      </div>
      <div className="cuc-lot-scroll">
        <div className="cuc-lot-chart" style={{ minWidth: `${Math.max(chartMinWidth, 620)}px` }}>
          <div className="cuc-lot-line line-100"><span>100%</span></div>
          <div className="cuc-lot-line line-90"><span>90%</span></div>
          <div className="cuc-lot-line line-80"><span>80%</span></div>
          <div className="cuc-lot-bars" style={{ gap: `${LAYOUT.GRAFICO_BAR_GAP}px` }}>
            {Array.from({ length: slotCount }, (_, index) => {
              const lot = safeLots[index] || null;
              const height = lot ? Math.max(4, Math.min(100, Math.max(0, num(lot.cuc)))) : 4;
              return lot ? (
                <button type="button" className="cuc-lot-bar-item" key={`${lot.loteRaw}-${index}`} onClick={() => onSelect(lot)} title={`Lote ${lot.loteFormatado}`}>
                  <span>{formatValue(lot.cuc, 0)}%</span>
                  <i style={{ height: `${height}%`, width: `${LAYOUT.GRAFICO_BAR_WIDTH}px`, background: cucColor(lot.cuc) }} />
                  <b>{lot.loteFormatado}</b>
                </button>
              ) : (
                <div className="cuc-lot-bar-item is-empty" key={`slot-${index}`}>
                  <span>—</span>
                  <i style={{ height: '4px', width: `${LAYOUT.GRAFICO_BAR_WIDTH}px` }} />
                  <b>{String(index + 1).padStart(2, '0')}</b>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// TABELA POR LOTE
// ============================================================================
function LotTable({ lots, evaluation }) {
  const safeLots = asArray(lots);
  const maxCount = Math.max(1, ...safeLots.map(lot => num(lot.emissoresCount)));
  const rangeRows = [
    { key: 'red', label: '<0,8', color: '#ef4444' },
    { key: 'orange', label: '0,8–0,9', color: '#f97316' },
    { key: 'green', label: '0,9–1,1', color: '#10b981' },
    { key: 'yellow', label: '1,1–1,2', color: '#f59e0b' },
    { key: 'blue', label: '>1,2', color: '#3b82f6' },
  ];

  return (
    <section className="cuc-panel cuc-table-panel">
      <div className="cuc-section-head">
        <strong>Resumo por Lote</strong>
        <span>{safeLots.length} lote(s)</span>
      </div>
      <div className="cuc-table-scroll">
        <table className="cuc-lot-table">
          <thead>
            <tr>
              <th>Lote</th>
              <th>Av.</th>
              <th>Total<br/>Emis.</th>
              {rangeRows.map(item => <th key={item.key}>{item.label}<br/>L/h</th>)}
              <th>Média<br/>L/h</th>
              <th>Entupidos</th>
              <th>Entup.<br/>%</th>
              <th>CUC<br/>%</th>
            </tr>
          </thead>
          <tbody>
            {safeLots.map(lot => {
              const rows = [lot.red, lot.orange, lot.green, lot.yellow, lot.blue];
              return (
                <tr key={lot.loteRaw}>
                  <td><b>{lot.loteFormatado}</b></td>
                  <td>{evaluation?.avaliacao || '—'}</td>
                  <td>{num(lot.emissoresCount)}</td>
                  {rows.map((count, index) => {
                    const meta = rangeRows[index];
                    const width = Math.max(0, Math.min(100, (num(count) / maxCount) * 100));
                    return (
                      <td key={meta.key}>
                        <span className="cuc-concentration" style={{ background: `linear-gradient(90deg, ${meta.color} ${width}%, rgba(51,65,85,.16) ${width}%)` }}>{count}</span>
                      </td>
                    );
                  })}
                  <td>{formatValue(lot.vazao, 2)}</td>
                  <td>{formatValue(lot.entupidos, 0)}</td>
                  <td style={{ color: entupColor(lot.entupPerc), fontWeight: 800 }}>{formatValue(lot.entupPerc, 1)}%</td>
                  <td style={{ color: cucColor(lot.cuc), fontWeight: 900 }}>{formatValue(lot.cuc, 1)}%</td>
                </tr>
              );
            })}
            {!safeLots.length && <tr><td colSpan="13" className="cuc-table-empty">Nenhum lote disponível.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ============================================================================
// HISTÓRICO DO CAMPO
// ============================================================================
function HistoryChart({ evaluations, selectedKey }) {
  const source = asArray(evaluations);
  const data = source.slice().sort(compareOldest);
  const [hovered, setHovered] = useState(null);
  const width = 760;
  const height = LAYOUT.historyHeight;
  const padLeft = 38;
  const padRight = 18;
  const padTop = 24;
  const padBottom = 42;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const x = index => data.length <= 1 ? width / 2 : padLeft + index * (plotWidth / Math.max(1, data.length - 1));
  const y = value => padTop + ((100 - Math.max(70, Math.min(100, num(value)))) / 30) * plotHeight;
  const points = data.map((row, index) => ({ row, index, x: x(index), y: y(row.cuc) }));

  let path = '';
  points.forEach((point, index) => {
    path += `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y} `;
  });

  const hoveredPoint = hovered?.point || null;

  return (
    <section className="cuc-panel cuc-history-panel">
      <div className="cuc-section-head">
        <div>
          <strong>Evolução do CUC</strong>
        </div>
        <span>{data.length} avaliação(ões)</span>
      </div>
      <div className="cuc-history-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[80, 90, 100].map(tick => (
            <g key={tick}>
              <line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} className={tick === META_CUC ? 'is-meta' : ''} />
              <text x={padLeft - 8} y={y(tick) + 3} textAnchor="end">{tick}</text>
            </g>
          ))}
          {path && <path d={path} className="cuc-history-path" />}
          {points.map(point => {
            const selected = evaluationKey(point.row) === selectedKey;
            return (
              <g key={evaluationKey(point.row)} onMouseEnter={event => setHovered({ point, clientX: event.clientX, clientY: event.clientY })} onMouseLeave={() => setHovered(null)}>
                <circle cx={point.x} cy={point.y} r={selected ? 5.5 : 4.5} className={selected ? 'is-selected' : ''} />
                <text x={point.x} y={height - 21} textAnchor="middle" className={selected ? 'is-selected' : ''}>{point.row.avaliacao}ª/{point.row.ano}</text>
              </g>
            );
          })}
        </svg>
        {hoveredPoint && (
          <div className="cuc-history-tooltip" style={{
            left: `${Math.min(window.innerWidth - 255, Math.max(8, (hovered?.clientX || 0) + 14))}px`,
            top: `${Math.min(window.innerHeight - 185, Math.max(8, (hovered?.clientY || 0) - 55))}px`
          }}>
            {(() => {
              const index = hoveredPoint.index;
              const current = hoveredPoint.row;
              const previous = index > 0 ? data[index - 1] : null;
              return (
                <>
                  <div className="cuc-tooltip-title">
                    <strong>{current.avaliacao}ª Av/{current.ano}</strong>
                    <span>{monthYear(getDateValue(current))}</span>
                  </div>
                  <table>
                    <thead><tr><th></th><th>Anterior</th><th>Atual</th><th>Δ</th></tr></thead>
                    <tbody>
                      <tr><td>CUC</td><td>{previous ? `${formatValue(previous.cuc)}%` : '—'}</td><td>{formatValue(current.cuc)}%</td><td><DeltaBadge current={current.cuc} previous={previous?.cuc} unit="p.p." /></td></tr>
                      <tr><td>Vazão</td><td>{previous ? formatValue(previous.vazao, 2) : '—'}</td><td>{formatValue(current.vazao, 2)}</td><td><DeltaBadge current={current.vazao} previous={previous?.vazao} unit="p.p." /></td></tr>
                      <tr><td>Entup.</td><td>{previous ? `${formatValue(previous['entup%'], 2)}%` : '—'}</td><td>{formatValue(current['entup%'], 2)}%</td><td><DeltaBadge current={current['entup%']} previous={previous?.['entup%']} inverse unit="p.p." /></td></tr>
                    </tbody>
                  </table>
                </>
              );
            })()}
          </div>
        )}
      </div>
    </section>
  );
}

// ============================================================================
// MODAL DO LOTE — CONSULTA BRUTA DO BANCO, COMO NO SCRIPT VALIDADO
// ============================================================================
function LoteModal({ evaluation, lot, onClose }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [unit, setUnit] = useState('L/h');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const response = await supabase
        .from('tb_q_agrotarget')
        .select('lote,indicador,valor,turno')
        .eq('ano', num(evaluation?.ano))
        .eq('campo', text(evaluation?.campo))
        .eq('extra1', text(evaluation?.avaliacao))
        .eq('lote', text(lot?.loteRaw))
        .in('ocorrencia', CUC_OCORRENCIAS);

      if (!active) return;
      if (response.error) console.error('CUC lote:', response.error);
      setRows(Array.isArray(response.data) ? response.data : []);
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [evaluation, lot]);

  const emitters = useMemo(() => {
    const list = rows.filter(row => EMISSORES_VALIDOS.includes(text(row.indicador)));
    return list.sort((a, b) => EMISSORES_VALIDOS.indexOf(text(a.indicador)) - EMISSORES_VALIDOS.indexOf(text(b.indicador)));
  }, [rows]);

  return (
    <div className="cuc-modal-backdrop" onMouseDown={onClose}>
      <div className="cuc-modal cuc-modal-lot" onMouseDown={event => event.stopPropagation()}>
        <header>
          <div>
            <strong>Lote {lot?.loteFormatado}</strong>
            <small>{evaluation?.campo} • {evaluation?.ano} • {evaluation?.avaliacao}ª Av • {lot?.turno}</small>
          </div>
          <button type="button" className="cuc-close" onClick={onClose}>×</button>
        </header>
        <main>
          <div className="cuc-modal-kpi-grid">
            <div className="cuc-modal-kpi">
              <span>CUC</span>
              <strong style={{ color: cucColor(lot?.cuc) }}>{formatValue(lot?.cuc, 2)}%</strong>
            </div>
            <div className="cuc-modal-kpi">
              <span>Vazão</span>
              <strong style={{ color: vazaoColor(lot?.vazao) }}>{formatValue(lot?.vazao, 2)} L/h</strong>
            </div>
            <div className="cuc-modal-kpi">
              <span>Entupidos</span>
              <strong style={{ color: entupColor(lot?.entupPerc) }}>{formatValue(lot?.entupPerc, 2)}%</strong>
            </div>
          </div>

          <div className="cuc-modal-chart-card">
            <div className="cuc-modal-toolbar">
              <strong>Histograma das vazões</strong>
              <span>{num(lot?.emissoresCount)} emissores</span>
            </div>
            <div className="cuc-modal-histogram">
              {['red', 'orange', 'green', 'yellow', 'blue'].map(key => {
                const value = num(lot?.[key]);
                const maxValue = Math.max(1, num(lot?.red), num(lot?.orange), num(lot?.green), num(lot?.yellow), num(lot?.blue));
                const labels = { red: '<0,8', orange: '0,8–0,9', green: '0,9–1,1', yellow: '1,1–1,2', blue: '>1,2' };
                return (
                  <div className="cuc-modal-hist-col" key={key}>
                    <b>{value}</b>
                    <div className="cuc-modal-hist-track"><i className={key} style={{ height: `${Math.max(4, (value / maxValue) * 100)}%` }} /></div>
                    <small>{labels[key]}</small>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="cuc-modal-toolbar cuc-modal-emitter-head">
            <strong>Emissores coletados</strong>
            <div className="cuc-unit">
              {['mL', 'L/h'].map(item => (
                <button type="button" key={item} className={unit === item ? 'is-active' : ''} onClick={() => setUnit(item)}>{item}</button>
              ))}
            </div>
          </div>
          {loading ? (
            <div className="cuc-modal-empty">Consultando emissores…</div>
          ) : (
            <div className="cuc-emitter-grid">
              {emitters.map((row, index) => {
                const ml = num(row.valor);
                const lh = ml * 0.02;
                const tone = getConcentrationClass(lh);
                return (
                  <div key={`${row.indicador}-${index}`} className={`cuc-emitter-box ${tone}`} title={`${lh.toFixed(2)} L/h`}>
                    <strong>{unit === 'mL' ? formatValue(ml, 0) : formatValue(lh, 2)}</strong>
                  </div>
                );
              })}
              {!emitters.length && <div className="cuc-modal-empty">Nenhum emissor válido encontrado.</div>}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

// ============================================================================
// DASH PRINCIPAL
// ============================================================================
export default function DashCUC() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedFieldKey, setSelectedFieldKey] = useState('');
  const [selectedEvaluationKey, setSelectedEvaluationKey] = useState('');
  const [lots, setLots] = useState([]);
  const [histogram, setHistogram] = useState(null);
  const [selectedLot, setSelectedLot] = useState(null);
  const evaluationScrollRef = useRef(null);

  // 1. CARREGA O HISTÓRICO CONSOLIDADO — mesma origem validada pelo usuário.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const response = await supabase.from('vw_q_cucgeral').select('*');
      if (!active) return;

      if (response.error) {
        setError(response.error.message || 'Erro ao consultar vw_q_cucgeral.');
        setLoading(false);
        return;
      }

      const source = Array.isArray(response.data) ? response.data : [];
      const normalized = source.map(row => ({
        ...row,
        ano: num(row.ano),
        mes: num(row.mes),
        codigo_campo: getFieldCode(row),
        campo: getFieldName(row),
        depa: text(row.depa, 'SEM DEPA'),
        setor: text(row.setor, 'SEM SETOR'),
        avaliacao: text(row.avaliacao),
        cuc: num(row.cuc),
        vazao: num(row.vazao),
        'entup%': num(row['entup%']),
        total_lotes: num(row.total_lotes ?? row.totallotes),
        emissores: num(row.emissores),
        entupido: num(row.entupido),
        dt_final: row.dt_final ?? row.dtfinal ?? '',
        dt_inicial: row.dt_inicial ?? row.dtinicial ?? '',
      }));

      normalized.sort(compareNewest);
      setRows(normalized);
      setLoading(false);
    };
    load();
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

    const result = Array.from(map.values());
    result.forEach(field => field.evaluations.sort(compareNewest));
    result.sort((a, b) => dateTime(getDateValue(b.evaluations[0])) - dateTime(getDateValue(a.evaluations[0])));
    return result;
  }, [rows]);

  const filteredFields = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return fields;
    return fields.filter(field => `${field.campo} ${field.codigo_campo}`.toLowerCase().includes(term));
  }, [fields, search]);

  useEffect(() => {
    if (!fields.length) return;
    const exists = fields.some(field => field.key === selectedFieldKey);
    if (!exists) setSelectedFieldKey(fields[0].key);
  }, [fields, selectedFieldKey]);

  const activeField = fields.find(field => field.key === selectedFieldKey) || fields[0] || null;

  useEffect(() => {
    if (!activeField || !activeField.evaluations.length) return;
    const latest = activeField.evaluations[0];
    setSelectedEvaluationKey(evaluationKey(latest));
  }, [activeField]);

  const selectedEvaluation = useMemo(() => {
    if (!activeField) return null;
    const found = activeField.evaluations.find(row => evaluationKey(row) === selectedEvaluationKey);
    return found || activeField.evaluations[0] || null;
  }, [activeField, selectedEvaluationKey]);

  const previousEvaluation = useMemo(() => {
    if (!activeField || !selectedEvaluation) return null;
    const list = activeField.evaluations;
    const index = list.findIndex(row => evaluationKey(row) === evaluationKey(selectedEvaluation));
    return index >= 0 ? list[index + 1] || null : null;
  }, [activeField, selectedEvaluation]);

  const chronologicalEvaluations = useMemo(() => {
    if (!activeField) return [];
    return activeField.evaluations.slice().sort(compareOldest);
  }, [activeField]);

  // 2. CONSULTA DOS EMISSORES — mesma consulta que funciona no script validado.
  useEffect(() => {
    let active = true;
    const load = async () => {
      if (!selectedEvaluation) {
        setLots([]);
        setHistogram(null);
        return;
      }

      const response = await supabase
        .from('tb_q_agrotarget')
        .select('lote,indicador,valor,turno')
        .eq('ano', Number(selectedEvaluation.ano))
        .eq('campo', String(selectedEvaluation.campo).trim())
        .eq('extra1', String(selectedEvaluation.avaliacao).trim())
        .in('ocorrencia', CUC_OCORRENCIAS);

      if (!active) return;
      if (response.error) console.error('CUC lotes:', response.error);

      const rawData = Array.isArray(response.data) ? response.data : [];
      const lotMap = new Map();
      const histogramResult = { red: 0, orange: 0, green: 0, yellow: 0, blue: 0 };

      rawData.forEach(row => {
        const loteRaw = text(row.lote, '0');
        const turno = text(row.turno, 'SEM TURNO');
        if (!lotMap.has(loteRaw)) {
          lotMap.set(loteRaw, {
            loteRaw,
            turno,
            emissoresMl: [],
            entupidos: 0,
            red: 0,
            orange: 0,
            green: 0,
            yellow: 0,
            blue: 0,
          });
        }

        const lot = lotMap.get(loteRaw);
        const value = num(row.valor);
        const indicador = text(row.indicador);

        if (EMISSORES_VALIDOS.includes(indicador)) {
          lot.emissoresMl.push(value);
          const lh = value * 0.02;
          const bucket = getConcentrationClass(lh);
          histogramResult[bucket] += 1;
          lot[bucket] += 1;
        }

        if (indicador === 'Emissores Entupidos') {
          lot.entupidos += value;
        }
      });

      const processedLots = Array.from(lotMap.values()).map(lot => {
        const total = lot.emissoresMl.length;
        const averageMl = total > 0 ? lot.emissoresMl.reduce((sum, value) => sum + value, 0) / total : 0;
        const vazao = averageMl * 0.02;
        const cuc = calcularCuc(lot.emissoresMl);
        const entupPerc = total > 0 ? (lot.entupidos / total) * 100 : 0;
        const parsedLot = parseInt(lot.loteRaw, 10);
        return {
          loteRaw: lot.loteRaw,
          loteNum: Number.isNaN(parsedLot) ? 999999 : parsedLot,
          loteFormatado: Number.isNaN(parsedLot) ? lot.loteRaw : String(parsedLot).padStart(2, '0'),
          turno: lot.turno,
          cuc,
          vazao,
          entupidos: lot.entupidos,
          entupPerc,
          emissoresCount: total,
          red: lot.red,
          orange: lot.orange,
          green: lot.green,
          yellow: lot.yellow,
          blue: lot.blue,
          emissoresMl: lot.emissoresMl,
        };
      });

      processedLots.sort((a, b) => a.loteNum - b.loteNum);
      setLots(processedLots);
      setHistogram(histogramResult);
    };

    load();
    return () => { active = false; };
  }, [selectedEvaluation]);

  useEffect(() => {
    if (!evaluationScrollRef.current) return;
    const selected = evaluationScrollRef.current.querySelector('.is-selected');
    if (selected) selected.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  }, [activeField, selectedEvaluationKey]);

  const selectField = field => {
    setSelectedFieldKey(field.key);
    setSelectedEvaluationKey(evaluationKey(field.evaluations[0]));
    setSelectedLot(null);
  };

  const selectEvaluation = row => {
    setSelectedEvaluationKey(evaluationKey(row));
    setSelectedLot(null);
  };

  if (loading) {
    return <div className="cuc-loading">Carregando histórico CUC…</div>;
  }

  if (error) {
    return (
      <div className="cuc-loading is-error">
        <div className="cuc-error-box">
          <strong>Erro ao carregar Dashboard CUC</strong>
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="dash-cuc-v2">
      <aside className="cuc-sidebar">
        <div className="cuc-sidebar-head">
          <strong>CAMPOS</strong>
          <span>{fields.length}</span>
        </div>
        <div className="cuc-search-wrap">
          <input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar campo…" />
          {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">×</button>}
        </div>
        <div className="cuc-field-list">
          {filteredFields.map(field => {
            const latest = field.evaluations[0];
            const selected = field.key === activeField?.key;
            return (
              <button type="button" className={`cuc-field-row ${selected ? 'is-selected' : ''}`} key={field.key} onClick={() => selectField(field)}>
                <span className="field-left">
                  <small>{latest?.avaliacao}ª/{latest?.ano}</small>
                  <strong>{field.campo}</strong>
                </span>
                <b style={{ color: cucColor(latest?.cuc) }}>{formatValue(latest?.cuc)}%</b>
              </button>
            );
          })}
          {!filteredFields.length && <div className="cuc-empty-list">Nenhum campo encontrado.</div>}
        </div>
      </aside>

      <main className="cuc-content">
        {selectedEvaluation ? (
          <>
            <section className="cuc-top-grid">
              <div className="cuc-panel cuc-field-panel">
                <div className="cuc-context-line">
                  <span>{selectedEvaluation.depa}</span>
                  <span>{selectedEvaluation.setor}</span>
                </div>
                <div className="cuc-field-title">
                  <h1>{selectedEvaluation.campo}</h1>
                  <p>{selectedEvaluation.avaliacao}ª avaliação de {selectedEvaluation.ano} • {formatDate(getDateValue(selectedEvaluation))}</p>
                </div>
                <div className="cuc-evaluation-head">
                  <strong>Avaliações</strong>
                  <span>{activeField?.evaluations.length || 0}</span>
                </div>
                <div className="cuc-evaluations-scroll" ref={evaluationScrollRef}>
                  {activeField?.evaluations.slice().sort(compareOldest).map((row, index, arr) => (
                    <EvaluationCard
                      key={evaluationKey(row)}
                      row={row}
                      previous={arr[index - 1] || null}
                      selected={evaluationKey(row) === selectedEvaluationKey}
                      onSelect={() => selectEvaluation(row)}
                    />
                  ))}
                </div>
              </div>

              <Histogram data={histogram} />
              <CucDonut value={selectedEvaluation.cuc} previous={previousEvaluation?.cuc} />
              <MetricColumn title="Vazão (L/h)" value={selectedEvaluation.vazao} previous={previousEvaluation?.vazao} type="vazao" />
              <MetricColumn title="Entupidos (%)" value={selectedEvaluation['entup%']} previous={previousEvaluation?.['entup%']} type="entup" />
            </section>

            <section className="cuc-section">
              <LotChart lots={lots} onSelect={setSelectedLot} />
            </section>

            <section className="cuc-lower-grid">
              <LotTable lots={lots} evaluation={selectedEvaluation} />
              <HistoryChart evaluations={chronologicalEvaluations} selectedKey={selectedEvaluationKey} />
            </section>

            {/* Reservado para futuros módulos: DEPA, tendências, indicadores adicionais etc. */}
            <section className="cuc-future-slot" aria-hidden="true" />
          </>
        ) : (
          <div className="cuc-empty-main">Selecione um campo.</div>
        )}
      </main>

      {selectedLot && selectedEvaluation && (
        <LoteModal evaluation={selectedEvaluation} lot={selectedLot} onClose={() => setSelectedLot(null)} />
      )}
    </div>
  );
}
