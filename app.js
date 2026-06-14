const state = {
  results: [],
  saved: loadSaved(),
  lastSearch: null,
  deferredPrompt: null
};

const categoryQueries = {
  hairdresser: [
    'nwr["shop"="hairdresser"]'
  ],
  beauty: [
    'nwr["shop"="beauty"]',
    'nwr["beauty"]'
  ],
  nails: [
    'nwr["shop"="beauty"]["name"~"paznok|manicure|nail",i]',
    'nwr["beauty"="nails"]'
  ],
  car_repair: [
    'nwr["shop"="car_repair"]'
  ],
  plumber: [
    'nwr["craft"="plumber"]'
  ],
  electrician: [
    'nwr["craft"="electrician"]'
  ],
  builder: [
    'nwr["craft"="builder"]',
    'nwr["craft"="construction"]'
  ],
  photographer: [
    'nwr["craft"="photographer"]',
    'nwr["shop"="photo"]'
  ],
  physiotherapist: [
    'nwr["healthcare"="physiotherapist"]'
  ],
  restaurant: [
    'nwr["amenity"="restaurant"]'
  ]
};

const categoryLabels = {
  hairdresser: "salon fryzjerski",
  beauty: "salon kosmetyczny",
  nails: "salon stylizacji paznokci",
  car_repair: "warsztat samochodowy",
  plumber: "firma hydrauliczna",
  electrician: "firma elektryczna",
  builder: "firma budowlana",
  photographer: "fotograf",
  physiotherapist: "gabinet fizjoterapii",
  restaurant: "restauracja"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const searchForm = $("#searchForm");
const searchBtn = $("#searchBtn");
const resultsSection = $("#resultsSection");
const resultsContainer = $("#results");
const errorBox = $("#errorBox");
const emptyState = $("#emptyState");
const savedContainer = $("#savedResults");
const savedEmpty = $("#savedEmpty");
const messageDialog = $("#messageDialog");

searchForm.addEventListener("submit", handleSearch);
$("#onlyNoWebsite").addEventListener("change", renderResults);
$("#hideUnnamed").addEventListener("change", renderResults);
$("#onlyContact").addEventListener("change", renderResults);
$("#onlyPhone").addEventListener("change", renderResults);
$("#onlySocial").addEventListener("change", renderResults);
$("#sortResults").addEventListener("change", renderResults);
$("#statusFilter").addEventListener("change", renderSaved);
$("#exportResultsBtn").addEventListener("click", () => exportCsv(getFilteredResults(), "wyniki-leadfinder.csv"));
$("#exportSavedBtn").addEventListener("click", () => exportCsv(state.saved, "zapisane-leady.csv"));
$("#closeDialog").addEventListener("click", () => messageDialog.close());
$("#copyMessage").addEventListener("click", copyGeneratedMessage);

$$(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => switchView(btn.dataset.view));
});

document.addEventListener("click", async (event) => {
  const target = event.target.closest("[data-action]");
  if (!target) return;
  const id = target.dataset.id;
  const source = target.dataset.source || "results";
  const company = findCompany(id, source);
  if (!company) return;

  if (target.dataset.action === "save") saveCompany(company);
  if (target.dataset.action === "remove") removeCompany(company.id);
  if (target.dataset.action === "message") openMessage(company);
});

document.addEventListener("change", (event) => {
  const select = event.target.closest("[data-status-id]");
  if (!select) return;
  updateStatus(select.dataset.statusId, select.value);
});

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  state.deferredPrompt = event;
  $("#installBtn").classList.remove("hidden");
});

$("#installBtn").addEventListener("click", async () => {
  if (!state.deferredPrompt) return;
  state.deferredPrompt.prompt();
  await state.deferredPrompt.userChoice;
  state.deferredPrompt = null;
  $("#installBtn").classList.add("hidden");
});

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js"));
}

renderSaved();

async function handleSearch(event) {
  event.preventDefault();
  clearMessages();
  setLoading(true);

  const city = $("#city").value.trim();
  const category = $("#category").value;
  const radius = Number($("#radius").value);

  try {
    const location = await geocodeCity(city);
    const elements = await fetchBusinesses(location.lat, location.lon, radius, category);
    state.results = normalizeBusinesses(elements, category);
    state.lastSearch = { city, category, radius, location };
    $("#resultsTitle").textContent = `${categoryLabels[category]} — ${city}`;
    resultsSection.classList.toggle("hidden", state.results.length === 0);
    emptyState.classList.toggle("hidden", state.results.length !== 0);
    renderResults();
  } catch (error) {
    console.error(error);
    errorBox.textContent = friendlyError(error);
    errorBox.classList.remove("hidden");
    resultsSection.classList.add("hidden");
    emptyState.classList.add("hidden");
  } finally {
    setLoading(false);
  }
}

async function geocodeCity(city) {
  setLoadingStage("Sprawdzam miejscowość…");

  const params = new URLSearchParams({
    q: `${city}, Polska`,
    format: "jsonv2",
    limit: "1",
    countrycodes: "pl",
    "accept-language": "pl"
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?${params.toString()}`,
      {
        headers: { "Accept": "application/json" },
        signal: controller.signal
      }
    );

    if (!response.ok) throw new Error("GEOCODING_FAILED");

    const data = await response.json();
    if (!data.length) throw new Error("CITY_NOT_FOUND");

    return {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
      displayName: data[0].display_name
    };
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("GEOCODING_TIMEOUT");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchBusinesses(lat, lon, radius, category) {
  setLoadingStage("Pobieram firmy…");

  const selectors = categoryQueries[category];
  const lines = selectors
    .map(selector => `${selector}(around:${radius},${lat},${lon});`)
    .join("\n");

  const query = `[out:json][timeout:15];
(
${lines}
);
out center 180;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];

  let lastError = new Error("OVERPASS_FAILED");

  for (let index = 0; index < endpoints.length; index += 1) {
    setLoadingStage(index === 0 ? "Pobieram firmy…" : "Próbuję serwera zapasowego…");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 18000);

    try {
      const response = await fetch(endpoints[index], {
        method: "POST",
        body: "data=" + encodeURIComponent(query),
        signal: controller.signal
      });

      if (response.status === 429) {
        lastError = new Error("RATE_LIMIT");
        continue;
      }

      if (!response.ok) {
        lastError = new Error("OVERPASS_FAILED");
        continue;
      }

      const data = await response.json();
      return data.elements || [];
    } catch (error) {
      lastError = error?.name === "AbortError"
        ? new Error("OVERPASS_TIMEOUT")
        : new Error("OVERPASS_FAILED");
    } finally {
      clearTimeout(timer);
    }
  }

  throw lastError;
}

function normalizeBusinesses(elements, category) {
  const seen = new Set();

  return elements
    .map(element => {
      const tags = element.tags || {};
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;

      const rawName = clean(tags.name || tags.brand || tags.operator || "");
      const name = rawName || "Firma bez podanej nazwy";
      const website = cleanUrl(tags.website || tags["contact:website"] || tags.url || "");
      const phone = clean(tags.phone || tags["contact:phone"] || tags.mobile || "");
      const email = clean(tags.email || tags["contact:email"] || "");
      const facebook = cleanUrl(tags["contact:facebook"] || tags.facebook || "");
      const instagram = cleanUrl(tags["contact:instagram"] || tags.instagram || "");
      const address = buildAddress(tags);
      const id = `${element.type}-${element.id}`;

      const company = {
        id,
        osmType: element.type,
        osmId: element.id,
        name,
        hasRealName: Boolean(rawName),
        category,
        categoryLabel: categoryLabels[category],
        lat,
        lon,
        address,
        website,
        phone,
        email,
        facebook,
        instagram,
        hasWebsite: Boolean(website),
        status: "new",
        createdAt: new Date().toISOString()
      };

      company.leadScore = calculateLeadScore(company);
      company.leadQuality = leadQuality(company.leadScore);

      return company;
    })
    .filter(company => {
      if (!company.lat || !company.lon) return false;
      if (seen.has(company.id)) return false;
      seen.add(company.id);
      return true;
    })
    .sort((a, b) =>
      Number(a.hasWebsite) - Number(b.hasWebsite) ||
      b.leadScore - a.leadScore ||
      a.name.localeCompare(b.name, "pl")
    );
}

function calculateLeadScore(company) {
  let score = 0;

  if (!company.hasWebsite) score += 25;
  if (company.hasRealName) score += 15;
  if (company.phone) score += 30;
  if (company.email) score += 15;
  if (company.facebook || company.instagram) score += 20;
  if (company.address && company.address !== "Adres niepodany w danych") score += 10;

  return Math.min(score, 100);
}

function leadQuality(score) {
  if (score >= 65) return { label: "WYSOKI", className: "high" };
  if (score >= 40) return { label: "ŚREDNI", className: "medium" };
  return { label: "DO WERYFIKACJI", className: "low" };
}

function buildAddress(tags) {
  const street = [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(" ");
  const city = tags["addr:city"] || tags["addr:place"] || "";
  const postcode = tags["addr:postcode"] || "";
  const full = [street, [postcode, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return clean(full) || "Adres niepodany w danych";
}

function clean(value) {
  return String(value || "").trim();
}

function cleanUrl(value) {
  const text = clean(value);
  if (!text) return "";
  if (text.startsWith("http://") || text.startsWith("https://")) return text;
  if (text.startsWith("www.")) return `https://${text}`;
  if (/^[\w.-]+\.[a-z]{2,}/i.test(text)) return `https://${text}`;
  if (/facebook\.com|instagram\.com/i.test(text)) return `https://${text.replace(/^\/+/, "")}`;
  return text;
}

function getFilteredResults() {
  const filtered = state.results.filter(company => {
    if ($("#onlyNoWebsite").checked && company.hasWebsite) return false;
    if ($("#hideUnnamed").checked && !company.hasRealName) return false;
    if ($("#onlyContact").checked && !company.phone && !company.email && !company.facebook && !company.instagram) return false;
    if ($("#onlyPhone").checked && !company.phone) return false;
    if ($("#onlySocial").checked && !company.facebook && !company.instagram) return false;
    return true;
  });

  const sort = $("#sortResults").value;

  return [...filtered].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name, "pl");
    return b.leadScore - a.leadScore || a.name.localeCompare(b.name, "pl");
  });
}

function renderResults() {
  const list = getFilteredResults();
  const noWebsiteCount = state.results.filter(item => !item.hasWebsite).length;
  const contactCount = list.filter(item =>
    item.phone || item.email || item.facebook || item.instagram
  ).length;

  $("#resultsStats").textContent =
    `Pokazano: ${list.length} • Z kontaktem: ${contactCount} • Łącznie: ${state.results.length} • Bez podanej strony: ${noWebsiteCount}`;
  resultsContainer.innerHTML = list.map(company => companyCard(company, "results")).join("");
  emptyState.classList.toggle("hidden", list.length !== 0);
}

function renderSaved() {
  const status = $("#statusFilter")?.value || "";
  const list = status ? state.saved.filter(item => item.status === status) : state.saved;
  const interested = state.saved.filter(item => item.status === "interested").length;
  $("#savedStats").textContent = `Zapisane: ${state.saved.length} • Zainteresowani: ${interested}`;
  savedContainer.innerHTML = list.map(company => companyCard(company, "saved")).join("");
  savedEmpty.classList.toggle("hidden", list.length !== 0);
}

function companyCard(company, source) {
  const isSaved = state.saved.some(item => item.id === company.id);
  const city = state.lastSearch?.city || "";
  const searchPhrase = [company.name, city].filter(Boolean).join(" ");
  const encodedPhrase = encodeURIComponent(searchPhrase);
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodedPhrase}`;
  const googleUrl = `https://www.google.com/search?q=${encodedPhrase}`;
  const facebookSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com ${searchPhrase}`)}`;

  const siteBadge = company.hasWebsite
    ? `<span class="badge has-site">MA STRONĘ</span>`
    : `<span class="badge no-site">BRAK WWW</span>`;

  const quality = company.leadQuality || leadQuality(company.leadScore || calculateLeadScore(company));

  const socials = [
    company.facebook ? `<a href="${escapeAttr(company.facebook)}" target="_blank" rel="noopener">Facebook</a>` : "",
    company.instagram ? `<a href="${escapeAttr(company.instagram)}" target="_blank" rel="noopener">Instagram</a>` : ""
  ].filter(Boolean).join(" · ");

  return `<article class="card">
    <div class="card-top">
      <div>
        <h3>${escapeHtml(company.name)}</h3>
        <p class="address">${escapeHtml(company.address)}</p>
      </div>
      <div class="badge-stack">
        ${siteBadge}
        <span class="quality-badge ${quality.className}">${quality.label} · ${company.leadScore || 0}/100</span>
      </div>
    </div>

    <div class="meta">
      <div class="meta-row"><span class="key">Telefon:</span><span>${company.phone ? `<a href="tel:${escapeAttr(company.phone)}">${escapeHtml(company.phone)}</a>` : "brak w danych"}</span></div>
      <div class="meta-row"><span class="key">E-mail:</span><span>${company.email ? `<a href="mailto:${escapeAttr(company.email)}">${escapeHtml(company.email)}</a>` : "brak w danych"}</span></div>
      <div class="meta-row"><span class="key">Strona:</span><span>${company.website ? `<a href="${escapeAttr(company.website)}" target="_blank" rel="noopener">Otwórz stronę</a>` : "nie podano"}</span></div>
      <div class="meta-row"><span class="key">Social:</span><span>${socials || "nie podano"}</span></div>
    </div>

    <div class="verification-box">
      <strong>Weryfikacja:</strong>
      <span>sprawdź Google przed wysłaniem oferty.</span>
    </div>

    <div class="card-actions card-actions-3">
      <a href="${mapUrl}" target="_blank" rel="noopener">Google Maps</a>
      <a href="${googleUrl}" target="_blank" rel="noopener">Szukaj w Google</a>
      <a href="${facebookSearchUrl}" target="_blank" rel="noopener">Szukaj Facebooka</a>
      <button data-action="message" data-id="${escapeAttr(company.id)}" data-source="${source}" type="button">Utwórz wiadomość</button>
      ${source === "saved"
        ? `<button class="danger" data-action="remove" data-id="${escapeAttr(company.id)}" data-source="${source}" type="button">Usuń lead</button>`
        : `<button class="save" data-action="save" data-id="${escapeAttr(company.id)}" data-source="${source}" type="button">${isSaved ? "✓ Zapisano" : "Zapisz lead"}</button>`}
      ${company.phone ? `<a href="tel:${escapeAttr(company.phone)}">Zadzwoń</a>` : ""}
    </div>

    ${source === "saved" ? `<label class="status-select">Status kontaktu
      <select data-status-id="${escapeAttr(company.id)}">
        <option value="new" ${company.status === "new" ? "selected" : ""}>Nowy</option>
        <option value="contacted" ${company.status === "contacted" ? "selected" : ""}>Skontaktowano</option>
        <option value="interested" ${company.status === "interested" ? "selected" : ""}>Zainteresowany</option>
        <option value="rejected" ${company.status === "rejected" ? "selected" : ""}>Odrzucony</option>
      </select>
    </label>` : ""}
  </article>`;
}

function saveCompany(company) {
  if (state.saved.some(item => item.id === company.id)) {
    showToast("Ta firma jest już zapisana.");
    return;
  }
  state.saved.unshift({ ...company, status: "new", savedAt: new Date().toISOString() });
  persistSaved();
  renderResults();
  renderSaved();
  showToast("Firma zapisana w bazie leadów.");
}

function removeCompany(id) {
  state.saved = state.saved.filter(item => item.id !== id);
  persistSaved();
  renderSaved();
  renderResults();
  showToast("Lead został usunięty.");
}

function updateStatus(id, status) {
  state.saved = state.saved.map(item => item.id === id ? { ...item, status } : item);
  persistSaved();
  renderSaved();
  showToast("Status został zaktualizowany.");
}

function findCompany(id, source) {
  const list = source === "saved" ? state.saved : state.results;
  const company = list.find(item => item.id === id);

  if (company && typeof company.leadScore !== "number") {
    company.hasRealName = company.name !== "Firma bez podanej nazwy";
    company.leadScore = calculateLeadScore(company);
    company.leadQuality = leadQuality(company.leadScore);
  }

  return company;
}

function openMessage(company) {
  const city = state.lastSearch?.city || company.address.split(",").pop()?.trim() || "Państwa miejscowości";
  const message = `Dzień dobry,

trafiłem na profil firmy „${company.name}” działającej w branży: ${company.categoryLabel}. Nie znalazłem obecnie własnej strony internetowej firmy.

Mogę przygotować nowoczesną stronę z opisem usług, galerią realizacji, danymi kontaktowymi, lokalizacją oraz szybkim kontaktem telefonicznym. Strona będzie dostosowana do telefonów i może pomóc klientom znaleźć firmę w Google.

Koszt wykonania strony wynosi 899 zł plus opłaty za domenę i serwer. Mogę wcześniej bezpłatnie przygotować propozycję wyglądu strony głównej.

Czy mogę ją przesłać?

Pozdrawiam
Kamil Mazur
E-mail: logo.wizytowka@gmail.com`;

  $("#messageCompany").textContent = company.name;
  $("#messageText").value = message;
  messageDialog.showModal();
}

async function copyGeneratedMessage() {
  const text = $("#messageText").value;
  try {
    await navigator.clipboard.writeText(text);
    showToast("Wiadomość skopiowana.");
  } catch {
    $("#messageText").select();
    document.execCommand("copy");
    showToast("Wiadomość skopiowana.");
  }
}

function switchView(viewId) {
  $$(".view").forEach(view => view.classList.toggle("active", view.id === viewId));
  $$(".nav-btn").forEach(btn => btn.classList.toggle("active", btn.dataset.view === viewId));
  if (viewId === "savedView") renderSaved();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exportCsv(list, filename) {
  if (!list.length) {
    showToast("Brak danych do eksportu.");
    return;
  }
  const headers = ["Nazwa", "Branża", "Adres", "Telefon", "E-mail", "Strona", "Facebook", "Instagram", "Status", "Mapa"];
  const rows = list.map(company => [
    company.name,
    company.categoryLabel,
    company.address,
    company.phone,
    company.email,
    company.website,
    company.facebook,
    company.instagram,
    company.status || "",
    `https://www.google.com/maps/search/?api=1&query=${company.lat},${company.lon}`
  ]);
  const csv = "\ufeff" + [headers, ...rows].map(row => row.map(csvCell).join(";")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function csvCell(value) {
  return `"${String(value || "").replaceAll('"', '""')}"`;
}

function loadSaved() {
  try {
    const saved = JSON.parse(localStorage.getItem("leadfinder.saved") || "[]");

    return saved.map(company => {
      const upgraded = {
        ...company,
        hasRealName: company.hasRealName ?? company.name !== "Firma bez podanej nazwy"
      };
      upgraded.leadScore = typeof upgraded.leadScore === "number"
        ? upgraded.leadScore
        : calculateLeadScore(upgraded);
      upgraded.leadQuality = upgraded.leadQuality || leadQuality(upgraded.leadScore);
      return upgraded;
    });
  } catch {
    return [];
  }
}

function persistSaved() {
  localStorage.setItem("leadfinder.saved", JSON.stringify(state.saved));
}

function setLoadingStage(text) {
  searchBtn.querySelector(".btn-label").textContent = text;
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  searchBtn.querySelector(".btn-label").textContent = isLoading ? "Wyszukiwanie…" : "Szukaj firm";
  searchBtn.querySelector(".spinner").classList.toggle("hidden", !isLoading);
}

function clearMessages() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function friendlyError(error) {
  if (error.message === "CITY_NOT_FOUND") return "Nie znaleziono tej miejscowości. Sprawdź pisownię i spróbuj ponownie.";
  if (error.message === "RATE_LIMIT") return "Publiczny serwer jest chwilowo przeciążony. Spróbuj ponownie za moment.";
  if (error.message === "GEOCODING_FAILED") return "Nie udało się ustalić położenia miasta.";
  if (error.message === "GEOCODING_TIMEOUT") return "Serwer lokalizacji nie odpowiedział. Spróbuj ponownie za chwilę.";
  if (error.message === "OVERPASS_TIMEOUT") return "Serwery firm nie odpowiedziały w wyznaczonym czasie. Spróbuj ponownie za chwilę lub wybierz mniejszy promień.";
  if (error.message === "OVERPASS_FAILED") return "Nie udało się pobrać firm. Publiczny serwer OpenStreetMap może być przeciążony.";
  return "Wystąpił błąd połączenia. Sprawdź internet i spróbuj ponownie.";
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.remove("hidden");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.add("hidden"), 2600);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
