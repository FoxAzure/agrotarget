// ================= DOCUMENTATION ------------------------------------------
// Script: CUC Pivot
// Purpose: Calculadora rápida de uniformidade de irrigação para Pivô Central.
// Relationships: data/campos.json
// ==========================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Style.css';

import HeaderAgroTools from '../../../components/AgroTools/HeaderAgroTools';
import SidebarAgroTools from '../../../components/AgroTools/SidebarAgroTools';
import camposData from '../../../data/campos.json'; 

const CucPivotTools = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('cuc'); 

  // ================= CONFIGURAÇÕES E METAS =================
  const metaCUC = 90.0;
  
  // ================= ESTADOS: NOVO CUC =================
  const defaultFormCUC = {
    data: new Date().toISOString().split('T')[0],
    campo: '', evaporacao: '', raio: '', tempo: '', currentColeta: '', observacao: ''
  };
  
  const [formCUC, setFormCUC] = useState(() => {
    const saved = localStorage.getItem('at_cucpivot_form');
    const parsed = saved ? JSON.parse(saved) : defaultFormCUC;
    parsed.data = new Date().toISOString().split('T')[0];
    parsed.currentColeta = '';
    parsed.observacao = '';
    return parsed;
  });
  
  const [coletas, setColetas] = useState(() => {
    const saved = localStorage.getItem('at_cucpivot_coletas');
    return saved ? JSON.parse(saved) : [];
  });

  const [confirmModal, setConfirmModal] = useState(false);
  const [hasMissingFields, setHasMissingFields] = useState(false);

  // ================= HISTÓRICO =================
  const [historico, setHistorico] = useState(() => {
    const saved = localStorage.getItem('at_cucpivot_hist');
    return saved ? JSON.parse(saved) : [];
  });

  const [modalItem, setModalItem] = useState(null);

  // ================= FILTRO DE CAMPOS (SÓ PIVÔ) =================
  const camposPivot = useMemo(() => {
    return camposData.filter(c => c.CAMPO.toLowerCase().includes('pivo'));
  }, []);

  // ================= PERSISTÊNCIA OFFLINE =================
  useEffect(() => { localStorage.setItem('at_cucpivot_form', JSON.stringify(formCUC)); }, [formCUC]);
  useEffect(() => { localStorage.setItem('at_cucpivot_coletas', JSON.stringify(coletas)); }, [coletas]);
  useEffect(() => { localStorage.setItem('at_cucpivot_hist', JSON.stringify(historico)); }, [historico]);

  // ================= LÓGICA DE CÁLCULO CUC =================
  const calcCUC = useMemo(() => {
    const n = coletas.length;
    if (n === 0) return { mediaML: 0, cuc: 0 };

    const sum = coletas.reduce((a, b) => a + b, 0);
    const media = sum / n;
    
    // Desvio absoluto médio
    const meanDev = coletas.reduce((a, b) => a + Math.abs(b - media), 0) / n;
    
    const cuc = media > 0 ? 100 * (1 - (meanDev / media)) : 0;

    return { mediaML: media, cuc };
  }, [coletas]);

  const addColeta = (e) => {
    e.preventDefault();
    if (formCUC.currentColeta === '') return;
    const val = parseFloat(formCUC.currentColeta.replace(',', '.'));
    
    if (val < 0) return alert('Valores negativos não são permitidos!');
    
    if (!isNaN(val)) {
      setColetas([...coletas, val]);
      setFormCUC({ ...formCUC, currentColeta: '' });
    }
  };

  const removeColeta = (index) => {
    setColetas(coletas.filter((_, i) => i !== index));
  };

  const handlePreSave = () => {
    if (coletas.length === 0) return alert('Adicione pelo menos uma coleta para salvar!');
    
    const missing = !formCUC.evaporacao || !formCUC.raio || !formCUC.tempo;
    setHasMissingFields(missing);
    
    setConfirmModal(true);
  };

  const saveCUC = () => {
    const novoPonto = {
      id: Date.now(),
      horaStr: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      ...formCUC,
      coletas: [...coletas],
      results: calcCUC
    };

    setHistorico([novoPonto, ...historico]);
    setColetas([]);
    // Mantém o campo, zera as medições extras para a próxima inserção
    setFormCUC(prev => ({ 
      ...prev, 
      evaporacao: '', 
      raio: '', 
      tempo: '', 
      currentColeta: '', 
      observacao: '' 
    }));
    setConfirmModal(false);
  };

  // ================= GERADORES DE TEXTO (WHATSAPP) =================
  const getResumoCUC = (item) => {
    let txt = `📋 *Resumo CUC - Pivot*\n`;
    txt += `Data: ${item.data.split('-').reverse().join('/')} ${item.horaStr}\n`;
    if (item.campo) txt += `Campo: ${item.campo.toUpperCase()}\n`;
    if (item.evaporacao) txt += `Evaporação: ${item.evaporacao}\n`;
    if (item.raio) txt += `Raio: ${item.raio}\n`;
    if (item.tempo) txt += `Tempo: ${item.tempo}\n`;
    txt += `Total Coletas: ${item.coletas.length}\n`;
    
    // Formatando para exibir com vírgula conforme seu pedido
    const mediaFormatada = item.results.mediaML.toFixed(1).replace('.', ',');
    txt += `Média mL: ${mediaFormatada}\n\n`;

    const statusIcon = item.results.cuc >= metaCUC ? '🟢' : '🔴';
    txt += `${statusIcon}CUC.................${item.results.cuc.toFixed(1)}%\n\n`;

    if (item.observacao && item.observacao.trim() !== '') {
      txt += `*Observação:*\n${item.observacao}\n\n`;
    }

    // Coletas na ordem que foram inseridas (primeira a última)
    item.coletas.forEach(val => {
      txt += `${val}\n`;
    });

    return txt.trim();
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Resumo copiado para a área de transferência!');
  };

  return (
    <div className="at-theme">
      <HeaderAgroTools onMenuOpen={() => setSidebarOpen(true)} />
      <SidebarAgroTools isOpen={isSidebarOpen} onClose={() => setSidebarOpen(false)} />

      <datalist id="campos-pivot-list">
        {camposPivot.map(c => <option key={c.CODIGO} value={c.CAMPO} />)}
      </datalist>

      <main className="at-container py-6 pb-24 max-w-lg mx-auto fade-in min-h-screen">
        
        {/* ================= ABA: NOVO CUC ================= */}
        {activeTab === 'cuc' && (
          <div className="fade-in">
            <div className="mb-4">
              <h2 className="at-page-title text-center md:text-left text-blue-600">CUC Pivot</h2>
              <p className="at-page-subtitle text-center md:text-left">Cálcular uniformidade da irrigação</p>
            </div>

            <div className="at-card-section mb-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="at-input-group">
                  <label className="truncate text-xs">Data</label>
                  <input type="date" className="at-input text-xs px-1" value={formCUC.data} onChange={e => setFormCUC({...formCUC, data: e.target.value})} required />
                </div>
                <div className="at-input-group">
                  <label>Campo</label>
                  <input list="campos-pivot-list" className="at-input uppercase" placeholder="Procurar" value={formCUC.campo} onChange={e => setFormCUC({...formCUC, campo: e.target.value.toUpperCase()})} />
                </div>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                <div className="at-input-group">
                  <label className="truncate text-[10px]">Evaporação</label>
                  <input type="text" className="at-input text-center text-sm" placeholder="" value={formCUC.evaporacao} onChange={e => setFormCUC({...formCUC, evaporacao: e.target.value})} />
                </div>
                <div className="at-input-group">
                  <label className="truncate text-[10px]">Raio</label>
                  <input type="text" className="at-input text-center text-sm" placeholder="" value={formCUC.raio} onChange={e => setFormCUC({...formCUC, raio: e.target.value})} />
                </div>
                <div className="at-input-group">
                  <label className="truncate text-[10px]">Tempo</label>
                  <input type="text" className="at-input text-center text-sm" placeholder="" value={formCUC.tempo} onChange={e => setFormCUC({...formCUC, tempo: e.target.value})} />
                </div>
              </div>
            </div>

            {/* Inserção Rápida */}
            <div className="at-card-section mb-4 bg-blue-50/50">
              <label className="font-black text-sm uppercase text-slate-600 mb-2 block">Lançar Coleta (mL)</label>
              <form onSubmit={addColeta} className="flex gap-2">
                <input 
                  type="number" inputMode="decimal" step="0.1" min="0"
                  className="at-input flex-1 h-14 text-2xl text-center font-black" 
                  placeholder="0"
                  value={formCUC.currentColeta} 
                  onChange={e => setFormCUC({...formCUC, currentColeta: e.target.value})} 
                />
                <button type="submit" className="at-btn--primary w-14 h-14 rounded-xl text-2xl font-black shadow-md hover:scale-105 transition-transform">+</button>
              </form>
            </div>

            {/* Painel de Resultados ao Vivo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-center items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">CUC Atual</span>
                <span className={`text-3xl font-black ${calcCUC.cuc >= metaCUC ? 'text-green-500' : 'text-red-500'}`}>
                  {calcCUC.cuc.toFixed(1)}%
                </span>
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm flex flex-col justify-center items-center">
                <span className="text-[10px] font-black uppercase text-slate-400">Média</span>
                <span className="text-2xl font-black text-slate-700">{calcCUC.mediaML.toFixed(1)} <span className="text-sm">mL</span></span>
              </div>
            </div>

            {/* Lista de Coletas Clean */}
            {coletas.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-3 mb-4 shadow-sm max-h-60 overflow-y-auto">
                <div className="flex justify-between items-center mb-2 border-b pb-1 sticky top-0 bg-white z-10">
                  <span className="text-xs font-bold text-slate-500 uppercase">Coletas ({coletas.length})</span>
                </div>
                <div className="flex flex-col gap-1 mt-2">
                  {coletas.map((val, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 px-3 border border-slate-100 bg-slate-50 rounded-lg shadow-sm">
                      <div className="flex items-center gap-3">
                        <span className="text-[10px] text-slate-400 font-bold bg-white px-1.5 py-0.5 rounded shadow-sm">#{String(idx + 1).padStart(2, '0')}</span>
                        <span className="font-black text-lg text-slate-600">{val} mL</span>
                      </div>
                      <button onClick={() => removeColeta(idx)} className="text-red-400 hover:text-red-600 font-black px-2 active:scale-90 transition-transform">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={handlePreSave} className="at-btn at-btn--primary w-full h-[54px] text-[1rem]">SALVAR PONTO PIVOT</button>
          </div>
        )}

        {/* ================= ABA: HISTÓRICO ================= */}
        {activeTab === 'historico' && (
          <div className="fade-in">
            <div className="flex justify-between items-center px-1 mb-3 mt-2">
              <span className="text-xs font-bold text-slate-400 uppercase">{historico.length} Pontos Salvos</span>
              <button onClick={() => { if(window.confirm('Limpar histórico do Pivot?')) setHistorico([]); }} className="text-xs text-red-400 font-bold hover:text-red-600 transition-colors">Limpar Tudo</button>
            </div>
            
            <div className="flex flex-col gap-2">
              {historico.length === 0 ? <div className="at-empty-state">Nenhum ponto registrado.</div> : (
                historico.map(item => (
                  <div key={item.id} onClick={() => setModalItem(item)} className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:bg-blue-50 cursor-pointer active:scale-[0.98] transition-all flex justify-between items-center">
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded w-fit mb-1">{item.data.split('-').reverse().join('/')} • {item.horaStr}</span>
                        <span className="font-black text-slate-700">{item.campo || 'Sem Campo'}</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] font-black uppercase text-slate-400">CUC</span>
                      <span className={`font-black text-lg ${item.results.cuc >= metaCUC ? 'text-green-500' : 'text-red-500'}`}>{item.results.cuc.toFixed(1)}%</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </main>

      {/* ================= NAVEGAÇÃO INFERIOR FIXA ================= */}
      <div className="at-bottom-nav">
        <button onClick={() => setActiveTab('historico')} className={`at-nav-btn ${activeTab === 'historico' ? 'active' : ''}`}>
          <span className="text-xl leading-none">📋</span>
          <span className="text-[10px] font-bold uppercase mt-1">Histórico</span>
        </button>
        <button onClick={() => setActiveTab('cuc')} className={`at-nav-btn ${activeTab === 'cuc' ? 'active text-blue-600' : ''}`}>
          <span className="text-xl leading-none">🎯</span>
          <span className="text-[10px] font-bold uppercase mt-1">Novo Ponto</span>
        </button>
      </div>

      {/* ================= MODAIS ================= */}
      
      {/* Modal Pré-Salvar */}
      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col m-auto fade-in">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-sm">Confirmar Salvamento</h3>
              <button onClick={() => setConfirmModal(false)} className="text-slate-400 font-bold text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
            </div>
            
            <div className="p-5 flex flex-col gap-4">
              {hasMissingFields && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 p-3 rounded-lg text-xs font-bold shadow-sm">
                  ⚠️ Alguns parâmetros (Evaporação, Raio ou Tempo) não foram informados. Eles não aparecerão no resumo. Deseja continuar?
                </div>
              )}
              
              <div className="flex flex-col gap-2">
                <label className="text-xs font-black uppercase text-slate-500">Observação (Opcional)</label>
                <textarea 
                  className="at-input w-full p-2 text-sm resize-none h-20" 
                  placeholder="Digite alguma observação sobre o teste..."
                  value={formCUC.observacao}
                  onChange={e => setFormCUC({...formCUC, observacao: e.target.value})}
                ></textarea>
              </div>
            </div>
            
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => setConfirmModal(false)} className="flex-1 bg-white border border-slate-300 text-slate-600 font-bold uppercase text-xs rounded-lg py-3 hover:bg-slate-100 transition-colors">Cancelar</button>
               <button onClick={saveCUC} className="flex-[1.5] bg-blue-600 text-white font-black uppercase text-xs rounded-lg py-3 hover:bg-blue-700 transition-colors shadow-md">Salvar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Histórico (Visualização) */}
      {modalItem && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white w-full max-w-[85vw] md:max-w-sm rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh] m-auto fade-in">
            <div className="bg-slate-100 p-4 border-b flex justify-between items-center">
              <h3 className="font-black text-slate-700 uppercase text-sm">Resumo Pivot</h3>
              <button onClick={() => setModalItem(null)} className="text-slate-400 font-bold text-2xl leading-none hover:text-red-500 transition-colors">&times;</button>
            </div>
            <div className="p-5 overflow-y-auto whitespace-pre-wrap font-mono text-sm leading-relaxed text-slate-700 flex-1">
              {getResumoCUC(modalItem)}
            </div>
            <div className="p-4 border-t bg-slate-50 flex gap-3">
               <button onClick={() => {
                 setHistorico(historico.filter(h => h.id !== modalItem.id));
                 setModalItem(null);
               }} className="flex-1 bg-white border border-red-200 text-red-500 font-bold uppercase text-xs rounded-lg py-3 hover:bg-red-50 transition-colors">Excluir</button>
               
               <button onClick={() => copyToClipboard(getResumoCUC(modalItem))} className="flex-[1.5] bg-blue-600 text-white font-black uppercase text-xs rounded-lg py-3 hover:bg-blue-700 transition-colors shadow-sm">Copiar Resumo</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default CucPivotTools;