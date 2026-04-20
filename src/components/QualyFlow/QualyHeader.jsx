import React from 'react';
import { useNavigate } from 'react-router-dom';
import qualyLogo from '../../gallery/logo/qualyflow.png';

const QualyHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-white border-b border-slate-200 sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo e Nome */}
        <div className="flex items-center gap-2">
          <img src={qualyLogo} alt="Qualy" className="w-8 h-8 object-contain" />
          <h1 className="text-lg font-black text-agro-green uppercase tracking-tighter">
            Qualy<span className="text-agro-orange">Flow</span>
          </h1>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <button onClick={() => navigate('/')} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-agro-green transition-colors">
            Início
          </button>
          <button onClick={onMenuOpen} className="text-[10px] font-black text-agro-orange uppercase tracking-widest border-b-2 border-agro-orange">
            Menu
          </button>
        </div>
      </div>
    </header>
  );
};

export default QualyHeader;