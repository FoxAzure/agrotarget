import React, { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';

const CardAtividadesDiaria = ({ selectedDate }) => {
  const [loading, setLoading] = useState(false);
  const [atividades, setAtividades] = useState({});
  const [expanded, setExpanded] = useState({});

  // Efeito disparado SEMPRE que a data muda
  useEffect(() => {
    if (!selectedDate) return;

    // A mágica que você pediu: reseta (fecha) todos os menus ao mudar a data!
    setExpanded({});

    const fetchAtividades = async () => {
      setLoading(true);
      try {
        // Query cirúrgica e ultra leve: só traz o que precisa para a data selecionada
        const { data, error } = await supabase
          .from('vw_q_atv_realizadas')
          .select('atividade, campo, nome_eb, qnt')
          .eq('data_apontamento', selectedDate);

        if (error) throw error;

        // Processa e agrupa os dados para a estrutura visual
        const grouped = (data || []).reduce((acc, row) => {
          const act = row.atividade || 'Outros';
          
          if (!acc[act]) {
            acc[act] = { total: 0, locais: [] };
          }
          
          acc[act].total += row.qnt;

          // Lógica de exibição: Se tem campo, mostra. Se não, mostra EB.
          let localLabel = 'Não identificado';
          if (row.campo) localLabel = `Campo ${row.campo}`;
          else if (row.nome_eb) localLabel = `EB ${row.nome_eb}`;

          // Agrupa quantidades do mesmo local (caso a view traga linhas separadas pro mesmo campo)
          const existingLocal = acc[act].locais.find(l => l.label === localLabel);
          if (existingLocal) {
            existingLocal.qnt += row.qnt;
          } else {
            acc[act].locais.push({ label: localLabel, qnt: row.qnt });
          }

          return acc;
        }, {});

        // Ordena os locais do maior pro menor (só pra ficar organizado)
        Object.keys(grouped).forEach(key => {
          grouped[key].locais.sort((a, b) => b.qnt - a.qnt);
        });

        setAtividades(grouped);
      } catch (err) {
        console.error('[CardAtividades] Erro ao buscar atividades:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAtividades();
  }, [selectedDate]);

  const toggleExpand = (act) => {
    setExpanded(prev => ({ ...prev, [act]: !prev[act] }));
  };

  const activityKeys = Object.keys(atividades).sort();

  if (!selectedDate) return null;

  return (
    <div className="qualy-card flex flex-col w-full bg-white shadow-sm transition-all duration-300">
      
      {/* HEADER DO CARD */}
      <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-[var(--q-bg)]">
        <h3 className="text-[11px] font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
          <span className="text-[var(--q-green)]">📋</span> Resumo Operacional
        </h3>
        {loading && (
          <div className="w-3.5 h-3.5 border-2 border-[var(--q-green)]/30 border-t-[var(--q-green)] rounded-full animate-spin"></div>
        )}
      </div>

      {/* CORPO DO CARD */}
      <div className="flex flex-col w-full">
        {loading && Object.keys(atividades).length === 0 ? (
          <div className="py-8 text-center text-micro text-slate-400 animate-pulse">
            Analisando dados do dia...
          </div>
        ) : activityKeys.length === 0 ? (
          <div className="py-6 text-center text-[11px] font-bold text-slate-400">
            Nenhuma atividade registrada.
          </div>
        ) : (
          activityKeys.map((actName, idx) => {
            const actData = atividades[actName];
            const isExpanded = !!expanded[actName];

            return (
              <div key={idx} className="flex flex-col border-b border-slate-50 last:border-0">
                
                {/* LINHA DA ATIVIDADE (CLICÁVEL) */}
                <button
                  onClick={() => toggleExpand(actName)}
                  className="flex items-center justify-between w-full px-5 py-3 hover:bg-slate-50 transition-colors group focus:outline-none"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-[var(--q-green)]' : ''}`}>
                      ▶
                    </span>
                    <span className="text-[11px] font-bold text-[var(--q-dark)] group-hover:text-[var(--q-green)] transition-colors text-left">
                      {actName}
                    </span>
                  </div>
                  <span className="text-[10px] font-black text-white bg-[var(--q-green)] px-2 py-0.5 rounded shadow-sm min-w-[24px] text-center">
                    {actData.total}
                  </span>
                </button>

                {/* DETALHES RETRÁTEIS (CAMPOS / EBs) */}
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out bg-slate-50/50 ${isExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  <div className="flex flex-col py-1 px-5 pb-3">
                    {actData.locais.map((local, lIdx) => (
                      <div key={lIdx} className="flex justify-between items-center py-1.5 pl-5 border-l border-slate-200 ml-1">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">
                          {local.label}
                        </span>
                        <span className="text-[10px] font-black text-[var(--q-orange)]">
                          {local.qnt}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default CardAtividadesDiaria;