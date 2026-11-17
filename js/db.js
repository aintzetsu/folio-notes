(function (global) {
  "use strict";

  const DB_NAME = "folio_notes_db_v1";
  const STORE_NAME = "notes";
  const LS_FALLBACK = "folio_notes_ls_v1";

  const SEED_NOTES = [
    {
      id: "n_welcome",
      title: "Welcome & Knowledge Map",
      updatedAt: Date.now() - 3600000 * 5,
      content: `# Welcome to Folio Notes\n\nFolio Notes is a calm, local-first Markdown notebook stored inside IndexedDB.\n\n> Connect thoughts naturally with \`[[Wiki Links]]\` and #tags, then explore connections visually inside the interactive Graph tab.\n\n## Core Ideas in This Vault\n- Explore system blueprints in [[Product Architecture]]\n- Inspect browser persistence patterns in [[Local-First Storage]]\n- Review accessible palette rules in [[Color Systems]]\n- Read oscillator notes in [[Web Audio Notes]]\n\n## Quick Checklist\n- [x] Pre-seed interconnected knowledge vault\n- [ ] Toggle a task checkbox right inside the live preview\n- [ ] Switch to Graph view and drag nodes around\n\n#index #workflow`
    },
    {
      id: "n_arch",
      title: "Product Architecture",
      updatedAt: Date.now() - 3600000 * 4,
      content: `# Product Architecture\n\nStatic single-origin applications can deliver desktop-grade responsiveness without complex build pipelines.\n\n## Guiding Constraints\n1. Zero third-party runtime dependencies\n2. Deterministic state updates rendered via explicit DOM helpers\n3. Safe persistence backed by [[Local-First Storage]]\n\nSee how routing costs interact with grid heuristics in [[Algorithmic Grids]].\n\n\`\`\`js\n// Pure state -> view render pipeline\nfunction syncNote(note) {\n  saveRecord(note);\n  renderPreview(note.content);\n}\n\`\`\`\n\n#architecture #engineering`
    },
    {
      id: "n_storage",
      title: "Local-First Storage",
      updatedAt: Date.now() - 3600000 * 3,
      content: `# Local-First Storage\n\nIndexedDB holds structured records directly inside the user's browser sandbox.\n\n- Sub-millisecond local reads after initialization\n- Offline resilient across page reloads\n- Automatic JSON vault backup & single \`.md\` export\n\nBack to [[Product Architecture]] or explore [[Welcome & Knowledge Map]].\n\n#storage #indexeddb`
    },
    {
      id: "n_color",
      title: "Color Systems",
      updatedAt: Date.now() - 3600000 * 2,
      content: `# Color Systems\n\nAccessible typography relies on WCAG 2.1 relative luminance contrast ratios:\n\n- **4.5:1** minimum for normal body text (AA)\n- **7.0:1** target for enhanced readability (AAA)\n- Subtle warm neutrals reduce glare during extended writing sessions\n\nAlso related: [[Algorithmic Grids]] and [[Welcome & Knowledge Map]].\n\n#design #accessibility`
    },
    {
      id: "n_audio",
      title: "Web Audio Notes",
      updatedAt: Date.now() - 3600000,
      content: `# Web Audio Notes\n\nSample-accurate scheduling in browsers pairs \`setInterval\` lookahead ticks with hardware \`AudioContext.currentTime\`.\n\n- Use exponential gain ramps (\`exponentialRampToValueAtTime\`) to prevent speaker clicks.\n- Connect an \`AnalyserNode\` cleanly before destination output.\n\nReturn to [[Welcome & Knowledge Map]].\n\n#audio #synth`
    },
    {
      id: "n_algo",
      title: "Algorithmic Grids",
      updatedAt: Date.now() - 1800000,
      content: `# Algorithmic Grids\n\nA* search expands states ordered by \`f(n) = g(n) + h(n)\`:\n\n> When \`h(n)\` never overestimates the true remaining distance, A* guarantees the shortest weighted path.\n\nConnected notes: [[Product Architecture]] & [[Color Systems]].\n\n#algorithms #engineering`
    }
  ];

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      const req = global.indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: "id" });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async function loadAll() {
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const rows = req.result || [];
          resolve(rows.sort((a, b) => b.updatedAt - a.updatedAt));
        };
        req.onerror = () => reject(req.error);
      });
    } catch (_e) {
      try {
        const raw = localStorage.getItem(LS_FALLBACK);
        if (raw) return JSON.parse(raw);
      } catch (_ignored) {
        // ignore
      }
      return [];
    }
  }

  async function saveAll(notes) {
    try {
      localStorage.setItem(LS_FALLBACK, JSON.stringify(notes));
    } catch (_e) {
      // ignore
    }
    try {
      const db = await openDb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        notes.forEach((n) => store.put(n));
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } catch (_e) {
      return false;
    }
  }

  async function ensureSeeded() {
    const existing = await loadAll();
    if (existing.length > 0) return existing;
    const seeded = SEED_NOTES.map((n) => ({ ...n }));
    await saveAll(seeded);
    return seeded;
  }

  async function resetToDemo() {
    const seeded = SEED_NOTES.map((n) => ({ ...n }));
    await saveAll(seeded);
    return seeded;
  }

  global.FolioDB = {
    ensureSeeded,
    saveAll,
    resetToDemo
  };
})(window);
