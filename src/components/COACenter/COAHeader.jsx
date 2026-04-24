import React from 'react';
import { useNavigate } from 'react-router-dom';
import coacenterLogo from '../../gallery/logo/coacenter.png';

const COAHeader = ({ onMenuOpen }) => {
  const navigate = useNavigate();

  return (
    <header className="w-full bg-[#161B22] border-b border-slate-800 sticky top-0 z-30 shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo e Nome */}
        <div className="flex items-center gap-2">
          <img src={coacenterLogo} alt="COA Center" className="w-8 h-8 object-contain" />
          <h1 className="text-lg font-black text-slate-200 uppercase tracking-tighter">
            COA<span className="text-emerald-500">Center</span>
          </h1>
        </div>

        {/* Botões de Ação */}
        <div className="flex gap-4">
          <button 
            onClick={() => navigate('/')} 
            className="text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-emerald-400 transition-colors"
          >
            Início
          </button>
          <button 
            onClick={onMenuOpen} 
            className="text-[10px] font-black text-emerald-500 uppercase tracking-widest border-b-2 border-emerald-600"
          >
            Menu
          </button>
        </div>
      </div>
    </header>
  );
};

export default COAHeader;