// ================================= DOCUMENTATION ------------------------------------------
// Script: CbDetailHist
// Purpose: Exibe o histórico anual das avaliações das Casas de Bomba.
// Relationships:
//   - vw_q_cbgeral
//   - YearSelectorQualyFlow
// Features:
//   - Seleção de ano
//   - Pesquisa em tempo real
//   - Filtros por mês, DEPA e setor
//   - Ordenação da avaliação mais recente para a mais antiga
//   - Modal de detalhamento da avaliação
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import YearSelectorQualyFlow from '../../../components/QualyFlow/YearSelectorQualyFlow';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ================================= VISUAL CONFIGURATION -----------------------------------

const COLORS = {
  green: '#00B050',
  yellow: '#EAB308',
  orange: '#E97132',
  red: '#DC2626',
  blue: '#002F8E',
  slate: '#64748B',

  damaged: '#DC2626',
  missing: '#E97132',
  dirty: '#EAB308',
  total: '#002F8E',
};

const MONTHS = [
  { value: 1, label: 'Janeiro', short: 'Jan' },
  { value: 2, label: 'Fevereiro', short: 'Fev' },
  { value: 3, label: 'Março', short: 'Mar' },
  { value: 4, label: 'Abril', short: 'Abr' },
  { value: 5, label: 'Maio', short: 'Mai' },
  { value: 6, label: 'Junho', short: 'Jun' },
  { value: 7, label: 'Julho', short: 'Jul' },
  { value: 8, label: 'Agosto', short: 'Ago' },
  { value: 9, label: 'Setembro', short: 'Set' },
  { value: 10, label: 'Outubro', short: 'Out' },
  { value: 11, label: 'Novembro', short: 'Nov' },
  { value: 12, label: 'Dezembro', short: 'Dez' },
];

// Largura proporcional das colunas da lista.
const COLUMN_WIDTHS = {
  data: 0.65,
  cb: 1.7,
  telas: 0.55,
  caixas: 0.55,
  limpeza: 0.85,
};

const FONT_SIZES = {
  header: '10px',
  content: '12px',
  date: '10px',
  limpeza: '12px',
};

const GRID_COLUMN_GAP = '4px';
const TABLE_MAX_HEIGHT = '560px';

const buildGridColumns = () => {
  return [
    `minmax(0, ${COLUMN_WIDTHS.data}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.cb}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.telas}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.caixas}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.limpeza}fr)`,
  ].join(' ');
};

// ================================= HELPERS ------------------------------------------------

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') {
    return 0;
  }

  const number = Number(value);

  return Number.isNaN(number) ? 0 : number;
};

const normalizeText = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const normalizeStatus = (value) => {
  return normalizeText(value);
};

const isConforme = (value) => {
  return normalizeStatus(value) === 'conforme';
};

const formatValue = (value, decimals = 1) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '-';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return '-';
  }

  return number
    .toFixed(decimals)
    .replace('.', ',');
};

const formatPercent = (value, decimals = 1) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return '-';
  }

  return `${formatValue(value, decimals)}%`;
};

const formatShortDate = (isoDate) => {
  if (!isoDate || !isoDate.includes('-')) {
    return '-';
  }

  const [, month, day] = isoDate.split('-');
  const monthData = MONTHS[Number(month) - 1];

  return `${day}/${monthData?.short || month}`;
};

const formatFullDate = (isoDate) => {
  if (!isoDate || !isoDate.includes('-')) {
    return '-';
  }

  const [year, month, day] = isoDate.split('-');

  return `${day}/${month}/${year}`;
};

const calcularStatusLimpeza = (row) => {
  const indicadores = [
    row.adub_orgniz,
    row.adub_placas,
    row.adub_pallets,
    row.limp_ext,
    row.limp_int,
    row.limp_geral,
  ];

  return indicadores.every(isConforme)
    ? 'Conforme'
    : 'Não Conforme';
};

const getPerformanceColor = (value) => {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return COLORS.slate;
  }

  if (number >= 90) {
    return COLORS.green;
  }

  if (number >= 80) {
    return COLORS.yellow;
  }

  return COLORS.red;
};

const getStatusColor = (status) => {
  return isConforme(status)
    ? COLORS.green
    : COLORS.red;
};

const getQuantityColor = (value) => {
  return toNumber(value) === 0
    ? COLORS.green
    : COLORS.red;
};

const getMonthLabel = (month) => {
  return MONTHS.find(
    (item) => item.value === Number(month)
  )?.label || String(month);
};

// ================================= LOADING ------------------------------------------------

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="qf-cuc-spinner" />

    <span className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
      Carregando Histórico...
    </span>
  </div>
);

// ================================= MODAL HELPERS ------------------------------------------

const ModalStatusRow = ({
  label,
  value,
  type = 'status',
}) => {
  let color = COLORS.slate;
  let displayValue = value;

  if (type === 'status') {
    color = getStatusColor(value);
  }

  if (type === 'percent') {
    color = getPerformanceColor(value);
    displayValue = formatPercent(value);
  }

  if (type === 'quantity') {
    color = getQuantityColor(value);
    displayValue = formatValue(value, 0);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_110px] sm:grid-cols-[minmax(0,1fr)_140px] gap-3 items-center min-h-[42px] px-3 py-2.5 border-b border-slate-100 last:border-b-0 rounded-lg hover:bg-slate-50/70 transition-colors">
      <span className="min-w-0 text-[12px] font-bold text-slate-600 leading-tight">
        {label}
      </span>

      <span
        className="text-[12px] font-black text-right whitespace-nowrap tabular-nums"
        style={{ color }}
      >
        {displayValue}
      </span>
    </div>
  );
};

// ================================= MODAL --------------------------------------------------

const CbHistoryModal = ({ item, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      );
    };
  }, [onClose]);

  if (!item) {
    return null;
  }

  const chartData = [
    {
      name: 'Danificadas',
      value: toNumber(item.telas_danificadas),
      color: COLORS.damaged,
    },
    {
      name: 'Faltando',
      value: toNumber(item.telas_faltando),
      color: COLORS.missing,
    },
    {
      name: 'Sujas',
      value: toNumber(item.telas_suja),
      color: COLORS.dirty,
    },
  ];

  const telasTotal = toNumber(item.telas_total);
  const limpeza = calcularStatusLimpeza(item);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/55 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200"
      onMouseDown={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[92vh] bg-[var(--q-bg)] rounded-2xl shadow-2xl border border-white/30 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onMouseDown={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-4 bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
          <div className="min-w-0 flex flex-col">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
              Avaliação de Casa de Bomba
            </span>

            <h3
              className="text-[16px] sm:text-[18px] font-black text-[var(--q-dark)] uppercase tracking-tight truncate mt-1"
              title={item.desc_eb}
            >
              {item.desc_eb}
            </h3>

            <span className="text-[10px] font-bold text-slate-400 mt-1">
              {formatFullDate(item.data_ref)}
              {item.setor ? ` • ${item.setor}` : ''}
              {item.depa ? ` • ${item.depa}` : ''}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex-none flex items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600 transition-colors font-black"
            aria-label="Fechar modal"
          >
            ✕
          </button>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 sm:p-5">
          <div className="flex flex-col gap-5">

            {/* KPIs principais */}
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center justify-center min-w-0">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
                  Telas
                </span>

                <span
                  className="text-[18px] sm:text-[24px] font-black tracking-tighter mt-1 tabular-nums"
                  style={{
                    color: getPerformanceColor(
                      item.perc_telas
                    ),
                  }}
                >
                  {formatPercent(item.perc_telas)}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center justify-center min-w-0">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
                  Caixas
                </span>

                <span
                  className="text-[18px] sm:text-[24px] font-black tracking-tighter mt-1 tabular-nums"
                  style={{
                    color: getPerformanceColor(
                      item.perc_cx
                    ),
                  }}
                >
                  {formatPercent(item.perc_cx)}
                </span>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center justify-center min-w-0">
                <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
                  Limpeza
                </span>

                <span
                  className="text-[11px] sm:text-[14px] font-black mt-2 text-center leading-tight"
                  style={{
                    color: getStatusColor(limpeza),
                  }}
                >
                  {limpeza}
                </span>
              </div>
            </div>

            {/* Gráfico das telas */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
                  Situação das Telas
                </h4>

                <span className="block text-[9px] font-bold text-slate-400 mt-1">
                  A linha horizontal representa o total de telas avaliadas
                </span>
              </div>

              <div className="w-full h-[300px] p-3 sm:p-5">
                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >
                  <ComposedChart
                    data={chartData}
                    margin={{
                      top: 35,
                      right: 16,
                      left: -15,
                      bottom: 10,
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#E2E8F0"
                    />

                    <XAxis
                      dataKey="name"
                      axisLine={false}
                      tickLine={false}
                      interval={0}
                      tick={{
                        fontSize: 10,
                        fontWeight: 900,
                        fill: '#64748B',
                      }}
                    />

                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{
                        fontSize: 9,
                        fontWeight: 700,
                        fill: '#94A3B8',
                      }}
                      domain={[
                        0,
                        (dataMax) =>
                          Math.max(
                            5,
                            Math.ceil(
                              Math.max(
                                dataMax,
                                telasTotal
                              ) * 1.18
                            )
                          ),
                      ]}
                    />

                    <Tooltip
                      cursor={{
                        fill: 'rgba(241, 245, 249, 0.55)',
                      }}
                      formatter={(value) => [
                        formatValue(value, 0),
                        'Quantidade',
                      ]}
                      contentStyle={{
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0',
                        boxShadow:
                          '0 8px 24px rgba(15, 23, 42, 0.10)',
                        fontSize: '11px',
                        fontWeight: 800,
                      }}
                    />

                    <ReferenceLine
                      y={telasTotal}
                      stroke={COLORS.total}
                      strokeWidth={2.5}
                      strokeDasharray="7 5"
                      ifOverflow="extendDomain"
                      label={{
                        value: `Total: ${formatValue(
                          telasTotal,
                          0
                        )}`,
                        position: 'insideTopRight',
                        fill: COLORS.total,
                        fontSize: 10,
                        fontWeight: 900,
                      }}
                    />

                    <Bar
                      dataKey="value"
                      name="Quantidade"
                      barSize={52}
                      radius={[7, 7, 0, 0]}
                    >
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.name}
                          fill={entry.color}
                        />
                      ))}

                      <LabelList
                        dataKey="value"
                        position="top"
                        formatter={(value) =>
                          formatValue(value, 0)
                        }
                        style={{
                          fontSize: '11px',
                          fontWeight: 900,
                          fill: '#475569',
                        }}
                      />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Informações da avaliação */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <div className="p-4 bg-slate-50 border-b border-slate-100">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
                  Estrutura e Organização
                </h4>
              </div>

              <div className="flex flex-col p-2">
                <ModalStatusRow
                  label="Limpeza do Tanque"
                  value={item.tanque}
                />

                <ModalStatusRow
                  label="Caixas dentro do Padrão"
                  value={item.perc_cx}
                  type="percent"
                />

                <ModalStatusRow
                  label="Organização Adubeira"
                  value={item.adub_orgniz}
                />

                <ModalStatusRow
                  label="Placas Insumos"
                  value={item.adub_placas}
                />

                <ModalStatusRow
                  label="Pallets Adubeira"
                  value={item.adub_pallets}
                />

                <ModalStatusRow
                  label="Limpeza Externa"
                  value={item.limp_ext}
                />

                <ModalStatusRow
                  label="Limpeza Interna"
                  value={item.limp_int}
                />

                <ModalStatusRow
                  label="Limpeza Geral"
                  value={item.limp_geral}
                />

                <ModalStatusRow
                  label="Iluminação Ext. Queimada"
                  value={item.ilum_ext}
                  type="quantity"
                />

                <ModalStatusRow
                  label="Iluminação Int. Queimada"
                  value={item.ilum_int}
                  type="quantity"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-[var(--q-dark)] text-white text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-opacity"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

// ================================= COMPONENT ----------------------------------------------

const CbDetailHist = ({ initialYear }) => {
  const fallbackYear = new Date().getFullYear();

  const validInitialYear = Number(initialYear);

  const [activeYear, setActiveYear] = useState(
    Number.isFinite(validInitialYear)
      ? validInitialYear
      : fallbackYear
  );

  const [availableYears, setAvailableYears] =
    useState([]);

  const [historicoData, setHistoricoData] =
    useState([]);

  const [loadingYears, setLoadingYears] =
    useState(true);

  const [loading, setLoading] = useState(true);

  // Filtros
  const [searchCb, setSearchCb] = useState('');
  const [filtroMes, setFiltroMes] =
    useState('Todos');
  const [filtroDepa, setFiltroDepa] =
    useState('Todos');
  const [filtroSetor, setFiltroSetor] =
    useState('Todos');

  const [selectedModalItem, setSelectedModalItem] =
    useState(null);

  const gridColumns = useMemo(
    () => buildGridColumns(),
    []
  );

  // ========================================================================================
  // 1. BUSCA DOS ANOS DISPONÍVEIS
  // ========================================================================================

  useEffect(() => {
    let mounted = true;

    const fetchYears = async () => {
      setLoadingYears(true);

      try {
        const { data, error } = await supabase
          .from('vw_q_cbgeral')
          .select('ano')
          .order('ano', { ascending: false });

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        const years = [
          ...new Set(
            (data || [])
              .map((row) => Number(row.ano))
              .filter(Number.isFinite)
          ),
        ].sort((a, b) => b - a);

        setAvailableYears(years);

        // Sempre utiliza o ano mais recente quando o ano inicial
        // não existir na base.
        if (
          years.length > 0 &&
          !years.includes(activeYear)
        ) {
          setActiveYear(years[0]);
        }
      } catch (error) {
        console.error(
          '🚨 [CbDetailHist] Erro ao carregar anos:',
          error
        );

        if (mounted) {
          setAvailableYears([]);
        }
      } finally {
        if (mounted) {
          setLoadingYears(false);
        }
      }
    };

    fetchYears();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================================================================
  // 2. BUSCA DO HISTÓRICO DO ANO
  // ========================================================================================

  useEffect(() => {
    let mounted = true;

    const fetchHistorico = async () => {
      if (!activeYear) {
        return;
      }

      setLoading(true);
      setHistoricoData([]);
      setSelectedModalItem(null);

      try {
        const { data, error } = await supabase
          .from('vw_q_cbgeral')
          .select('*')
          .eq('ano', activeYear)
          .order('data_ref', { ascending: false })
          .order('nro_eb', { ascending: true });

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        setHistoricoData(data || []);
      } catch (error) {
        console.error(
          '🚨 [CbDetailHist] Erro ao carregar histórico:',
          error
        );

        if (mounted) {
          setHistoricoData([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    fetchHistorico();

    return () => {
      mounted = false;
    };
  }, [activeYear]);

  // ========================================================================================
  // 3. OPÇÕES DINÂMICAS DOS FILTROS
  // ========================================================================================

  const mesesDisponiveis = useMemo(() => {
    return [
      ...new Set(
        historicoData
          .map((item) => Number(item.mes))
          .filter(Number.isFinite)
      ),
    ].sort((a, b) => a - b);
  }, [historicoData]);

  const depasDisponiveis = useMemo(() => {
    return [
      ...new Set(
        historicoData
          .map((item) => item.depa)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [historicoData]);

  const setoresDisponiveis = useMemo(() => {
    return [
      ...new Set(
        historicoData
          .filter(
            (item) =>
              filtroDepa === 'Todos' ||
              String(item.depa) === filtroDepa
          )
          .map((item) => item.setor)
          .filter(Boolean)
      ),
    ].sort((a, b) =>
      String(a).localeCompare(String(b))
    );
  }, [historicoData, filtroDepa]);

  // ========================================================================================
  // 4. FILTRAGEM E ORDENAÇÃO
  // ========================================================================================

  const filteredAndSortedData = useMemo(() => {
    const searchTerm = normalizeText(searchCb);

    return historicoData
      .filter((item) => {
        const descCb = normalizeText(item.desc_eb);
        const nomeCb = normalizeText(item.nome_eb);
        const nroEb = normalizeText(item.nro_eb);
        const campoReferencia = normalizeText(
          item.campo_referencia
        );

        const matchSearch =
          searchTerm === '' ||
          descCb.includes(searchTerm) ||
          nomeCb.includes(searchTerm) ||
          nroEb.includes(searchTerm) ||
          campoReferencia.includes(searchTerm);

        const matchMonth =
          filtroMes === 'Todos' ||
          String(item.mes) === String(filtroMes);

        const matchDepa =
          filtroDepa === 'Todos' ||
          String(item.depa) === filtroDepa;

        const matchSetor =
          filtroSetor === 'Todos' ||
          String(item.setor) === filtroSetor;

        return (
          matchSearch &&
          matchMonth &&
          matchDepa &&
          matchSetor
        );
      })
      .map((item) => ({
        ...item,
        limpeza: calcularStatusLimpeza(item),
      }))
      .sort((a, b) => {
        const dateComparison = String(
          b.data_ref || ''
        ).localeCompare(String(a.data_ref || ''));

        if (dateComparison !== 0) {
          return dateComparison;
        }

        return (
          toNumber(a.nro_eb) -
          toNumber(b.nro_eb)
        );
      });
  }, [
    historicoData,
    searchCb,
    filtroMes,
    filtroDepa,
    filtroSetor,
  ]);

  // ========================================================================================
  // 5. RESUMO
  // ========================================================================================

  const resumo = useMemo(() => {
    const total = filteredAndSortedData.length;

    const conformes = filteredAndSortedData.filter(
      (item) =>
        Number(item.perc_telas) >= 90 &&
        Number(item.perc_cx) >= 90 &&
        isConforme(item.limpeza)
    ).length;

    const atencao = total - conformes;

    const casasUnicas = new Set(
      filteredAndSortedData.map((item) =>
        Number(item.nro_eb)
      )
    ).size;

    return {
      total,
      conformes,
      atencao,
      casasUnicas,
    };
  }, [filteredAndSortedData]);

  const hasFilters =
    searchCb.trim() !== '' ||
    filtroMes !== 'Todos' ||
    filtroDepa !== 'Todos' ||
    filtroSetor !== 'Todos';

  const limparFiltros = () => {
    setSearchCb('');
    setFiltroMes('Todos');
    setFiltroDepa('Todos');
    setFiltroSetor('Todos');
  };

  // ========================================================================================
  // RENDER
  // ========================================================================================

  return (
    <div className="flex flex-col gap-5 w-full animate-in slide-in-from-right-4 duration-300 pb-10">

      {/* ================================================================================
          SELETOR DE ANO
      ================================================================================= */}

      <div className="flex flex-col items-center">
        <YearSelectorQualyFlow
          value={activeYear}
          onChange={setActiveYear}
          availableYears={availableYears}
          isLoading={loadingYears || loading}
        />
      </div>

      {/* ================================================================================
          CARDS DE RESUMO
      ================================================================================= */}

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center gap-1">
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
            Avaliações
          </span>

          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-[var(--q-dark)]">
            {resumo.total}
          </span>

          <span className="text-[8px] font-bold text-slate-400 text-center">
            {resumo.casasUnicas} CBs
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center gap-1">
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
            Conformes
          </span>

          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-green-500">
            {resumo.conformes}
          </span>

          <span className="text-[8px] font-bold text-slate-400 text-center">
            Telas, caixas e limpeza
          </span>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-sm flex flex-col items-center gap-1">
          <span className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-wider text-center">
            Atenção
          </span>

          <span className="text-2xl sm:text-3xl font-black tracking-tighter text-red-500">
            {resumo.atencao}
          </span>

          <span className="text-[8px] font-bold text-slate-400 text-center">
            Alguma não conformidade
          </span>
        </div>
      </div>

      {/* ================================================================================
          FILTROS
      ================================================================================= */}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3">
        <div className="flex w-full gap-2 items-end">
          <div className="flex-1 flex flex-col min-w-0">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
              Casa de Bomba
            </label>

            <input
              type="text"
              placeholder="Procurar CB, campo ou código"
              value={searchCb}
              onChange={(event) =>
                setSearchCb(event.target.value)
              }
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-4 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] focus:bg-white transition-all shadow-inner"
            />
          </div>

          {hasFilters && (
            <button
              type="button"
              onClick={limparFiltros}
              className="h-[38px] px-3 sm:px-4 flex items-center justify-center gap-1.5 bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 hover:border-red-300 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-widest transition-colors shadow-sm whitespace-nowrap animate-in zoom-in duration-200"
            >
              ✕ Limpar
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
              Mês
            </label>

            <select
              value={filtroMes}
              onChange={(event) =>
                setFiltroMes(event.target.value)
              }
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">
                Todos
              </option>

              {mesesDisponiveis.map((month) => (
                <option
                  key={`month-${month}`}
                  value={month}
                >
                  {getMonthLabel(month)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
              DEPA
            </label>

            <select
              value={filtroDepa}
              onChange={(event) => {
                setFiltroDepa(event.target.value);
                setFiltroSetor('Todos');
              }}
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">
                Todos
              </option>

              {depasDisponiveis.map((depa) => (
                <option
                  key={`depa-${depa}`}
                  value={depa}
                >
                  {depa}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">
              Setor
            </label>

            <select
              value={filtroSetor}
              onChange={(event) =>
                setFiltroSetor(event.target.value)
              }
              className="w-full h-[38px] bg-slate-50 border border-slate-200 rounded-lg px-3 text-xs font-bold text-[var(--q-dark)] outline-none focus:border-[var(--q-green)] cursor-pointer shadow-inner"
            >
              <option value="Todos">
                Todos
              </option>

              {setoresDisponiveis.map((setor) => (
                <option
                  key={`sector-${setor}`}
                  value={setor}
                >
                  {setor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ================================================================================
          HISTÓRICO
      ================================================================================= */}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
              Histórico de Avaliações
            </h4>

            <span className="text-[9px] font-bold text-slate-400 mt-1">
              Mais recentes primeiro
            </span>
          </div>

          <span className="text-[10px] font-black text-slate-500 bg-white border border-slate-200 rounded-lg px-3 py-1.5 whitespace-nowrap">
            {filteredAndSortedData.length}
          </span>
        </div>

        {/* Cabeçalho */}
        <div
          className="grid w-full min-w-0 items-center px-2 sm:px-3 py-2.5 border-b-2 border-slate-100"
          style={{
            gridTemplateColumns: gridColumns,
            columnGap: GRID_COLUMN_GAP,
          }}
        >
          <span
            className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-left"
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Data
          </span>

          <span
            className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-wider text-slate-400 text-left"
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            CB
          </span>

          <span
            className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Telas
          </span>

          <span
            className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Caixas
          </span>

          <span
            className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Limpeza
          </span>
        </div>

        {/* Corpo */}
        <div
          className="flex flex-col w-full min-w-0 overflow-x-hidden overflow-y-auto custom-scrollbar relative min-h-[160px]"
          style={{
            maxHeight: TABLE_MAX_HEIGHT,
          }}
        >
          {loading ? (
            <LoadingState />
          ) : filteredAndSortedData.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center opacity-60">
              <span className="text-3xl mb-3">
                🔍
              </span>

              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                Nenhuma avaliação encontrada
              </span>
            </div>
          ) : (
            filteredAndSortedData.map(
              (item, index) => (
                <button
                  type="button"
                  key={`${item.data_ref}-${item.nro_eb}-${index}`}
                  onClick={() =>
                    setSelectedModalItem(item)
                  }
                  className="grid w-full min-w-0 items-center px-2 sm:px-3 py-2.5 min-h-[42px] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/80 transition-colors text-left group"
                  style={{
                    gridTemplateColumns: gridColumns,
                    columnGap: GRID_COLUMN_GAP,
                  }}
                >
                  <span
                    className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold text-slate-400 text-left tabular-nums"
                    style={{
                      fontSize: FONT_SIZES.date,
                    }}
                    title={formatFullDate(
                      item.data_ref
                    )}
                  >
                    {formatShortDate(item.data_ref)}
                  </span>

                  <span
                    className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-bold text-slate-600 text-left group-hover:text-[var(--q-green)] transition-colors"
                    style={{
                      fontSize: FONT_SIZES.content,
                    }}
                    title={item.desc_eb}
                  >
                    {item.desc_eb}
                  </span>

                  <span
                    className="block min-w-0 overflow-hidden whitespace-nowrap font-black text-right tracking-tight tabular-nums"
                    style={{
                      fontSize: FONT_SIZES.content,
                      color: getPerformanceColor(
                        item.perc_telas
                      ),
                    }}
                  >
                    {formatPercent(item.perc_telas)}
                  </span>

                  <span
                    className="block min-w-0 overflow-hidden whitespace-nowrap font-black text-right tracking-tight tabular-nums"
                    style={{
                      fontSize: FONT_SIZES.content,
                      color: getPerformanceColor(
                        item.perc_cx
                      ),
                    }}
                  >
                    {formatPercent(item.perc_cx)}
                  </span>

                  <span
                    className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-black text-right tracking-tight"
                    style={{
                      fontSize: FONT_SIZES.limpeza,
                      color: getStatusColor(
                        item.limpeza
                      ),
                    }}
                    title={item.limpeza}
                  >
                    {item.limpeza}
                  </span>
                </button>
              )
            )
          )}
        </div>
      </div>

      {/* ================================================================================
          MODAL
      ================================================================================= */}

      {selectedModalItem && (
        <CbHistoryModal
          item={selectedModalItem}
          onClose={() =>
            setSelectedModalItem(null)
          }
        />
      )}
    </div>
  );
};

export default CbDetailHist;