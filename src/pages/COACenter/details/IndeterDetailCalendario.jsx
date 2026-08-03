// ================= DOCUMENTATION ------------------------------------------
// Script: IndeterDetailCalendario
// Purpose: Visão em formato de Calendário/Grid do Tempo Indeterminado.
// Relationships: vw_c_indeterminado_mensal, vw_c_indeterminado
// ==========================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';

// ================================= METAS E CONSTANTES ================================= //

const INDETER_META = 10;
const PAGE_SIZE = 1000;
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];
const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const MENSAL_COLUMNS = [
  'data', 'mes', 'ano', 'desc_area', 'desc_grupo', 'categoria', 
  'hrs_indeter_seg', 'hrs_operacionais_seg'
].join(',');

const DIARIO_COLUMNS = [
  'cod_equip', 'desc_equip', 'desc_area', 'desc_grupo', 'categoria', 
  'hrs_indeter_seg', 'hrs_operacionais_seg'
].join(',');

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

const toNumber = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;
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

// Degrade do heatmap (<=10 verde, >10 até 50+ vai escurecendo o vermelho)
const getHeatmapStyle = (perc) => {
  if (perc == null) return { bg: 'rgba(255,255,255,0.01)', text: 'var(--coa-text-muted)', border: 'var(--coa-divider)' };
  
  if (perc <= INDETER_META) {
    return {
      bg: 'rgba(61,220,151,0.08)',
      text: 'var(--coa-success)',
      border: 'rgba(61,220,151,0.2)'
    };
  }

  const excess = Math.min(perc - INDETER_META, 60); 
  const alpha = 0.15 + (excess * 0.012); 
  
  return {
    bg: `rgba(239,68,68,${alpha})`,
    text: alpha > 0.55 ? '#ffffff' : 'var(--coa-danger)',
    border: `rgba(239,68,68,${Math.min(alpha + 0.3, 1)})`
  };
};

// Lógica de virada de mês (Até dia 5, exibe o mês passado)
const getInitialPeriod = () => {
  const now = new Date();
  let m = now.getMonth();
  let y = now.getFullYear();

  if (now.getDate() <= 5) {
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return { month: m, year: y };
};

// ================================= MATEMÁTICA ================================= //

const normalizeRow = (row = {}) => ({
  ...row,
  categoria: row.categoria || 'AGRÍCOLA',
  desc_area: row.desc_area || 'NÃO MAPEADA',
  desc_grupo: row.desc_grupo || 'SEM FRENTE',
  hrs_operacionais: toNumber(row.hrs_operacionais_seg) / 3600,
  hrs_indeter: toNumber(row.hrs_indeter_seg) / 3600,
});

const aggregateRows = (rows = []) => {
  const total = rows.reduce((acc, row) => {
    acc.op += row.hrs_operacionais;
    acc.ind += row.hrs_indeter;
    return acc;
  }, { op: 0, ind: 0 });

  return {
    hrs_operacionais: total.op,
    hrs_indeter: total.ind,
    perc_indeter: total.op > 0 ? (total.ind / total.op) * 100 : 0
  };
};

const groupAndAggregate = (rows = [], keyGetter) => {
  const map = new Map();
  rows.forEach((row) => {
    const key = keyGetter(row) || 'OUTROS';
    if (!map.has(key)) map.set(key, { key, rows: [] });
    map.get(key).rows.push(row);
  });
  return [...map.values()].map((item) => ({ ...item, ...aggregateRows(item.rows) }));
};

// ================================= COMPONENTES UI ================================= //

const MonthSelector = ({ month, year, onChangePeriod }) => (
  <div className="flex items-center justify-between coa-panel p-3 md:px-5">
    <button
      onClick={() => onChangePeriod(-1)}
      className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--coa-divider)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.06)] transition-all"
    >
      ◀
    </button>
    <div className="flex flex-col items-center">
      <span className="text-[1.25rem] font-black uppercase tracking-widest text-[var(--coa-text)] leading-none">
        {MONTH_NAMES[month]}
      </span>
      <span className="text-sm font-bold text-[var(--coa-text-soft)]">{year}</span>
    </div>
    <button
      onClick={() => onChangePeriod(1)}
      className="w-10 h-10 flex items-center justify-center rounded-xl border border-[var(--coa-divider)] bg-[rgba(255,255,255,0.02)] hover:bg-[rgba(255,255,255,0.06)] transition-all"
    >
      ▶
    </button>
  </div>
);

const CategoryFilter = ({ categoryOptions = [], selectedCategories = [], onToggle, isOpen, onToggleOpen }) => (
  <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
    <button type="button" onClick={onToggleOpen} className="w-full flex items-center justify-between gap-3 text-left">
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>
        <span className="text-sm font-black text-[var(--coa-text)]">Categorias</span>
      </div>
      <span className="coa-badge">{isOpen ? 'Ocultar' : `${selectedCategories.length} ativas`}</span>
    </button>
    {isOpen && (
      <div className="flex flex-col gap-2">
        {categoryOptions.map((category) => {
          const checked = selectedCategories.includes(category);
          return (
            <label
              key={category}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-[14px] border text-sm font-bold cursor-pointer transition-colors"
              style={{
                borderColor: checked ? 'rgba(61,220,151,0.28)' : 'var(--coa-border)',
                background: checked ? 'rgba(61,220,151,0.10)' : 'rgba(255,255,255,0.02)',
                color: checked ? 'var(--coa-text)' : 'var(--coa-text-soft)',
              }}
            >
              <input type="checkbox" className="hidden" checked={checked} onChange={() => onToggle(category)} />
              <span>{category}</span>
            </label>
          );
        })}
      </div>
    )}
  </div>
);

const AreaTableMensal = ({ rows = [], selectedAreas = [], onToggleArea }) => (
  <div className="coa-panel p-0 overflow-hidden coa-area-table-home">
    <div className="grid grid-cols-[1.5fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b" style={{ borderColor: 'var(--coa-divider)' }}>
      <span className="coa-text-micro">Área</span>
      <span className="coa-text-micro text-right">Hrs Indeter.</span>
      <span className="coa-text-micro text-right">% Mensal</span>
    </div>
    <div className="coa-area-table-home__body max-h-[250px] overflow-y-auto">
      {rows.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm font-bold text-[var(--coa-text-muted)]">
          Nenhuma área no mês.
        </div>
      ) : (
        rows.map((row) => {
          const active = selectedAreas.includes(row.desc_area);
          return (
            <button
              key={row.desc_area}
              type="button"
              onClick={() => onToggleArea(row.desc_area)}
              className="w-full text-left grid grid-cols-[1.5fr_0.9fr_0.8fr] gap-2 px-4 py-3 border-b transition-colors"
              style={{
                borderColor: 'var(--coa-divider)',
                background: active ? 'rgba(61,220,151,0.08)' : 'transparent',
              }}
            >
              <span className="text-[12px] font-black text-[var(--coa-text)] truncate pr-2">
                {row.desc_area}
              </span>
              <span className="text-[12px] font-black text-right text-[var(--coa-text-soft)]">
                {formatHours(row.hrs_indeter)}
              </span>
              <span className="text-[12px] font-black text-right" style={{ color: getIndeterColor(row.perc_indeter) }}>
                {formatPercent(row.perc_indeter)}
              </span>
            </button>
          );
        })
      )}
    </div>
  </div>
);

// ================================= MAIN COMPONENT ================================= //

const IndeterDetailCalendario = () => {
  const initialPeriod = useMemo(getInitialPeriod, []);
  const [period, setPeriod] = useState(initialPeriod);
  
  const [monthlyRows, setMonthlyRows] = useState([]);
  const [loadingMonth, setLoadingMonth] = useState(true);
  
  const [selectedCategories, setSelectedCategories] = useState(['AGRÍCOLA', 'APOIO']);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [selectedAreas, setSelectedAreas] = useState([]);
  
  const [selectedDate, setSelectedDate] = useState(null);
  const [dailyRows, setDailyRows] = useState([]);
  const [loadingDay, setLoadingDay] = useState(false);

  // 1. Busca os dados do mês na view agregada
  useEffect(() => {
    let mounted = true;
    const loadMonthData = async () => {
      setLoadingMonth(true);
      setSelectedDate(null);
      setSelectedAreas([]); // Reseta áreas ao trocar de mês
      try {
        const dbMonth = period.month + 1; 
        const data = await fetchAllPages(() => 
          supabase.from('vw_c_indeterminado_mensal')
            .select(MENSAL_COLUMNS)
            .eq('mes', dbMonth)
            .eq('ano', period.year)
        );
        if (mounted) setMonthlyRows((data || []).map(normalizeRow));
      } catch (err) {
        console.error('[COA] Erro ao carregar mês (Indeterminado):', err);
      } finally {
        if (mounted) setLoadingMonth(false);
      }
    };
    loadMonthData();
    return () => { mounted = false; };
  }, [period.month, period.year]);

  // Opções de categorias dinâmicas do mês
  const categoryOptions = useMemo(() => {
    const values = [...new Set(monthlyRows.map(r => r.categoria).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
    });
  }, [monthlyRows]);

  // Filtra dados do mês pelas Categorias selecionadas
  const monthlyFilteredByCategory = useMemo(() => {
    if (!selectedCategories.length) return [];
    return monthlyRows.filter(r => selectedCategories.includes(r.categoria));
  }, [monthlyRows, selectedCategories]);

  // Agrega dados para a Tabela de Áreas
  const areaTableRows = useMemo(() => {
    return groupAndAggregate(monthlyFilteredByCategory, r => r.desc_area)
      .map(item => ({ ...item, desc_area: item.key }))
      .sort((a, b) => b.hrs_indeter - a.hrs_indeter);
  }, [monthlyFilteredByCategory]);

  // Filtra dados do mês pelas Áreas selecionadas (para montar o calendário)
  const monthlyFilteredByArea = useMemo(() => {
    if (!selectedAreas.length) return monthlyFilteredByCategory;
    return monthlyFilteredByCategory.filter(r => selectedAreas.includes(r.desc_area));
  }, [monthlyFilteredByCategory, selectedAreas]);

  // Agrega diário para o heatmap
  const calendarAggregates = useMemo(() => {
    const map = new Map();
    monthlyFilteredByArea.forEach(row => {
      if (!row.data) return;
      if (!map.has(row.data)) map.set(row.data, { op: 0, ind: 0 });
      const day = map.get(row.data);
      day.op += row.hrs_operacionais;
      day.ind += row.hrs_indeter;
    });
    return map;
  }, [monthlyFilteredByArea]);

  // Estrutura do Calendário
  const calendarDays = useMemo(() => {
    const days = [];
    const firstDay = new Date(period.year, period.month, 1);
    const lastDay = new Date(period.year, period.month + 1, 0);
    
    for (let i = 0; i < firstDay.getDay(); i++) days.push(null);
    
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dateStr = `${String(d).padStart(2, '0')}/${String(period.month + 1).padStart(2, '0')}/${period.year}`;
      const totals = calendarAggregates.get(dateStr);
      const perc = totals && totals.op > 0 ? (totals.ind / totals.op) * 100 : null;
      days.push({ dayNumber: d, dateStr, perc });
    }
    return days;
  }, [period.month, period.year, calendarAggregates]);

  // 2. Busca dados dos equipamentos do dia selecionado
  useEffect(() => {
    let mounted = true;
    const loadDayData = async () => {
      if (!selectedDate) {
        setDailyRows([]);
        return;
      }
      setLoadingDay(true);
      try {
        let query = supabase.from('vw_c_indeterminado')
          .select(DIARIO_COLUMNS)
          .eq('data', selectedDate);
          
        if (selectedCategories.length > 0) query = query.in('categoria', selectedCategories);
        if (selectedAreas.length > 0) query = query.in('desc_area', selectedAreas);

        const data = await fetchAllPages(() => query);
        if (mounted) setDailyRows((data || []).map(normalizeRow));
      } catch (err) {
        console.error('[COA] Erro ao carregar dia:', err);
      } finally {
        if (mounted) setLoadingDay(false);
      }
    };
    loadDayData();
    return () => { mounted = false; };
  }, [selectedDate, selectedCategories, selectedAreas]);

  // Processa a lista de equipamentos do dia
  const slimEquipmentList = useMemo(() => {
    return groupAndAggregate(dailyRows, r => r.cod_equip)
      .map(item => ({
        cod_equip: item.key,
        desc_equip: item.rows[0]?.desc_equip || '',
        desc_area: item.rows[0]?.desc_area || '',
        desc_grupo: item.rows[0]?.desc_grupo || '',
        ...item
      }))
      .filter(eq => eq.hrs_indeter > 0)
      .sort((a, b) => b.perc_indeter - a.perc_indeter);
  }, [dailyRows]);

  // Handlers
  const handleChangePeriod = (direction) => {
    setPeriod(prev => {
      let m = prev.month + direction;
      let y = prev.year;
      if (m < 0) { m = 11; y -= 1; }
      else if (m > 11) { m = 0; y += 1; }
      return { month: m, year: y };
    });
  };

  const handleCategoryToggle = (cat) => {
    setSelectedCategories(prev => prev.includes(cat) ? prev.filter(c => c !== cat) : [...prev, cat]);
    setSelectedAreas([]); // Reseta áreas ao mexer na categoria
  };

  const handleAreaToggle = (areaName) => {
    setSelectedAreas(prev => prev.includes(areaName) ? prev.filter(a => a !== areaName) : [...prev, areaName]);
  };

  const handleDayClick = (dayObj) => {
    if (!dayObj || dayObj.perc == null) return;
    setSelectedDate(prev => prev === dayObj.dateStr ? null : dayObj.dateStr);
  };

  return (
    <div className="flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-300">
      <MonthSelector month={period.month} year={period.year} onChangePeriod={handleChangePeriod} />

      {loadingMonth ? (
        <div className="coa-panel py-12 flex flex-col items-center justify-center gap-3">
          <div className="coa-loader-dots"><span /><span /><span /></div>
          <span className="coa-loader-text">Buscando histórico do mês...</span>
        </div>
      ) : (
        <>
          <CategoryFilter
            categoryOptions={categoryOptions}
            selectedCategories={selectedCategories}
            onToggle={handleCategoryToggle}
            isOpen={isCategoryOpen}
            onToggleOpen={() => setIsCategoryOpen(p => !p)}
          />

          <AreaTableMensal
            rows={areaTableRows}
            selectedAreas={selectedAreas}
            onToggleArea={handleAreaToggle}
          />

          <div className="coa-panel p-4 flex flex-col gap-2">
            <div className="grid grid-cols-7 gap-1 mb-2">
              {['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'].map(d => (
                <div key={d} className="text-center text-[10px] font-black text-[var(--coa-text-muted)] tracking-wider">
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} className="h-[60px]" />;
                const hasData = day.perc !== null;
                const isSelected = selectedDate === day.dateStr;
                const style = getHeatmapStyle(day.perc);

                return (
                  <button
                    key={day.dateStr}
                    onClick={() => handleDayClick(day)}
                    disabled={!hasData}
                    className={`h-[60px] md:h-[68px] flex flex-col items-center justify-center rounded-xl border transition-all ${
                      hasData ? 'cursor-pointer hover:scale-[1.02]' : 'opacity-30 cursor-not-allowed'
                    } ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-[var(--coa-bg)] scale-[1.05] shadow-lg z-10' : ''}`}
                    style={{
                      backgroundColor: style.bg,
                      borderColor: isSelected ? '#ffffff' : style.border,
                    }}
                  >
                    <span className="text-[13px] md:text-[14px] font-black leading-none" style={{ color: hasData ? style.text : 'var(--coa-text-soft)' }}>
                      {day.dayNumber}
                    </span>
                    {hasData && (
                      <span className="text-[11px] font-black mt-1 leading-none" style={{ color: style.text }}>
                        {formatPercent(day.perc)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {selectedDate && (
            <div className="coa-panel p-0 overflow-hidden border-l-4 animate-in slide-in-from-top-4 duration-300" style={{ borderLeftColor: 'var(--coa-danger)' }}>
              <div className="flex items-center justify-between px-4 py-3 bg-[rgba(255,255,255,0.02)] border-b border-[var(--coa-divider)]">
                <div className="flex flex-col">
                  <span className="text-[13px] font-black text-[var(--coa-text)]">Equipamentos Críticos</span>
                  <span className="text-[11px] font-bold text-[var(--coa-danger)]">{selectedDate}</span>
                </div>
                <button onClick={() => setSelectedDate(null)} className="text-xs font-bold text-[var(--coa-text-soft)] hover:text-white transition-colors">
                  FECHAR ✕
                </button>
              </div>

              <div className="max-h-[320px] overflow-y-auto">
                {loadingDay ? (
                  <div className="p-8 flex justify-center"><div className="coa-loader-dots"><span /><span /><span /></div></div>
                ) : slimEquipmentList.length === 0 ? (
                  <div className="p-6 text-center text-sm font-bold text-[var(--coa-text-muted)]">Nenhum indeterminado neste dia.</div>
                ) : (
                  slimEquipmentList.map((eq) => {
                    const color = getIndeterColor(eq.perc_indeter);
                    return (
                      <div key={eq.cod_equip} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-2.5 border-b border-[var(--coa-divider)] hover:bg-[rgba(255,255,255,0.015)]">
                        <div className="min-w-0 flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[12px] font-black text-[var(--coa-text)] truncate">{eq.cod_equip}</span>
                          </div>
                          <span className="text-[10px] font-bold text-[var(--coa-text-muted)] truncate uppercase tracking-wide">
                            {eq.desc_area} • {eq.desc_grupo}
                          </span>
                        </div>
                        <div className="flex flex-col items-end pr-2">
                          <span className="text-[11px] font-black text-[var(--coa-text-soft)] whitespace-nowrap">
                            {formatHHMM(eq.hrs_indeter)}
                          </span>
                        </div>
                        <div className="w-[50px] text-right">
                          <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>
                            {formatPercent(eq.perc_indeter)}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default IndeterDetailCalendario;