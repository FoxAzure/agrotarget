import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ScrollToTop = () => {
  const { pathname } = useLocation();

  useEffect(() => {
    // Toda vez que o "pathname" (a rota) mudar, a Umeko puxa a página pro topo!
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Pode usar 'smooth' se quiser um efeitinho deslizando
    });
  }, [pathname]);

  return null; // Ele não renderiza nada visualmente, trabalha nas sombras.
};

export default ScrollToTop;