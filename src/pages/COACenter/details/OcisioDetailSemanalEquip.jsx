// ================================= DOCUMENTATION ------------------------------------------
// Script: OciosoDetailSemanalEquip
// Purpose: Modal detalhado de Ocioso de um Equipamento específico na visão Semanal.
// Relationships: Consome tb_c_geral. Pode ser invocado pela visão de Área ou Busca Global.
// Features: Cross-filtering entre Operadores e Dias da Semana.
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine
} from 'recharts';

/* ==========================================================================
   CONFIG VISUAL
   ========================================================================== */

const COLOR_SUCCESS = 'var(--coa-success)';
const COLOR_WARNING = '#facc15';
const COLOR_DANGER = 'var(--coa-danger)';
const COLOR_DANGER_STRONG = '#ff4d4f';
const COLOR_DANGER_TEXT = '#ff6b6b';
const COLOR_PANEL_BG = 'rgba(255,255,255,0.02)';
const COLOR_DIVIDER = 'var(--coa-divider)';
const COLOR_TEXT = 'var(--coa-text)';
const COLOR_TEXT_SOFT = 'var(--coa-text-soft)';

const GROUP_THEME_CONFIG = {
  produtivo: {
    cardStyle: { borderColor: 'rgba(61,220,151,0.24)', background: 'rgba(61,220,151,0.05)' },
    detailStyle: { borderColor: 'rgba(61,220,151,0.16)', background: 'rgba(61,220,151,0.03)' },
    groupTextColor: 'var(--coa-success)', totalColor: 'var(--coa-success)', opTextColor: 'var(--coa-success)',
    headerLabelColor: 'rgba(61,220,151,0.78)', valueLabel: 'Total',
  },
  manutencao: {
    cardStyle: { borderColor: 'rgba(168,85,247,0.30)', background: 'rgba(168,85,247,0.07)' },
    detailStyle: { borderColor: 'rgba(168,85,247,0.18)', background: 'rgba(168,85,247,0.05)' },
    groupTextColor: '#d8b4fe', totalColor: '#c084fc', opTextColor: '#e9d5ff',
    headerLabelColor: 'rgba(216,180,254,0.85)', valueLabel: 'Ocioso',
  },
  sem_apontamento: {
    cardStyle: { borderColor: 'rgba(239,68,68,0.36)', background: 'rgba(239,68,68,0.10)' },
    detailStyle: { borderColor: 'rgba(239,68,68,0.22)', background: 'rgba(239,68,68,0.08)' },
    groupTextColor: COLOR_DANGER_STRONG, totalColor: COLOR_DANGER_STRONG, opTextColor: '#ff8b8b',
    headerLabelColor: 'rgba(255,107,107,0.92)', valueLabel: 'Ocioso',
  },
  indeterminado: {
    cardStyle: { borderColor: 'rgba(209,213,219,0.30)', background: 'rgba(209,213,219,0.07)' },
    detailStyle: { borderColor: 'rgba(209,213,219,0.20)', background: 'rgba(209,213,219,0.05)' },
    groupTextColor: COLOR_DANGER_STRONG, totalColor: COLOR_DANGER_STRONG, opTextColor: COLOR_DANGER_TEXT,
    headerLabelColor: 'rgba(255,107,107,0.92)', valueLabel: 'Ocioso',
  },
  default: {
    cardStyle: { borderColor: 'rgba(239,68,68,0.26)', background: 'rgba(239,68,68,0.06)' },
    detailStyle: { borderColor: 'rgba(239,68,68,0.16)', background: 'rgba(239,68,68,0.05)' },
    groupTextColor: COLOR_DANGER_STRONG, totalColor: COLOR_DANGER_STRONG, opTextColor: '#ff9a9a',
    headerLabelColor: 'rgba(255,107,107,0.88)', valueLabel: 'Ocioso',
  },
};

const ANALYSIS_TEXT_THEME = {
  good: { color: '#7ae3b5' },
  bad: { color: '#ff7d7d' },
  warning: { color: '#f6d66d' },
};

/* ==========================================================================
   REGRAS DE EXIBIÇÃO DOS OPERADORES
   ========================================================================== */

const normalizeOperatorRuleKey = (value) =>
  String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

const OPERATOR_DISPLAY_RULES = [
  { test: (val) => normalizeOperatorRuleKey(val) === '9999 - - -', label: 'NÃO DISPONÍVEL', highlight: true },
  { test: (val) => normalizeOperatorRuleKey(val) === '9999 -', label: 'NÃO DISPONÍVEL', highlight: true },
  { test: (val) => normalizeOperatorRuleKey(val) === '-', label: 'NÃO DISPONÍVEL', highlight: true },
  { test: (val) => normalizeOperatorRuleKey(val) === '99999 - EQUIPE MONITORAMENTO', label: 'EQUIPE MONITORAMENTO', highlight: true },
];

/* ==========================================================================
   HELPERS GERAIS
   ========================================================================== */

const WEEK_DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

const getDayOfWeek = (brDate) => {
  if (!brDate || typeof brDate !== 'string') return 0;
  const [d, m, y] = brDate.split('/');
  const date = new Date(y, m - 1, d);
  const jsDay = date.getDay(); 
  return (jsDay + 6) % 7; 
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getMetaColor = (value, maxOk) => Number(value || 0) <= maxOk ? COLOR_SUCCESS : COLOR_DANGER_STRONG;

const normalizeKey = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();

const isProdutivoGroup = (g) => normalizeKey(g) === 'PRODUTIVO';
const isMaintenanceGroup = (g) => normalizeKey(g) === 'MANUTENCAO';
const isSemApontGroup = (g) => normalizeKey(g) === 'SEM APONTAMENTO';
const isIndeterminadoGroup = (g) => normalizeKey(g) === 'INDETERMINADO';

const getOperatorDisplayMeta = (rawOperatorValue) => {
  const raw = String(rawOperatorValue || '').trim();
  for (const rule of OPERATOR_DISPLAY_RULES) {
    if (rule.test(raw)) return { raw, label: rule.label, highlight: !!rule.highlight };
  }
  const parts = raw.split(' - ');
  const namePart = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : raw;
  if (!namePart) return { raw, label: 'NÃO DISPONÍVEL', highlight: true };
  const words = namePart.split(/\s+/).filter(Boolean);
  if (words.length === 0) return { raw, label: 'NÃO DISPONÍVEL', highlight: true };
  if (words.length === 1) return { raw, label: words[0], highlight: false };
  if (words.length === 2) return { raw, label: `${words[0]} ${words[1]}`, highlight: false };
  if ((words[1] || '').length < 4 && words[2]) return { raw, label: `${words[0]} ${words[1]} ${words[2]}`, highlight: false };
  return { raw, label: `${words[0]} ${words[1]}`, highlight: false };
};

/* ==========================================================================
   COMPONENTES UI
   ========================================================================== */

const SummaryItem = ({ label, value, color }) => (
  <div className="flex flex-col justify-end border-b pb-2 min-w-[100px]" style={{ borderColor: COLOR_DIVIDER }}>
    <span className="text-[8px] font-black text-[var(--coa-text-muted)] uppercase tracking-widest mb-1">{label}</span>
    <span className="text-[14px] md:text-[15px] font-black tracking-tight leading-none" style={{ color: color || COLOR_TEXT }}>{value}</span>
  </div>
);

const AnimatedProgressBar = ({ value, color }) => {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const timer = setTimeout(() => setWidth(Number(value || 0)), 120);
    return () => clearTimeout(timer);
  }, [value]);
  return (
    <div className="w-full h-2 rounded-full overflow-hidden border" style={{ background: 'rgba(255,255,255,0.03)', borderColor: COLOR_DIVIDER }}>
      <div className="h-full rounded-full transition-all duration-[1200ms] ease-out" style={{ width: `${Math.min(Math.max(width, 0), 100)}%`, backgroundColor: color, boxShadow: width > 0 ? `0 0 8px ${color}60` : 'none' }} />
    </div>
  );
};

const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x == null || y == null || value == null || value === 0) return null;
  const color = getMetaColor(value, 5);
  return (
    <text x={x + (width ? width / 2 : 0)} y={y} dy={-8} fill={color} fontSize={10} fontWeight="900" textAnchor="middle">
      {`${Number(value).toFixed(1)}%`}
    </text>
  );
};

const CustomBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getMetaColor(data.perc_ocioso, 5);
    return (
      <div className="coa-panel p-3 border shadow-lg flex flex-col gap-1" style={{ borderColor: 'var(--coa-border)', zIndex: 9999 }}>
        <p className="coa-text-micro mb-1">{data.data_formatada}</p>
        <p className="text-sm font-black" style={{ color }}>Motor Ocioso: {Number(data.perc_ocioso || 0).toFixed(1)}%</p>
        <p className="text-[12px] font-bold text-[var(--coa-text-soft)]">Horas Ociosas: {formatHHMM(data.hrs_ocioso)}</p>
      </div>
    );
  }
  return null;
};

// ================= EXECUTOR =================

const OciosoDetailSemanalEquip = ({ equipCode, selectedWeek, onClose }) => {
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Cross-Filters
  const [selectedOperators, setSelectedOperators] = useState([]);
  const [selectedDays, setSelectedDays] = useState([]); // array de "DD/MM/YYYY"
  const [expandedGroups, setExpandedGroups] = useState([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      if (!equipCode || !selectedWeek) return;
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('tb_c_geral')
          .select('*')
          .eq('ano', selectedWeek.ano)
          .eq('semana_iso', selectedWeek.semana)
          .eq('cod_equip', equipCode);

        if (error) throw error;
        if (mounted) setRawData(data || []);
      } catch (err) {
        console.error('[COA] Erro Equip Semanal:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [equipCode, selectedWeek]);

  // ================= LÓGICA DE FILTROS CRUZADOS =================
  
  // 1. O Gráfico reage ao filtro de Operadores (mas NÃO ao filtro de dias, senão ele some)
  const chartData = useMemo(() => {
    const filteredForChart = selectedOperators.length > 0 
      ? rawData.filter(r => selectedOperators.includes(String(r.cod_op || '').trim()))
      : rawData;

    // Inicializa os 7 dias
    const daysMap = new Map();
    WEEK_DAYS.forEach((dia, idx) => daysMap.set(idx, { desc_dia: dia, ops: 0, oci: 0, dataStr: null }));

    filteredForChart.forEach(row => {
      const idx = getDayOfWeek(row.data);
      if (daysMap.has(idx)) {
        const item = daysMap.get(idx);
        item.ops += toNumber(row.hrs_operacionais_seg);
        item.oci += toNumber(row.hrs_ocioso_seg);
        item.dataStr = row.data; // guarda a data "DD/MM/YYYY"
      }
    });

    return [...daysMap.values()].map(d => ({
      desc_dia: d.desc_dia,
      data_formatada: d.dataStr || d.desc_dia,
      raw_date: d.dataStr, // Chave usada no filtro de clique
      perc_ocioso: d.ops > 0 ? (d.oci / d.ops) * 100 : 0,
      hrs_ocioso: d.oci / 3600
    }));
  }, [rawData, selectedOperators]);

  // 2. Os Operadores reagem ao filtro de Dias (mas NÃO ao filtro de operadores)
  const operatorRows = useMemo(() => {
    const filteredForOps = selectedDays.length > 0
      ? rawData.filter(r => selectedDays.includes(r.data))
      : rawData;

    const map = new Map();
    filteredForOps.forEach((row) => {
      const rawKey = String(row.cod_op || '').trim() || 'SEM OPERADOR';
      const displayMeta = getOperatorDisplayMeta(rawKey);

      if (!map.has(rawKey)) {
        map.set(rawKey, { raw_cod_op: rawKey, label: displayMeta.label, highlight: displayMeta.highlight, ops: 0, oci: 0 });
      }
      const item = map.get(rawKey);
      item.ops += toNumber(row.hrs_operacionais_seg);
      item.oci += toNumber(row.hrs_ocioso_seg);
    });

    return [...map.values()].map((row) => ({
      ...row,
      hrs_operacionais: row.ops / 3600,
      hrs_ocioso: row.oci / 3600,
      perc_ocioso: row.ops > 0 ? (row.oci / row.ops) * 100 : 0,
    })).sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
  }, [rawData, selectedDays]);

  // Garante limpeza de operadores selecionados se eles sumirem do filtro de dia
  useEffect(() => {
    const validOps = new Set(operatorRows.map((r) => r.raw_cod_op));
    setSelectedOperators((prev) => prev.filter((op) => validOps.has(op)));
  }, [operatorRows]);

  // 3. Os Cards e as Operações reagem a AMBOS os filtros
  const activeData = useMemo(() => {
    return rawData.filter(r => {
      const matchOp = selectedOperators.length === 0 || selectedOperators.includes(String(r.cod_op || '').trim());
      const matchDay = selectedDays.length === 0 || selectedDays.includes(r.data);
      return matchOp && matchDay;
    });
  }, [rawData, selectedOperators, selectedDays]);

  // Agregações Finais
  const summary = useMemo(() => {
    let ops = 0, lig = 0, oci = 0, prod = 0, sap = 0, ind = 0;
    activeData.forEach(row => {
      ops += toNumber(row.hrs_operacionais_seg);
      lig += toNumber(row.hrs_motor_ligado_seg);
      oci += toNumber(row.hrs_ocioso_seg);
      
      const gKey = normalizeKey(row.desc_grupo_op);
      const oKey = normalizeKey(row.desc_operacao);

      if (gKey === 'PRODUTIVO') prod += toNumber(row.hrs_operacionais_seg);
      if (gKey === 'SEM APONTAMENTO' || oKey === 'SEM APONTAMENTO') sap += toNumber(row.hrs_operacionais_seg);
      if (gKey === 'INDETERMINADO' || oKey === 'INDETERMINADO') ind += toNumber(row.hrs_operacionais_seg);
    });

    return {
      hrs_operacionais: ops / 3600,
      hrs_motor_ligado: lig / 3600,
      hrs_ocioso: oci / 3600,
      hrs_produtivo: prod / 3600,
      hrs_s_apont: sap / 3600,
      hrs_indeter: ind / 3600,
      perc_ocioso: ops > 0 ? (oci / ops) * 100 : 0,
      perc_s_apont: ops > 0 ? (sap / ops) * 100 : 0,
      perc_indeter: ops > 0 ? (ind / ops) * 100 : 0,
    };
  }, [activeData]);

  const groups = useMemo(() => {
    const groupMap = new Map();
    activeData.forEach((row) => {
      const groupKey = row.desc_grupo_op || 'SEM GRUPO';
      const operationKey = row.desc_operacao || 'SEM OPERAÇÃO';
      const oSeg = toNumber(row.hrs_operacionais_seg);
      const cSeg = toNumber(row.hrs_ocioso_seg);

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { desc_grupo_op: groupKey, ops: 0, oci: 0, operacoesMap: new Map() });
      }
      const g = groupMap.get(groupKey);
      g.ops += oSeg; g.oci += cSeg;

      if (!g.operacoesMap.has(operationKey)) {
        g.operacoesMap.set(operationKey, { desc_operacao: operationKey, ops: 0, oci: 0 });
      }
      const o = g.operacoesMap.get(operationKey);
      o.ops += oSeg; o.oci += cSeg;
    });

    return [...groupMap.values()].map((g) => {
      const prod = isProdutivoGroup(g.desc_grupo_op);
      const operacoes = [...g.operacoesMap.values()].map((op) => ({
        desc_operacao: op.desc_operacao, hrs_operacionais: op.ops / 3600, hrs_ocioso: op.oci / 3600
      })).sort((a, b) => prod ? b.hrs_operacionais - a.hrs_operacionais : b.hrs_ocioso - a.hrs_ocioso);

      return { desc_grupo_op: g.desc_grupo_op, hrs_operacionais: g.ops / 3600, hrs_ocioso: g.oci / 3600, operacoes };
    }).sort((a, b) => {
      const aP = isProdutivoGroup(a.desc_grupo_op); const bP = isProdutivoGroup(b.desc_grupo_op);
      if (aP && !bP) return -1; if (!aP && bP) return 1;
      const aS = isSemApontGroup(a.desc_grupo_op); const bS = isSemApontGroup(b.desc_grupo_op);
      if (aS && !bS) return -1; if (!aS && bS) return 1;
      return b.hrs_ocioso - a.hrs_ocioso;
    });
  }, [activeData]);

  // Handlers
  const handleToggleDay = (rawDate) => {
    if (!rawDate) return;
    setSelectedDays(prev => prev.includes(rawDate) ? prev.filter(d => d !== rawDate) : [...prev, rawDate]);
    setExpandedGroups([]);
  };

  const handleToggleOperator = (opCode) => {
    setSelectedOperators(prev => prev.includes(opCode) ? prev.filter(o => o !== opCode) : [...prev, opCode]);
    setExpandedGroups([]);
  };

  const handleClearFilters = () => {
    setSelectedOperators([]);
    setSelectedDays([]);
    setExpandedGroups([]);
  };

  const metaData = rawData[0] || {};

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative coa-card w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl border border-[var(--coa-divider)]">
        
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] transition-all z-20" style={{ borderColor: COLOR_DIVIDER }}>
          ✕
        </button>

        <div className="coa-card__header pb-4 border-b shrink-0" style={{ borderColor: COLOR_DIVIDER }}>
          <div className="flex flex-col gap-1 pr-10">
            <span className="coa-text-micro">Detalhe Equipamento Semanal</span>
            <h2 className="coa-text-title !mb-0 leading-none">{equipCode || 'SEM CÓDIGO'}</h2>
            <span className="text-sm font-bold text-[var(--coa-text-muted)] truncate">{metaData.desc_equip || 'SEM DESCRIÇÃO'}</span>
            <div className="flex flex-wrap gap-2 pt-2">
              <span className="coa-badge">{metaData.desc_area || 'ÁREA INDISP.'}</span>
              <span className="coa-badge">{metaData.desc_grupo || 'FRENTE INDISP.'}</span>
              <span className="coa-badge">Semana {selectedWeek?.semana}/{selectedWeek?.ano}</span>
            </div>
          </div>
        </div>

        <div className="coa-card__body flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 p-4 md:p-6 custom-scrollbar">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 py-20">
              <div className="coa-loader-dots"><span /><span /><span /></div>
              <span className="coa-loader-text">Coletando apontamentos...</span>
            </div>
          ) : (
            <>
              {/* FILTROS ATIVOS ALERTA */}
              {(selectedOperators.length > 0 || selectedDays.length > 0) && (
                <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[var(--coa-success)] bg-[rgba(61,220,151,0.05)]">
                  <span className="text-xs font-black text-[var(--coa-success)]">Filtros Cruzados Ativos</span>
                  <button type="button" onClick={handleClearFilters} className="text-xs font-black text-[var(--coa-text)] hover:text-[var(--coa-success)] transition-colors">Limpar Tudo</button>
                </div>
              )}

              {/* GRÁFICO DIÁRIO INTERATIVO */}
              <div className="coa-panel p-4 flex flex-col gap-2">
                <div className="flex flex-col">
                  <span className="text-sm font-black text-[var(--coa-text)] uppercase tracking-wide">Evolução Ocioso (SEG-DOM)</span>
                  <span className="text-[10px] text-[var(--coa-text-muted)] font-bold">Clique na barra para filtrar por dia.</span>
                </div>
                <div className="h-[220px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 25, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                      <XAxis dataKey="desc_dia" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} interval={0} />
                      <YAxis hide domain={[0, 'dataMax + 5']} />
                      <RechartsTooltip content={<CustomBarTooltip />} cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }} />
                      <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                      <Bar dataKey="perc_ocioso" radius={[4, 4, 0, 0]} maxBarSize={45} isAnimationActive={false} label={<CustomLabel />}
                        onClick={(data) => handleToggleDay(data.raw_date)}
                        className="cursor-pointer"
                      >
                        {chartData.map((entry, index) => {
                          const isSelected = selectedDays.length === 0 || selectedDays.includes(entry.raw_date);
                          return (
                            <Cell key={`cell-${index}`} fill={getMetaColor(entry.perc_ocioso, 5)} opacity={isSelected ? 1 : 0.25} />
                          );
                        })}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* TABELA DE OPERADORES */}
              <div className="flex flex-col gap-3">
                <span className="coa-text-micro">Operadores</span>
                <div className="coa-panel p-0 overflow-hidden">
                  <div className="grid grid-cols-[1fr_60px_60px_50px] gap-2 px-4 py-3 border-b" style={{ borderColor: COLOR_DIVIDER }}>
                    <span className="coa-text-micro">Operador</span>
                    <span className="coa-text-micro text-right">Total</span>
                    <span className="coa-text-micro text-right">Ocioso</span>
                    <span className="coa-text-micro text-right">%</span>
                  </div>
                  <div className="max-h-[220px] overflow-y-auto custom-scrollbar">
                    {operatorRows.map(row => {
                      const active = selectedOperators.includes(row.raw_cod_op);
                      return (
                        <button key={row.raw_cod_op} type="button" onClick={() => handleToggleOperator(row.raw_cod_op)} className="w-full text-left grid grid-cols-[1fr_60px_60px_50px] gap-2 px-4 py-3 border-b transition-all hover:bg-[rgba(255,255,255,0.02)]" style={{ borderColor: COLOR_DIVIDER, background: active ? 'rgba(61,220,151,0.10)' : 'transparent' }}>
                          <span className="text-[12px] font-black truncate pr-2" style={{ color: row.highlight ? COLOR_DANGER_STRONG : active ? COLOR_TEXT : COLOR_TEXT_SOFT }}>{row.label}</span>
                          <span className="text-[11px] font-black text-right whitespace-nowrap text-[var(--coa-text-soft)]">{formatHHMM(row.hrs_operacionais)}</span>
                          <span className="text-[11px] font-black text-right whitespace-nowrap text-[var(--coa-text-soft)]">{formatHHMM(row.hrs_ocioso)}</span>
                          <span className="text-[11px] font-black text-right whitespace-nowrap" style={{ color: getMetaColor(row.perc_ocioso, 5) }}>{formatPercent(row.perc_ocioso)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* CARDS RESUMO */}
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                <SummaryItem label="Total" value={formatHHMM(summary.hrs_operacionais)} />
                <SummaryItem label="Produtivo" value={formatHHMM(summary.hrs_produtivo)} color={COLOR_SUCCESS} />
                <SummaryItem label="Motor Ligado" value={formatHHMM(summary.hrs_motor_ligado)} />
                <SummaryItem label="Ocioso" value={formatHHMM(summary.hrs_ocioso)} color={getMetaColor(summary.perc_ocioso, 5)} />
                <SummaryItem label="Sem Apont." value={formatHHMM(summary.hrs_s_apont)} color={getMetaColor(summary.perc_s_apont, 2)} />
                <SummaryItem label="Indeterm." value={formatHHMM(summary.hrs_indeter)} color={summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING} />
              </div>

              {/* BARRAS DE PROGRESSO */}
              <div className="coa-panel p-4 flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">Motor Ocioso</span>
                    <span className="text-[12px] font-black" style={{ color: getMetaColor(summary.perc_ocioso, 5) }}>{formatPercent(summary.perc_ocioso)}</span>
                  </div>
                  <AnimatedProgressBar value={summary.perc_ocioso} color={getMetaColor(summary.perc_ocioso, 5)} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">Sem Apontamento</span>
                    <span className="text-[12px] font-black" style={{ color: getMetaColor(summary.perc_s_apont, 2) }}>{formatPercent(summary.perc_s_apont)}</span>
                  </div>
                  <AnimatedProgressBar value={summary.perc_s_apont} color={getMetaColor(summary.perc_s_apont, 2)} />
                </div>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">Indeterminado</span>
                    <span className="text-[12px] font-black" style={{ color: summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING }}>{formatPercent(summary.perc_indeter)}</span>
                  </div>
                  <AnimatedProgressBar value={summary.perc_indeter} color={summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING} />
                </div>
              </div>

              

            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default OciosoDetailSemanalEquip;