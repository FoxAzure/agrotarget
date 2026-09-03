// ==========================================================================================
// DashCUC.jsx
// Dashboard History Telling — CUC / Irrigação
//
// Fonte principal : vw_q_cucgeral
// Detalhe emissor : tb_q_agrotarget
//
// Objetivos desta versão
// 1) Mostrar o último resultado do campo de forma densa e própria para TV.
// 2) Comparar a avaliação selecionada com a avaliação anterior cronológica.
// 3) Permitir selecionar qualquer avaliação histórica do campo.
// 4) Mostrar cenário por DEPA e seus campos, com variação CUC / Entupimento.
// 5) Fixar escala/largura das colunas dos lotes, independente da quantidade.
// 6) Clicar em qualquer lote e abrir detalhe dos emissores daquela avaliação.
// 7) Adicionar linha de tendência histórica, distribuição por status e ranking de risco.
// 8) Não exige biblioteca adicional de gráficos: usa SVG + Tailwind/CSS existente.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const CUC_OCORRENCIAS = ['CUC - Gotejo', 'CUC - Gotejo 9E'];
const EMISSORES_VALIDOS = [
  '1º Emissor', '2º Emissor', '3º Emissor', '4º Emissor',
  '5º Emissor', '6º Emissor', '7º Emissor', '8º Emissor',
  '9º Emissor', '10º Emissor', '11º Emissor', '12º Emissor'
];

const CUC_META = 90;
const ENTUP_META = 5;
const VAZAO_MIN = 0.9;
const VAZAO_MAX = 1.1;
const MIN_BAR_WIDTH = 42;

// ==========================================================================================
// HELPERS
// ==========================================================================================

const n = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  return Number.isNaN(num) ? '-' : num.toFixed(decimals).replace('.', ',');
};

const formatDate = (value) => {
  if (!value) return '-';
  const str = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }
  return str;
};

const parseDate = (dateStr) => {
  if (!dateStr) return 0;
  const str = String(dateStr);
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return new Date(`${str.slice(0, 10)}T12:00:00`).getTime();
  if (str.includes('/')) {
    const [d, m, y] = str.split('/');
    return new Date(`${y}-${m}-${d}T12:00:00`).getTime();
  }
  return 0;
};

const sortEvaluationsDesc = (a, b) => {
  const dateDiff = parseDate(b.dt_final) - parseDate(a.dt_final);
  if (dateDiff !== 0) return dateDiff;
  const yearDiff = n(b.ano) - n(a.ano);
  if (yearDiff !== 0) return yearDiff;
  return n(b.avaliacao) - n(a.avaliacao);
};

const sortEvaluationsAsc = (a, b) => sortEvaluationsDesc(b, a);

const evaluationLabel = (item) => `${item?.avaliacao || '-'}ª Av / ${item?.ano || '-'}`;

const evaluationKey = (item) => {
  if (!item) return null;
  return `${item.codigo_campo ?? item.campo ?? ''}|${item.ano ?? ''}|${item.avaliacao ?? ''}`;
};

const getCucColor = (value) => {
  const v = n(value, NaN);
  if (!Number.isFinite(v)) return '#94a3b8';
  if (v >= 90) return '#22c55e';
  if (v >= 80) return '#f59e0b';
  return '#ef4444';
};

const getVazaoColor = (value) => {
  const v = n(value, NaN);
  if (!Number.isFinite(v)) return '#94a3b8';
  if (v > 1.2) return '#0ea5e9';
  if (v > 1.1) return '#f59e0b';
  if (v >= 0.9) return '#22c55e';
  if (v >= 0.8) return '#f97316';
  return '#ef4444';
};

const getEntupColor = (value) => {
  const v = n(value, NaN);
  if (!Number.isFinite(v)) return '#94a3b8';
  if (v <= 5) return '#22c55e';
  if (v <= 10) return '#f59e0b';
  return '#ef4444';
};

const getStatus = (cuc, entup) => {
  const c = n(cuc);
  const e = n(entup);
  if (c >= CUC_META && e <= ENTUP_META) return { label: 'ESTÁVEL', tone: 'green' };
  if (c >= 80 && e <= 10) return { label: 'ATENÇÃO', tone: 'yellow' };
  return { label: 'CRÍTICO', tone: 'red' };
};

const toneClasses = {
  green: 'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-amber-50 text-amber-700 border-amber-200',
  red: 'bg-red-50 text-red-700 border-red-200',
  slate: 'bg-slate-50 text-slate-600 border-slate-200'
};

const calcularCuc = (valores) => {
  if (!Array.isArray(valores) || valores.length === 0) return 0;
  const validos = valores.map(v => n(v, 0)).filter(v => v > 0);
  if (validos.length === 0) return 0;
  const media = validos.reduce((acc, val) => acc + val, 0) / validos.length;
  const somaDesvios = validos.reduce((acc, val) => acc + Math.abs(val - media), 0);
  return 100 * (1 - somaDesvios / (validos.length * media));
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const delta = (current, previous) => {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  return n(current) - n(previous);
};

// ==========================================================================================
// ÍCONES / MICRO COMPONENTES
// ==========================================================================================

const ArrowDelta = ({ current, previous, inverse = false, unit = '%', decimals = 1, className = '' }) => {
  const diff = delta(current, previous);
  if (diff === null) return <span className={`text-[9px] font-bold text-slate-300 ${className}`}>SEM HIST.</span>;
  if (Math.abs(diff) < 0.01) return <span className={`text-[10px] font-black text-slate-300 ${className}`}>• 0</span>;

  const isUp = diff > 0;
  const good = inverse ? !isUp : isUp;
  const color = good ? 'text-green-600' : 'text-red-500';
  const arrow = isUp ? '▲' : '▼';

  return (
    <span className={`inline-flex items-center gap-1 font-black ${color} ${className}`}>
      <span className="text-[9px]">{arrow}</span>
      <span>{isUp ? '+' : ''}{formatValue(diff, decimals)}{unit}</span>
    </span>
  );
};

const StatusBadge = ({ cuc, entup, compact = false }) => {
  const status = getStatus(cuc, entup);
  return (
    <span className={`inline-flex items-center gap-1 border rounded-full font-black uppercase tracking-wider ${toneClasses[status.tone]} ${compact ? 'px-1.5 py-0.5 text-[7px]' : 'px-2 py-1 text-[8px]'}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {status.label}
    </span>
  );
};

const MiniStat = ({ label, value, unit = '', color, deltaCurrent, deltaPrevious, inverse = false }) => (
  <div className="min-w-0">
    <div className="flex items-center justify-between gap-2 mb-1">
      <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest truncate">{label}</span>
      <ArrowDelta current={deltaCurrent} previous={deltaPrevious} inverse={inverse} unit={unit === '%' ? '%' : ''} decimals={unit === '%' ? 1 : 2} />
    </div>
    <div className="flex items-baseline gap-1">
      <span className="text-xl font-black tracking-tight" style={{ color }}>{formatValue(value, unit === 'L/h' ? 2 : 1)}</span>
      <span className="text-[9px] font-bold text-slate-400">{unit}</span>
    </div>
  </div>
);

const SectionTitle = ({ title, subtitle, right }) => (
  <div className="flex items-end justify-between gap-3 mb-2">
    <div className="min-w-0">
      <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-[0.16em] truncate">{title}</h3>
      {subtitle && <p className="text-[8px] text-slate-400 font-semibold mt-0.5 truncate">{subtitle}</p>}
    </div>
    {right}
  </div>
);

// ==========================================================================================
// GRÁFICOS SVG
// ==========================================================================================

const TrendChart = ({ evaluations, selectedKey, onSelect }) => {
  if (!evaluations?.length) {
    return <div className="h-40 flex items-center justify-center text-[9px] font-bold text-slate-400">Sem histórico disponível.</div>;
  }

  const data = [...evaluations].sort(sortEvaluationsAsc);
  const width = 760;
  const height = 190;
  const pad = { top: 18, right: 18, bottom: 32, left: 34 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const minY = 55;
  const maxY = 100;
  const x = (i) => pad.left + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v) => pad.top + ((maxY - clamp(n(v), minY, maxY)) / (maxY - minY)) * innerH;
  const cucPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d.cuc)}`).join(' ');
  const entMin = 0;
  const entMax = Math.max(15, ...data.map(d => n(d['entup%'])));
  const yEnt = (v) => pad.top + ((entMax - clamp(n(v), entMin, entMax)) / Math.max(1, entMax)) * innerH;
  const entPath = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${yEnt(d['entup%'])}`).join(' ');

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-[175px]" preserveAspectRatio="none">
        {[60, 70, 80, 90, 100].map(t => (
          <g key={t}>
            <line x1={pad.left} x2={width - pad.right} y1={y(t)} y2={y(t)} stroke="#e2e8f0" strokeDasharray="3 4" />
            <text x={pad.left - 7} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#94a3b8" fontWeight="800">{t}</text>
          </g>
        ))}
        <line x1={pad.left} x2={width - pad.right} y1={y(CUC_META)} y2={y(CUC_META)} stroke="#22c55e" strokeDasharray="5 4" opacity="0.8" />
        <text x={width - pad.right} y={y(CUC_META) - 4} textAnchor="end" fontSize="8" fill="#16a34a" fontWeight="900">META 90</text>

        <path d={cucPath} fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <path d={entPath} fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 3" />

        {data.map((d, i) => {
          const key = evaluationKey(d);
          const selected = key === selectedKey;
          return (
            <g key={key} onClick={() => onSelect(d)} className="cursor-pointer">
              <circle cx={x(i)} cy={y(d.cuc)} r={selected ? 5 : 3.5} fill="#fff" stroke="#16a34a" strokeWidth={selected ? 3 : 2} />
              <circle cx={x(i)} cy={yEnt(d['entup%'])} r={selected ? 4 : 2.5} fill="#fff" stroke="#ef4444" strokeWidth={2} />
              <text x={x(i)} y={height - 15} textAnchor="middle" fontSize="8" fill={selected ? '#0f172a' : '#94a3b8'} fontWeight="900">
                {d.ano}/{d.avaliacao}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="flex items-center justify-center gap-5 mt-1">
        <span className="inline-flex items-center gap-1.5 text-[8px] font-black text-slate-500 uppercase"><i className="w-3 h-0.5 bg-green-600 rounded" /> CUC</span>
        <span className="inline-flex items-center gap-1.5 text-[8px] font-black text-slate-500 uppercase"><i className="w-3 h-0.5 bg-red-500 rounded border-dashed" /> Entupimento</span>
        <span className="text-[8px] text-slate-400 font-bold">Clique em um ponto para selecionar a avaliação</span>
      </div>
    </div>
  );
};

const MiniSparkline = ({ values = [], color = '#16a34a', width = 100, height = 28 }) => {
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(0.0001, max - min);
  const points = values.map((v, i) => {
    const xx = values.length <= 1 ? width / 2 : (i / (values.length - 1)) * width;
    const yy = height - ((n(v) - min) / span) * (height - 4) - 2;
    return `${xx},${yy}`;
  }).join(' ');
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

const DistributionStrip = ({ lotes }) => {
  const counts = useMemo(() => {
    return lotes.reduce((acc, lote) => {
      acc.green += lote.cuc >= 90 ? 1 : 0;
      acc.yellow += lote.cuc >= 80 && lote.cuc < 90 ? 1 : 0;
      acc.red += lote.cuc < 80 ? 1 : 0;
      return acc;
    }, { green: 0, yellow: 0, red: 0 });
  }, [lotes]);
  const total = Math.max(1, lotes.length);
  return (
    <div className="space-y-1.5">
      <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden flex">
        <div className="bg-green-500" style={{ width: `${counts.green / total * 100}%` }} />
        <div className="bg-amber-400" style={{ width: `${counts.yellow / total * 100}%` }} />
        <div className="bg-red-500" style={{ width: `${counts.red / total * 100}%` }} />
      </div>
      <div className="flex items-center justify-between text-[8px] font-black uppercase tracking-wider">
        <span className="text-green-600">{counts.green} ≥ 90</span>
        <span className="text-amber-600">{counts.yellow} 80–89,9</span>
        <span className="text-red-500">{counts.red} &lt; 80</span>
      </div>
    </div>
  );
};

// ==========================================================================================
// MODAL DE LOTE
// ==========================================================================================

const LoteDetailModal = ({ item, lote, onClose }) => {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewUnit, setViewUnit] = useState('L/h');

  useEffect(() => {
    let mounted = true;
    const fetchRows = async () => {
      if (!item || !lote) return;
      setLoading(true);
      try {
        // Query indexada somente para o campo + avaliação + lote.
        // Mantém a mesma estrutura de filtro usada no histórico anterior.
        const { data, error } = await supabase
          .from('tb_q_agrotarget')
          .select('lote, indicador, valor, turno')
          .eq('ano', Number(item.ano))
          .eq('campo', String(item.campo || '').trim())
          .eq('extra1', String(item.avaliacao || '').trim())
          .eq('lote', String(lote.loteRaw ?? lote.loteFormatado ?? '').trim())
          .in('ocorrencia', CUC_OCORRENCIAS);

        if (error) throw error;
        if (mounted) setRows(data || []);
      } catch (error) {
        console.error('Erro ao buscar emissores do lote:', error);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchRows();
    return () => { mounted = false; };
  }, [item, lote]);

  const emissorRows = useMemo(() => {
    return rows
      .filter(r => EMISSORES_VALIDOS.includes(r.indicador))
      .sort((a, b) => EMISSORES_VALIDOS.indexOf(a.indicador) - EMISSORES_VALIDOS.indexOf(b.indicador));
  }, [rows]);

  const entupidos = useMemo(() => rows
    .filter(r => r.indicador === 'Emissores Entupidos')
    .reduce((acc, r) => acc + n(String(r.valor ?? '0').replace(',', '.')), 0), [rows]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 backdrop-blur-[3px] p-4">
      <div className="w-full max-w-3xl max-h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-widest">Lote {lote?.loteFormatado}</span>
              <StatusBadge cuc={lote?.cuc} entup={lote?.entupPerc} compact />
            </div>
            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">
              {item?.campo} • {evaluationLabel(item)} • {lote?.turno || 'Turno não informado'}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-200 hover:bg-red-100 hover:text-red-500 text-slate-500 font-black">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-[var(--q-bg)] custom-scrollbar">
          {loading ? (
            <div className="min-h-48 flex items-center justify-center text-[9px] font-black uppercase tracking-widest text-slate-400">Consultando emissores...</div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-4 gap-2">
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">CUC</div>
                  <div className="text-xl font-black mt-1" style={{ color: getCucColor(lote?.cuc) }}>{formatValue(lote?.cuc)}%</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Vazão</div>
                  <div className="text-xl font-black mt-1" style={{ color: getVazaoColor(lote?.vazao) }}>{formatValue(lote?.vazao)} <span className="text-[9px] text-slate-400">L/h</span></div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Entup.</div>
                  <div className="text-xl font-black mt-1" style={{ color: getEntupColor(lote?.entupPerc) }}>{formatValue(lote?.entupPerc)}%</div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-3">
                  <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Avaliados</div>
                  <div className="text-xl font-black mt-1 text-slate-800">{emissorRows.length}</div>
                  <div className="text-[8px] font-bold text-slate-400">{entupidos} entupidos</div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-widest text-slate-500">Emissores coletados</div>
                    <div className="text-[8px] font-semibold text-slate-400 mt-0.5">Clique não é necessário: leitura rápida do conjunto</div>
                  </div>
                  <div className="flex bg-slate-100 p-0.5 rounded-md">
                    {['mL', 'L/h'].map(unit => (
                      <button key={unit} onClick={() => setViewUnit(unit)} className={`px-2 py-1 text-[8px] font-black uppercase rounded ${viewUnit === unit ? 'bg-white shadow-sm text-slate-700' : 'text-slate-400'}`}>{unit}</button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-1.5">
                  {emissorRows.map((row, idx) => {
                    const ml = n(String(row.valor ?? '0').replace(',', '.'));
                    const lh = ml * 0.02;
                    return (
                      <div key={`${row.indicador}-${idx}`} className="rounded-lg overflow-hidden border border-slate-200">
                        <div className="text-[7px] font-black text-slate-400 bg-slate-50 px-1 py-1 text-center">E{idx + 1}</div>
                        <div className="px-1 py-2 text-center text-[10px] font-black" style={{ backgroundColor: `${getVazaoColor(lh)}18`, color: getVazaoColor(lh) }}>
                          {viewUnit === 'mL' ? formatValue(ml, 0) : formatValue(lh, 2)}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {!emissorRows.length && <div className="py-8 text-center text-[9px] font-bold text-slate-400">Nenhum emissor encontrado para este lote.</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ==========================================================================================
// COMPONENTE PRINCIPAL
// ==========================================================================================

const DashCUC = () => {
  const [rows, setRows] = useState([]);
  const [loadingBase, setLoadingBase] = useState(true);
  const [errorBase, setErrorBase] = useState(null);

  const [selectedFieldKey, setSelectedFieldKey] = useState(null);
  const [selectedEvaluationKey, setSelectedEvaluationKey] = useState(null);
  const [selectedLote, setSelectedLote] = useState(null);
  const [search, setSearch] = useState('');
  const [selectedDepa, setSelectedDepa] = useState('TODOS');
  const [statusFilter, setStatusFilter] = useState('TODOS');

  const [lotesData, setLotesData] = useState([]);
  const [loadingLotes, setLoadingLotes] = useState(false);

  // ----------------------------------------------------------------------------------------
  // 1. BASE GERAL DA VIEW
  // ----------------------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const loadBase = async () => {
      setLoadingBase(true);
      setErrorBase(null);
      try {
        const { data, error } = await supabase
          .from('vw_q_cucgeral')
          .select('*')
          .order('dt_final', { ascending: false });

        if (error) throw error;
        if (!mounted) return;

        const normalized = (data || []).map((r, idx) => ({
          ...r,
          _id: `${idx}-${evaluationKey(r)}`,
          cuc: n(r.cuc),
          vazao: n(r.vazao),
          'entup%': n(r['entup%']),
          entupido: n(r.entupido),
          total_lotes: n(r.total_lotes),
          emissores: n(r.emissores),
          ano: n(r.ano),
          avaliacao: String(r.avaliacao ?? ''),
          codigo_campo: String(r.codigo_campo ?? '').trim(),
          campo: String(r.campo ?? r.codigo_campo ?? '').trim(),
          depa: String(r.depa ?? 'SEM DEPA').trim(),
          setor: String(r.setor ?? 'SEM SETOR').trim()
        }));

        setRows(normalized);
      } catch (err) {
        console.error('Erro ao carregar vw_q_cucgeral:', err);
        if (mounted) setErrorBase(err?.message || 'Não foi possível carregar os dados.');
      } finally {
        if (mounted) setLoadingBase(false);
      }
    };
    loadBase();
    return () => { mounted = false; };
  }, []);

  // ----------------------------------------------------------------------------------------
  // 2. MAPA DE CAMPOS E HISTÓRICO
  // ----------------------------------------------------------------------------------------
  const fieldsMap = useMemo(() => {
    const map = new Map();
    rows.forEach(row => {
      const key = row.codigo_campo || row.campo;
      if (!key) return;
      if (!map.has(key)) map.set(key, {
        key,
        codigo_campo: row.codigo_campo,
        campo: row.campo,
        depa: row.depa,
        setor: row.setor,
        evals: []
      });
      const f = map.get(key);
      f.evals.push(row);
      if (!f.depa || f.depa === 'SEM DEPA') f.depa = row.depa;
      if (!f.setor || f.setor === 'SEM SETOR') f.setor = row.setor;
    });

    map.forEach(field => {
      field.evals.sort(sortEvaluationsDesc);
    });
    return map;
  }, [rows]);

  const fieldList = useMemo(() => {
    return Array.from(fieldsMap.values()).sort((a, b) => {
      const da = parseDate(a.evals[0]?.dt_final);
      const db = parseDate(b.evals[0]?.dt_final);
      if (db !== da) return db - da;
      return a.campo.localeCompare(b.campo, 'pt-BR');
    });
  }, [fieldsMap]);

  useEffect(() => {
    if (!selectedFieldKey && fieldList.length) {
      setSelectedFieldKey(fieldList[0].key);
      setSelectedEvaluationKey(evaluationKey(fieldList[0].evals[0]));
    }
  }, [fieldList, selectedFieldKey]);

  const activeField = selectedFieldKey ? fieldsMap.get(selectedFieldKey) : null;
  const activeEvaluations = activeField?.evals || [];

  // Se houver avaliação no ano mais recente, o padrão é a mais recente desse ano.
  useEffect(() => {
    if (!activeField?.evals?.length) return;
    const latestYear = Math.max(...activeField.evals.map(e => e.ano));
    const defaultEval = activeField.evals
      .filter(e => e.ano === latestYear)
      .sort(sortEvaluationsDesc)[0] || activeField.evals[0];
    setSelectedEvaluationKey(evaluationKey(defaultEval));
  }, [selectedFieldKey]); // intentionally only on field change

  const selectedEvaluation = useMemo(() => {
    if (!activeField) return null;
    return activeField.evals.find(e => evaluationKey(e) === selectedEvaluationKey) || activeField.evals[0] || null;
  }, [activeField, selectedEvaluationKey]);

  // Avaliação anterior cronológica: é a imediatamente anterior na história do campo.
  const previousEvaluation = useMemo(() => {
    if (!selectedEvaluation || !activeField) return null;
    const ordered = [...activeField.evals].sort(sortEvaluationsDesc);
    const index = ordered.findIndex(e => evaluationKey(e) === evaluationKey(selectedEvaluation));
    if (index < 0 || index === ordered.length - 1) return null;
    return ordered[index + 1] || null;
  }, [activeField, selectedEvaluation]);

  // ----------------------------------------------------------------------------------------
  // 3. CONSULTA DOS LOTES DA AVALIAÇÃO SELECIONADA
  // ----------------------------------------------------------------------------------------
  useEffect(() => {
    let mounted = true;
    const fetchLotes = async () => {
      if (!selectedEvaluation) {
        setLotesData([]);
        return;
      }

      setLoadingLotes(true);
      try {
        const { data, error } = await supabase
          .from('tb_q_agrotarget')
          .select('lote, indicador, valor, turno')
          .eq('ano', Number(selectedEvaluation.ano))
          .eq('campo', String(selectedEvaluation.campo).trim())
          .eq('extra1', String(selectedEvaluation.avaliacao).trim())
          .in('ocorrencia', CUC_OCORRENCIAS);

        if (error) throw error;
        if (!mounted) return;

        const lotMap = new Map();
        (data || []).forEach(row => {
          const loteRaw = row.lote == null ? '0' : String(row.lote).trim();
          let val = parseFloat(String(row.valor ?? '0').replace(',', '.'));
          if (Number.isNaN(val)) val = 0;

          if (!lotMap.has(loteRaw)) {
            lotMap.set(loteRaw, {
              loteRaw,
              loteStr: loteRaw,
              turno: row.turno || '1º Turno',
              emissores: [],
              entupidos: 0
            });
          }

          const lot = lotMap.get(loteRaw);
          if (EMISSORES_VALIDOS.includes(row.indicador)) lot.emissores.push(val);
          else if (row.indicador === 'Emissores Entupidos') lot.entupidos += val;
        });

        const processed = Array.from(lotMap.values()).map(lot => {
          const cuc = calcularCuc(lot.emissores);
          const media = lot.emissores.length ? lot.emissores.reduce((a, b) => a + b, 0) / lot.emissores.length : 0;
          const vazao = media * 0.02;
          const entupPerc = lot.emissores.length ? (lot.entupidos / lot.emissores.length) * 100 : 0;
          const num = parseInt(lot.loteStr, 10);
          return {
            ...lot,
            loteNum: Number.isNaN(num) ? 999999 : num,
            loteFormatado: Number.isNaN(num) ? lot.loteStr : String(num).padStart(2, '0'),
            cuc,
            vazao,
            entupPerc,
            status: getStatus(cuc, entupPerc)
          };
        }).sort((a, b) => a.loteNum - b.loteNum);

        setLotesData(processed);
      } catch (err) {
        console.error('Erro ao buscar lotes da avaliação:', err);
        if (mounted) setLotesData([]);
      } finally {
        if (mounted) setLoadingLotes(false);
      }
    };

    fetchLotes();
    return () => { mounted = false; };
  }, [selectedEvaluation]);

  // ----------------------------------------------------------------------------------------
  // 4. ANÁLISE GLOBAL / DEPA
  // ----------------------------------------------------------------------------------------
  const depaStats = useMemo(() => {
    const map = new Map();
    fieldList.forEach(field => {
      const latest = field.evals[0];
      if (!latest) return;
      if (!map.has(field.depa)) map.set(field.depa, []);
      map.get(field.depa).push({ field, latest });
    });

    return Array.from(map.entries()).map(([depa, items]) => {
      const avgCuc = items.reduce((s, x) => s + x.latest.cuc, 0) / Math.max(1, items.length);
      const avgEntup = items.reduce((s, x) => s + x.latest['entup%'], 0) / Math.max(1, items.length);
      const belowMeta = items.filter(x => x.latest.cuc < CUC_META).length;
      const critical = items.filter(x => getStatus(x.latest.cuc, x.latest['entup%']).tone === 'red').length;
      const improving = items.filter(x => {
        const prev = x.field.evals[1];
        return prev && x.latest.cuc > prev.cuc;
      }).length;
      const avgDelta = items.reduce((s, x) => {
        const prev = x.field.evals[1];
        return s + (prev ? x.latest.cuc - prev.cuc : 0);
      }, 0) / Math.max(1, items.filter(x => x.field.evals[1]).length);

      return {
        depa,
        items: items.sort((a, b) => a.latest.cuc - b.latest.cuc),
        avgCuc,
        avgEntup,
        belowMeta,
        critical,
        improving,
        avgDelta
      };
    }).sort((a, b) => a.avgCuc - b.avgCuc);
  }, [fieldList]);

  const depaGlobalKpis = useMemo(() => {
    const totalFields = fieldList.length;
    const avgCuc = totalFields ? fieldList.reduce((s, f) => s + f.evals[0].cuc, 0) / totalFields : 0;
    const avgEntup = totalFields ? fieldList.reduce((s, f) => s + f.evals[0]['entup%'], 0) / totalFields : 0;
    const belowMeta = fieldList.filter(f => f.evals[0].cuc < CUC_META).length;
    const critical = fieldList.filter(f => getStatus(f.evals[0].cuc, f.evals[0]['entup%']).tone === 'red').length;
    return { totalFields, avgCuc, avgEntup, belowMeta, critical };
  }, [fieldList]);

  const filteredFields = useMemo(() => {
    const term = search.trim().toLowerCase();
    return fieldList.filter(f => {
      const matchesTerm = !term || f.campo.toLowerCase().includes(term) || f.codigo_campo.toLowerCase().includes(term);
      const matchesDepa = selectedDepa === 'TODOS' || f.depa === selectedDepa;
      const latest = f.evals[0];
      const status = getStatus(latest.cuc, latest['entup%']);
      const matchesStatus = statusFilter === 'TODOS' || status.label === statusFilter;
      return matchesTerm && matchesDepa && matchesStatus;
    });
  }, [fieldList, search, selectedDepa, statusFilter]);

  const selectedFieldTrend = useMemo(() => {
    if (!activeField) return [];
    return [...activeField.evals].sort(sortEvaluationsAsc).map(e => n(e.cuc));
  }, [activeField]);

  const selectedFieldInsights = useMemo(() => {
    if (!selectedEvaluation) return null;
    const cucDelta = previousEvaluation ? selectedEvaluation.cuc - previousEvaluation.cuc : null;
    const entDelta = previousEvaluation ? selectedEvaluation['entup%'] - previousEvaluation['entup%'] : null;
    const lotCrit = lotesData.filter(l => l.cuc < CUC_META || l.entupPerc > 10).length;
    const worstLote = [...lotesData].sort((a, b) => a.cuc - b.cuc)[0] || null;

    let headline = 'Sem histórico para comparação';
    let headlineTone = 'slate';
    if (previousEvaluation) {
      if (cucDelta > 0.5 && entDelta <= 0) {
        headline = 'Melhora consistente do campo';
        headlineTone = 'green';
      } else if (cucDelta < -0.5 || entDelta > 1) {
        headline = 'Perda de desempenho em relação à anterior';
        headlineTone = 'red';
      } else {
        headline = 'Desempenho relativamente estável';
        headlineTone = 'yellow';
      }
    }

    return { cucDelta, entDelta, lotCrit, worstLote, headline, headlineTone };
  }, [selectedEvaluation, previousEvaluation, lotesData]);

  const topRiskFields = useMemo(() => {
    return [...fieldList].map(field => {
      const cur = field.evals[0];
      const prev = field.evals[1] || null;
      return {
        field,
        current: cur,
        previous: prev,
        score: (90 - cur.cuc) + Math.max(0, cur['entup%'] - ENTUP_META) * 2 + (prev ? Math.max(0, prev.cuc - cur.cuc) : 0)
      };
    }).sort((a, b) => b.score - a.score).slice(0, 6);
  }, [fieldList]);

  const depaOptions = useMemo(() => ['TODOS', ...depaStats.map(d => d.depa)], [depaStats]);

  const selectField = (field) => {
    setSelectedFieldKey(field.key);
    setSelectedDepa(field.depa);
    setStatusFilter('TODOS');
  };

  // ========================================================================================
  // RENDER
  // ========================================================================================

  if (loadingBase) {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center bg-[var(--q-bg)]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 border-4 border-slate-200 border-t-[var(--q-green)] rounded-full animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Montando History Telling CUC</span>
        </div>
      </div>
    );
  }

  if (errorBase) {
    return (
      <div className="w-full h-full min-h-[500px] flex items-center justify-center p-8">
        <div className="max-w-lg bg-white border border-red-200 rounded-2xl p-6 text-center shadow-sm">
          <div className="text-red-500 text-2xl mb-2">!</div>
          <div className="text-sm font-black text-slate-800 uppercase tracking-widest">Erro ao carregar CUC</div>
          <div className="text-xs font-semibold text-slate-500 mt-2">{errorBase}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-0 bg-[var(--q-bg)] text-slate-800 overflow-hidden flex flex-col">
      {/* ====================================================================================
          HEADER EXECUTIVO
      ==================================================================================== */}
      <div className="shrink-0 px-4 pt-3 pb-2 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--q-green)] flex items-center justify-center text-white font-black text-sm shadow-sm">CUC</div>
            <div className="min-w-0">
              <div className="text-[9px] font-black uppercase tracking-[0.22em] text-[var(--q-green)]">QualyFlow • Irrigação</div>
              <h1 className="text-lg font-black tracking-tight uppercase truncate">Histórico de Uniformidade</h1>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 min-w-[420px]">
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Campos</div>
              <div className="text-base font-black text-slate-800">{depaGlobalKpis.totalFields}</div>
            </div>
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">CUC médio</div>
              <div className="text-base font-black" style={{ color: getCucColor(depaGlobalKpis.avgCuc) }}>{formatValue(depaGlobalKpis.avgCuc, 1)}%</div>
            </div>
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Abaixo 90%</div>
              <div className="text-base font-black text-red-500">{depaGlobalKpis.belowMeta}</div>
            </div>
            <div className="px-3 py-2 rounded-xl border border-slate-200 bg-slate-50">
              <div className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Críticos</div>
              <div className="text-base font-black text-red-600">{depaGlobalKpis.critical}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================================
          CORPO PRINCIPAL
      ==================================================================================== */}
      <div className="flex-1 min-h-0 grid grid-cols-[minmax(0,1fr)_310px] gap-3 p-3 overflow-hidden">
        {/* ESQUERDA */}
        <div className="min-w-0 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-3">
          {/* CAMPO / SELETOR DE AVALIAÇÕES */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-[8px] font-black uppercase tracking-[0.18em] text-[var(--q-green)]">Campo selecionado</div>
                <div className="flex items-baseline gap-2 min-w-0 mt-0.5">
                  <h2 className="text-xl font-black tracking-tight truncate">{selectedEvaluation?.campo || '—'}</h2>
                  <span className="text-[9px] font-bold text-slate-400 whitespace-nowrap">#{selectedEvaluation?.codigo_campo || '—'} • {selectedEvaluation?.depa || '—'} • {selectedEvaluation?.setor || '—'}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-[8px] font-black uppercase tracking-widest text-slate-400">Período da avaliação</div>
                <div className="text-[10px] font-black text-slate-700 mt-0.5">{formatDate(selectedEvaluation?.dt_inicial)} → {formatDate(selectedEvaluation?.dt_final)}</div>
              </div>
            </div>

            <div className="px-4 py-2 bg-slate-50/70 border-b border-slate-100 flex items-center gap-2 overflow-x-auto custom-scrollbar">
              <span className="text-[7px] font-black uppercase tracking-widest text-slate-400 shrink-0">Avaliações:</span>
              {[...activeEvaluations].sort(sortEvaluationsAsc).map((evaluation) => {
                const key = evaluationKey(evaluation);
                const selected = key === evaluationKey(selectedEvaluation);
                const prev = activeEvaluations.find(e => {
                  const ordered = [...activeEvaluations].sort(sortEvaluationsDesc);
                  const idx = ordered.findIndex(x => evaluationKey(x) === key);
                  return idx >= 0 && ordered[idx + 1] && evaluationKey(ordered[idx + 1]) === evaluationKey(e);
                });
                return (
                  <button
                    key={key}
                    onClick={() => setSelectedEvaluationKey(key)}
                    className={`shrink-0 rounded-lg border px-2.5 py-1.5 text-left transition-all ${selected ? 'bg-white border-[var(--q-green)] shadow-sm ring-1 ring-[var(--q-green)]/10' : 'bg-slate-100/60 border-slate-200 hover:bg-white hover:border-slate-300'}`}
                  >
                    <div className={`text-[9px] font-black ${selected ? 'text-[var(--q-green)]' : 'text-slate-600'}`}>{evaluationLabel(evaluation)}</div>
                    <div className="text-[7px] font-bold text-slate-400 mt-0.5">{formatDate(evaluation.dt_final)}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[8px] font-black" style={{ color: getCucColor(evaluation.cuc) }}>{formatValue(evaluation.cuc, 1)}%</span>
                      {prev && <ArrowDelta current={evaluation.cuc} previous={prev.cuc} className="text-[8px]" />}
                    </div>
                  </button>
                );
              })}
              {!activeEvaluations.length && <span className="text-[8px] font-bold text-slate-400">Sem avaliações.</span>}
            </div>
          </section>

          {/* KPIs */}
          <section className="grid grid-cols-4 gap-2">
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <MiniStat
                label="CUC Uniformidade"
                value={selectedEvaluation?.cuc}
                unit="%"
                color={getCucColor(selectedEvaluation?.cuc)}
                deltaCurrent={selectedEvaluation?.cuc}
                deltaPrevious={previousEvaluation?.cuc}
              />
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${clamp(selectedEvaluation?.cuc || 0, 0, 100)}%`, backgroundColor: getCucColor(selectedEvaluation?.cuc) }} /></div>
              <div className="flex justify-between mt-1 text-[7px] font-black text-slate-400 uppercase"><span>Meta 90%</span><span>{selectedEvaluation?.cuc >= CUC_META ? 'META OK' : 'ABAIXO DA META'}</span></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <MiniStat label="Vazão Média" value={selectedEvaluation?.vazao} unit="L/h" color={getVazaoColor(selectedEvaluation?.vazao)} deltaCurrent={selectedEvaluation?.vazao} deltaPrevious={previousEvaluation?.vazao} />
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden relative"><div className="absolute inset-y-0 left-[50%] w-[11%] bg-green-100" /><div className="absolute inset-y-0 w-1.5 rounded-full -translate-x-1/2" style={{ left: `${clamp(((selectedEvaluation?.vazao || 0) / 1.5) * 100, 0, 100)}%`, backgroundColor: getVazaoColor(selectedEvaluation?.vazao) }} /></div>
              <div className="flex justify-between mt-1 text-[7px] font-black text-slate-400 uppercase"><span>0,8</span><span>Faixa ideal 0,9–1,1</span><span>1,5</span></div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm">
              <MiniStat label="Entupimento" value={selectedEvaluation?.['entup%']} unit="%" color={getEntupColor(selectedEvaluation?.['entup%'])} deltaCurrent={selectedEvaluation?.['entup%']} deltaPrevious={previousEvaluation?.['entup%']} inverse />
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden"><div className="h-full rounded-full" style={{ width: `${clamp(((selectedEvaluation?.['entup%'] || 0) / 20) * 100, 0, 100)}%`, backgroundColor: getEntupColor(selectedEvaluation?.['entup%']) }} /></div>
              <div className="flex justify-between mt-1 text-[7px] font-black text-slate-400 uppercase"><span>Meta ≤ 5%</span><span>{selectedEvaluation?.['entup%'] <= ENTUP_META ? 'OK' : 'ATENÇÃO'}</span></div>
            </div>
            <div className={`border rounded-xl p-3 shadow-sm ${toneClasses[selectedFieldInsights?.headlineTone || 'slate']}`}>
              <div className="text-[8px] font-black uppercase tracking-widest opacity-70">Leitura executiva</div>
              <div className="text-sm font-black leading-tight mt-2">{selectedFieldInsights?.headline || '—'}</div>
              {previousEvaluation ? (
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div><div className="text-[7px] font-black opacity-60 uppercase">CUC</div><ArrowDelta current={selectedEvaluation?.cuc} previous={previousEvaluation?.cuc} /></div>
                  <div><div className="text-[7px] font-black opacity-60 uppercase">Entup.</div><ArrowDelta current={selectedEvaluation?.['entup%']} previous={previousEvaluation?.['entup%']} inverse /></div>
                </div>
              ) : <div className="text-[8px] font-bold opacity-60 mt-2">Primeira avaliação conhecida.</div>}
            </div>
          </section>

          {/* GRÁFICO DE LOTES + TENDÊNCIA */}
          <div className="grid grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)] gap-3">
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 min-w-0">
              <SectionTitle
                title="Desempenho por lote"
                subtitle={`${lotesData.length} lotes • barras com largura fixa • clique para ver emissores`}
                right={loadingLotes ? <span className="text-[8px] font-black uppercase text-slate-400 animate-pulse">Atualizando...</span> : null}
              />
              <DistributionStrip lotes={lotesData} />

              <div className="mt-3 overflow-x-auto custom-scrollbar pb-2">
                <div className="relative min-w-max h-[235px] px-4 pt-5">
                  <div className="absolute left-0 right-0 top-[25px] border-t border-dashed border-slate-300" />
                  <div className="absolute left-0 right-0 top-[44px] border-t border-slate-100" />
                  <div className="absolute left-0 right-0 top-[94px] border-t border-slate-100" />
                  <div className="absolute left-0 right-0 top-[144px] border-t border-slate-100" />
                  <div className="absolute left-0 right-0 top-[194px] border-t border-slate-200" />
                  <div className="absolute left-0 top-2 text-[7px] font-black text-green-600 uppercase">Meta 90%</div>
                  <div className="flex items-end gap-2 h-full pb-4">
                    {lotesData.map((lote) => {
                      const h = clamp((n(lote.cuc) / 100) * 170, 6, 170);
                      return (
                        <button
                          key={`${lote.loteRaw}`}
                          onClick={() => setSelectedLote(lote)}
                          className="group flex flex-col justify-end items-center shrink-0 w-10 h-full focus:outline-none"
                          title={`Lote ${lote.loteFormatado} • CUC ${formatValue(lote.cuc)}% • ${formatValue(lote.vazao)} L/h • Entup. ${formatValue(lote.entupPerc)}%`}
                        >
                          <div className="opacity-0 group-hover:opacity-100 transition-opacity mb-1 px-1.5 py-1 rounded bg-slate-800 text-white text-[7px] font-black whitespace-nowrap z-20">
                            {formatValue(lote.cuc, 1)}% • {formatValue(lote.vazao, 2)} L/h
                          </div>
                          <div className="relative w-7 flex items-end" style={{ height: `${h}px` }}>
                            <div className="w-full rounded-t-md group-hover:brightness-95 transition-all" style={{ height: '100%', backgroundColor: getCucColor(lote.cuc), opacity: 0.88 }} />
                          </div>
                          <div className="mt-1 text-[8px] font-black text-slate-600">{lote.loteFormatado}</div>
                          <div className="text-[7px] font-black" style={{ color: getCucColor(lote.cuc) }}>{formatValue(lote.cuc, 0)}%</div>
                        </button>
                      );
                    })}
                    {!lotesData.length && <div className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-slate-400">Nenhum lote encontrado.</div>}
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-3 min-w-0">
              <SectionTitle title="Linha de tendência" subtitle="Histórico do campo • CUC e Entupimento" />
              <TrendChart evaluations={activeEvaluations} selectedKey={evaluationKey(selectedEvaluation)} onSelect={(ev) => setSelectedEvaluationKey(evaluationKey(ev))} />
              <div className="grid grid-cols-3 gap-2 mt-2">
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100"><div className="text-[7px] font-black text-slate-400 uppercase">Maior CUC</div><div className="text-[12px] font-black text-green-600">{formatValue(Math.max(...activeEvaluations.map(e => e.cuc), 0), 1)}%</div></div>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100"><div className="text-[7px] font-black text-slate-400 uppercase">Menor CUC</div><div className="text-[12px] font-black text-red-500">{formatValue(activeEvaluations.length ? Math.min(...activeEvaluations.map(e => e.cuc)) : 0, 1)}%</div></div>
                <div className="bg-slate-50 rounded-lg p-2 border border-slate-100"><div className="text-[7px] font-black text-slate-400 uppercase">Variação atual</div><div className="text-[12px] font-black"><ArrowDelta current={selectedEvaluation?.cuc} previous={previousEvaluation?.cuc} /></div></div>
              </div>
            </section>
          </div>

          {/* HISTÓRICO DE COMPARAÇÃO + LOTES CRÍTICOS */}
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)] gap-3">
            <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Comparação da avaliação</div>
                  <div className="text-[7px] font-semibold text-slate-400 mt-0.5">A avaliação selecionada é sempre comparada à anterior cronológica.</div>
                </div>
                <StatusBadge cuc={selectedEvaluation?.cuc} entup={selectedEvaluation?.['entup%']} />
              </div>
              <div className="grid grid-cols-3 gap-px bg-slate-200">
                <div className="bg-white p-3">
                  <div className="text-[7px] font-black uppercase tracking-widest text-slate-400">Atual</div>
                  <div className="text-[10px] font-black text-slate-700 mt-1">{evaluationLabel(selectedEvaluation)}</div>
                  <div className="text-[8px] text-slate-400 mt-1">{formatDate(selectedEvaluation?.dt_final)}</div>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between text-[9px] font-black"><span>CUC</span><span style={{ color: getCucColor(selectedEvaluation?.cuc) }}>{formatValue(selectedEvaluation?.cuc)}%</span></div>
                    <div className="flex justify-between text-[9px] font-black"><span>Entup.</span><span style={{ color: getEntupColor(selectedEvaluation?.['entup%']) }}>{formatValue(selectedEvaluation?.['entup%'])}%</span></div>
                  </div>
                </div>
                <div className="bg-white p-3">
                  <div className="text-[7px] font-black uppercase tracking-widest text-slate-400">Anterior</div>
                  {previousEvaluation ? (
                    <>
                      <div className="text-[10px] font-black text-slate-700 mt-1">{evaluationLabel(previousEvaluation)}</div>
                      <div className="text-[8px] text-slate-400 mt-1">{formatDate(previousEvaluation.dt_final)}</div>
                      <div className="mt-2 space-y-1">
                        <div className="flex justify-between text-[9px] font-black"><span>CUC</span><span style={{ color: getCucColor(previousEvaluation.cuc) }}>{formatValue(previousEvaluation.cuc)}%</span></div>
                        <div className="flex justify-between text-[9px] font-black"><span>Entup.</span><span style={{ color: getEntupColor(previousEvaluation['entup%']) }}>{formatValue(previousEvaluation['entup%'])}%</span></div>
                      </div>
                    </>
                  ) : <div className="text-[8px] font-bold text-slate-400 mt-3">Sem avaliação anterior.</div>}
                </div>
                <div className="bg-slate-50 p-3">
                  <div className="text-[7px] font-black uppercase tracking-widest text-slate-400">Variação</div>
                  <div className="mt-2 space-y-3">
                    <div><div className="text-[7px] font-black text-slate-400 uppercase">CUC</div><ArrowDelta current={selectedEvaluation?.cuc} previous={previousEvaluation?.cuc} /></div>
                    <div><div className="text-[7px] font-black text-slate-400 uppercase">Entupimento</div><ArrowDelta current={selectedEvaluation?.['entup%']} previous={previousEvaluation?.['entup%']} inverse /></div>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white border border-slate-200 rounded-xl shadow-sm p-3">
              <SectionTitle title="Pontos de atenção" subtitle="Lotes abaixo da meta ou com alto entupimento" />
              <div className="space-y-1.5 max-h-36 overflow-y-auto custom-scrollbar">
                {[...lotesData].filter(l => l.cuc < CUC_META || l.entupPerc > 10).sort((a, b) => a.cuc - b.cuc).slice(0, 6).map(l => (
                  <button key={l.loteRaw} onClick={() => setSelectedLote(l)} className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border border-slate-100 hover:border-slate-200 hover:bg-slate-50 text-left transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 flex items-center justify-center rounded-md bg-slate-100 text-[8px] font-black">{l.loteFormatado}</span>
                      <div className="min-w-0"><div className="text-[8px] font-black text-slate-700">{l.turno}</div><div className="text-[7px] font-bold text-slate-400">Clique para emissores</div></div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0"><span className="text-[9px] font-black" style={{ color: getCucColor(l.cuc) }}>{formatValue(l.cuc, 1)}%</span><span className="text-[9px] font-black" style={{ color: getEntupColor(l.entupPerc) }}>{formatValue(l.entupPerc, 1)}%</span></div>
                  </button>
                ))}
                {!lotesData.some(l => l.cuc < CUC_META || l.entupPerc > 10) && <div className="py-5 text-center text-[8px] font-black uppercase tracking-widest text-green-600">Nenhum lote crítico</div>}
              </div>
            </section>
          </div>

          {/* PANORAMA DEPA */}
          <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between gap-3">
              <div>
                <div className="text-[9px] font-black text-slate-700 uppercase tracking-widest">Panorama por DEPA</div>
                <div className="text-[7px] font-semibold text-slate-400 mt-0.5">Objetivo: localizar onde o desempenho está melhorando ou perdendo força.</div>
              </div>
              <div className="text-[7px] font-bold text-slate-400">Clique no campo para navegar diretamente.</div>
            </div>
            <div className="p-2 space-y-2">
              {depaStats.map(depa => (
                <div key={depa.depa} className={`border rounded-xl overflow-hidden ${selectedDepa === depa.depa ? 'border-[var(--q-green)]/40' : 'border-slate-200'}`}>
                  <div className="px-3 py-2 bg-slate-50 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-[8px] font-black text-slate-700">{depa.depa.replace('DEPA ', 'D')}</div>
                      <div><div className="text-[9px] font-black uppercase text-slate-700">{depa.depa}</div><div className="text-[7px] font-bold text-slate-400">{depa.items.length} campos • {depa.belowMeta} abaixo de 90% • {depa.critical} críticos</div></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right"><div className="text-[7px] font-black text-slate-400 uppercase">CUC médio</div><div className="text-[10px] font-black" style={{ color: getCucColor(depa.avgCuc) }}>{formatValue(depa.avgCuc, 1)}%</div></div>
                      <div className="text-right"><div className="text-[7px] font-black text-slate-400 uppercase">Entup.</div><div className="text-[10px] font-black" style={{ color: getEntupColor(depa.avgEntup) }}>{formatValue(depa.avgEntup, 1)}%</div></div>
                      <div className="text-right"><div className="text-[7px] font-black text-slate-400 uppercase">Δ CUC</div><div className="text-[10px] font-black"><ArrowDelta current={depa.avgCuc} previous={depa.avgCuc - depa.avgDelta} /></div></div>
                    </div>
                  </div>
                  <div className="px-2 pb-2 pt-1 grid grid-cols-1 xl:grid-cols-2 gap-1">
                    {depa.items.map(({ field, latest }) => {
                      const prev = field.evals[1];
                      const status = getStatus(latest.cuc, latest['entup%']);
                      const fieldTrend = field.evals.slice(0, 6).sort(sortEvaluationsAsc).map(e => e.cuc);
                      return (
                        <button key={field.key} onClick={() => selectField(field)} className={`w-full text-left px-2.5 py-2 rounded-lg border transition-colors ${selectedFieldKey === field.key ? 'border-[var(--q-green)] bg-[var(--q-green-soft)]' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0"><div className="text-[8px] font-black text-slate-700 uppercase truncate">{field.campo}</div><div className="text-[7px] font-bold text-slate-400 truncate">{field.codigo_campo} • {field.setor}</div></div>
                            <StatusBadge cuc={latest.cuc} entup={latest['entup%']} compact />
                          </div>
                          <div className="flex items-center gap-3 mt-1.5">
                            <div><span className="text-[7px] text-slate-400 font-black uppercase">CUC </span><span className="text-[9px] font-black" style={{ color: getCucColor(latest.cuc) }}>{formatValue(latest.cuc, 1)}%</span></div>
                            <div><span className="text-[7px] text-slate-400 font-black uppercase">Ent. </span><span className="text-[9px] font-black" style={{ color: getEntupColor(latest['entup%']) }}>{formatValue(latest['entup%'], 1)}%</span></div>
                            <ArrowDelta current={latest.cuc} previous={prev?.cuc} />
                            <ArrowDelta current={latest['entup%']} previous={prev?.['entup%']} inverse />
                            <div className="ml-auto opacity-70"><MiniSparkline values={fieldTrend} color={status.tone === 'green' ? '#16a34a' : status.tone === 'red' ? '#ef4444' : '#f59e0b'} /></div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* DIREITA: LISTA DE CAMPOS + RANKING */}
        <aside className="min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">
          <div className="p-3 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[9px] font-black uppercase tracking-widest text-slate-700">Mapa de campos</div>
              <span className="text-[7px] font-black text-slate-400">{filteredFields.length}/{fieldList.length}</span>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar campo ou código..." className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-[9px] font-bold outline-none focus:border-[var(--q-green)]" />
            <div className="flex gap-1 mt-2 overflow-x-auto custom-scrollbar pb-0.5">
              {depaOptions.map(depa => <button key={depa} onClick={() => setSelectedDepa(depa)} className={`shrink-0 px-2 py-1 rounded-md text-[7px] font-black uppercase border ${selectedDepa === depa ? 'bg-[var(--q-green)] text-white border-[var(--q-green)]' : 'bg-white text-slate-500 border-slate-200'}`}>{depa}</button>)}
            </div>
            <div className="grid grid-cols-4 gap-1 mt-2">
              {['TODOS', 'ESTÁVEL', 'ATENÇÃO', 'CRÍTICO'].map(status => <button key={status} onClick={() => setStatusFilter(status)} className={`px-1 py-1 rounded-md text-[6.5px] font-black uppercase border ${statusFilter === status ? (status === 'CRÍTICO' ? 'bg-red-500 text-white border-red-500' : status === 'ATENÇÃO' ? 'bg-amber-400 text-white border-amber-400' : status === 'ESTÁVEL' ? 'bg-green-500 text-white border-green-500' : 'bg-slate-700 text-white border-slate-700') : 'bg-white text-slate-400 border-slate-200'}`}>{status === 'TODOS' ? 'Todos' : status}</button>)}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {filteredFields.map(field => {
              const latest = field.evals[0];
              const previous = field.evals[1];
              const selected = selectedFieldKey === field.key;
              return (
                <button key={field.key} onClick={() => selectField(field)} className={`w-full text-left rounded-lg border p-2 transition-all ${selected ? 'border-[var(--q-green)] bg-[var(--q-green-soft)] shadow-sm' : 'border-transparent hover:border-slate-200 hover:bg-slate-50'}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className={`text-[9px] font-black uppercase truncate ${selected ? 'text-[var(--q-green-dark)]' : 'text-slate-700'}`}>{field.campo}</div><div className="text-[7px] font-bold text-slate-400 truncate">{field.depa} • {field.setor}</div></div>
                    <div className="text-right shrink-0"><div className="text-[10px] font-black" style={{ color: getCucColor(latest.cuc) }}>{formatValue(latest.cuc, 1)}%</div><div className="text-[7px] font-bold text-slate-400">{formatDate(latest.dt_final)}</div></div>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-1.5">
                    <div className="flex items-center gap-2"><span className="text-[7px] font-black text-slate-500">{latest.total_lotes} lotes</span><span className="text-[7px] font-black text-slate-500">{formatValue(latest['entup%'], 1)}% ent.</span></div>
                    <div className="flex items-center gap-1.5"><ArrowDelta current={latest.cuc} previous={previous?.cuc} /><ArrowDelta current={latest['entup%']} previous={previous?.['entup%']} inverse /></div>
                  </div>
                </button>
              );
            })}
            {!filteredFields.length && <div className="py-10 text-center text-[8px] font-bold text-slate-400">Nenhum campo corresponde aos filtros.</div>}
          </div>

          <div className="shrink-0 border-t border-slate-100 bg-slate-50 p-2">
            <div className="text-[8px] font-black uppercase tracking-widest text-slate-500 mb-2">Ranking de maior risco</div>
            <div className="space-y-1">
              {topRiskFields.slice(0, 4).map((item, idx) => (
                <button key={item.field.key} onClick={() => selectField(item.field)} className="w-full flex items-center gap-2 text-left px-2 py-1.5 bg-white rounded-md border border-slate-200 hover:border-red-200">
                  <span className="w-4 h-4 rounded bg-red-50 text-red-500 text-[7px] font-black flex items-center justify-center">{idx + 1}</span>
                  <span className="text-[7px] font-black text-slate-700 truncate flex-1">{item.field.campo}</span>
                  <span className="text-[8px] font-black" style={{ color: getCucColor(item.current.cuc) }}>{formatValue(item.current.cuc, 1)}%</span>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL */}
      {selectedLote && selectedEvaluation && (
        <LoteDetailModal item={selectedEvaluation} lote={selectedLote} onClose={() => setSelectedLote(null)} />
      )}
    </div>
  );
};

export default DashCUC;
