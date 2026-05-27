import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient'; 

// ================================= HELPERS ------------------------------------------------
// Converte de YYYY-MM-DD (Calendário HTML) para DD/MM/YYYY (Banco de Dados)
const formatToDbDate = (yyyy_mm_dd) => {
  if (!yyyy_mm_dd) return '';
  const [ano, mes, dia] = yyyy_mm_dd.split('-');
  return `${dia}/${mes}/${ano}`;
};

// Converte de DD/MM/YYYY (Banco de Dados) para YYYY-MM-DD (Calendário HTML)
const formatToInputDate = (dd_mm_yyyy) => {
  if (!dd_mm_yyyy) return '';
  const [dia, mes, ano] = dd_mm_yyyy.split('/');
  return `${ano}-${mes}-${dia}`;
};

// ================================= EXECUTOR -----------------------------------------------
function RelatorioAtividades() {
  const navigate = useNavigate();
  const [atividades, setAtividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(null);
  const [dataFiltro, setDataFiltro] = useState(''); // Estado do calendário (YYYY-MM-DD)

  // Função para buscar os dados de uma data específica
  const fetchAtividadesDaData = async (dbDate) => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('vw_atvrealizadas')
        .select('*')
        .eq('data_apontamento', dbDate)
        .order('atividade', { ascending: true }); // Fica mais bonito ordenado por nome

      if (error) throw error;
      setAtividades(data);
    } catch (err) {
      console.error("Erro ao buscar atividades:", err);
      setErro(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Efeito inicial: Descobrir a última data e carregar os dados dela
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        // Busca a data mais recente. O segredo aqui é ordenar por ano e mês primeiro!
        const { data: maxData, error: errMax } = await supabase
          .from('vw_atvrealizadas')
          .select('data_apontamento')
          .order('ano', { ascending: false })
          .order('mes', { ascending: false })
          .order('data_apontamento', { ascending: false })
          .limit(1);

        if (errMax) throw errMax;

        if (maxData && maxData.length > 0) {
          const ultimaDataDb = maxData[0].data_apontamento;
          // Seta o calendário para mostrar essa data
          setDataFiltro(formatToInputDate(ultimaDataDb));
          // Busca os apontamentos dessa data
          await fetchAtividadesDaData(ultimaDataDb);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error("Erro ao iniciar:", err);
        setErro(err.message);
        setLoading(false);
      }
    }

    loadInitialData();
  }, []);

  // Quando o usuário escolhe uma nova data no calendário
  const handleDateChange = (e) => {
    const novaDataInput = e.target.value;
    setDataFiltro(novaDataInput);
    
    if (novaDataInput) {
      fetchAtividadesDaData(formatToDbDate(novaDataInput));
    } else {
      setAtividades([]); // Se limpar o calendário, limpa a tabela
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col p-6 font-sans">
      <div className="max-w-5xl w-full mx-auto">
        
        {/* Cabeçalho com o Calendário */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-3xl font-black text-agro-green uppercase tracking-widest">Atividades Realizadas</h1>
            <p className="text-slate-500 text-sm mt-1">Filtre pela data para auditar a qualidade.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            
            {/* O Nosso Novo Calendário */}
            <div className="flex items-center bg-white border border-slate-200 rounded-lg overflow-hidden shadow-sm focus-within:border-agro-orange focus-within:ring-1 focus-within:ring-agro-orange transition-all">
              <span className="px-3 py-2 text-slate-400 bg-slate-50 border-r border-slate-200 text-sm font-bold">
                📅
              </span>
              <input 
                type="date" 
                value={dataFiltro}
                onChange={handleDateChange}
                className="p-2 text-sm text-slate-700 outline-none w-full md:w-40 bg-transparent font-medium cursor-pointer"
              />
            </div>
            
            <button 
              onClick={() => navigate(-1)} 
              className="px-4 py-2 bg-white border border-agro-orange text-agro-orange font-bold uppercase text-xs rounded-lg hover:bg-agro-orange hover:text-white transition-colors whitespace-nowrap"
            >
              ← Voltar
            </button>
          </div>
        </div>

        {/* Área de Dados */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-10 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-4 border-agro-green/20 border-t-agro-green rounded-full animate-spin"></div>
              <span className="text-agro-green font-bold animate-pulse">Processando dados...</span>
            </div>
          ) : erro ? (
            <div className="p-10 text-center text-red-500 font-bold bg-red-50">
              Erro na conexão: {erro}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-100 border-b border-slate-200 text-[11px] font-black text-slate-500 uppercase tracking-widest">
                    <th className="p-4">Atividade</th>
                    <th className="p-4 text-center w-40">Pontos Auditados</th>
                    <th className="p-4">Campos/Casas</th>
                  </tr>
                </thead>
                <tbody>
                  {atividades.map((item, index) => (
                    <tr 
                      key={item.id || index} 
                      className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                    >
                      <td className="p-4 text-sm text-agro-green font-bold">
                        {item.atividade}
                      </td>
                      <td className="p-4 text-sm text-center">
                        <span className="bg-agro-orange/10 text-agro-orange px-3 py-1.5 rounded-md font-black shadow-sm">
                          {item.pontos}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-mono text-slate-500 max-w-xs leading-relaxed" title={item.campo}>
                        {item.campo}
                      </td>
                    </tr>
                  ))}
                  {atividades.length === 0 && (
                    <tr>
                      <td colSpan="3" className="p-12 text-center text-slate-400 font-medium">
                        <div className="text-4xl mb-3 opacity-30">🌱</div>
                        Nenhuma atividade auditada nesta data.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

export default RelatorioAtividades;