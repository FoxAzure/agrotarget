// ================================= DOCUMENTATION ------------------------------------------
// Script: CbDetailDiario
// Purpose: Detalhamento diário das avaliações das Casas de Bomba.
// Relationships:
//   - vw_q_cbgeral
//   - DateSelectorQualyFlow
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../../lib/supabaseClient';
import DateSelectorQualyFlow from '../../../components/QualyFlow/DateSelectorQualyFlow';

import {
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Pie,
  PieChart,
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

  damaged: '#DC2626',
  missing: '#E97132',
  dirty: '#EAB308',
  total: '#002F8E',

  donutBackground: '#E2E8F0',
};

// Configuração da tabela seletora de Casas de Bomba.
const CB_GRID_COLUMNS = {
  cb: 1.65,
  telas: 0.55,
  caixas: 0.55,
  limpeza: 0.85,
};

const CB_FONT_SIZES = {
  header: '10px',
  content: '12px',
  limpeza: '12px',
};

const CB_GRID_COLUMN_GAP = '4px';
const CB_TABLE_MAX_HEIGHT = '280px';

const buildCbGridColumns = () => {
  return [
    `minmax(0, ${CB_GRID_COLUMNS.cb}fr)`,
    `minmax(0, ${CB_GRID_COLUMNS.telas}fr)`,
    `minmax(0, ${CB_GRID_COLUMNS.caixas}fr)`,
    `minmax(0, ${CB_GRID_COLUMNS.limpeza}fr)`,
  ].join(' ');
};

// ================================= HELPERS ------------------------------------------------

const getTodayIso = () => {
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
};

const getSafeInitialDate = (initialDate) => {
  if (
    typeof initialDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(initialDate)
  ) {
    return initialDate;
  }

  return getTodayIso();
};

const toNumber = (value) => {
  if (
    value === null ||
    value === undefined ||
    value === ''
  ) {
    return 0;
  }

  const number = Number(value);

  return Number.isNaN(number) ? 0 : number;
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

const normalizeStatus = (value) => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
};

const isConforme = (value) => {
  return normalizeStatus(value) === 'conforme';
};

const calcularLimpezaGeral = (row) => {
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
    return COLORS.blue;
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

const getPercentFromTotals = (total, problem) => {
  const totalValue = toNumber(total);
  const problemValue = toNumber(problem);

  if (totalValue <= 0) {
    return null;
  }

  const result = (
    1 - (problemValue / totalValue)
  ) * 100;

  return Math.max(0, Math.min(100, result));
};

// ================================= LOADING ------------------------------------------------

const LoadingState = () => (
  <div className="flex flex-col items-center justify-center py-16">
    <div className="qf-cuc-spinner" />

    <span className="mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
      Carregando Casas de Bomba...
    </span>
  </div>
);

// ================================= COMPONENT ----------------------------------------------

const CbDetailDiario = ({ initialDate }) => {
  const safeInitialDate = getSafeInitialDate(initialDate);

  const [selectedDate, setSelectedDate] = useState(
    safeInitialDate
  );

  const [activeYear, setActiveYear] = useState(
    Number(safeInitialDate.split('-')[0])
  );

  const [availableDates, setAvailableDates] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);

  const [loadingDates, setLoadingDates] = useState(true);
  const [loadingData, setLoadingData] = useState(true);

  const [rawData, setRawData] = useState([]);

  // Lista vazia significa que todas as Casas de Bomba estão selecionadas.
  const [selectedCbs, setSelectedCbs] = useState([]);

  const cbGridColumns = useMemo(
    () => buildCbGridColumns(),
    []
  );

  // ========================================================================================
  // 1. CONSULTA DOS ANOS DISPONÍVEIS
  // ========================================================================================

  useEffect(() => {
    let mounted = true;

    const fetchYears = async () => {
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
              .filter((year) => Number.isFinite(year))
          ),
        ].sort((a, b) => b - a);

        setAvailableYears(years);

        if (
          years.length > 0 &&
          !years.includes(activeYear)
        ) {
          setActiveYear(years[0]);
        }
      } catch (error) {
        console.error(
          '🚨 [CbDetailDiario] Erro ao carregar anos:',
          error
        );
      }
    };

    fetchYears();

    return () => {
      mounted = false;
    };
  }, []);

  // ========================================================================================
  // 2. CONSULTA DAS DATAS DO ANO
  // ========================================================================================

  useEffect(() => {
    let mounted = true;

    const fetchDates = async () => {
      if (!activeYear) {
        return;
      }

      setLoadingDates(true);

      try {
        const { data, error } = await supabase
          .from('vw_q_cbgeral')
          .select('data_ref')
          .eq('ano', activeYear)
          .order('data_ref', { ascending: false });

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        const uniqueDates = [
          ...new Set(
            (data || [])
              .map((row) => row.data_ref)
              .filter(Boolean)
          ),
        ].sort((a, b) => b.localeCompare(a));

        setAvailableDates(uniqueDates);

        if (
          uniqueDates.length > 0 &&
          !uniqueDates.includes(selectedDate)
        ) {
          setSelectedDate(uniqueDates[0]);
        }

        if (uniqueDates.length === 0) {
          setRawData([]);
        }
      } catch (error) {
        console.error(
          '🚨 [CbDetailDiario] Erro ao carregar datas:',
          error
        );

        if (mounted) {
          setAvailableDates([]);
        }
      } finally {
        if (mounted) {
          setLoadingDates(false);
        }
      }
    };

    fetchDates();

    return () => {
      mounted = false;
    };
  }, [activeYear]);

  // ========================================================================================
  // 3. CONSULTA DOS DADOS DO DIA
  // ========================================================================================

  useEffect(() => {
    let mounted = true;

    const loadDailyData = async () => {
      if (!selectedDate) {
        return;
      }

      setLoadingData(true);
      setSelectedCbs([]);

      try {
        const { data, error } = await supabase
          .from('vw_q_cbgeral')
          .select(`
            ano,
            mes,
            semana_iso,
            data_apontamento,
            data_ref,
            nro_eb,
            nome_eb,
            desc_eb,
            codigo_campo,
            campo_referencia,
            setor,
            depa,
            telas_total,
            telas_danificadas,
            telas_faltando,
            telas_suja,
            perc_telas,
            tanque,
            cx_total,
            cx_danific,
            perc_cx,
            adub_orgniz,
            adub_placas,
            adub_pallets,
            limp_ext,
            limp_int,
            limp_geral,
            ilum_ext,
            ilum_int
          `)
          .eq('data_ref', selectedDate)
          .order('nro_eb', { ascending: true });

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        setRawData(data || []);
      } catch (error) {
        console.error(
          '🚨 [CbDetailDiario] Erro ao carregar avaliação:',
          error
        );

        if (mounted) {
          setRawData([]);
        }
      } finally {
        if (mounted) {
          setLoadingData(false);
        }
      }
    };

    loadDailyData();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  // ========================================================================================
  // 4. LISTA DAS CASAS DE BOMBA
  // ========================================================================================

  const casasBomba = useMemo(() => {
    return rawData.map((row) => {
      const nroEb = Number(row.nro_eb);

      return {
        ...row,
        nroEb,

        descEb:
          row.desc_eb ||
          row.nome_eb ||
          `CB-${String(nroEb).padStart(2, '0')}`,

        percTelas: toNumber(row.perc_telas),
        percCaixas: toNumber(row.perc_cx),
        limpeza: calcularLimpezaGeral(row),
      };
    });
  }, [rawData]);

  // ========================================================================================
  // 5. FILTRO POR CASA DE BOMBA
  // ========================================================================================

  const toggleCb = (nroEb) => {
    setSelectedCbs((current) => {
      // Nenhuma seleção individual significa que todas estão ativas.
      // O primeiro clique passa a selecionar somente a CB clicada.
      if (current.length === 0) {
        return [nroEb];
      }

      // Se já estiver selecionada, remove.
      // Caso seja a última, volta automaticamente para todas.
      if (current.includes(nroEb)) {
        return current.filter(
          (item) => item !== nroEb
        );
      }

      return [...current, nroEb];
    });
  };

  const dadosFiltrados = useMemo(() => {
    if (selectedCbs.length === 0) {
      return rawData;
    }

    return rawData.filter((row) =>
      selectedCbs.includes(Number(row.nro_eb))
    );
  }, [rawData, selectedCbs]);

  // ========================================================================================
  // 6. PROCESSAMENTO DOS INDICADORES
  // ========================================================================================

  const processamento = useMemo(() => {
    if (dadosFiltrados.length === 0) {
      return null;
    }

    const totais = dadosFiltrados.reduce(
      (acc, row) => {
        acc.telasTotal += toNumber(
          row.telas_total
        );

        acc.telasDanificadas += toNumber(
          row.telas_danificadas
        );

        acc.telasFaltando += toNumber(
          row.telas_faltando
        );

        acc.telasSujas += toNumber(
          row.telas_suja
        );

        acc.caixasTotal += toNumber(
          row.cx_total
        );

        acc.caixasDanificadas += toNumber(
          row.cx_danific
        );

        acc.iluminacaoExterna += toNumber(
          row.ilum_ext
        );

        acc.iluminacaoInterna += toNumber(
          row.ilum_int
        );

        return acc;
      },
      {
        telasTotal: 0,
        telasDanificadas: 0,
        telasFaltando: 0,
        telasSujas: 0,
        caixasTotal: 0,
        caixasDanificadas: 0,
        iluminacaoExterna: 0,
        iluminacaoInterna: 0,
      }
    );

    const totalProblemasTelas =
      totais.telasDanificadas +
      totais.telasFaltando +
      totais.telasSujas;

    const percTelas = getPercentFromTotals(
      totais.telasTotal,
      totalProblemasTelas
    );

    const percCaixas = getPercentFromTotals(
      totais.caixasTotal,
      totais.caixasDanificadas
    );

    const statusAgrupado = (column) => {
      return dadosFiltrados.every((row) =>
        isConforme(row[column])
      )
        ? 'Conforme'
        : 'Não Conforme';
    };

    // Dados utilizados no gráfico de barras.
    const chartTelasData = [
      {
        name: 'Danificadas',
        value: totais.telasDanificadas,
        color: COLORS.damaged,
      },
      {
        name: 'Faltando',
        value: totais.telasFaltando,
        color: COLORS.missing,
      },
      {
        name: 'Sujas',
        value: totais.telasSujas,
        color: COLORS.dirty,
      },
    ];

    const conformidadeDonut =
      percTelas === null ? 0 : percTelas;

    const donutData = [
      {
        name: 'Conforme',
        value: conformidadeDonut,
      },
      {
        name: 'Não Conforme',
        value: Math.max(
          0,
          100 - conformidadeDonut
        ),
      },
    ];

    const statusList = [
      {
        key: 'tanque',
        label: 'Limpeza do Tanque',
        type: 'status',
        value: statusAgrupado('tanque'),
      },
      {
        key: 'caixas',
        label: 'Caixas dentro do Padrão',
        type: 'percent',
        value: percCaixas,
      },
      {
        key: 'adub_orgniz',
        label: 'Organização Adubeira',
        type: 'status',
        value: statusAgrupado('adub_orgniz'),
      },
      {
        key: 'adub_placas',
        label: 'Placas Insumos',
        type: 'status',
        value: statusAgrupado('adub_placas'),
      },
      {
        key: 'adub_pallets',
        label: 'Pallets Adubeira',
        type: 'status',
        value: statusAgrupado('adub_pallets'),
      },
      {
        key: 'limp_ext',
        label: 'Limpeza Externa',
        type: 'status',
        value: statusAgrupado('limp_ext'),
      },
      {
        key: 'limp_int',
        label: 'Limpeza Interna',
        type: 'status',
        value: statusAgrupado('limp_int'),
      },
      {
        key: 'limp_geral',
        label: 'Limpeza Geral',
        type: 'status',
        value: statusAgrupado('limp_geral'),
      },
      {
        key: 'ilum_ext',
        label: 'Iluminação Ext. Queimada',
        type: 'quantity',
        value: totais.iluminacaoExterna,
      },
      {
        key: 'ilum_int',
        label: 'Iluminação Int. Queimada',
        type: 'quantity',
        value: totais.iluminacaoInterna,
      },
    ];

    return {
      totais,
      percTelas,
      percCaixas,
      chartTelasData,
      donutData,
      statusList,
    };
  }, [dadosFiltrados]);

  // ========================================================================================
  // 7. RENDERIZAÇÃO DOS VALORES DA LISTA
  // ========================================================================================

  const renderStatusValue = (item) => {
    if (item.type === 'status') {
      return (
        <span
          className="text-[12px] font-black text-right whitespace-nowrap"
          style={{
            color: getStatusColor(item.value),
          }}
        >
          {item.value}
        </span>
      );
    }

    if (item.type === 'percent') {
      return (
        <span
          className="text-[12px] font-black text-right whitespace-nowrap tabular-nums"
          style={{
            color: getPerformanceColor(item.value),
          }}
        >
          {formatPercent(item.value)}
        </span>
      );
    }

    return (
      <span
        className="text-[12px] font-black text-right whitespace-nowrap tabular-nums"
        style={{
          color: getQuantityColor(item.value),
        }}
      >
        {formatValue(item.value, 0)}
      </span>
    );
  };

  // ========================================================================================
  // RENDER
  // ========================================================================================

  return (
    <div className="flex flex-col gap-6 w-full animate-in slide-in-from-bottom-4 duration-500 pb-10">

      {/* ================================================================================
          SELETOR DE DATA
      ================================================================================= */}

      <div className="w-full flex justify-center mb-[-10px] z-50">
        <DateSelectorQualyFlow
          value={selectedDate}
          onChange={setSelectedDate}
          availableDates={availableDates}
          activeYear={activeYear}
          onYearChange={setActiveYear}
          yearsList={availableYears}
          isLoading={loadingDates}
        />
      </div>

      {loadingData ? (
        <LoadingState />
      ) : rawData.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-slate-200 rounded-xl mt-4 shadow-sm">
          <span className="text-4xl opacity-40 mb-4 grayscale">
            💧
          </span>

          <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">
            Sem avaliações de Casas de Bomba nesta data
          </h3>
        </div>
      ) : (
        <div className="flex flex-col gap-5 mt-2">

          {/* ==============================================================================
              SELEÇÃO DAS CASAS DE BOMBA
          =============================================================================== */}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex flex-col">
                <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
                  Casas de Bomba Avaliadas
                </h4>

                <span className="text-[9px] font-bold text-slate-400 mt-1">
                  Selecione uma ou mais CBs para filtrar o relatório
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSelectedCbs([])}
                className={`
                  self-start
                  sm:self-auto
                  px-3
                  py-1.5
                  rounded-lg
                  text-[9px]
                  font-black
                  uppercase
                  tracking-widest
                  transition-all
                  ${
                    selectedCbs.length === 0
                      ? 'bg-[var(--q-green)] text-white shadow-sm'
                      : 'bg-white text-slate-500 border border-slate-200 hover:border-[var(--q-green)] hover:text-[var(--q-green)]'
                  }
                `}
              >
                Todas
              </button>
            </div>

            {/* Cabeçalho da tabela */}
            <div
              className="grid w-full min-w-0 items-center px-3 py-2 border-b-2 border-slate-100"
              style={{
                gridTemplateColumns: cbGridColumns,
                columnGap: CB_GRID_COLUMN_GAP,
              }}
            >
              <span
                className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-black uppercase tracking-wider text-slate-400 text-left"
                style={{
                  fontSize: CB_FONT_SIZES.header,
                }}
              >
                CB
              </span>

              <span
                className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
                style={{
                  fontSize: CB_FONT_SIZES.header,
                }}
              >
                Telas
              </span>

              <span
                className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
                style={{
                  fontSize: CB_FONT_SIZES.header,
                }}
              >
                Caixas
              </span>

              <span
                className="min-w-0 overflow-hidden whitespace-nowrap font-black uppercase tracking-tight text-slate-400 text-right"
                style={{
                  fontSize: CB_FONT_SIZES.header,
                }}
              >
                Limpeza
              </span>
            </div>

            {/* Linhas da tabela */}
            <div
              className="w-full min-w-0 overflow-x-hidden overflow-y-auto custom-scrollbar p-1"
              style={{
                maxHeight: CB_TABLE_MAX_HEIGHT,
              }}
            >
              {casasBomba.map((item) => {
                const isSelected =
                  selectedCbs.length === 0 ||
                  selectedCbs.includes(item.nroEb);

                const isIndividualSelection =
                  selectedCbs.includes(item.nroEb);

                return (
                  <button
                    type="button"
                    key={`${selectedDate}-${item.nroEb}`}
                    onClick={() => toggleCb(item.nroEb)}
                    className={`
                      grid
                      w-full
                      min-w-0
                      items-center
                      px-2
                      py-2.5
                      min-h-[38px]
                      rounded-lg
                      border
                      text-left
                      transition-all
                      duration-150
                      ${
                        isIndividualSelection
                          ? 'bg-green-50/80 border-green-200 shadow-sm'
                          : selectedCbs.length === 0
                            ? 'bg-white border-transparent hover:bg-slate-50'
                            : 'bg-white border-transparent opacity-45 hover:opacity-80 hover:bg-slate-50'
                      }
                    `}
                    style={{
                      gridTemplateColumns: cbGridColumns,
                      columnGap: CB_GRID_COLUMN_GAP,
                    }}
                    aria-pressed={isSelected}
                  >
                    <span
                      className={`
                        block
                        min-w-0
                        overflow-hidden
                        text-ellipsis
                        whitespace-nowrap
                        font-bold
                        text-left
                        transition-colors
                        ${
                          isIndividualSelection
                            ? 'text-[var(--q-green)]'
                            : 'text-slate-600'
                        }
                      `}
                      style={{
                        fontSize: CB_FONT_SIZES.content,
                      }}
                      title={item.descEb}
                    >
                      {item.descEb}
                    </span>

                    <span
                      className="block min-w-0 overflow-hidden whitespace-nowrap font-black text-right tracking-tight tabular-nums"
                      style={{
                        fontSize: CB_FONT_SIZES.content,
                        color: getPerformanceColor(
                          item.percTelas
                        ),
                      }}
                    >
                      {formatPercent(item.percTelas)}
                    </span>

                    <span
                      className="block min-w-0 overflow-hidden whitespace-nowrap font-black text-right tracking-tight tabular-nums"
                      style={{
                        fontSize: CB_FONT_SIZES.content,
                        color: getPerformanceColor(
                          item.percCaixas
                        ),
                      }}
                    >
                      {formatPercent(item.percCaixas)}
                    </span>

                    <span
                      className="block min-w-0 overflow-hidden text-ellipsis whitespace-nowrap font-black text-right tracking-tight"
                      style={{
                        fontSize: CB_FONT_SIZES.limpeza,
                        color: getStatusColor(
                          item.limpeza
                        ),
                      }}
                      title={item.limpeza}
                    >
                      {item.limpeza}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="bg-slate-50 border-t border-slate-100 px-4 py-2">
              <span className="block text-center text-[9px] font-bold text-slate-400">
                {selectedCbs.length === 0
                  ? `Exibindo todas as ${casasBomba.length} Casas de Bomba`
                  : `${selectedCbs.length} de ${casasBomba.length} Casas de Bomba selecionadas`}
              </span>
            </div>
          </div>

          {processamento && (
            <>
              {/* ============================================================================
                  GRÁFICO DE TELAS
              ============================================================================= */}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
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
                      data={processamento.chartTelasData}
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
                                  processamento.totais
                                    .telasTotal
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
                        y={
                          processamento.totais
                            .telasTotal
                        }
                        stroke={COLORS.total}
                        strokeWidth={2.5}
                        strokeDasharray="7 5"
                        ifOverflow="extendDomain"
                        label={{
                          value: `Total: ${formatValue(
                            processamento.totais
                              .telasTotal,
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
                        {processamento.chartTelasData.map(
                          (entry) => (
                            <Cell
                              key={entry.name}
                              fill={entry.color}
                            />
                          )
                        )}

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

                {/* Resumo abaixo do gráfico */}
                <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-slate-100">
                  <div className="flex flex-col items-center justify-center min-h-[54px] px-2 py-2 border-r border-b sm:border-b-0 border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider text-center">
                      Total
                    </span>

                    <span
                      className="text-[13px] font-black tabular-nums mt-0.5"
                      style={{
                        color: COLORS.total,
                      }}
                    >
                      {formatValue(
                        processamento.totais
                          .telasTotal,
                        0
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center min-h-[54px] px-2 py-2 sm:border-r border-b sm:border-b-0 border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider text-center">
                      Danificadas
                    </span>

                    <span
                      className="text-[13px] font-black tabular-nums mt-0.5"
                      style={{
                        color: COLORS.damaged,
                      }}
                    >
                      {formatValue(
                        processamento.totais
                          .telasDanificadas,
                        0
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center min-h-[54px] px-2 py-2 border-r border-slate-100">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider text-center">
                      Faltando
                    </span>

                    <span
                      className="text-[13px] font-black tabular-nums mt-0.5"
                      style={{
                        color: COLORS.missing,
                      }}
                    >
                      {formatValue(
                        processamento.totais
                          .telasFaltando,
                        0
                      )}
                    </span>
                  </div>

                  <div className="flex flex-col items-center justify-center min-h-[54px] px-2 py-2">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-wider text-center">
                      Sujas
                    </span>

                    <span
                      className="text-[13px] font-black tabular-nums mt-0.5"
                      style={{
                        color: COLORS.dirty,
                      }}
                    >
                      {formatValue(
                        processamento.totais
                          .telasSujas,
                        0
                      )}
                    </span>
                  </div>
                </div>
              </div>

              {/* ============================================================================
                  ROSCA DE CONFORMIDADE
              ============================================================================= */}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
                    Conformidade das Telas
                  </h4>

                  <span className="block text-[9px] font-bold text-slate-400 mt-1">
                    Resultado consolidado das Casas de Bomba selecionadas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] items-center gap-3 p-4">
                  <div className="relative w-full h-[230px]">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <PieChart>
                        <Pie
                          data={processamento.donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={68}
                          outerRadius={92}
                          startAngle={90}
                          endAngle={-270}
                          stroke="none"
                        >
                          <Cell
                            fill={getPerformanceColor(
                              processamento.percTelas
                            )}
                          />

                          <Cell
                            fill={COLORS.donutBackground}
                          />
                        </Pie>

                        <Tooltip
                          formatter={(value, name) => [
                            formatPercent(value),
                            name,
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
                      </PieChart>
                    </ResponsiveContainer>

                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span
                        className="text-[28px] font-black tracking-tighter tabular-nums"
                        style={{
                          color: getPerformanceColor(
                            processamento.percTelas
                          ),
                        }}
                      >
                        {formatPercent(
                          processamento.percTelas
                        )}
                      </span>

                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
                        Conformidade
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">
                        Total de Telas
                      </span>

                      <span className="text-[13px] font-black text-[var(--q-dark)] tabular-nums">
                        {formatValue(
                          processamento.totais
                            .telasTotal,
                          0
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">
                        Danificadas
                      </span>

                      <span className="text-[13px] font-black text-red-600 tabular-nums">
                        {formatValue(
                          processamento.totais
                            .telasDanificadas,
                          0
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">
                        Faltando
                      </span>

                      <span className="text-[13px] font-black text-orange-500 tabular-nums">
                        {formatValue(
                          processamento.totais
                            .telasFaltando,
                          0
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 p-3 bg-slate-50 rounded-xl">
                      <span className="text-[11px] font-bold text-slate-500">
                        Sujas
                      </span>

                      <span className="text-[13px] font-black text-yellow-600 tabular-nums">
                        {formatValue(
                          processamento.totais
                            .telasSujas,
                          0
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 border-t border-slate-100">
                  <div className="flex flex-col items-center py-3 border-r border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-green-600">
                      Verde
                    </span>

                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                      90% a 100%
                    </span>
                  </div>

                  <div className="flex flex-col items-center py-3 border-r border-slate-100">
                    <span className="text-[9px] font-black uppercase tracking-wider text-yellow-600">
                      Amarelo
                    </span>

                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                      80% a 89,9%
                    </span>
                  </div>

                  <div className="flex flex-col items-center py-3">
                    <span className="text-[9px] font-black uppercase tracking-wider text-red-600">
                      Vermelho
                    </span>

                    <span className="text-[9px] font-bold text-slate-400 mt-0.5">
                      Abaixo de 80%
                    </span>
                  </div>
                </div>
              </div>

              {/* ============================================================================
                  LISTA DE CONFORMIDADE
              ============================================================================= */}

              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50">
                  <h4 className="text-[10px] font-black text-[var(--q-dark)] uppercase tracking-widest">
                    Estrutura e Organização
                  </h4>

                  <span className="block text-[9px] font-bold text-slate-400 mt-1">
                    Resultado consolidado das Casas de Bomba selecionadas
                  </span>
                </div>

                <div className="flex flex-col p-2">
                  {processamento.statusList.map(
                    (item) => (
                      <div
                        key={item.key}
                        className="
                          grid
                          grid-cols-[minmax(0,1fr)_110px]
                          sm:grid-cols-[minmax(0,1fr)_140px]
                          gap-3
                          items-center
                          min-h-[42px]
                          px-3
                          py-2.5
                          border-b
                          border-slate-100
                          last:border-b-0
                          rounded-lg
                          hover:bg-slate-50/70
                          transition-colors
                        "
                      >
                        <span className="min-w-0 text-[12px] font-bold text-slate-600 leading-tight">
                          {item.label}
                        </span>

                        <div className="flex justify-end">
                          {renderStatusValue(item)}
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default CbDetailDiario;