import { useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { getTokenForLinks } from "./auth";

type CreatorCourse = {
  id: number;
  title: string;
  category_id: number;
  price: number;
  is_published: 0 | 1;
  is_private_lesson?: 0 | 1;
  contact_phone?: string | null;
  contact_note?: string | null;
  created_at: string;
};

type Asset = {
  id: number;
  course_id: number;
  title: string;
  mime_type: string;
  file_size: number;
  created_at: string;
};

type AttributeValue = { id: number; attribute_id: number; value: string };
type Attribute = { id: number; code: string; name: string; values: AttributeValue[] };

type AssignedAttr = {
  id: number; 
  attribute_id: number;
  attribute_name: string;
  value: string;
};

export default function CreatedCourses() {
  const [courses, setCourses] = useState<CreatorCourse[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    const [cRes, aRes] = await Promise.all([api.get("/creator/courses"), api.get("/attributes")]);
    setCourses(cRes.data || []);
    setAttributes(aRes.data || []);
  };

  useEffect(() => {
    void load();
  }, []);

  const attrValuesFlat = useMemo(() => {
    const all: { id: number; label: string }[] = [];
    for (const a of attributes) {
      for (const v of a.values || []) {
        all.push({ id: v.id, label: `${a.name}: ${v.value}` });
      }
    }
    all.sort((x, y) => x.label.localeCompare(y.label, "bg"));
    return all;
  }, [attributes]);

  const uploadAssets = async (courseId: number, files: File[], titlePrefix?: string) => {
    setMsg(null);
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append("file", f);
        fd.append("title", titlePrefix ? `${titlePrefix} - ${f.name}` : f.name);
        await api.post(`/creator/courses/${courseId}/assets`, fd);
      }
      setMsg(files.length === 1 ? "Материалът е качен." : `Качени материали: ${files.length}`);
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Грешка при качване");
    }
  };

  return (
    <div className="elite-card">
      <h2 style={{ marginTop: 0 }}>Създадени курсове</h2>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        Редакция на курсовете, които ти си създал: качване на материали и закачане на характеристики.
      </div>

      {msg && <div style={{ marginBottom: 10 }}>{msg}</div>}

      {courses.length === 0 ? (
        <div>Нямате създадени курсове.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {courses.map((c) => (
            <CourseEditorRow
              key={c.id}
              course={c}
              onUploadMany={uploadAssets}
              attrValuesFlat={attrValuesFlat}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CourseEditorRow({
  course,
  onUploadMany,
  attrValuesFlat,
}: {
  course: CreatorCourse;
  onUploadMany: (courseId: number, files: File[], titlePrefix?: string) => Promise<void>;
  attrValuesFlat: { id: number; label: string }[];
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [titlePrefix, setTitlePrefix] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);

  const [attrsOpen, setAttrsOpen] = useState(false);
  const [assigned, setAssigned] = useState<AssignedAttr[]>([]);
  const [assignValueId, setAssignValueId] = useState<number | "">("");
  const [attrBusy, setAttrBusy] = useState(false);
  const token = getTokenForLinks();

  const loadAssets = async () => {
    const res = await api.get(`/courses/${course.id}/assets`);
    setAssets(res.data || []);
  };

  const loadAssigned = async () => {
    const res = await api.get(`/creator/courses/${course.id}/attribute-values`);
    setAssigned(res.data || []);
  };

  const upload = async () => {
    if (files.length === 0) return;
    setBusy(true);
    try {
      await onUploadMany(course.id, files, titlePrefix || undefined);
      setFiles([]);
      setTitlePrefix("");
      if (assetsOpen) await loadAssets();
    } finally {
      setBusy(false);
    }
  };

  const attachAttr = async () => {
    if (!assignValueId) return;
    setAttrBusy(true);
    try {
      await api.post(`/creator/courses/${course.id}/attribute-values`, {
        attribute_value_id: Number(assignValueId),
      });
      setAssignValueId("");
      await loadAssigned();
    } finally {
      setAttrBusy(false);
    }
  };

  const detachAttr = async (attributeValueId: number) => {
    setAttrBusy(true);
    try {
      await api.delete(`/creator/courses/${course.id}/attribute-values/${attributeValueId}`);
      await loadAssigned();
    } finally {
      setAttrBusy(false);
    }
  };

  return (
    <div
      style={{
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14,
      }}
    >
      <div style={{ fontWeight: 800 }}>{course.title}</div>
      

      {(course.is_private_lesson ? 1 : 0) === 1 && (
        <div style={{ opacity: 0.85, fontSize: 13, marginBottom: 10 }}>
          Частен урок • Телефон: {course.contact_phone || "(не е зададен)"}
          {course.contact_note ? ` • ${course.contact_note}` : ""}
        </div>
      )}

      {/* Materials */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        <input
          className="elite-input"
          placeholder="Префикс за имената (по желание)"
          value={titlePrefix}
          onChange={(e) => setTitlePrefix(e.target.value)}
          style={{ flex: 1, minWidth: 220 }}
        />

        <input
          className="elite-input"
          type="file"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
          style={{ flex: 1, minWidth: 220 }}
        />

        <button className="elite-btn" type="button" onClick={upload} disabled={files.length === 0 || busy}>
          Качи {files.length > 1 ? `(${files.length})` : ""}
        </button>

        <button
          className="elite-btn"
          type="button"
          onClick={async () => {
            const next = !assetsOpen;
            setAssetsOpen(next);
            if (next) await loadAssets();
          }}
        >
          {assetsOpen ? "Скрий материали" : "Виж материали"}
        </button>
      </div>

      {assetsOpen && (
        <div style={{ marginBottom: 12 }}>
          {assets.length === 0 ? (
            <div style={{ opacity: 0.85 }}>Няма качени материали.</div>
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
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div style={{ opacity: 0.8, fontSize: 12 }}>
                      {a.mime_type} • {Math.round((a.file_size || 0) / 1024)} KB
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <a
                      className="elite-btn"
                      href={`http://localhost:4000/api/assets/${a.id}/download?token=${encodeURIComponent(token || "")}`}
                      style={{ textDecoration: "none" }}
                    >
                      Изтегли
                    </a>
                    <button
                      className="elite-btn"
                      type="button"
                      onClick={async () => {
                        if (!confirm("Сигурна ли си, че искаш да премахнеш този материал?")) return;
                        try {
                          await api.delete(`/creator/assets/${a.id}`);
                          await loadAssets();
                        } catch (e: any) {
                          alert(e?.response?.data?.error || "Грешка при премахване на материала");
                        }
                      }}
                    >
                      Премахни
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attributes */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button
          className="elite-btn"
          type="button"
          onClick={async () => {
            const next = !attrsOpen;
            setAttrsOpen(next);
            if (next) await loadAssigned();
          }}
        >
          {attrsOpen ? "Скрий характеристики" : "Закачи характеристики"}
        </button>
      </div>

      {attrsOpen && (
        <div style={{ marginTop: 10 }}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="elite-input"
              value={assignValueId}
              onChange={(e) => setAssignValueId(e.target.value ? Number(e.target.value) : "")}
              style={{ flex: 1, minWidth: 260 }}
            >
              <option value="">Избери характеристика…</option>
              {attrValuesFlat.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>

            <button className="elite-btn" type="button" onClick={attachAttr} disabled={!assignValueId || attrBusy}>
              Закачи
            </button>
          </div>

          <div style={{ marginTop: 10 }}>
            {assigned.length === 0 ? (
              <div style={{ opacity: 0.85 }}>Няма закачени характеристики.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {assigned.map((x) => (
                  <div
                    key={x.id}
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
                      <div style={{ fontWeight: 700 }}>{x.attribute_name}</div>
                      <div style={{ opacity: 0.85, fontSize: 13 }}>{x.value}</div>
                    </div>
                    <button className="elite-btn" type="button" onClick={() => detachAttr(x.id)} disabled={attrBusy}>
                      Премахни
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
