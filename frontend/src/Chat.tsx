import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api } from "./api";
import { useAuth } from "./auth";
import styles from "./Chat.module.css";

type InboxConversation = {
  id: number;
  course_id: number;
  buyer_id: number;
  creator_id: number;
  updated_at: string;
  course_title: string;
  other_user_id: number;
  other_user_email: string;
  other_user_role: string;
  last_message_body: string | null;
  last_message_at: string | null;
  unread_count: number;
};

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  read_at: string | null;
};

export default function Chat() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const courseIdParam = searchParams.get("courseId");
  const convIdParam = searchParams.get("conv");

  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingInbox, setLoadingInbox] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollerRef = useRef<HTMLDivElement | null>(null);

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeConvId) || null,
    [conversations, activeConvId]
  );

  const loadInbox = async () => {
    setLoadingInbox(true);
    setError(null);
    try {
      const res = await api.get("/chat/inbox");
      setConversations(res.data.conversations || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Неуспешно зареждане на чатовете.");
    } finally {
      setLoadingInbox(false);
    }
  };

  const loadMessages = async (convId: number) => {
    setLoadingMessages(true);
    setError(null);
    try {
      const res = await api.get(`/chat/conversations/${convId}/messages`);
      setMessages(res.data.messages || []);
      await loadInbox();
    } catch (e: any) {
      setError(e?.response?.data?.error || "Неуспешно зареждане на съобщенията.");
    } finally {
      setLoadingMessages(false);
    }
  };

  // Initial: require login
  useEffect(() => {
    if (!user) return;
    loadInbox();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    if (!courseIdParam) return;

    (async () => {
      try {
        const res = await api.post("/chat/conversations", { courseId: Number(courseIdParam) });
        const convId = Number(res.data?.conversation?.id);
        if (Number.isFinite(convId)) {
          setActiveConvId(convId);
          setSearchParams((prev) => {
            prev.delete("courseId");
            prev.set("conv", String(convId));
            return prev;
          });
          await loadInbox();
          await loadMessages(convId);
        }
      } catch (e: any) {
        setError(e?.response?.data?.error || "Неуспешно стартиране на разговор.");
      }
    })();
  }, [user?.id, courseIdParam]);

  useEffect(() => {
    if (!user) return;
    if (!convIdParam) return;
    const convId = Number(convIdParam);
    if (!Number.isFinite(convId)) return;
    setActiveConvId(convId);
    loadMessages(convId);
  }, [user?.id, convIdParam]);

  // Auto scroll
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages.length, activeConvId]);

  const onSelectConversation = async (convId: number) => {
    setActiveConvId(convId);
    setSearchParams((prev) => {
      prev.set("conv", String(convId));
      prev.delete("courseId");
      return prev;
    });
    await loadMessages(convId);
  };

  const onSend = async () => {
    if (!activeConvId) return;
    const body = draft.trim();
    if (!body) return;

    try {
      await api.post(`/chat/conversations/${activeConvId}/messages`, { body });
      setDraft("");
      await loadMessages(activeConvId);
    } catch (e: any) {
      setError(e?.response?.data?.error || "Неуспешно изпращане.");
    }
  };

  if (!user) {
    return (
      <div className="elite-wrap">
        <div className="elite-card" style={{ padding: 16 }}>
          <h2 style={{ marginTop: 0 }}>Чат</h2>
          <p className="elite-muted">
            За да пишеш на създателите на курсове, трябва да си влязла в профила си.
          </p>
          <button className="elite-btn" onClick={() => navigate("/profile")}>
            Към профил (вход/регистрация)
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="elite-wrap">
      <div className="elite-card">
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
          <div>
            <h2 style={{ margin: 0 }}>Чат</h2>
            <div className="elite-muted">Пиши на създателите и задай въпрос за курс преди покупка.</div>
          </div>
          <button className="elite-btn sm" onClick={loadInbox} disabled={loadingInbox}>
            Обнови
          </button>
        </div>

        <div className={styles.wrap}>
      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <div className={styles.hTitle}>Разговори</div>
            <div className={styles.hSub}>Входящи и изходящи разговори</div>
          </div>
        </div>

        <div className={styles.list}>
          {loadingInbox ? <div className={styles.loading}>Зареждане…</div> : null}
          {!loadingInbox && conversations.length === 0 ? (
            <div className={styles.empty}>Нямаш започнати разговори.</div>
          ) : null}

          {conversations.map((c) => {
            const active = c.id === activeConvId;
            return (
              <button
                key={c.id}
                className={`${styles.item} ${active ? styles.itemActive : ""}`}
                onClick={() => onSelectConversation(c.id)}
              >
                <div className={styles.itemTop}>
                  <div className={styles.itemCourse}>{c.course_title}</div>
                  {c.unread_count > 0 ? (
                    <span className={styles.badge}>{c.unread_count}</span>
                  ) : null}
                </div>
                <div className={styles.itemMeta}>
                  <span className={styles.itemUser}>{c.other_user_email}</span>
                  <span className={styles.dot}>•</span>
                  <span className={styles.itemRole}>
                  {c.other_user_role === "creator"
                    ? "създател"
                    : c.other_user_role === "buyer"
                    ? "копувач"
                    : c.other_user_role}
                </span>
                </div>
                <div className={styles.itemPreview}>{c.last_message_body || "—"}</div>
              </button>
            );
          })}
        </div>
      </div>

      <div className={styles.panel}>
        <div className={styles.header}>
          <div>
            <div className={styles.hTitle}>{activeConversation ? activeConversation.course_title : "Избери разговор"}</div>
            <div className={styles.hSub}>
              {activeConversation ? `С ${activeConversation.other_user_email}` : "—"}
            </div>
          </div>
        </div>

        {error ? <div className={styles.error}>{error}</div> : null}

        <div className={styles.messages} ref={scrollerRef}>
          {!activeConvId ? (
            <div className={styles.emptyBig}>Избери разговор отляво.</div>
          ) : loadingMessages ? (
            <div className={styles.loading}>Зареждане…</div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === user.id;
              return (
                <div key={m.id} className={`${styles.msgRow} ${mine ? styles.mine : styles.theirs}`}>
                  <div className={styles.msgBubble}>
                    <div className={styles.msgBody}>{m.body}</div>
                    <div className={styles.msgTime}>
                      {new Date(m.created_at).toLocaleString("bg-BG")}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className={styles.composer}>
          <textarea
            className={styles.textarea}
            rows={2}
            placeholder={activeConvId ? "Напиши съобщение…" : "Избери разговор първо…"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={!activeConvId}
          />
          <button className="elite-btn" onClick={onSend} disabled={!activeConvId || !draft.trim()}>
            Изпрати
          </button>
        </div>
      </div>
        </div>
      </div>
    </div>
  );
}
