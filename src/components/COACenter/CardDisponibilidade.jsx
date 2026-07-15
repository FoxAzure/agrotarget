import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

const DISP_COLUMNS = [
  'data',
  'categoria',
  'hrs_total_seg',
  'hrs_manutencao_seg',
  'hrs_total',
  'hrs_manutencao'
].join(',');

const getLast7Days = (isoDate) => {
  const datesBr = [];
  const chartLabels = [];
  
  const base = new Date(`${isoDate}T12:00:00Z`); 

  for (let i = 6; i >= 0; i--) {
    const d = new Date(base);
    d.setDate(d.getDate() - i);
    
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    
    datesBr.push(`${dd}/${mm}/${yyyy}`);
    chartLabels.push({ full: `${dd}/${mm}/${yyyy}`, short: `${dd}/${mm}` });
  }
  
  return { datesBr, chartLabels };
};

const getDispMecColor = (value) => {
  const safe = Number(value || 0);
  if (safe >= 90) return 'var(--coa-success)';
  if (safe >= 80) return 'var(--coa-warning)';
  return 'var(--coa-danger)';
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;

// Retornado ao padrão visual exato do seu CardOcioso
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

const CustomDot = (props) => {
  const { cx, cy, payload } = props;
  const color = getDispMecColor(payload.disp_mec);
  
  return (
    <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--coa-bg-soft)" strokeWidth={2} />
  );
};

const CustomLabel = (props) => {
  const { x, y, value } = props;
  const color = getDispMecColor(value);

  return (
    <text
      x={x}
      y={y}
      dy={-12}
      fill={color}
      fontSize={12}
      fontWeight="900"
      textAnchor="middle"
    >
      {`${Number(value).toFixed(1)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="coa-panel p-3 border shadow-lg" style={{ borderColor: 'var(--coa-border)' }}>
        <p className="coa-text-micro mb-2">{data.fullDate}</p>
        <p className="text-sm font-black" style={{ color: getDispMecColor(data.disp_mec) }}>
          Disp. Mecânica: {data.disp_mec.toFixed(1)}%
        </p>
      </div>
    );
  }
  return null;
};

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

const CardDisponibilidade = ({ selectedDate }) => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const { datesBr, chartLabels } = useMemo(() => getLast7Days(selectedDate), [selectedDate]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError('');

        const { data, error } = await supabase
          .from('vw_c_eficiencias')
          .select(DISP_COLUMNS)
          .in('data', datesBr);

        if (error) throw error;
        if (!mounted) return;
        setRawData(data || []);
      } catch (err) {
        console.error('[COA] Erro ao carregar Disp. Mecânica:', err);
        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o gráfico de disponibilidade.');
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [datesBr]);

  const categoryOptions = useMemo(() => {
    const values = [...new Set(rawData.map((row) => row.categoria).filter(Boolean))];
    return values.sort((a, b) => {
      const ai = CATEGORY_ORDER.indexOf(a);
      const bi = CATEGORY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'pt-BR');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }, [rawData]);

  const summary = useMemo(() => {
    const filteredRows = rawData.filter((row) => selectedCategories.includes(row.categoria));
    
    let hrsTotal = 0;
    let hrsManut = 0;
    let hrsTotalSeg = 0;
    let hrsManutSeg = 0;

    filteredRows.forEach(row => {
      hrsTotal += Number(row.hrs_total || 0);
      hrsManut += Number(row.hrs_manutencao || 0);
      hrsTotalSeg += Number(row.hrs_total_seg || 0);
      hrsManutSeg += Number(row.hrs_manutencao_seg || 0);
    });

    const dispMec = hrsTotalSeg > 0 ? (1 - (hrsManutSeg / hrsTotalSeg)) * 100 : 0;

    return { hrsTotal, hrsManut, dispMec };
  }, [rawData, selectedCategories]);

  const chartData = useMemo(() => {
    const filteredRows = rawData.filter((row) => selectedCategories.includes(row.categoria));

    return chartLabels.map(({ full, short }) => {
      const dayRows = filteredRows.filter(row => row.data === full);
      
      let totalSeg = 0;
      let manutSeg = 0;

      dayRows.forEach(row => {
        totalSeg += Number(row.hrs_total_seg || 0);
        manutSeg += Number(row.hrs_manutencao_seg || 0);
      });

      const disp_mec = totalSeg > 0 ? (1 - (manutSeg / totalSeg)) * 100 : 0;

      return {
        label: short,
        fullDate: full,
        disp_mec,
      };
    });
  }, [rawData, selectedCategories, chartLabels]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) => 
      prev.includes(category) ? prev.filter((item) => item !== category) : [...prev, category]
    );
  };

  const navState = { selectedDate, selectedCategories };

  if (loading || error) {
    return (
      <section className="coa-section">
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="py-10">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="coa-loader-dots"><span /><span /><span /></div>
                  <span className="coa-loader-text">Analisando histórico mecânico...</span>
                </div>
              ) : (
                <div className="coa-empty">{error}</div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="coa-section">
      <div className="coa-card coa-card--resumo-home">
        <div className="coa-card__header">
          <h2 className="coa-text-title !mb-0">Disponibilidade Mecânica 7 Dias</h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
          
          {/* Componente MetricCard restaurado e alinhado em 3 colunas */}
          <div className="grid grid-cols-3 gap-3">
            <MetricCard label="Total Hrs" value={formatHours(summary.hrsTotal)} />
            <MetricCard label="Manutenção" value={formatHours(summary.hrsManut)} color="var(--coa-danger)" />
            <MetricCard 
              label="Disp." 
              value={`${summary.dispMec.toFixed(1)}%`} 
              color={getDispMecColor(summary.dispMec)} 
            />
          </div>

          <CategoryFilter
            categoryOptions={categoryOptions}
            selectedCategories={selectedCategories}
            onToggle={handleCategoryToggle}
            isOpen={isCategoryOpen}
            onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
          />

          <div className="coa-panel p-4 h-[280px] w-full flex flex-col mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 25, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--coa-border)" vertical={false} />
                
                <XAxis 
                  dataKey="label" 
                  stroke="var(--coa-text-muted)" 
                  fontSize={12} 
                  tickLine={false} 
                  axisLine={false} 
                  dy={10}
                />
                
                <YAxis hide={true} domain={[0, 100]} />
                
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'var(--coa-border)', strokeWidth: 1, strokeDasharray: '5 5' }} />
                
                <Line 
                  type="monotone" 
                  dataKey="disp_mec" 
                  stroke="var(--coa-text-soft)" 
                  strokeWidth={2}
                  dot={<CustomDot />}
                  activeDot={{ r: 7, stroke: 'var(--coa-text)', strokeWidth: 2 }}
                  label={<CustomLabel />}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={() => navigate('/coacenter/disponibilidade', { state: navState })}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardDisponibilidade;