import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../shared/api/http";
import { useAuth } from "../auth/authContext";

const fallbackPopular = [
  "React + TypeScript",
  "UX/UI дизайн",
  "Data Science & Python",
  "Project Management (PMBOK/Scrum)",
  "Cybersecurity basics",
  "SQL & Databases",
];

export default function PopularSearches() {
  const { user } = useAuth();
  const [popular, setPopular] = useState<string[]>(fallbackPopular);
  const [note, setNote] = useState<string | null>(null);

  const [recommended, setRecommended] = useState<{ id: number; title: string }[]>([]);
  const [recNote, setRecNote] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/search/popular", { params: { limit: 12 } });
        const list = (res.data?.popular || []).map((x: any) => String(x?.query || "").trim()).filter(Boolean);
        if (list.length > 0) {
          setPopular(list);
          setNote("Адаптивни популярни търсения (на база реални търсения)");
        } else {
          setPopular(fallbackPopular);
          setNote("Демо списък (няма събрани търсения)");
        }
      } catch {
        setPopular(fallbackPopular);
        setNote("Демо списък (fallback)");
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      if (!user) {
        setRecommended([]);
        setRecNote("Влез в профила си, за да видиш персонализирани препоръки.");
        return;
      }
      try {
        const res = await api.get("/me/recommendations", { params: { limit: 10 } });
        const list = (res.data || [])
          .map((x: any) => ({ id: Number(x?.id), title: String(x?.title || "").trim() }))
          .filter((x: any) => Number.isFinite(x.id) && x.title);
        setRecommended(list);
        setRecNote(list.length ? "Препоръчани за вас (на база покупки и добавяния в кошницата)" : "Няма достатъчно сигнали още — показваме само популярните търсения.");
      } catch {
        setRecommended([]);
        setRecNote("Неуспешно зареждане на препоръките.");
      }
    })();
  }, [user]);

  return (
    <div className="elite-page">
      <div className="elite-card">
        <h2 className="elite-h2">Популярни търсения</h2>
        <p className="elite-muted">{note || "Бързи входни точки към търсени теми."}</p>

        <div className="elite-chip-wrap" style={{ marginTop: 12 }}>
          {popular.map((x) => (
            <Link key={x} to={`/catalog?query=${encodeURIComponent(x)}`} className="elite-chip">
              {x}
            </Link>
          ))}
        </div>

        <div style={{ height: 18 }} />

        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 950 }}>Препоръчани за вас</h3>
        <p className="elite-muted" style={{ marginTop: 6 }}>{recNote || ""}</p>

        {recommended.length ? (
          <div className="elite-chip-wrap" style={{ marginTop: 12 }}>
            {recommended.map((x) => (
              <Link key={x.id} to={`/catalog?query=${encodeURIComponent(x.title)}`} className="elite-chip">
                {x.title}
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
