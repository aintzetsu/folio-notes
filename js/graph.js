(function (global) {
  "use strict";

  class FolioGraph {
    constructor(canvas, onSelectNote) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.onSelectNote = onSelectNote;
      this.nodes = [];
      this.edges = [];
      this.activeId = null;
      this.hoverId = null;
      this.dragNode = null;
      this.pointerDownPos = null;
      this.movedDuringDrag = false;
      this.rafId = null;
      this.bindEvents();
    }

    setData(notes, activeId) {
      this.activeId = activeId;
      const oldPos = new Map(this.nodes.map((n) => [n.id, n]));
      const w = this.canvas.width || 900;
      const h = this.canvas.height || 520;
      const cx = w / 2;
      const cy = h / 2;

      this.nodes = notes.map((note, idx) => {
        const prev = oldPos.get(note.id);
        const angle = (idx / Math.max(1, notes.length)) * Math.PI * 2;
        return {
          id: note.id,
          title: note.title || "Untitled",
          x: prev ? prev.x : cx + Math.cos(angle) * 145,
          y: prev ? prev.y : cy + Math.sin(angle) * 115,
          vx: prev ? prev.vx * 0.4 : 0,
          vy: prev ? prev.vy * 0.4 : 0
        };
      });

      const titleToId = new Map(notes.map((n) => [n.title.trim().toLowerCase(), n.id]));
      this.edges = [];
      const seenEdge = new Set();

      notes.forEach((n) => {
        const targets = global.FolioMarkdown.extractWikiLinks(n.content);
        targets.forEach((tTitle) => {
          const targetId = titleToId.get(tTitle.toLowerCase());
          if (!targetId || targetId === n.id) return;
          const pairKey = [n.id, targetId].sort().join("::");
          if (!seenEdge.has(pairKey)) {
            seenEdge.add(pairKey);
            this.edges.push({ a: n.id, b: targetId });
          }
        });
      });

      this.draw();
    }

    reheat() {
      const w = this.canvas.width || 900;
      const h = this.canvas.height || 520;
      this.nodes.forEach((n, idx) => {
        const angle = (idx / Math.max(1, this.nodes.length)) * Math.PI * 2;
        n.x = w / 2 + Math.cos(angle) * 150;
        n.y = h / 2 + Math.sin(angle) * 115;
        n.vx = 0;
        n.vy = 0;
      });
      this.startLoop();
    }

    startLoop() {
      cancelAnimationFrame(this.rafId);
      let ticks = 0;
      const step = () => {
        this.stepPhysics();
        this.draw();
        ticks++;
        if (ticks < 160 || this.dragNode) {
          this.rafId = requestAnimationFrame(step);
        }
      };
      this.rafId = requestAnimationFrame(step);
    }

    stepPhysics() {
      const w = this.canvas.width;
      const h = this.canvas.height;
      const cx = w / 2;
      const cy = h / 2;
      const byId = new Map(this.nodes.map((n) => [n.id, n]));

      for (let i = 0; i < this.nodes.length; i++) {
        const a = this.nodes[i];
        // Center gravity
        a.vx += (cx - a.x) * 0.004;
        a.vy += (cy - a.y) * 0.004;

        for (let j = i + 1; j < this.nodes.length; j++) {
          const b = this.nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.hypot(dx, dy) || 1;
          if (dist < 220) {
            const force = (220 - dist) * 0.028;
            const fx = (dx / dist) * force;
            const fy = (dy / dist) * force;
            a.vx += fx;
            a.vy += fy;
            b.vx -= fx;
            b.vy -= fy;
          }
        }
      }

      // Edge springs
      this.edges.forEach((edge) => {
        const a = byId.get(edge.a);
        const b = byId.get(edge.b);
        if (!a || !b) return;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.hypot(dx, dy) || 1;
        const force = (dist - 150) * 0.014;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      });

      this.nodes.forEach((n) => {
        if (this.dragNode && this.dragNode.id === n.id) return;
        n.vx *= 0.84;
        n.vy *= 0.84;
        n.x = Math.max(48, Math.min(w - 48, n.x + n.vx));
        n.y = Math.max(48, Math.min(h - 48, n.y + n.vy));
      });
    }

    draw() {
      const ctx = this.ctx;
      const w = this.canvas.width;
      const h = this.canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Subtle paper dot pattern
      ctx.fillStyle = "rgba(120, 113, 108, 0.14)";
      for (let gx = 24; gx < w; gx += 32) {
        for (let gy = 24; gy < h; gy += 32) {
          ctx.fillRect(gx, gy, 1.5, 1.5);
        }
      }

      const byId = new Map(this.nodes.map((n) => [n.id, n]));

      // Edges
      this.edges.forEach((e) => {
        const a = byId.get(e.a);
        const b = byId.get(e.b);
        if (!a || !b) return;
        const connectedToActive = a.id === this.activeId || b.id === this.activeId;
        ctx.strokeStyle = connectedToActive ? "#0d9488" : "rgba(120, 113, 108, 0.28)";
        ctx.lineWidth = connectedToActive ? 2.2 : 1.4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      });

      // Nodes
      this.nodes.forEach((n) => {
        const isActive = n.id === this.activeId;
        const isHover = n.id === this.hoverId;
        const radius = isActive ? 14 : isHover ? 12 : 10;

        ctx.fillStyle = isActive ? "#c2410c" : isHover ? "#0d9488" : "#1c1917";
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isActive) {
          ctx.strokeStyle = "rgba(194, 65, 12, 0.26)";
          ctx.lineWidth = 7;
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isActive ? "#9a3412" : "#1c1917";
        ctx.font = (isActive || isHover ? "700" : "600") + " 12.5px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(n.title, n.x, n.y + radius + 16);
      });
    }

    getCanvasPos(e) {
      const rect = this.canvas.getBoundingClientRect();
      return {
        x: ((e.clientX - rect.left) * this.canvas.width) / rect.width,
        y: ((e.clientY - rect.top) * this.canvas.height) / rect.height
      };
    }

    findNodeAt(x, y) {
      for (let i = this.nodes.length - 1; i >= 0; i--) {
        const n = this.nodes[i];
        if (Math.hypot(n.x - x, n.y - y) <= 22) return n;
      }
      return null;
    }

    bindEvents() {
      this.canvas.addEventListener("pointerdown", (e) => {
        const p = this.getCanvasPos(e);
        const hit = this.findNodeAt(p.x, p.y);
        this.pointerDownPos = p;
        this.movedDuringDrag = false;
        if (hit) {
          this.dragNode = hit;
          this.startLoop();
        }
      });

      this.canvas.addEventListener("pointermove", (e) => {
        const p = this.getCanvasPos(e);
        if (this.dragNode) {
          if (this.pointerDownPos && Math.hypot(p.x - this.pointerDownPos.x, p.y - this.pointerDownPos.y) > 4) {
            this.movedDuringDrag = true;
          }
          this.dragNode.x = Math.max(40, Math.min(this.canvas.width - 40, p.x));
          this.dragNode.y = Math.max(40, Math.min(this.canvas.height - 40, p.y));
          this.draw();
          return;
        }
        const hit = this.findNodeAt(p.x, p.y);
        this.hoverId = hit ? hit.id : null;
        this.canvas.style.cursor = hit ? "pointer" : "grab";
        this.draw();
      });

      window.addEventListener("pointerup", () => {
        if (this.dragNode && !this.movedDuringDrag) {
          this.onSelectNote(this.dragNode.id);
        }
        this.dragNode = null;
      });
    }
  }

  global.FolioGraph = FolioGraph;
})(window);
