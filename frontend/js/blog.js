(() => {
  const escapeHtml = value => String(value ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function safeHttpUrl(value) {
    try {
      const url = new URL(String(value || ""), location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
  }

  function inlineMarkdown(text) {
    let value = escapeHtml(text);
    value = value.replace(/`([^`]+)`/g, "<code>$1</code>");
    value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    value = value.replace(/(^|[^*])\*(?!\s)(.+?)\*(?!\*)/g, "$1<em>$2</em>");
    value = value.replace(/!\[([^\]]*)\]\(([^\s)]+)(?:\s+[^)]*)?\)/g, (_m, alt, url) => {
      const safe = safeHttpUrl(url);
      return safe ? `<img class="article-inline-image" src="${escapeHtml(safe)}" alt="${alt}" loading="lazy">` : "";
    });
    value = value.replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, (_m, label, url) => {
      const safe = safeHttpUrl(url);
      return safe ? `<a href="${escapeHtml(safe)}" target="_blank" rel="noopener noreferrer">${label}</a>` : label;
    });
    return value;
  }

  function markdownToHtml(markdown) {
    const lines = String(markdown || "").replace(/\r/g, "").split("\n");
    const out = [];
    let paragraph = [];
    let listType = null;
    const flushParagraph = () => {
      if (paragraph.length) out.push(`<p>${paragraph.map(inlineMarkdown).join("<br>")}</p>`);
      paragraph = [];
    };
    const closeList = () => { if (listType) { out.push(`</${listType}>`); listType = null; } };

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) { flushParagraph(); closeList(); continue; }
      const heading = trimmed.match(/^(#{1,3})\s+(.+)$/);
      if (heading) { flushParagraph(); closeList(); const level = heading[1].length + 1; out.push(`<h${level}>${inlineMarkdown(heading[2])}</h${level}>`); continue; }
      if (/^---+$/.test(trimmed)) { flushParagraph(); closeList(); out.push("<hr>"); continue; }
      if (trimmed.startsWith("> ")) { flushParagraph(); closeList(); out.push(`<blockquote>${inlineMarkdown(trimmed.slice(2))}</blockquote>`); continue; }
      const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
      const ordered = trimmed.match(/^\d+\.\s+(.+)$/);
      if (unordered || ordered) {
        flushParagraph();
        const nextType = ordered ? "ol" : "ul";
        if (listType !== nextType) { closeList(); out.push(`<${nextType}>`); listType = nextType; }
        out.push(`<li>${inlineMarkdown((unordered || ordered)[1])}</li>`);
        continue;
      }
      closeList(); paragraph.push(trimmed);
    }
    flushParagraph(); closeList();
    return out.join("\n");
  }

  function dateLabel(value) {
    if (!value) return "Fusball.id Editorial";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Fusball.id Editorial" : new Intl.DateTimeFormat("id-ID", { dateStyle: "long" }).format(date);
  }

  function articleCard(article) {
    const internal = Boolean(article.slug);
    const href = internal ? `/blog/${encodeURIComponent(article.slug)}` : safeHttpUrl(article.url);
    if (!href) return "";
    const label = internal ? "Baca artikel" : "Baca sumber asli";
    return `<article class="editorial-card">
      <a class="editorial-card-media" href="${escapeHtml(href)}" ${internal ? "" : 'target="_blank" rel="noopener noreferrer"'}>
        ${article.image_url ? `<img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}" loading="lazy">` : '<div class="journal-image-fallback">FUSBALL JOURNAL</div>'}
      </a>
      <div class="editorial-card-body">
        <span class="kicker">${escapeHtml(article.category || "JOURNAL")}</span>
        <h3 class="journal-title"><a href="${escapeHtml(href)}" ${internal ? "" : 'target="_blank" rel="noopener noreferrer"'}>${escapeHtml(article.title)}</a></h3>
        <p>${escapeHtml(article.excerpt || "Cerita football culture dari Fusball.id.")}</p>
        <div class="journal-card-meta"><span>${escapeHtml(dateLabel(article.published_at || article.scheduled_at || article.created_at))}</span><a class="text-link" href="${escapeHtml(href)}" ${internal ? "" : 'target="_blank" rel="noopener noreferrer"'}>${label} ↗</a></div>
      </div>
    </article>`;
  }

  async function loadJournal() {
    const root = document.getElementById("blog-grid");
    if (!root) return;
    try {
      const [nativeRows, legacyRows] = await Promise.all([
        apiGet("/marketing/articles"), apiGet("/blog")
      ]);
      const rows = [...(nativeRows || []), ...(legacyRows || [])]
        .sort((a, b) => new Date(b.published_at || b.created_at || 0) - new Date(a.published_at || a.created_at || 0));
      const categories = [...new Set(rows.map(x => x.category).filter(Boolean))].sort();
      const select = document.getElementById("journal-category");
      if (select) select.innerHTML = '<option value="">Semua kategori</option>' + categories.map(x => `<option value="${escapeHtml(x)}">${escapeHtml(x)}</option>`).join("");
      const search = document.getElementById("journal-search");
      const render = () => {
        const q = String(search?.value || "").trim().toLowerCase();
        const category = select?.value || "";
        const filtered = rows.filter(x => (!category || x.category === category) && (!q || `${x.title} ${x.excerpt || ""} ${x.category || ""} ${x.focus_keyword || ""}`.toLowerCase().includes(q)));
        root.innerHTML = filtered.map(articleCard).join("") || '<div class="empty-v10" style="grid-column:1/-1">Artikel tidak ditemukan.</div>';
      };
      search?.addEventListener("input", render);
      select?.addEventListener("change", render);
      render();
    } catch (error) {
      root.innerHTML = `<div class="empty-v10" style="grid-column:1/-1">Journal belum dapat dimuat. ${escapeHtml(error.message)}</div>`;
    }
  }

  async function loadArticle() {
    const root = document.getElementById("article-root");
    if (!root) return;
    const slug = location.pathname.split("/").filter(Boolean).pop();
    try {
      const article = await apiGet(`/marketing/articles/${encodeURIComponent(slug)}`);
      document.title = `${article.seo_title || article.title} — Fusball.id`;
      const description = document.querySelector('meta[name="description"]');
      if (description) description.content = article.meta_description || article.excerpt || article.title;
      const published = article.published_at || article.scheduled_at || article.created_at;
      const body = markdownToHtml(article.content);
      const ctaUrl = safeHttpUrl(article.cta_url || "/shop.html") || "/shop.html";
      const ctaLabel = article.cta_label || "Lihat koleksi FusballID";
      const related = await apiGet("/marketing/articles").catch(() => []);
      const relatedHtml = (related || []).filter(x => x.id !== article.id).slice(0, 3).map(articleCard).join("");
      root.innerHTML = `
        <header class="article-header">
          <span class="kicker">${escapeHtml(article.category || "FUSBALL.ID JOURNAL")}</span>
          <h1>${escapeHtml(article.title)}</h1>
          ${article.excerpt ? `<p class="article-excerpt">${escapeHtml(article.excerpt)}</p>` : ""}
          <div class="article-byline"><span>${escapeHtml(article.author_name || "Fusball.id Editorial")}</span><span>${escapeHtml(dateLabel(published))}</span></div>
        </header>
        ${article.image_url ? `<figure class="article-cover"><img src="${escapeHtml(article.image_url)}" alt="${escapeHtml(article.title)}"></figure>` : ""}
        <div class="article-layout">
          <div class="article-content">${body}</div>
          <aside class="article-sidebar"><div class="article-side-card"><span class="kicker">FUSBALL.ID</span><h3>Stories beyond the shirt.</h3><p>Jelajahi koleksi jersey dan temukan cerita di balik football culture.</p><a class="btn btn-primary" href="${escapeHtml(ctaUrl)}">${escapeHtml(ctaLabel)} ↗</a></div><div class="article-side-card"><span class="kicker">KEYWORDS</span><p>${escapeHtml([article.focus_keyword, article.secondary_keywords].filter(Boolean).join(" · "))}</p></div></aside>
        </div>
        <footer class="article-footer"><button class="btn btn-ghost" id="share-article">Bagikan artikel ↗</button><a class="btn btn-ghost" href="/blog.html">Artikel lainnya</a></footer>
        ${relatedHtml ? `<section class="article-related"><span class="kicker">MORE STORIES</span><h2>Jelajahi cerita lainnya.</h2><div class="editorial-list-grid">${relatedHtml}</div></section>` : ""}
      `;
      document.getElementById("share-article")?.addEventListener("click", async () => {
        const shareData = { title: article.title, text: article.excerpt || article.title, url: location.href };
        try {
          if (navigator.share) await navigator.share(shareData);
          else { await navigator.clipboard.writeText(location.href); alert("Tautan artikel disalin."); }
        } catch (error) { if (error.name !== "AbortError") alert("Tautan belum dapat dibagikan."); }
      });
    } catch (error) {
      root.innerHTML = `<div class="empty-v10">Artikel tidak dapat dimuat. ${escapeHtml(error.message)}<p><a class="text-link" href="/blog.html">Kembali ke Journal</a></p></div>`;
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    if (document.body.dataset.page === "blog") loadJournal();
    if (document.body.dataset.page === "blog-article") loadArticle();
  }, { once: true });
})();
