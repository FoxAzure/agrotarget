// ================= DOCUMENTATION ------------------------------------------
// Script: OciosoDetailDiario
// Purpose: Visão detalhada do Ocioso Diário com hierarquia de Frota e barra de % Indeterminado.
// Relationships: vw_c_ociosogeral, vw_c_ociosoequipe, tb_c_geral (consulta otimizada)
// ==========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import OciosoDetailDiarioModal from './OciosoDetailDiarioModal';

// Colunas restauradas para o formato original da view (sem quebrar o banco)
const OCIOSO_COLUMNS = [
  'data',
  'semana',
  'mes',
  'ano',
  'desc_area',
  'categoria',
  'qnt_equip',
  'hrs_total_seg',
  'hrs_motor_ligado_seg',
  'hrs_efetivo_seg',
  'hrs_ocioso_seg',
  'hrs_total',
  'hrs_motor_ligado',
  'hrs_efetivo',
  'hrs_ocioso',
  'perc_ocioso',
].join(',');

const OCIOSO_EQUIPE_COLUMNS = [
  'data',
  'semana_iso',
  'mes',
  'ano',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'cod_op',
  'hrs_operacionais_seg',
  'hrs_disp_seg',
  'hrs_motor_ligado_seg',
  'hrs_ocioso_seg',
].join(',');

const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string' || !isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeAreaRow = (row = {}) => ({
  ...row,
  semana: toNumber(row.semana),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  qnt_equip: toNumber(row.qnt_equip),
  hrs_total_seg: toNumber(row.hrs_total_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_efetivo_seg: toNumber(row.hrs_efetivo_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
  hrs_total: toNumber(row.hrs_total),
  hrs_motor_ligado: toNumber(row.hrs_motor_ligado),
  hrs_efetivo: toNumber(row.hrs_efetivo),
  hrs_ocioso: toNumber(row.hrs_ocioso),
  perc_ocioso: toNumber(row.perc_ocioso),
});

const normalizeEquipeRow = (row = {}) => ({
  ...row,
  semana_iso: toNumber(row.semana_iso),
  mes: toNumber(row.mes),
  ano: toNumber(row.ano),
  hrs_operacionais_seg: toNumber(row.hrs_operacionais_seg),
  hrs_disp_seg: toNumber(row.hrs_disp_seg),
  hrs_motor_ligado_seg: toNumber(row.hrs_motor_ligado_seg),
  hrs_ocioso_seg: toNumber(row.hrs_ocioso_seg),
});

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const getOciosoColor = (value) => {
  const safe = Number(value || 0);
  return safe <= 5 ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getOciosoTint = (value, alpha = 0.10) => {
  const safe = Number(value || 0);
  return safe <= 5
    ? `rgba(61,220,151,${alpha})`
    : `rgba(239,68,68,${alpha})`;
};

const aggregateSummaryRows = (rows = []) => {
  const acc = rows.reduce(
    (sum, row) => {
      sum.qnt_equip += toNumber(row.qnt_equip);
      sum.hrs_total += toNumber(row.hrs_total);
      sum.hrs_motor_ligado += toNumber(row.hrs_motor_ligado);
      sum.hrs_efetivo += toNumber(row.hrs_efetivo);
      sum.hrs_ocioso += toNumber(row.hrs_ocioso);
      sum.hrs_total_seg += toNumber(row.hrs_total_seg);
      sum.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
      
      // Agregando os valores anexados em memória
      sum.indeter_seg += toNumber(row.indeter_seg);
      sum.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
      
      return sum;
    },
    {
      qnt_equip: 0,
      hrs_total: 0,
      hrs_motor_ligado: 0,
      hrs_efetivo: 0,
      hrs_ocioso: 0,
      hrs_total_seg: 0,
      hrs_ocioso_seg: 0,
      indeter_seg: 0,
      hrs_operacionais_seg: 0,
    }
  );

  const perc_ocioso =
    acc.hrs_total_seg > 0 ? (acc.hrs_ocioso_seg / acc.hrs_total_seg) * 100 : 0;

  // Calculo real: indeter_seg / hrs_operacionais_seg
  const perc_indeterminado =
    acc.hrs_operacionais_seg > 0 ? (acc.indeter_seg / acc.hrs_operacionais_seg) * 100 : 0;
  const hrs_indeterminado = acc.indeter_seg / 3600;

  return {
    ...acc,
    perc_ocioso,
    perc_indeterminado,
    hrs_indeterminado
  };
};

const aggregateEquipeRows = (rows = []) => {
  const acc = rows.reduce(
    (sum, row) => {
      sum.hrs_operacionais_seg += toNumber(row.hrs_operacionais_seg);
      sum.hrs_motor_ligado_seg += toNumber(row.hrs_motor_ligado_seg);
      sum.hrs_ocioso_seg += toNumber(row.hrs_ocioso_seg);
      return sum;
    },
    {
      hrs_operacionais_seg: 0,
      hrs_motor_ligado_seg: 0,
      hrs_ocioso_seg: 0,
    }
  );

  const perc_ocioso =
    acc.hrs_operacionais_seg > 0
      ? (acc.hrs_ocioso_seg / acc.hrs_operacionais_seg) * 100
      : 0;

  return {
    hrs_operacionais_seg: acc.hrs_operacionais_seg,
    hrs_motor_ligado_seg: acc.hrs_motor_ligado_seg,
    hrs_ocioso_seg: acc.hrs_ocioso_seg,
    hrs_operacionais: acc.hrs_operacionais_seg / 3600,
    hrs_motor_ligado: acc.hrs_motor_ligado_seg / 3600,
    hrs_ocioso: acc.hrs_ocioso_seg / 3600,
    perc_ocioso,
  };
};

// ================= HELPERS: COMPONENTES UI =================

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => {
  return (
    <div
      className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)]"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
        {label}
      </span>
      <span className="block text-[1rem] font-black tracking-tight" style={{ color }}>
        {value}
      </span>
    </div>
  );
};

// Barra de Indeterminado (Com regra de 10% e Font 1rem)
const ProgressBarIndeterminado = ({ perc, hrs }) => {
  const safePerc = Number(perc) || 0;
  // Regra clara: Abaixo ou igual a 10% é Verde, Acima é Vermelho
  const isDanger = safePerc > 10;
  const barColor = isDanger ? 'var(--coa-danger)' : 'var(--coa-success)';

  return (
    <div 
      className="rounded-[14px] border px-4 py-4 bg-[rgba(255,255,255,0.02)] flex flex-col gap-3 shadow-sm transition-all"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <div className="flex justify-between items-center">
        <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
          Indeterminado
        </span>
        {/* Fonte com o mesmo tamanho (1rem) e peso dos cards superiores */}
        <div className="flex items-center gap-2 text-[1rem] font-black tracking-tight">
          <span style={{ color: 'var(--coa-text)' }}>{formatHours(hrs)}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--coa-text-muted)] opacity-50"></span>
          <span className="transition-colors" style={{ color: barColor }}>
            {formatPercent(safePerc)}
          </span>
        </div>
      </div>
      
      <div className="w-full h-2 rounded-full overflow-hidden flex bg-[rgba(255,255,255,0.05)] shadow-inner">
        <div 
          className="h-full transition-all duration-700 ease-out"
          style={{ width: `${Math.min(safePerc, 100)}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
};

const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => {
  return (
    <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
      <button
        type="button"
        onClick={onToggleOpen}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="flex flex-col gap-1">
          <span className="coa-text-micro">Filtro</span>
          <span className="text-sm font-black text-[var(--coa-text)]">Categorias</span>
        </div>

        <span className="coa-badge">
          {isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}
        </span>
      </button>

      {isOpen && (
        <div className="flex flex-col gap-2">
          {categoryOptions.map((category) => {
            const checked = selectedCategories.includes(category);

            return (
              <label
                key={category}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-sm font-bold cursor-pointer"
                style={{
                  borderColor: checked ? 'rgba(61,220,151,0.28)' : 'var(--coa-border)',
                  background: checked ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                  color: checked ? 'var(--coa-text)' : 'var(--coa-text-soft)',
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(category)}
                />
                <span>{category}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};

const AreaTableOcioso = ({ rows = [], selectedAreas = [], onToggleArea }) => {
  return (
    <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
      <div
        className="grid grid-cols-[1.45fr_0.7fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b"
        style={{ borderColor: 'var(--coa-divider)' }}
      >
        <span className="coa-text-micro">Área</span>
        <span className="coa-text-micro text-right">Qnt</span>
        <span className="coa-text-micro text-right">Ocioso</span>
        <span className="coa-text-micro text-right">%</span>
      </div>

      <div className="coa-area-table-home__body">
        {rows.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhuma área encontrada para os filtros selecionados.
          </div>
        ) : (
          rows.map((row) => {
            const active = selectedAreas.includes(row.desc_area);

            return (
              <button
                key={row.desc_area}
                type="button"
                onClick={() => onToggleArea(row.desc_area)}
                className="w-full text-left grid grid-cols-[1.45fr_0.7fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b transition-colors"
                style={{
                  borderColor: 'var(--coa-divider)',
                  background: active ? 'rgba(61,220,151,0.08)' : 'transparent',
                }}
              >
                <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                  {row.desc_area}
                </span>

                <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                  {formatInt(row.qnt_equip)}
                </span>

                <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                  {formatHours(row.hrs_ocioso)}
                </span>

                <span
                  className="text-[12px] font-black text-right"
                  style={{ color: getOciosoColor(row.perc_ocioso) }}
                >
                  {formatPercent(row.perc_ocioso)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};

const ExpandBlock = ({ expanded, children }) => {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
};

const AreaRowModern = ({ area, expanded, onToggle, children }) => {
  const color = getOciosoColor(area.perc_ocioso);

  return (
    <div className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 transition-all"
        style={{
          background: getOciosoTint(area.perc_ocioso, 0.13),
        }}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <div className="min-w-0 flex flex-col">
            <span className="text-[14px] font-black text-[var(--coa-text)] truncate">
              {area.desc_area}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              {formatInt(area.qnt_equip)} equipamentos
            </span>
          </div>

          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">
            {formatHours(area.hrs_ocioso)}
          </span>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>
              {formatPercent(area.perc_ocioso)}
            </span>
            <span className="text-[12px] font-black text-[var(--coa-text-muted)]">
              {expanded ? '−' : '+'}
            </span>
          </div>
        </div>
      </button>

      <ExpandBlock expanded={expanded}>
        <div className="pl-5 pr-2 py-2 flex flex-col gap-1.5 bg-[rgba(255,255,255,0.01)]">
          {children}
        </div>
      </ExpandBlock>
    </div>
  );
};

const FrenteRowModern = ({ frente, expanded, onToggle, children }) => {
  const color = getOciosoColor(frente.perc_ocioso);

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 transition-all"
        style={{
          background: 'transparent',
        }}
      >
        <div
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2"
          style={{
            borderBottom: `1px solid ${color}50`,
          }}
        >
          <div className="min-w-0 flex flex-col">
            <span className="text-[12px] font-black truncate" style={{ color }}>
              {frente.desc_grupo}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              {formatInt(frente.qnt_equip)} equipamentos
            </span>
          </div>

          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">
            {formatHours(frente.hrs_ocioso)}
          </span>

          <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>
            {formatPercent(frente.perc_ocioso)}
          </span>

          <span className="text-[11px] font-black text-[var(--coa-text-muted)]">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      <ExpandBlock expanded={expanded}>
        <div className="pl-6 pr-1 pt-2 flex flex-col gap-1.5">
          {children}
        </div>
      </ExpandBlock>
    </div>
  );
};

const EquipamentoRowModern = ({ item, onOpen }) => {
  const color = getOciosoColor(item.perc_ocioso);

  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full text-left px-3 py-2.5 transition-all"
      style={{
        background: getOciosoTint(item.perc_ocioso, 0.09),
      }}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-[12px] font-black text-[var(--coa-text)] truncate">
            {item.cod_equip}
          </span>
          <span className="text-[10px] font-medium text-[var(--coa-text-muted)] truncate">
            {item.desc_equip || 'SEM DESCRIÇÃO'}
          </span>
        </div>

        <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>
          {formatPercent(item.perc_ocioso)}
        </span>
      </div>
    </button>
  );
};

const buildHierarchy = (rows = []) => {
  const areaMap = new Map();

  rows.forEach((row) => {
    const areaKey = row.desc_area || 'NÃO MAPEADO';
    const frenteKey = row.desc_grupo || 'SEM FRENTE';
    const equipKey = row.cod_equip || 'SEM CODIGO';

    if (!areaMap.has(areaKey)) {
      areaMap.set(areaKey, {
        desc_area: areaKey,
        rows: [],
        frentesMap: new Map(),
      });
    }

    const area = areaMap.get(areaKey);
    area.rows.push(row);

    if (!area.frentesMap.has(frenteKey)) {
      area.frentesMap.set(frenteKey, {
        desc_grupo: frenteKey,
        rows: [],
        equipamentosMap: new Map(),
      });
    }

    const frente = area.frentesMap.get(frenteKey);
    frente.rows.push(row);

    if (!frente.equipamentosMap.has(equipKey)) {
      frente.equipamentosMap.set(equipKey, {
        cod_equip: row.cod_equip,
        desc_equip: row.desc_equip,
        rows: [],
      });
    }

    frente.equipamentosMap.get(equipKey).rows.push(row);
  });

  return [...areaMap.values()]
    .map((area) => {
      const areaAgg = aggregateEquipeRows(area.rows);

      const frentes = [...area.frentesMap.values()]
        .map((frente) => {
          const frenteAgg = aggregateEquipeRows(frente.rows);

          const equipamentos = [...frente.equipamentosMap.values()]
            .map((equip) => {
              const equipAgg = aggregateEquipeRows(equip.rows);

              return {
                cod_equip: equip.cod_equip,
                desc_equip: equip.desc_equip,
                ...equipAgg,
              };
            })
            .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);

          return {
            desc_grupo: frente.desc_grupo,
            qnt_equip: equipamentos.length,
            equipamentos,
            ...frenteAgg,
          };
        })
        .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);

      const qntEquipArea = frentes.reduce((acc, frente) => acc + frente.qnt_equip, 0);

      return {
        desc_area: area.desc_area,
        qnt_equip: qntEquipArea,
        frentes,
        ...areaAgg,
      };
    })
    .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
};

// ================= EXECUTOR =================

const OciosoDetailDiario = ({
  selectedDate,
  setSelectedDate,
  selectedCategories,
  setSelectedCategories,
  availableDates = [],
}) => {
  const [rows, setRows] = useState([]);
  const [equipeRows, setEquipeRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  const [expandedAreas, setExpandedAreas] = useState([]);
  const [expandedFrentes, setExpandedFrentes] = useState([]);
  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');
        setSelectedAreas([]);
        setExpandedAreas([]);
        setExpandedFrentes([]);

        const selectedBrDate = isoToBr(selectedDate);

        // CONSULTA INTELIGENTE: Baixando só 3 coluninhas de tb_c_geral para cruzar em memória. 
        const [geralRes, equipeRes, tbGeralRes] = await Promise.all([
          supabase
            .from('vw_c_ociosogeral')
            .select(OCIOSO_COLUMNS)
            .eq('data', selectedBrDate),
          supabase
            .from('vw_c_ociosoequipe')
            .select(OCIOSO_EQUIPE_COLUMNS)
            .eq('data', selectedBrDate),
          supabase
            .from('tb_c_geral')
            .select('desc_area, indeter_seg, hrs_operacionais_seg')
            .eq('data', selectedBrDate)
        ]);

        if (geralRes.error) throw geralRes.error;
        if (equipeRes.error) throw equipeRes.error;
        if (tbGeralRes.error) throw tbGeralRes.error;

        // Agrupando o resultado otimizado por área para fundir com a view principal
        const indeterMap = {};
        (tbGeralRes.data || []).forEach(row => {
            const area = row.desc_area || 'NÃO MAPEADO';
            if (!indeterMap[area]) {
                indeterMap[area] = { indeter_seg: 0, hrs_operacionais_seg: 0 };
            }
            indeterMap[area].indeter_seg += Number(row.indeter_seg) || 0;
            indeterMap[area].hrs_operacionais_seg += Number(row.hrs_operacionais_seg) || 0;
        });

        const normalizedGeral = (geralRes.data || [])
          .map(row => {
              const base = normalizeAreaRow(row);
              const mapData = indeterMap[base.desc_area] || { indeter_seg: 0, hrs_operacionais_seg: 0 };
              return {
                  ...base,
                  indeter_seg: mapData.indeter_seg,
                  hrs_operacionais_seg: mapData.hrs_operacionais_seg
              };
          })
          .filter(
            (row) =>
              row.desc_area !== 'EMPACOTAMENTO' &&
              row.categoria !== 'EMPACOTAMENTO'
          )
          .sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);

        const normalizedEquipe = (equipeRes.data || [])
          .map(normalizeEquipeRow)
          .filter((row) => row.desc_area !== 'EMPACOTAMENTO')
          .sort((a, b) => b.hrs_ocioso_seg - a.hrs_ocioso_seg);

        if (!mounted) return;
        setRows(normalizedGeral);
        setEquipeRows(normalizedEquipe);
      } catch (err) {
        console.error('[COA] Erro ao carregar detalhe diário de ocioso:', err);
        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o detalhe diário.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  const categoryOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.categoria).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rows]);

  const rowsByCategory = useMemo(() => {
    if (!selectedCategories.length) return [];
    return rows.filter((row) => selectedCategories.includes(row.categoria));
  }, [rows, selectedCategories]);

  const allowedAreas = useMemo(() => {
    return new Set(rowsByCategory.map((row) => row.desc_area));
  }, [rowsByCategory]);

  const equipeRowsByCategory = useMemo(() => {
    return equipeRows.filter((row) => allowedAreas.has(row.desc_area));
  }, [equipeRows, allowedAreas]);

  const areaTableRows = useMemo(() => {
    return [...rowsByCategory].sort((a, b) => b.hrs_ocioso - a.hrs_ocioso);
  }, [rowsByCategory]);

  const rowsByArea = useMemo(() => {
    if (!selectedAreas.length) return rowsByCategory;
    return rowsByCategory.filter((row) => selectedAreas.includes(row.desc_area));
  }, [rowsByCategory, selectedAreas]);

  const totalAgg = useMemo(() => aggregateSummaryRows(rowsByArea), [rowsByArea]);

  const hierarchyRows = useMemo(() => {
    const filtered =
      selectedAreas.length > 0
        ? equipeRowsByCategory.filter((row) => selectedAreas.includes(row.desc_area))
        : equipeRowsByCategory;

    return buildHierarchy(filtered);
  }, [equipeRowsByCategory, selectedAreas]);

  const handleCategoryToggle = (category) => {
    setSelectedAreas([]);
    setExpandedAreas([]);
    setExpandedFrentes([]);

    setSelectedCategories((prev) => {
      const exists = prev.includes(category);
      if (exists) return prev.filter((item) => item !== category);
      return [...prev, category];
    });
  };

  const handleAreaToggle = (areaName) => {
    setExpandedAreas([]);
    setExpandedFrentes([]);

    setSelectedAreas((prev) => {
      const exists = prev.includes(areaName);
      if (exists) return prev.filter((item) => item !== areaName);
      return [...prev, areaName];
    });
  };

  const handleAccordionAreaToggle = (areaName) => {
    setExpandedFrentes((prev) => prev.filter((key) => !key.startsWith(`${areaName}__`)));

    setExpandedAreas((prev) => {
      const exists = prev.includes(areaName);
      if (exists) return prev.filter((item) => item !== areaName);
      return [...prev, areaName];
    });
  };

  const handleAccordionFrenteToggle = (frenteKey) => {
    setExpandedFrentes((prev) => {
      const exists = prev.includes(frenteKey);
      if (exists) return prev.filter((item) => item !== frenteKey);
      return [...prev, frenteKey];
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA
              value={selectedDate}
              onChange={setSelectedDate}
              maxDate={todayIso}
              availableDates={availableDates}
            />
          </div>
        </div>

        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="flex flex-col items-center justify-center gap-3 py-10">
              <div className="coa-loader-dots" aria-label="Carregando">
                <span />
                <span />
                <span />
              </div>
              <span className="coa-loader-text">Carregando detalhe diário...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA
              value={selectedDate}
              onChange={setSelectedDate}
              maxDate={todayIso}
              availableDates={availableDates}
            />
          </div>
        </div>

        <div className="coa-card">
          <div className="coa-card__body">
            <div className="coa-empty">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <DateSelectorCOA
            value={selectedDate}
            onChange={setSelectedDate}
            maxDate={todayIso}
            availableDates={availableDates}
          />
        </div>
      </div>

      <CategoryFilter
        categoryOptions={categoryOptions}
        selectedCategories={selectedCategories}
        onToggle={handleCategoryToggle}
        isOpen={isCategoryOpen}
        onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
      />

      <AreaTableOcioso
        rows={areaTableRows}
        selectedAreas={selectedAreas}
        onToggleArea={handleAreaToggle}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <MetricCard label="Horas Operacionais" value={formatHours(totalAgg.hrs_total)} />
        <MetricCard label="Horas Efetivas" value={formatHours(totalAgg.hrs_efetivo)} />
        <MetricCard label="Motor Ligado" value={formatHours(totalAgg.hrs_motor_ligado)} />
        <MetricCard label="Horas Ociosas" value={formatHours(totalAgg.hrs_ocioso)} />
        <MetricCard label="Equipamentos" value={formatInt(totalAgg.qnt_equip)} />
        <MetricCard
          label="% Motor Ocioso"
          value={formatPercent(totalAgg.perc_ocioso)}
          color={getOciosoColor(totalAgg.perc_ocioso)}
        />
      </div>

      {/* Nossa Barra de Indeterminado Perfeita, com cálculos precisos */}
      <ProgressBarIndeterminado 
        perc={totalAgg.perc_indeterminado} 
        hrs={totalAgg.hrs_indeterminado} 
      />

      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
            EQUIPAMENTOS
          </h2>
          <span className="text-sm font-black text-[var(--coa-text-soft)]">
            Clique para expandir
          </span>
        </div>

        {hierarchyRows.length === 0 ? (
          <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)]">
            Nenhum equipamento encontrado para os filtros selecionados.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hierarchyRows.map((area) => {
              const areaExpanded = expandedAreas.includes(area.desc_area);

              return (
                <AreaRowModern
                  key={area.desc_area}
                  area={area}
                  expanded={areaExpanded}
                  onToggle={() => handleAccordionAreaToggle(area.desc_area)}
                >
                  {area.frentes.map((frente) => {
                    const frenteKey = `${area.desc_area}__${frente.desc_grupo}`;
                    const frenteExpanded = expandedFrentes.includes(frenteKey);

                    return (
                      <FrenteRowModern
                        key={frenteKey}
                        frente={frente}
                        expanded={frenteExpanded}
                        onToggle={() => handleAccordionFrenteToggle(frenteKey)}
                      >
                        <div className="flex flex-col gap-1.5">
                          {frente.equipamentos.map((equip) => (
                            <EquipamentoRowModern
                              key={`${frenteKey}__${equip.cod_equip}`}
                              item={equip}
                              onOpen={setSelectedModalItem}
                            />
                          ))}
                        </div>
                      </FrenteRowModern>
                    );
                  })}
                </AreaRowModern>
              );
            })}
          </div>
        )}
      </div>
      
      {selectedModalItem && (
        <OciosoDetailDiarioModal
            item={selectedModalItem}
            selectedDate={selectedDate}
            onClose={() => setSelectedModalItem(null)}
        />
      )}

    </div>
  );
};

export default OciosoDetailDiario;