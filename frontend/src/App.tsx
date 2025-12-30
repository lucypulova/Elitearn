import { Navigate, NavLink, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import Catalog from "./Catalog";
import Profile from "./Profile";
import Chat from "./Chat";
import CartView from "./CartView";
import { useCart } from "./cart";
import "./App.css";
import Footer from "./components/Footer";
import logo from "./assets/elitearn-logo.png";

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

  return <CartView onRequireAuth={() => navigate("/profile") } />;
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
      <div className="elite-hero">
        <div className="elite-brand">
          <NavLink className="elite-logo-btn" to="/catalog" aria-label="Към Каталог">
            <img className="elite-logo" src={logo} alt="Elitearn logo" />
          </NavLink>
          <h1 className="elite-title">Elitearn</h1>
        </div>

        <p className="elite-sub">Платформа за курсове и умения</p>

        <div className="elite-tabs">
          <NavLink
            to="/catalog"
            className={({ isActive }) => `elite-tab ${isActive ? "active" : ""}`}
          >
            Каталог
          </NavLink>

          <NavLink
            to="/cart"
            className={({ isActive }) => `elite-tab ${isActive ? "active" : ""}`}
          >
            Кошница{cartCount > 0 ? <span className="elite-badge">{cartCount}</span> : null}
          </NavLink>

          <NavLink
            to="/chat"
            className={({ isActive }) => `elite-tab ${isActive ? "active" : ""}`}
          >
            Чат
          </NavLink>

          <NavLink
            to="/profile"
            className={({ isActive }) => `elite-tab ${isActive ? "active" : ""}`}
          >
            Профил
          </NavLink>
        </div>
      </div>

      <div style={{ marginTop: 14 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/catalog" replace />} />
          <Route path="/catalog" element={<CatalogRoute />} />
          <Route path="/cart" element={<CartRoute />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="*" element={<Navigate to="/catalog" replace />} />
        </Routes>
      </div>

      <Footer />
    </div>
  );
}
