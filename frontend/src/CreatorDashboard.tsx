import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import "./App.css";

type Department = { id: number; name: string; description: string | null };
type Category = { id: number; department_id: number; parent_id: number | null; name: string; description: string | null };
type AttributeValue = { id: number; attribute_id: number; value: string };
type Attribute = { id: number; code: string; name: string; values: AttributeValue[] };

export default function CreatorDashboard() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [form, setForm] = useState({
    category_id: "",
    title: "",
    description: "",
    price: "0",
    is_private_lesson: false,
    contact_phone: "",
    contact_note: "",
  });
  const [msg, setMsg] = useState<string | null>(null);

  // Catalog forms
  const [depName, setDepName] = useState("");
  const [depDesc, setDepDesc] = useState("");

  const [catDepartmentId, setCatDepartmentId] = useState<number | "">("");
  const [catParentId, setCatParentId] = useState<number | "">("");
  const [catName, setCatName] = useState("");
  const [catDesc, setCatDesc] = useState("");

  const [attrCode, setAttrCode] = useState("");
  const [attrName, setAttrName] = useState("");

  const [attrIdForValue, setAttrIdForValue] = useState<number | "">("");
  const [attrValueText, setAttrValueText] = useState("");

  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [dRes, cRes, aRes] = await Promise.all([api.get("/departments"), api.get("/categories"), api.get("/attributes")]);
    setDepartments(dRes.data || []);
    setCategories(cRes.data || []);
    setAttributes(aRes.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const categoriesByDepartment = useMemo(() => {
    const map = new Map<number, Category[]>();
    for (const c of categories) {
      const list = map.get(c.department_id) || [];
      list.push(c);
      map.set(c.department_id, list);
    }
    for (const [k, list] of map.entries()) {
      list.sort((a, b) => a.name.localeCompare(b.name, "bg"));
      map.set(k, list);
    }
    return map;
  }, [categories]);

  const rootsForSelectedDep = useMemo(() => {
    if (!catDepartmentId) return [];
    const list = categoriesByDepartment.get(Number(catDepartmentId)) || [];
    return list.filter((x) => x.parent_id === null);
  }, [categoriesByDepartment, catDepartmentId]);

  const createCourse = async (e: FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Phone validation for private lesson
    if (form.is_private_lesson) {
      const phone = (form.contact_phone || "").trim();
      if (!phone) {
        setMsg("Моля, въведи телефон за връзка за частния урок.");
        return;
      }

      // Allow +, spaces, dashes, parentheses. Validate by digit count.
      const digits = phone.replace(/\D/g, "");
      const looksLikePhone = /^\+?[0-9()\-\s.]+$/.test(phone) && digits.length >= 7 && digits.length <= 15;
      if (!looksLikePhone) {
        setMsg("Моля, въведи валиден телефонен номер (например +359 88 123 4567).");
        return;
      }
    }

    try {
      await api.post("/creator/courses", {
        category_id: Number(form.category_id),
        title: form.title,
        description: form.description,
        is_private_lesson: form.is_private_lesson,
        contact_phone: form.contact_phone?.trim() ? form.contact_phone.trim() : null,
        contact_note: form.contact_note || null,
        price: Number(form.price || 0),
      });
      setForm({
        category_id: "",
        title: "",
        description: "",
        price: "0",
        is_private_lesson: false,
        contact_phone: "",
        contact_note: "",
      });
      await load();
      setMsg("Курсът е създаден.");
    } catch (err: any) {
      setMsg(err?.response?.data?.error || "Грешка при създаване");
    }
  };

  const run = async (fn: () => Promise<void>, okText: string) => {
    try {
      setBusy(true);
      setMsg(null);
      await fn();
      await load();
      setMsg(okText);
    } catch (e: any) {
      setMsg(e?.response?.data?.error || e?.message || "Възникна грешка.");
    } finally {
      setBusy(false);
    }
  };

  const createDepartment = () =>
    run(
      async () => {
        await api.post("/admin/departments", { name: depName, description: depDesc || null });
        setDepName("");
        setDepDesc("");
      },
      "Отделът е създаден успешно."
    );

  const createCategory = () =>
    run(
      async () => {
        await api.post("/admin/categories", {
          department_id: catDepartmentId,
          parent_id: catParentId ? Number(catParentId) : null,
          name: catName,
          description: catDesc || null,
        });
        setCatName("");
        setCatDesc("");
        setCatParentId("");
      },
      "Категорията е създадена успешно."
    );

  const createAttribute = () =>
    run(
      async () => {
        await api.post("/admin/attributes", { code: attrCode.trim(), name: attrName.trim() });
        setAttrCode("");
        setAttrName("");
      },
      "Характеристиката е създадена успешно."
    );

  const createAttributeValue = () =>
    run(
      async () => {
        await api.post("/admin/attribute-values", { attribute_id: attrIdForValue, value: attrValueText.trim() });
        setAttrValueText("");
      },
      "Стойността е добавена успешно."
    );

  return (
    <div className="elite-card">
      <h2 style={{ marginTop: 0 }}>Създай курс</h2>
      <div style={{ opacity: 0.85, marginBottom: 10 }}>
        Създаване на курс. Оттук управляваш и каталога (отдели/категории/характеристики)
      </div>

      {msg && <div style={{ marginBottom: 10 }}>{msg}</div>}

      <form onSubmit={createCourse} style={{ display: "grid", gap: 10, marginBottom: 16 }}>
        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.85 }}>Категория</label>
          <select
            value={form.category_id}
            onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
            className="elite-input"
            required
          >
            <option value="">Избери категория</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.85 }}>Заглавие</label>
          <input className="elite-input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <label style={{ fontSize: 13, opacity: 0.85 }}>Описание</label>
          <textarea
            className="elite-input"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={3}
            required
          />
        </div>

        <div style={{ display: "grid", gap: 8, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              checked={form.is_private_lesson}
              onChange={(e) => setForm((f) => ({ ...f, is_private_lesson: e.target.checked }))}
            />
            <div style={{ fontWeight: 700 }}>Частен урок / контакт след покупка</div>
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>Телефон за връзка (ще се вижда само за закупили курса)</label>
            <input
              className="elite-input"
              value={form.contact_phone}
              onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
              placeholder="например +359 88 123 4567"
              disabled={!form.is_private_lesson}
            />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>Бележка (по желание)</label>
            <input
              className="elite-input"
              value={form.contact_note}
              onChange={(e) => setForm((f) => ({ ...f, contact_note: e.target.value }))}
              placeholder="например Viber/WhatsApp, часови прозорци"
              disabled={!form.is_private_lesson}
            />
          </div>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, display: "grid", gap: 6 }}>
            <label style={{ fontSize: 13, opacity: 0.85 }}>Цена €</label>
            <input className="elite-input" type="number" min={0} step={0.01} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} />
          </div>
        </div>

        <div>
          <button className="elite-btn primary" type="submit">
            Създай курс
          </button>
        </div>
      </form>

      <div style={{ marginTop: 10 }}>
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 800, marginBottom: 8 }}>Каталог: отдели, категории и характеристики</summary>

          <div style={{ display: "grid", gap: 16, marginTop: 10 }}>
            <section className="elite-card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>1) Създай отдел</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <label>Име на отдел</label>
                  <input value={depName} onChange={(e) => setDepName(e.target.value)} placeholder="Напр. Езици" />
                </div>
                <div>
                  <label>Описание (по избор)</label>
                  <input value={depDesc} onChange={(e) => setDepDesc(e.target.value)} placeholder="Кратко описание" />
                </div>
                <button className="elite-btn" type="button" onClick={createDepartment} disabled={busy || !depName.trim()}>
                  Създай отдел
                </button>
              </div>
            </section>

            <section className="elite-card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>2) Създай категория / подкатегория</h3>
              <div style={{ display: "grid", gap: 10 }}>
                <div>
                  <label>Отдел</label>
                  <select
                    value={catDepartmentId}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      setCatDepartmentId(v);
                      setCatParentId("");
                    }}
                  >
                    <option value="">Избери отдел</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Родителска категория (по избор)</label>
                  <select
                    value={catParentId}
                    onChange={(e) => setCatParentId(e.target.value ? Number(e.target.value) : "")}
                    disabled={!catDepartmentId}
                  >
                    <option value="">(Няма) — основна категория</option>
                    {rootsForSelectedDep.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <div className="elite-muted" style={{ fontSize: 12, marginTop: 6 }}>
                    Ако избереш родител, ще създадеш <strong>подкатегория</strong>.
                  </div>
                </div>

                <div>
                  <label>Име</label>
                  <input value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Напр. Английски" />
                </div>

                <div>
                  <label>Описание (по избор)</label>
                  <input value={catDesc} onChange={(e) => setCatDesc(e.target.value)} placeholder="Кратко описание" />
                </div>

                <button
                  className="elite-btn"
                  type="button"
                  onClick={createCategory}
                  disabled={busy || !catDepartmentId || !catName.trim()}
                >
                  Създай категория
                </button>
              </div>
            </section>

            <section className="elite-card" style={{ margin: 0 }}>
              <h3 style={{ marginTop: 0 }}>3) Характеристики</h3>

              <div style={{ display: "grid", gap: 14 }}>
                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label>Код</label>
                    <input value={attrCode} onChange={(e) => setAttrCode(e.target.value)} placeholder="напр. level" />
                  </div>
                  <div>
                    <label>Име</label>
                    <input value={attrName} onChange={(e) => setAttrName(e.target.value)} placeholder="напр. Ниво" />
                  </div>
                  <button className="elite-btn" type="button" onClick={createAttribute} disabled={busy || !attrCode.trim() || !attrName.trim()}>
                    Създай характеристика
                  </button>
                </div>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label>Избери характеристика</label>
                    <select value={attrIdForValue} onChange={(e) => setAttrIdForValue(e.target.value ? Number(e.target.value) : "")}>
                      <option value="">Избери…</option>
                      {attributes.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label>Стойност</label>
                    <input value={attrValueText} onChange={(e) => setAttrValueText(e.target.value)} placeholder="напр. Начинаещ" />
                  </div>
                  <button className="elite-btn" type="button" onClick={createAttributeValue} disabled={busy || !attrIdForValue || !attrValueText.trim()}>
                    Добави стойност
                  </button>
                </div>
              </div>
            </section>
          </div>
        </details>
      </div>
    </div>
  );
}
