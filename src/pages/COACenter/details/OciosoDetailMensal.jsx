// ================================= DOCUMENTATION ------------------------------------------
// Script: OciosoDetailMensal
// Purpose: Visão detalhada do Ocioso Mensal (Ano) com hierarquia sanfona estilo Diário.
// Relationships: vw_c_ocioso_anogeral, vw_c_ocioso_anoarea, vw_c_ocioso_anofrente, vw_c_ocioso_ano.
// ==========================================================================================

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorCOA from '../../../components/COACenter/YearSelectorCOA';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine, LabelList } from 'recharts';

// ================================= VARIABLES & HELPERS ------------------------------------

const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA'];
const MONTHS_KEYS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const MONTHS_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

const formatPercent = (value) => {
  if (value === null || value === undefined) return '--';
  return `${Number(value).toFixed(1)}%`;
};

const formatHours = (valueInSecs) => {
  if (!valueInSecs) return '0.0h';
  return `${(Number(valueInSecs) / 3600).toFixed(1)}h`;
};

const formatInt = (value) => `${Math.round(Number(value || 0))}`;

const getOciosoColor = (value, target = 5) => {
  if (value === null || value === undefined) return 'var(--coa-text-muted)';
  return Number(value) <= target ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const getOciosoTint = (value, alpha = 0.10) => {
  if (value === null || value === undefined) return `rgba(255,255,255,${alpha})`;
  return Number(value) <= 5 ? `rgba(61,220,151,${alpha})` : `rgba(239,68,68,${alpha})`;
};

// ================================= SUB-COMPONENTS -----------------------------------------

const ExpandBlock = ({ expanded, children }) => (
  <div className={`grid transition-all duration-300 ease-out ${expanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
    <div className="overflow-hidden">{children}</div>
  </div>
);

// --- COMPONENTES DA HIERARQUIA (Padrão Diário) ---
const AreaRowModern = ({ area, expanded, onToggle, onClickFilter, children }) => {
  const color = getOciosoColor(area.geral);
  return (
    <div className="bg-[rgba(255,255,255,0.02)] overflow-hidden rounded-[18px]">
      <div className="w-full text-left px-4 py-3 transition-all flex items-center gap-3 cursor-pointer" style={{ background: getOciosoTint(area.geral, 0.13) }} onClick={onClickFilter}>
        <div className="min-w-0 flex flex-col flex-1">
          <span className="text-[14px] font-black text-[var(--coa-text)] truncate">{area.desc_area}</span>
          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">{formatInt(area.qnt_equip)} equipamentos</span>
        </div>
        <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">{formatHours(area.total_hrs_ocioso_seg)}</span>
        <div className="flex items-center gap-3 shrink-0">
          <span className="text-[13px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(area.geral)}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-[14px] w-6 h-6 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.1)] font-black text-[var(--coa-text)] transition-colors hover:bg-[rgba(255,255,255,0.2)]">
            {expanded ? '−' : '+'}
          </button>
        </div>
      </div>
      <ExpandBlock expanded={expanded}>
        <div className="pl-5 pr-2 py-2 flex flex-col gap-1.5 bg-[rgba(255,255,255,0.01)]">{children}</div>
      </ExpandBlock>
    </div>
  );
};

const FrenteRowModern = ({ frente, expanded, onToggle, onClickFilter, children }) => {
  const color = getOciosoColor(frente.geral);
  return (
    <div className="flex flex-col">
      <div className="w-full text-left px-3 py-2.5 transition-all bg-transparent cursor-pointer" onClick={onClickFilter}>
        <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 pb-2" style={{ borderBottom: `1px solid ${color}50` }}>
          <div className="min-w-0 flex flex-col">
            <span className="text-[12px] font-black truncate" style={{ color }}>{frente.desc_grupo}</span>
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)]">{formatInt(frente.qnt_equip)} equipamentos</span>
          </div>
          <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">{formatHours(frente.total_hrs_ocioso_seg)}</span>
          <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(frente.geral)}</span>
          <button type="button" onClick={(e) => { e.stopPropagation(); onToggle(); }} className="text-[12px] w-5 h-5 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] font-black text-[var(--coa-text)] hover:bg-[rgba(255,255,255,0.1)]">
            {expanded ? '−' : '+'}
          </button>
        </div>
      </div>
      <ExpandBlock expanded={expanded}>
        <div className="pl-6 pr-1 pt-2 flex flex-col gap-1.5">{children}</div>
      </ExpandBlock>
    </div>
  );
};

const EquipamentoRowModern = ({ item, onOpen }) => {
  const color = getOciosoColor(item.geral);
  return (
    <button type="button" onClick={() => onOpen(item)} className="w-full text-left px-3 py-2.5 transition-all hover:bg-[rgba(255,255,255,0.05)] rounded-lg" style={{ background: getOciosoTint(item.geral, 0.09) }}>
      <div className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
        <div className="min-w-0 flex flex-col">
          <span className="text-[12px] font-black text-[var(--coa-text)] truncate">{item.cod_equip}</span>
          <span className="text-[10px] font-medium text-[var(--coa-text-muted)] truncate">{item.desc_equip || ''}</span>
        </div>
        <span className="text-[11px] font-bold text-[var(--coa-text-soft)] whitespace-nowrap">{formatHours(item.total_hrs_ocioso_seg)}</span>
        <span className="text-[12px] font-black whitespace-nowrap" style={{ color }}>{formatPercent(item.geral)}</span>
      </div>
    </button>
  );
};

// --- FILTERS ---
const SelectField = ({ label, value, onChange, options = [] }) => (
  <div className="flex flex-col gap-1">
    <span className="coa-text-micro">{label}</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-[40px] rounded-[14px] border px-3 text-sm font-bold outline-none cursor-pointer transition-colors" style={{ borderColor: 'var(--coa-divider)', background: 'rgba(255,255,255,0.02)', color: 'var(--coa-text)' }}>
      <option value="Todos" style={{ background: '#0f172a', color: '#e2e8f0' }}>Todos</option>
      {options.map((option) => (
        <option key={option} value={option} style={{ background: '#0f172a', color: '#e2e8f0' }}>{option}</option>
      ))}
    </select>
  </div>
);

const FilterPanel = ({ isOpen, onToggleOpen, categoryFilter, setCategoryFilter, areaFilter, setAreaFilter, frenteFilter, setFrenteFilter, categoryOptions, areaOptions, frenteOptions }) => (
  <div className="coa-panel p-3 md:p-4 flex flex-col gap-3">
    <button type="button" onClick={onToggleOpen} className="w-full flex items-center justify-between gap-3 text-left">
      <div className="flex flex-col gap-1">
        <span className="coa-text-micro">Filtro</span>
        <span className="text-sm font-black text-[var(--coa-text)]">Resumo da Safra</span>
      </div>
      <span className="coa-badge">{isOpen ? 'Ocultar' : 'Abrir'}</span>
    </button>
    {isOpen && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
        <SelectField label="Categoria" value={categoryFilter} onChange={setCategoryFilter} options={categoryOptions} />
        <SelectField label="Área" value={areaFilter} onChange={setAreaFilter} options={areaOptions} />
        <SelectField label="Frente" value={frenteFilter} onChange={setFrenteFilter} options={frenteOptions} />
      </div>
    )}
  </div>
);

const SearchBar = ({ searchTerm, setSearchTerm, showClear, onClearAll }) => (
  <div className="flex items-end gap-2">
    <div className="flex-1 flex flex-col gap-1">
      <span className="coa-text-micro">Busca Rápida</span>
      <input type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar equipamento..." className="h-[42px] rounded-[14px] border px-4 text-sm font-bold bg-[rgba(255,255,255,0.02)] text-[var(--coa-text)] outline-none focus:border-[var(--coa-accent)] transition-colors" style={{ borderColor: 'var(--coa-divider)' }} />
    </div>
    {showClear && (
      <button type="button" onClick={onClearAll} className="h-[42px] w-[42px] rounded-[14px] border flex items-center justify-center text-sm font-black transition-colors hover:bg-[rgba(239,68,68,0.15)]" style={{ borderColor: 'var(--coa-divider)', color: 'var(--coa-danger)', background: 'rgba(239,68,68,0.08)' }} title="Limpar filtros">✕</button>
    )}
  </div>
);

// --- TOOLTIPS E MODAL EQUIPAMENTO ---
const CustomLineTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    if (data.valor === null) return null;
    return (
      <div className="coa-panel p-3 border shadow-lg flex flex-col gap-1" style={{ borderColor: 'var(--coa-border)', zIndex: 9999 }}>
        <p className="coa-text-micro mb-1">{data.mes_label}</p>
        <p className="text-sm font-black" style={{ color: getOciosoColor(data.valor, 5) }}>Ocioso: {formatPercent(data.valor)}</p>
      </div>
    );
  }
  return null;
};

const CustomLineLabel = (props) => {
  const { x, y, value } = props;
  if (value == null) return null;
  return (
    <text x={x} y={y} dy={-12} fill={getOciosoColor(value, 5)} fontSize={11} fontWeight="900" textAnchor="middle">{formatPercent(value)}</text>
  );
};

const ModalEquipamentoMensal = ({ equipRecords, initialFrente, onClose }) => {
  const [selectedFrente, setSelectedFrente] = useState(initialFrente);

  // Mapeia todas as frentes únicas que esse equipamento esteve no ano
  const frentesAvailable = useMemo(() => {
    return [...new Set(equipRecords.map(e => e.desc_grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [equipRecords]);

  // Define os dados a serem exibidos (Frente Selecionada ou Visão Global)
  const currentEquip = useMemo(() => {
    if (selectedFrente !== 'Todas') {
      return equipRecords.find(e => e.desc_grupo === selectedFrente) || equipRecords[0];
    }

    // Lógica para agregar os dados da visão "Todas as Frentes"
    const areas = [...new Set(equipRecords.map(e => e.desc_area))];
    const aggr = {
      cod_equip: equipRecords[0]?.cod_equip || '',
      desc_area: areas.length > 1 ? 'MÚLTIPLAS ÁREAS' : areas[0],
      desc_grupo: 'Todas as Frentes',
      total_hrs_operacionais_seg: equipRecords.reduce((acc, curr) => acc + Number(curr.total_hrs_operacionais_seg || 0), 0),
      total_hrs_ocioso_seg: equipRecords.reduce((acc, curr) => acc + Number(curr.total_hrs_ocioso_seg || 0), 0),
    };

    const validGeral = equipRecords.filter(r => r.geral !== null && r.geral !== undefined);
    aggr.geral = validGeral.length > 0 ? validGeral.reduce((acc, curr) => acc + Number(curr.geral), 0) / validGeral.length : null;

    MONTHS_KEYS.forEach(m => {
      const validMonths = equipRecords.filter(r => r[m] !== null && r[m] !== undefined);
      aggr[m] = validMonths.length > 0 ? validMonths.reduce((acc, curr) => acc + Number(curr[m]), 0) / validMonths.length : null;
    });

    return aggr;
  }, [selectedFrente, equipRecords]);

  const chartData = useMemo(() => MONTHS_KEYS.map((key, index) => ({
    mes_key: key, 
    mes_label: MONTHS_LABELS[index], 
    valor: currentEquip[key] !== null && currentEquip[key] !== undefined ? Number(currentEquip[key]) : null,
  })), [currentEquip]);
  
  // Calcula o Motor Ocioso (%) exato para garantir fidelidade matemática baseada nas horas reais
  const pctMotorOcioso = currentEquip.total_hrs_operacionais_seg > 0 
    ? (currentEquip.total_hrs_ocioso_seg / currentEquip.total_hrs_operacionais_seg) * 100 
    : (currentEquip.geral || 0);

  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [selectedFrente]);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="relative coa-card w-full max-w-4xl shadow-2xl border flex flex-col h-[90vh] md:h-[85vh]" style={{ borderColor: 'var(--coa-divider)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-[rgba(255,255,255,0.05)] text-[var(--coa-text-soft)] hover:text-white transition-colors z-20 border" style={{ borderColor: 'var(--coa-divider)' }}>✕</button>
        
        {/* Cabeçalho */}
        <div className="p-5 pb-4 shrink-0 flex flex-col gap-1">
          <span className="coa-text-micro pr-10">Desempenho Anual do Equipamento</span>
          <h3 className="text-2xl font-black text-[var(--coa-text)] leading-none">{currentEquip.cod_equip}</h3>
          <span className="text-sm font-bold text-[var(--coa-text-soft)]">{currentEquip.desc_area} • {currentEquip.desc_grupo}</span>
        </div>

        {/* Pílulas de Navegação de Frentes (Mobile First) */}
        <div className="w-full px-5 pb-3 border-b flex gap-2 overflow-x-auto custom-scrollbar shrink-0" style={{ borderColor: 'var(--coa-divider)' }}>
          <button
            onClick={() => setSelectedFrente('Todas')}
            className={`px-4 py-1.5 rounded-[12px] text-[11px] uppercase tracking-wide font-black whitespace-nowrap transition-colors border ${selectedFrente === 'Todas' ? 'bg-[var(--coa-text)] text-[var(--coa-bg-soft)] border-[var(--coa-text)] shadow-sm' : 'bg-[rgba(255,255,255,0.02)] text-[var(--coa-text-muted)] border-[var(--coa-divider)] hover:bg-[rgba(255,255,255,0.08)]'}`}
          >
            Todas as Frentes
          </button>
          {frentesAvailable.map(frente => (
            <button
              key={frente}
              onClick={() => setSelectedFrente(frente)}
              className={`px-4 py-1.5 rounded-[12px] text-[11px] uppercase tracking-wide font-black whitespace-nowrap transition-colors border ${selectedFrente === frente ? 'bg-[var(--coa-text)] text-[var(--coa-bg-soft)] border-[var(--coa-text)] shadow-sm' : 'bg-[rgba(255,255,255,0.02)] text-[var(--coa-text-muted)] border-[var(--coa-divider)] hover:bg-[rgba(255,255,255,0.08)]'}`}
            >
              {frente}
            </button>
          ))}
        </div>
        
        {/* Área de Conteúdo */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar flex flex-col gap-6">
          <div className="coa-panel p-4 flex flex-col gap-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--coa-text-muted)]">Curva Mensal</span>
            <div className="w-full overflow-x-auto custom-scrollbar pb-2" ref={scrollRef}>
              <div className="min-w-[550px] h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                    <XAxis dataKey="mes_label" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                    <YAxis hide domain={[0, 'dataMax + 2']} />
                    <RechartsTooltip content={<CustomLineTooltip />} cursor={{ stroke: 'var(--coa-border)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                    <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                    <Line type="monotone" dataKey="valor" stroke="var(--coa-text-soft)" strokeWidth={3} isAnimationActive={false} connectNulls={true}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (cx == null || cy == null || payload.valor === null) return null;
                        return <circle cx={cx} cy={cy} r={5} fill={getOciosoColor(payload.valor, 5)} stroke="var(--coa-bg-soft)" strokeWidth={2} />;
                      }}>
                      <LabelList content={<CustomLineLabel />} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-[rgba(255,255,255,0.02)] border rounded-[14px] p-4 flex flex-col items-center text-center justify-center transition-colors" style={{ borderColor: 'var(--coa-divider)' }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] mb-1">Hrs Operacionais</span>
              <span className="text-2xl font-black text-[var(--coa-text)]">{formatHours(currentEquip.total_hrs_operacionais_seg)}</span>
            </div>
            <div className="bg-[rgba(255,255,255,0.02)] border rounded-[14px] p-4 flex flex-col items-center text-center justify-center transition-colors" style={{ borderColor: 'var(--coa-divider)' }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] mb-1">Hrs Ociosas</span>
              <span className="text-2xl font-black" style={{ color: getOciosoColor(pctMotorOcioso, 5) }}>{formatHours(currentEquip.total_hrs_ocioso_seg)}</span>
            </div>
            <div className="bg-[rgba(255,255,255,0.02)] border rounded-[14px] p-4 flex flex-col items-center text-center justify-center transition-colors" style={{ borderColor: 'var(--coa-divider)' }}>
              <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] mb-1">Motor Ocioso (%)</span>
              <span className="text-2xl font-black" style={{ color: getOciosoColor(pctMotorOcioso, 5) }}>{formatPercent(pctMotorOcioso)}</span>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] border-b pb-1" style={{ borderColor: 'var(--coa-divider)' }}>Resumo em Tabela</span>
            <div className="grid grid-cols-3 md:grid-cols-4 gap-3 pt-1">
              {MONTHS_KEYS.map((mes, idx) => {
                const val = currentEquip[mes];
                const hasData = val !== null && val !== undefined;
                const mColor = getOciosoColor(val, 5);
                return (
                  <div key={mes} className="flex flex-col border-l-2 pl-3 py-1 bg-[rgba(255,255,255,0.01)] rounded-r-[10px]" style={{ borderColor: hasData ? mColor : 'var(--coa-divider)' }}>
                    <span className="text-[10px] font-black text-[var(--coa-text-soft)] uppercase tracking-wider">{MONTHS_LABELS[idx]}</span>
                    <span className="text-sm font-black mt-0.5" style={{ color: hasData ? mColor : 'var(--coa-text-muted)' }}>
                      {hasData ? formatPercent(val) : '--'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ================================= HIERARCHY BUILDER --------------------------------------

const buildHierarchy = (equips, areasData, frentesData) => {
  const areaMap = new Map();

  equips.forEach((equip) => {
    const areaKey = equip.desc_area || 'NÃO MAPEADO';
    const frenteKey = equip.desc_grupo || 'SEM FRENTE';

    if (!areaMap.has(areaKey)) {
      const baseArea = areasData.find(a => a.desc_area === areaKey) || {};
      areaMap.set(areaKey, {
        desc_area: areaKey,
        geral: baseArea.geral,
        total_hrs_ocioso_seg: baseArea.total_hrs_ocioso_seg,
        frentesMap: new Map(),
      });
    }

    const area = areaMap.get(areaKey);

    if (!area.frentesMap.has(frenteKey)) {
      const baseFrente = frentesData.find(f => f.desc_grupo === frenteKey && f.desc_area === areaKey) || {};
      area.frentesMap.set(frenteKey, {
        desc_grupo: frenteKey,
        geral: baseFrente.geral,
        total_hrs_ocioso_seg: baseFrente.total_hrs_ocioso_seg,
        equipamentos: [],
      });
    }

    area.frentesMap.get(frenteKey).equipamentos.push(equip);
  });

  return [...areaMap.values()].map((area) => {
    const frentes = [...area.frentesMap.values()].map((frente) => {
      frente.equipamentos.sort((a, b) => Number(b.total_hrs_ocioso_seg || 0) - Number(a.total_hrs_ocioso_seg || 0));
      return {
        ...frente,
        qnt_equip: new Set(frente.equipamentos.map(e => e.cod_equip)).size,
      };
    }).sort((a, b) => Number(b.total_hrs_ocioso_seg || 0) - Number(a.total_hrs_ocioso_seg || 0));

    return {
      ...area,
      qnt_equip: frentes.reduce((sum, f) => sum + f.qnt_equip, 0),
      frentes,
    };
  }).sort((a, b) => Number(b.total_hrs_ocioso_seg || 0) - Number(a.total_hrs_ocioso_seg || 0));
};

// ================================= EXECUTOR PRINCIPAL -------------------------------------

const OciosoDetailMensal = () => {
  const [selectedYear, setSelectedYear] = useState(null);
  const [loading, setLoading] = useState(false);

  const [dataGeral, setDataGeral] = useState([]);
  const [dataArea, setDataArea] = useState([]);
  const [dataFrente, setDataFrente] = useState([]);
  const [dataEquip, setDataEquip] = useState([]);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState('Todos');
  const [areaFilter, setAreaFilter] = useState('Todos');
  const [frenteFilter, setFrenteFilter] = useState('Todos');
  const [searchTerm, setSearchTerm] = useState('');

  const [expandedAreas, setExpandedAreas] = useState([]);
  const [expandedFrentes, setExpandedFrentes] = useState([]);
  
  // Agora armazenamos o código e a frente inicial clicada
  const [selectedEquipModal, setSelectedEquipModal] = useState(null);

  const mainChartScrollRef = useRef(null);

  useEffect(() => {
    if (!selectedYear) return;
    let mounted = true;
    const fetchAllData = async () => {
      try {
        setLoading(true);
        const [resGeral, resArea, resFrente, resEquip] = await Promise.all([
          supabase.from('vw_c_ocioso_anogeral').select('*').eq('ano', selectedYear),
          supabase.from('vw_c_ocioso_anoarea').select('*').eq('ano', selectedYear),
          supabase.from('vw_c_ocioso_anofrente').select('*').eq('ano', selectedYear),
          supabase.from('vw_c_ocioso_ano').select('*').eq('ano', selectedYear)
        ]);

        if (!mounted) return;
        const filterEmpacota = (arr) => (arr || []).filter(r => r.desc_area !== 'EMPACOTAMENTO' && r.categoria !== 'EMPACOTAMENTO');

        setDataGeral(resGeral.data || []);
        setDataArea(filterEmpacota(resArea.data));
        setDataFrente(filterEmpacota(resFrente.data));
        setDataEquip(filterEmpacota(resEquip.data));

        if (resArea.data) {
          setExpandedAreas(filterEmpacota(resArea.data).map(a => a.desc_area));
        }

      } catch (err) {
        console.error('[COA] Erro Ano:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetchAllData();
    return () => { mounted = false; };
  }, [selectedYear]);

  const categoryOptions = useMemo(() => {
    const vals = [...new Set(dataEquip.map(r => r.categoria).filter(Boolean))];
    return vals.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a); const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      return ai === -1 ? 1 : bi === -1 ? -1 : ai - bi;
    });
  }, [dataEquip]);

  const areaOptions = useMemo(() => {
    let base = dataEquip;
    if (categoryFilter !== 'Todos') base = base.filter(r => r.categoria === categoryFilter);
    return [...new Set(base.map(r => r.desc_area).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [dataEquip, categoryFilter]);

  const frenteOptions = useMemo(() => {
    let base = dataEquip;
    if (categoryFilter !== 'Todos') base = base.filter(r => r.categoria === categoryFilter);
    if (areaFilter !== 'Todos') base = base.filter(r => r.desc_area === areaFilter);
    return [...new Set(base.map(r => r.desc_grupo).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }, [dataEquip, categoryFilter, areaFilter]);

  useEffect(() => {
    if (areaFilter !== 'Todos' && !areaOptions.includes(areaFilter)) setAreaFilter('Todos');
  }, [categoryFilter, areaOptions, areaFilter]);

  useEffect(() => {
    if (frenteFilter !== 'Todos' && !frenteOptions.includes(frenteFilter)) setFrenteFilter('Todos');
  }, [areaFilter, frenteOptions, frenteFilter]);

  const filteredEquips = useMemo(() => {
    let base = dataEquip;
    if (categoryFilter !== 'Todos') base = base.filter(r => r.categoria === categoryFilter);
    if (areaFilter !== 'Todos') base = base.filter(r => r.desc_area === areaFilter);
    if (frenteFilter !== 'Todos') base = base.filter(r => r.desc_grupo === frenteFilter);
    if (searchTerm.trim()) {
      const t = searchTerm.trim().toLowerCase();
      base = base.filter(r => String(r.cod_equip).toLowerCase().includes(t) || String(r.desc_equip || '').toLowerCase().includes(t));
    }
    return base;
  }, [dataEquip, categoryFilter, areaFilter, frenteFilter, searchTerm]);

  const hierarchyRows = useMemo(() => {
    return buildHierarchy(filteredEquips, dataArea, dataFrente);
  }, [filteredEquips, dataArea, dataFrente]);

  const uniqueEquipCount = useMemo(() => {
    return new Set(filteredEquips.map(e => e.cod_equip)).size;
  }, [filteredEquips]);

  // Isola a linha de dados ativa para ser usada tanto no gráfico quanto nos novos cards
  const activeRowData = useMemo(() => {
    if (frenteFilter !== 'Todos') {
      return dataFrente.find(f => f.desc_grupo === frenteFilter && (areaFilter === 'Todos' || f.desc_area === areaFilter));
    } else if (areaFilter !== 'Todos') {
      return dataArea.find(a => a.desc_area === areaFilter);
    } else {
      return dataGeral[0];
    }
  }, [dataGeral, dataArea, dataFrente, areaFilter, frenteFilter]);

  const chartData = useMemo(() => {
    if (!activeRowData) return [];
    return MONTHS_KEYS.map((key, index) => ({
      mes_key: key, 
      mes_label: MONTHS_LABELS[index], 
      valor: activeRowData[key] !== null && activeRowData[key] !== undefined ? Number(activeRowData[key]) : null,
    }));
  }, [activeRowData]);

  useEffect(() => {
    if (mainChartScrollRef.current) mainChartScrollRef.current.scrollLeft = mainChartScrollRef.current.scrollWidth;
  }, [chartData]);

  const hasActiveFilters = categoryFilter !== 'Todos' || areaFilter !== 'Todos' || frenteFilter !== 'Todos' || searchTerm.trim() !== '';
  const clearAllFilters = () => { setCategoryFilter('Todos'); setAreaFilter('Todos'); setFrenteFilter('Todos'); setSearchTerm(''); };

  const toggleAccordionArea = (areaName) => {
    setExpandedAreas(prev => prev.includes(areaName) ? prev.filter(a => a !== areaName) : [...prev, areaName]);
  };

  const toggleAccordionFrente = (frenteKey) => {
    setExpandedFrentes(prev => prev.includes(frenteKey) ? prev.filter(f => f !== frenteKey) : [...prev, frenteKey]);
  };

  const handleClickFilterArea = (areaName) => {
    setAreaFilter(areaFilter === areaName ? 'Todos' : areaName);
    setFrenteFilter('Todos');
  };

  const handleClickFilterFrente = (frenteName) => {
    setFrenteFilter(frenteFilter === frenteName ? 'Todos' : frenteName);
  };

  return (
    <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300 relative">
      <div className="flex justify-end">
        <div className="w-full max-w-sm md:max-w-md">
          <YearSelectorCOA value={selectedYear} onChange={setSelectedYear} />
        </div>
      </div>

      {loading ? (
        <div className="coa-panel py-20 flex flex-col items-center justify-center gap-3">
          <div className="coa-loader-dots"><span /><span /><span /></div>
          <span className="coa-loader-text">Compilando dados da safra...</span>
        </div>
      ) : (
        <>
          <FilterPanel isOpen={isFilterOpen} onToggleOpen={() => setIsFilterOpen(!isFilterOpen)}
            categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter}
            areaFilter={areaFilter} setAreaFilter={setAreaFilter}
            frenteFilter={frenteFilter} setFrenteFilter={setFrenteFilter}
            categoryOptions={categoryOptions} areaOptions={areaOptions} frenteOptions={frenteOptions} />

          {/* SESSÃO DO GRÁFICO E CARDS GERAIS */}
          <div className="coa-panel p-4 flex flex-col md:flex-row gap-4">
            
            {/* Esquerda: Gráfico Ocioso */}
            <div className="flex flex-col gap-2 flex-1 min-w-0">
              <div className="flex flex-col">
                <span className="text-sm font-black text-[var(--coa-text)] uppercase tracking-wide">Motor Ocioso - {selectedYear}</span>
                <span className="text-[10px] text-[var(--coa-text-muted)] font-bold">
                  {frenteFilter !== 'Todos' ? `Frente: ${frenteFilter}` : areaFilter !== 'Todos' ? `Área: ${areaFilter}` : 'Visão Geral'}
                </span>
              </div>
              
              <div className="w-full overflow-x-auto custom-scrollbar pb-2" ref={mainChartScrollRef}>
                <div className="min-w-[550px] h-[250px] mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 25, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                      <XAxis dataKey="mes_label" stroke="var(--coa-text-muted)" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                      <YAxis hide domain={[0, 'dataMax + 2']} />
                      <RechartsTooltip content={<CustomLineTooltip />} cursor={{ stroke: 'var(--coa-border)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                      <ReferenceLine y={5} stroke="rgba(61,220,151,0.5)" strokeDasharray="3 3" strokeWidth={2} />
                      <Line type="monotone" dataKey="valor" stroke="var(--coa-text-soft)" strokeWidth={3} isAnimationActive={false} connectNulls={true}
                        dot={(props) => {
                          const { cx, cy, payload } = props;
                          if (cx == null || cy == null || payload.valor === null) return null;
                          return <circle cx={cx} cy={cy} r={5} fill={getOciosoColor(payload.valor, 5)} stroke="var(--coa-bg-soft)" strokeWidth={2} />;
                        }}>
                        <LabelList content={<CustomLineLabel />} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Direita (ou Abaixo no Mobile): Cards de Resultados */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3 shrink-0 md:w-[220px]">
              <div className="bg-[rgba(255,255,255,0.02)] border rounded-[14px] p-4 flex flex-col items-center text-center justify-center h-full min-h-[100px] transition-colors" style={{ borderColor: 'var(--coa-divider)' }}>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] mb-1">Ocioso Hrs</span>
                <span className="text-2xl font-black" style={{ color: getOciosoColor(activeRowData?.geral, 5) }}>
                  {formatHours(activeRowData?.total_hrs_ocioso_seg)}
                </span>
              </div>
              <div className="bg-[rgba(255,255,255,0.02)] border rounded-[14px] p-4 flex flex-col items-center text-center justify-center h-full min-h-[100px] transition-colors" style={{ borderColor: 'var(--coa-divider)' }}>
                <span className="text-[10px] font-black uppercase tracking-widest text-[var(--coa-text-muted)] mb-1">Resultado Geral</span>
                <span className="text-2xl font-black" style={{ color: getOciosoColor(activeRowData?.geral, 5) }}>
                  {formatPercent(activeRowData?.geral)}
                </span>
              </div>
            </div>

          </div>
          {/* FIM DA SESSÃO DO GRÁFICO E CARDS */}

          <SearchBar searchTerm={searchTerm} setSearchTerm={setSearchTerm} showClear={hasActiveFilters} onClearAll={clearAllFilters} />

          <div className="flex flex-col gap-4 pt-2">
            <div className="flex items-end justify-between px-1">
              <div className="flex flex-col gap-1">
                <h2 className="text-[1.35rem] md:text-[1.45rem] font-black uppercase tracking-tight leading-none text-[var(--coa-text)]">
                  FROTA
                </h2>
                <span className="text-sm font-black text-[var(--coa-text-soft)]">
                  Clique para filtrar o gráfico
                </span>
              </div>
              <span className="coa-badge">{uniqueEquipCount} MÁQUINAS</span>
            </div>

            {hierarchyRows.length === 0 ? (
              <div className="coa-panel p-5 text-sm font-bold text-[var(--coa-text-muted)] text-center">
                Nenhum equipamento encontrado para os filtros selecionados.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {hierarchyRows.map((area) => {
                  const areaExpanded = expandedAreas.includes(area.desc_area);

                  return (
                    <AreaRowModern key={`area_${area.desc_area}`} area={area} expanded={areaExpanded} 
                      onToggle={() => toggleAccordionArea(area.desc_area)}
                      onClickFilter={() => handleClickFilterArea(area.desc_area)}>
                      
                      {area.frentes.map((frente) => {
                        const frenteKey = `${area.desc_area}__${frente.desc_grupo}`;
                        const frenteExpanded = expandedFrentes.includes(frenteKey);

                        return (
                          <FrenteRowModern key={frenteKey} frente={frente} expanded={frenteExpanded}
                            onToggle={() => toggleAccordionFrente(frenteKey)}
                            onClickFilter={() => handleClickFilterFrente(frente.desc_grupo)}>
                            
                            <div className="flex flex-col gap-1.5">
                              {frente.equipamentos.map((equip, idx) => (
                                <EquipamentoRowModern 
                                  key={`${frenteKey}__${equip.cod_equip}__${idx}`} 
                                  item={equip} 
                                  onOpen={(item) => setSelectedEquipModal({ cod_equip: item.cod_equip, initialFrente: item.desc_grupo })} 
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
        </>
      )}

      {selectedEquipModal && (
        <ModalEquipamentoMensal 
          equipRecords={dataEquip.filter(e => e.cod_equip === selectedEquipModal.cod_equip)} 
          initialFrente={selectedEquipModal.initialFrente} 
          onClose={() => setSelectedEquipModal(null)} 
        />
      )}

    </div>
  );
};

export default OciosoDetailMensal;