function safeJsonParse(value, fallback = null) {
  try {
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeProduct(raw) {
  const rawStatus = String(raw?.rawStatus || raw?.status || "coming_soon").trim().toLowerCase().replace(/\s+/g, "_");
  const statusLabels = {
    po_open: "PO DIBUKA",
    coming_soon: "SEGERA HADIR",
    po_closed: "PO DITUTUP"
  };

  return {
    id: Number(raw.id),
    name: String(raw.name || "Unnamed Product"),
    category: String(raw.category || "Collection"),
    price: Number(raw.price || 0),
    rawStatus,
    status: statusLabels[rawStatus] || rawStatus.replaceAll("_", " ").toUpperCase(),
    image: raw.image_url || raw.image || "assets/images/hero-placeholder.png",
    description: String(raw.description || ""),
    sizes: Array.isArray(raw.sizes) && raw.sizes.length ? raw.sizes : ["S", "M", "L", "XL", "XXL"],
    production_estimate: raw.production_estimate || "14–21 hari",
    po_deadline: raw.po_deadline || null,
    featured: Boolean(raw.featured),
    gallery: Array.isArray(raw.gallery) && raw.gallery.length
      ? raw.gallery.map((item, index) => ({
          id: item.id,
          image_url: item.image_url || item.image || "",
          sort_order: Number(item.sort_order ?? index)
        })).filter(item => item.image_url)
      : (raw.image_url || raw.image ? [{ image_url: raw.image_url || raw.image, sort_order: 0 }] : [])
  };
}

async function hydrateProductsFromApi() {
  try {
    const liveProducts = await apiGet("/products");
    if (!Array.isArray(liveProducts)) throw new Error("Invalid products response.");
    PRODUCTS.splice(0, PRODUCTS.length, ...liveProducts.map(normalizeProduct));
    window.FUSBALL_PRODUCTS_SOURCE = "api";
    return true;
  } catch (error) {
    window.FUSBALL_PRODUCTS_SOURCE = "local-fallback";
    console.warn("Product API unavailable. Using local fallback data.", error);
    PRODUCTS.splice(0, PRODUCTS.length, ...PRODUCTS.map(normalizeProduct));
    return false;
  }
}

function mediaSrc(url) {
  return url || "assets/images/hero-placeholder.png";
}

const rupiah = value => new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0
}).format(Number(value) || 0);

function getProductImage(product) {
  return mediaSrc(product?.image);
}

function getStoredCart() {
  const parsed = safeJsonParse(localStorage.getItem("fusballCart"), []);
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map(item => ({
      key: String(item?.key || `${item?.productId || ""}-${item?.size || ""}`),
      productId: Number(item?.productId),
      size: String(item?.size || ""),
      quantity: Math.max(1, Number(item?.quantity) || 1)
    }))
    .filter(item => Number.isInteger(item.productId) && item.productId > 0 && item.size);
}

const cart = () => getStoredCart();
const saveCart = items => localStorage.setItem("fusballCart", JSON.stringify(items));
const cartCount = () => cart().reduce((sum, item) => sum + item.quantity, 0);

function renderHeader() {
  const target = document.querySelector("#site-header");
  if (!target) return;
  const page = document.body.dataset.page || "";
  const auth = typeof getAuth === "function" ? getAuth() : null;
  const loggedIn = Boolean(auth?.token && auth?.user);
  const isAdmin = loggedIn && auth.user.role === "admin";
  const settings = window.FUSBALL_SITE_SETTINGS || {};
  const wa = String(settings.whatsapp || "").replace(/\D/g, "");
  const chatHref = wa ? `https://wa.me/${wa}?text=${encodeURIComponent("Halo Fusball.id, saya ingin bertanya tentang jersey.")}` : "contact.html";
  const accountNav = loggedIn ? `<a class="${page === "account" ? "active" : ""}" href="account.html">Akun</a>` : `<a class="${page === "login" ? "active" : ""}" href="login.html">Masuk</a>`;
  const adminNav = isAdmin ? `<a class="${page === "admin" ? "active" : ""}" href="admin/index.html">Admin</a>` : "";
  target.innerHTML = `
    <header class="site-header">
      <div class="header-inner">
        <a class="brand" href="index.html" aria-label="Fusball.id beranda"><span class="brand-word">FUSBALL<span>.ID</span></span></a>
        <nav class="main-nav" aria-label="Navigasi utama">
          <a class="${page === "home" ? "active" : ""}" href="index.html">Beranda</a>
          <a class="${page === "shop" ? "active" : ""}" href="shop.html">Koleksi</a>
          <a class="${page === "about" ? "active" : ""}" href="about.html">Tentang</a>
          <a class="${page === "custom" ? "active" : ""}" href="custom.html">Custom</a>
          <a class="${page === "contact" ? "active" : ""}" href="contact.html">Kontak</a>
          ${accountNav}${adminNav}
        </nav>
        <div class="header-actions">
          <a class="header-cart" href="cart.html">Tas <span class="cart-count">${cartCount()}</span></a>
          <div class="header-user-tools">${loggedIn ? `<a class="header-account-link" href="account.html">${escapeHtml(String(auth.user.name || "Akun").slice(0,20))}</a><button class="header-logout" id="header-logout" type="button">Keluar</button>` : `<a class="header-login" href="login.html">Masuk</a>`}</div>
        </div>
      </div>
    </header>
    <a class="floating-chat" href="${escapeHtml(chatHref)}" ${wa ? 'target="_blank" rel="noopener"' : ''} aria-label="Chat Fusball.id"><span class="chat-pulse"></span><span>Chat</span><b>↗</b></a>`;
  document.querySelector("#header-logout")?.addEventListener("click", logout);
}

function renderFooter() {
  const target=document.querySelector("#site-footer"); if(!target)return;
  const s=window.FUSBALL_SITE_SETTINGS||{}; const wa=String(s.whatsapp||"").replace(/\D/g,"");
  target.innerHTML=`<footer class="site-footer"><div class="footer-inner"><div><strong>FUSBALL.ID</strong><p>Football culture, fantasy jersey, dan identitas tim.</p></div><div class="footer-links"><a href="about.html">Tentang Kami</a><a href="shop.html">Koleksi</a><a href="blog.html">Journal</a><a href="custom.html">Custom Tim</a><a href="contact.html">Kontak</a>${wa?`<a href="https://wa.me/${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}</div><div class="footer-bottom">© 2026 Fusball.id · Dibuat untuk mereka yang hidup di dalam football culture.</div></div></footer>`;
}

function renderChatHint(){
  const existing=document.querySelector(".chat-hint"); if(existing) existing.remove();
}

async function renderHome() {
  const title=document.querySelector("#hero-title"); if(!title)return;
  const s=window.FUSBALL_SITE_SETTINGS||{};
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val||""};
  set("hero-kicker",s.hero_kicker||siteContent.heroKicker); set("hero-description",s.hero_description||siteContent.heroDescription);
  title.innerHTML=escapeHtml(s.hero_title||siteContent.heroTitle).replace(/\r?\n/g,"<br>");
  const heroImage=document.querySelector("#hero-image"), empty=document.querySelector("#hero-empty"), frame=document.querySelector("#hero-art-card");
  try{const hero=await apiGet("/media/site/hero"); if(hero?.exists&&hero.image_url){heroImage.src=hero.image_url;heroImage.hidden=false;empty?.setAttribute("hidden","");frame?.classList.add("has-image");}else{heroImage.hidden=true;empty?.removeAttribute("hidden");frame?.classList.remove("has-image");}}catch{heroImage.hidden=true;empty?.removeAttribute("hidden");}
  const grid=document.querySelector("#featured-grid"); if(!grid)return;
  const featured=PRODUCTS.filter(p=>p.rawStatus==="po_open"&&p.featured).slice(0,4); const fallback=PRODUCTS.filter(p=>p.rawStatus==="po_open").slice(0,4); const selected=featured.length?featured:fallback.length?fallback:PRODUCTS.slice(0,4);
  grid.innerHTML=selected.length?selected.map(productCard).join(""):`<div class="empty-editorial"><span class="kicker">KOLEKSI</span><h3>Belum ada drop yang ditampilkan.</h3><p>Admin dapat menambahkan produk dari ruang pengelolaan.</p></div>`;
  const aboutTitle=document.querySelector("#home-about-title"); if(aboutTitle)aboutTitle.textContent=s.about_title||"Bukan sekadar jersey.";
  const aboutDesc=document.querySelector("#home-about-desc"); if(aboutDesc)aboutDesc.textContent=s.about_description||"Fusball.id menghubungkan football culture, desain, dan identitas.";
}

function productCard(p) {
  const gallery = Array.isArray(p.gallery) ? p.gallery.filter(x => x?.image_url).slice(0, 2) : [];
  const front = gallery[0]?.image_url || p.image;
  const back = gallery[1]?.image_url || "";
  const hasBack = Boolean(back);

  return `
    <article class="product-card v9-card reveal-on-scroll">
      <a class="product-media v9-product-media ${hasBack ? "has-back" : ""}" href="product.html?id=${encodeURIComponent(p.id)}" aria-label="View ${escapeHtml(p.name)}">
        <span class="product-status">${escapeHtml(p.status)}</span>
        <div class="product-shot product-shot-front">
          <img src="${escapeHtml(getProductImage({image: front}))}" alt="${escapeHtml(p.name)} — front" loading="lazy">
        </div>
        ${hasBack ? `
          <div class="product-shot product-shot-back">
            <img src="${escapeHtml(mediaSrc(back))}" alt="${escapeHtml(p.name)} — back" loading="lazy">
          </div>
          <span class="product-view-note">ARAHKAN · DEPAN / BELAKANG</span>` : ""}
        <span class="v9-card-arrow">↗</span>
      </a>
      <div class="product-body">
        <div class="v9-card-topline"><span>${escapeHtml(p.category)}</span><span>${hasBack ? "02 FOTO" : "01 FOTO"}</span></div>
        <a href="product.html?id=${encodeURIComponent(p.id)}" style="text-decoration:none"><h3>${escapeHtml(p.name)}</h3></a>
        <div class="product-bottom">
          <span class="price">${rupiah(p.price)}</span>
          <a class="mini-btn" href="product.html?id=${encodeURIComponent(p.id)}">Lihat produk →</a>
        </div>
      </div>
    </article>`;
}

async function renderShop() {
  const grid=document.querySelector("#shop-grid"); if(!grid)return;
  const search=document.querySelector("#shop-search"), category=document.querySelector("#shop-category"), sort=document.querySelector("#shop-sort"), status=document.querySelector("#shop-status");
  try{const cats=await apiGet("/categories"); category.innerHTML=`<option value="all">Semua kategori</option>`+cats.map(c=>`<option value="${escapeHtml(c.name)}">${escapeHtml(c.name)}</option>`).join("");}catch{}
  let timer;
  const update=async()=>{
    const q=search.value.trim(); const cat=category.value||"all"; const st=status?.value||"all"; const order=sort?.value||"newest";
    grid.classList.add("is-loading");
    try{
      const params=new URLSearchParams(); if(q)params.set("search",q); if(cat!=="all")params.set("category",cat);
      const data=await apiGet(`/products?${params.toString()}`); let list=data.map(normalizeProduct);
      if(st!=="all")list=list.filter(p=>p.rawStatus===st);
      list.sort((a,b)=>order==="price-low"?a.price-b.price:order==="price-high"?b.price-a.price:order==="name"?a.name.localeCompare(b.name):Number(b.featured)-Number(a.featured));
      PRODUCTS.splice(0,PRODUCTS.length,...list);
      grid.innerHTML=list.length?list.map(productCard).join(""):`<div class="empty-editorial"><span class="kicker">TIDAK DITEMUKAN</span><h3>Koleksi yang kamu cari belum ada.</h3><p>Coba kata kunci atau kategori lain.</p></div>`;
    }catch(error){grid.innerHTML=`<div class="empty-editorial"><h3>Koleksi belum dapat dimuat.</h3><p>${escapeHtml(error.message)}</p></div>`;}finally{grid.classList.remove("is-loading");initScrollMotion();}
  };
  search?.addEventListener("input",()=>{clearTimeout(timer);timer=setTimeout(update,220)}); category?.addEventListener("change",update); sort?.addEventListener("change",update); status?.addEventListener("change",update); await update();
}

async function renderProduct() {
  const root = document.querySelector("#product-detail");
  if (!root) return;

  const id = Number(new URLSearchParams(location.search).get("id") || 1);
  let p = PRODUCTS.find(item => item.id === id) || null;

  try {
    const live = await apiGet(`/products/${id}`);
    p = normalizeProduct(live);
  } catch {
    if (!p) {
      root.innerHTML = `<div class="form-card"><h2>Produk tidak ditemukan.</h2><p class="detail-desc">Product ini tidak tersedia.</p><a class="btn btn-primary" href="shop.html">Kembali ke Koleksi</a></div>`;
      return;
    }
  }

  const gallery = p.gallery.length ? p.gallery.map(x => x.image_url) : [p.image];
  let selectedSize = p.sizes.includes("M") ? "M" : p.sizes[0];

  root.innerHTML = `
    <div class="detail-media">
      <div class="gallery-main-wrap">
        <button class="gallery-main" id="gallery-main" type="button">
          <img id="main-product-image" src="${escapeHtml(mediaSrc(gallery[0]))}" alt="${escapeHtml(p.name)}">
          <span class="gallery-expand">↗</span>
        </button>
      </div>
      ${gallery.length > 1 ? `
        <div class="gallery-thumbs" id="gallery-thumbs">
          ${gallery.map((img, i) => `
            <button class="gallery-thumb ${i === 0 ? "selected" : ""}" type="button" data-img="${escapeHtml(mediaSrc(img))}">
              <img src="${escapeHtml(mediaSrc(img))}" alt="" loading="lazy">
            </button>`).join("")}
        </div>` : ""}
    </div>

    <div>
      <span class="detail-kicker">${escapeHtml(p.status)}</span>
      <h1>${escapeHtml(p.name)}</h1>
      <p class="detail-desc">${escapeHtml(p.description)}</p>
      <div class="detail-price">${rupiah(p.price)}</div>

      <div class="detail-specs">
        <div class="spec-card"><small>Kategori</small><strong>${escapeHtml(p.category)}</strong></div>
        <div class="spec-card"><small>Status</small><strong>${escapeHtml(p.status)}</strong></div>
        <div class="spec-card"><small>Produksi</small><strong>${escapeHtml(p.production_estimate)}</strong></div>
        <div class="spec-card"><small>Jenis Pesanan</small><strong>Pre-order</strong></div>
      </div>

      <div class="po-box">
        <strong>${escapeHtml(p.status)}</strong>
        <p>${p.rawStatus === "po_open"
          ? "Pesanan dibuka selama periode PO. Estimasi produksi mengikuti batch aktif."
          : p.rawStatus === "coming_soon"
            ? "Produk belum dibuka untuk PO. Pantau drop berikutnya."
            : "PO untuk produk ini sedang ditutup."}</p>
      </div>

      <div class="detail-block">
        <div class="detail-label">UKURAN</div>
        <div class="size-grid">${p.sizes.map(s => `<button class="size-option ${s === selectedSize ? "selected" : ""}" data-size="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join("")}</div>
      </div>

      <div class="detail-block">
        <div class="detail-label">JUMLAH</div>
        <div class="quantity-row"><input class="quantity" id="product-qty" type="number" min="1" value="1"></div>
      </div>

      <div class="detail-actions">
        <button class="btn btn-primary" id="add-cart" ${p.rawStatus !== "po_open" ? "disabled" : ""}>${p.rawStatus === "po_open" ? "Tambah ke Tas ↗" : "PO Ditutup"}</button>
        <a class="btn btn-ghost" href="custom.html">Custom untuk Tim</a>
      </div>
      <p id="add-message" class="form-message"></p>

      <div class="buy-trust">
        <div class="trust-mini"><strong>Ukuran tersedia</strong> ${p.sizes.map(escapeHtml).join(" · ")}</div>
        <div class="trust-mini"><strong>Custom tim</strong> Konsultasi tersedia</div>
        <div class="trust-mini"><strong>Pelacakan pesanan</strong> Status terlihat di akun</div>
      </div>
    </div>`;

  root.querySelectorAll(".size-option").forEach(btn => btn.addEventListener("click", () => {
    root.querySelectorAll(".size-option").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedSize = btn.dataset.size;
  }));

  root.querySelectorAll(".gallery-thumb").forEach(btn => btn.addEventListener("click", () => {
    root.querySelectorAll(".gallery-thumb").forEach(x => x.classList.remove("selected"));
    btn.classList.add("selected");
    document.querySelector("#main-product-image").src = btn.dataset.img;
  }));

  const mainButton = document.querySelector("#gallery-main");
  mainButton?.addEventListener("click", () => {
    const img = document.querySelector("#main-product-image");
    if (img) openImageLightbox(img.src, img.alt);
  });

  document.querySelector("#add-cart")?.addEventListener("click", () => {
    const quantity = Math.max(1, Number(document.querySelector("#product-qty").value || 1));
    const items = cart();
    const key = `${p.id}-${selectedSize}`;
    const existing = items.find(i => i.key === key);
    if (existing) existing.quantity += quantity;
    else items.push({ key, productId: p.id, size: selectedSize, quantity });

    saveCart(items);
    renderHeader();
    document.querySelector("#add-message").textContent = `${p.name} · size ${selectedSize} ditambahkan ke tas.`;
  });
}

function openImageLightbox(src, alt) {
  let overlay = document.querySelector("#image-lightbox");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "image-lightbox";
    overlay.className = "image-lightbox";
    overlay.innerHTML = `<button class="lightbox-close" type="button">×</button><img id="lightbox-image" alt="">`;
    document.body.appendChild(overlay);
    overlay.querySelector(".lightbox-close").addEventListener("click", () => overlay.classList.remove("open"));
    overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.remove("open"); });
  }
  const image = overlay.querySelector("#lightbox-image");
  image.src = src;
  image.alt = alt || "";
  overlay.classList.add("open");
}

function resolveCartItems() {
  return cart().map(item => ({
    item,
    product: PRODUCTS.find(p => p.id === item.productId) || null
  }));
}

function renderCart() {
  const itemsRoot = document.querySelector("#cart-items");
  const summary = document.querySelector("#cart-summary");
  if (!itemsRoot || !summary) return;

  const resolved = resolveCartItems();
  if (!resolved.length) {
    itemsRoot.innerHTML = `<div class="form-card"><h2>Tasmu masih kosong.</h2><p class="detail-desc">Belum ada fantasy jersey yang dipilih.</p><a class="btn btn-primary" href="shop.html" style="margin-top:20px">Lihat Koleksi</a></div>`;
    summary.innerHTML = `<h3>Ringkasan Pesanan</h3><p class="detail-desc">Tambahkan produk untuk melanjutkan.</p>`;
    return;
  }

  const hasInvalid = resolved.some(({ product }) => !product || product.rawStatus !== "po_open");
  itemsRoot.innerHTML = `<div class="cart-list">${resolved.map(({ item, product }, index) => {
    const unavailable = !product || product.rawStatus !== "po_open";
    const name = product?.name || `Product #${item.productId}`;
    const price = Number(product?.price || 0);
    return `
      <article class="cart-item">
        <div class="cart-thumb"><img src="${escapeHtml(getProductImage(product))}" alt="${escapeHtml(name)}"></div>
        <div>
          <div class="cart-name">${escapeHtml(name)}</div>
          <div class="cart-meta">Size ${escapeHtml(item.size)} · ${unavailable ? "Unavailable" : rupiah(price)}</div>
          ${unavailable ? `<div class="form-message">Product ini tidak lagi terbuka untuk PO. Hapus dari cart sebelum checkout.</div>` : ""}
          <div class="cart-actions">
            <button class="qty-btn" data-index="${index}" data-action="minus">−</button>
            <span>${item.quantity}</span>
            <button class="qty-btn" data-index="${index}" data-action="plus">+</button>
            <button class="remove-btn" data-index="${index}" data-action="remove">Hapus</button>
          </div>
        </div>
        <div class="cart-total">${unavailable ? "—" : rupiah(price * item.quantity)}</div>
      </article>`;
  }).join("")}</div>`;

  itemsRoot.querySelectorAll("[data-action]").forEach(btn => btn.addEventListener("click", () => {
    const current = cart();
    const resolvedIndex = Number(btn.dataset.index);
    const action = btn.dataset.action;
    if (!current[resolvedIndex]) return;
    if (action === "plus") current[resolvedIndex].quantity += 1;
    if (action === "minus") current[resolvedIndex].quantity = Math.max(1, current[resolvedIndex].quantity - 1);
    if (action === "remove") current.splice(resolvedIndex, 1);
    saveCart(current);
    renderHeader();
    renderCart();
  }));

  const subtotal = resolved.reduce((sum, { item, product }) => {
    if (!product || product.rawStatus !== "po_open") return sum;
    return sum + Number(product.price) * item.quantity;
  }, 0);

  summary.innerHTML = `
    <h3>Ringkasan Pesanan</h3>
    <div class="summary-line"><span>Subtotal</span><span>${rupiah(subtotal)}</span></div>
    <div class="summary-line"><span>Pengiriman</span><span>Dihitung kemudian</span></div>
    <div class="summary-line summary-total"><span>Total</span><span>${rupiah(subtotal)}</span></div>
    ${hasInvalid
      ? `<p class="form-message">Checkout diblokir sampai produk yang tidak tersedia dihapus dari tas.</p>`
      : `<a class="btn btn-primary" href="checkout.html">Lanjut Checkout</a>`}`;
}

function renderCheckout() {
  const root = document.querySelector("#checkout-summary");
  const form = document.querySelector("#checkout-form");
  if (!root || !form) return;

  const auth = typeof getAuth === "function" ? getAuth() : null;
  const items = cart();
  const resolved = resolveCartItems();

  if (!auth?.token) {
    root.innerHTML = `<h3>Masuk diperlukan</h3><p class="detail-desc">Masuk dulu sebelum membuat pesanan.</p><a class="btn btn-primary" href="login.html">Masuk</a>`;
    form.style.display = "none";
    return;
  }

  if (!items.length) {
    root.innerHTML = `<h3>Belum ada item.</h3><p class="detail-desc">Tas masih kosong.</p><a class="btn btn-primary" href="shop.html">Ke Koleksi</a>`;
    form.style.display = "none";
    return;
  }

  const invalid = resolved.filter(({ product, item }) => !product || product.rawStatus !== "po_open" || !product.sizes.includes(item.size));
  if (invalid.length) {
    root.innerHTML = `<h3>Tas perlu diperiksa.</h3><p class="detail-desc">Satu atau lebih item sudah tidak tersedia atau size-nya tidak valid. Kembali ke cart dan perbaiki sebelum checkout.</p><a class="btn btn-ghost" href="cart.html">Periksa Tas</a>`;
    form.style.display = "none";
    return;
  }

  const total = resolved.reduce((sum, { item, product }) => sum + Number(product.price) * item.quantity, 0);
  root.innerHTML = `
    <h3>Ringkasan Pre-order</h3>
    ${resolved.map(({ item, product }) => `<div class="summary-line"><span>${escapeHtml(product.name)} · ${escapeHtml(item.size)} ×${item.quantity}</span><span>${rupiah(product.price * item.quantity)}</span></div>`).join("")}
    <div class="summary-line summary-total"><span>Total</span><span>${rupiah(total)}</span></div>
    <p class="detail-desc">Pesanan akan masuk sebagai <b>Pending</b> dan diproses oleh admin.</p>`;

  const user = auth.user || {};
  const nameField = form.querySelector('[name="name"]');
  const emailField = form.querySelector('[name="email"]');
  if (nameField && !nameField.value) nameField.value = user.name || "";
  if (emailField && !emailField.value) emailField.value = user.email || "";

  if (!form.dataset.bound) {
    form.dataset.bound = "1";
    form.addEventListener("submit", async event => {
      event.preventDefault();

      const fd = new FormData(form);
      const message = document.querySelector("#checkout-message");
      const button = form.querySelector("button[type=submit]");
      const payload = {
        customerName: String(fd.get("name") || "").trim(),
        customerPhone: String(fd.get("phone") || "").trim(),
        customerEmail: String(fd.get("email") || "").trim().toLowerCase(),
        shippingAddress: String(fd.get("address") || "").trim(),
        paymentMethod: fd.get("payment"),
        items: items.map(item => ({ productId: item.productId, size: item.size, quantity: item.quantity }))
      };

      button.disabled = true;
      message.textContent = "Membuat pesanan…";

      try {
        const result = await apiAuth("/orders", "POST", payload);
        localStorage.removeItem("fusballCart");
        renderHeader();
        message.textContent = `${result.orderIdLabel || `Order #${result.orderId}`} berhasil dibuat.`;
        form.reset();
        setTimeout(() => { location.href = "account.html"; }, 700);
      } catch (error) {
        message.textContent = error.message;
        button.disabled = false;
      }
    });
  }
}

function bindCustom() {
  const form = document.querySelector("#custom-form");
  if (!form || form.dataset.bound) return;

  const auth = typeof getAuth === "function" ? getAuth() : null;
  const file = document.querySelector("#custom-file");
  const preview = document.querySelector("#custom-preview");
  const message = document.querySelector("#custom-message");

  form.dataset.bound = "1";

  if (!auth?.token) {
    message.textContent = "Masuk diperlukan sebelum mengirim custom request.";
    const submit = form.querySelector("button[type=submit]");
    if (submit) submit.disabled = true;
    return;
  }

  file?.addEventListener("change", () => {
    const selected = file.files?.[0];
    if (!selected) return;
    const reader = new FileReader();
    reader.onload = () => {
      preview.classList.remove("hidden");
      preview.innerHTML = `<img src="${reader.result}" alt="Reference preview">`;
    };
    reader.readAsDataURL(selected);
  });

  form.addEventListener("submit", async event => {
    event.preventDefault();
    const fd = new FormData(form);
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    message.textContent = "Mengunggah reference & mengirim request…";

    try {
      const response = await fetch(`${API_BASE}/custom-requests`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: fd
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `API ${response.status}`);

      message.textContent = `Custom request #CR-${String(data.id).padStart(4, "0")} berhasil dikirim.`;
      form.reset();
      preview.classList.add("hidden");
      preview.innerHTML = "";
      setTimeout(() => { location.href = "account.html#custom-requests"; }, 700);
    } catch (error) {
      message.textContent = error.message;
      button.disabled = false;
    }
  });
}


function initScrollMotion() {
  const items = document.querySelectorAll(".reveal-on-scroll");
  if (!items.length || !("IntersectionObserver" in window)) {
    items.forEach(item => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08, rootMargin: "0px 0px -40px" });
  items.forEach(item => observer.observe(item));
}

async function bootApp() {
  try { window.FUSBALL_SITE_SETTINGS = await apiGet("/site-settings"); } catch { window.FUSBALL_SITE_SETTINGS = {}; }
  renderHeader();
  renderFooter();

  await hydrateProductsFromApi();

  // Render again after the live catalog has been loaded so every customer-facing
  // page uses the same database-backed product source.
  renderHeader();
  renderFooter();

  switch (document.body.dataset.page) {
    case "home":
      await renderHome();
      break;
    case "shop":
      renderShop();
      break;
    case "product":
      await renderProduct();
      break;
    case "cart":
      renderCart();
      break;
    case "checkout":
      renderCheckout();
      break;
    case "custom":
      bindCustom();
      break;
    default:
      break;
  }

  initScrollMotion();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootApp, { once: true });
} else {
  bootApp();
}
