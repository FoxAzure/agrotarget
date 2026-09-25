// ================================= DOCUMENTATION ------------------------------------------
// Script: CardCb
// Purpose: Exibe as Casas de Bomba avaliadas na data selecionada.
// Relationships:
//   - vw_q_cbgeral
//   - QualyFlowHome
// Route:
//   - /qualyflow/casabomba
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';

// ================================= VISUAL CONFIGURATION -----------------------------------

// Largura proporcional das colunas.
//
// Os valores não representam pixels.
// Eles definem a proporção ocupada por cada coluna.
//
// Caso queira aumentar a coluna da CB:
// cb: 2.00
//
// Caso queira dar mais espaço para "Não Conforme":
// limpeza: 1.00

const COLUMN_WIDTHS = {
  cb: 1.65,
  telas: 0.55,
  caixas: 0.55,
  limpeza: 0.85,
};

// Tamanho fixo das fontes.
//
// O tamanho será mantido tanto no celular quanto no desktop.
// O conteúdo que não couber será cortado com reticências.

const FONT_SIZES = {
  header: '10px',
  content: '12px',
  limpeza: '12px',
};

// Espaçamento horizontal entre as colunas.
const GRID_COLUMN_GAP = '4px';

// Altura máxima da lista antes de ativar o scroll vertical.
const TABLE_MAX_HEIGHT = '240px';

const buildGridColumns = () => {
  return [
    `minmax(0, ${COLUMN_WIDTHS.cb}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.telas}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.caixas}fr)`,
    `minmax(0, ${COLUMN_WIDTHS.limpeza}fr)`,
  ].join(' ');
};

// ================================= HELPERS ------------------------------------------------

const formatPercent = (value, decimals = 1) => {
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

  return `${number.toFixed(decimals).replace('.', ',')}%`;
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

const calcularStatusLimpeza = (row) => {
  const indicadores = [
    row.adub_orgniz,
    row.adub_placas,
    row.adub_pallets,
    row.limp_ext,
    row.limp_int,
    row.limp_geral,
  ];

  const todosConformes = indicadores.every(isConforme);

  return todosConformes
    ? 'Conforme'
    : 'Não Conforme';
};

const getPercentColor = (value) => {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 'var(--q-dark)';
  }

  if (number >= 100) {
    return '#00B050';
  }

  return '#E97132';
};

const getCleaningColor = (status) => {
  return status === 'Conforme'
    ? '#00B050'
    : '#DC2626';
};

const LoadingSpinner = () => (
  <div className="qf-cuc-loading">
    <div className="qf-cuc-spinner" />
  </div>
);

// ================================= COMPONENT ----------------------------------------------

const CardCb = ({ selectedDate }) => {
  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [hasData, setHasData] = useState(false);
  const [casasBomba, setCasasBomba] = useState([]);

  const gridColumns = useMemo(
    () => buildGridColumns(),
    []
  );

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setIsLoading(true);
      setHasData(false);
      setCasasBomba([]);

      try {
        if (!selectedDate) {
          return;
        }

        const { data, error } = await supabase
          .from('vw_q_cbgeral')
          .select(`
            nro_eb,
            nome_eb,
            desc_eb,
            data_ref,
            perc_telas,
            perc_cx,
            adub_orgniz,
            adub_placas,
            adub_pallets,
            limp_ext,
            limp_int,
            limp_geral
          `)
          .eq('data_ref', selectedDate)
          .order('nro_eb', { ascending: true });

        if (error) {
          throw error;
        }

        if (!mounted) {
          return;
        }

        const rows = data || [];

        if (rows.length === 0) {
          setCasasBomba([]);
          setHasData(false);
          return;
        }

        const lista = rows.map((row) => {
          const nroEb = Number(row.nro_eb);

          const nomeEbPadrao =
            row.nome_eb ||
            `CB-${String(row.nro_eb).padStart(2, '0')}`;

          return {
            nroEb,

            nomeEb: nomeEbPadrao,

            descEb:
              row.desc_eb ||
              nomeEbPadrao,

            percTelas:
              row.perc_telas !== null &&
              row.perc_telas !== undefined
                ? Number(row.perc_telas)
                : null,

            percCaixas:
              row.perc_cx !== null &&
              row.perc_cx !== undefined
                ? Number(row.perc_cx)
                : null,

            limpeza: calcularStatusLimpeza(row),
          };
        });

        setCasasBomba(lista);
        setHasData(true);
      } catch (error) {
        console.error(
          '🚨 [CardCb] Erro ao carregar Casas de Bomba:',
          error
        );

        if (mounted) {
          setCasasBomba([]);
          setHasData(false);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadData();

    return () => {
      mounted = false;
    };
  }, [selectedDate]);

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (!hasData) {
    return null;
  }

  return (
    <section
      className="
        qf-card
        min-w-0
        overflow-hidden
        animate-in
        zoom-in-95
        duration-300
      "
    >
      <div className="qf-card-top-bar" />

      <div className="qf-card-header">
        <h2 className="qf-card-title">
          Casa de Bomba
        </h2>
      </div>

      {/* =====================================================
          TABELA
      ====================================================== */}

      <div className="w-full min-w-0 overflow-hidden px-1">

        {/* Cabeçalho */}
        <div
          className="
            grid
            w-full
            min-w-0
            items-center
            px-1
            pt-1
            pb-2
            border-b
            border-slate-200
          "
          style={{
            gridTemplateColumns: gridColumns,
            columnGap: GRID_COLUMN_GAP,
          }}
        >
          <span
            className="
              block
              min-w-0
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              font-black
              uppercase
              tracking-wider
              text-slate-400
              text-left
            "
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            CB
          </span>

          <span
            className="
              block
              min-w-0
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              font-black
              uppercase
              tracking-tight
              text-slate-400
              text-right
            "
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Telas
          </span>

          <span
            className="
              block
              min-w-0
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              font-black
              uppercase
              tracking-tight
              text-slate-400
              text-right
            "
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Caixas
          </span>

          <span
            className="
              block
              min-w-0
              overflow-hidden
              text-ellipsis
              whitespace-nowrap
              font-black
              uppercase
              tracking-tight
              text-slate-400
              text-right
            "
            style={{
              fontSize: FONT_SIZES.header,
            }}
          >
            Limpeza
          </span>
        </div>

        {/* Corpo da tabela */}
        <div
          className="
            w-full
            min-w-0
            overflow-x-hidden
            overflow-y-auto
            custom-scrollbar
          "
          style={{
            maxHeight: TABLE_MAX_HEIGHT,
          }}
        >
          {casasBomba.map((item) => (
            <div
              key={`${selectedDate}-${item.nroEb}`}
              className="
                grid
                w-full
                min-w-0
                items-center
                px-1
                py-2
                min-h-[36px]
                border-b
                border-slate-100
                last:border-b-0
                transition-colors
                duration-150
                hover:bg-slate-50/70
              "
              style={{
                gridTemplateColumns: gridColumns,
                columnGap: GRID_COLUMN_GAP,
              }}
            >
              {/* Casa de Bomba */}
              <span
                className="
                  block
                  min-w-0
                  max-w-full
                  overflow-hidden
                  text-ellipsis
                  whitespace-nowrap
                  font-bold
                  text-slate-600
                  text-left
                "
                style={{
                  fontSize: FONT_SIZES.content,
                }}
                title={item.descEb}
              >
                {item.descEb}
              </span>

              {/* Percentual das telas */}
              <span
                className="
                  block
                  min-w-0
                  max-w-full
                  overflow-hidden
                  text-ellipsis
                  whitespace-nowrap
                  font-black
                  text-right
                  tracking-tight
                  tabular-nums
                "
                style={{
                  fontSize: FONT_SIZES.content,
                  color: getPercentColor(item.percTelas),
                }}
                title={formatPercent(item.percTelas)}
              >
                {formatPercent(item.percTelas)}
              </span>

              {/* Percentual das caixas */}
              <span
                className="
                  block
                  min-w-0
                  max-w-full
                  overflow-hidden
                  text-ellipsis
                  whitespace-nowrap
                  font-black
                  text-right
                  tracking-tight
                  tabular-nums
                "
                style={{
                  fontSize: FONT_SIZES.content,
                  color: getPercentColor(item.percCaixas),
                }}
                title={formatPercent(item.percCaixas)}
              >
                {formatPercent(item.percCaixas)}
              </span>

              {/* Situação da limpeza */}
              <span
                className="
                  block
                  min-w-0
                  max-w-full
                  overflow-hidden
                  text-ellipsis
                  whitespace-nowrap
                  font-black
                  text-right
                  tracking-tight
                "
                style={{
                  fontSize: FONT_SIZES.limpeza,
                  color: getCleaningColor(item.limpeza),
                }}
                title={item.limpeza}
              >
                {item.limpeza}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================
          RODAPÉ
      ====================================================== */}

      <div className="qf-card-footer">
        <button
          type="button"
          onClick={() =>
            navigate('/qualyflow/casabomba', {
              state: {
                selectedDate,
              },
            })
          }
          className="qf-cuc-detail-button"
        >
          Detalhado
        </button>
      </div>
    </section>
  );
};

export default CardCb;