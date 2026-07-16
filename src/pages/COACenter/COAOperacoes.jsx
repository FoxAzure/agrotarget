import React, { useEffect, useMemo, useState } from 'react';
import HeaderCOACenter from '../../components/COACenter/HeaderCOACenter';
import SidebarCOACenter from '../../components/COACenter/SidebarCOACenter';
import DateSelectorCOA from '../../components/COACenter/DateSelectorCOA';
import { supabase } from '../../lib/supabaseClient';
import './Style.css';

// ================================= CONFIGURAÇÕES -----------------------------------------
const MODE_EQUIPAMENTO = 'equipamento';
const MODE_OPERADOR = 'operador';
const PAGE_SIZE = 1000;

const OPERACAO_COLUMNS = [
  'id',
  'cod_equip',
  'data',
  'desc_grupo_op',
  'desc_operacao',
  'hrs_operacionais_seg',
  'hrs_ocioso_seg',
  'status',
  'cod_op',
  'desc_area',
  'desc_grupo'
].join(',');

// ================================= HELPERS -----------------------------------------------
const toIsoDate = (date = new Date()) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const isoToBr = (isoDate) => {
  if (!isoDate || typeof isoDate !== 'string') return '';
  if (isoDate.includes('/')) return isoDate;
  if (!isoDate.includes('-')) return '';
  const [yyyy, mm, dd] = isoDate.split('-');
  return `${dd}/${mm}/${yyyy}`;
};

const brToIso = (brDate) => {
  if (!brDate || typeof brDate !== 'string' || !brDate.includes('/')) return '';
  const [dd, mm, yyyy] = brDate.split('/');
  return `${yyyy}-${String(mm).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
};

const toNumber = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const formatHHMMFromSeconds = (seconds) => {
  const safeSeconds = Math.max(0, Math.round(Number(seconds || 0)));
  const totalMinutes = Math.floor(safeSeconds / 60);
  const hh = Math.floor(totalMinutes / 60);
  const mm = totalMinutes % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};

const getGroupColor = (groupName) => {
  const group = normalizeText(groupName);
  if (group === 'PRODUTIVO') return 'var(--coa-success)';
  if (group === 'MANUTENCAO') return '#c084fc';
  if (group === 'SEM APONTAMENTO') return 'var(--coa-danger)';
  if (group === 'INDETERMINADO') return '#f6d66d';
  if (group === 'AUXILIAR') return '#fb923c';
  if (group === 'IMPRODUTIVO') return '#ff7d7d';
  if (group === 'CLIMA') return '#60a5fa';
  if (group === 'FABRICA PARADA') return '#94a3b8';
  return 'var(--coa-text-soft)';
};

const getOperatorName = (rawOperatorValue) => {
  const raw = String(rawOperatorValue || '').trim();
  const normalized = normalizeText(raw);

  if (!normalized || normalized === '-' || normalized.startsWith('9999 ')) {
    return { raw, fullName: 'NÃO DISPONÍVEL', shortName: 'NÃO DISPONÍVEL', highlight: true };
  }
  if (normalized === '99999 - EQUIPE MONITORAMENTO') {
    return { raw, fullName: 'EQUIPE MONITORAMENTO', shortName: 'EQUIPE MONITORAMENTO', highlight: true };
  }

  const parts = raw.split(' - ');
  const fullName = parts.length >= 2 ? parts.slice(1).join(' - ').trim() : raw;
  const words = fullName.split(/\s+/).filter(Boolean);

  let shortName = fullName;
  if (words.length === 1) shortName = words[0];
  else if (words.length === 2) shortName = `${words[0]} ${words[1]}`;
  else if (words.length > 2) {
    shortName = words[1].length < 4 && words[2] ? `${words[0]} ${words[1]} ${words[2]}` : `${words[0]} ${words[1]}`;
  }

  return { raw, fullName, shortName, highlight: false };
};

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

// ================================= COMPONENTES VISUAIS -----------------------------------
const TabButton = ({ active, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`w-full py-3 px-3 text-[11px] font-black uppercase tracking-[0.12em] border-b-[3px] transition-all ${
      active
        ? 'text-[var(--coa-accent)] border-[var(--coa-accent)] bg-[rgba(255,255,255,0.02)]'
        : 'text-[var(--coa-text-soft)] border-transparent hover:text-[var(--coa-text)]'
    }`}
  >
    {children}
  </button>
);

const SubFilterList = ({ mode, items = [], selectedKeys = [], onToggle, onClear }) => {
  if (items.length <= 1) return null; // Só mostra se houver mais de uma opção

  return (
    <div className="coa-panel p-0 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--coa-divider)' }}>
        <div className="flex flex-col gap-0.5">
          <span className="coa-text-micro">Filtro Secundário</span>
          <span className="text-[13px] font-black text-[var(--coa-text)]">
            {mode === MODE_EQUIPAMENTO ? 'Operadores no Equipamento' : 'Equipamentos Operados'}
          </span>
        </div>
        {selectedKeys.length > 0 && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] font-black uppercase tracking-wider px-2.5 py-1 rounded-md transition-colors"
            style={{ color: 'var(--coa-danger)', background: 'rgba(239,68,68,0.1)' }}
          >
            Limpar Filtro
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_64px_64px] gap-2 px-4 py-2 border-b bg-[rgba(255,255,255,0.01)]" style={{ borderColor: 'var(--coa-divider)' }}>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-soft)]">Operador</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-soft)] text-right">Horas</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-soft)] text-right">Ocioso</span>
      </div>

      <div className="flex flex-col max-h-[220px] overflow-y-auto">
        {items.map((item) => {
          const active = selectedKeys.includes(item.key);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggle(item.key)}
              className="grid grid-cols-[1fr_64px_64px] items-center gap-2 px-4 py-3 border-b transition-all text-left"
              style={{
                borderColor: 'var(--coa-divider)',
                background: active ? 'rgba(61,220,151,0.08)' : 'transparent'
              }}
              title={item.fullLabel}
            >
              <div className="min-w-0 flex flex-col">
                <span className="text-[12px] font-black truncate" style={{ color: item.highlight ? 'var(--coa-danger)' : active ? 'var(--coa-text)' : 'var(--coa-text-soft)' }}>
                  {item.label}
                </span>
                {mode === MODE_OPERADOR && (
                  <span className="text-[10px] font-bold text-[var(--coa-text-muted)] truncate">
                    {item.fullLabel}
                  </span>
                )}
              </div>
              <span className="text-[12px] font-black text-right text-[var(--coa-text)] whitespace-nowrap">
                {formatHHMMFromSeconds(item.totalSeg)}
              </span>
              <span className="text-[12px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap">
                {item.ociosoSeg > 0 ? formatHHMMFromSeconds(item.ociosoSeg) : '-'}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

const ExpandBlock = ({ expanded, children }) => (
  <div className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="overflow-hidden">{children}</div>
  </div>
);

const OperationGroupRow = ({ group }) => {
  const [expanded, setExpanded] = useState(false); // Fechado por padrão conforme solicitado
  const color = getGroupColor(group.desc_grupo_op);
  const isProdutivo = normalizeText(group.desc_grupo_op) === 'PRODUTIVO';

  return (
    <div className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-4 py-3 transition-all"
        style={{ background: `${color}15` }}
      >
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
          <div className="min-w-0 flex flex-col gap-0.5">
            <span className="text-[14px] font-black truncate tracking-tight" style={{ color }}>
              {group.desc_grupo_op}
            </span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
              {group.operations.length} operação(ões)
            </span>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {group.ociosoSeg > 0 && !isProdutivo && (
              <div className="hidden md:flex flex-col text-right">
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-danger)]">Ocioso</span>
                <span className="text-[12px] font-black text-[var(--coa-danger)] leading-none">
                  {formatHHMMFromSeconds(group.ociosoSeg)}
                </span>
              </div>
            )}
            <div className="flex flex-col text-right border-l pl-3" style={{ borderColor: `${color}40` }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-soft)]">Total</span>
              <span className="text-[13px] font-black whitespace-nowrap text-[var(--coa-text)] leading-none">
                {formatHHMMFromSeconds(group.totalSeg)}
              </span>
            </div>
          </div>

          <span className="text-[14px] font-black text-[var(--coa-text-muted)] w-4 text-center ml-1">
            {expanded ? '−' : '+'}
          </span>
        </div>
      </button>

      <ExpandBlock expanded={expanded}>
        <div className="pl-5 pr-4 py-3 bg-[rgba(255,255,255,0.01)]">
          <div className="border-l-2 flex flex-col gap-2 pl-3 py-1" style={{ borderColor: `${color}40` }}>
            {group.operations.map((op, idx) => (
              <div key={`${op.desc_operacao}-${idx}`} className="grid grid-cols-[1fr_auto_auto] gap-3 items-center">
                <div className="min-w-0 flex flex-col">
                  <span className="text-[12px] font-bold text-[var(--coa-text-soft)] truncate" title={op.desc_operacao}>
                    {op.desc_operacao}
                  </span>
                </div>
                
                <span className="text-[11px] font-black text-right text-[var(--coa-danger)] whitespace-nowrap w-[50px]">
                  {op.ociosoSeg > 0 && !isProdutivo ? formatHHMMFromSeconds(op.ociosoSeg) : ''}
                </span>

                <span className="text-[12px] font-black text-right text-[var(--coa-text)] whitespace-nowrap w-[50px]">
                  {formatHHMMFromSeconds(op.totalSeg)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </ExpandBlock>
    </div>
  );
};

// ================================= LOGICA DE DADOS ---------------------------------------
const buildOptions = (rows = []) => {
  const equipMap = new Map();
  const operatorMap = new Map();

  rows.forEach((row) => {
    if (row.cod_equip && !equipMap.has(row.cod_equip)) {
      equipMap.set(row.cod_equip, {
        type: MODE_EQUIPAMENTO,
        key: row.cod_equip,
        label: row.cod_equip,
        subLabel: `${row.desc_area || 'SEM ÁREA'} - ${row.desc_grupo || 'SEM FRENTE'}`,
        searchStr: normalizeText(`${row.cod_equip} ${row.desc_area} ${row.desc_grupo}`)
      });
    }

    if (row.cod_op && !operatorMap.has(row.cod_op)) {
      const op = getOperatorName(row.cod_op);
      operatorMap.set(row.cod_op, {
        type: MODE_OPERADOR,
        key: row.cod_op,
        raw_cod_op: row.cod_op,
        label: op.shortName,
        fullLabel: op.fullName,
        highlight: op.highlight,
        subLabel: 'Operador',
        searchStr: normalizeText(`${row.cod_op} ${op.fullName}`)
      });
    }
  });

  return {
    equipamentos: [...equipMap.values()].sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')),
    operadores: [...operatorMap.values()].sort((a, b) => a.fullLabel.localeCompare(b.fullLabel, 'pt-BR'))
  };
};

const buildOperationGroups = (rows = []) => {
  const groupMap = new Map();

  rows.forEach((row) => {
    const groupKey = row.desc_grupo_op || 'SEM GRUPO';
    const opKey = row.desc_operacao || 'SEM OPERACAO';

    if (!groupMap.has(groupKey)) {
      groupMap.set(groupKey, {
        desc_grupo_op: groupKey,
        totalSeg: 0,
        ociosoSeg: 0,
        operationsMap: new Map()
      });
    }

    const group = groupMap.get(groupKey);
    group.totalSeg += toNumber(row.hrs_operacionais_seg);
    group.ociosoSeg += toNumber(row.hrs_ocioso_seg);

    if (!group.operationsMap.has(opKey)) {
      group.operationsMap.set(opKey, { desc_operacao: opKey, totalSeg: 0, ociosoSeg: 0 });
    }
    const opItem = group.operationsMap.get(opKey);
    opItem.totalSeg += toNumber(row.hrs_operacionais_seg);
    opItem.ociosoSeg += toNumber(row.hrs_ocioso_seg);
  });

  return [...groupMap.values()]
    .map((group) => ({
      ...group,
      operations: [...group.operationsMap.values()].sort((a, b) => b.totalSeg - a.totalSeg)
    }))
    .sort((a, b) => b.totalSeg - a.totalSeg);
};

const buildSubFilters = (mode, rows = []) => {
  const map = new Map();

  rows.forEach((row) => {
    let key, label, fullLabel, highlight = false;

    if (mode === MODE_EQUIPAMENTO) {
      key = row.cod_op || 'SEM OPERADOR';
      const op = getOperatorName(key);
      label = op.shortName;
      fullLabel = op.fullName;
      highlight = op.highlight;
    } else {
      key = row.cod_equip || 'SEM EQUIPAMENTO';
      label = key;
      fullLabel = `${row.desc_area || 'SEM ÁREA'} - ${row.desc_grupo || 'SEM FRENTE'}`;
    }

    if (!map.has(key)) {
      map.set(key, { key, label, fullLabel, highlight, totalSeg: 0, ociosoSeg: 0 });
    }
    const item = map.get(key);
    item.totalSeg += toNumber(row.hrs_operacionais_seg);
    item.ociosoSeg += toNumber(row.hrs_ocioso_seg);
  });

  return [...map.values()].sort((a, b) => b.totalSeg - a.totalSeg);
};

// ================================= COMPONENTE PRINCIPAL ----------------------------------
const COAOperacoes = () => {
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [availableDates, setAvailableDates] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [mode, setMode] = useState(MODE_EQUIPAMENTO);
  const [query, setQuery] = useState('');
  const [selectedEntity, setSelectedEntity] = useState(null);
  const [selectedCrossKeys, setSelectedCrossKeys] = useState([]);

  const todayIso = useMemo(() => toIsoDate(new Date()), []);

  useEffect(() => {
    let mounted = true;
    const loadAvailableDates = async () => {
      try {
        const { data, error: dateError } = await supabase.from('vw_c_datas').select('data');
        if (dateError) throw dateError;
        const normalizedDates = [...new Set((data || []).map((r) => brToIso(r.data)).filter(Boolean))]
          .sort((a, b) => a.localeCompare(b));

        if (!mounted) return;
        setAvailableDates(normalizedDates);
        if (normalizedDates.length && !normalizedDates.includes(selectedDate)) {
          setSelectedDate(normalizedDates[normalizedDates.length - 1]);
        }
      } catch (err) {
        console.error('[COA][Operacoes] Erro ao carregar datas:', err);
      }
    };
    loadAvailableDates();
    return () => { mounted = false; };
  }, [selectedDate]);

  useEffect(() => {
    let mounted = true;
    const loadRows = async () => {
      try {
        setLoading(true);
        setError('');
        const selectedBrDate = isoToBr(selectedDate);
        const data = await fetchAllPages(() =>
          supabase
            .from('tb_c_operacao')
            .select(OPERACAO_COLUMNS)
            .eq('data', selectedBrDate)
            .eq('status', 'ATIVO')
            .order('id', { ascending: true })
        );
        if (!mounted) return;
        setRows(data || []);
      } catch (err) {
        console.error('[COA][Operacoes] Erro ao carregar operacoes:', err);
        if (!mounted) return;
        setRows([]);
        setError('Falha ao carregar as operações da data selecionada.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    loadRows();
    return () => { mounted = false; };
  }, [selectedDate]);

  const { equipamentos, operadores } = useMemo(() => buildOptions(rows), [rows]);

  const suggestions = useMemo(() => {
    const term = normalizeText(query);
    if (!term) return [];
    const base = mode === MODE_EQUIPAMENTO ? equipamentos : operadores;
    return base.filter((item) => item.searchStr.includes(term)).slice(0, 15);
  }, [mode, query, equipamentos, operadores]);

  const entityRows = useMemo(() => {
    if (!selectedEntity) return [];
    if (selectedEntity.type === MODE_EQUIPAMENTO) {
      return rows.filter((r) => r.cod_equip === selectedEntity.key);
    }
    return rows.filter((r) => r.cod_op === selectedEntity.raw_cod_op);
  }, [rows, selectedEntity]);

  const subFilterItems = useMemo(() => buildSubFilters(mode, entityRows), [mode, entityRows]);

  const finalRows = useMemo(() => {
    if (!selectedCrossKeys.length) return entityRows;
    if (mode === MODE_EQUIPAMENTO) {
      return entityRows.filter((r) => selectedCrossKeys.includes(r.cod_op || 'SEM OPERADOR'));
    }
    return entityRows.filter((r) => selectedCrossKeys.includes(r.cod_equip || 'SEM EQUIPAMENTO'));
  }, [entityRows, mode, selectedCrossKeys]);

  const totalSeg = useMemo(() => finalRows.reduce((acc, r) => acc + toNumber(r.hrs_operacionais_seg), 0), [finalRows]);
  const groupedOperations = useMemo(() => buildOperationGroups(finalRows), [finalRows]);

  const handleModeChange = (newMode) => {
    setMode(newMode);
    setQuery('');
    setSelectedEntity(null);
    setSelectedCrossKeys([]);
  };

  const handleSelect = (item) => {
    setSelectedEntity(item);
    setMode(item.type);
    setQuery('');
    setSelectedCrossKeys([]);
  };

  const handleToggleCrossKey = (key) => {
    setSelectedCrossKeys((prev) => prev.includes(key) ? prev.filter((i) => i !== key) : [...prev, key]);
  };

  const handleClearSearch = () => {
    setSelectedEntity(null);
    setQuery('');
    setSelectedCrossKeys([]);
  };

  return (
    <div className="coa-theme min-h-screen">
      <HeaderCOACenter onMenuOpen={() => setSidebarOpen(true)} />
      <SidebarCOACenter isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="coa-container py-5 md:py-6 flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h1 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
            OPERAÇÕES
          </h1>
        </div>

        <div className="flex justify-end">
          <div className="w-full max-w-sm md:max-w-md">
            <DateSelectorCOA value={selectedDate} onChange={setSelectedDate} maxDate={todayIso} availableDates={availableDates} />
          </div>
        </div>

        {/* PAINEL DE BUSCA */}
        <div className="coa-panel p-3 md:p-4 flex flex-col gap-4">
          <div className="grid grid-cols-2 w-full border-b" style={{ borderColor: 'var(--coa-divider)' }}>
            <TabButton active={mode === MODE_EQUIPAMENTO} onClick={() => handleModeChange(MODE_EQUIPAMENTO)}>
              Equipamento
            </TabButton>
            <TabButton active={mode === MODE_OPERADOR} onClick={() => handleModeChange(MODE_OPERADOR)}>
              Operador
            </TabButton>
          </div>

          {!selectedEntity ? (
            <div className="flex flex-col gap-2">
              <span className="coa-text-micro">
                {mode === MODE_EQUIPAMENTO ? 'Buscar equipamento' : 'Buscar operador'}
              </span>
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={mode === MODE_EQUIPAMENTO ? 'Digite o código...' : 'Digite matrícula ou nome...'}
                  className="w-full h-[44px] rounded-[14px] border px-4 pr-10 text-sm font-bold bg-[rgba(255,255,255,0.02)] text-[var(--coa-text)] outline-none focus:border-[var(--coa-accent)] transition-colors"
                  style={{ borderColor: 'var(--coa-divider)' }}
                />
                {query.trim() && (
                  <button
                    onClick={() => setQuery('')}
                    className="absolute right-3 text-[var(--coa-text-soft)] hover:text-[var(--coa-danger)] transition-colors text-lg"
                    title="Limpar busca"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ) : null}

          {query.trim() && !selectedEntity && (
            <div className="flex flex-col gap-2">
              {suggestions.length === 0 ? (
                <div className="rounded-[14px] border px-4 py-4 text-sm font-bold text-[var(--coa-text-muted)] text-center" style={{ borderColor: 'var(--coa-divider)' }}>
                  Nenhuma opção encontrada na data selecionada.
                </div>
              ) : (
                suggestions.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelect(item)}
                    className="w-full text-left rounded-[14px] border px-4 py-3 transition-all hover:bg-[rgba(255,255,255,0.04)] active:scale-[0.99]"
                    style={{ borderColor: 'var(--coa-divider)', background: 'rgba(255,255,255,0.02)' }}
                  >
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-black" style={{ color: item.highlight ? 'var(--coa-danger)' : 'var(--coa-text)' }}>
                        {item.label}
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                        {item.subLabel}
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}
        </div>

        {loading && (
          <div className="coa-card coa-card--resumo-home">
            <div className="coa-card__body flex items-center justify-center py-10">
              <div className="flex flex-col items-center gap-3">
                <div className="coa-loader-dots"><span /><span /><span /></div>
                <span className="coa-loader-text">Coletando dados...</span>
              </div>
            </div>
          </div>
        )}

        {!loading && error && (
          <div className="coa-card"><div className="coa-card__body"><div className="coa-empty text-[var(--coa-danger)]">{error}</div></div></div>
        )}

        {!loading && !error && selectedEntity && (
          <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
            
            {/* CABEÇALHO DO ITEM SELECIONADO */}
            <div className="coa-panel p-4 md:p-5 flex flex-col gap-3 relative overflow-hidden" style={{ borderColor: 'rgba(61,220,151,0.22)', background: 'rgba(61,220,151,0.05)' }}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 min-w-0">
                  <span className="coa-text-micro" style={{ color: 'var(--coa-success)' }}>
                    {mode === MODE_EQUIPAMENTO ? 'Equipamento Selecionado' : 'Operador Selecionado'}
                  </span>
                  <h2 className="text-[1.25rem] md:text-[1.35rem] font-black uppercase tracking-tight text-[var(--coa-text)] leading-tight truncate">
                    {selectedEntity.label}
                  </h2>
                  <span className="text-sm font-bold text-[var(--coa-text-soft)]">
                    {selectedEntity.subLabel}
                  </span>
                </div>
                
                <button
                  onClick={handleClearSearch}
                  className="coa-badge hover:scale-105 transition-transform shrink-0"
                  style={{ color: 'var(--coa-text)', borderColor: 'var(--coa-border)', background: 'rgba(255,255,255,0.05)' }}
                >
                  Nova Busca
                </button>
              </div>
            </div>

            {/* A LISTA DE OPERADORES/EQUIPAMENTOS PARA FILTRAR COM HORAS E OCIOSO */}
            <SubFilterList
              mode={mode}
              items={subFilterItems}
              selectedKeys={selectedCrossKeys}
              onToggle={handleToggleCrossKey}
              onClear={() => setSelectedCrossKeys([])}
            />

            {/* OPERAÇÕES AGRUPADAS */}
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-[11px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">
                  Estrutura de Operações
                </span>
                <span className="text-[11px] font-black uppercase tracking-widest text-[var(--coa-text)] bg-[rgba(255,255,255,0.05)] px-3 py-1.5 rounded-md border border-[var(--coa-divider)]">
                  Total Filtrado: {formatHHMMFromSeconds(totalSeg)}
                </span>
              </div>
              
              {groupedOperations.length === 0 ? (
                <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)] text-center">
                  Nenhuma operação para os filtros aplicados.
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {groupedOperations.map((group) => (
                    <OperationGroupRow key={group.desc_grupo_op} group={group} />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default COAOperacoes;