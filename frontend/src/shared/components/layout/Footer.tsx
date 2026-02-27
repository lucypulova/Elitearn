import { NavLink } from "react-router-dom";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="elite-footer">
      <div className="elite-footer-top">
        <div className="elite-footer-col">
          <div className="elite-footer-brand">Elitearn</div>
          <div className="elite-muted">
            Платформа за курсове и умения – каталог, покупки, достъп и профили в един модерен поток.
          </div>
        </div>

        <div className="elite-footer-col">
          <div className="elite-footer-title">Помощ</div>
          <NavLink to="/help" className="elite-footer-link">Help Center</NavLink>
          <NavLink to="/contact" className="elite-footer-link">Връзка с нас</NavLink>
          <NavLink to="/faq" className="elite-footer-link">Често задавани въпроси</NavLink>
          <NavLink to="/tips" className="elite-footer-link">Съвети</NavLink>
        </div>

        <div className="elite-footer-col">
          <div className="elite-footer-title">Информация</div>
          <NavLink to="/how-it-works" className="elite-footer-link">Как работи</NavLink>
          <NavLink to="/popular-searches" className="elite-footer-link">Популярни търсения</NavLink>
          <NavLink to="/catalog" className="elite-footer-link">Каталог</NavLink>
          <NavLink to="/profile" className="elite-footer-link">Профил</NavLink>
        </div>

        <div className="elite-footer-col">
          <div className="elite-footer-title">Правна информация</div>
          <NavLink to="/legal/terms" className="elite-footer-link">Общи условия</NavLink>
          <NavLink to="/legal/privacy" className="elite-footer-link">Поверителност</NavLink>
          <NavLink to="/legal/cookies" className="elite-footer-link">Политика на бисквитките</NavLink>
          <NavLink to="/cookies/settings" className="elite-footer-link">Настройки на бисквитките</NavLink>
        </div>
      </div>

      <div className="elite-footer-bottom">
        <div className="elite-footer-copy">
          © {year} Elitearn · изготвено от Людмила Пулова, ФН: 1MI0700175
        </div>
      </div>
    </footer>
  );
}
