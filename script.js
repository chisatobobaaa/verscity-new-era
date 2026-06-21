(function () {
  const body = document.body;
  const configuredHost = (body.dataset.serverHost || "").trim();
  const configuredPort = (body.dataset.serverPort || "7777").trim() || "7777";
  const host = configuredHost || "127.0.0.1";
  let serverAddress = `${host}:${configuredPort}`;
  const toast = document.querySelector("[data-toast]");
  const menuToggle = document.querySelector(".menu-toggle");
  const navLinks = document.querySelectorAll(".nav-links a");
  let toastTimer = 0;
  const staffStorageKey = "verscity.staff.list";
  const donationStorageKey = "verscity.donation.packages";
  const vehicleCategoryPhotoStorageKey = "verscity.vehicle.category.photos";
  const adminSessionKey = "verscity.admin.loggedIn";
  const siteDataState = {
    staff: null,
    donationPackages: null,
    vehicleCategoryPhotos: null,
    orders: null
  };

  const defaultStaff = [
    {
      id: "owner",
      rank: "Owner",
      name: "Verscity Owner",
      description: "Penanggung jawab utama server, arah development, dan keputusan besar komunitas.",
      status: "online",
      initials: "VC",
      photo: ""
    },
    {
      id: "head-admin",
      rank: "Head Admin",
      name: "Head Administrator",
      description: "Mengatur tim admin, validasi report besar, dan menjaga standar roleplay server.",
      status: "standby",
      initials: "HD",
      photo: ""
    },
    {
      id: "admin",
      rank: "Admin",
      name: "Administrator",
      description: "Menangani report player, bantuan teknis, pengawasan kota, dan penindakan rules.",
      status: "online",
      initials: "AD",
      photo: ""
    },
    {
      id: "moderator",
      rank: "Moderator",
      name: "Moderator",
      description: "Membantu pengawasan Discord, laporan ringan, dan koordinasi kebutuhan player baru.",
      status: "standby",
      initials: "MD",
      photo: ""
    },
    {
      id: "helper",
      rank: "Helper",
      name: "Helper",
      description: "Membantu player baru memahami UCP, command dasar, job, dan alur masuk kota.",
      status: "offline",
      initials: "HP",
      photo: ""
    },
    {
      id: "event-team",
      rank: "Event Team",
      name: "Event Organizer",
      description: "Menyiapkan event komunitas, aktivitas kota, dan scene yang melibatkan banyak player.",
      status: "standby",
      initials: "EV",
      photo: ""
    }
  ];

  const defaultDonationPackages = [
    { id: "vip-silver", group: "vip", tier: "VIP Basic", name: "VIP Silver", price: "Rp35.000", benefits: ["Role Discord VIP Silver", "Custom tag basic", "Priority bantuan ticket"], featured: false, photo: "", photoClass: "" },
    { id: "vip-gold", group: "vip", tier: "Popular", name: "VIP Gold", price: "Rp65.000", benefits: ["Role Discord VIP Gold", "Custom tag premium", "Bonus item kosmetik", "Priority event slot"], featured: true, photo: "", photoClass: "" },
    { id: "vip-platinum", group: "vip", tier: "VIP Elite", name: "VIP Platinum", price: "Rp100.000", benefits: ["Role Discord VIP Platinum", "Custom tag elite", "Nama masuk list supporter", "Bonus kosmetik eksklusif"], featured: false, photo: "", photoClass: "" },
    { id: "apartment-starter", group: "apartments", tier: "Apartment", name: "Starter Room", price: "Rp30.000", benefits: ["Unit apartment basic", "Akses storage standar", "Masa aktif sesuai rules server"], featured: false, photo: "", photoClass: "" },
    { id: "apartment-premium", group: "apartments", tier: "Apartment", name: "Premium Room", price: "Rp60.000", benefits: ["Unit apartment premium", "Interior lebih nyaman", "Akses storage lebih besar"], featured: true, photo: "", photoClass: "" },
    { id: "apartment-suite", group: "apartments", tier: "Apartment", name: "Suite Room", price: "Rp90.000", benefits: ["Unit apartment suite", "Interior pilihan sesuai stock", "Prioritas lokasi jika tersedia"], featured: false, photo: "", photoClass: "" },
    { id: "house-small", group: "house", tier: "House", name: "Small House", price: "Rp80.000", benefits: ["Rumah kecil sesuai slot tersedia", "Interior basic", "Storage rumah standar"], featured: false, photo: "", photoClass: "" },
    { id: "house-medium", group: "house", tier: "House", name: "Medium House", price: "Rp150.000", benefits: ["Rumah menengah sesuai slot tersedia", "Interior premium", "Storage lebih besar"], featured: true, photo: "", photoClass: "" },
    { id: "house-luxury", group: "house", tier: "House", name: "Luxury House", price: "Rp250.000", benefits: ["Rumah luxury sesuai approval", "Interior pilihan", "Lokasi dibahas lewat ticket"], featured: false, photo: "", photoClass: "" },
    { id: "bisnis-small", group: "bisnis", tier: "Business", name: "Small Business", price: "Rp100.000", benefits: ["Bisnis kecil sesuai sistem server", "Nama bisnis custom", "Setup awal oleh staff"], featured: false, photo: "", photoClass: "" },
    { id: "bisnis-premium", group: "bisnis", tier: "Business", name: "Premium Business", price: "Rp200.000", benefits: ["Bisnis premium sesuai approval", "Nama dan konsep bisnis custom", "Prioritas lokasi jika tersedia"], featured: true, photo: "", photoClass: "" },
    { id: "bisnis-partner", group: "bisnis", tier: "Business", name: "Partner Brand", price: "Rp300.000", benefits: ["Konsep bisnis dibahas dengan owner", "Branding dan label custom", "Rules ekonomi tetap mengikuti server"], featured: false, photo: "", photoClass: "" },
    { id: "lainnya-tag", group: "lainnya", tier: "Custom", name: "Custom Tag", price: "Rp20.000", benefits: ["Tag custom sesuai rules", "Warna tag dibahas lewat ticket", "Tidak boleh menyerupai staff"], featured: false, photo: "", photoClass: "" },
    { id: "lainnya-number", group: "lainnya", tier: "Custom", name: "Custom Number", price: "Rp25.000", benefits: ["Nomor pilihan jika tersedia", "Validasi oleh staff", "Tidak boleh mengandung konten terlarang"], featured: true, photo: "", photoClass: "" },
    { id: "lainnya-request", group: "lainnya", tier: "Request", name: "Special Request", price: "Ticket", benefits: ["Request item kosmetik", "Request mapping kecil", "Harga dan approval lewat owner"], featured: false, photo: "", photoClass: "" },
    { id: "motor-nrg", group: "vehicles-motor", tier: "Sport", name: "NRG-500", price: "Rp40.000", benefits: ["Motor sport cepat", "Warna custom", "Plat custom singkat"], featured: false, photo: "", photoClass: "vehicle-motor-1" },
    { id: "motor-pcj", group: "vehicles-motor", tier: "Street", name: "PCJ-600", price: "Rp35.000", benefits: ["Motor street sport", "Handling normal server", "Warna custom"], featured: true, photo: "", photoClass: "vehicle-motor-2" },
    { id: "motor-faggio", group: "vehicles-motor", tier: "City", name: "Faggio", price: "Rp20.000", benefits: ["Motor santai kota", "Cocok untuk roleplay sipil", "Warna custom"], featured: false, photo: "", photoClass: "vehicle-motor-3" },
    { id: "mobil-elegy", group: "vehicles-mobil", tier: "Tuner", name: "Elegy", price: "Rp75.000", benefits: ["Mobil tuner street", "Warna dan basic tuning", "Plat custom"], featured: false, photo: "", photoClass: "vehicle-car-1" },
    { id: "mobil-infernus", group: "vehicles-mobil", tier: "Sport", name: "Infernus", price: "Rp150.000", benefits: ["Mobil sport rare", "Approval owner", "Handling tetap rules server"], featured: true, photo: "", photoClass: "vehicle-car-2" },
    { id: "mobil-sultan", group: "vehicles-mobil", tier: "Sedan", name: "Sultan", price: "Rp100.000", benefits: ["Sedan sporty 4 pintu", "Cocok untuk family/business", "Warna custom"], featured: false, photo: "", photoClass: "vehicle-car-3" },
    { id: "kapal-speeder", group: "vehicles-kapal", tier: "Boat", name: "Speeder", price: "Rp85.000", benefits: ["Speed boat compact", "Cocok untuk scene marina", "Warna custom"], featured: false, photo: "", photoClass: "vehicle-boat-1" },
    { id: "kapal-jetmax", group: "vehicles-kapal", tier: "Boat", name: "Jetmax", price: "Rp130.000", benefits: ["Boat cepat premium", "Approval staff", "Warna custom"], featured: true, photo: "", photoClass: "vehicle-boat-2" },
    { id: "kapal-dinghy", group: "vehicles-kapal", tier: "Boat", name: "Dinghy", price: "Rp60.000", benefits: ["Boat kecil fleksibel", "Cocok untuk roleplay rescue", "Warna custom"], featured: false, photo: "", photoClass: "vehicle-boat-3" },
    { id: "pesawat-dodo", group: "vehicles-pesawat", tier: "Plane", name: "Dodo", price: "Rp180.000", benefits: ["Pesawat kecil sipil", "Approval owner", "Rules terbang berlaku"], featured: false, photo: "", photoClass: "vehicle-air-1" },
    { id: "pesawat-shamal", group: "vehicles-pesawat", tier: "Jet", name: "Shamal", price: "Rp300.000", benefits: ["Private jet premium", "Approval owner wajib", "Hanya untuk roleplay tertentu"], featured: true, photo: "", photoClass: "vehicle-air-2" },
    { id: "pesawat-maverick", group: "vehicles-pesawat", tier: "Helicopter", name: "Maverick", price: "Rp250.000", benefits: ["Helikopter sipil", "Approval staff/owner", "Rules terbang berlaku"], featured: false, photo: "", photoClass: "vehicle-air-3" }
  ];

  const defaultVehicleCategoryPhotos = [
    { id: "motor", label: "Motor", photo: "", photoClass: "photo-motor" },
    { id: "mobil", label: "Mobil", photo: "", photoClass: "photo-car" },
    { id: "kapal", label: "Kapal", photo: "", photoClass: "photo-boat" },
    { id: "pesawat", label: "Pesawat/Helikopter", photo: "", photoClass: "photo-aircraft" }
  ];

  function setServerAddress(nextHost, nextPort) {
    const cleanHost = String(nextHost || host || "127.0.0.1").trim();
    const cleanPort = String(nextPort || configuredPort || "7777").trim();
    serverAddress = `${cleanHost}:${cleanPort}`;

    document.querySelectorAll("[data-ip-label]").forEach((label) => {
      label.textContent = serverAddress;
    });

    document.querySelectorAll('a[href^="samp://"]').forEach((link) => {
      link.href = `samp://${serverAddress}`;
    });
  }

  setServerAddress(host, configuredPort);

  async function refreshServerStatus() {
    if (!window.location.protocol.startsWith("http")) return;

    try {
      const response = await fetch("/api/server-status", { cache: "no-store" });
      if (!response.ok) return;
      const status = await response.json();
      const maxplayers = Number(status.maxplayers || 250);
      const players = Number(status.players || 0);
      setServerAddress(status.host || host, status.port || configuredPort);

      document.querySelectorAll(".server-panel").forEach((panel) => {
        const label = panel.querySelector(".panel-header span:last-child");
        const dot = panel.querySelector(".status-dot");
        const maxPlayerText = panel.querySelector("[data-server-maxplayers]");
        const playersText = panel.querySelector("[data-server-players]");

        if (label) label.textContent = status.online ? "SA-MP Query Aktif" : "SA-MP Offline";
        if (dot) dot.classList.toggle("offline", !status.online);
        if (maxPlayerText) maxPlayerText.textContent = String(maxplayers);
        if (playersText) playersText.textContent = `${players}/${maxplayers}`;
      });
    } catch (error) {
      document.querySelectorAll(".server-panel").forEach((panel) => {
        const label = panel.querySelector(".panel-header span:last-child");
        const dot = panel.querySelector(".status-dot");
        if (label) label.textContent = "Status tidak realtime";
        if (dot) dot.classList.add("offline");
      });
    }
  }

  function showToast(message, duration = 2200) {
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), duration);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function makeInitials(name) {
    return String(name || "ST")
      .trim()
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "ST";
  }

  function normalizeStaffList(list) {
    return list.map((staff, index) => ({
      ...defaultStaff[index % defaultStaff.length],
      ...staff,
      initials: staff.initials || makeInitials(staff.name)
    }));
  }

  function normalizeDonationPackages(list) {
    return list.map((item) => {
      const defaultItem = defaultDonationPackages.find((pkg) => pkg.id === item.id) || {};
      return {
        ...defaultItem,
        ...item,
        benefits: Array.isArray(item.benefits) ? item.benefits : String(item.benefits || "").split("\n").filter(Boolean)
      };
    });
  }

  function normalizeVehicleCategoryPhotos(list) {
    return defaultVehicleCategoryPhotos.map((defaultPhoto) => ({
      ...defaultPhoto,
      ...(list.find((item) => item.id === defaultPhoto.id) || {})
    }));
  }

  function getStaffList() {
    if (Array.isArray(siteDataState.staff) && siteDataState.staff.length) {
      return normalizeStaffList(siteDataState.staff);
    }

    try {
      const stored = JSON.parse(localStorage.getItem(staffStorageKey));
      if (Array.isArray(stored) && stored.length) {
        return normalizeStaffList(stored);
      }
    } catch (error) {
      localStorage.removeItem(staffStorageKey);
    }

    return defaultStaff.map((staff) => ({ ...staff }));
  }

  async function saveStaffList(staffList) {
    siteDataState.staff = staffList;
    localStorage.setItem(staffStorageKey, JSON.stringify(staffList));
    await saveGlobalSiteData();
  }

  function getDonationPackages() {
    if (Array.isArray(siteDataState.donationPackages) && siteDataState.donationPackages.length) {
      return normalizeDonationPackages(siteDataState.donationPackages);
    }

    try {
      const stored = JSON.parse(localStorage.getItem(donationStorageKey));
      if (Array.isArray(stored) && stored.length) {
        return normalizeDonationPackages(stored);
      }
    } catch (error) {
      localStorage.removeItem(donationStorageKey);
    }

    return defaultDonationPackages.map((item) => ({ ...item, benefits: [...item.benefits] }));
  }

  async function saveDonationPackages(packages) {
    siteDataState.donationPackages = packages;
    localStorage.setItem(donationStorageKey, JSON.stringify(packages));
    await saveGlobalSiteData();
  }

  function getVehicleCategoryPhotos() {
    if (Array.isArray(siteDataState.vehicleCategoryPhotos) && siteDataState.vehicleCategoryPhotos.length) {
      return normalizeVehicleCategoryPhotos(siteDataState.vehicleCategoryPhotos);
    }

    try {
      const stored = JSON.parse(localStorage.getItem(vehicleCategoryPhotoStorageKey));
      if (Array.isArray(stored) && stored.length) {
        return normalizeVehicleCategoryPhotos(stored);
      }
    } catch (error) {
      localStorage.removeItem(vehicleCategoryPhotoStorageKey);
    }

    return defaultVehicleCategoryPhotos.map((item) => ({ ...item }));
  }

  async function saveVehicleCategoryPhotos(categories) {
    siteDataState.vehicleCategoryPhotos = categories;
    localStorage.setItem(vehicleCategoryPhotoStorageKey, JSON.stringify(categories));
    await saveGlobalSiteData();
  }

  async function loadGlobalSiteData() {
    if (!window.location.protocol.startsWith("http")) return;

    try {
      const response = await fetch("/api/admin-data", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json();
      const data = payload.data || {};

      if (Array.isArray(data.staff) && data.staff.length) {
        siteDataState.staff = data.staff;
      }
      if (Array.isArray(data.donationPackages) && data.donationPackages.length) {
        siteDataState.donationPackages = data.donationPackages;
      }
      if (Array.isArray(data.vehicleCategoryPhotos) && data.vehicleCategoryPhotos.length) {
        siteDataState.vehicleCategoryPhotos = data.vehicleCategoryPhotos;
      }
      if (Array.isArray(data.orders)) {
        siteDataState.orders = data.orders;
      }
    } catch (error) {
      showToast("Data global belum tersambung, memakai data lokal.", 3200);
    }
  }

  async function saveGlobalSiteData() {
    if (!window.location.protocol.startsWith("http")) return true;

    const payload = {
      data: {
        staff: getStaffList(),
        donationPackages: getDonationPackages(),
        vehicleCategoryPhotos: getVehicleCategoryPhotos(),
        orders: Array.isArray(siteDataState.orders) ? siteDataState.orders : []
      }
    };

    const response = await fetch("/api/admin-data", {
      method: "PUT",
      credentials: "same-origin",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const result = await response.json().catch(() => ({}));
      throw new Error(result.error || "Gagal menyimpan data global");
    }

    return true;
  }

  function applyVehicleCategoryPhoto(element, category) {
    if (!element || !category) return;
    const previewClass = element.hasAttribute("data-vehicle-category-preview") ? "vehicle-preview admin-vehicle-category-photo" : "vehicle-preview";
    element.className = `${previewClass} ${category.photo ? "custom-photo" : escapeHtml(category.photoClass || "")}`.trim();
    element.style.backgroundImage = "";
    element.innerHTML = category.photo ? `<img src="${escapeHtml(category.photo)}" alt="${escapeHtml(category.label)}">` : "";
  }

  function renderVehicleCategoryPhotos() {
    const categoryPhotos = getVehicleCategoryPhotos();
    document.querySelectorAll("[data-vehicle-category-photo]").forEach((element) => {
      const category = categoryPhotos.find((item) => item.id === element.dataset.vehicleCategoryPhoto);
      applyVehicleCategoryPhoto(element, category);
    });
  }

  function renderBenefitList(benefits) {
    return (benefits || []).map((benefit) => `<li>${escapeHtml(benefit)}</li>`).join("");
  }

  function renderDonationPhoto(pkg, isVehiclePage = false) {
    if (pkg.photo) {
      const photoClass = isVehiclePage ? "vehicle-photo custom-photo" : "vehicle-photo donation-card-photo custom-photo";
      return `<div class="${photoClass}"><img src="${escapeHtml(pkg.photo)}" alt="${escapeHtml(pkg.name)}"></div>`;
    }
    if (pkg.photoClass) {
      return `<div class="vehicle-photo ${escapeHtml(pkg.photoClass)}"></div>`;
    }
    return "";
  }

  function renderDonationPackage(pkg, isVehiclePage) {
    const cardClass = `${isVehiclePage ? "vehicle-card" : "donation-card"}${pkg.featured ? " featured" : ""}`;
    const buttonClass = pkg.featured ? "button button-primary" : "button button-ghost";
    const photo = isVehiclePage || pkg.photo ? renderDonationPhoto(pkg, isVehiclePage) : "";

    return `
      <article class="${cardClass}">
        ${photo}
        <span class="donation-tier">${escapeHtml(pkg.tier)}</span>
        <h3>${escapeHtml(pkg.name)}</h3>
        <p class="donation-price">${escapeHtml(pkg.price)}</p>
        <ul>${renderBenefitList(pkg.benefits)}</ul>
        <a class="${buttonClass}" href="checkout.html?package=${encodeURIComponent(pkg.id)}">Checkout</a>
      </article>
    `;
  }

  function renderDonationPage() {
    const pageGroupMap = {
      "donation-vip.html": "vip",
      "donation-apartments.html": "apartments",
      "donation-house.html": "house",
      "donation-bisnis.html": "bisnis",
      "donation-lainnya.html": "lainnya",
      "vehicles-motor.html": "vehicles-motor",
      "vehicles-mobil.html": "vehicles-mobil",
      "vehicles-kapal.html": "vehicles-kapal",
      "vehicles-pesawat.html": "vehicles-pesawat"
    };

    const pageName = window.location.pathname.split("/").pop() || "index.html";
    const group = pageGroupMap[pageName];
    if (!group) return;

    const isVehiclePage = group.startsWith("vehicles-");
    const grid = document.querySelector(isVehiclePage ? ".vehicle-list-grid" : ".donation-grid");
    if (!grid) return;

    const packages = getDonationPackages().filter((pkg) => pkg.group === group);
    grid.innerHTML = packages.map((pkg) => renderDonationPackage(pkg, isVehiclePage)).join("");
  }

  function renderAvatar(staff, extraClass = "") {
    const classes = `staff-avatar ${extraClass}`.trim();
    if (staff.photo) {
      return `<img class="${classes}" src="${escapeHtml(staff.photo)}" alt="${escapeHtml(staff.name)}">`;
    }
    return `<div class="${classes}">${escapeHtml(staff.initials || makeInitials(staff.name))}</div>`;
  }

  function renderStaffList() {
    const staffGrid = document.querySelector("[data-staff-grid]");
    if (!staffGrid) return;

    staffGrid.innerHTML = getStaffList()
      .map((staff) => {
        const ownerClass = staff.id === "owner" ? " owner" : "";
        const status = staff.status || "standby";
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

        return `
          <article class="staff-card${ownerClass}">
            ${renderAvatar(staff)}
            <div class="staff-info">
              <span class="staff-role">${escapeHtml(staff.rank)}</span>
              <h3>${escapeHtml(staff.name)}</h3>
              <p>${escapeHtml(staff.description)}</p>
            </div>
            <span class="staff-status ${escapeHtml(status)}">${escapeHtml(statusLabel)}</span>
          </article>
        `;
      })
      .join("");
  }

  function findCheckoutPackage() {
    const params = new URLSearchParams(window.location.search);
    const packageId = params.get("package") || "";
    return getDonationPackages().find((pkg) => pkg.id === packageId) || null;
  }

  function initCheckoutPage() {
    const checkoutForm = document.querySelector("[data-checkout-form]");
    const checkoutSummary = document.querySelector("[data-checkout-summary]");
    const checkoutResult = document.querySelector("[data-checkout-result]");
    if (!checkoutForm || !checkoutSummary) return;

    const pkg = findCheckoutPackage();
    if (!pkg) {
      checkoutForm.classList.add("hidden");
      checkoutSummary.innerHTML = `
        <p class="eyebrow">Paket tidak ditemukan</p>
        <h2>Pilih ulang paket donation</h2>
        <p class="muted-text">Paket ini tidak tersedia atau link checkout tidak lengkap.</p>
        <a class="button button-primary" href="donation.html">Kembali ke Donation</a>
      `;
      return;
    }

    checkoutForm.elements.packageId.value = pkg.id;
    checkoutSummary.innerHTML = `
      <p class="eyebrow">${escapeHtml(pkg.tier)}</p>
      <h2>${escapeHtml(pkg.name)}</h2>
      <p class="donation-price">${escapeHtml(pkg.price)}</p>
      <ul>${renderBenefitList(pkg.benefits)}</ul>
    `;

    checkoutForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const submitButton = checkoutForm.querySelector("button[type='submit']");
      const payload = {
        packageId: checkoutForm.elements.packageId.value,
        packageName: pkg.name,
        packageGroup: pkg.group,
        tier: pkg.tier,
        price: pkg.price,
        buyerName: checkoutForm.elements.buyerName.value,
        whatsapp: checkoutForm.elements.whatsapp.value,
        discord: checkoutForm.elements.discord.value,
        characterName: checkoutForm.elements.characterName.value,
        note: checkoutForm.elements.note.value
      };

      submitButton.disabled = true;
      submitButton.textContent = "Membuat order...";
      if (checkoutResult) checkoutResult.textContent = "";

      try {
        const response = await fetch("/api/checkout", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Checkout gagal.");
        }

        checkoutForm.reset();
        checkoutForm.elements.packageId.value = pkg.id;
        if (checkoutResult) {
          checkoutResult.innerHTML = `Order <strong>${escapeHtml(result.order.id)}</strong> berhasil dibuat. Admin akan memproses order kamu.`;
        }
        showToast("Order checkout berhasil dibuat.");
      } catch (error) {
        if (checkoutResult) checkoutResult.textContent = error.message;
        showToast(error.message, 3600);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "Buat Order";
      }
    });
  }

  function orderStatusLabel(status) {
    return {
      pending: "Pending",
      paid: "Paid",
      processing: "Processing",
      done: "Done",
      cancelled: "Cancelled"
    }[status] || status;
  }

  function renderOrders(orders) {
    const orderList = document.querySelector("[data-order-list]");
    if (!orderList) return;

    if (!orders.length) {
      orderList.innerHTML = `<p class="muted-text">Belum ada order checkout.</p>`;
      return;
    }

    orderList.innerHTML = orders.map((order) => `
      <article class="order-card" data-order-id="${escapeHtml(order.id)}">
        <div class="order-card-head">
          <div>
            <span class="donation-tier">${escapeHtml(orderStatusLabel(order.status))}</span>
            <h3>${escapeHtml(order.packageName)}</h3>
            <p>${escapeHtml(order.id)} - ${escapeHtml(order.price)}</p>
          </div>
          <select data-order-status>
            ${["pending", "paid", "processing", "done", "cancelled"].map((status) => (
              `<option value="${status}"${order.status === status ? " selected" : ""}>${orderStatusLabel(status)}</option>`
            )).join("")}
          </select>
        </div>
        <dl class="order-meta">
          <div><dt>Pembeli</dt><dd>${escapeHtml(order.buyerName)}</dd></div>
          <div><dt>WhatsApp</dt><dd>${escapeHtml(order.whatsapp)}</dd></div>
          <div><dt>Discord</dt><dd>${escapeHtml(order.discord || "-")}</dd></div>
          <div><dt>Karakter</dt><dd>${escapeHtml(order.characterName)}</dd></div>
          <div><dt>Dibuat</dt><dd>${escapeHtml(new Date(order.createdAt).toLocaleString("id-ID"))}</dd></div>
        </dl>
        ${order.note ? `<p class="order-note">${escapeHtml(order.note)}</p>` : ""}
      </article>
    `).join("");
  }

  async function fetchOrders() {
    const response = await fetch("/api/orders", {
      credentials: "same-origin",
      cache: "no-store"
    });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Gagal mengambil order.");
    }
    return result.orders || [];
  }

  async function initAdminPanelPage() {
    const loginForm = document.querySelector("[data-admin-panel-login]");
    const panel = document.querySelector("[data-admin-order-panel]");
    const refreshButton = document.querySelector("[data-refresh-orders]");
    const logoutButton = document.querySelector("[data-admin-panel-logout]");
    const orderList = document.querySelector("[data-order-list]");
    if (!loginForm || !panel || !orderList) return;

    async function loadOrders() {
      try {
        renderOrders(await fetchOrders());
      } catch (error) {
        orderList.innerHTML = `<p class="muted-text">${escapeHtml(error.message)}</p>`;
      }
    }

    function setPanelState() {
      const loggedIn = sessionStorage.getItem(adminSessionKey) === "true";
      loginForm.classList.toggle("hidden", loggedIn);
      panel.classList.toggle("hidden", !loggedIn);
      if (loggedIn) loadOrders();
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        const response = await fetch("/api/admin-login", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            username: loginForm.elements.username.value.trim(),
            password: loginForm.elements.password.value
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Login gagal.");
        }

        sessionStorage.setItem(adminSessionKey, "true");
        loginForm.reset();
        setPanelState();
        showToast("Login admin berhasil.");
      } catch (error) {
        showToast(error.message, 3600);
      }
    });

    refreshButton?.addEventListener("click", loadOrders);

    logoutButton?.addEventListener("click", async () => {
      await fetch("/api/admin-logout", { method: "POST", credentials: "same-origin" }).catch(() => {});
      sessionStorage.removeItem(adminSessionKey);
      setPanelState();
      showToast("Logout berhasil.");
    });

    orderList.addEventListener("change", async (event) => {
      const select = event.target.closest("[data-order-status]");
      if (!select) return;
      const card = select.closest("[data-order-id]");
      try {
        const response = await fetch("/api/orders", {
          method: "PUT",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            orderId: card.dataset.orderId,
            status: select.value
          })
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Gagal mengubah status.");
        }
        showToast("Status order diperbarui.");
        await loadOrders();
      } catch (error) {
        showToast(error.message, 3600);
        await loadOrders();
      }
    });

    setPanelState();
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(reader.result));
      reader.addEventListener("error", reject);
      reader.readAsDataURL(file);
    });
  }

  async function makeResizedPhoto(file, maxSize = 512) {
    const source = await readFileAsDataUrl(file);
    const image = new Image();
    await new Promise((resolve, reject) => {
      image.addEventListener("load", resolve, { once: true });
      image.addEventListener("error", reject, { once: true });
      image.src = source;
    });

    const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.84);
  }

  function makeStaffPhoto(file) {
    return makeResizedPhoto(file, 512);
  }

  function makeDonationPhoto(file) {
    return makeResizedPhoto(file, 1400);
  }

  function initStaffAdmin() {
    const loginForm = document.querySelector("[data-login-form]");
    const staffForm = document.querySelector("[data-staff-form]");
    const staffSelect = document.querySelector("[data-staff-select]");
    const donationForm = document.querySelector("[data-donation-form]");
    const donationSelect = document.querySelector("[data-donation-select]");
    const vehicleCategoryForm = document.querySelector("[data-vehicle-category-form]");
    const vehicleCategorySelect = document.querySelector("[data-vehicle-category-select]");
    if (!loginForm || !staffForm || !staffSelect) return;

    const previewName = document.querySelector("[data-admin-preview-name]");
    const previewRank = document.querySelector("[data-admin-preview-rank]");
    const logoutButton = document.querySelector("[data-admin-logout]");
    const resetButton = document.querySelector("[data-reset-staff]");
    const removePhotoButton = document.querySelector("[data-remove-photo]");
    const donationPreviewName = document.querySelector("[data-donation-preview-name]");
    const donationPreviewMeta = document.querySelector("[data-donation-preview-meta]");
    const addDonationButton = document.querySelector("[data-add-donation]");
    const deleteDonationButton = document.querySelector("[data-delete-donation]");
    const resetDonationButton = document.querySelector("[data-reset-donation]");
    const removeDonationPhotoButton = document.querySelector("[data-remove-donation-photo]");
    const vehicleCategoryPreview = document.querySelector("[data-vehicle-category-preview]");
    const vehicleCategoryPreviewName = document.querySelector("[data-vehicle-category-preview-name]");
    const removeVehicleCategoryPhotoButton = document.querySelector("[data-remove-vehicle-category-photo]");
    const resetVehicleCategoryPhotoButton = document.querySelector("[data-reset-vehicle-category-photo]");
    let staffList = getStaffList();
    let donationPackages = getDonationPackages();
    let vehicleCategoryPhotos = getVehicleCategoryPhotos();
    let activePhoto = "";
    let activeDonationPhoto = "";
    let activeVehicleCategoryPhoto = "";

    function setPanelState() {
      const loggedIn = sessionStorage.getItem(adminSessionKey) === "true";
      loginForm.classList.toggle("hidden", loggedIn);
      staffForm.classList.toggle("hidden", !loggedIn);
      if (donationForm) donationForm.classList.toggle("hidden", !loggedIn);
      if (vehicleCategoryForm) vehicleCategoryForm.classList.toggle("hidden", !loggedIn);
    }

    function fillStaffOptions() {
      staffSelect.innerHTML = staffList
        .map((staff) => `<option value="${escapeHtml(staff.id)}">${escapeHtml(staff.rank)} - ${escapeHtml(staff.name)}</option>`)
        .join("");
    }

    function groupLabel(group) {
      return {
        vip: "VIP",
        apartments: "Apartments",
        house: "House",
        bisnis: "Bisnis",
        lainnya: "Lainnya",
        "vehicles-motor": "Vehicles - Motor",
        "vehicles-mobil": "Vehicles - Mobil",
        "vehicles-kapal": "Vehicles - Kapal",
        "vehicles-pesawat": "Vehicles - Pesawat/Helikopter"
      }[group] || group;
    }

    function fillDonationOptions() {
      if (!donationSelect) return;
      donationSelect.innerHTML = donationPackages
        .map((pkg) => `<option value="${escapeHtml(pkg.id)}">${escapeHtml(groupLabel(pkg.group))} - ${escapeHtml(pkg.name)}</option>`)
        .join("");
    }

    function fillVehicleCategoryOptions() {
      if (!vehicleCategorySelect) return;
      vehicleCategorySelect.innerHTML = vehicleCategoryPhotos
        .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.label)}</option>`)
        .join("");
    }

    function updatePreview(staff) {
      const initials = staff.initials || makeInitials(staff.name);
      const avatarPreview = document.querySelector("[data-admin-avatar]");
      if (!avatarPreview) return;

      if (staff.photo) {
        avatarPreview.outerHTML = `<img class="staff-avatar admin-avatar" data-admin-avatar src="${escapeHtml(staff.photo)}" alt="${escapeHtml(staff.name)}">`;
      } else {
        avatarPreview.outerHTML = `<div class="staff-avatar admin-avatar" data-admin-avatar>${escapeHtml(initials)}</div>`;
      }
      previewName.textContent = staff.name;
      previewRank.textContent = staff.rank;
    }

    function fillStaffForm() {
      const selectedId = staffSelect.value || staffList[0].id;
      const staff = staffList.find((item) => item.id === selectedId) || staffList[0];
      staffForm.elements.name.value = staff.name;
      staffForm.elements.rank.value = staff.rank;
      staffForm.elements.status.value = staff.status;
      staffForm.elements.description.value = staff.description;
      staffForm.elements.photo.value = "";
      activePhoto = staff.photo || "";
      updatePreview(staff);
    }

    function updateDonationPreview(pkg) {
      const photoPreview = document.querySelector("[data-donation-preview-photo]");
      if (photoPreview) {
        photoPreview.className = `vehicle-photo admin-donation-photo ${pkg.photo ? "custom-photo" : escapeHtml(pkg.photoClass || "")}`.trim();
        photoPreview.style.backgroundImage = "";
        photoPreview.innerHTML = pkg.photo ? `<img src="${escapeHtml(pkg.photo)}" alt="${escapeHtml(pkg.name)}">` : "";
      }
      if (donationPreviewName) donationPreviewName.textContent = pkg.name;
      if (donationPreviewMeta) donationPreviewMeta.textContent = `${pkg.tier} - ${pkg.price}`;
    }

    function fillDonationForm() {
      if (!donationForm || !donationSelect) return;
      const selectedId = donationSelect.value || donationPackages[0].id;
      const pkg = donationPackages.find((item) => item.id === selectedId) || donationPackages[0];
      donationForm.elements.group.value = pkg.group;
      donationForm.elements.tier.value = pkg.tier;
      donationForm.elements.name.value = pkg.name;
      donationForm.elements.price.value = pkg.price;
      donationForm.elements.benefits.value = (pkg.benefits || []).join("\n");
      donationForm.elements.featured.checked = Boolean(pkg.featured);
      donationForm.elements.photo.value = "";
      activeDonationPhoto = pkg.photo || "";
      updateDonationPreview(pkg);
    }

    function updateVehicleCategoryPreview(category) {
      applyVehicleCategoryPhoto(vehicleCategoryPreview, category);
      if (vehicleCategoryPreviewName) vehicleCategoryPreviewName.textContent = category.label;
    }

    function fillVehicleCategoryForm() {
      if (!vehicleCategoryForm || !vehicleCategorySelect) return;
      const selectedId = vehicleCategorySelect.value || vehicleCategoryPhotos[0].id;
      const category = vehicleCategoryPhotos.find((item) => item.id === selectedId) || vehicleCategoryPhotos[0];
      vehicleCategoryForm.elements.photo.value = "";
      activeVehicleCategoryPhoto = category.photo || "";
      updateVehicleCategoryPreview(category);
    }

    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const username = loginForm.elements.username.value.trim();
      const password = loginForm.elements.password.value;

      if (!window.location.protocol.startsWith("http")) {
        showToast("Buka website lewat server dulu untuk login admin global.", 3600);
        return;
      }

      try {
        const response = await fetch("/api/admin-login", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          const result = await response.json().catch(() => ({}));
          showToast(result.error || "Username atau password salah.", 3200);
          return;
        }

        sessionStorage.setItem(adminSessionKey, "true");
        loginForm.reset();
        setPanelState();
        fillStaffOptions();
        fillStaffForm();
        fillDonationOptions();
        fillDonationForm();
        fillVehicleCategoryOptions();
        fillVehicleCategoryForm();
        showToast("Login berhasil.");
      } catch (error) {
        showToast("Login admin gagal tersambung ke backend.", 3600);
      }
    });

    staffSelect.addEventListener("change", fillStaffForm);
    if (donationSelect) donationSelect.addEventListener("change", fillDonationForm);
    if (vehicleCategorySelect) vehicleCategorySelect.addEventListener("change", fillVehicleCategoryForm);

    staffForm.elements.photo.addEventListener("change", async () => {
      const file = staffForm.elements.photo.files[0];
      if (!file) return;
      activePhoto = await makeStaffPhoto(file);
      updatePreview({
        name: staffForm.elements.name.value,
        rank: staffForm.elements.rank.value,
        initials: makeInitials(staffForm.elements.name.value),
        photo: activePhoto
      });
    });

    ["name", "rank"].forEach((fieldName) => {
      staffForm.elements[fieldName].addEventListener("input", () => {
        updatePreview({
          name: staffForm.elements.name.value,
          rank: staffForm.elements.rank.value,
          initials: makeInitials(staffForm.elements.name.value),
          photo: activePhoto
        });
      });
    });

    removePhotoButton.addEventListener("click", () => {
      activePhoto = "";
      staffForm.elements.photo.value = "";
      updatePreview({
        name: staffForm.elements.name.value,
        rank: staffForm.elements.rank.value,
        initials: makeInitials(staffForm.elements.name.value),
        photo: ""
      });
    });

    if (donationForm) {
      donationForm.elements.photo.addEventListener("change", async () => {
        const file = donationForm.elements.photo.files[0];
        if (!file) return;
        activeDonationPhoto = await makeDonationPhoto(file);
        updateDonationPreview({
          name: donationForm.elements.name.value,
          tier: donationForm.elements.tier.value,
          price: donationForm.elements.price.value,
          photo: activeDonationPhoto,
          photoClass: ""
        });
      });

      ["name", "tier", "price"].forEach((fieldName) => {
        donationForm.elements[fieldName].addEventListener("input", () => {
          const selected = donationPackages.find((item) => item.id === donationSelect.value) || donationPackages[0];
          updateDonationPreview({
            ...selected,
            name: donationForm.elements.name.value,
            tier: donationForm.elements.tier.value,
            price: donationForm.elements.price.value,
            photo: activeDonationPhoto
          });
        });
      });

      removeDonationPhotoButton.addEventListener("click", () => {
        activeDonationPhoto = "";
        donationForm.elements.photo.value = "";
        const selected = donationPackages.find((item) => item.id === donationSelect.value) || donationPackages[0];
        updateDonationPreview({ ...selected, photo: "" });
      });

      donationForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const selectedId = donationSelect.value;
        donationPackages = donationPackages.map((pkg) => {
          if (pkg.id !== selectedId) return pkg;
          return {
            ...pkg,
            group: donationForm.elements.group.value,
            tier: donationForm.elements.tier.value.trim(),
            name: donationForm.elements.name.value.trim(),
            price: donationForm.elements.price.value.trim(),
            benefits: donationForm.elements.benefits.value.split("\n").map((line) => line.trim()).filter(Boolean),
            featured: donationForm.elements.featured.checked,
            photo: activeDonationPhoto
          };
        });

        try {
          await saveDonationPackages(donationPackages);
          fillDonationOptions();
          donationSelect.value = selectedId;
          fillDonationForm();
          renderDonationPage();
          showToast("Paket donation berhasil disimpan global.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });

      addDonationButton?.addEventListener("click", async () => {
        const group = donationForm.elements.group.value || "vip";
        const timestamp = Date.now();
        const newPackage = {
          id: `custom-${timestamp}`,
          group,
          tier: "Custom",
          name: "Paket Baru",
          price: "Rp0",
          benefits: ["Benefit pertama", "Benefit kedua"],
          featured: false,
          photo: "",
          photoClass: ""
        };

        donationPackages = [...donationPackages, newPackage];
        try {
          await saveDonationPackages(donationPackages);
          fillDonationOptions();
          donationSelect.value = newPackage.id;
          fillDonationForm();
          renderDonationPage();
          showToast("Paket donation baru ditambahkan global.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });

      deleteDonationButton?.addEventListener("click", async () => {
        if (donationPackages.length <= 1) {
          showToast("Minimal harus ada 1 paket donation.", 3200);
          return;
        }

        const selectedId = donationSelect.value;
        donationPackages = donationPackages.filter((pkg) => pkg.id !== selectedId);
        try {
          await saveDonationPackages(donationPackages);
          fillDonationOptions();
          fillDonationForm();
          renderDonationPage();
          showToast("Paket donation dihapus global.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });

      resetDonationButton.addEventListener("click", async () => {
        donationPackages = defaultDonationPackages.map((pkg) => ({ ...pkg, benefits: [...pkg.benefits] }));
        try {
          await saveDonationPackages(donationPackages);
          fillDonationOptions();
          fillDonationForm();
          renderDonationPage();
          showToast("Data donation global kembali ke default.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });
    }

    if (vehicleCategoryForm) {
      vehicleCategoryForm.elements.photo.addEventListener("change", async () => {
        const file = vehicleCategoryForm.elements.photo.files[0];
        if (!file) return;
        const selected = vehicleCategoryPhotos.find((item) => item.id === vehicleCategorySelect.value) || vehicleCategoryPhotos[0];
        activeVehicleCategoryPhoto = await makeDonationPhoto(file);
        updateVehicleCategoryPreview({ ...selected, photo: activeVehicleCategoryPhoto });
      });

      removeVehicleCategoryPhotoButton?.addEventListener("click", () => {
        activeVehicleCategoryPhoto = "";
        vehicleCategoryForm.elements.photo.value = "";
        const selected = vehicleCategoryPhotos.find((item) => item.id === vehicleCategorySelect.value) || vehicleCategoryPhotos[0];
        updateVehicleCategoryPreview({ ...selected, photo: "" });
      });

      vehicleCategoryForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const selectedId = vehicleCategorySelect.value;
        vehicleCategoryPhotos = vehicleCategoryPhotos.map((category) => (
          category.id === selectedId ? { ...category, photo: activeVehicleCategoryPhoto } : category
        ));
        try {
          await saveVehicleCategoryPhotos(vehicleCategoryPhotos);
          fillVehicleCategoryForm();
          renderVehicleCategoryPhotos();
          showToast("Foto kategori vehicles berhasil disimpan global.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });

      resetVehicleCategoryPhotoButton?.addEventListener("click", async () => {
        vehicleCategoryPhotos = defaultVehicleCategoryPhotos.map((category) => ({ ...category }));
        try {
          await saveVehicleCategoryPhotos(vehicleCategoryPhotos);
          fillVehicleCategoryOptions();
          fillVehicleCategoryForm();
          renderVehicleCategoryPhotos();
          showToast("Foto kategori vehicles global kembali ke default.");
        } catch (error) {
          showToast(error.message, 3600);
        }
      });
    }

    staffForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const selectedId = staffSelect.value;
      staffList = staffList.map((staff) => {
        if (staff.id !== selectedId) return staff;
        return {
          ...staff,
          name: staffForm.elements.name.value.trim(),
          rank: staffForm.elements.rank.value.trim(),
          status: staffForm.elements.status.value,
          description: staffForm.elements.description.value.trim(),
          initials: makeInitials(staffForm.elements.name.value),
          photo: activePhoto
        };
      });

      try {
        await saveStaffList(staffList);
        fillStaffOptions();
        staffSelect.value = selectedId;
        fillStaffForm();
        showToast("Profil staff berhasil disimpan global.");
      } catch (error) {
        showToast(error.message, 3600);
      }
    });

    resetButton.addEventListener("click", async () => {
      staffList = defaultStaff.map((staff) => ({ ...staff }));
      try {
        await saveStaffList(staffList);
        fillStaffOptions();
        fillStaffForm();
        showToast("Data staff global kembali ke default.");
      } catch (error) {
        showToast(error.message, 3600);
      }
    });

    logoutButton.addEventListener("click", async () => {
      if (window.location.protocol.startsWith("http")) {
        await fetch("/api/admin-logout", {
          method: "POST",
          credentials: "same-origin"
        }).catch(() => {});
      }

      sessionStorage.removeItem(adminSessionKey);
      setPanelState();
      showToast("Logout berhasil.");
    });

    fillStaffOptions();
    fillDonationOptions();
    fillVehicleCategoryOptions();
    setPanelState();
    if (sessionStorage.getItem(adminSessionKey) === "true") {
      fillStaffForm();
      fillDonationForm();
      fillVehicleCategoryForm();
    }
  }

  async function writeServerAddressToClipboard() {
    try {
      await navigator.clipboard.writeText(serverAddress);
      return true;
    } catch (error) {
      const input = document.createElement("input");
      input.value = serverAddress;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
      return true;
    }
  }

  async function copyServerAddress() {
    await writeServerAddressToClipboard();
    showToast(`IP disalin: ${serverAddress}`);
  }

  document.querySelectorAll("[data-copy-ip]").forEach((button) => {
    button.addEventListener("click", copyServerAddress);
  });

  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      body.classList.toggle("menu-open");
    });
  }

  navLinks.forEach((link) => {
    link.addEventListener("click", () => body.classList.remove("menu-open"));
  });

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  navLinks.forEach((link) => {
    const linkPage = link.getAttribute("href").split("#")[0];
    const donationChildPage = (currentPage.startsWith("donation-") || currentPage.startsWith("vehicles-")) && linkPage === "donation.html";
    if (linkPage && (linkPage === currentPage || donationChildPage)) {
      link.classList.add("active");
    }
  });

  const sections = Array.from(document.querySelectorAll("section[id]"));
  const hashLinks = Array.from(navLinks).filter((link) => link.getAttribute("href").startsWith("#"));

  if (sections.length && hashLinks.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          hashLinks.forEach((link) => {
            link.classList.toggle("active", link.getAttribute("href") === `#${entry.target.id}`);
          });
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    sections.forEach((section) => observer.observe(section));
  }

  async function initPage() {
    await loadGlobalSiteData();
    renderStaffList();
    renderDonationPage();
    renderVehicleCategoryPhotos();
    initCheckoutPage();
    initStaffAdmin();
    initAdminPanelPage();
    refreshServerStatus();
    window.setInterval(refreshServerStatus, 5000);
  }

  initPage();
})();
