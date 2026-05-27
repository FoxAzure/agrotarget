import React from 'react';
import { useNavigate } from 'react-router-dom';

const EmDesenvolvimento = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-[340px] bg-white rounded-3xl border border-slate-200 shadow-xl p-8 flex flex-col items-center text-center animate-in zoom-in duration-500">
        
        {/* Ícone Animado ou Ilustração Simples */}
        <div className="w-20 h-20 bg-agro-green/10 rounded-full flex items-center justify-center mb-6 relative">
          <span className="text-4xl animate-bounce">🛠️</span>
          <div className="absolute inset-0 rounded-full border-2 border-dashed border-agro-green/30 animate-spin-slow" />
        </div>

        <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter mb-2">
          🚧 Desenvolvimento 🚧
        </h2>
        
        <p className="text-xs font-medium text-slate-500 leading-relaxed mb-8">
          Relatório Operacional em Desenvolvimento
        </p>
        

        {/* Botão Voltar Inteligente */}
        <button
          onClick={() => navigate(-1)} // Volta para a página anterior no histórico
          className="w-full py-4 bg-agro-green text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-green-200 hover:bg-green-600 active:scale-95 transition-all flex items-center justify-center gap-2"
        >
          <span>←</span>
          <span>Voltar ao Painel</span>
        </button>

        <div className="mt-6 flex items-center gap-2 opacity-30">
          <div className="w-2 h-2 rounded-full bg-agro-orange animate-pulse" />
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">QualyFlow 2026</span>
        </div>
      </div>
    </div>
  );
};

// Adicione isso ao seu arquivo de estilos global se quiser a animação de giro lento:
// .animate-spin-slow { animation: spin 8s linear infinite; }

export default EmDesenvolvimento;