import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

const OPERACAO_VIEW_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'cod_equip',
  'desc_grupo_op',
  'desc_operacao',
  'hrs_operacionais_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

const EQUIPE_VIEW_COLUMNS = [
  'data',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

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

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const formatHoursClock = (valueInHours) => {
  const totalSeconds = Math.round(Number(valueInHours || 0) * 3600);
  const safe = Math.max(0, totalSeconds);

  const hh = Math.floor(safe / 3600);
  const mm = Math.floor((safe % 3600) / 60);

  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getMetaColor = (value, maxOk) => {
  return Number(value || 0) <= maxOk ? 'var(--coa-success)' : 'var(--coa-danger)';
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

const SummaryItem = ({ label, value, color }) => (
  <div
    className="flex flex-col justify-end border-b pb-2 min-w-[120px]"
    style={{ borderColor: 'var(--coa-divider)' }}
  >
    <span className="text-[8px] font-black text-[var(--coa-text-muted)] uppercase tracking-widest mb-1">
      {label}
    </span>
    <span
      className="text-[15px] font-black tracking-tight leading-none"
      style={{ color: color || 'var(--coa-text)' }}
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
        borderColor: 'var(--coa-divider)',
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

const getGroupTheme = (groupName) => {
  if (isProdutivoGroup(groupName)) {
    return {
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
    };
  }

  if (isMaintenanceGroup(groupName)) {
    return {
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
    };
  }

  if (isSemApontGroup(groupName)) {
    return {
      cardStyle: {
        borderColor: 'rgba(250,204,21,0.32)',
        background: 'rgba(250,204,21,0.10)',
      },
      detailStyle: {
        borderColor: 'rgba(250,204,21,0.22)',
        background: 'rgba(255,244,184,0.14)',
      },
      groupTextColor: '#facc15',
      totalColor: '#f59e8b',
      opTextColor: '#fca5a5',
      headerLabelColor: 'rgba(250,204,21,0.90)',
      valueLabel: 'Ocioso',
    };
  }

  if (isIndeterminadoGroup(groupName)) {
    return {
      cardStyle: {
        borderColor: 'rgba(250,204,21,0.26)',
        background: 'rgba(250,204,21,0.08)',
      },
      detailStyle: {
        borderColor: 'rgba(250,204,21,0.16)',
        background: 'rgba(255,248,210,0.10)',
      },
      groupTextColor: '#fde68a',
      totalColor: '#fcd34d',
      opTextColor: 'var(--coa-text)',
      headerLabelColor: 'rgba(253,230,138,0.90)',
      valueLabel: 'Ocioso',
    };
  }

  return {
    cardStyle: {
      borderColor: 'rgba(248,113,113,0.18)',
      background: 'rgba(248,113,113,0.035)',
    },
    detailStyle: {
      borderColor: 'var(--coa-divider)',
      background: 'rgba(255,255,255,0.02)',
    },
    groupTextColor: 'var(--coa-text)',
    totalColor: '#fca5a5',
    opTextColor: '#fca5a5',
    headerLabelColor: 'var(--coa-text-muted)',
    valueLabel: 'Ocioso',
  };
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
            {formatHours(groupTotal)}
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
            style={{ borderColor: 'var(--coa-divider)' }}
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
                    {formatHours(opValue)}
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

const OciosoDetailDiarioModal = ({ item, selectedDate, onClose }) => {
  const [equipeRows, setEquipeRows] = useState([]);
  const [operacaoRows, setOperacaoRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadDetails = async () => {
      if (!item?.cod_equip || !selectedDate) return;

      try {
        setLoading(true);
        setExpandedGroups([]);

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
        setEquipeRows(equipeRes.data || []);
        setOperacaoRows(operacaoRes.data || []);
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

  const equipeSummary = useMemo(() => aggregateEquipeRows(equipeRows), [equipeRows]);
  const groups = useMemo(() => buildOperationGroups(operacaoRows), [operacaoRows]);

  const summary = useMemo(() => {
    const hrsOperacionais =
      toNumber(item?.hrs_operacionais) > 0
        ? toNumber(item.hrs_operacionais)
        : equipeSummary.hrs_operacionais;

    const hrsMotorLigado =
      toNumber(item?.hrs_motor_ligado) > 0
        ? toNumber(item.hrs_motor_ligado)
        : equipeSummary.hrs_motor_ligado;

    const hrsOcioso =
      toNumber(item?.hrs_ocioso) > 0
        ? toNumber(item.hrs_ocioso)
        : equipeSummary.hrs_ocioso;

    const percOcioso =
      toNumber(item?.perc_ocioso) > 0
        ? toNumber(item.perc_ocioso)
        : equipeSummary.perc_ocioso;

    let hrsProdutivoSeg = 0;
    let hrsSapontSeg = 0;
    let hrsIndeterSeg = 0;

    operacaoRows.forEach((row) => {
      const hrs = toNumber(row.hrs_operacionais_seg);

      if (isProdutivoGroup(row.desc_grupo_op)) hrsProdutivoSeg += hrs;
      if (isSemApont(row)) hrsSapontSeg += hrs;
      if (isIndeterminado(row)) hrsIndeterSeg += hrs;
    });

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
  }, [item, equipeSummary, operacaoRows]);

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

  const handleToggleGroup = (groupName) => {
    setExpandedGroups((prev) => {
      const exists = prev.includes(groupName);
      if (exists) return prev.filter((item) => item !== groupName);
      return [...prev, groupName];
    });
  };

  if (!item) return null;

  const equipeMeta = equipeRows[0] || {};
  const headerArea = item?.desc_area || equipeMeta?.desc_area || 'SEM ÁREA';
  const headerFrente = item?.desc_grupo || equipeMeta?.desc_grupo || 'SEM FRENTE';
  const headerDate = selectedDate ? isoToBr(selectedDate) : '--/--/----';

  const insightMessages = [];

  if (summary.perc_ocioso > 5 && operationWithMaxOcioso?.hrs_ocioso > 0) {
    insightMessages.push(
      `Operação ${operationWithMaxOcioso.desc_operacao} foi a maior com ${formatHoursClock(operationWithMaxOcioso.hrs_ocioso)} de motor ocioso.`
    );
  }

  if (summary.perc_s_apont > 2 && summary.hrs_s_apont > 0) {
    insightMessages.push(
      `Equipamento com ${formatHoursClock(summary.hrs_s_apont)} sem apontamento.`
    );
  }

  if (summary.perc_indeter > 10 && summary.hrs_indeter > 0) {
    insightMessages.push(
      `Equipamento com ${formatHoursClock(summary.hrs_indeter)} indeterminadas.`
    );
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="relative coa-card w-full max-w-5xl h-[88vh] overflow-hidden">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.04)] border text-[var(--coa-text-soft)] hover:text-[var(--coa-text)] transition-all z-20"
          style={{ borderColor: 'var(--coa-divider)' }}
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
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
                  <SummaryItem label="Total" value={formatHours(summary.hrs_operacionais)} />
                  <SummaryItem
                    label="Produtivo"
                    value={formatHours(summary.hrs_produtivo)}
                    color="var(--coa-success)"
                  />
                  <SummaryItem
                    label="Motor Ligado"
                    value={formatHours(summary.hrs_motor_ligado)}
                  />
                  <SummaryItem
                    label="Ocioso"
                    value={formatHours(summary.hrs_ocioso)}
                    color={getMetaColor(summary.perc_ocioso, 5)}
                  />
                  <SummaryItem
                    label="Sem Apont."
                    value={formatHours(summary.hrs_s_apont)}
                    color={getMetaColor(summary.perc_s_apont, 2)}
                  />
                  <SummaryItem
                    label="Indeterm."
                    value={formatHours(summary.hrs_indeter)}
                    color={getMetaColor(summary.perc_indeter, 10)}
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
                        style={{ color: getMetaColor(summary.perc_indeter, 10) }}
                      >
                        {formatPercent(summary.perc_indeter)}
                      </span>
                    </div>
                    <AnimatedProgressBar
                      value={summary.perc_indeter}
                      color={getMetaColor(summary.perc_indeter, 10)}
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

                <div className="coa-panel p-4 flex flex-col gap-3">
                  <span className="coa-text-micro">Análise do Equipamento</span>

                  {insightMessages.length === 0 ? (
                    <div className="text-sm font-bold text-[var(--coa-text-soft)]">
                      Equipamento dentro dos parâmetros esperados para os indicadores monitorados.
                    </div>
                  ) : (
                    insightMessages.map((message, idx) => (
                      <div key={idx} className="text-sm font-bold text-[var(--coa-text)]">
                        • {message}
                      </div>
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