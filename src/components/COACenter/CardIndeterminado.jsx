import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const DEFAULT_CATEGORIES = ['AGRÍCOLA', 'APOIO'];
const CATEGORY_ORDER = ['AGRÍCOLA', 'APOIO', 'INDÚSTRIAL', 'OFICINA', 'EMPACOTAMENTO'];

// Usando as colunas exatas da nossa nova view otimizada
const INDETER_COLUMNS = [
  'data',
  'categoria',
  'hrs_indeter_seg',
  'hrs_operacionais_seg'
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
    chartLabels.push({
      full: `${dd}/${mm}/${yyyy}`,
      short: `${dd}/${mm}`,
    });
  }

  return { datesBr, chartLabels };
};

// ================= LÓGICA DE CORES (META <= 10%) =================
const getIndeterColor = (value) => {
  const safe = Number(value || 0);
  return safe <= 10 ? 'var(--coa-success)' : 'var(--coa-danger)';
};

const formatHours = (value) => `${Number(value || 0).toFixed(1)}h`;

// ================= COMPONENTES VISUAIS =================
const MetricCard = ({ label, value, color = 'var(--coa-text)' }) => {
  return (
    <div
      className="rounded-[14px] border px-3 py-3 bg-[rgba(255,255,255,0.02)] flex flex-col justify-center"
      style={{ borderColor: 'var(--coa-divider)' }}
    >
      <span className="block text-[10px] font-black uppercase tracking-[0.14em] text-[var(--coa-text-muted)] mb-1">
        {label}
      </span>
      <span
        className="block text-[1rem] font-black tracking-tight leading-none"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  );
};

const CustomLabel = (props) => {
  const { x, y, width, value } = props;
  if (x === undefined || y === undefined || value === undefined) return null;

  const color = getIndeterColor(value);
  const centerX = x + width / 2;

  return (
    <text
      x={centerX}
      y={y}
      dy={-8}
      fill={color}
      fontSize={12}
      fontWeight="900"
      textAnchor="middle"
    >
      {`${Number(value || 0).toFixed(1)}%`}
    </text>
  );
};

const CustomTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const color = getIndeterColor(data.perc_indeter);

    return (
      <div
        className="coa-panel p-3 border shadow-lg flex flex-col gap-1"
        style={{ borderColor: 'var(--coa-border)' }}
      >
        <p className="coa-text-micro mb-1">{data.fullDate}</p>
        <p className="text-sm font-black" style={{ color }}>
          % Indeterminado: {Number(data.perc_indeter || 0).toFixed(1)}%
        </p>
        <p className="text-[12px] font-bold text-[var(--coa-text-soft)]">
          Horas: {formatHours(data.hrs_indeter)}
        </p>
      </div>
    );
  }
  return null;
};

const CategoryFilter = ({
  categoryOptions = [],
  selectedCategories = [],
  onToggle,
  isOpen,
  onToggleOpen,
}) => (
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
      <div className="flex flex-col gap-2 pt-1">
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
              <input
                type="checkbox"
                className="hidden"
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

// ================= EXECUTOR DO COMPONENTE =================
const CardIndeterminado = ({ selectedDate }) => {
  const navigate = useNavigate();

  const [rawData, setRawData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategories, setSelectedCategories] = useState(DEFAULT_CATEGORIES);
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);

  const safeSelectedDate = useMemo(() => {
    if (selectedDate) return selectedDate;
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }, [selectedDate]);

  const { datesBr, chartLabels } = useMemo(
    () => getLast7Days(safeSelectedDate),
    [safeSelectedDate]
  );
  
  const datesKey = useMemo(() => datesBr.join('|'), [datesBr]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError('');

        // Consulta direto na view otimizada. Rápido, leve e letal.
        const { data, error: supabaseError } = await supabase
          .from('vw_c_indeterminado_geral')
          .select(INDETER_COLUMNS)
          .in('data', datesBr);

        if (supabaseError) throw supabaseError;

        if (!mounted) return;
        setRawData(data || []);
      } catch (err) {
        console.error('[COA] Erro ao carregar Histórico Indeterminado:', err);
        if (!mounted) return;
        setError(err?.message || 'Falha ao carregar o gráfico de indeterminado.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [datesKey]);

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

  // Totalizador dos 3 Cards
  const summary = useMemo(() => {
    const filteredRows = rawData.filter((row) =>
      selectedCategories.includes(row.categoria)
    );

    let hrsOperacionaisSeg = 0;
    let indeterSeg = 0;

    filteredRows.forEach((row) => {
      hrsOperacionaisSeg += Number(row.hrs_operacionais_seg || 0);
      indeterSeg += Number(row.hrs_indeter_seg || 0);
    });

    const percIndeter = hrsOperacionaisSeg > 0 ? (indeterSeg / hrsOperacionaisSeg) * 100 : 0;

    return {
      hrsTotal: hrsOperacionaisSeg / 3600,
      hrsIndeter: indeterSeg / 3600,
      percIndeter
    };
  }, [rawData, selectedCategories]);

  // Preparação de dados para o Gráfico de Barras
  const chartData = useMemo(() => {
    const filteredRows = rawData.filter((row) =>
      selectedCategories.includes(row.categoria)
    );

    return chartLabels.map(({ full, short }) => {
      const dayRows = filteredRows.filter((row) => row.data === full);

      let ops = 0;
      let ind = 0;

      dayRows.forEach((row) => {
        ops += Number(row.hrs_operacionais_seg || 0);
        ind += Number(row.hrs_indeter_seg || 0);
      });

      const perc_indeter = ops > 0 ? (ind / ops) * 100 : 0;

      return {
        label: short,
        fullDate: full,
        perc_indeter,
        hrs_indeter: ind / 3600
      };
    });
  }, [rawData, selectedCategories, chartLabels]);

  const handleCategoryToggle = (category) => {
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((item) => item !== category)
        : [...prev, category]
    );
  };

  const navState = {
    selectedDate: safeSelectedDate,
    selectedCategories,
  };

  if (loading || error) {
    return (
      <section className="coa-section">
        <div className="coa-card coa-card--resumo-home">
          <div className="coa-card__body flex items-center justify-center">
            <div className="py-10">
              {loading ? (
                <div className="flex flex-col items-center justify-center gap-3">
                  <div className="coa-loader-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span className="coa-loader-text">Analisando histórico indeterminado...</span>
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
          <h2 className="coa-text-title !mb-0">
            Tempo Indeterminado 7 Dias
          </h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4 min-w-0">
          <div className="grid grid-cols-3 gap-3">
            <MetricCard
              label="Total Hrs"
              value={formatHours(summary.hrsTotal)}
            />
            <MetricCard
              label="Indeter. Hrs"
              value={formatHours(summary.hrsIndeter)}
            />
            <MetricCard
              label="Indeter. %"
              value={`${summary.percIndeter.toFixed(1)}%`}
              color={getIndeterColor(summary.percIndeter)}
            />
          </div>

          <CategoryFilter
            categoryOptions={categoryOptions}
            selectedCategories={selectedCategories}
            onToggle={handleCategoryToggle}
            isOpen={isCategoryOpen}
            onToggleOpen={() => setIsCategoryOpen((prev) => !prev)}
          />

          <div className="coa-panel p-4 h-[280px] min-h-[280px] w-full min-w-0 overflow-visible flex flex-col mt-2">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
              <BarChart
                data={chartData}
                margin={{
                  top: 24, 
                  right: 10,
                  left: 10,
                  bottom: 8,
                }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--coa-border)"
                  vertical={false}
                />
                
                <XAxis
                  dataKey="label"
                  stroke="var(--coa-text-muted)"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                  interval={0}
                  padding={{ left: 15, right: 15 }} 
                />

                <YAxis hide domain={[0, 'dataMax + 5']} />

                <Tooltip
                  content={<CustomTooltip />}
                  cursor={{ fill: 'rgba(255, 255, 255, 0.03)' }}
                />

                <Bar
                  dataKey="perc_indeter"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={45} 
                  label={<CustomLabel />}
                  isAnimationActive={false}
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={getIndeterColor(entry.perc_indeter)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-1 flex justify-end">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={() => navigate('/coacenter/indeterminado', { state: navState })}
            >
              Detalhado
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardIndeterminado;