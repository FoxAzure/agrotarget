import React from 'react';
import { useNavigate } from 'react-router-dom';
import coacenterLogo from '../../gallery/logo/coacenter.png';

const COAOciosoHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-[#161B22] border-b border-slate-800 sticky top-0 z-30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        
        {/* Logo e Título */}
        <div className="flex items-center gap-2">
          <img src={coacenterLogo} alt="COA" className="w-8 h-8 object-contain" />
          <h1 className="text-lg font-black text-slate-200 uppercase tracking-tighter leading-none">
            Motor Ocioso
          </h1>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/coacenter')} 
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-400 transition-colors"
          >
            Voltar
          </button>
          
          <button 
            onClick={onMenuOpen} 
            className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b-2 border-emerald-600 hover:opacity-80 transition-opacity"
          >
            Menu
          </button>
        </div>
      </div>
    </header>
  );
};

export default COAOciosoHeader;