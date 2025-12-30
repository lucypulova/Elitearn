import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "./api";
import { getTokenForLinks } from "./auth";

type MyCourse = {
  course_id: number;
  granted_at: string;
  title: string;
  description: string;
  price: number;
  category_name: string;
  department_name: string;
};

type Asset = {
  id: number;
  course_id: number;
  title: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type PrivateInfo = {
  id: number;
  is_private_lesson: number;
  contact_phone: string | null;
  contact_note: string | null;
};

export default function MyCourses() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<MyCourse[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [priv, setPriv] = useState<PrivateInfo | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const res = await api.get("/me/courses");
    setCourses(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const loadAssets = async (courseId: number) => {
    setMsg(null);
    setSelected(courseId);

    try {
      const aRes = await api.get(`/courses/${courseId}/assets`);
      setAssets(aRes.data || []);
    } catch (e: any) {
      setAssets([]);
      setMsg(e?.response?.data?.error || "Неуспешно зареждане на материалите");
      setPriv(null);
      return;
    }

    try {
      const pRes = await api.get(`/courses/${courseId}/private-info`);
      setPriv(pRes.data || null);
    } catch (_e: any) {
      setPriv(null);
    }
  };
  const token = getTokenForLinks();

  return (
    <div className="elite-card">
      <h2 style={{ marginTop: 0 }}>Моите курсове</h2>

      {courses.length === 0 ? (
        <div>Нямате закупени курсове.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
          {courses.map((c) => (
            <div
              key={c.course_id}
              style={{
                padding: "12px 14px",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 14,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 800 }}>{c.title}</div>
                  <div style={{ opacity: 0.85, fontSize: 13 }}>
                    {c.department_name} • {c.category_name}
                  </div>
                </div>

                <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>
                  <button className="elite-btn" onClick={() => navigate(`/chat?courseId=${c.course_id}`)}>
                    Попитай
                  </button>
                  <button className="elite-btn" onClick={() => loadAssets(c.course_id)}>
                    Материали
                  </button>
                </div>
              </div>

              {selected === c.course_id && (
                <div style={{ marginTop: 10 }}>
                  {msg && <div style={{ marginBottom: 8 }}>{msg}</div>}
                  {priv && Number(priv.is_private_lesson) === 1 && (
                    <div
                      style={{
                        marginBottom: 10,
                        padding: "10px 12px",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                      }}
                    >
                      <div style={{ fontWeight: 800, marginBottom: 4 }}>Контакт за частен урок</div>
                      <div style={{ opacity: 0.9 }}>
                        Телефон: {priv.contact_phone || "(не е зададен)"}
                        {priv.contact_note ? ` • ${priv.contact_note}` : ""}
                      </div>
                    </div>
                  )}
                  {assets.length === 0 ? (
                    <div style={{ opacity: 0.85 }}>Няма качени материали за този курс.</div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      {assets.map((a) => (
                        <div
                          key={a.id}
                          style={{
                            padding: "10px 12px",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 12,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700 }}>{a.title}</div>
                            <div style={{ opacity: 0.8, fontSize: 12 }}>
                              {a.mime_type} • {Math.round((a.file_size || 0) / 1024)} KB
                            </div>
                          </div>

                          <a
                            className="elite-btn"
                            href={`http://localhost:4000/api/assets/${a.id}/download?token=${encodeURIComponent(
                              token || ""
                            )}`}
                            style={{ textDecoration: "none" }}
                          >
                            Изтегли
                          </a>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
