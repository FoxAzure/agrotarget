import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

/* ==========================================================================
   CONFIG VISUAL
   ========================================================================== */

const COLOR_SUCCESS = 'var(--coa-success)';
const COLOR_WARNING = '#facc15';
const COLOR_DANGER = '#ef4444';
const COLOR_DANGER_STRONG = '#ff4d4f';
const COLOR_DANGER_TEXT = '#ff6b6b';
const COLOR_GRAY_LIGHT = '#d1d5db';
const COLOR_PANEL_BG = 'rgba(255,255,255,0.02)';
const COLOR_DIVIDER = 'var(--coa-divider)';
const COLOR_TEXT = 'var(--coa-text)';
const COLOR_TEXT_SOFT = 'var(--coa-text-soft)';
const COLOR_TEXT_MUTED = 'var(--coa-text-muted)';

const GROUP_THEME_CONFIG = {
  produtivo: {
    cardStyle: {
      borderColor: 'rgba(61,220,151,0.24)',
      background: 'rgba(61,220,151,0.05)',
    },
    detailStyle: {
      borderColor: 'rgba(61,220,151,0.16)',
      background: 'rgba(61,220,151,0.03)',
    },
    groupTextColor: 'var(--coa-success)',
    totalColor: 'var(--coa-success)',
    opTextColor: 'var(--coa-success)',
    headerLabelColor: 'rgba(61,220,151,0.78)',
    valueLabel: 'Total',
  },

  manutencao: {
    cardStyle: {
      borderColor: 'rgba(168,85,247,0.30)',
      background: 'rgba(168,85,247,0.07)',
    },
    detailStyle: {
      borderColor: 'rgba(168,85,247,0.18)',
      background: 'rgba(168,85,247,0.05)',
    },
    groupTextColor: '#d8b4fe',
    totalColor: '#c084fc',
    opTextColor: '#e9d5ff',
    headerLabelColor: 'rgba(216,180,254,0.85)',
    valueLabel: 'Ocioso',
  },

  sem_apontamento: {
    cardStyle: {
      borderColor: 'rgba(239,68,68,0.36)',
      background: 'rgba(239,68,68,0.10)',
    },
    detailStyle: {
      borderColor: 'rgba(239,68,68,0.22)',
      background: 'rgba(239,68,68,0.08)',
    },
    groupTextColor: COLOR_DANGER_STRONG,
    totalColor: COLOR_DANGER_STRONG,
    opTextColor: '#ff8b8b',
    headerLabelColor: 'rgba(255,107,107,0.92)',
    valueLabel: 'Ocioso',
  },

  indeterminado: {
    cardStyle: {
      borderColor: 'rgba(209,213,219,0.30)',
      background: 'rgba(209,213,219,0.07)',
    },
    detailStyle: {
      borderColor: 'rgba(209,213,219,0.20)',
      background: 'rgba(209,213,219,0.05)',
    },
    groupTextColor: COLOR_DANGER_STRONG,
    totalColor: COLOR_DANGER_STRONG,
    opTextColor: COLOR_DANGER_TEXT,
    headerLabelColor: 'rgba(255,107,107,0.92)',
    valueLabel: 'Ocioso',
  },

  default: {
    cardStyle: {
      borderColor: 'rgba(239,68,68,0.26)',
      background: 'rgba(239,68,68,0.06)',
    },
    detailStyle: {
      borderColor: 'rgba(239,68,68,0.16)',
      background: 'rgba(239,68,68,0.05)',
    },
    groupTextColor: COLOR_DANGER_STRONG,
    totalColor: COLOR_DANGER_STRONG,
    opTextColor: '#ff9a9a',
    headerLabelColor: 'rgba(255,107,107,0.88)',
    valueLabel: 'Ocioso',
  },
};

const ANALYSIS_TEXT_THEME = {
  good: {
    color: '#7ae3b5',
  },
  bad: {
    color: '#ff7d7d',
  },
  warning: {
    color: '#f6d66d',
  },
};

/* ==========================================================================
   REGRAS DE EXIBIÇÃO DOS OPERADORES
   - fácil de incluir novas regras depois
   ========================================================================== */

const normalizeOperatorRuleKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const OPERATOR_DISPLAY_RULES = [
  {
    test: (rawValue) => normalizeOperatorRuleKey(rawValue) === '9999 - - -',
    label: 'NÃO DISPONÍVEL',
    highlight: true,
  },
  {
    test: (rawValue) => normalizeOperatorRuleKey(rawValue) === '9999 -',
    label: 'NÃO DISPONÍVEL',
    highlight: true,
  },
  {
    test: (rawValue) => normalizeOperatorRuleKey(rawValue) === '-',
    label: 'NÃO DISPONÍVEL',
    highlight: true,
  },
  {
    test: (rawValue) =>
      normalizeOperatorRuleKey(rawValue) === '99999 - EQUIPE MONITORAMENTO',
    label: 'EQUIPE MONITORAMENTO',
    highlight: true,
  },
];

/* ==========================================================================
   QUERIES / COLUNAS
   ========================================================================== */

const OPERACAO_VIEW_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'cod_equip',
  'cod_op',
  'desc_area',
  'desc_grupo',
  'desc_grupo_op',
  'desc_operacao',
  'hrs_operacionais_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

const EQUIPE_VIEW_COLUMNS = [
  'data',
  'cod_equip',
  'cod_op',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

/* ==========================================================================
   HELPERS
   ========================================================================== */

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string') return '';
  if (isoDate.includes('/')) return isoDate;
  if (!isoDate.includes('-')) return '';

  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
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

const getMetaColor = (value, maxOk) => {
  return Number(value || 0) <= maxOk ? COLOR_SUCCESS : COLOR_DANGER_STRONG;
};

const normalizeKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const isProdutivoGroup = (groupName) => normalizeKey(groupName) === 'PRODUTIVO';
const isMaintenanceGroup = (groupName) => normalizeKey(groupName) === 'MANUTENCAO';
const isSemApontGroup = (groupName) => normalizeKey(groupName) === 'SEM APONTAMENTO';
const isIndeterminadoGroup = (groupName) => normalizeKey(groupName) === 'INDETERMINADO';

const isSemApont = (row) => {
  const grupo = normalizeKey(row.desc_grupo_op);
  const operacao = normalizeKey(row.desc_operacao);
  return grupo === 'SEM APONTAMENTO' || operacao === 'SEM APONTAMENTO';
};

const isIndeterminado = (row) => {
  const grupo = normalizeKey(row.desc_grupo_op);
  const operacao = normalizeKey(row.desc_operacao);
  return grupo === 'INDETERMINADO' || operacao === 'INDETERMINADO';
};

const normalizeEquipeDbRow = (row = {}) => ({
  ...row,
  cod_op: String(row.cod_op || '').trim(),
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
});

const normalizeOperacaoDbRow = (row = {}) => ({
  ...row,
  cod_op: String(row.cod_op || '').trim(),
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
});

const getOperatorDisplayMeta = (rawOperatorValue) => {
  const raw = String(rawOperatorValue || '').trim();

  for (const rule of OPERATOR_DISPLAY_RULES) {
    if (rule.test(raw)) {
      return {
        raw,
        label: rule.label,
        highlight: !!rule.highlight,
      };
    }
  }

  const parts = raw.split(' - ');
  const namePart =
    parts.length >= 2
      ? parts.slice(1).join(' - ').trim()
      : raw;

  if (!namePart) {
    return {
      raw,
      label: 'NÃO DISPONÍVEL',
      highlight: true,
    };
  }

  const words = namePart.split(/\s+/).filter(Boolean);

  if (words.length === 0) {
    return {
      raw,
      label: 'NÃO DISPONÍVEL',
      highlight: true,
    };
  }

  if (words.length === 1) {
    return {
      raw,
      label: words[0],
      highlight: false,
    };
  }

  if (words.length === 2) {
    return {
      raw,
      label: `${words[0]} ${words[1]}`,
      highlight: false,
    };
  }

  const secondWord = words[1] || '';
  if (secondWord.length < 4 && words[2]) {
    return {
      raw,
      label: `${words[0]} ${words[1]} ${words[2]}`,
      highlight: false,
    };
  }

  return {
    raw,
    label: `${words[0]} ${words[1]}`,
    highlight: false,
  };
};

/* ==========================================================================
   COMPONENTES AUXILIARES
   ========================================================================== */

const SummaryItem = ({ label, value, color }) => (
  <div
    className="flex flex-col justify-end border-b pb-2 min-w-[120px]"
    style={{ borderColor: COLOR_DIVIDER }}
  >
    <span className="text-[8px] font-black text-[var(--coa-text-muted)] uppercase tracking-widest mb-1">
      {label}
    </span>
    <span
      className="text-[15px] font-black tracking-tight leading-none"
      style={{ color: color || COLOR_TEXT }}
    >
      {value}
    </span>
  </div>
);

const AnimatedProgressBar = ({ value, color }) => {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setWidth(Number(value || 0)), 120);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div
      className="w-full h-2 rounded-full overflow-hidden border"
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderColor: COLOR_DIVIDER,
      }}
    >
      <div
        className="h-full rounded-full transition-all duration-[1200ms] ease-out"
        style={{
          width: `${Math.min(Math.max(width, 0), 100)}%`,
          backgroundColor: color,
          boxShadow: width > 0 ? `0 0 8px ${color}60` : 'none',
        }}
      />
    </div>
  );
};

const OperatorTable = ({
  rows = [],
  selectedOperators = [],
  onToggleOperator,
  onClear,
}) => {
  const selectedSet = new Set(selectedOperators);

  return (
    <div className="coa-panel p-0 overflow-hidden">
      <div
        className="grid grid-cols-[1fr_68px_68px_58px] gap-2 px-4 py-3 border-b"
        style={{ borderColor: COLOR_DIVIDER }}
      >
        <span className="coa-text-micro">Operador</span>
        <span className="coa-text-micro text-right">Total</span>
        <span className="coa-text-micro text-right">Ocioso</span>
        <span className="coa-text-micro text-right">%</span>
      </div>

      <div className="max-h-[220px] overflow-y-auto">
        {rows.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhum operador encontrado para este equipamento.
          </div>
        ) : (
          rows.map((row) => {
            const active = selectedSet.has(row.raw_cod_op);

            return (
              <button
                key={row.raw_cod_op}
                type="button"
                onClick={() => onToggleOperator(row.raw_cod_op)}
                className="w-full text-left grid grid-cols-[1fr_68px_68px_58px] gap-2 px-4 py-3 border-b transition-all"
                style={{
                  borderColor: COLOR_DIVIDER,
                  background: active ? 'rgba(61,220,151,0.10)' : 'transparent',
                }}
              >
                <span
                  className="text-[12px] font-black truncate pr-2"
                  style={{
                    color: row.highlight
                      ? COLOR_DANGER_STRONG
                      : active
                      ? COLOR_TEXT
                      : COLOR_TEXT_SOFT,
                  }}
                  title={row.label}
                >
                  {row.label}
                </span>

                <span className="text-[11px] font-black text-right whitespace-nowrap text-[var(--coa-text-soft)]">
                  {formatHHMM(row.hrs_operacionais)}
                </span>

                <span className="text-[11px] font-black text-right whitespace-nowrap text-[var(--coa-text-soft)]">
                  {formatHHMM(row.hrs_ocioso)}
                </span>

                <span
                  className="text-[11px] font-black text-right whitespace-nowrap"
                  style={{ color: getMetaColor(row.perc_ocioso, 5) }}
                >
                  {formatPercent(row.perc_ocioso)}
                </span>
              </button>
            );
          })
        )}
      </div>

      {rows.length > 0 && (
        <div
          className="flex items-center justify-between gap-3 px-4 py-2 border-t"
          style={{ borderColor: COLOR_DIVIDER, background: 'rgba(255,255,255,0.015)' }}
        >
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
            Clique para filtrar
          </span>

          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-black transition-colors"
            style={{ color: COLOR_SUCCESS }}
          >
            Limpar seleção
          </button>
        </div>
      )}
    </div>
  );
};

const AnalysisListItem = ({ text, type = 'good' }) => {
  const theme = ANALYSIS_TEXT_THEME[type] || ANALYSIS_TEXT_THEME.good;

  return (
    <div
      className="text-sm font-bold leading-relaxed"
      style={{ color: theme.color }}
    >
      • {text}
    </div>
  );
};

const getGroupTheme = (groupName) => {
  if (isProdutivoGroup(groupName)) return GROUP_THEME_CONFIG.produtivo;
  if (isMaintenanceGroup(groupName)) return GROUP_THEME_CONFIG.manutencao;
  if (isSemApontGroup(groupName)) return GROUP_THEME_CONFIG.sem_apontamento;
  if (isIndeterminadoGroup(groupName)) return GROUP_THEME_CONFIG.indeterminado;
  return GROUP_THEME_CONFIG.default;
};

const GroupAccordion = ({ group, expanded, onToggle }) => {
  const productive = isProdutivoGroup(group.desc_grupo_op);
  const theme = getGroupTheme(group.desc_grupo_op);

  const groupTotal = productive ? group.hrs_operacionais : group.hrs_ocioso;
  const secondColLabel = productive ? 'Total' : 'Ocioso';

  return (
    <div className="coa-panel p-0 overflow-hidden" style={theme.cardStyle}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 transition-all"
      >
        <div className="grid grid-cols-[minmax(0,1fr)_96px_24px] items-center gap-3">
          <div className="min-w-0">
            <span
              className="text-[13px] font-black truncate block tracking-[0.02em]"
              style={{ color: theme.groupTextColor }}
              title={group.desc_grupo_op}
            >
              {group.desc_grupo_op}
            </span>
          </div>

          <span
            className="text-[11px] font-black text-right whitespace-nowrap"
            style={{ color: theme.totalColor }}
          >
            {formatHHMM(groupTotal)}
          </span>

          <span className="text-[12px] font-black text-right text-[var(--coa-text-muted)]">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3" style={theme.detailStyle}>
          <div
            className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 pb-2 border-b"
            style={{ borderColor: COLOR_DIVIDER }}
          >
            <span className="coa-text-micro" style={{ color: theme.headerLabelColor }}>
              Operação
            </span>
            <span
              className="coa-text-micro text-right"
              style={{ color: theme.headerLabelColor }}
            >
              {secondColLabel}
            </span>
          </div>

          <div className="flex flex-col gap-1 pt-2">
            {group.operacoes.map((op, idx) => {
              const opValue = productive ? op.hrs_operacionais : op.hrs_ocioso;

              return (
                <div
                  key={`${group.desc_grupo_op}-${op.desc_operacao}-${idx}`}
                  className="grid grid-cols-[minmax(0,1fr)_96px] gap-3 py-1.5"
                >
                  <span
                    className="text-[12px] font-bold truncate pr-2"
                    style={{ color: theme.opTextColor }}
                    title={op.desc_operacao}
                  >
                    {op.desc_operacao}
                  </span>

                  <span
                    className="text-[12px] font-black text-right whitespace-nowrap"
                    style={{ color: theme.totalColor }}
                  >
                    {formatHHMM(opValue)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ==========================================================================
   AGREGAÇÕES
   ========================================================================== */

const aggregateEquipeRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
      acc.hrs_motor_ligado_seg += toNumber(row.hrs_motor_ligado_seg);
      acc.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
      return acc;
    },
    {
      hrs_operacionais_seg: 0,
      hrs_motor_ligado_seg: 0,
      hrs_ocioso_seg: 0,
    }
  );

  return {
    hrs_operacionais: total.hrs_operacionais_seg / 3600,
    hrs_motor_ligado: total.hrs_motor_ligado_seg / 3600,
    hrs_ocioso: total.hrs_ocioso_seg / 3600,
    perc_ocioso:
      total.hrs_operacionais_seg > 0
        ? (total.hrs_ocioso_seg / total.hrs_operacionais_seg) * 100
        : 0,
  };
};

const buildOperatorRows = (rows = []) => {
  const map = new Map();

  rows.forEach((row) => {
    const rawKey = String(row.cod_op || '').trim() || 'SEM OPERADOR';
    const displayMeta = getOperatorDisplayMeta(rawKey);

    if (!map.has(rawKey)) {
      map.set(rawKey, {
        raw_cod_op: rawKey,
        label: displayMeta.label,
        highlight: displayMeta.highlight,
        hrs_operacionais_seg: 0,
        hrs_ocioso_seg: 0,
      });
    }

    const item = map.get(rawKey);
    item.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
    item.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
  });

  return [...map.values()]
    .map((row) => ({
      raw_cod_op: row.raw_cod_op,
      label: row.label,
      highlight: row.highlight,
      hrs_operacionais: row.hrs_operacionais_seg / 3600,
      hrs_ocioso: row.hrs_ocioso_seg / 3600,
      perc_ocioso:
        row.hrs_operacionais_seg > 0
          ? (row.hrs_ocioso_seg / row.hrs_operacionais_seg) * 100
          : 0,
    }))
    .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
};

const buildOperationGroups = (rows = []) => {
  const groupMap = new Map();

  rows.forEach((row) => {
    const groupKey = row.desc_grupo_op || 'SEM GRUPO';
    const operationKey = row.desc_operacao || 'SEM OPERAÇÃO';
    const hrsOperacionaisSeg = toNumber(row.hrs_operacionais_seg);
    const hrsOciosoSeg = toNumber(row.hrs_ocioso_seg);

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        desc_grupo_op: groupKey,
        hrs_operacionais_seg: 0,
        hrs_ocioso_seg: 0,
        operacoesMap: new Map(),
      });
    }

    const group = groupMap.get(groupKey);
    group.hrs_operacionais_seg += hrsOperacionaisSeg;
    group.hrs_ocioso_seg += hrsOciosoSeg;

    if (!group.operacoesMap.has(operationKey)) {
      group.operacoesMap.set(operationKey, {
        desc_operacao: operationKey,
        hrs_operacionais_seg: 0,
        hrs_ocioso_seg: 0,
      });
    }

    const operation = group.operacoesMap.get(operationKey);
    operation.hrs_operacionais_seg += hrsOperacionaisSeg;
    operation.hrs_ocioso_seg += hrsOciosoSeg;
  });

  return [...groupMap.values()]
    .map((group) => {
      const productive = isProdutivoGroup(group.desc_grupo_op);

      const operacoes = [...group.operacoesMap.values()]
        .map((op) => ({
          desc_operacao: op.desc_operacao,
          hrs_operacionais: op.hrs_operacionais_seg / 3600,
          hrs_ocioso: op.hrs_ocioso_seg / 3600,
        }))
        .sort((a, b) => {
          if (productive) return b.hrs_operacionais - a.hrs_operacionais;
          return b.hrs_ocioso - a.hrs_ocioso;
        });

      return {
        desc_grupo_op: group.desc_grupo_op,
        hrs_operacionais: group.hrs_operacionais_seg / 3600,
        hrs_ocioso: group.hrs_ocioso_seg / 3600,
        operacoes,
      };
    })
    .sort((a, b) => {
      const aProd = isProdutivoGroup(a.desc_grupo_op);
      const bProd = isProdutivoGroup(b.desc_grupo_op);

      if (aProd && !bProd) return -1;
      if (!aProd && bProd) return 1;

      const aSemApont = isSemApontGroup(a.desc_grupo_op);
      const bSemApont = isSemApontGroup(b.desc_grupo_op);
      if (aSemApont && !bSemApont) return -1;
      if (!aSemApont && bSemApont) return 1;

      return b.hrs_ocioso - a.hrs_ocioso;
    });
};

/* ==========================================================================
   COMPONENTE PRINCIPAL
   ========================================================================== */

const OciosoDetailDiarioModal = ({ item, selectedDate, onClose }) => {
  const [equipeRows, setEquipeRows] = useState([]);
  const [operacaoRows, setOperacaoRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState([]);
  const [selectedOperators, setSelectedOperators] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!item?.cod_equip || !selectedDate) return;

      try {
        setLoading(true);
        setExpandedGroups([]);
        setSelectedOperators([]);

        const codigoEquip = String(item.cod_equip || '').trim();
        const selectedBrDate = isoToBr(selectedDate);

        const [equipeRes, operacaoRes] = await Promise.all([
          supabase
            .from('vw_c_ociosoequipe')
            .select(EQUIPE_VIEW_COLUMNS)
            .eq('data', selectedBrDate)
            .eq('cod_equip', codigoEquip),
          supabase
            .from('vw_c_ociosooperacao')
            .select(OPERACAO_VIEW_COLUMNS)
            .eq('data', selectedBrDate)
            .eq('cod_equip', codigoEquip),
        ]);

        if (equipeRes.error) throw equipeRes.error;
        if (operacaoRes.error) throw operacaoRes.error;

        if (!mounted) return;

        setEquipeRows((equipeRes.data || []).map(normalizeEquipeDbRow));
        setOperacaoRows((operacaoRes.data || []).map(normalizeOperacaoDbRow));
      } catch (err) {
        console.error('[COA][Modal] Erro ao carregar detalhe do equipamento:', err);
        if (!mounted) return;
        setEquipeRows([]);
        setOperacaoRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadDetails();

    return () => {
      mounted = false;
    };
  }, [item, selectedDate]);

  const operatorRows = useMemo(() => buildOperatorRows(equipeRows), [equipeRows]);

  useEffect(() => {
    const validOps = new Set(operatorRows.map((row) => row.raw_cod_op));
    setSelectedOperators((prev) => prev.filter((op) => validOps.has(op)));
  }, [operatorRows]);

  const useOperatorFilter = useMemo(() => {
    return selectedOperators.length > 0 && selectedOperators.length < operatorRows.length;
  }, [selectedOperators, operatorRows]);

  const filteredEquipeRows = useMemo(() => {
    if (!useOperatorFilter) return equipeRows;
    return equipeRows.filter((row) =>
      selectedOperators.includes(String(row.cod_op || '').trim() || 'SEM OPERADOR')
    );
  }, [equipeRows, selectedOperators, useOperatorFilter]);

  const filteredOperacaoRows = useMemo(() => {
    if (!useOperatorFilter) return operacaoRows;
    return operacaoRows.filter((row) =>
      selectedOperators.includes(String(row.cod_op || '').trim() || 'SEM OPERADOR')
    );
  }, [operacaoRows, selectedOperators, useOperatorFilter]);

  const equipeSummary = useMemo(() => aggregateEquipeRows(filteredEquipeRows), [filteredEquipeRows]);
  const groups = useMemo(() => buildOperationGroups(filteredOperacaoRows), [filteredOperacaoRows]);

  const operatorFilterLabel = useMemo(() => {
    if (!operatorRows.length) return 'Todos Operadores';

    if (!selectedOperators.length || selectedOperators.length === operatorRows.length) {
      return 'Todos Operadores';
    }

    if (selectedOperators.length === 1) {
      const found = operatorRows.find((row) => row.raw_cod_op === selectedOperators[0]);
      return found?.label || 'Operador Selecionado';
    }

    return 'Mais de um selecionado';
  }, [selectedOperators, operatorRows]);

  const summary = useMemo(() => {
    let hrsProdutivoSeg = 0;
    let hrsSapontSeg = 0;
    let hrsIndeterSeg = 0;

    filteredOperacaoRows.forEach((row) => {
      const hrs = toNumber(row.hrs_operacionais_seg);

      if (isProdutivoGroup(row.desc_grupo_op)) hrsProdutivoSeg += hrs;
      if (isSemApont(row)) hrsSapontSeg += hrs;
      if (isIndeterminado(row)) hrsIndeterSeg += hrs;
    });

    const hrsOperacionais = equipeSummary.hrs_operacionais;
    const hrsMotorLigado = equipeSummary.hrs_motor_ligado;
    const hrsOcioso = equipeSummary.hrs_ocioso;
    const percOcioso = equipeSummary.perc_ocioso;

    const hrsProdutivo = hrsProdutivoSeg / 3600;
    const hrsSapont = hrsSapontSeg / 3600;
    const hrsIndeter = hrsIndeterSeg / 3600;

    return {
      hrs_operacionais: hrsOperacionais,
      hrs_motor_ligado: hrsMotorLigado,
      hrs_ocioso: hrsOcioso,
      hrs_produtivo: hrsProdutivo,
      hrs_s_apont: hrsSapont,
      hrs_indeter: hrsIndeter,
      perc_ocioso: percOcioso,
      perc_s_apont: hrsOperacionais > 0 ? (hrsSapont / hrsOperacionais) * 100 : 0,
      perc_indeter: hrsOperacionais > 0 ? (hrsIndeter / hrsOperacionais) * 100 : 0,
    };
  }, [equipeSummary, filteredOperacaoRows]);

  const operationWithMaxOcioso = useMemo(() => {
    return (
      groups
        .filter((group) => !isProdutivoGroup(group.desc_grupo_op))
        .flatMap((group) =>
          group.operacoes.map((op) => ({
            desc_grupo_op: group.desc_grupo_op,
            desc_operacao: op.desc_operacao,
            hrs_ocioso: op.hrs_ocioso,
          }))
        )
        .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso)[0] || null
    );
  }, [groups]);

  const analysisItems = useMemo(() => {
    const items = [];

    if (summary.perc_s_apont < 2) {
      items.push({ type: 'good', text: 'Sem Apontamento Ok.' });
    } else if (summary.hrs_s_apont > 0) {
      items.push({
        type: 'bad',
        text: `Total de ${formatHHMM(summary.hrs_s_apont)} sem apontamento.`,
      });
    }

    if (summary.perc_indeter < 10) {
      items.push({ type: 'good', text: 'Indeterminado Ok.' });
    } else if (summary.hrs_indeter > 0) {
      items.push({
        type: 'warning',
        text: `Total de ${formatHHMM(summary.hrs_indeter)} indeterminadas, aguardando novos dados para recálculo do equipamento.`,
      });
    }

    if (summary.perc_ocioso <= 5) {
      items.push({ type: 'good', text: 'Motor Ocioso Ok.' });
    } else if (operationWithMaxOcioso?.hrs_ocioso > 0) {
      items.push({
        type: 'bad',
        text: `Operação ${operationWithMaxOcioso.desc_operacao} foi a maior com ${formatHHMM(operationWithMaxOcioso.hrs_ocioso)} de motor ocioso.`,
      });
    }

    return items;
  }, [summary, operationWithMaxOcioso]);

  const handleToggleGroup = (groupName) => {
    setExpandedGroups((prev) => {
      const exists = prev.includes(groupName);
      if (exists) return prev.filter((item) => item !== groupName);
      return [...prev, groupName];
    });
  };

  const handleToggleOperator = (operatorRawCode) => {
    setExpandedGroups([]);
    setSelectedOperators((prev) => {
      const exists = prev.includes(operatorRawCode);
      if (exists) return prev.filter((item) => item !== operatorRawCode);
      return [...prev, operatorRawCode];
    });
  };

  const handleClearOperators = () => {
    setExpandedGroups([]);
    setSelectedOperators([]);
  };

  if (!item) return null;

  const equipeMeta = filteredEquipeRows[0] || equipeRows[0] || {};
  const headerArea = item?.desc_area || equipeMeta?.desc_area || 'SEM ÁREA';
  const headerFrente = item?.desc_grupo || equipeMeta?.desc_grupo || 'SEM FRENTE';
  const headerDate = selectedDate ? isoToBr(selectedDate) : '--/--/----';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative coa-card w-full max-w-5xl h-[88vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] transition-all z-20"
          style={{ borderColor: COLOR_DIVIDER }}
        >
          ✕
        </button>

        <div className="h-full flex flex-col min-h-0">
          <div className="coa-card__header">
            <div className="flex flex-col gap-2 pr-10">
              <span className="coa-text-micro">Equipamento</span>

              <div className="flex flex-col gap-1">
                <h2 className="coa-text-title !mb-0">{item.cod_equip || 'SEM CÓDIGO'}</h2>
                <span className="text-sm font-bold text-[var(--coa-text-muted)]">
                  {item.desc_equip || equipeMeta?.desc_equip || 'SEM DESCRIÇÃO'}
                </span>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <span className="coa-badge">{headerArea}</span>
                <span className="coa-badge">{headerFrente}</span>
                <span className="coa-badge">{headerDate}</span>
              </div>
            </div>
          </div>

          <div className="coa-card__body flex-1 min-h-0 overflow-y-auto flex flex-col gap-5">
            {loading ? (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <div className="coa-loader-dots" aria-label="Carregando">
                  <span />
                  <span />
                  <span />
                </div>
                <span className="coa-loader-text">Carregando detalhe do equipamento...</span>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-3">
                  <span className="coa-text-micro">Operadores</span>

                  <OperatorTable
                    rows={operatorRows}
                    selectedOperators={selectedOperators}
                    onToggleOperator={handleToggleOperator}
                    onClear={handleClearOperators}
                  />

                  <div
                    className="rounded-[14px] border px-4 py-3 text-sm font-black"
                    style={{
                      borderColor: COLOR_DIVIDER,
                      background: COLOR_PANEL_BG,
                      color: selectedOperators.length ? COLOR_TEXT : COLOR_TEXT_SOFT,
                    }}
                  >
                    {operatorFilterLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <SummaryItem label="Total" value={formatHHMM(summary.hrs_operacionais)} />
                  <SummaryItem
                    label="Produtivo"
                    value={formatHHMM(summary.hrs_produtivo)}
                    color={COLOR_SUCCESS}
                  />
                  <SummaryItem
                    label="Motor Ligado"
                    value={formatHHMM(summary.hrs_motor_ligado)}
                  />
                  <SummaryItem
                    label="Ocioso"
                    value={formatHHMM(summary.hrs_ocioso)}
                    color={getMetaColor(summary.perc_ocioso, 5)}
                  />
                  <SummaryItem
                    label="Sem Apont."
                    value={formatHHMM(summary.hrs_s_apont)}
                    color={getMetaColor(summary.perc_s_apont, 2)}
                  />
                  <SummaryItem
                    label="Indeterm."
                    value={formatHHMM(summary.hrs_indeter)}
                    color={summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING}
                  />
                </div>

                <div className="coa-panel p-4 flex flex-col gap-4">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        Motor Ocioso
                      </span>
                      <span
                        className="text-[12px] font-black"
                        style={{ color: getMetaColor(summary.perc_ocioso, 5) }}
                      >
                        {formatPercent(summary.perc_ocioso)}
                      </span>
                    </div>
                    <AnimatedProgressBar
                      value={summary.perc_ocioso}
                      color={getMetaColor(summary.perc_ocioso, 5)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        Sem Apontamento
                      </span>
                      <span
                        className="text-[12px] font-black"
                        style={{ color: getMetaColor(summary.perc_s_apont, 2) }}
                      >
                        {formatPercent(summary.perc_s_apont)}
                      </span>
                    </div>
                    <AnimatedProgressBar
                      value={summary.perc_s_apont}
                      color={getMetaColor(summary.perc_s_apont, 2)}
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        Indeterminado
                      </span>
                      <span
                        className="text-[12px] font-black"
                        style={{ color: summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING }}
                      >
                        {formatPercent(summary.perc_indeter)}
                      </span>
                    </div>
                    <AnimatedProgressBar
                      value={summary.perc_indeter}
                      color={summary.perc_indeter < 10 ? COLOR_SUCCESS : COLOR_WARNING}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <span className="coa-text-micro">Operações</span>

                  {groups.length === 0 ? (
                    <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)]">
                      Nenhuma operação encontrada.
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {groups.map((group) => (
                        <GroupAccordion
                          key={group.desc_grupo_op}
                          group={group}
                          expanded={expandedGroups.includes(group.desc_grupo_op)}
                          onToggle={() => handleToggleGroup(group.desc_grupo_op)}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2 pt-1">
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                    Análise do Equipamento
                  </span>

                  {analysisItems.length === 0 ? (
                    <div className="text-sm font-bold text-[var(--coa-text-soft)]">
                      Equipamento sem dados suficientes para análise.
                    </div>
                  ) : (
                    analysisItems.map((itemAnalysis, idx) => (
                      <AnalysisListItem
                        key={`${itemAnalysis.type}-${idx}`}
                        text={itemAnalysis.text}
                        type={itemAnalysis.type}
                      />
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OciosoDetailDiarioModal;