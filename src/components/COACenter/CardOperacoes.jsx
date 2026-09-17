import React from 'react';
import { useNavigate } from 'react-router-dom';



import dashboardsImage from '../../gallery/img/coacenter_operacoes.png';

// Ajuste estes valores para controlar o tamanho da imagem.
const IMAGE_MAX_WIDTH_PX = 420;
const IMAGE_MAX_HEIGHT_PX = 220;


const CardOperacoes = ({ selectedDate }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate('/coacenter/operacoes', { 
      state: { selectedDate } 
    });
  };

  return (
    <section className="coa-section">
      <div className="coa-card">
        <div className="coa-card__header">
          <h2 className="coa-text-title !mb-0">Operações</h2>
        </div>


                  <div className="flex w-full justify-start">
                    <img
                      src={dashboardsImage}
                      alt="Dashboards operacionais do COA Center"
                      className="block h-auto w-full object-contain object-left"
                      style={{
                        maxWidth: `${IMAGE_MAX_WIDTH_PX}px`,
                        maxHeight: `${IMAGE_MAX_HEIGHT_PX}px`,
                        opacity:10
                      }}
                    />
                  </div>

        <div className="coa-card__body flex flex-col gap-4">
          <p className="text-sm font-medium text-[var(--coa-text-soft)]">
            Analisar Operações por equipamento ou operador
          </p>

          <div className="pt-1 flex justify-end">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={handleNavigate}
            >
              Ver Operações
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardOperacoes;