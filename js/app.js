(function () {
  "use strict";

  const sidebar = document.getElementById("sidebar");
  const toggleSidebarBtn = document.getElementById("toggleSidebarBtn");
  const newNoteBtn = document.getElementById("newNoteBtn");
  const searchInput = document.getElementById("searchInput");
  const tagStrip = document.getElementById("tagStrip");
  const notesList = document.getElementById("notesList");
  const exportVaultBtn = document.getElementById("exportVaultBtn");
  const resetDemoBtn = document.getElementById("resetDemoBtn");

  const noteHeader = document.getElementById("noteHeader");
  const noteTitleInput = document.getElementById("noteTitleInput");
  const wordStats = document.getElementById("wordStats");
  const panesStage = document.getElementById("panesStage");
  const editorPane = document.getElementById("editorPane");
  const previewPane = document.getElementById("previewPane");
  const graphPane = document.getElementById("graphPane");
  const graphCanvas = document.getElementById("graphCanvas");
  const mdTextarea = document.getElementById("mdTextarea");
  const backlinksList = document.getElementById("backlinksList");
  const connectionsBar = document.getElementById("connectionsBar");
  const exportMdBtn = document.getElementById("exportMdBtn");
  const deleteNoteBtn = document.getElementById("deleteNoteBtn");
  const reheatGraphBtn = document.getElementById("reheatGraphBtn");
  const toastEl = document.getElementById("toast");

  const state = {
    notes: [],
    activeId: null,
    viewMode: "split",
    searchQuery: "",
    activeTag: null,
    saveTimer: null
  };

  let graphCtrl = null;
  let toastTimer = null;

  function showToast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, 2200);
  }

  function getActiveNote() {
    return state.notes.find((n) => n.id === state.activeId) || state.notes[0] || null;
  }

  function collectAllTags() {
    const counts = new Map();
    state.notes.forEach((n) => {
      window.FolioMarkdown.extractTags(n.content).forEach((tag) => {
        counts.set(tag, (counts.get(tag) || 0) + 1);
      });
    });
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }

  function renderTags() {
    const tags = collectAllTags();
    tagStrip.innerHTML = "";
    if (state.activeTag) {
      const clearChip = document.createElement("button");
      clearChip.type = "button";
      clearChip.className = "tag-chip is-active";
      clearChip.textContent = `${state.activeTag} ×`;
      clearChip.addEventListener("click", () => {
        state.activeTag = null;
        renderSidebar();
      });
      tagStrip.appendChild(clearChip);
    }
    tags.slice(0, 7).forEach(([tag, count]) => {
      if (tag === state.activeTag) return;
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "tag-chip";
      chip.textContent = `${tag} (${count})`;
      chip.addEventListener("click", () => {
        state.activeTag = tag;
        renderSidebar();
      });
      tagStrip.appendChild(chip);
    });
  }

  function renderSidebar() {
    renderTags();
    const q = state.searchQuery.trim().toLowerCase();
    const filtered = state.notes.filter((n) => {
      const matchesQ = !q || n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
      const matchesTag = !state.activeTag || window.FolioMarkdown.extractTags(n.content).includes(state.activeTag);
      return matchesQ && matchesTag;
    });

    notesList.innerHTML = "";
    if (filtered.length === 0) {
      const empty = document.createElement("div");
      empty.style.padding = "14px";
      empty.style.fontSize = "12.5px";
      empty.style.color = "var(--text-faint)";
      empty.textContent = "No matching notes found.";
      notesList.appendChild(empty);
      return;
    }

    filtered.forEach((note) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "note-item" + (note.id === state.activeId ? " is-active" : "");

      const title = document.createElement("div");
      title.className = "note-item-title";
      title.textContent = note.title || "Untitled Note";

      const linksCount = window.FolioMarkdown.extractWikiLinks(note.content).length;
      const words = note.content.trim() ? note.content.trim().split(/\s+/).length : 0;

      const meta = document.createElement("div");
      meta.className = "note-item-meta";
      meta.innerHTML = `<span>${words} words</span><span>${linksCount} links</span>`;

      btn.appendChild(title);
      btn.appendChild(meta);
      btn.addEventListener("click", () => {
        openNoteById(note.id);
        if (window.innerWidth <= 880) {
          sidebar.classList.add("is-collapsed-mobile");
        }
      });
      notesList.appendChild(btn);
    });
  }

  function renderPreviewAndLinks() {
    const active = getActiveNote();
    if (!active) return;

    const allTitles = state.notes.map((n) => n.title);
    previewPane.innerHTML = window.FolioMarkdown.renderMarkdown(active.content, allTitles);

    const words = active.content.trim() ? active.content.trim().split(/\s+/).length : 0;
    const mins = Math.max(1, Math.round(words / 200));
    wordStats.textContent = `${words} words · ~${mins} min read · IndexedDB saved`;

    // Backlinks: any note whose [[Wiki Links]] reference active.title
    const targetLower = active.title.trim().toLowerCase();
    const backlinks = state.notes.filter((n) => {
      if (n.id === active.id) return false;
      const links = window.FolioMarkdown.extractWikiLinks(n.content);
      return links.some((l) => l.toLowerCase() === targetLower);
    });

    backlinksList.innerHTML = "";
    if (backlinks.length === 0) {
      const span = document.createElement("span");
      span.style.color = "var(--text-faint)";
      span.textContent = "No notes link here yet.";
      backlinksList.appendChild(span);
    } else {
      backlinks.forEach((src) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "wiki-link";
        chip.textContent = src.title;
        chip.addEventListener("click", () => openNoteById(src.id));
        backlinksList.appendChild(chip);
      });
    }
  }

  function openNoteById(id) {
    state.activeId = id;
    const active = getActiveNote();
    if (active) {
      noteTitleInput.value = active.title;
      mdTextarea.value = active.content;
    }
    if (state.viewMode === "graph") {
      setViewMode("split");
    }
    renderSidebar();
    renderPreviewAndLinks();
    if (graphCtrl) graphCtrl.setData(state.notes, state.activeId);
  }

  function openOrCreateByTitle(title) {
    const clean = title.trim();
    if (!clean) return;
    const existing = state.notes.find((n) => n.title.trim().toLowerCase() === clean.toLowerCase());
    if (existing) {
      openNoteById(existing.id);
      return;
    }
    const created = {
      id: `n_${Date.now()}`,
      title: clean,
      updatedAt: Date.now(),
      content: `# ${clean}\n\nLinked note created from workspace.\n\n#draft`
    };
    state.notes.unshift(created);
    persistNow();
    openNoteById(created.id);
    showToast(`Created note "${clean}"`);
  }

  function persistNow() {
    window.FolioDB.saveAll(state.notes);
  }

  function schedulePersist() {
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(() => {
      persistNow();
    }, 220);
  }

  function setViewMode(mode) {
    state.viewMode = mode;
    document.querySelectorAll(".tab-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.mode === mode);
    });
    panesStage.className = `panes-stage mode-${mode}`;

    const isGraph = mode === "graph";
    noteHeader.hidden = isGraph;
    connectionsBar.hidden = isGraph;
    editorPane.hidden = mode === "preview" || isGraph;
    previewPane.hidden = mode === "editor" || isGraph;
    graphPane.hidden = !isGraph;

    if (isGraph && graphCtrl) {
      graphCtrl.setData(state.notes, state.activeId);
      graphCtrl.startLoop();
    }
  }

  function insertFormatting(prefix, wrapToken) {
    const active = getActiveNote();
    if (!active) return;
    const start = mdTextarea.selectionStart;
    const end = mdTextarea.selectionEnd;
    const text = mdTextarea.value;
    const selected = text.slice(start, end);

    let replacement = "";
    if (wrapToken) {
      replacement = `${wrapToken}${selected || "text"}${wrapToken}`;
    } else if (prefix === "[[]]") {
      replacement = `[[${selected || "Topic"}]]`;
    } else {
      replacement = `${prefix}${selected}`;
    }

    mdTextarea.value = text.slice(0, start) + replacement + text.slice(end);
    active.content = mdTextarea.value;
    active.updatedAt = Date.now();
    mdTextarea.focus();
    renderPreviewAndLinks();
    renderSidebar();
    schedulePersist();
  }

  // Event listeners
  noteTitleInput.addEventListener("input", () => {
    const active = getActiveNote();
    if (!active) return;
    active.title = noteTitleInput.value;
    active.updatedAt = Date.now();
    renderSidebar();
    renderPreviewAndLinks();
    schedulePersist();
  });

  mdTextarea.addEventListener("input", () => {
    const active = getActiveNote();
    if (!active) return;
    active.content = mdTextarea.value;
    active.updatedAt = Date.now();
    renderPreviewAndLinks();
    renderSidebar();
    schedulePersist();
  });

  previewPane.addEventListener("click", (e) => {
    const wikiBtn = e.target.closest("[data-wiki-target]");
    if (wikiBtn) {
      openOrCreateByTitle(wikiBtn.dataset.wikiTarget);
      return;
    }

    const tagBtn = e.target.closest("[data-tag-click]");
    if (tagBtn) {
      state.activeTag = tagBtn.dataset.tagClick;
      renderSidebar();
      return;
    }

    if (e.target.matches('input[type="checkbox"][data-task-line]')) {
      const active = getActiveNote();
      if (!active) return;
      const lineIdx = Number(e.target.dataset.taskLine);
      const lines = active.content.split("\n");
      if (lines[lineIdx] !== undefined) {
        lines[lineIdx] = e.target.checked
          ? lines[lineIdx].replace(/-\s+\[\s\]/, "- [x]")
          : lines[lineIdx].replace(/-\s+\[[xX]\]/, "- [ ]");
        active.content = lines.join("\n");
        active.updatedAt = Date.now();
        mdTextarea.value = active.content;
        renderPreviewAndLinks();
        schedulePersist();
      }
    }
  });

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setViewMode(btn.dataset.mode));
  });

  document.querySelectorAll(".fmt-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      insertFormatting(btn.dataset.snippet || "", btn.dataset.wrap || "");
    });
  });

  searchInput.addEventListener("input", () => {
    state.searchQuery = searchInput.value;
    renderSidebar();
  });

  newNoteBtn.addEventListener("click", () => {
    const num = state.notes.length + 1;
    const created = {
      id: `n_${Date.now()}`,
      title: `Untitled Note ${num}`,
      updatedAt: Date.now(),
      content: `# Untitled Note ${num}\n\nCapture thoughts or link to [[Welcome & Knowledge Map]].\n\n#notes`
    };
    state.notes.unshift(created);
    persistNow();
    openNoteById(created.id);
    noteTitleInput.focus();
    noteTitleInput.select();
    showToast("Created new note");
  });

  deleteNoteBtn.addEventListener("click", () => {
    if (state.notes.length <= 1) {
      showToast("Keep at least one note in the vault.");
      return;
    }
    const active = getActiveNote();
    state.notes = state.notes.filter((n) => n.id !== active.id);
    state.activeId = state.notes[0].id;
    persistNow();
    openNoteById(state.activeId);
    showToast(`Deleted "${active.title}"`);
  });

  exportMdBtn.addEventListener("click", () => {
    const active = getActiveNote();
    if (!active) return;
    const slug = (active.title || "note").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const blob = new Blob([active.content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug || "note"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded ${a.download}`);
  });

  exportVaultBtn.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.notes, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "folio-notes-vault.json";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Exported vault JSON");
  });

  resetDemoBtn.addEventListener("click", async () => {
    state.notes = await window.FolioDB.resetToDemo();
    state.activeTag = null;
    state.searchQuery = "";
    searchInput.value = "";
    openNoteById(state.notes[0].id);
    showToast("Restored seeded demo notes");
  });

  reheatGraphBtn.addEventListener("click", () => {
    if (graphCtrl) graphCtrl.reheat();
  });

  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("is-collapsed-mobile");
  });

  async function init() {
    state.notes = await window.FolioDB.ensureSeeded();
    graphCtrl = new window.FolioGraph(graphCanvas, (clickedId) => {
      openNoteById(clickedId);
    });
    if (state.notes.length > 0) {
      openNoteById(state.notes[0].id);
    }
  }

  init();
})();
