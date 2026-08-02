// ================= DOCUMENTATION ------------------------------------------
// Script: IndeterDetailDiario
// Purpose: Visão detalhada diária do Tempo Indeterminado com hierarquia de Frota e barra de %.
// Relationships: vw_c_indeterminado
// ==========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import DateSelectorCOA from '../../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../../lib/supabaseClient';
import IndeterDetailDiarioModal from './IndeterDetailDiarioModal';

// ================================= METAS E CONSTANTES ================================= //

const INDETER_META = 10; // <= 10% Verde, > 10% Vermelho
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const MAIN_COLUMNS = [
  'data',
  'cod_equip',
  'desc_equip',
  'desc_area',
  'desc_grupo',
  'categoria',
  'hrs_indeter_seg',
  'hrs_operacionais_seg'
].join(',');

const PAGE_SIZE = 1000;

// ================================= HELPERS ================================= //

const fetchAllPages = async (makeQuery) => {
  let allRows = [];
  let from = 0;

  while (true) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await makeQuery().range(from, to);
    if (error) throw error;

    const pageRows = data || [];
    allRows = [...allRows, ...pageRows];

    if (pageRows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return allRows;
};

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

const getLast7DaysFromIso = (isoDate) => {
  const datesBr = [];
  const base = new Date(`${isoDate}T12:00:00Z`);

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const yyyy = d.getUTCFullYear();
    datesBr.push(`${dd}/${mm}/${yyyy}`);
  }
  return datesBr;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const formatHHMM = (valueInHours) => {
  const totalMinutes = Math.max(0, Math.round(Number(valueInHours || 0) * 60));
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getIndeterColor = (value) => {
  const safe = Number(value || 0);
  return safe <= INDETER_META ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getIndeterTint = (value, alpha = 0.10) => {
  const safe = Number(value || 0);
  return safe <= INDETER_META ? `rgba(61,220,151,${alpha})` : `rgba(239,68,68,${alpha})`;
};

// ================================= MATEMÁTICA ================================= //

const normalizeRow = (row = {}) => {
  const operSeg = toNumber(row.hrs_operacionais_seg);
  const indeterSeg = toNumber(row.hrs_indeter_seg);

  return {
    ...row,
    categoria_equip: row.categoria || 'AGRÍCOLA',
    desc_area: row.desc_area || 'NÃO MAPEADA',
    desc_grupo: row.desc_grupo || 'SEM FRENTE',
    hrs_operacionais: operSeg / 3600,
    hrs_indeter: indeterSeg / 3600,
  };
};

const aggregateRows = (rows = []) => {
  const total = rows.reduce(
    (acc, row) => {
      acc.hrs_operacionais += toNumber(row.hrs_operacionais);
      acc.hrs_indeter += toNumber(row.hrs_indeter);
      return acc;
    },
    { hrs_operacionais: 0, hrs_indeter: 0 }
  );

  const uniqueEquips = new Set(rows.map((r) => r.cod_equip).filter(Boolean)).size;
  const perc_indeter = total.hrs_operacionais > 0 ? (total.hrs_indeter / total.hrs_operacionais) * 100 : 0;

  return {
    ...total,
    perc_indeter,
    qnt_equip: uniqueEquips,
  };
};

const groupAndAggregate = (rows = [], keyGetter) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row) || 'NÃO MAPEADO';
    if (!map.has(key)) map.set(key, { key, rows: [] });
    map.get(key).rows.push(row);
  });
  return [...map.values()].map((item) => ({
    ...item,
    ...aggregateRows(item.rows),
  }));
};

const buildHierarchy = (rows = []) => {
  const areaMap = new Map();

  rows.forEach((row) => {
    const areaKey = row.desc_area || 'NÃO MAPEADO';
    const frenteKey = row.desc_grupo || 'SEM FRENTE';
    const equipKey = row.cod_equip || 'SEM CODIGO';

    if (!areaMap.has(areaKey)) {
      areaMap.set(areaKey, { desc_area: areaKey, rows: [], frentesMap: new Map() });
    }

    const area = areaMap.get(areaKey);
    area.rows.push(row);

    if (!area.frentesMap.has(frenteKey)) {
      area.frentesMap.set(frenteKey, { desc_grupo: frenteKey, rows: [], equipamentosMap: new Map() });
    }

    const frente = area.frentesMap.get(frenteKey);
    frente.rows.push(row);

    if (!frente.equipamentosMap.has(equipKey)) {
      frente.equipamentosMap.set(equipKey, { cod_equip: row.cod_equip, desc_equip: row.desc_equip, rows: [] });
    }

    frente.equipamentosMap.get(equipKey).rows.push(row);
  });

  return [...areaMap.values()]
    .map((area) => {
      const areaAgg = aggregateRows(area.rows);

      const frentes = [...area.frentesMap.values()]
        .map((frente) => {
          const frenteAgg = aggregateRows(frente.rows);

          const equipamentos = [...frente.equipamentosMap.values()]
            .map((equip) => {
              const equipAgg = aggregateRows(equip.rows);
              return { cod_equip: equip.cod_equip, desc_equip: equip.desc_equip, ...equipAgg };
            })
            .sort((a, b) => b.hrs_indeter - a.hrs_indeter);

          return { desc_grupo: frente.desc_grupo, qnt_equip: equipamentos.length, equipamentos, ...frenteAgg };
        })
        .sort((a, b) => b.hrs_indeter - a.hrs_indeter);

      const qntEquipArea = frentes.reduce((acc, frente) => acc + frente.qnt_equip, 0);

      return { desc_area: area.desc_area, qnt_equip: qntEquipArea, frentes, ...areaAgg };
    })
    .sort((a, b) => b.hrs_indeter - a.hrs_indeter);
};

// ================================= COMPONENTES UI ================================= //

const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => (
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

const ProgressBarIndeterminado = ({ perc, hrs }) => {
  const safePerc = Number(perc) || 0;
  const isDanger = safePerc > INDETER_META;
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
        <div className="flex items-center gap-2 text-[1rem] font-black tracking-tight">
          {/*<span style={{ color: 'var(--coa-text)' }}>{formatHours(hrs)}</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--coa-text-muted)] opacity-50"></span>*/}
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

const CategoryFilter = ({ categoryOptions = [], selectedCategories = [], onToggle, isOpen, onToggleOpen }) => (
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
              <input type="checkbox" checked={checked} onChange={() => onToggle(category)} />
              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

const AreaTableIndeter = ({ rows = [], selectedAreas = [], onToggleArea }) => (
  <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
    <div
      className="grid grid-cols-[1.45fr_0.7fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="coa-text-micro">Área</span>
      <span className="coa-text-micro text-right">Qnt</span>
      <span className="coa-text-micro text-right">Indeter.</span>
      <span className="coa-text-micro text-right">%</span>
    </div>

    <div className="coa-area-table-home__body max-h-[250px] overflow-y-auto">
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
                {formatHours(row.hrs_indeter)}
              </span>
              <span
                className="text-[12px] font-black text-right"
                style={{ color: getIndeterColor(row.perc_indeter) }}
              >
                {formatPercent(row.perc_indeter)}
              </span>
            </button>
          );
        })
      )}
    </div>
  </div>
);

const ExpandBlock = ({ expanded, children }) => (
  <div
    className={`grid transition-all duration-300 ease-out ${
      expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
    }`}
  >
    <div className="overflow-hidden">{children}</div>
  </div>
);

const AreaRowModern = ({ area, expanded, onToggle, children }) => {
  const color = getIndeterColor(area.perc_indeter);
  return (
    <div className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left px-4 py-3 transition-all"
        style={{ background: getIndeterTint(area.perc_indeter, 0.13) }}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <div className="min-w-0 flex flex-col">
            <span className="text-[14px] font-black text-[var(--coa-text)] truncate">{area.desc_area}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              {formatInt(area.qnt_equip)} equipamentos
            </span>
          </div>
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">
            {formatHours(area.hrs_indeter)}
          </span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>
              {formatPercent(area.perc_indeter)}
            </span>
            <span className="text-[12px] font-black text-[var(--coa-text-muted)]">{expanded ? '−' : '+'}</span>
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
  const color = getIndeterColor(frente.perc_indeter);
  return (
    <div className="flex flex-col">
      <button type="button" onClick={onToggle} className="w-full text-left px-3 py-2.5 transition-all">
        <div
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2"
          style={{ borderBottom: `1px solid ${color}50` }}
        >
          <div className="min-w-0 flex flex-col">
            <span className="text-[12px] font-black truncate" style={{ color }}>{frente.desc_grupo}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              {formatInt(frente.qnt_equip)} equipamentos
            </span>
          </div>
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">
            {formatHours(frente.hrs_indeter)}
          </span>
          <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>
            {formatPercent(frente.perc_indeter)}
          </span>
          <span className="text-[11px] font-black text-[var(--coa-text-muted)]">{expanded ? '−' : '+'}</span>
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
  const color = getIndeterColor(item.perc_indeter);
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      className="w-full text-left px-3 py-2.5 transition-all rounded-md hover:bg-[rgba(255,255,255,0.05)] active:scale-[0.98]"
      style={{ background: getIndeterTint(item.perc_indeter, 0.05) }}
    >
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-[12px] font-black text-[var(--coa-text)] truncate">{item.cod_equip}</span>
          <span className="text-[10px] font-medium text-[var(--coa-text-muted)] truncate">
            {item.desc_equip || 'SEM DESCRIÇÃO'}
          </span>
        </div>
        <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>
          {formatPercent(item.perc_indeter)}
        </span>
      </div>
    </button>
  );
};

const RankingTable = ({ columns = [], rows = [], emptyText = 'Sem dados para exibir.' }) => (
  <div className="coa-panel p-0 overflow-hidden">
    <div
      className="grid gap-2 px-4 py-3 border-b"
      style={{
        borderColor: 'var(--coa-divider)',
        gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' '),
      }}
    >
      {columns.map((col) => (
        <span key={col.key} className={`coa-text-micro ${col.align === 'right' ? 'text-right' : ''}`}>
          {col.label}
        </span>
      ))}
    </div>
    <div>
      {rows.length === 0 ? (
        <div className="px-4 py-5 text-center text-sm font-bold text-[var(--coa-text-muted)]">{emptyText}</div>
      ) : (
        rows.map((row, idx) => (
          <div
            key={row.id || `${row.name}-${idx}`}
            className="grid gap-2 px-4 py-3 border-b"
            style={{
              borderColor: 'var(--coa-divider)',
              gridTemplateColumns: columns.map((col) => col.width || '1fr').join(' '),
              background: idx === 0 ? 'rgba(239,68,68,0.05)' : 'transparent',
            }}
          >
            {columns.map((col) => (
              <span
                key={col.key}
                className={`text-[12px] font-black truncate ${col.align === 'right' ? 'text-right whitespace-nowrap' : ''}`}
                style={{ color: col.color ? col.color(row) : 'var(--coa-text-soft)' }}
                title={String(row[col.key] || '')}
              >
                {col.render ? col.render(row, idx) : row[col.key]}
              </span>
            ))}
          </div>
        ))
      )}
    </div>
  </div>
);

const ScreenAnalysisPanel = ({ rows = [], totalAgg, historyRows = [] }) => {
  const analysis = useMemo(() => {
    if (!rows.length) return { frenteRows: [], equipRows: [], criticalRows: [] };

    const frenteRows = groupAndAggregate(rows, (row) => row.desc_grupo)
      .filter((item) => item.hrs_indeter > 0)
      .sort((a, b) => b.hrs_indeter - a.hrs_indeter)
      .slice(0, 5)
      .map((item) => ({
        id: item.key,
        frente: item.key,
        area: item.rows[0]?.desc_area || 'NÃO MAPEADA',
        hrs_indeter: item.hrs_indeter,
        perc_indeter: item.perc_indeter,
      }));

    const equipRows = groupAndAggregate(rows, (row) => row.cod_equip)
      .filter((item) => item.hrs_indeter > 0)
      .sort((a, b) => b.hrs_indeter - a.hrs_indeter)
      .slice(0, 10)
      .map((equip) => ({
        id: equip.key,
        cod_equip: equip.key,
        frente: equip.rows[0]?.desc_grupo || 'SEM FRENTE',
        area: equip.rows[0]?.desc_area || 'NÃO MAPEADA',
        hrs_indeter: equip.hrs_indeter,
        perc_indeter: equip.perc_indeter,
      }));

    const criticalRows = groupAndAggregate(historyRows, (row) => row.cod_equip)
      .filter((item) => item.hrs_indeter > 0)
      .sort((a, b) => b.hrs_indeter - a.hrs_indeter)
      .slice(0, 5)
      .map((equip) => ({
        id: equip.key,
        cod_equip: equip.key,
        frente: equip.rows[0]?.desc_grupo || 'SEM FRENTE',
        area: equip.rows[0]?.desc_area || 'NÃO MAPEADA',
        hrs_indeter: equip.hrs_indeter,
        perc_indeter: equip.perc_indeter,
      }));

    return { frenteRows, equipRows, criticalRows };
  }, [rows, historyRows]);

  const frenteCols = [
    { key: 'frente', label: 'Frente', width: 'minmax(0,1fr)' },
    { key: 'area', label: 'Área', width: '90px' },
    { key: 'hrs_indeter', label: 'Horas', width: '70px', align: 'right', render: (row) => formatHHMM(row.hrs_indeter), color: () => '#f6d66d' },
    { key: 'perc_indeter', label: '% Ind.', width: '60px', align: 'right', render: (row) => formatPercent(row.perc_indeter), color: (row) => getIndeterColor(row.perc_indeter) },
  ];

  const equipCols = [
    { key: 'cod_equip', label: 'Equip.', width: '76px', color: () => 'var(--coa-text)' },
    { key: 'frente', label: 'Frente', width: 'minmax(0,1fr)' },
    { key: 'hrs_indeter', label: 'Horas', width: '70px', align: 'right', render: (row) => formatHHMM(row.hrs_indeter), color: () => '#f6d66d' },
    { key: 'perc_indeter', label: '% Ind.', width: '60px', align: 'right', render: (row) => formatPercent(row.perc_indeter), color: (row) => getIndeterColor(row.perc_indeter) },
  ];

  const isDanger = totalAgg.perc_indeter > INDETER_META;

  return (
    <div className="coa-panel p-4 md:p-5 flex flex-col gap-5 mt-2">
      <div className="flex flex-col gap-1">
        <h2 className="text-[1.15rem] md:text-[1.25rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
          Análises
        </h2>
      </div>

      

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="flex flex-col gap-3">
          <span className="coa-text-micro">Top 10 Equipamentos</span>
          <RankingTable columns={equipCols} rows={analysis.equipRows} emptyText="Sem equipamentos com horas indeterminadas." />
        </div>
        <div className="flex flex-col gap-3">
          <span className="coa-text-micro">Top 5 Frentes</span>
          <RankingTable columns={frenteCols} rows={analysis.frenteRows} emptyText="Sem frentes com horas indeterminadas." />
        </div>
      </div>

      {analysis.criticalRows.length > 0 && (
        <div className="flex flex-col gap-3 pt-2">
          <span className="coa-text-micro text-[var(--coa-danger)]">
            Top 5 acumulado nos últimos 7 dias
          </span>
          <RankingTable columns={equipCols} rows={analysis.criticalRows} emptyText="Nenhuma anomalia nos últimos 7 dias." />
        </div>
      )}
    </div>
  );
};

// ================================= MAIN COMPONENT ================================= //

const IndeterDetailDiario = ({
  selectedDate,
  setSelectedDate,
  availableDates = [],
}) => {
  const [rows, setRows] = useState([]);
  const [historyRows, setHistoryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['AGRÍCOLA', 'APOIO']); // Padrão
  const [selectedAreas, setSelectedAreas] = useState([]);
  
  const [expandedAreas, setExpandedAreas] = useState([]);
  const [expandedFrentes, setExpandedFrentes] = useState([]);
  const [selectedModalItem, setSelectedModalItem] = useState(null);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);
  const datesBr = useMemo(() => getLast7DaysFromIso(selectedDate), [selectedDate]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const selectedBrDate = isoToBr(selectedDate);

        const [currentDayData, historyData] = await Promise.all([
          fetchAllPages(() => supabase.from('vw_c_indeterminado').select(MAIN_COLUMNS).eq('data', selectedBrDate)),
          fetchAllPages(() => supabase.from('vw_c_indeterminado').select(MAIN_COLUMNS).in('data', datesBr)),
        ]);

        if (!mounted) return;

        setRows((currentDayData || []).map(normalizeRow));
        setHistoryRows((historyData || []).map(normalizeRow));
        
        // Mantém as seleções padrão ao carregar nova data
        setSelectedAreas([]);
        setExpandedAreas([]);
        setExpandedFrentes([]);

      } catch (err) {
        console.error('[COA] Erro ao carregar detalhe diário de indeterminado:', err);
        if (mounted) setError('Falha ao carregar os dados de tempo indeterminado.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [selectedDate, datesBr]);

  const categoryOptions = useMemo(() => {
    const values = [...new Set(rows.map((row) => row.categoria_equip).filter(Boolean))];
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
    return rows.filter((row) => selectedCategories.includes(row.categoria_equip));
  }, [rows, selectedCategories]);

  const historyFilteredRows = useMemo(() => {
    let base = historyRows;
    if (selectedCategories.length > 0) base = base.filter((r) => selectedCategories.includes(r.categoria_equip));
    if (selectedAreas.length > 0) base = base.filter((r) => selectedAreas.includes(r.desc_area));
    return base;
  }, [historyRows, selectedCategories, selectedAreas]);

  // AQUI FOI ONDE A MÁGICA ACONTECEU! MAPEANDO item.key PARA desc_area.
  const areaTableRows = useMemo(() => {
    return groupAndAggregate(rowsByCategory, (row) => row.desc_area)
      .map(item => ({ ...item, desc_area: item.key })) 
      .sort((a, b) => b.hrs_indeter - a.hrs_indeter);
  }, [rowsByCategory]);

  const rowsByArea = useMemo(() => {
    if (!selectedAreas.length) return rowsByCategory;
    return rowsByCategory.filter((row) => selectedAreas.includes(row.desc_area));
  }, [rowsByCategory, selectedAreas]);

  const totalAgg = useMemo(() => aggregateRows(rowsByArea), [rowsByArea]);

  const hierarchyRows = useMemo(() => {
    const filtered = selectedAreas.length > 0 ? rowsByCategory.filter((row) => selectedAreas.includes(row.desc_area)) : rowsByCategory;
    return buildHierarchy(filtered);
  }, [rowsByCategory, selectedAreas]);

  const handleCategoryToggle = (category) => {
    setSelectedAreas([]);
    setExpandedAreas([]);
    setExpandedFrentes([]);
    setSelectedCategories((prev) => prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]);
  };

  const handleAreaToggle = (areaName) => {
    setExpandedAreas([]);
    setExpandedFrentes([]);
    setSelectedAreas((prev) => prev.includes(areaName) ? prev.filter((item) => item !== areaName) : [...prev, areaName]);
  };

  const handleAccordionAreaToggle = (areaName) => {
    setExpandedFrentes((prev) => prev.filter((key) => !key.startsWith(`${areaName}__`)));
    setExpandedAreas((prev) => prev.includes(areaName) ? prev.filter((item) => item !== areaName) : [...prev, areaName]);
  };

  const handleAccordionFrenteToggle = (frenteKey) => {
    setExpandedFrentes((prev) => prev.includes(frenteKey) ? prev.filter((item) => item !== frenteKey) : [...prev, frenteKey]);
  };

  if (loading || error) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} availableDates={availableDates} />
          </div>
        </div>
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center py-10">
            {loading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="coa-loader-dots"><span /><span /><span /></div>
                <span className="coa-loader-text">Calculando Tempo Indeterminado...</span>
              </div>
            ) : (
              <div className="coa-empty text-[var(--coa-danger)]">{error}</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <DateSelectorCOA value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} availableDates={availableDates} />
        </div>
      </div>

      <CategoryFilter
        categoryOptions={categoryOptions}
        selectedCategories={selectedCategories}
        onToggle={handleCategoryToggle}
        isOpen={isCategoryOpen}
        onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
      />

      <AreaTableIndeter
        rows={areaTableRows}
        selectedAreas={selectedAreas}
        onToggleArea={handleAreaToggle}
      />

      <div className="grid grid-cols-2 gap-3">
        <MetricCard label="Total Hrs. Operacionais" value={formatHours(totalAgg.hrs_operacionais)} />
        <MetricCard label="Total Hrs. Indeterminadas" value={formatHours(totalAgg.hrs_indeter)} />
      </div>

      <ProgressBarIndeterminado perc={totalAgg.perc_indeter} hrs={totalAgg.hrs_indeter} />

      <div className="flex flex-col gap-4 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
            EQUIPAMENTOS
          </h2>
          <span className="text-sm font-black text-[var(--coa-text-soft)]">Clique para expandir</span>
        </div>

        {hierarchyRows.length === 0 ? (
          <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)] text-center">
            Nenhum equipamento encontrado neste escopo.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {hierarchyRows.map((area) => (
              <AreaRowModern
                key={area.desc_area}
                area={area}
                expanded={expandedAreas.includes(area.desc_area)}
                onToggle={() => handleAccordionAreaToggle(area.desc_area)}
              >
                {area.frentes.map((frente) => {
                  const frenteKey = `${area.desc_area}__${frente.desc_grupo}`;
                  return (
                    <FrenteRowModern
                      key={frenteKey}
                      frente={frente}
                      expanded={expandedFrentes.includes(frenteKey)}
                      onToggle={() => handleAccordionFrenteToggle(frenteKey)}
                    >
                      {frente.equipamentos.map((equip) => (
                        <EquipamentoRowModern
                          key={`${frenteKey}__${equip.cod_equip}`}
                          item={equip}
                          onOpen={setSelectedModalItem}
                        />
                      ))}
                    </FrenteRowModern>
                  );
                })}
              </AreaRowModern>
            ))}
          </div>
        )}
      </div>

      <ScreenAnalysisPanel rows={rowsByArea} totalAgg={totalAgg} historyRows={historyFilteredRows} />

      {selectedModalItem && (
        <IndeterDetailDiarioModal
          item={selectedModalItem}
          selectedDate={selectedDate}
          onClose={() => setSelectedModalItem(null)}
        />
      )}
    </div>
  );
};

export default IndeterDetailDiario;