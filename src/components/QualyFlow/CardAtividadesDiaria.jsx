// ================================= DOCUMENTATION ------------------------------------------
// Component: CardAtividadesDiaria
// Purpose: Exibe as atividades realizadas na data selecionada,
//          permitindo visualizar as atividades e os respectivos campos.
// Data source: vw_q_atv_realizadas
// ==========================================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import './CardAtividadesDiaria.css';

const CardAtividadesDiaria = ({ selectedDate }) => {
  // ============================================================================
  // ESTADOS
  // ============================================================================

  // Card principal fechado por padrão
  const [isCardOpen, setIsCardOpen] = useState(false);

  // Atividade atualmente aberta para mostrar os campos
  const [expandedActivity, setExpandedActivity] = useState(null);

  const [activitiesData, setActivitiesData] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // ============================================================================
  // DATA PARA O BANCO
  // selectedDate chega como YYYY-MM-DD
  // A view utiliza DD/MM/YYYY
  // ============================================================================

  const databaseDate = useMemo(() => {
    if (!selectedDate || typeof selectedDate !== 'string') {
      return null;
    }

    const parts = selectedDate.split('-');

    if (parts.length !== 3) {
      return null;
    }

    const [year, month, day] = parts;

    return `${day}/${month}/${year}`;
  }, [selectedDate]);

  // ============================================================================
  // BUSCA DOS DADOS
  // ============================================================================

  useEffect(() => {
    let mounted = true;

    // Ao trocar a data:
    // mantém o card e a lista de atividades como estavam,
    // mas fecha a atividade que estava mostrando os campos.
    setExpandedActivity(null);

    if (!databaseDate) {
      setActivitiesData([]);
      return () => {
        mounted = false;
      };
    }

    const loadActivities = async () => {
      setIsLoading(true);
      setErrorMsg('');

      try {
        const { data, error } = await supabase
          .from('vw_q_atv_realizadas')
          .select(
            'data_apontamento, codigo_campo, campo, nome_eb, atividade, qnt'
          )
          .eq('data_apontamento', databaseDate)
          .order('atividade', { ascending: true });

        if (error) {
          throw error;
        }

        if (!mounted) return;

        setActivitiesData(data || []);
      } catch (err) {
        console.error(
          '🚨 [QualyFlow] Erro ao carregar atividades:',
          err
        );

        if (mounted) {
          setActivitiesData([]);
          setErrorMsg(
            err.message || 'Erro ao carregar atividades.'
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    loadActivities();

    return () => {
      mounted = false;
    };
  }, [databaseDate]);

  // ============================================================================
  // AGRUPAMENTO
  // ============================================================================
  //
  // A view traz uma linha por atividade/campo.
  //
  // Aqui transformamos:
  //
  // Perdas Mecanizada
  //   PALMEIRA       6
  //   JAGUARARI      6
  //   BOM CONSELHO   5
  //
  // em uma estrutura própria para o componente.
  // ============================================================================

  const activities = useMemo(() => {
    const grouped = {};

    activitiesData.forEach((row) => {
      const activityName =
        row.atividade?.toString().trim() || 'Atividade não informada';

      if (!grouped[activityName]) {
        grouped[activityName] = {
          atividade: activityName,
          totalPontos: 0,
          campos: [],
        };
      }

      const qnt = Number(row.qnt) || 0;

      grouped[activityName].totalPontos += qnt;

      // Prioridade: CAMPO
      // Caso campo seja nulo/vazio: NOME_EB
      const fieldName =
        row.campo?.toString().trim() ||
        row.nome_eb?.toString().trim() ||
        'Local não informado';

      grouped[activityName].campos.push({
        id: `${row.codigo_campo || ''}-${fieldName}`,
        codigoCampo: row.codigo_campo,
        nome: fieldName,
        qnt,
      });
    });

    // Ordena as atividades alfabeticamente
    return Object.values(grouped)
      .sort((a, b) =>
        a.atividade.localeCompare(
          b.atividade,
          'pt-BR',
          { sensitivity: 'base' }
        )
      )
      .map((activity) => ({
        ...activity,

        // Ordena os campos alfabeticamente
        campos: activity.campos.sort((a, b) =>
          a.nome.localeCompare(
            b.nome,
            'pt-BR',
            { sensitivity: 'base' }
          )
        ),
      }));
  }, [activitiesData]);

  // ============================================================================
  // TOTAL DE ATIVIDADES
  // ============================================================================
  //
  // IMPORTANTE:
  // Aqui NÃO usamos qnt.
  //
  // Se existirem:
  // - Perdas Mecanizada
  // - Perdas Manual
  // - CUC - Gotejo
  //
  // o total será 3.
  // ============================================================================

  const totalActivities = activities.length;

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const toggleCard = () => {
    setIsCardOpen((prev) => !prev);
  };

  const toggleActivity = (activityName) => {
    setExpandedActivity((current) =>
      current === activityName ? null : activityName
    );
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <section className="qf-activities-card">

      {/* ================================================================
          CABEÇALHO DO CARD
          ================================================================ */}

      <button
        type="button"
        className="qf-activities-card__header"
        onClick={toggleCard}
        aria-expanded={isCardOpen}
      >
        <div className="qf-activities-card__header-info">
          <span className="qf-activities-card__title">
            Atividades Realizadas
          </span>

          <span className="qf-activities-card__total">
            {isLoading ? '—' : totalActivities}
          </span>
        </div>

        <span
          className={`qf-activities-card__toggle ${
            isCardOpen ? 'is-open' : ''
          }`}
          aria-hidden="true"
        >
          {isCardOpen ? '−' : '+'}
        </span>
      </button>

      {/* ================================================================
          CONTEÚDO
          ================================================================ */}

      {isCardOpen && (
        <div className="qf-activities-card__content">

          {/* LOADING */}
          {isLoading && (
            <div className="qf-activities-card__loading">
              <span className="qf-activities-card__spinner" />
              <span>Carregando atividades</span>
            </div>
          )}

          {/* ERRO */}
          {!isLoading && errorMsg && (
            <div className="qf-activities-card__error">
              Não foi possível carregar as atividades.
            </div>
          )}

          {/* SEM DADOS */}
          {!isLoading &&
            !errorMsg &&
            activities.length === 0 && (
              <div className="qf-activities-card__empty">
                Nenhuma atividade realizada nesta data.
              </div>
            )}

          {/* LISTA */}
          {!isLoading &&
            !errorMsg &&
            activities.length > 0 && (
              <div className="qf-activities-list">

                {activities.map((activity) => {
                  const isExpanded =
                    expandedActivity === activity.atividade;

                  return (
                    <div
                      key={activity.atividade}
                      className={`qf-activity ${
                        isExpanded ? 'is-expanded' : ''
                      }`}
                    >

                      {/* ==================================================
                          ATIVIDADE
                          ================================================== */}

                      <button
                        type="button"
                        className="qf-activity__header"
                        onClick={() =>
                          toggleActivity(activity.atividade)
                        }
                        aria-expanded={isExpanded}
                      >
                        <div className="qf-activity__name-wrapper">
                          <span className="qf-activity__name">
                            {activity.atividade}
                          </span>

                          <span className="qf-activity__points">
                            {activity.totalPontos}
                          </span>
                        </div>

                        <span
                          className="qf-activity__toggle"
                          aria-hidden="true"
                        >
                          {isExpanded ? '−' : '+'}
                        </span>
                      </button>

                      {/* ==================================================
                          CAMPOS
                          ================================================== */}

                      {isExpanded && (
                        <div className="qf-activity__fields">

                          {activity.campos.map((field) => (
                            <div
                              key={field.id}
                              className="qf-field"
                            >
                              <span className="qf-field__name">
                                {field.nome}
                              </span>

                              <span className="qf-field__points">
                                {field.qnt}
                              </span>
                            </div>
                          ))}

                        </div>
                      )}
                    </div>
                  );
                })}

              </div>
            )}

        </div>
      )}
    </section>
  );
};

export default CardAtividadesDiaria;