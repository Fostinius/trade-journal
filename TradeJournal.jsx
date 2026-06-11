import { useState, useEffect, useRef } from "react";

// ─── Firebase ────────────────────────────────────────────────────────────────
let db, fbFn;

async function initFirebase() {
  if (db) return;
  const { initializeApp, getApps } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js");
  const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy } =
    await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");

  const config = {
    apiKey: "AIzaSyBTCiLlyhz79vDB4AaROQgDwxNrjI7fmLM",
    authDomain: "investment-journal-ac26f.firebaseapp.com",
    projectId: "investment-journal-ac26f",
    storageBucket: "investment-journal-ac26f.firebasestorage.app",
    messagingSenderId: "688873767307",
    appId: "1:688873767307:web:bb95b34f7210056b27af8e"
  };

  const app = getApps().length ? getApps()[0] : initializeApp(config);
  db = getFirestore(app);
  fbFn = { collection, addDoc, getDocs, deleteDoc, doc, updateDoc, query, orderBy };
}

// ─── Constants ───────────────────────────────────────────────────────────────
const BIASES = ["Bullish", "Bearish", "Neutral"];
const SETUPS = ["Breakout", "Breakdown", "H&S", "Reverse H&S", "Support Test",
  "Resistance Test", "Bollinger Squeeze", "MA Cross", "DMI/ADX", "VIX Signal", "Other"];
const TIMEFRAMES = ["1D", "4H", "1H", "Weekly", "Monthly"];

function formatDate(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// ─── Styles ───────────────────────────────────────────────────────────────────
function inputStyle(width) {
  return {
    background: "#1e293b", border: "1px solid #334155", color: "#f8fafc",
    borderRadius: 6, padding: "7px 10px", fontSize: 13,
    width: typeof width === "number" ? width : width,
    outline: "none", boxSizing: "border-box",
  };
}

function btnStyle(bg, color, extra = {}) {
  return {
    background: bg, color, border: `1px solid ${color}33`,
    borderRadius: 6, padding: "5px 14px", fontSize: 12,
    cursor: "pointer", fontWeight: 600, ...extra,
  };
}

// ─── Badge / Tag ──────────────────────────────────────────────────────────────
function Badge({ label }) {
  const colors = { Bullish: "#22c55e", Bearish: "#ef4444", Neutral: "#94a3b8" };
  return (
    <span style={{
      background: colors[label] ?? "#334155", color: "#fff",
      fontSize: 11, fontWeight: 700, padding: "2px 8px",
      borderRadius: 4, letterSpacing: 0.5,
    }}>{label}</span>
  );
}

function SetupTag({ label }) {
  return (
    <span style={{
      background: "#1e293b", color: "#7dd3fc", fontSize: 11,
      padding: "2px 8px", borderRadius: 4, border: "1px solid #334155",
    }}>{label}</span>
  );
}

// ─── Entry Card ───────────────────────────────────────────────────────────────
function EntryCard({ entry, onDelete, onEdit }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{
      background: "#0f172a", border: "1px solid #1e293b",
      borderRadius: 10, marginBottom: 10, overflow: "hidden",
    }}>
      <div
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 16px", cursor: "pointer", flexWrap: "wrap" }}
        onClick={() => setExpanded(v => !v)}
      >
        <span style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 15, color: "#f8fafc", minWidth: 64 }}>
          {entry.ticker}
        </span>
        <span style={{ fontSize: 12, color: "#64748b" }}>{formatDate(entry.date)}</span>
        <Badge label={entry.bias} />
        {entry.timeframe && <span style={{ fontSize: 11, color: "#64748b" }}>{entry.timeframe}</span>}
        {entry.price && (
          <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: "auto" }}>
            ${parseFloat(entry.price).toFixed(2)}
          </span>
        )}
        <span style={{ color: "#475569", fontSize: 11, marginLeft: entry.price ? 6 : "auto" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {expanded && (
        <div style={{ padding: "0 16px 16px", borderTop: "1px solid #1e293b" }}>
          {entry.setups?.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 12 }}>
              {entry.setups.map(s => <SetupTag key={s} label={s} />)}
            </div>
          )}
          {entry.note && (
            <p style={{ color: "#cbd5e1", fontSize: 13, lineHeight: 1.65, marginTop: 12 }}>
              {entry.note}
            </p>
          )}
          {entry.imageData && (
            <img src={entry.imageData} alt="Chart"
              style={{ width: "100%", borderRadius: 8, marginTop: 12, border: "1px solid #1e293b" }} />
          )}
          {entry.target && (
            <div style={{ marginTop: 10, fontSize: 12, color: "#94a3b8" }}>
              🎯 Target: <strong style={{ color: "#f8fafc" }}>${entry.target}</strong>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
            <button onClick={() => onEdit(entry)} style={btnStyle("#1e293b", "#7dd3fc")}>Edit</button>
            <button onClick={() => onDelete(entry)} style={btnStyle("#1e293b", "#f87171")}>Verwijder</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Field wrapper ────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, color: "#64748b", fontWeight: 600, letterSpacing: 0.5, textTransform: "uppercase" }}>
        {label}
      </label>
      {children}
    </div>
  );
}

// ─── Entry Form ───────────────────────────────────────────────────────────────
function EntryForm({ initial, onSave, onCancel, saving }) {
  const blank = {
    ticker: "", date: new Date().toISOString().slice(0, 10),
    price: "", target: "", bias: "Bullish", timeframe: "1D",
    setups: [], note: "", imageData: "",
  };
  const [form, setForm] = useState(initial ? { ...initial } : blank);
  const fileRef = useRef();
  const [preview, setPreview] = useState(initial?.imageData ?? "");

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const toggleSetup = s => set("setups",
    form.setups.includes(s) ? form.setups.filter(x => x !== s) : [...form.setups, s]);

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    // Resize image to max 1200px wide to stay under Firestore 1MB limit
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const maxW = 1200;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.75);
      set("imageData", data);
      setPreview(data);
    };
    img.src = URL.createObjectURL(file);
  }

  return (
    <div style={{
      background: "#0f172a", border: "1px solid #334155",
      borderRadius: 12, padding: 24, marginBottom: 24,
    }}>
      <h3 style={{ color: "#f8fafc", marginBottom: 20, fontSize: 15, fontWeight: 700, margin: "0 0 20px" }}>
        {initial ? "Entry bewerken" : "Nieuwe analyse"}
      </h3>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        <Field label="Ticker">
          <input value={form.ticker} onChange={e => set("ticker", e.target.value.toUpperCase())}
            placeholder="XHB" style={inputStyle(90)} />
        </Field>
        <Field label="Datum">
          <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
            style={inputStyle(140)} />
        </Field>
        <Field label="Prijs">
          <input type="number" value={form.price} onChange={e => set("price", e.target.value)}
            placeholder="115.00" style={inputStyle(100)} />
        </Field>
        <Field label="Target">
          <input type="number" value={form.target} onChange={e => set("target", e.target.value)}
            placeholder="203.00" style={inputStyle(100)} />
        </Field>
        <Field label="Timeframe">
          <select value={form.timeframe} onChange={e => set("timeframe", e.target.value)} style={inputStyle(90)}>
            {TIMEFRAMES.map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Field label="Bias">
          <div style={{ display: "flex", gap: 6, marginTop: 2 }}>
            {BIASES.map(b => {
              const accent = b === "Bullish" ? "#22c55e" : b === "Bearish" ? "#ef4444" : "#94a3b8";
              return (
                <button key={b} onClick={() => set("bias", b)} style={{
                  background: form.bias === b ? accent + "22" : "#0f172a",
                  color: accent, border: `1px solid ${form.bias === b ? accent : "#334155"}`,
                  borderRadius: 6, padding: "5px 16px", fontSize: 12,
                  cursor: "pointer", fontWeight: 700,
                }}>{b}</button>
              );
            })}
          </div>
        </Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Field label="Setup tags">
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {SETUPS.map(s => (
              <button key={s} onClick={() => toggleSetup(s)} style={{
                background: form.setups.includes(s) ? "#1e3a5f" : "#1e293b",
                color: form.setups.includes(s) ? "#7dd3fc" : "#64748b",
                border: `1px solid ${form.setups.includes(s) ? "#7dd3fc44" : "#334155"}`,
                borderRadius: 6, padding: "3px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600,
              }}>{s}</button>
            ))}
          </div>
        </Field>
      </div>

      <div style={{ marginBottom: 14 }}>
        <Field label="Notitie">
          <textarea value={form.note} onChange={e => set("note", e.target.value)}
            rows={3} placeholder="Breaking out above resistance, volume confirming..."
            style={{ ...inputStyle("100%"), resize: "vertical", fontFamily: "inherit", lineHeight: 1.6 }} />
        </Field>
      </div>

      <div style={{ marginBottom: 20 }}>
        <Field label="Chart screenshot">
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
            <button onClick={() => fileRef.current.click()} style={btnStyle("#1e293b", "#7dd3fc")}>
              📎 Kies bestand
            </button>
            {preview && (
              <button onClick={() => { set("imageData", ""); setPreview(""); }}
                style={btnStyle("#1e293b", "#f87171")}>✕ Verwijder</button>
            )}
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleFile} />
          </div>
          {preview && (
            <img src={preview} alt="Preview"
              style={{ maxHeight: 200, marginTop: 10, borderRadius: 8, border: "1px solid #1e293b", display: "block" }} />
          )}
        </Field>
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => onSave(form)} disabled={saving || !form.ticker} style={{
          background: "#1d4ed8", color: "#fff", border: "none",
          borderRadius: 8, padding: "8px 22px", fontSize: 13,
          fontWeight: 600, cursor: form.ticker ? "pointer" : "not-allowed",
          opacity: saving || !form.ticker ? 0.5 : 1,
        }}>
          {saving ? "Opslaan..." : "Opslaan"}
        </button>
        <button onClick={onCancel} style={btnStyle("#1e293b", "#94a3b8", { padding: "8px 18px" })}>
          Annuleer
        </button>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function TradeJournal() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editEntry, setEditEntry] = useState(null);
  const [search, setSearch] = useState("");
  const [filterBias, setFilterBias] = useState("All");
  const [filterSetup, setFilterSetup] = useState("All");
  const [groupByTicker, setGroupByTicker] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    initFirebase()
      .then(loadEntries)
      .catch(e => { setError("Firebase fout: " + e.message); setLoading(false); });
  }, []);

  async function loadEntries() {
    try {
      const { collection, getDocs, query, orderBy } = fbFn;
      const q = query(collection(db, "trade_journal"), orderBy("date", "desc"));
      const snap = await getDocs(q);
      setEntries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      setError("Laden mislukt: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(form) {
    setSaving(true);
    setError("");
    try {
      const { collection, addDoc, doc, updateDoc } = fbFn;
      const payload = {
        ticker: form.ticker.trim().toUpperCase(),
        date: form.date,
        price: form.price || "",
        target: form.target || "",
        bias: form.bias,
        timeframe: form.timeframe,
        setups: form.setups,
        note: form.note,
        imageData: form.imageData || "",
        updatedAt: new Date().toISOString(),
      };

      if (editEntry) {
        await updateDoc(doc(db, "trade_journal", editEntry.id), payload);
        setEntries(es => es.map(e => e.id === editEntry.id ? { id: e.id, ...payload } : e));
      } else {
        payload.createdAt = new Date().toISOString();
        const docRef = await addDoc(collection(db, "trade_journal"), payload);
        setEntries(es => [{ id: docRef.id, ...payload }, ...es]);
      }

      setShowForm(false);
      setEditEntry(null);
    } catch (e) {
      setError("Opslaan mislukt: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(entry) {
    if (!confirm(`Verwijder analyse voor ${entry.ticker} (${formatDate(entry.date)})?`)) return;
    try {
      const { deleteDoc, doc } = fbFn;
      await deleteDoc(doc(db, "trade_journal", entry.id));
      setEntries(es => es.filter(e => e.id !== entry.id));
    } catch (e) {
      setError("Verwijderen mislukt: " + e.message);
    }
  }

  function handleEdit(entry) {
    setEditEntry(entry);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const filtered = entries
    .filter(e => {
      const s = search.trim().toLowerCase();
      const matchSearch = !s || e.ticker.toLowerCase().includes(s) ||
        (e.note ?? "").toLowerCase().includes(s);
      const matchBias = filterBias === "All" || e.bias === filterBias;
      const matchSetup = filterSetup === "All" || (e.setups ?? []).includes(filterSetup);
      return matchSearch && matchBias && matchSetup;
    })
    .sort((a, b) => b.date.localeCompare(a.date));

  const tickers = [...new Set(filtered.map(e => e.ticker))].sort();

  return (
    <div style={{ background: "#020617", minHeight: "100vh", fontFamily: "'Inter', system-ui, sans-serif", color: "#f8fafc" }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #1e293b", padding: "14px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, background: "#020617", zIndex: 100,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontFamily: "monospace", fontSize: 17, fontWeight: 800, color: "#7dd3fc", letterSpacing: 1 }}>
            📈 Trade Journal
          </span>
          <span style={{ fontSize: 12, color: "#334155", background: "#1e293b", padding: "2px 8px", borderRadius: 10 }}>
            {entries.length} analyses
          </span>
        </div>
        <button
          onClick={() => { setEditEntry(null); setShowForm(v => !v); }}
          style={{
            background: showForm && !editEntry ? "#1e293b" : "#1d4ed8",
            color: "#fff", border: "none", borderRadius: 8,
            padding: "7px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer",
          }}>
          {showForm && !editEntry ? "✕ Annuleer" : "+ Nieuwe analyse"}
        </button>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 18px" }}>

        {error && (
          <div style={{ background: "#450a0a", border: "1px solid #f87171", borderRadius: 8, padding: "10px 16px", marginBottom: 16, color: "#f87171", fontSize: 13 }}>
            ⚠️ {error}
          </div>
        )}

        {showForm && (
          <EntryForm
            initial={editEntry}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditEntry(null); }}
            saving={saving}
          />
        )}

        {/* Filters */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 20, alignItems: "center" }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Zoek ticker of notitie..."
            style={{ ...inputStyle(220), flex: "1 1 180px" }}
          />
          <select value={filterBias} onChange={e => setFilterBias(e.target.value)} style={inputStyle(130)}>
            <option value="All">Alle biases</option>
            {BIASES.map(b => <option key={b}>{b}</option>)}
          </select>
          <select value={filterSetup} onChange={e => setFilterSetup(e.target.value)} style={inputStyle(160)}>
            <option value="All">Alle setups</option>
            {SETUPS.map(s => <option key={s}>{s}</option>)}
          </select>
          <button
            onClick={() => setGroupByTicker(v => !v)}
            style={btnStyle(groupByTicker ? "#1e3a5f" : "#1e293b", groupByTicker ? "#7dd3fc" : "#64748b")}
          >
            {groupByTicker ? "Groep: Ticker" : "Groep: Datum"}
          </button>
        </div>

        {/* Entries */}
        {loading ? (
          <div style={{ color: "#475569", textAlign: "center", padding: 60 }}>Verbinden met Firebase...</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: "#475569", textAlign: "center", padding: 60, lineHeight: 2 }}>
            {entries.length === 0
              ? <>Nog geen analyses.<br />Klik op <strong style={{ color: "#7dd3fc" }}>+ Nieuwe analyse</strong> om te beginnen.</>
              : "Geen resultaten voor deze filter."}
          </div>
        ) : groupByTicker ? (
          tickers.map(ticker => {
            const group = filtered.filter(e => e.ticker === ticker);
            return (
              <div key={ticker} style={{ marginBottom: 28 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ fontFamily: "monospace", fontSize: 13, fontWeight: 700, color: "#7dd3fc", letterSpacing: 1 }}>
                    {ticker}
                  </span>
                  <div style={{ flex: 1, height: 1, background: "#1e293b" }} />
                  <span style={{ fontSize: 11, color: "#334155" }}>{group.length} {group.length === 1 ? "entry" : "entries"}</span>
                </div>
                {group.map(e => <EntryCard key={e.id} entry={e} onDelete={handleDelete} onEdit={handleEdit} />)}
              </div>
            );
          })
        ) : (
          filtered.map(e => <EntryCard key={e.id} entry={e} onDelete={handleDelete} onEdit={handleEdit} />)
        )}
      </div>
    </div>
  );
}
