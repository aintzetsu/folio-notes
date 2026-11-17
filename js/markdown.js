(function (global) {
  "use strict";

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function extractWikiLinks(text) {
    const links = [];
    const seen = new Set();
    const re = /\[\[([^\]]+)\]\]/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const target = m[1].trim();
      if (target && !seen.has(target.toLowerCase())) {
        seen.add(target.toLowerCase());
        links.push(target);
      }
    }
    return links;
  }

  function extractTags(text) {
    const tags = [];
    const seen = new Set();
    const re = /(^|\s)#([a-zA-Z0-9_-]{2,28})/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      const tag = `#${m[2].toLowerCase()}`;
      if (!seen.has(tag)) {
        seen.add(tag);
        tags.push(tag);
      }
    }
    return tags;
  }

  function renderInline(rawLine, existingTitlesSet) {
    let s = escapeHtml(rawLine);

    // Inline code tokens protected first
    const codeTokens = [];
    s = s.replace(/`([^`]+)`/g, (_match, code) => {
      const token = `@@CODE${codeTokens.length}@@`;
      codeTokens.push(`<code>${code}</code>`);
      return token;
    });

    // External HTTPS links [label](https://...)
    s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });

    // Wiki Links [[Title]]
    s = s.replace(/\[\[([^\]]+)\]\]/g, (_m, inner) => {
      const cleanTitle = inner.trim();
      const exists = existingTitlesSet.has(cleanTitle.toLowerCase());
      const cls = exists ? "wiki-link" : "wiki-link is-missing";
      return `<button type="button" class="${cls}" data-wiki-target="${cleanTitle}">${cleanTitle}</button>`;
    });

    // Bold & Italic
    s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // #tags
    s = s.replace(/(^|\s)#([a-zA-Z0-9_-]{2,28})/g, (_m, prefix, tag) => {
      const fullTag = `#${tag.toLowerCase()}`;
      return `${prefix}<button type="button" class="inline-tag" data-tag-click="${fullTag}">${fullTag}</button>`;
    });

    codeTokens.forEach((html, idx) => {
      s = s.replace(`@@CODE${idx}@@`, html);
    });
    return s;
  }

  function renderMarkdown(markdown, existingTitles) {
    const titleSet = new Set((existingTitles || []).map((t) => t.toLowerCase()));
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const out = [];

    let inCode = false;
    let codeBuf = [];
    let inUl = false;
    let inOl = false;

    const closeLists = () => {
      if (inUl) {
        out.push("</ul>");
        inUl = false;
      }
      if (inOl) {
        out.push("</ol>");
        inOl = false;
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim().startsWith("```")) {
        closeLists();
        if (!inCode) {
          inCode = true;
          codeBuf = [];
        } else {
          inCode = false;
          out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
        }
        continue;
      }

      if (inCode) {
        codeBuf.push(line);
        continue;
      }

      if (!line.trim()) {
        closeLists();
        continue;
      }

      if (/^---+$/.test(line.trim())) {
        closeLists();
        out.push("<hr>");
        continue;
      }

      const hMatch = /^(#{1,3})\s+(.*)$/.exec(line);
      if (hMatch) {
        closeLists();
        const level = hMatch[1].length;
        out.push(`<h${level}>${renderInline(hMatch[2], titleSet)}</h${level}>`);
        continue;
      }

      if (line.startsWith("> ")) {
        closeLists();
        out.push(`<blockquote>${renderInline(line.slice(2), titleSet)}</blockquote>`);
        continue;
      }

      const taskMatch = /^-\s+\[( |x|X)\]\s+(.*)$/.exec(line);
      if (taskMatch) {
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          out.push("<ul>");
          inUl = true;
        }
        const checked = taskMatch[1].toLowerCase() === "x";
        out.push(
          `<li class="task-item"><input type="checkbox" data-task-line="${i}"${checked ? " checked" : ""}><span>${renderInline(taskMatch[2], titleSet)}</span></li>`
        );
        continue;
      }

      const ulMatch = /^[-*]\s+(.*)$/.exec(line);
      if (ulMatch) {
        if (inOl) {
          out.push("</ol>");
          inOl = false;
        }
        if (!inUl) {
          out.push("<ul>");
          inUl = true;
        }
        out.push(`<li>${renderInline(ulMatch[1], titleSet)}</li>`);
        continue;
      }

      const olMatch = /^\d+\.\s+(.*)$/.exec(line);
      if (olMatch) {
        if (inUl) {
          out.push("</ul>");
          inUl = false;
        }
        if (!inOl) {
          out.push("<ol>");
          inOl = true;
        }
        out.push(`<li>${renderInline(olMatch[1], titleSet)}</li>`);
        continue;
      }

      closeLists();
      out.push(`<p>${renderInline(line, titleSet)}</p>`);
    }

    if (inCode && codeBuf.length > 0) {
      out.push(`<pre><code>${escapeHtml(codeBuf.join("\n"))}</code></pre>`);
    }
    closeLists();

    return out.join("\n");
  }

  global.FolioMarkdown = {
    extractWikiLinks,
    extractTags,
    renderMarkdown
  };
})(window);
