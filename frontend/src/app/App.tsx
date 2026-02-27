import { Navigate, NavLink, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import Catalog from "../features/catalog/CatalogPage";
import Profile from "../features/profile/ProfilePage";
import Chat from "../features/chat/ChatPage";
import CartView from "../features/cart/CartPage";
import { useCart } from "../features/cart/cartContext";
import "./App.css";
import Footer from "../shared/components/layout/Footer";
import CookieBanner from "../shared/components/layout/CookieBanner";
import logo from "../assets/elitearn-logo.png";

import Help from "../pages/static/HelpPage";
import Contact from "../pages/static/ContactPage";
import FAQ from "../pages/static/FAQPage";
import HowItWorks from "../pages/static/HowItWorksPage";
import Tips from "../pages/static/TipsPage";
import PopularSearches from "../features/search/PopularSearchesPage";
import Terms from "../pages/legal/Terms";
import Privacy from "../pages/legal/Privacy";
import Cookies from "../pages/legal/Cookies";
import CookieSettings from "../pages/static/CookieSettingsPage";

function CatalogRoute() {
  const navigate = useNavigate();

  return (
    <Catalog
      onGoMyCourses={() => {
        navigate("/profile?panel=purchased");
      }}
    />
  );
}

function CartRoute() {
  const navigate = useNavigate();

  return <CartView onRequireAuth={() => navigate("/profile")} />;
}

function ProfileRoute() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();

  const panel = sp.get("panel");
  const forcePanel = panel === "purchased" || panel === "create" || panel === "created" ? panel : undefined;

  return <Profile onGoCatalog={() => navigate("/catalog")} forcePanel={forcePanel} />;
}

export default function App() {
  const { cartCount } = useCart();

  return (
    <div className="elite-wrap">
      <header className="elite-header">
        <div className="elite-header-left">
          <NavLink className="elite-logo-btn" to="/catalog" aria-label="Към Каталог">
            <img className="elite-logo" src={logo} alt="Elitearn logo" />
          </NavLink>
          <div>
            <div className="elite-title">Elitearn</div>
            <div className="elite-sub">Платформа за курсове и умения</div>
          </div>
        </div>

        <nav className="elite-nav">
          <NavLink to="/catalog" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Каталог
          </NavLink>

          <NavLink to="/how-it-works" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Как работи
          </NavLink>

          <NavLink to="/help" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Помощ
          </NavLink>

          <NavLink to="/contact" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Връзка с нас
          </NavLink>

          <NavLink to="/chat" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Чат
          </NavLink>

          <NavLink to="/cart" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Кошница{cartCount > 0 ? <span className="elite-badge">{cartCount}</span> : null}
          </NavLink>

          <NavLink to="/profile" className={({ isActive }) => `elite-nav-link ${isActive ? "active" : ""}`}>
            Профил
          </NavLink>
        </nav>
      </header>

      <main className="elite-main">
        <Routes>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<CatalogRoute />} />
          <Route path="/cart" element={<CartRoute />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<ProfileRoute />} />

          <Route path="/help" element={<Help />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/faq" element={<FAQ />} />
          <Route path="/how-it-works" element={<HowItWorks />} />
          <Route path="/tips" element={<Tips />} />
          <Route path="/popular-searches" element={<PopularSearches />} />

          <Route path="/legal/terms" element={<Terms />} />
          <Route path="/legal/privacy" element={<Privacy />} />
          <Route path="/legal/cookies" element={<Cookies />} />
          <Route path="/cookies/settings" element={<CookieSettings />} />

          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </main>

      <Footer />
      <CookieBanner />
    </div>
  );
}
