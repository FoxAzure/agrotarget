import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';

// --- DebugView Mantido ---
const DebugView = () => {
  const [status, setStatus] = useState('Testando conexão...');

  useEffect(() => {
    const checkConnection = async () => {
      const { data, error } = await supabase
        .from('vw_c_ociosooperacao')
        .select('data')
        .eq('data', '01/06/2026')
        .limit(1);

      if (error) {
        setStatus('Erro: ' + error.message);
      } else {
        setStatus('OK - Conexão estabelecida!');
      }
    };
    checkConnection();
  }, []);

  return (
    <div style={{ padding: '20px', border: '2px solid #3b82f6', borderRadius: '8px', margin: '10px' }}>
      <h3 style={{ margin: 0 }}>Status da View:</h3>
      <p style={{ fontWeight: 'bold', color: status.includes('OK') ? 'green' : 'red' }}>
        {status}
      </p>
    </div>
  );
};

// --- Lógica de Resumo Ocioso ---
const ResumoOcioso = () => {
  const [lista, setLista] = useState([]);

  useEffect(() => {
    const fetchData = async () => {
      const { data, error } = await supabase
        .from('vw_c_ociosooperacao')
        .select('desc_operacao, hrs_operacionais_seg')
        .eq('data', '01/06/2026')
        .in('desc_grupo_op', ['AUXILIAR', 'IMPRODUTIVO']);

      if (error) {
        console.error('Erro na consulta:', error);
        return;
      }

      // Agrupamento e Soma
      const agrupado = (data || []).reduce((acc, curr) => {
        const key = curr.desc_operacao;
        if (!acc[key]) {
          acc[key] = { operacao: key, totalSeg: 0 };
        }
        acc[key].totalSeg += Number(curr.hrs_operacionais_seg || 0);
        return acc;
      }, {});

      setLista(Object.values(agrupado));
    };

    fetchData();
  }, []);

  return (
    <div style={{ padding: '20px', marginTop: '10px' }}>
      <h3>Resumo: Auxiliar & Improdutivo</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {lista.length > 0 ? (
          lista.map((item) => (
            <div key={item.operacao} style={{ borderBottom: '1px solid #ccc', padding: '5px 0' }}>
              <strong>{item.operacao}:</strong> {(item.totalSeg / 3600).toFixed(2)} horas
            </div>
          ))
        ) : (
          <p>Nenhum dado encontrado para o filtro.</p>
        )}
      </div>
    </div>
  );
};

// --- Componente Principal ---
const DashboardPage = () => {
  return (
    <div>
      <DebugView />
      <ResumoOcioso />
    </div>
  );
};

export default DashboardPage;