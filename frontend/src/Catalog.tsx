import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import { useCart } from "./cart";
import "./App.css";

type Department = { id: number; name: string; description: string | null };

type Category = {
  id: number;
  department_id: number;
  parent_id: number | null;
  name: string;
  description: string | null;
};

type AttributeValue = { id: number; attribute_id: number; value: string };

type Attribute = {
  id: number;
  code: string;
  name: string;
  values: AttributeValue[];
};

type Course = {
  id: number;
  title: string;
  description: string;
  price: number;
  created_at: string;
  creator_user_id?: number;
  category_id: number;
  category_name?: string;
  department_id?: number;
  department_name?: string;
};

type SortKey = "title_asc" | "title_desc" | "price_asc" | "price_desc";

type CatalogProps = {
  onGoMyCourses?: () => void;
};

export default function Catalog({ onGoMyCourses }: CatalogProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addGuest, refreshServerCount } = useCart();
  const [searchParams, setSearchParams] = useSearchParams();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [error, setError] = useState<string>("");

  // Recommendations
  const [recommended, setRecommended] = useState<Course[]>([]);
  const [recError, setRecError] = useState<string>("");
  const [recSeedCourseId, setRecSeedCourseId] = useState<number | null>(null);
  const [recSeedCourseTitle, setRecSeedCourseTitle] = useState<string | null>(null);
  const [recLoading, setRecLoading] = useState<boolean>(false);

  // Purchased courses (for current user)
  const [ownedCourseIds, setOwnedCourseIds] = useState<Set<number>>(() => new Set());

  // UI selections
  const [departmentId, setDepartmentId] = useState<number | "">(() => {
    const v = searchParams.get("department");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : "";
  });
  const [rootCategoryId, setRootCategoryId] = useState<number | "">(() => {
    const v = searchParams.get("root");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : "";
  });
  const [subCategoryId, setSubCategoryId] = useState<number | "">(() => {
    const v = searchParams.get("sub");
    const n = v ? Number(v) : NaN;
    return Number.isFinite(n) ? n : "";
  });

  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [selectedAttrValueIds, setSelectedAttrValueIds] = useState<number[]>(() => {
    const raw = searchParams.get("attrs");
    if (!raw) return [];
    return raw
      .split(",")
      .map((x) => Number(x))
      .filter((n) => Number.isFinite(n));
  });
  const [sort, setSort] = useState<SortKey>(() => {
    const s = (searchParams.get("sort") || "title_asc") as SortKey;
    return s === "title_asc" || s === "title_desc" || s === "price_asc" || s === "price_desc"
      ? s
      : "title_asc";
  });

  const attrValuesByCode = useMemo(() => {
    const map: Record<string, AttributeValue[]> = {};
    for (const a of attributes) map[a.code] = a.values;
    return map;
  }, [attributes]);

  const deptCategories = useMemo(() => {
    if (!departmentId) return [];
    return categories.filter((c) => c.department_id === departmentId);
  }, [categories, departmentId]);

  const rootCategories = useMemo(() => {
    return deptCategories.filter((c) => c.parent_id == null);
  }, [deptCategories]);

  const subCategories = useMemo(() => {
    if (!rootCategoryId) return [];
    return deptCategories.filter((c) => c.parent_id === rootCategoryId);
  }, [deptCategories, rootCategoryId]);

  const effectiveCategoryId = useMemo(() => {
    if (subCategoryId) return subCategoryId;
    if (rootCategoryId) return rootCategoryId;
    return "";
  }, [rootCategoryId, subCategoryId]);

  const activeDeptName =
    departments.find((d) => d.id === departmentId)?.name || "Каталог";

  const activeRootName =
    rootCategories.find((c) => c.id === rootCategoryId)?.name || "";

  const activeSubName =
    subCategories.find((c) => c.id === subCategoryId)?.name || "";

  // ---------- Data bootstrap ----------
  useEffect(() => {
    (async () => {
      try {
        setError("");
        const [dRes, aRes, cRes] = await Promise.all([
          api.get("/departments"),
          api.get("/attributes"),
          api.get("/categories"),
        ]);
        setDepartments(dRes.data);
        setAttributes(aRes.data);
        setCategories(cRes.data);

        setDepartmentId("");
      } catch (e: any) {
        setError(e?.response?.data?.error || e?.message || "Грешка при зареждане на данни.");
      }
    })();
  }, []);

  // Load purchased courses for the logged-in user
  useEffect(() => {
    (async () => {
      if (!user) {
        setOwnedCourseIds(new Set());
        return;
      }
      try {
        const res = await api.get("/me/courses");
        const ids = new Set<number>((res.data || []).map((r: any) => Number(r.course_id)).filter((n: number) => Number.isFinite(n)));
        setOwnedCourseIds(ids);
      } catch {
        setOwnedCourseIds(new Set());
      }
    })();
  }, [user]);

  // reset categories when department changes
  useEffect(() => {
    setRootCategoryId("");
    setSubCategoryId("");
  }, [departmentId]);

  // if root changes, reset subcategory
  useEffect(() => {
    setSubCategoryId("");
  }, [rootCategoryId]);

  // URL <-> State sync (Catalog filters) 
  useEffect(() => {
    const nextDeptRaw = searchParams.get("department");
    const nextDeptNum = nextDeptRaw ? Number(nextDeptRaw) : NaN;
    const nextDept: number | "" = Number.isFinite(nextDeptNum) ? nextDeptNum : "";

    const nextRootRaw = searchParams.get("root");
    const nextRootNum = nextRootRaw ? Number(nextRootRaw) : NaN;
    const nextRoot: number | "" = Number.isFinite(nextRootNum) ? nextRootNum : "";

    const nextSubRaw = searchParams.get("sub");
    const nextSubNum = nextSubRaw ? Number(nextSubRaw) : NaN;
    const nextSub: number | "" = Number.isFinite(nextSubNum) ? nextSubNum : "";

    const nextQ = searchParams.get("q") || "";

    const nextAttrsRaw = searchParams.get("attrs") || "";
    const nextAttrs = nextAttrsRaw
      ? nextAttrsRaw
          .split(",")
          .map((x) => Number(x))
          .filter((n) => Number.isFinite(n))
      : [];

    const nextSortRaw = (searchParams.get("sort") || "title_asc") as SortKey;
    const nextSort: SortKey =
      nextSortRaw === "title_asc" ||
      nextSortRaw === "title_desc" ||
      nextSortRaw === "price_asc" ||
      nextSortRaw === "price_desc"
        ? nextSortRaw
        : "title_asc";

    if (nextDept !== departmentId) setDepartmentId(nextDept);
    if (nextRoot !== rootCategoryId) setRootCategoryId(nextRoot);
    if (nextSub !== subCategoryId) setSubCategoryId(nextSub);
    if (nextQ !== q) setQ(nextQ);

    const sameAttrs =
      nextAttrs.length === selectedAttrValueIds.length &&
      nextAttrs.every((v, i) => v === selectedAttrValueIds[i]);
    if (!sameAttrs) setSelectedAttrValueIds(nextAttrs);

    if (nextSort !== sort) setSort(nextSort);
  }, [searchParams]);

  useEffect(() => {
    const next = new URLSearchParams();

    const qq = q.trim();
    if (qq) next.set("q", qq);
    if (departmentId) next.set("department", String(departmentId));
    if (rootCategoryId) next.set("root", String(rootCategoryId));
    if (subCategoryId) next.set("sub", String(subCategoryId));
    if (selectedAttrValueIds.length > 0) next.set("attrs", selectedAttrValueIds.join(","));
    if (sort) next.set("sort", sort);

    const current = searchParams.toString();
    const desired = next.toString();
    if (current === desired) return;

    setSearchParams(next, { replace: true });
  }, [q, departmentId, rootCategoryId, subCategoryId, selectedAttrValueIds, sort, searchParams, setSearchParams]);

  // Courses fetch
  useEffect(() => {
    const handle = setTimeout(() => {
      (async () => {
        try {
          setError("");

          const params: Record<string, string | number> = {};
          const qq = q.trim();
          if (qq) params.q = qq;

          if (departmentId) params.departmentId = departmentId;
          if (effectiveCategoryId) params.categoryId = effectiveCategoryId;

          if (selectedAttrValueIds.length > 0) {
            params.attrValueIds = selectedAttrValueIds.join(",");
          }

          params.sort = sort;

          const res = await api.get("/courses", { params });
          setCourses(res.data);
        } catch (e: any) {
          setError(e?.response?.data?.error || e?.message || "Грешка при зареждане на курсове.");
          setCourses([]);
        }
      })();
    }, 250);

    return () => clearTimeout(handle);
  }, [q, departmentId, effectiveCategoryId, selectedAttrValueIds, sort]);

  // Recommendations fetch 
  const fetchRecommendations = async (seedCourseId: number | null) => {
    try {
      setRecError("");
      setRecLoading(true);

      const params: Record<string, number> = { limit: 4 };
      if (seedCourseId) params.course_id = seedCourseId;

      const res = await api.get("/recommendations", { params });
      setRecommended(res.data || []);
      setRecSeedCourseId(seedCourseId);
    } catch (e: any) {
      setRecError(e?.response?.data?.error || e?.message || "Грешка при зареждане на препоръки.");
      setRecommended([]);
    } finally {
      setRecLoading(false);
    }
  };

  const resetRecommendations = async () => {
    setRecSeedCourseId(null);
    setRecSeedCourseTitle(null);
    await fetchRecommendations(null);
  };

  useEffect(() => {
    fetchRecommendations(null);
  }, []);

  useEffect(() => {
    if (recSeedCourseId == null) fetchRecommendations(null);
  }, [departmentId, effectiveCategoryId, sort]);

  const toggleAttrValue = (id: number) => {
    setSelectedAttrValueIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const clearFilters = () => {
    setQ("");
    setSelectedAttrValueIds([]);
    setSort("title_asc");
    setRootCategoryId("");
    setSubCategoryId("");
  };

  const addToCart = async (
    courseId: number,
    title: string,
    price: number,
    creatorUserId?: number
  ) => {
    // Creators cannot buy their own courses
    if (user) {
      const cid = creatorUserId ?? courses.find((x) => x.id === courseId)?.creator_user_id;
      if (cid != null && Number(cid) === Number(user.id)) {
        alert("Не можеш да закупиш курс, който ти си създала.");
        return;
      }
    }

    // If already purchased, do not allow re-purchase
    if (user && ownedCourseIds.has(courseId)) {
      onGoMyCourses?.();
      return;
    }

    // Guest: keep cart locally; Checkout will require login.
    if (!user) {
      addGuest({ course_id: courseId, title, price });
      alert("Добавено в кошницата (без вход). За поръчка е нужен вход.");
      fetchRecommendations(courseId);
      return;
    }

    try {
      await api.post("/cart/items", { course_id: courseId, qty: 1 });
      await refreshServerCount();
      alert("Добавено в кошницата.");
      fetchRecommendations(courseId);
    } catch (e: any) {
      const msg = e?.response?.data?.error || "Грешка при добавяне в кошницата";
      // If the backend reports "already purchased", redirect to My Courses
      if (String(msg).toLowerCase().includes("закупили")) {
        onGoMyCourses?.();
        return;
      }
      alert(msg);
    }
  };

  const seedRecommendationsFromCourse = (courseId: number, courseTitle: string) => {
    setRecSeedCourseId(courseId);
    setRecSeedCourseTitle(courseTitle);
    fetchRecommendations(courseId);
  };

  const PricePill = ({ price }: { price: number }) => (
    <div className="elite-pill">
      {Number(price) > 0 ? `${Number(price).toFixed(2)} €` : "Безплатен"}
    </div>
  );
return (
  <div style={{ display: "grid", gap: 14 }}>
    {/* Horizontal menu: Departments */}
    <div className="elite-card elite-center">
      <div className="elite-top-title">Отдели</div>

      <div className="elite-hmenu">
        <button
          className={`elite-chip ${departmentId === "" ? "active" : ""}`}
          onClick={() => setDepartmentId("")}
          type="button"
        >
          Всички
        </button>

        {departments.map((d) => (
          <button
            key={d.id}
            className={`elite-chip ${departmentId === d.id ? "active" : ""}`}
            onClick={() => setDepartmentId(d.id)}
            type="button"
          >
            {d.name}
          </button>
        ))}
      </div>

      {/* Root categories row */}
      {departmentId && (
        <>
          <div className="elite-top-title" style={{ marginTop: 12 }}>
            Категории в „{activeDeptName}“
          </div>

          <div className="elite-hmenu">
            <button
              className={`elite-chip ${rootCategoryId === "" ? "active" : ""}`}
              onClick={() => setRootCategoryId("")}
              type="button"
            >
              Всички
            </button>

            {rootCategories.map((c) => (
              <button
                key={c.id}
                className={`elite-chip ${rootCategoryId === c.id ? "active" : ""}`}
                onClick={() => setRootCategoryId(c.id)}
                type="button"
                title={c.description || ""}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Subcategories row */}
          {rootCategoryId && subCategories.length > 0 && (
            <>
              <div className="elite-top-title" style={{ marginTop: 12 }}>
                Подкатегории в „{activeRootName}“
              </div>

              <div className="elite-hmenu">
                <button
                  className={`elite-chip ${subCategoryId === "" ? "active" : ""}`}
                  onClick={() => setSubCategoryId("")}
                  type="button"
                >
                  Всички
                </button>

                {subCategories.map((sc) => (
                  <button
                    key={sc.id}
                    className={`elite-chip ${subCategoryId === sc.id ? "active" : ""}`}
                    onClick={() => setSubCategoryId(sc.id)}
                    type="button"
                    title={sc.description || ""}
                  >
                    {sc.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>

    {/* 3-column layout */}
    <div className="elite-layout-3">
      {/* LEFT: Filters */}
      <aside className="elite-card elite-center elite-sticky">
        <h3 style={{ marginTop: 0 }}>Филтри</h3>

        <div className="elite-course-grid">
          <div>
            <label>Търсене</label>
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Търси по заглавие или описание…"
            />
          </div>

          <div>
            <label>Сортиране</label>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              <option value="title_asc">Заглавие: A → Я</option>
              <option value="title_desc">Заглавие: Я → A</option>
              <option value="price_asc">Цена: ниска → висока</option>
              <option value="price_desc">Цена: висока → ниска</option>
            </select>
          </div>

          <button className="elite-btn" onClick={clearFilters} type="button">
            Изчисти филтрите
          </button>

          <div className="elite-muted" style={{ fontSize: 12, textAlign: "center" }}>
            Избрани характеристики: {selectedAttrValueIds.length}
          </div>
        </div>

        <div style={{ marginTop: 14 }}>
          {attributes
            .slice()
            .sort((a, b) => String(a.name).localeCompare(String(b.name), "bg"))
            .map((a) => {
              const values = attrValuesByCode[a.code] || [];
              if (!values || values.length === 0) return null;

              return (
                <div key={a.code} style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8, textAlign: "center" }}>
                    {a.name}
                  </div>

                  <div style={{ display: "grid", gap: 8, justifyItems: "start" }}>
                    {values.map((v) => (
                      <label key={v.id} style={{ display: "flex", gap: 10, alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={selectedAttrValueIds.includes(v.id)}
                          onChange={() => toggleAttrValue(v.id)}
                        />
                        <span>{v.value}</span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
        </div>
      </aside>

      {/* CENTER: Catalog (IMPORTANT: wrap with elite-main + elite-catalog for centering) */}
      <main className="elite-main">
        <div className="elite-catalog">
          <div className="elite-card elite-center" style={{ marginBottom: 16 }}>
            <div className="elite-count-row">
              <strong>Каталог курсове</strong>
              <span className="elite-muted">{courses.length} резултата</span>
            </div>

            <div className="elite-muted" style={{ textAlign: "center" }}>
              {activeSubName
                ? `Показани са курсове в „${activeSubName}“.`
                : activeRootName
                ? `Показани са курсове в „${activeRootName}“ (включително подкатегории).`
                : `Показани са курсове в отдел „${activeDeptName}“.`}
            </div>

            {error && (
              <div style={{ marginTop: 10 }} className="elite-empty">
                {error}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            {courses.map((c) => (
              <div key={c.id} className="elite-course">
                <div className="elite-course-head">
                  <div>
                    <div className="elite-course-title">{c.title}</div>
                    <div className="elite-course-meta">
                      {c.department_name} • {c.category_name}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="elite-pill">
                      {Number(c.price) > 0 ? `${Number(c.price).toFixed(2)} €` : "Безплатен"}
                    </div>

                    <button
                      className="elite-btn"
                      type="button"
                      onClick={() => seedRecommendationsFromCourse(c.id, c.title)}
                    >
                      Подобни
                    </button>

                    {user && Number(c.creator_user_id) === Number(user.id) ? null : (
                      <button
                        className="elite-btn"
                        type="button"
                        onClick={() => {
                          if (!user) return navigate("/profile");
                          navigate(`/chat?courseId=${c.id}`);
                        }}
                        title="Пиши на създателя и задай въпрос преди покупка"
                      >
                        Попитай
                      </button>
                    )}

                    {user && Number(c.creator_user_id) === Number(user.id) ? (
                      <button className="elite-btn" type="button" disabled title="Този курс е създаден от теб">
                        Твой курс
                      </button>
                    ) : user && ownedCourseIds.has(c.id) ? (
                      <button className="elite-btn" type="button" onClick={() => onGoMyCourses?.()} title="Към Моите курсове">
                        Закупен
                      </button>
                    ) : (
                      <button
                        className="elite-btn"
                        type="button"
                        onClick={() => addToCart(c.id, c.title, c.price, c.creator_user_id)}
                      >
                        Добави
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ marginBottom: 0, marginTop: 10 }} className="elite-muted">
                  {c.description}
                </p>
              </div>
            ))}

            {courses.length === 0 && !error && (
              <div className="elite-empty">Няма резултати. Опитай да изчистиш филтрите.</div>
            )}
          </div>
        </div>
      </main>

      {/* RIGHT: Recommendations */}
      <aside className="elite-card elite-center elite-sticky">
        <div className="elite-count-row">
          <strong>
            Препоръки
            {recSeedCourseTitle ? (
              <span className="elite-muted" style={{ marginLeft: 10 }}>
                (подобни на „{recSeedCourseTitle}“)
              </span>
            ) : (
              <span className="elite-muted" style={{ marginLeft: 10 }}>
                ({user ? "за теб" : "последно добавени"})
              </span>
            )}
          </strong>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="elite-btn"
              type="button"
              onClick={resetRecommendations}
            >
              Обнови
            </button>
          </div>
        </div>

        {recError && (
          <div style={{ marginTop: 10 }} className="elite-empty">
            {recError}
          </div>
        )}

        {recLoading && (
          <div style={{ marginTop: 10 }} className="elite-muted">
            Зареждане на препоръки…
          </div>
        )}

        {!recLoading && recommended.length === 0 && !recError && (
          <div style={{ marginTop: 10 }} className="elite-empty">
            Няма препоръки в момента.
          </div>
        )}

        {!recLoading && recommended.length > 0 && (
          <div className="elite-rec-grid">
            {recommended.map((rc) => (
              <div key={rc.id} className="elite-course elite-course-compact">
                <div className="elite-course-head">
                  <div>
                    <div className="elite-course-title">{rc.title}</div>
                    <div className="elite-course-meta">
                      {rc.department_name && rc.category_name
                        ? `${rc.department_name} • ${rc.category_name}`
                        : "Препоръчан курс"}
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div className="elite-pill">
                      {Number(rc.price) > 0 ? `${Number(rc.price).toFixed(2)} €` : "Безплатен"}
                    </div>
                    {user && Number(rc.creator_user_id) === Number(user.id) ? (
                      <button className="elite-btn sm" type="button" disabled title="Този курс е създаден от теб">
                        Твой курс
                      </button>
                    ) : user && ownedCourseIds.has(rc.id) ? (
                      <button className="elite-btn sm" type="button" onClick={() => onGoMyCourses?.()} title="Към Моите курсове">
                        Закупен
                      </button>
                    ) : (
                      <button
                        className="elite-btn sm"
                        type="button"
                        onClick={() => addToCart(rc.id, rc.title, rc.price, rc.creator_user_id)}
                      >
                        Добави
                      </button>
                    )}
                  </div>
                </div>

                <p style={{ marginBottom: 0, marginTop: 10 }} className="elite-muted">
                  {rc.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </aside>
    </div>
  </div>
);
}
