// ================================= DOCUMENTATION ------------------------------------------
// Script: CardCUC
// Purpose: Exibe as avaliações de CUC realizadas na data selecionada.
// Relationships:
//   - vw_q_cucdatas
//   - vw_q_cucgeral
// ==========================================================================================

import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useNavigate } from 'react-router-dom';

// ================================= HELPERS ------------------------------------------------

const formatValue = (value, decimals = 2) => {
  if (value === null || value === undefined || value === '') {
    return '-';
  }

  const number = Number(value);

  if (Number.isNaN(number)) {
    return '-';
  }

  return number.toFixed(decimals).replace('.', ',');
};

// -------------------------------------------------------------------------
// Retorna a classe visual de acordo com o CUC
// -------------------------------------------------------------------------

const getCucClass = (value) => {
  const cuc = Number(value);

  if (Number.isNaN(cuc)) {
    return 'qf-cuc-status-neutral';
  }

  if (cuc >= 90) {
    return 'qf-cuc-status-good';
  }

  if (cuc >= 80) {
    return 'qf-cuc-status-warning';
  }

  return 'qf-cuc-status-danger';
};

// -------------------------------------------------------------------------
// Entupimento
// -------------------------------------------------------------------------

const getEntupClass = (value) => {
  const entup = Number(value);

  if (Number.isNaN(entup)) {
    return 'qf-cuc-status-neutral';
  }

  if (entup <= 5) {
    return 'qf-cuc-status-good';
  }

  if (entup <= 10) {
    return 'qf-cuc-status-warning';
  }

  return 'qf-cuc-status-danger';
};

// -------------------------------------------------------------------------
// Vazão
// -------------------------------------------------------------------------

const getVazaoClass = (value) => {
  const vazao = Number(value);

  if (Number.isNaN(vazao)) {
    return 'qf-cuc-status-neutral';
  }

  if (vazao >= 0.9 && vazao <= 1.1) {
    return 'qf-cuc-status-good';
  }

  if (vazao >= 0.8 && vazao < 0.9) {
    return 'qf-cuc-status-orange';
  }

  if (vazao < 0.8) {
    return 'qf-cuc-status-danger';
  }

  if (vazao > 1.1 && vazao <= 1.2) {
    return 'qf-cuc-status-warning';
  }

  return 'qf-cuc-status-blue';
};

// -------------------------------------------------------------------------
// Bolinha de loading
// -------------------------------------------------------------------------

const LoadingSpinner = () => (
  <div className="qf-cuc-loading">
    <div className="qf-cuc-spinner" />
  </div>
);

// ================================= COMPONENT ----------------------------------------------

const CardCUC = ({ selectedDate }) => {

  const navigate = useNavigate();

  const [isLoading, setIsLoading] = useState(true);
  const [hasEvaluation, setHasEvaluation] = useState(false);
  const [evaluations, setEvaluations] = useState([]);

  // =========================================================================
  // BUSCA DADOS
  // =========================================================================

  useEffect(() => {

    let mounted = true;

    const loadData = async () => {

      setIsLoading(true);
      setHasEvaluation(false);
      setEvaluations([]);

      try {

        if (!selectedDate) {
          return;
        }

        // ================================================================
        // 1. Busca quais campos tiveram avaliação na data
        // ================================================================

        const { data: datesData, error: datesError } = await supabase
          .from('vw_q_cucdatas')
          .select(`
            ano,
            mes,
            data_apontamento,
            codigo_campo,
            campo,
            av
          `)
          .eq('data_apontamento', selectedDate)
          .order('codigo_campo', { ascending: true });

        if (datesError) {
          throw datesError;
        }

        if (!datesData || datesData.length === 0) {
          if (mounted) {
            setHasEvaluation(false);
          }

          return;
        }

        // ================================================================
        // 2. Busca os dados gerais dos campos
        // ================================================================

        const fieldCodes = [
          ...new Set(
            datesData
              .map(row => row.codigo_campo)
              .filter(Boolean)
          )
        ];

        if (fieldCodes.length === 0) {
          if (mounted) {
            setHasEvaluation(false);
          }

          return;
        }

        const { data: generalData, error: generalError } = await supabase
          .from('vw_q_cucgeral')
          .select(`
            ano,
            mes,
            codigo_campo,
            campo,
            total_lotes,
            depa,
            setor,
            dt_inicial,
            dt_final,
            avaliacao,
            emissores,
            cuc,
            entupido,
            "entup%",
            vazao
          `)
          .in('codigo_campo', fieldCodes);

        if (generalError) {
          throw generalError;
        }

        // ================================================================
        // 3. Cruza a avaliação da data com os dados gerais
        // ================================================================

        const result = datesData
          .map(dateRow => {

            const generalRow = (generalData || []).find(row =>
              String(row.codigo_campo) === String(dateRow.codigo_campo) &&
              String(row.avaliacao) === String(dateRow.av)
            );

            if (!generalRow) {
              return null;
            }

            return {
              ...generalRow,
              av: dateRow.av,
              data_apontamento: dateRow.data_apontamento
            };

          })
          .filter(Boolean);

        if (!mounted) {
          return;
        }

        setEvaluations(result);
        setHasEvaluation(result.length > 0);

      } catch (error) {

        console.error(
          '🚨 [CardCUC] Erro ao carregar avaliações:',
          error
        );

        if (mounted) {
          setHasEvaluation(false);
          setEvaluations([]);
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

  // =========================================================================
  // NÃO EXIBE O CARD SE NÃO EXISTIR AVALIAÇÃO
  // =========================================================================

  if (!isLoading && !hasEvaluation) {
    return null;
  }

  // =========================================================================
  // LOADING
  // =========================================================================

  if (isLoading) {
    return <LoadingSpinner />;
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  return (

    <section className="qf-cuc-card">

      {/* ================================================================
          CABEÇALHO
      ================================================================= */}

      <div className="qf-cuc-header">

        <div className="qf-cuc-title">
          CUC - Gotejo
        </div>

      </div>

      {/* ================================================================
          CABEÇALHO DAS COLUNAS
      ================================================================= */}

      <div className="qf-cuc-columns">

        <span className="qf-cuc-column-field">
          Campo
        </span>

        <span>
          CUC
        </span>

        <span>
          Entup.
        </span>

        <span>
          L/h
        </span>

      </div>

      {/* ================================================================
          CAMPOS
      ================================================================= */}

      <div className="qf-cuc-list">

        {evaluations.map((item, index) => {

          const cucClass = getCucClass(item.cuc);

          return (

            <div
              className="qf-cuc-item"
              key={`${item.codigo_campo}-${item.av}-${index}`}
            >

              <div className="qf-cuc-row">

                {/* ----------------------------------------------------
                    CAMPO + AVALIAÇÃO
                ----------------------------------------------------- */}

                <div className="qf-cuc-field">

                  <div className="qf-cuc-field-name">
                    <span className="qf-cuc-av">
                      {item.av}º
                    </span>

                    <span className="qf-cuc-name">
                      {item.campo || item.codigo_campo}
                    </span>
                  </div>



                </div>

                {/* ----------------------------------------------------
                    CUC
                ----------------------------------------------------- */}

                <span
                  className={`qf-cuc-value ${getCucClass(item.cuc)}`}
                >
                  {formatValue(item.cuc)}%
                </span>

                {/* ----------------------------------------------------
                    ENTUPIMENTO
                ----------------------------------------------------- */}

                <span
                  className={`qf-cuc-value ${getEntupClass(item['entup%'])}`}
                >
                  {formatValue(item['entup%'])}%
                </span>

                {/* ----------------------------------------------------
                    VAZÃO
                ----------------------------------------------------- */}

                <span
                  className={`qf-cuc-value ${getVazaoClass(item.vazao)}`}
                >
                  {formatValue(item.vazao)}
                </span>

              </div>

              {/* --------------------------------------------------------
                  BARRA DE CUC
              --------------------------------------------------------- */}

              <div className="qf-cuc-progress">

                <div
                  className={`qf-cuc-progress-bar ${cucClass}`}
                  style={{
                    width: `${Math.min(
                      Math.max(Number(item.cuc) || 0,
                      0),
                      100
                    )}%`
                  }}
                />

              </div>

            </div>

          );

        })}

      </div>

      {/* ================================================================
          RODAPÉ
      ================================================================= */}

      <div className="qf-cuc-footer">

        <button
          type="button"
          className="qf-cuc-detail-button"
          onClick={() => navigate('/qualyflow/cuc')}
        >
          Detalhado
        </button>

      </div>

    </section>

  );

};

export default CardCUC;