(() => {
  const $ = selector => document.querySelector(selector);
  const esc = value => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const api = (path, method = "GET", body) => apiAuth(`/marketing${path}`, method, body);
  const fmt = value => new Intl.NumberFormat("id-ID").format(Number(value) || 0);
  const moneylessDate = value => value ? new Date(value).toLocaleDateString("id-ID", { dateStyle: "medium" }) : "—";
  const localDateKey = value => {
    if (!value) return "";
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  };
  const state = { articles: [], analytics: null, campaigns: [], promotions: [], monitoring: null, currentCampaign: null };

  function toast(message) {
    const target = document.getElementById("toast");
    if (!target) return;
    target.textContent = message;
    target.style.display = "block";
    clearTimeout(window.__marketingToast);
    window.__marketingToast = setTimeout(() => target.style.display = "none", 3000);
  }

  function openModal(html) {
    const modal = $("#admin-modal");
    $("#admin-modal-card").innerHTML = html;
    modal.classList.add("open");
  }
  function closeModal() {
    $("#admin-modal").classList.remove("open");
    $("#admin-modal-card").innerHTML = "";
  }

  async function loadArticles() {
    const root = $("#marketing-article-list");
    if (!root) return;
    root.innerHTML = '<div class="empty-v10">Memuat artikel...</div>';
    try {
      state.articles = await api("/admin/articles");
      renderArticles();
    } catch (error) {
      root.innerHTML = `<div class="empty-v10">Gagal memuat Blog Studio: ${esc(error.message)}. Pastikan migrasi database sudah dijalankan.</div>`;
    }
  }

  function renderArticles() {
    const root = $("#marketing-article-list");
    if (!root) return;
    const native = state.articles.filter(x => x.content !== null && x.content !== undefined);
    root.innerHTML = native.length ? `<div class="marketing-table-wrap"><table class="admin-table-v10"><thead><tr><th>ARTIKEL</th><th>KATEGORI</th><th>SEO</th><th>STATUS</th><th>AKSI</th></tr></thead><tbody>${native.map(article => {
      const status = article.status || (article.published ? "published" : "draft");
      const label = status === "published" ? "Published" : status === "scheduled" ? "Scheduled" : "Draft";
      return `<tr><td><div class="marketing-article-cell">${article.image_url ? `<img src="${esc(article.image_url)}" alt="">` : ""}<div><b>${esc(article.title)}</b><small>${esc(article.slug || "Belum punya slug")}</small></div></div></td><td>${esc(article.category || "—")}</td><td><small>${article.focus_keyword ? esc(article.focus_keyword) : "Belum diatur"}</small></td><td><span class="marketing-status ${esc(status)}">${label}</span></td><td><div class="marketing-row-actions"><button class="btn btn-ghost article-edit" data-id="${article.id}">Edit</button>${status === "published" ? `<a class="btn btn-ghost" href="/blog/${encodeURIComponent(article.slug)}" target="_blank" rel="noopener">Lihat</a>` : ""}<button class="btn btn-ghost article-delete" data-id="${article.id}">Hapus</button></div></td></tr>`;
    }).join("")}</tbody></table></div>` : '<div class="empty-v10">Belum ada artikel native. Buat artikel pertama dari tombol di atas.</div>';
    root.querySelectorAll(".article-edit").forEach(button => button.addEventListener("click", () => editArticle(Number(button.dataset.id))));
    root.querySelectorAll(".article-delete").forEach(button => button.addEventListener("click", () => deleteArticle(Number(button.dataset.id))));
  }

  function slugify(value) {
    return String(value || "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  }

  function localDateTimeToIso(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function toLocalDateTime(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function toolbarButton(label, before, after = "", fallback = "teks") {
    return `<button type="button" class="btn btn-ghost markdown-tool" data-before="${esc(before)}" data-after="${esc(after)}" data-fallback="${esc(fallback)}">${label}</button>`;
  }

  function articleForm(article = {}) {
    const editing = Boolean(article.id);
    const status = article.status || (article.published ? "published" : "draft");
    const dateValue = toLocalDateTime(article.scheduled_at);
    return `<div class="marketing-editor-form">
      <span class="kicker">BLOG STUDIO / ${editing ? "EDIT ARTIKEL" : "ARTIKEL BARU"}</span>
      <h2>${editing ? "Perbarui artikel." : "Tulis cerita baru."}</h2>
      <p class="detail-desc">Tulis isi dalam Markdown. Gunakan heading, daftar, tautan, dan gambar. Thumbnail utama wajib untuk publish/jadwal; draft boleh disimpan tanpa gambar.</p>
      <div class="admin-form-grid">
        <div class="admin-field-v10 full"><label>JUDUL ARTIKEL *</label><input id="ma-title" maxlength="180" value="${esc(article.title || "")}" placeholder="Contoh: Mengapa Jersey Lebih dari Sekadar Seragam?"></div>
        <div class="admin-field-v10"><label>SLUG URL</label><input id="ma-slug" maxlength="220" value="${esc(article.slug || "")}" placeholder="otomatis-dari-judul"><small class="marketing-help">URL: /blog/slug-artikel</small></div>
        <div class="admin-field-v10"><label>KATEGORI</label><input id="ma-category" maxlength="100" value="${esc(article.category || "Football Culture")}" placeholder="Football Culture"></div>
        <div class="admin-field-v10 full"><label>RINGKASAN / EXCERPT</label><textarea id="ma-excerpt" maxlength="2000" rows="3" placeholder="Ringkasan untuk kartu artikel dan hasil pencarian">${esc(article.excerpt || "")}</textarea></div>
        <div class="admin-field-v10 full"><label>ISI ARTIKEL (MARKDOWN) *</label><div class="markdown-toolbar">${toolbarButton("H2", "## ")}${toolbarButton("H3", "### ")}${toolbarButton("Tebal", "**", "**")}${toolbarButton("Kutipan", "> ")}${toolbarButton("Daftar", "- ")}${toolbarButton("Tautan", "[", "](https://contoh.com)", "teks tautan")}${toolbarButton("Gambar", "![", "](https://contoh.com/gambar.jpg)", "deskripsi gambar")}</div><textarea id="ma-content" rows="18" maxlength="100000" placeholder="# Judul bagian\n\nTulis isi artikel 500–800 kata...">${esc(article.content || "")}</textarea><small class="marketing-help"><span id="ma-word-count">0 kata</span> · 100.000 karakter maksimal. Markdown dirender dengan aman pada halaman publik.</small></div>
        <div class="admin-field-v10 full"><label>THUMBNAIL / GAMBAR UTAMA</label><input id="ma-image" type="file" accept="image/jpeg,image/png,image/webp"><small class="marketing-help">JPG, PNG, atau WEBP. Maksimal 5 MB. ${editing ? "Kosongkan untuk mempertahankan gambar saat ini." : "Wajib diunggah."}</small>${article.image_url ? `<img class="marketing-image-preview" src="${esc(article.image_url)}" alt="Thumbnail saat ini">` : ""}</div>
        <div class="admin-field-v10"><label>KATEGORI / TAG TAMBAHAN</label><input id="ma-tags" maxlength="500" value="${esc(article.tags || "")}" placeholder="football culture, jersey design"></div>
        <div class="admin-field-v10"><label>KEYWORD UTAMA</label><input id="ma-focus" maxlength="160" value="${esc(article.focus_keyword || "")}" placeholder="jersey fantasy"></div>
        <div class="admin-field-v10"><label>KEYWORD PENDUKUNG</label><input id="ma-secondary" maxlength="500" value="${esc(article.secondary_keywords || "")}" placeholder="football fashion, jersey design"></div>
        <div class="admin-field-v10 full"><label>SEO TITLE</label><input id="ma-seo-title" maxlength="180" value="${esc(article.seo_title || "")}" placeholder="Judul yang tampil pada hasil pencarian"></div>
        <div class="admin-field-v10 full"><label>META DESCRIPTION</label><textarea id="ma-meta" maxlength="320" rows="3" placeholder="Ringkasan untuk mesin pencari, idealnya jelas dan spesifik">${esc(article.meta_description || "")}</textarea><small class="marketing-help"><span id="ma-meta-count">0</span>/320 karakter</small></div>
        <div class="admin-field-v10"><label>PENULIS</label><input id="ma-author" maxlength="120" value="${esc(article.author_name || "Fusball.id Editorial")}"></div>
        <div class="admin-field-v10"><label>CTA LABEL</label><input id="ma-cta-label" maxlength="180" value="${esc(article.cta_label || "Lihat koleksi FusballID")}"></div>
        <div class="admin-field-v10 full"><label>CTA URL</label><input id="ma-cta-url" maxlength="1000" value="${esc(article.cta_url || "/shop.html")}" placeholder="/shop.html atau https://..."></div>
        <div class="admin-field-v10"><label>STATUS PUBLIKASI</label><select id="ma-status"><option value="draft" ${status === "draft" ? "selected" : ""}>Draft</option><option value="published" ${status === "published" ? "selected" : ""}>Publish sekarang</option><option value="scheduled" ${status === "scheduled" ? "selected" : ""}>Jadwalkan</option></select></div>
        <div class="admin-field-v10"><label>JADWAL TERBIT</label><input id="ma-scheduled" type="datetime-local" value="${dateValue}"><small class="marketing-help">Untuk status Scheduled. Artikel akan tampil saat pengunjung membuka situs setelah waktu ini.</small></div>
      </div>
      <div class="marketing-seo-preview"><span class="kicker">PREVIEW HASIL PENCARIAN</span><strong id="ma-preview-title">${esc(article.seo_title || article.title || "Judul artikel")}</strong><p id="ma-preview-description">${esc(article.meta_description || article.excerpt || "Deskripsi artikel akan tampil di sini.")}</p><small>fusball-web.onrender.com/blog/${esc(article.slug || "slug-artikel")}</small></div>
      <div class="admin-actions-v10"><button class="btn btn-primary" id="ma-save">${editing ? "Simpan perubahan" : "Simpan artikel"}</button><button class="btn btn-ghost" id="ma-cancel">Batal</button></div>
    </div>`;
  }

  function bindArticleForm(article = {}) {
    const title = $("#ma-title"); const slug = $("#ma-slug"); const content = $("#ma-content"); const excerpt = $("#ma-excerpt"); const meta = $("#ma-meta"); const seoTitle = $("#ma-seo-title");
    title.addEventListener("input", () => { if (!slug.dataset.edited) slug.value = slugify(title.value); updatePreview(); });
    slug.addEventListener("input", () => { slug.dataset.edited = "1"; updatePreview(); });
    [meta, seoTitle, excerpt].forEach(el => el.addEventListener("input", updatePreview));
    const updateWords = () => { const count = content.value.trim().split(/\s+/).filter(Boolean).length; $("#ma-word-count").textContent = `${count} kata · target panduan 500–800 kata`; };
    const updateMeta = () => { $("#ma-meta-count").textContent = meta.value.length; };
    function updatePreview() {
      $("#ma-preview-title").textContent = seoTitle.value.trim() || title.value.trim() || "Judul artikel";
      $("#ma-preview-description").textContent = meta.value.trim() || excerpt.value.trim() || "Deskripsi artikel akan tampil di sini.";
      const small = $(".marketing-seo-preview small"); if (small) small.textContent = `fusball-web.onrender.com/blog/${slug.value || "slug-artikel"}`;
    }
    content.addEventListener("input", updateWords); meta.addEventListener("input", updateMeta);
    updateWords(); updateMeta(); updatePreview();
    document.querySelectorAll(".markdown-tool").forEach(button => button.addEventListener("click", () => {
      const before = button.dataset.before || ""; const after = button.dataset.after || "";
      const start = content.selectionStart; const end = content.selectionEnd; const selected = content.value.slice(start, end) || button.dataset.fallback || "teks";
      content.setRangeText(`${before}${selected}${after}`, start, end, "select"); content.focus(); updateWords();
    }));
    $("#ma-cancel").onclick = closeModal;
    $("#ma-save").onclick = () => saveArticle(article);
  }

  function openArticleForm(article = {}) {
    openModal(articleForm(article));
    bindArticleForm(article);
  }

  async function saveArticle(article) {
    const button = $("#ma-save"); button.disabled = true;
    try {
      const title = $("#ma-title").value.trim();
      const content = $("#ma-content").value.trim();
      if (!title || !content) throw new Error("Judul dan isi artikel wajib diisi.");
      const file = $("#ma-image").files[0];
      if (!article.id && !file && $("#ma-status").value !== "draft") throw new Error("Thumbnail utama wajib diunggah untuk artikel yang dijadwalkan atau dipublikasikan.");
      if (file && (!['image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) throw new Error("Gunakan JPG, PNG, WEBP maksimal 5 MB.");
      const fd = new FormData();
      const values = {
        title, slug: $("#ma-slug").value.trim(), content, excerpt: $("#ma-excerpt").value.trim(),
        category: $("#ma-category").value.trim(), tags: $("#ma-tags").value.trim(), focus_keyword: $("#ma-focus").value.trim(),
        secondary_keywords: $("#ma-secondary").value.trim(), seo_title: $("#ma-seo-title").value.trim(),
        meta_description: $("#ma-meta").value.trim(), author_name: $("#ma-author").value.trim(),
        cta_label: $("#ma-cta-label").value.trim(), cta_url: $("#ma-cta-url").value.trim(),
        status: $("#ma-status").value, scheduled_at: localDateTimeToIso($("#ma-scheduled").value), sort_order: 0
      };
      Object.entries(values).forEach(([key, value]) => fd.append(key, value));
      if (file) fd.append("thumbnail", file);
      await multipart(`/marketing/admin/articles${article.id ? `/${article.id}` : ""}`,article.id ? "PUT" : "POST",fd);
      toast(article.id ? "Artikel diperbarui." : "Artikel berhasil dibuat.");
      closeModal(); await loadArticles();
    } catch (error) { toast(error.message); }
    finally { button.disabled = false; }
  }

  async function multipart(path, method, formData) {
    const token = getToken();
    const endpoint = `${API_BASE}${path}`;
    const headers = { Accept: "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(endpoint, { method, headers, body: formData });
    const responseText = await response.text();
    let data = {};
    try {
      data = responseText ? JSON.parse(responseText) : {};
    } catch {
      // Preserve a useful HTTP diagnostic even when a proxy returns HTML/plain text.
    }

    if (response.status === 401) clearAuth();
    if (!response.ok) {
      const detail = data.message || response.statusText || `HTTP ${response.status}`;
      throw new Error(`${method} ${endpoint} · ${detail}`);
    }
    return data;
  }

  async function editArticle(id) {
    const article = state.articles.find(x => Number(x.id) === id);
    if (!article) return;
    openArticleForm(article);
  }
  async function deleteArticle(id) {
    if (!confirm("Hapus artikel ini? Statistik kunjungan yang sudah tercatat tetap disimpan.")) return;
    try { await api(`/admin/articles/${id}`, "DELETE"); toast("Artikel dihapus."); await loadArticles(); }
    catch (error) { toast(error.message); }
  }

  function renderAnalytics(data) {
    const root = $("#marketing-analytics-content");
    if (!root) return;
    const totals = data.totals || {};
    root.innerHTML = `
      <div class="admin-kpi-grid marketing-kpis">
        <div class="admin-kpi"><small>PAGE VIEWS</small><strong>${fmt(totals.page_views)}</strong></div>
        <div class="admin-kpi"><small>PERKIRAAN UNIQUE VISITORS</small><strong>${fmt(totals.visitors)}</strong></div>
        <div class="admin-kpi"><small>ARTICLE VIEWS</small><strong>${fmt(totals.article_views)}</strong></div>
        <div class="admin-kpi"><small>ARTICLE VISITORS</small><strong>${fmt(totals.article_visitors)}</strong></div>
      </div>
      <div class="admin-split-v10 marketing-analytics-grid">
        <div class="admin-card-v10"><span class="kicker">DAILY TRAFFIC</span><h3>Tren kunjungan</h3><div class="marketing-bars">${(data.daily || []).length ? data.daily.map(day => `<div class="marketing-bar-col"><strong>${fmt(day.page_views)}</strong><div class="marketing-bar" style="height:${Math.max(4, Math.round((Number(day.page_views) / Math.max(1, ...data.daily.map(x => Number(x.page_views)))) * 130))}px"></div><small>${new Date(day.day).toLocaleDateString("id-ID", { day: "2-digit", month: "short" })}</small></div>`).join("") : '<div class="empty-v10">Belum ada kunjungan tercatat pada periode ini.</div>'}</div></div>
        <div class="admin-card-v10"><span class="kicker">TRAFFIC SOURCES</span><h3>Sumber kunjungan</h3><div class="marketing-source-list">${(data.sources || []).length ? data.sources.map(source => `<div><span>${esc(source.source)}</span><b>${fmt(source.views)} views</b><small>${fmt(source.visitors)} visitors</small></div>`).join("") : '<div class="empty-v10">Belum ada data sumber kunjungan.</div>'}</div></div>
      </div>
      <div class="admin-card-v10"><div class="admin-topbar-v10"><div><span class="kicker">CONTENT PERFORMANCE</span><h3>Artikel paling banyak dibaca</h3></div><button class="btn btn-ghost" id="export-analytics">Export CSV</button></div>
        ${(data.top_articles || []).length ? `<div class="marketing-table-wrap"><table class="admin-table-v10"><thead><tr><th>ARTIKEL</th><th>PAGE VIEWS</th><th>VISITORS</th></tr></thead><tbody>${data.top_articles.map(x => `<tr><td>${esc(x.title)}</td><td>${fmt(x.views)}</td><td>${fmt(x.visitors)}</td></tr>`).join("")}</tbody></table></div>` : '<div class="empty-v10">Belum ada kunjungan artikel.</div>'}
      </div>
      <p class="marketing-help">Visitors adalah perkiraan browser unik yang mengizinkan analytics, bukan identifikasi orang. IP address dan user-agent tidak disimpan. Data sebelum fitur ini aktif tidak tersedia secara historis.</p>`;
    $("#export-analytics")?.addEventListener("click", () => downloadCsv("fusball-analytics.csv", [
      ["Tanggal", "Page Views", "Visitors"], ...(data.daily || []).map(x => [x.day, x.page_views, x.visitors]),
      [], ["Artikel", "Views", "Visitors"], ...(data.top_articles || []).map(x => [x.title, x.views, x.visitors]),
      [], ["Sumber", "Views", "Visitors"], ...(data.sources || []).map(x => [x.source, x.views, x.visitors])
    ]));
  }

  async function loadAnalytics() {
    const root = $("#marketing-analytics-content"); if (!root) return;
    root.innerHTML = '<div class="empty-v10">Memuat analytics...</div>';
    try {
      const days = Number($("#analytics-days")?.value || 10);
      state.analytics = await api(`/admin/analytics?days=${days}`);
      renderAnalytics(state.analytics);
    } catch (error) { root.innerHTML = `<div class="empty-v10">Analytics belum tersedia: ${esc(error.message)}. Pastikan migrasi database sudah dijalankan.</div>`; }
  }

  function downloadCsv(filename, rows) {
    const csv = rows.map(row => row.map(value => `"${String(value ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
  }

  async function loadCampaigns() {
    const select = $("#campaign-select"); if (!select) return;
    try {
      state.campaigns = await api("/admin/campaigns");
      const current = state.currentCampaign || Number(select.value) || state.campaigns[0]?.id;
      select.innerHTML = state.campaigns.map(c => `<option value="${c.id}">${esc(c.name)} · ${esc(c.status)}</option>`).join("") || '<option value="">Belum ada kampanye</option>';
      if (current && state.campaigns.some(c => Number(c.id) === Number(current))) select.value = current;
      state.currentCampaign = Number(select.value) || null;
      renderCampaignSummary();
      await loadPromotions();
    } catch (error) { $("#campaign-list").innerHTML = `<div class="empty-v10">Campaign tracker belum tersedia: ${esc(error.message)}. Pastikan migrasi sudah dijalankan.</div>`; }
  }

  function renderCampaignSummary() {
    const root = $("#campaign-summary"); if (!root) return;
    const c = state.campaigns.find(x => Number(x.id) === Number(state.currentCampaign));
    if (!c) { root.innerHTML = '<div class="empty-v10">Buat kampanye untuk mulai mencatat promosi.</div>'; return; }
    const start = localDateKey(c.start_date);
    const end = localDateKey(c.end_date);
    const now = Date.now();
    const publishedArticles = state.articles.filter(article => {
      const stamp = article.published_at || article.scheduled_at || article.created_at;
      const day = localDateKey(stamp);
      const isPublic = article.status === "published" || (article.status === "scheduled" && article.scheduled_at && new Date(article.scheduled_at).getTime() <= now);
      return article.content && isPublic && day >= start && day <= end;
    }).length;
    const publishedPromotions = state.promotions.filter(x => {
      const day = localDateKey(x.published_at || x.scheduled_at || x.created_at);
      return x.status === "published" && day >= start && day <= end;
    });
    const platforms = new Set(publishedPromotions.map(x => x.platform)).size;
    root.innerHTML = `<div class="admin-kpi-grid marketing-kpis"><div class="admin-kpi"><small>ARTIKEL DIPUBLIKASIKAN</small><strong>${publishedArticles}/10</strong></div><div class="admin-kpi"><small>MATERI PROMOSI TERBIT</small><strong>${fmt(c.published_promotion_count || 0)}/20</strong></div><div class="admin-kpi"><small>PLATFORM DIPAKAI</small><strong>${platforms}/2</strong></div><div class="admin-kpi"><small>IMPRESSIONS / VIEWS</small><strong>${fmt(c.total_impressions)}</strong></div></div><p class="marketing-help">${esc(c.objective || "Tanpa objective.")} · ${moneylessDate(c.start_date)} – ${moneylessDate(c.end_date)}. Hanya artikel dan materi berstatus Published yang dihitung pada progres. Reach ditampilkan per publikasi dan tidak dijumlahkan lintas platform. Target mengikuti panduan tugas.</p>`;
  }

  async function loadPromotions() {
    const root = $("#campaign-list"); if (!root) return;
    if (!state.currentCampaign) { root.innerHTML = '<div class="empty-v10">Belum ada kampanye yang dipilih.</div>'; await loadMonitoring(); return; }
    try {
      state.promotions = await api(`/admin/promotions?campaign_id=${state.currentCampaign}`);
      renderCampaignSummary();
      renderPromotions();
      await loadMonitoring();
    } catch (error) { root.innerHTML = `<div class="empty-v10">Gagal memuat publikasi: ${esc(error.message)}</div>`; }
  }

  async function loadMonitoring() {
    const root = $("#campaign-monitoring");
    if (!root) return;
    if (!state.currentCampaign) { state.monitoring = null; root.innerHTML = '<div class="empty-v10">Belum ada kampanye yang dipilih.</div>'; return; }
    root.innerHTML = '<div class="empty-v10">Memuat monitoring harian...</div>';
    try {
      state.monitoring = await api(`/admin/campaigns/${state.currentCampaign}/monitoring`);
      renderMonitoring();
    } catch (error) {
      root.innerHTML = `<div class="empty-v10">Monitoring belum tersedia: ${esc(error.message)}.</div>`;
    }
  }

  function renderMonitoring() {
    const root = $("#campaign-monitoring");
    if (!root || !state.monitoring) return;
    const data = state.monitoring;
    const platformRows = (data.platform_summary || []).map(p => {
      const engagement = Number(p.likes) + Number(p.comments) + Number(p.shares) + Number(p.saves);
      const err = Number(p.reach) ? `${(engagement / Number(p.reach) * 100).toFixed(2)}%` : "—";
      const erv = Number(p.impressions) ? `${((Number(p.likes) + Number(p.comments) + Number(p.shares)) / Number(p.impressions) * 100).toFixed(2)}%` : "—";
      const ctr = Number(p.impressions) ? `${(Number(p.link_clicks) / Number(p.impressions) * 100).toFixed(2)}%` : "—";
      return `<tr><td>${esc(p.platform)}</td><td>${fmt(p.posts)}</td><td>${fmt(p.reach)}</td><td>${fmt(p.impressions)}</td><td>${fmt(p.likes)}</td><td>${fmt(p.comments)}</td><td>${fmt(p.shares)}</td><td>${fmt(p.saves)}</td><td>${fmt(p.profile_visits)}</td><td>${fmt(p.link_clicks)}</td><td>${err}</td><td>${erv}</td><td>${ctr}</td></tr>`;
    }).join("");
    const dailyRows = (data.days || []).map(day => {
      const articleList = day.articles.length ? day.articles.map(a => esc(a.title)).join("<br>") : "—";
      const platformList = day.platforms.length ? day.platforms.map(p => `<div class="monitor-platform-row"><b>${esc(p.platform)}</b><span>Reach ${fmt(p.reach)} · Views ${fmt(p.impressions)} · Engagement ${fmt(Number(p.likes)+Number(p.comments)+Number(p.shares)+Number(p.saves))} · Clicks ${fmt(p.link_clicks)}</span></div>`).join("") : "—";
      return `<tr><td>${esc(new Date(`${day.day}T00:00:00`).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" }))}</td><td>${articleList}</td><td>${fmt(day.cms_page_views)}</td><td>${fmt(day.cms_visitors)}</td><td>${platformList}</td></tr>`;
    }).join("");
    root.innerHTML = `
      <div class="marketing-table-wrap"><table class="admin-table-v10"><thead><tr><th>TANGGAL</th><th>ARTIKEL TERBIT</th><th>CMS PAGE VIEWS</th><th>CMS VISITORS</th><th>SOCIAL PERFORMANCE PER PLATFORM</th></tr></thead><tbody>${dailyRows || '<tr><td colspan="5">Belum ada data.</td></tr>'}</tbody></table></div>
      <p class="marketing-help">Reach merupakan akumulasi metrik post yang dicatat, bukan orang unik. Jangan menjumlahkan reach lintas platform. Hari tanpa data akan tetap ditampilkan sebagai nol. Analytics website hanya tersedia sejak tracking diaktifkan.</p>
      <h4 class="marketing-platform-heading">Rekapitulasi per platform</h4>
      ${platformRows ? `<div class="marketing-table-wrap"><table class="admin-table-v10"><thead><tr><th>PLATFORM</th><th>POST</th><th>REACH</th><th>VIEWS</th><th>LIKES</th><th>COMMENTS</th><th>SHARES</th><th>SAVES</th><th>PROFILE VISITS</th><th>LINK CLICKS</th><th>ERR</th><th>ERV</th><th>CTR</th></tr></thead><tbody>${platformRows}</tbody></table></div>` : '<div class="empty-v10">Belum ada promosi berstatus Published.</div>'}`;
    const exportButton = $("#export-monitoring");
    if (exportButton) exportButton.onclick = exportMonitoringCsv;
  }

  function exportMonitoringCsv() {
    if (!state.monitoring) return;
    const rows = [["Tanggal","Artikel","CMS Page Views","CMS Visitors","Platform","Posts","Reach","Impressions/Views","Likes","Comments","Shares","Saves","Profile Visits","Link Clicks"]];
    for (const day of state.monitoring.days || []) {
      if (!day.platforms.length) rows.push([day.day, (day.articles || []).map(a => a.title).join("; "), day.cms_page_views, day.cms_visitors, "", 0, 0, 0, 0, 0, 0, 0, 0, 0]);
      else for (const platform of day.platforms) rows.push([day.day, (day.articles || []).map(a => a.title).join("; "), day.cms_page_views, day.cms_visitors, platform.platform, platform.posts, platform.reach, platform.impressions, platform.likes, platform.comments, platform.shares, platform.saves, platform.profile_visits, platform.link_clicks]);
    }
    rows.push([], ["Rekap Platform","Platform","Posts","Reach","Impressions/Views","Likes","Comments","Shares","Saves","Profile Visits","Link Clicks"]);
    for (const p of state.monitoring.platform_summary || []) rows.push(["Rekap Platform", p.platform, p.posts, p.reach, p.impressions, p.likes, p.comments, p.shares, p.saves, p.profile_visits, p.link_clicks]);
    downloadCsv("fusball-campaign-monitoring.csv", rows);
  }

  function renderPromotions() {
    const root = $("#campaign-list"); if (!root) return;
    root.innerHTML = state.promotions.length ? `<div class="marketing-table-wrap"><table class="admin-table-v10"><thead><tr><th>ARTIKEL / KONTEN</th><th>PLATFORM</th><th>WAKTU / TAUTAN</th><th>STATUS</th><th>REACH</th><th>ENGAGEMENT</th><th>LINK CLICKS</th><th>ERR*</th><th>ERV*</th><th>CTR*</th><th>AKSI</th></tr></thead><tbody>${state.promotions.map(p => {
      const engagement = Number(p.likes) + Number(p.comments) + Number(p.shares) + Number(p.saves);
      const err = Number(p.reach) ? (engagement / Number(p.reach) * 100).toFixed(2) + "%" : "—";
      const erv = Number(p.impressions) ? ((Number(p.likes) + Number(p.comments) + Number(p.shares)) / Number(p.impressions) * 100).toFixed(2) + "%" : "—";
      const ctr = Number(p.impressions) ? (Number(p.link_clicks) / Number(p.impressions) * 100).toFixed(2) + "%" : "—";
      return `<tr><td><b>${esc(p.article_title || "Konten sosial")}</b><small>${esc(p.content_format)}</small></td><td>${esc(p.platform)}</td><td><small>${esc(new Date(p.published_at || p.scheduled_at || p.created_at).toLocaleString("id-ID"))}</small>${p.post_url ? `<br><a class="cms-preview-link" href="${esc(p.post_url)}" target="_blank" rel="noopener">Buka post ↗</a>` : ""}</td><td><span class="marketing-status ${esc(p.status)}">${p.status === "published" ? "Published" : "Planned"}</span></td><td>${fmt(p.reach)}</td><td>${fmt(engagement)}</td><td>${fmt(p.link_clicks)}</td><td>${err}</td><td>${erv}</td><td>${ctr}</td><td><div class="marketing-row-actions"><button class="btn btn-ghost promo-edit" data-id="${p.id}">Edit</button><button class="btn btn-ghost promo-delete" data-id="${p.id}">Hapus</button></div></td></tr>`;
    }).join("")}</tbody></table></div><p class="marketing-help">*ERR = (likes + comments + shares + saves) / reach × 100%. ERV = (likes + comments + shares) / views × 100%. CTR = link clicks / impressions × 100%. Jangan menjumlahkan reach lintas platform.</p>` : '<div class="empty-v10">Belum ada publikasi untuk kampanye ini.</div>';
    root.querySelectorAll(".promo-edit").forEach(b => b.addEventListener("click", () => openPromotionForm(state.promotions.find(p => Number(p.id) === Number(b.dataset.id)))));
    root.querySelectorAll(".promo-delete").forEach(b => b.addEventListener("click", () => deletePromotion(Number(b.dataset.id))));
  }

  function campaignForm(campaign = {}) {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}`;
    return `<div class="marketing-editor-form"><span class="kicker">CAMPAIGN TRACKER</span><h2>${campaign.id ? "Edit kampanye" : "Buat kampanye baru"}</h2><div class="admin-form-grid"><div class="admin-field-v10 full"><label>NAMA KAMPANYE *</label><input id="mc-name" maxlength="180" value="${esc(campaign.name || "Blog Marketing Campaign — FusballID")}"></div><div class="admin-field-v10 full"><label>OBJECTIVE</label><textarea id="mc-objective" maxlength="500">${esc(campaign.objective || "Meningkatkan awareness, traffic website, dan engagement melalui 10 artikel dalam 10 hari.")}</textarea></div><div class="admin-field-v10"><label>TANGGAL MULAI *</label><input id="mc-start" type="date" value="${esc(campaign.start_date ? localDateKey(campaign.start_date) : today)}"></div><div class="admin-field-v10"><label>TANGGAL SELESAI *</label><input id="mc-end" type="date" value="${esc(campaign.end_date ? localDateKey(campaign.end_date) : (() => { const end = new Date(now.getFullYear(),now.getMonth(),now.getDate()+9); return `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,"0")}-${String(end.getDate()).padStart(2,"0")}`; })())}"></div>${campaign.id ? `<div class="admin-field-v10"><label>STATUS</label><select id="mc-status"><option value="planned" ${campaign.status==='planned'?'selected':''}>Planned</option><option value="active" ${campaign.status==='active'?'selected':''}>Active</option><option value="completed" ${campaign.status==='completed'?'selected':''}>Completed</option></select></div>` : ""}</div><div class="admin-actions-v10"><button class="btn btn-primary" id="mc-save">Simpan</button><button class="btn btn-ghost" id="mc-cancel">Batal</button></div></div>`;
  }

  function openCampaignForm(campaign = {}) {
    openModal(campaignForm(campaign));
    $("#mc-cancel").onclick = closeModal;
    $("#mc-save").onclick = async () => {
      try {
        const payload = { name: $("#mc-name").value.trim(), objective: $("#mc-objective").value.trim(), start_date: $("#mc-start").value, end_date: $("#mc-end").value, status: $("#mc-status")?.value || "planned" };
        await api(`/admin/campaigns${campaign.id ? `/${campaign.id}` : ""}`, campaign.id ? "PUT" : "POST", payload);
        toast("Kampanye disimpan."); closeModal(); await loadCampaigns();
      } catch (error) { toast(error.message); }
    };
  }

  function promotionForm(promotion = {}) {
    const editing = Boolean(promotion.id);
    const articles = state.articles.filter(x => x.content !== null && x.content !== undefined);
    const metrics = ["reach", "impressions", "likes", "comments", "shares", "saves", "profile_visits", "link_clicks"];
    const labels = { reach: "REACH", impressions: "IMPRESSIONS / VIEWS", likes: "LIKES", comments: "COMMENTS", shares: "SHARES", saves: "SAVES", profile_visits: "PROFILE VISITS", link_clicks: "LINK CLICKS" };
    return `<div class="marketing-editor-form"><span class="kicker">SOCIAL MEDIA PROMOTION</span><h2>${editing ? "Perbarui publikasi" : "Catat publikasi baru"}</h2><div class="admin-form-grid"><div class="admin-field-v10 full"><label>ARTIKEL TERKAIT</label><select id="mp-article"><option value="">Tidak terkait artikel</option>${articles.map(a => `<option value="${a.id}" ${Number(promotion.article_id)===Number(a.id)?'selected':''}>${esc(a.title)}</option>`).join("")}</select></div><div class="admin-field-v10"><label>PLATFORM *</label><select id="mp-platform">${["instagram","tiktok","facebook","linkedin","other"].map(x => `<option value="${x}" ${promotion.platform===x?'selected':''}>${x}</option>`).join("")}</select></div><div class="admin-field-v10"><label>FORMAT *</label><select id="mp-format">${["feed","carousel","reels","story","video","shorts","post","other"].map(x => `<option value="${x}" ${promotion.content_format===x?'selected':''}>${x}</option>`).join("")}</select></div><div class="admin-field-v10"><label>STATUS</label><select id="mp-status"><option value="planned" ${promotion.status!=='published'?'selected':''}>Rencana</option><option value="published" ${promotion.status==='published'?'selected':''}>Sudah dipublikasikan</option></select></div><div class="admin-field-v10"><label>WAKTU RENCANA</label><input id="mp-scheduled" type="datetime-local" value="${esc(toLocalDateTime(promotion.scheduled_at))}"></div><div class="admin-field-v10 full"><label>URL POST / PUBLIKASI</label><input id="mp-url" type="url" maxlength="1000" value="${esc(promotion.post_url || "")}" placeholder="https://instagram.com/p/..."></div>${metrics.map(key => `<div class="admin-field-v10"><label>${labels[key]}</label><input id="mp-${key}" type="number" min="0" step="1" value="${Number(promotion[key])||0}"></div>`).join("")}<div class="admin-field-v10 full"><label>CAPTION / COPY PROMOSI</label><textarea id="mp-caption" rows="4" maxlength="5000">${esc(promotion.caption || "")}</textarea></div><div class="admin-field-v10"><label>HASHTAG</label><input id="mp-hashtags" maxlength="500" value="${esc(promotion.hashtags || "")}" placeholder="#footballculture #jerseyfantasy"></div><div class="admin-field-v10"><label>CALL TO ACTION</label><input id="mp-cta" maxlength="300" value="${esc(promotion.cta || "")}" placeholder="Baca artikel lengkap di website"></div><div class="admin-field-v10 full"><label>CATATAN</label><textarea id="mp-notes" rows="3">${esc(promotion.notes || "")}</textarea></div></div><div class="admin-actions-v10"><button class="btn btn-primary" id="mp-save">Simpan publikasi</button><button class="btn btn-ghost" id="mp-cancel">Batal</button></div></div>`;
  }

  function openPromotionForm(promotion = {}) {
    openModal(promotionForm(promotion));
    $("#mp-cancel").onclick = closeModal;
    $("#mp-save").onclick = async () => {
      try {
        const payload = { campaign_id: state.currentCampaign, article_id: $("#mp-article").value || null, platform: $("#mp-platform").value, content_format: $("#mp-format").value, status: $("#mp-status").value, scheduled_at: localDateTimeToIso($("#mp-scheduled").value), post_url: $("#mp-url").value.trim(), caption: $("#mp-caption").value.trim(), hashtags: $("#mp-hashtags").value.trim(), cta: $("#mp-cta").value.trim(), notes: $("#mp-notes").value.trim() };
        ["reach", "impressions", "likes", "comments", "shares", "saves", "profile_visits", "link_clicks"].forEach(key => payload[key] = Number($("#mp-"+key).value || 0));
        await api(`/admin/promotions${promotion.id ? `/${promotion.id}` : ""}`, promotion.id ? "PUT" : "POST", payload);
        toast("Data publikasi disimpan."); closeModal(); await loadCampaigns();
      } catch (error) { toast(error.message); }
    };
  }

  async function deletePromotion(id) {
    if (!confirm("Hapus catatan publikasi ini?")) return;
    try { await api(`/admin/promotions/${id}`, "DELETE"); toast("Publikasi dihapus."); await loadCampaigns(); }
    catch (error) { toast(error.message); }
  }

  async function loadTab(tab) {
    if (tab === "blog-studio") await loadArticles();
    if (tab === "analytics") await loadAnalytics();
    if (tab === "campaigns") { await loadArticles(); await loadCampaigns(); }
  }

  function init() {
    const nav = $("#admin-nav");
    if (!nav) return;
    nav.addEventListener("click", event => {
      const button = event.target.closest("button[data-tab]");
      if (button) setTimeout(() => loadTab(button.dataset.tab), 0);
    });
    $("#new-marketing-article")?.addEventListener("click", () => openArticleForm());
    $("#analytics-refresh")?.addEventListener("click", loadAnalytics);
    $("#analytics-days")?.addEventListener("change", loadAnalytics);
    $("#new-campaign")?.addEventListener("click", () => openCampaignForm());
    $("#edit-campaign")?.addEventListener("click", () => {
      const campaign = state.campaigns.find(x => Number(x.id) === Number(state.currentCampaign));
      if (campaign) openCampaignForm(campaign);
    });
    $("#delete-campaign")?.addEventListener("click", async () => {
      if (!state.currentCampaign || !confirm("Hapus kampanye beserta semua catatan promosinya?")) return;
      try { await api(`/admin/campaigns/${state.currentCampaign}`, "DELETE"); state.currentCampaign = null; toast("Kampanye dihapus."); await loadCampaigns(); }
      catch (error) { toast(error.message); }
    });
    $("#campaign-select")?.addEventListener("change", async event => { state.currentCampaign = Number(event.target.value) || null; renderCampaignSummary(); await loadPromotions(); });
    $("#new-promotion")?.addEventListener("click", () => state.currentCampaign ? openPromotionForm() : toast("Buat atau pilih kampanye terlebih dahulu."));
  }

  window.MarketingAdmin = { loadTab, loadArticles, loadAnalytics, loadCampaigns };
  document.addEventListener("DOMContentLoaded", init, { once: true });
})();
