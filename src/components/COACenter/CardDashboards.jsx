import React from 'react';
import { useNavigate } from 'react-router-dom';

import dashboardsImage from '../../gallery/img/coacenter_dashboards.png';

// Ajuste estes valores para controlar o tamanho da imagem.
const IMAGE_MAX_WIDTH_PX = 420;
const IMAGE_MAX_HEIGHT_PX = 220;

const CardDashboards = ({ selectedDate }) => {
  const navigate = useNavigate();

  const handleNavigate = () => {
    navigate('/coacenter/dashboard', {
      state: { selectedDate },
    });
  };

  return (
    <section className="coa-section">
      <div className="coa-card">
        <div className="coa-card__header">
          <h2 className="coa-text-title !mb-0">Dashboards</h2>
        </div>

        <div className="coa-card__body flex flex-col gap-4">
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

          <p className="text-sm font-medium text-[var(--coa-text-soft)]">
            Acesse os dashboards operacionais para acompanhar indicadores,
            equipamentos, grupos de operações e principais ofensores.
          </p>

          <div className="flex justify-end pt-1">
            <button
              className="coa-btn coa-btn--ghost min-w-[130px]"
              type="button"
              onClick={handleNavigate}
            >
              Ver Todos
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CardDashboards;
