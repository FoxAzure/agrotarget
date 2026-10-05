import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import './BaseDash.css';

// ============================================================================
// DASH CUC - lotes carregados pela vw_q_cuclotes.
// O modal continua consultando tb_q_agrotarget para exibir os emissores brutos.
// ============================================================================

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor',
];

const META_CUC = 90;

const LAYOUT = {
  historyHeight: 250,
  LOTES_VISIVEIS: 0,
  GRAFICO_BAR_WIDTH: 30,
  GRAFICO_BAR_GAP: 14,
  DONUT_RADIUS: 48,
  DONUT_SIZE: 144,
};

const MONTHS = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

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
    const [year, month, day] = raw.slice(0, 10).split('-');
    return new Date(`${year}-${month}-${day}T12:00:00`).getTime();
  }
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
  if (/^\d{2}\/\d{2}\/\d{4}/.test(raw)) return raw.slice(0, 10);
  return raw;
};

const monthYear = value => {
  const raw = text(value);
  let year = '';
  let month = 0;
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

const deltaInfo = (current, previous, inverse = false) => {
  if (previous === null || previous === undefined) return { tone: 'neutral', symbol: '', text: 'S/Histórico' };
  const delta = num(current) - num(previous);
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

const getConcentrationClass = lh => {
  if (lh < 0.8) return 'red';
  if (lh < 0.9) return 'orange';
  if (lh <= 1.1) return 'green';
  if (lh <= 1.2) return 'yellow';
  return 'blue';
};

function DeltaBadge({ current, previous, inverse = false, unit = 'p.p.' }) {
  const info = deltaInfo(current, previous, inverse);
  if (info.tone === 'neutral' && info.symbol === '') {
    return <span className="cuc-delta is-empty">S/Histórico</span>;
  }
  return <span className="cuc-delta" style={deltaStyle(info.tone)}>{info.symbol} {info.text.replace('p.p.', unit)}</span>;
}

function EvaluationCard({ row, previous, selected, onSelect }) {
  return (
    <button type="button" className={`cuc-evaluation ${selected ? 'is-selected' : ''}`} onClick={onSelect}>
      <div className="cuc-evaluation-top"><strong>{getEvaluationNumber(row)}ª Av/{row.ano}</strong></div>
      <strong className="cuc-evaluation-value" style={{ color: cucColor(row.cuc) }}>{formatValue(row.cuc, 2)}%</strong>
      <span>{monthYear(getDateValue(row))}</span>
      <DeltaBadge current={row.cuc} previous={previous?.cuc} />
    </button>
  );
}

function Histogram({ data }) {
  const items = [
    { key: 'red', label: '<0,8', value: num(data?.red) },
    { key: 'orange', label: '0,8–0,9', value: num(data?.orange) },
    { key: 'green', label: '0,9–1,1', value: num(data?.green) },
    { key: 'yellow', label: '1,1–1,2', value: num(data?.yellow) },
    { key: 'blue', label: '>1,2', value: num(data?.blue) },
  ];
  const maxValue = Math.max(1, ...items.map(item => item.value));
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
        <div className="cuc-donut-center"><strong style={{ color }}>{formatValue(value, 2)}%</strong><small>Meta {META_CUC}%</small></div>
      </div>
      <div className="cuc-kpi-footer"><span>Comparação</span><DeltaBadge current={value} previous={previous} /></div>
    </section>
  );
}

function MetricColumn({ title, value, previous, type }) {
  const inverse = type === 'entup';
  const color = type === 'vazao' ? vazaoColor(value) : entupColor(value);
  const meta = type === 'vazao' ? 'Meta 1,00 L/h' : 'Meta 0–5%';
  const maxVisual = type === 'vazao' ? 1.4 : 20;
  const fill = (Math.max(0, Math.min(maxVisual, num(value))) / maxVisual) * 100;
  return (
    <section className="cuc-panel cuc-kpi-panel">
      <div className="cuc-panel-title">{title}</div>
      <div className="cuc-column-chart">
        <small>{meta}</small>
        <div className="cuc-column-track"><i style={{ height: `${Math.max(5, fill)}%`, width: `${LAYOUT.GRAFICO_BAR_WIDTH}px`, background: color }} /></div>
        <strong style={{ color }}>{formatValue(value, 2)}{type === 'vazao' ? ' L/h' : '%'}</strong>
      </div>
      <div className="cuc-kpi-footer"><span>Comparação</span><DeltaBadge current={value} previous={previous} inverse={inverse} /></div>
    </section>
  );
}

function LotChart({ lots, onSelect }) {
  const safeLots = asArray(lots);
  const slotCount = Math.max(LAYOUT.LOTES_VISIVEIS, safeLots.length);
  const chartMinWidth = slotCount * (LAYOUT.GRAFICO_BAR_WIDTH + LAYOUT.GRAFICO_BAR_GAP) + 20;
  return (
    <section className="cuc-panel cuc-lot-panel">
      <div className="cuc-section-head"><strong>Desempenho por Lote</strong><span>{safeLots.length} lote(s)</span></div>
      <div className="cuc-lot-scroll">
        <div className="cuc-lot-chart" style={{ minWidth: `${Math.max(chartMinWidth, 620)}px` }}>
          <div className="cuc-lot-line line-100"><span>100%</span></div>
          <div className="cuc-lot-line line-90"><span>90%</span></div>
          <div className="cuc-lot-line line-80"><span>80%</span></div>
          <div className="cuc-lot-bars" style={{ gap: `${LAYOUT.GRAFICO_BAR_GAP}px` }}>
            {safeLots.map((lot, index) => (
              <button type="button" className="cuc-lot-bar-item" key={`${lot.loteRaw}-${index}`} onClick={() => onSelect(lot)} title={`Lote ${lot.loteFormatado}`}>
                <span>{formatValue(lot.cuc, 0)}%</span>
                <i style={{ height: `${Math.max(4, Math.min(100, num(lot.cuc)))}%`, width: `${LAYOUT.GRAFICO_BAR_WIDTH}px`, background: cucColor(lot.cuc) }} />
                <b>{lot.loteFormatado}</b>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function LotTable({ lots, evaluation }) {
  const safeLots = asArray(lots);
  const maxCount = Math.max(1, ...safeLots.map(lot => num(lot.emissoresCount)));
  const ranges = [
    { key: 'red', label: '<0,8', color: '#ef4444' },
    { key: 'orange', label: '0,8–0,9', color: '#f97316' },
    { key: 'green', label: '0,9–1,1', color: '#10b981' },
    { key: 'yellow', label: '1,1–1,2', color: '#f59e0b' },
    { key: 'blue', label: '>1,2', color: '#3b82f6' },
  ];
  return (
    <section className="cuc-panel cuc-table-panel">
      <div className="cuc-section-head"><strong>Resumo por Lote</strong><span>{safeLots.length} lote(s)</span></div>
      <div className="cuc-table-scroll">
        <table className="cuc-lot-table">
          <thead><tr><th>Lote</th><th>Av.</th><th>Total<br />Emis.</th>{ranges.map(item => <th key={item.key}>{item.label}<br />L/h</th>)}<th>Média<br />L/h</th><th>Entupidos</th><th>Entup.<br />%</th><th>CUC<br />%</th></tr></thead>
          <tbody>
            {safeLots.map(lot => (
              <tr key={lot.loteRaw}>
                <td><b>{lot.loteFormatado}</b></td><td>{evaluation?.avaliacao || '—'}</td><td>{num(lot.emissoresCount)}</td>
                {ranges.map(meta => {
                  const count = num(lot[meta.key]);
                  const width = Math.max(0, Math.min(100, (count / maxCount) * 100));
                  return <td key={meta.key}><span className="cuc-concentration" style={{ background: `linear-gradient(90deg, ${meta.color} ${width}%, rgba(51,65,85,.16) ${width}%)` }}>{count}</span></td>;
                })}
                <td>{formatValue(lot.vazao, 2)}</td><td>{formatValue(lot.entupidos, 0)}</td>
                <td style={{ color: entupColor(lot.entupPerc), fontWeight: 800 }}>{formatValue(lot.entupPerc, 1)}%</td>
                <td style={{ color: cucColor(lot.cuc), fontWeight: 900 }}>{formatValue(lot.cuc, 1)}%</td>
              </tr>
            ))}
            {!safeLots.length && <tr><td colSpan="13" className="cuc-table-empty">Nenhum lote disponível.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function HistoryChart({ evaluations, selectedKey }) {
  const data = asArray(evaluations).slice().sort(compareOldest);
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
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`).join(' ');
  const hoveredPoint = hovered?.point || null;
  return (
    <section className="cuc-panel cuc-history-panel">
      <div className="cuc-section-head"><div><strong>Evolução do CUC</strong></div><span>{data.length} avaliação(ões)</span></div>
      <div className="cuc-history-wrap">
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
          {[80, 90, 100].map(tick => <g key={tick}><line x1={padLeft} x2={width - padRight} y1={y(tick)} y2={y(tick)} className={tick === META_CUC ? 'is-meta' : ''} /><text x={padLeft - 8} y={y(tick) + 3} textAnchor="end">{tick}</text></g>)}
          {path && <path d={path} className="cuc-history-path" />}
          {points.map(point => {
            const selected = evaluationKey(point.row) === selectedKey;
            return <g key={evaluationKey(point.row)} onMouseEnter={event => setHovered({ point, clientX: event.clientX, clientY: event.clientY })} onMouseLeave={() => setHovered(null)}><circle cx={point.x} cy={point.y} r={selected ? 5.5 : 4.5} className={selected ? 'is-selected' : ''} /><text x={point.x} y={height - 21} textAnchor="middle" className={selected ? 'is-selected' : ''}>{point.row.avaliacao}ª/{point.row.ano}</text></g>;
          })}
        </svg>
        {hoveredPoint && <div className="cuc-history-tooltip" style={{ left: `${Math.min(window.innerWidth - 255, Math.max(8, hovered.clientX + 14))}px`, top: `${Math.min(window.innerHeight - 185, Math.max(8, hovered.clientY - 55))}px` }}>
          {(() => {
            const current = hoveredPoint.row;
            const previous = hoveredPoint.index > 0 ? data[hoveredPoint.index - 1] : null;
            return <><div className="cuc-tooltip-title"><strong>{current.avaliacao}ª Av/{current.ano}</strong><span>{monthYear(getDateValue(current))}</span></div><table><thead><tr><th></th><th>Anterior</th><th>Atual</th><th>Δ</th></tr></thead><tbody><tr><td>CUC</td><td>{previous ? `${formatValue(previous.cuc)}%` : '—'}</td><td>{formatValue(current.cuc)}%</td><td><DeltaBadge current={current.cuc} previous={previous?.cuc} /></td></tr><tr><td>Vazão</td><td>{previous ? formatValue(previous.vazao) : '—'}</td><td>{formatValue(current.vazao)}</td><td><DeltaBadge current={current.vazao} previous={previous?.vazao} /></td></tr><tr><td>Entup.</td><td>{previous ? `${formatValue(previous['entup%'])}%` : '—'}</td><td>{formatValue(current['entup%'])}%</td><td><DeltaBadge current={current['entup%']} previous={previous?.['entup%']} inverse /></td></tr></tbody></table></>;
          })()}
        </div>}
      </div>
    </section>
  );
}

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
        .select('lote,indicador,valor,turno,data_apontamento')
        .eq('ano', num(evaluation?.ano))
        .eq('codigo_campo', text(evaluation?.codigo_campo))
        .eq('extra1', text(evaluation?.avaliacao))
        .eq('lote', text(lot?.loteRaw))
        .in('ocorrencia', CUC_OCORRENCIAS);

      if (!active) return;
      if (response.error) console.error('CUC lote:', response.error);
      setRows(asArray(response.data));
      setLoading(false);
    };
    load();
    return () => { active = false; };
  }, [evaluation, lot]);

  const emitters = useMemo(() => rows
    .filter(row => EMISSORES_VALIDOS.includes(text(row.indicador)))
    .sort((a, b) => EMISSORES_VALIDOS.indexOf(text(a.indicador)) - EMISSORES_VALIDOS.indexOf(text(b.indicador))), [rows]);

  return (
    <div className="cuc-modal-backdrop" onMouseDown={onClose}>
      <div className="cuc-modal cuc-modal-lot" onMouseDown={event => event.stopPropagation()}>
        <header><div><strong>Lote {lot?.loteFormatado}</strong><small>{evaluation?.campo} • {evaluation?.ano} • {evaluation?.avaliacao}ª Av • {lot?.turno}</small></div><button type="button" className="cuc-close" onClick={onClose}>×</button></header>
        <main>
          <div className="cuc-modal-kpi-grid">
            <div className="cuc-modal-kpi"><span>CUC</span><strong style={{ color: cucColor(lot?.cuc) }}>{formatValue(lot?.cuc)}%</strong></div>
            <div className="cuc-modal-kpi"><span>Vazão</span><strong style={{ color: vazaoColor(lot?.vazao) }}>{formatValue(lot?.vazao)} L/h</strong></div>
            <div className="cuc-modal-kpi"><span>Entupidos</span><strong style={{ color: entupColor(lot?.entupPerc) }}>{formatValue(lot?.entupPerc)}%</strong></div>
          </div>
          <div className="cuc-modal-chart-card">
            <div className="cuc-modal-toolbar"><strong>Histograma das vazões</strong><span>{num(lot?.emissoresCount)} emissores</span></div>
            <div className="cuc-modal-histogram">
              {['red', 'orange', 'green', 'yellow', 'blue'].map(key => {
                const value = num(lot?.[key]);
                const maximum = Math.max(1, num(lot?.red), num(lot?.orange), num(lot?.green), num(lot?.yellow), num(lot?.blue));
                const labels = { red: '<0,8', orange: '0,8–0,9', green: '0,9–1,1', yellow: '1,1–1,2', blue: '>1,2' };
                return <div className="cuc-modal-hist-col" key={key}><b>{value}</b><div className="cuc-modal-hist-track"><i className={key} style={{ height: `${Math.max(4, (value / maximum) * 100)}%` }} /></div><small>{labels[key]}</small></div>;
              })}
            </div>
          </div>
          <div className="cuc-modal-toolbar cuc-modal-emitter-head"><strong>Emissores coletados</strong><div className="cuc-unit">{['mL', 'L/h'].map(item => <button type="button" key={item} className={unit === item ? 'is-active' : ''} onClick={() => setUnit(item)}>{item}</button>)}</div></div>
          {loading ? <div className="cuc-modal-empty">Consultando emissores…</div> : <div className="cuc-emitter-grid">
            {emitters.map((row, index) => {
              const ml = num(row.valor);
              const lh = ml * 0.02;
              return <div key={`${row.indicador}-${index}`} className={`cuc-emitter-box ${getConcentrationClass(lh)}`} title={`${lh.toFixed(2)} L/h`}><strong>{unit === 'mL' ? formatValue(ml, 0) : formatValue(lh, 2)}</strong></div>;
            })}
            {!emitters.length && <div className="cuc-modal-empty">Nenhum emissor válido encontrado.</div>}
          </div>}
        </main>
      </div>
    </div>
  );
}

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
      const normalized = asArray(response.data).map(row => ({
        ...row,
        ano: num(row.ano), mes: num(row.mes), codigo_campo: getFieldCode(row), campo: getFieldName(row),
        depa: text(row.depa, 'SEM DEPA'), setor: text(row.setor, 'SEM SETOR'), avaliacao: text(row.avaliacao),
        cuc: num(row.cuc), vazao: num(row.vazao), 'entup%': num(row['entup%']),
        total_lotes: num(row.total_lotes ?? row.totallotes), emissores: num(row.emissores), entupido: num(row.entupido),
        dt_final: row.dt_final ?? row.dtfinal ?? '', dt_inicial: row.dt_inicial ?? row.dtinicial ?? '',
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
      if (!map.has(key)) map.set(key, { key, codigo_campo: row.codigo_campo, campo: row.campo, depa: row.depa, setor: row.setor, evaluations: [] });
      map.get(key).evaluations.push(row);
    });
    const result = Array.from(map.values());
    result.forEach(field => field.evaluations.sort(compareNewest));
    result.sort((a, b) => dateTime(getDateValue(b.evaluations[0])) - dateTime(getDateValue(a.evaluations[0])));
    return result;
  }, [rows]);

  const filteredFields = useMemo(() => {
    const term = search.toLowerCase().trim();
    return term ? fields.filter(field => `${field.campo} ${field.codigo_campo}`.toLowerCase().includes(term)) : fields;
  }, [fields, search]);

  useEffect(() => {
    if (fields.length && !fields.some(field => field.key === selectedFieldKey)) setSelectedFieldKey(fields[0].key);
  }, [fields, selectedFieldKey]);

  const activeField = fields.find(field => field.key === selectedFieldKey) || fields[0] || null;

  useEffect(() => {
    if (activeField?.evaluations?.length) setSelectedEvaluationKey(evaluationKey(activeField.evaluations[0]));
  }, [activeField]);

  const selectedEvaluation = useMemo(() => activeField?.evaluations.find(row => evaluationKey(row) === selectedEvaluationKey) || activeField?.evaluations[0] || null, [activeField, selectedEvaluationKey]);

  const previousEvaluation = useMemo(() => {
    if (!activeField || !selectedEvaluation) return null;
    const index = activeField.evaluations.findIndex(row => evaluationKey(row) === evaluationKey(selectedEvaluation));
    return index >= 0 ? activeField.evaluations[index + 1] || null : null;
  }, [activeField, selectedEvaluation]);

  const chronologicalEvaluations = useMemo(() => activeField ? activeField.evaluations.slice().sort(compareOldest) : [], [activeField]);

  // Lotes consolidados pela nova view materializada.
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLots([]);
      setHistogram(null);
      if (!selectedEvaluation) return;

      const response = await supabase
        .from('vw_q_cuclotes')
        .select('*')
        .eq('ano', num(selectedEvaluation.ano))
        .eq('codigo_campo', text(selectedEvaluation.codigo_campo))
        .eq('avaliacao', text(selectedEvaluation.avaliacao));

      if (!active) return;
      if (response.error) {
        console.error('CUC lotes:', response.error);
        return;
      }

      const processedLots = asArray(response.data).map(row => {
        const loteRaw = text(row.lote);
        const parsedLot = Number.parseInt(loteRaw, 10);
        return {
          ...row,
          loteRaw,
          loteNum: Number.isNaN(parsedLot) ? 999999 : parsedLot,
          loteFormatado: Number.isNaN(parsedLot) ? loteRaw : String(parsedLot).padStart(2, '0'),
          turno: text(row.turno, 'SEM TURNO'),
          cuc: num(row.cuc),
          vazao: num(row.vazao),
          entupidos: num(row.entupidos),
          entupPerc: num(row['entup%']),
          emissoresCount: num(row.emissores),
          red: num(row.faixa_menor_08),
          orange: num(row.faixa_08_a_09),
          green: num(row.faixa_09_a_11),
          yellow: num(row.faixa_11_a_12),
          blue: num(row.faixa_maior_12),
          dt_inicial: row.dt_inicial ?? '',
          dt_final: row.dt_final ?? '',
        };
      }).sort((a, b) => a.loteNum - b.loteNum || a.loteRaw.localeCompare(b.loteRaw));

      const histogramResult = processedLots.reduce((acc, lot) => ({
        red: acc.red + lot.red,
        orange: acc.orange + lot.orange,
        green: acc.green + lot.green,
        yellow: acc.yellow + lot.yellow,
        blue: acc.blue + lot.blue,
      }), { red: 0, orange: 0, green: 0, yellow: 0, blue: 0 });

      setLots(processedLots);
      setHistogram(histogramResult);
    };
    load();
    return () => { active = false; };
  }, [selectedEvaluation]);

  useEffect(() => {
    const selected = evaluationScrollRef.current?.querySelector('.is-selected');
    selected?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'end' });
  }, [activeField, selectedEvaluationKey]);

  const selectField = field => {
    setSelectedFieldKey(field.key);
    setSelectedEvaluationKey(evaluationKey(field.evaluations[0]));
    setSelectedLot(null);
  };

  if (loading) return <div className="cuc-loading">Carregando histórico CUC…</div>;
  if (error) return <div className="cuc-loading is-error"><div className="cuc-error-box"><strong>Erro ao carregar Dashboard CUC</strong><span>{error}</span></div></div>;

  return (
    <div className="dash-cuc-v2">
      <aside className="cuc-sidebar">
        <div className="cuc-sidebar-head"><strong>CAMPOS</strong><span>{fields.length}</span></div>
        <div className="cuc-search-wrap"><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Pesquisar campo…" />{search && <button type="button" onClick={() => setSearch('')} aria-label="Limpar busca">×</button>}</div>
        <div className="cuc-field-list">
          {filteredFields.map(field => {
            const latest = field.evaluations[0];
            return <button type="button" className={`cuc-field-row ${field.key === activeField?.key ? 'is-selected' : ''}`} key={field.key} onClick={() => selectField(field)}><span className="field-left"><small>{latest?.avaliacao}ª/{latest?.ano}</small><strong>{field.campo}</strong></span><b style={{ color: cucColor(latest?.cuc) }}>{formatValue(latest?.cuc)}%</b></button>;
          })}
          {!filteredFields.length && <div className="cuc-empty-list">Nenhum campo encontrado.</div>}
        </div>
      </aside>

      <main className="cuc-content">
        {selectedEvaluation ? <>
          <section className="cuc-top-grid">
            <div className="cuc-panel cuc-field-panel">
              <div className="cuc-context-line"><span>{selectedEvaluation.depa}</span><span>{selectedEvaluation.setor}</span></div>
              <div className="cuc-field-title"><h1>{selectedEvaluation.campo}</h1><p>{selectedEvaluation.avaliacao}ª avaliação de {selectedEvaluation.ano} • {formatDate(getDateValue(selectedEvaluation))}</p></div>
              <div className="cuc-evaluation-head"><strong>Avaliações</strong><span>{activeField?.evaluations.length || 0}</span></div>
              <div className="cuc-evaluations-scroll" ref={evaluationScrollRef}>
                {activeField?.evaluations.slice().sort(compareOldest).map((row, index, arr) => <EvaluationCard key={evaluationKey(row)} row={row} previous={arr[index - 1] || null} selected={evaluationKey(row) === selectedEvaluationKey} onSelect={() => { setSelectedEvaluationKey(evaluationKey(row)); setSelectedLot(null); }} />)}
              </div>
            </div>
            <Histogram data={histogram} />
            <CucDonut value={selectedEvaluation.cuc} previous={previousEvaluation?.cuc} />
            <MetricColumn title="Vazão (L/h)" value={selectedEvaluation.vazao} previous={previousEvaluation?.vazao} type="vazao" />
            <MetricColumn title="Entupidos (%)" value={selectedEvaluation['entup%']} previous={previousEvaluation?.['entup%']} type="entup" />
          </section>
          <section className="cuc-section"><LotChart lots={lots} onSelect={setSelectedLot} /></section>
          <section className="cuc-lower-grid"><LotTable lots={lots} evaluation={selectedEvaluation} /><HistoryChart evaluations={chronologicalEvaluations} selectedKey={selectedEvaluationKey} /></section>
          <section className="cuc-future-slot" aria-hidden="true" />
        </> : <div className="cuc-empty-main">Selecione um campo.</div>}
      </main>

      {selectedLot && selectedEvaluation && <LoteModal evaluation={selectedEvaluation} lot={selectedLot} onClose={() => setSelectedLot(null)} />}
    </div>
  );
}
