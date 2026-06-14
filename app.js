const SUPABASE_URL = "https://dgvhhzfhhwrbhdxaolap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ibOSYMgLX6RHRv5wVQIsMg_-njehHH9";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

const state = {
  results: [],
  saved: [],
  session: null,
  quota: null,
  lastSearch: null,
  deferredPrompt: null
};

const categoryQueries = {
  hairdresser: ['nwr["shop"="hairdresser"]'],
  beauty: ['nwr["shop"="beauty"]', 'nwr["beauty"]'],
  nails: [
    'nwr["shop"="beauty"]["name"~"paznok|manicure|nail",i]',
    'nwr["beauty"="nails"]'
  ],
  car_repair: ['nwr["shop"="car_repair"]'],
  plumber: ['nwr["craft"="plumber"]'],
  electrician: ['nwr["craft"="electrician"]'],
  builder: ['nwr["craft"="builder"]', 'nwr["craft"="construction"]'],
  photographer: ['nwr["craft"="photographer"]', 'nwr["shop"="photo"]'],
  physiotherapist: ['nwr["healthcare"="physiotherapist"]'],
  restaurant: ['nwr["amenity"="restaurant"]']
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

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const searchForm = $("#searchForm");
const searchBtn = $("#searchBtn");
const resultsSection = $("#resultsSection");
const resultsContainer = $("#results");
const errorBox = $("#errorBox");
const emptyState = $("#emptyState");
const savedContainer = $("#savedResults");
const savedEmpty = $("#savedEmpty");
const messageDialog = $("#messageDialog");
const authDialog = $("#authDialog");
const plansDialog = $("#plansDialog");

bindEvents();
initApp();

function bindEvents() {
  searchForm.addEventListener("submit", handleSearch);
  $("#onlyNoWebsite").addEventListener("change", renderResults);
  $("#hideUnnamed").addEventListener("change", renderResults);
  $("#onlyContact").addEventListener("change", renderResults);
  $("#onlyPhone").addEventListener("change", renderResults);
  $("#onlySocial").addEventListener("change", renderResults);
  $("#sortResults").addEventListener("change", renderResults);
  $("#statusFilter").addEventListener("change", renderSaved);
  $("#exportResultsBtn").addEventListener("click", () =>
    exportCsv(getFilteredResults(), "wyniki-leadfinder.csv")
  );
  $("#exportSavedBtn").addEventListener("click", () =>
    exportCsv(state.saved, "zapisane-leady.csv")
  );

  $("#authBtn").addEventListener("click", openAuthDialog);
  $("#closeAuthDialog").addEventListener("click", () => authDialog.close());
  $("#closePlansDialog").addEventListener("click", () => plansDialog.close());
  $("#openPlansBtn").addEventListener("click", openPlansDialog);
  $("#accountPlansBtn").addEventListener("click", () => {
    authDialog.close();
    openPlansDialog();
  });
  $("#logoutBtn").addEventListener("click", logout);
  $("#loginForm").addEventListener("submit", login);
  $("#registerForm").addEventListener("submit", register);
  $("#closeDialog").addEventListener("click", () => messageDialog.close());
  $("#copyMessage").addEventListener("click", copyGeneratedMessage);

  $$(".auth-tab").forEach(button => {
    button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
  });

  $$(".plan-soon").forEach(button => {
    button.addEventListener("click", () =>
      showToast("Płatności za wyższe pakiety uruchomimy w kolejnym etapie.")
    );
  });

  $$(".nav-btn").forEach(btn => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });

  document.addEventListener("click", async event => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const id = target.dataset.id;
    const source = target.dataset.source || "results";
    const company = findCompany(id, source);
    if (!company) return;

    if (target.dataset.action === "save") await saveCompany(company);
    if (target.dataset.action === "remove") await removeCompany(company);
    if (target.dataset.action === "message") openMessage(company);
  });

  document.addEventListener("change", async event => {
    const select = event.target.closest("[data-status-id]");
    if (!select) return;
    await updateStatus(select.dataset.statusId, select.value);
  });

  window.addEventListener("beforeinstallprompt", event => {
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
    window.addEventListener("load", () =>
      navigator.serviceWorker.register("./sw.js")
    );
  }
}

async function initApp() {
  try {
    const { data, error } = await supabaseClient.auth.getSession();
    if (error) throw error;
    await applySession(data.session);

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => applySession(session), 0);
    });
  } catch (error) {
    console.error("Błąd inicjalizacji konta:", error);
    showToast("Nie udało się połączyć z systemem kont.");
    updateAuthUI();
  }
}

async function applySession(session) {
  state.session = session;
  updateAuthUI();

  if (session) {
    await loadQuota();
    await migrateLegacyLeads();
    await loadSavedLeads();
  } else {
    state.quota = null;
    state.saved = [];
    renderQuota();
    renderSaved();
  }
}

function updateAuthUI() {
  const loggedIn = Boolean(state.session);
  $("#authBtn").textContent = loggedIn ? "Konto" : "Zaloguj";
  $("#quotaPanel").classList.toggle("hidden", !loggedIn);
  $("#loginRequiredNotice").classList.toggle("hidden", loggedIn);
  $("#savedLoginNotice").classList.toggle("hidden", loggedIn);
  $("#authGuestContent").classList.toggle("hidden", loggedIn);
  $("#authUserContent").classList.toggle("hidden", !loggedIn);

  if (loggedIn) {
    const email = state.session.user.email || "";
    $("#quotaEmail").textContent = email;
    $("#accountDialogEmail").textContent = email;
    searchBtn.querySelector(".btn-label").textContent = "Szukaj firm";
  } else {
    searchBtn.querySelector(".btn-label").textContent = "Zaloguj się, aby szukać";
  }
}

function openAuthDialog() {
  clearAuthMessage();

  if (state.session) {
    $("#authDialogTitle").textContent = "Twoje konto";
  } else {
    $("#authDialogTitle").textContent = "Zaloguj się";
    setAuthTab("login");
  }

  authDialog.showModal();
}

function setAuthTab(mode) {
  const isLogin = mode === "login";
  $("#loginForm").classList.toggle("hidden", !isLogin);
  $("#registerForm").classList.toggle("hidden", isLogin);
  $("#authDialogTitle").textContent = isLogin ? "Zaloguj się" : "Utwórz konto";
  $$(".auth-tab").forEach(button =>
    button.classList.toggle("active", button.dataset.authTab === mode)
  );
  clearAuthMessage();
}

async function login(event) {
  event.preventDefault();
  clearAuthMessage();

  const email = $("#loginEmail").value.trim();
  const password = $("#loginPassword").value;

  setAuthBusy(true);

  try {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    authDialog.close();
    showToast("Zalogowano.");
  } catch (error) {
    showAuthMessage(authErrorMessage(error), true);
  } finally {
    setAuthBusy(false);
  }
}

async function register(event) {
  event.preventDefault();
  clearAuthMessage();

  const fullName = $("#registerName").value.trim();
  const email = $("#registerEmail").value.trim();
  const password = $("#registerPassword").value;
  const confirmPassword = $("#registerPasswordConfirm").value;

  if (password !== confirmPassword) {
    showAuthMessage("Hasła nie są identyczne.", true);
    return;
  }

  setAuthBusy(true);

  try {
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { full_name: fullName }
      }
    });

    if (error) throw error;

    if (data.session) {
      authDialog.close();
      showToast("Konto zostało utworzone.");
    } else {
      showAuthMessage(
        "Konto utworzone. Sprawdź pocztę i kliknij link potwierdzający e-mail.",
        false
      );
    }
  } catch (error) {
    showAuthMessage(authErrorMessage(error), true);
  } finally {
    setAuthBusy(false);
  }
}

async function logout() {
  const { error } = await supabaseClient.auth.signOut();
  if (error) {
    showToast("Nie udało się wylogować.");
    return;
  }

  authDialog.close();
  state.results = [];
  resultsSection.classList.add("hidden");
  emptyState.classList.add("hidden");
  showToast("Wylogowano.");
}

function setAuthBusy(busy) {
  $$("#loginForm button, #registerForm button").forEach(button => {
    button.disabled = busy;
  });
}

function showAuthMessage(text, isError) {
  const box = $("#authMessage");
  box.textContent = text;
  box.classList.remove("hidden");
  box.classList.toggle("auth-error", isError);
  box.classList.toggle("auth-success", !isError);
}

function clearAuthMessage() {
  const box = $("#authMessage");
  box.textContent = "";
  box.classList.add("hidden");
  box.classList.remove("auth-error", "auth-success");
}

function authErrorMessage(error) {
  const message = String(error?.message || "").toLowerCase();

  if (message.includes("invalid login credentials")) {
    return "Nieprawidłowy e-mail lub hasło.";
  }
  if (message.includes("email not confirmed")) {
    return "Najpierw potwierdź adres e-mail przez link otrzymany w wiadomości.";
  }
  if (message.includes("already registered") || message.includes("already exists")) {
    return "Konto z tym adresem e-mail już istnieje.";
  }
  if (message.includes("password")) {
    return "Hasło musi mieć co najmniej 6 znaków.";
  }

  return "Nie udało się wykonać tej operacji. Spróbuj ponownie.";
}

async function loadQuota() {
  if (!state.session) return;

  const { data, error } = await supabaseClient.rpc("get_my_quota");

  if (error) {
    console.error("Błąd limitu:", error);
    showToast("Nie udało się pobrać limitu wyszukiwań.");
    return;
  }

  state.quota = Array.isArray(data) ? data[0] : data;
  renderQuota();
}

function renderQuota() {
  if (!state.session || !state.quota) return;

  const quota = state.quota;
  const limit = Number(quota.monthly_limit || 25);
  const used = Number(quota.used || 0);
  const remaining = Number(quota.remaining ?? Math.max(limit - used, 0));
  const percent = Math.min((used / Math.max(limit, 1)) * 100, 100);

  $("#quotaPlanName").textContent = `Pakiet ${quota.plan_name || "Bezpłatny"}`;
  $("#quotaRemaining").textContent = remaining;
  $("#quotaUsage").textContent = `${used} / ${limit}`;
  $("#quotaProgressBar").style.width = `${percent}%`;

  const endDate = quota.period_end
    ? new Date(quota.period_end).toLocaleDateString("pl-PL")
    : "—";
  $("#quotaRenewal").textContent = `Odnowienie: ${endDate}`;

  $$(".plan-card").forEach(card =>
    card.classList.toggle("current-plan", card.dataset.plan === quota.plan_code)
  );
}

async function reserveSearch(requestId, city, category, radius) {
  const { data, error } = await supabaseClient.rpc("reserve_my_search", {
    p_request_id: requestId,
    p_city: city,
    p_category: category,
    p_radius: radius
  });

  if (error) throw new Error("QUOTA_SERVICE_ERROR");

  const result = Array.isArray(data) ? data[0] : data;
  if (!result?.allowed) {
    state.quota = {
      ...(state.quota || {}),
      used: result?.used ?? state.quota?.used ?? 25,
      monthly_limit: result?.monthly_limit ?? state.quota?.monthly_limit ?? 25,
      remaining: 0
    };
    renderQuota();
    throw new Error("QUOTA_EXCEEDED");
  }

  state.quota = {
    ...(state.quota || {}),
    used: result.used,
    monthly_limit: result.monthly_limit,
    remaining: result.remaining
  };
  renderQuota();
}

async function completeSearch(requestId, source, resultCount) {
  const { error } = await supabaseClient.rpc("complete_my_search", {
    p_request_id: requestId,
    p_source: source,
    p_result_count: resultCount
  });
  if (error) console.error("Nie udało się zakończyć zapisu wyszukiwania:", error);
  await loadQuota();
}

async function failSearch(requestId) {
  const { error } = await supabaseClient.rpc("fail_my_search", {
    p_request_id: requestId
  });
  if (error) console.error("Nie udało się anulować naliczenia:", error);
  await loadQuota();
}

async function handleSearch(event) {
  event.preventDefault();
  clearMessages();

  if (!state.session) {
    openAuthDialog();
    return;
  }

  const city = $("#city").value.trim();
  const category = $("#category").value;
  const radius = Number($("#radius").value);
  const requestId = createRequestId();
  let reserved = false;

  setLoading(true);

  try {
    setLoadingStage("Sprawdzam limit…");
    await reserveSearch(requestId, city, category, radius);
    reserved = true;

    const location = await geocodeCity(city);
    const elements = await fetchBusinesses(
      location.lat,
      location.lon,
      radius,
      category
    );

    state.results = normalizeBusinesses(elements, category);
    state.lastSearch = { city, category, radius, location };
    $("#resultsTitle").textContent = `${categoryLabels[category]} — ${city}`;
    resultsSection.classList.toggle("hidden", state.results.length === 0);
    emptyState.classList.toggle("hidden", state.results.length !== 0);
    renderResults();

    await completeSearch(requestId, "openstreetmap", state.results.length);
  } catch (error) {
    console.error(error);

    if (reserved && error.message !== "QUOTA_EXCEEDED") {
      await failSearch(requestId);
    }

    if (error.message === "QUOTA_EXCEEDED") {
      openPlansDialog();
    }

    errorBox.textContent = friendlyError(error);
    errorBox.classList.remove("hidden");

    if (error.message !== "QUOTA_EXCEEDED") {
      resultsSection.classList.add("hidden");
      emptyState.classList.add("hidden");
    }
  } finally {
    setLoading(false);
  }
}

function createRequestId() {
  if (crypto.randomUUID) return crypto.randomUUID();

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, char => {
    const random = Math.random() * 16 | 0;
    const value = char === "x" ? random : (random & 0x3 | 0x8);
    return value.toString(16);
  });
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
        headers: { Accept: "application/json" },
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
    setLoadingStage(
      index === 0 ? "Pobieram firmy…" : "Próbuję serwera zapasowego…"
    );

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
      const website = cleanUrl(
        tags.website || tags["contact:website"] || tags.url || ""
      );
      const phone = clean(
        tags.phone || tags["contact:phone"] || tags.mobile || ""
      );
      const email = clean(tags.email || tags["contact:email"] || "");
      const facebook = cleanUrl(
        tags["contact:facebook"] || tags.facebook || ""
      );
      const instagram = cleanUrl(
        tags["contact:instagram"] || tags.instagram || ""
      );
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
  if (company.address && company.address !== "Adres niepodany w danych") {
    score += 10;
  }
  return Math.min(score, 100);
}

function leadQuality(score) {
  if (score >= 65) return { label: "WYSOKI", className: "high" };
  if (score >= 40) return { label: "ŚREDNI", className: "medium" };
  return { label: "DO WERYFIKACJI", className: "low" };
}

function buildAddress(tags) {
  const street = [tags["addr:street"], tags["addr:housenumber"]]
    .filter(Boolean)
    .join(" ");
  const city = tags["addr:city"] || tags["addr:place"] || "";
  const postcode = tags["addr:postcode"] || "";
  const full = [
    street,
    [postcode, city].filter(Boolean).join(" ")
  ].filter(Boolean).join(", ");

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
  if (/facebook\.com|instagram\.com/i.test(text)) {
    return `https://${text.replace(/^\/+/, "")}`;
  }
  return text;
}

function getFilteredResults() {
  const filtered = state.results.filter(company => {
    if ($("#onlyNoWebsite").checked && company.hasWebsite) return false;
    if ($("#hideUnnamed").checked && !company.hasRealName) return false;
    if (
      $("#onlyContact").checked &&
      !company.phone &&
      !company.email &&
      !company.facebook &&
      !company.instagram
    ) return false;
    if ($("#onlyPhone").checked && !company.phone) return false;
    if (
      $("#onlySocial").checked &&
      !company.facebook &&
      !company.instagram
    ) return false;
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

  resultsContainer.innerHTML = list
    .map(company => companyCard(company, "results"))
    .join("");

  emptyState.classList.toggle("hidden", list.length !== 0);
}

async function migrateLegacyLeads() {
  if (!state.session) return;

  let legacy = [];
  try {
    legacy = JSON.parse(localStorage.getItem("leadfinder.saved") || "[]");
  } catch {
    legacy = [];
  }

  if (!legacy.length) return;

  const rows = legacy
    .filter(company => company?.id && company?.name)
    .map(company => companyToDatabaseRow(company));

  if (!rows.length) return;

  const { error } = await supabaseClient
    .from("saved_leads")
    .upsert(rows, { onConflict: "user_id,external_id" });

  if (!error) {
    localStorage.removeItem("leadfinder.saved");
  }
}

async function loadSavedLeads() {
  if (!state.session) {
    state.saved = [];
    renderSaved();
    return;
  }

  const { data, error } = await supabaseClient
    .from("saved_leads")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Błąd zapisanych leadów:", error);
    showToast("Nie udało się pobrać zapisanych firm.");
    return;
  }

  state.saved = (data || []).map(databaseRowToCompany);
  renderSaved();
  renderResults();
}

function renderSaved() {
  const status = $("#statusFilter")?.value || "";
  const list = status
    ? state.saved.filter(item => item.status === status)
    : state.saved;

  const interested = state.saved.filter(
    item => item.status === "interested"
  ).length;

  $("#savedStats").textContent = state.session
    ? `Zapisane: ${state.saved.length} • Zainteresowani: ${interested}`
    : "Zaloguj się, aby zobaczyć zapisane leady.";

  savedContainer.innerHTML = list
    .map(company => companyCard(company, "saved"))
    .join("");

  savedEmpty.classList.toggle(
    "hidden",
    !state.session || list.length !== 0
  );
}

function companyCard(company, source) {
  const isSaved = state.saved.some(item => item.id === company.id);
  const city = state.lastSearch?.city || "";
  const searchPhrase = [company.name, city].filter(Boolean).join(" ");
  const encodedPhrase = encodeURIComponent(searchPhrase);
  const mapUrl =
    `https://www.google.com/maps/search/?api=1&query=${encodedPhrase}`;
  const googleUrl =
    `https://www.google.com/search?q=${encodedPhrase}`;
  const facebookSearchUrl =
    `https://www.google.com/search?q=${encodeURIComponent(`site:facebook.com ${searchPhrase}`)}`;

  const siteBadge = company.hasWebsite
    ? `<span class="badge has-site">MA STRONĘ</span>`
    : `<span class="badge no-site">BRAK WWW</span>`;

  const quality = company.leadQuality ||
    leadQuality(company.leadScore || calculateLeadScore(company));

  const socials = [
    company.facebook
      ? `<a href="${escapeAttr(company.facebook)}" target="_blank" rel="noopener">Facebook</a>`
      : "",
    company.instagram
      ? `<a href="${escapeAttr(company.instagram)}" target="_blank" rel="noopener">Instagram</a>`
      : ""
  ].filter(Boolean).join(" · ");

  return `<article class="card">
    <div class="card-top">
      <div>
        <h3>${escapeHtml(company.name)}</h3>
        <p class="address">${escapeHtml(company.address)}</p>
      </div>
      <div class="badge-stack">
        ${siteBadge}
        <span class="quality-badge ${quality.className}">
          ${quality.label} · ${company.leadScore || 0}/100
        </span>
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

async function saveCompany(company) {
  if (!state.session) {
    openAuthDialog();
    return;
  }

  if (state.saved.some(item => item.id === company.id)) {
    showToast("Ta firma jest już zapisana.");
    return;
  }

  const row = companyToDatabaseRow(company);
  const { data, error } = await supabaseClient
    .from("saved_leads")
    .upsert(row, { onConflict: "user_id,external_id" })
    .select()
    .single();

  if (error) {
    console.error(error);
    showToast("Nie udało się zapisać firmy.");
    return;
  }

  state.saved.unshift(databaseRowToCompany(data));
  renderResults();
  renderSaved();
  showToast("Firma zapisana na Twoim koncie.");
}

async function removeCompany(company) {
  if (!state.session) return;

  const query = company.dbId
    ? supabaseClient.from("saved_leads").delete().eq("id", company.dbId)
    : supabaseClient
        .from("saved_leads")
        .delete()
        .eq("external_id", company.id);

  const { error } = await query;

  if (error) {
    console.error(error);
    showToast("Nie udało się usunąć leada.");
    return;
  }

  state.saved = state.saved.filter(item => item.id !== company.id);
  renderSaved();
  renderResults();
  showToast("Lead został usunięty.");
}

async function updateStatus(id, status) {
  if (!state.session) return;

  const company = state.saved.find(item => item.id === id);
  if (!company) return;

  const query = company.dbId
    ? supabaseClient
        .from("saved_leads")
        .update({ contact_status: status })
        .eq("id", company.dbId)
    : supabaseClient
        .from("saved_leads")
        .update({ contact_status: status })
        .eq("external_id", company.id);

  const { error } = await query;

  if (error) {
    console.error(error);
    showToast("Nie udało się zmienić statusu.");
    renderSaved();
    return;
  }

  company.status = status;
  renderSaved();
  showToast("Status został zaktualizowany.");
}

function companyToDatabaseRow(company) {
  return {
    user_id: state.session.user.id,
    external_id: company.id,
    name: company.name,
    category: company.category,
    address: company.address,
    phone: company.phone || null,
    email: company.email || null,
    website: company.website || null,
    facebook: company.facebook || null,
    instagram: company.instagram || null,
    latitude: company.lat || null,
    longitude: company.lon || null,
    source: "openstreetmap",
    lead_score: company.leadScore || 0,
    contact_status: company.status || "new"
  };
}

function databaseRowToCompany(row) {
  const company = {
    dbId: row.id,
    id: row.external_id || row.id,
    name: row.name,
    hasRealName: Boolean(row.name),
    category: row.category || "",
    categoryLabel: categoryLabels[row.category] || row.category || "firma",
    address: row.address || "Adres niepodany w danych",
    phone: row.phone || "",
    email: row.email || "",
    website: row.website || "",
    facebook: row.facebook || "",
    instagram: row.instagram || "",
    lat: row.latitude,
    lon: row.longitude,
    hasWebsite: Boolean(row.website),
    leadScore: Number(row.lead_score || 0),
    status: row.contact_status || "new",
    createdAt: row.created_at
  };

  company.leadQuality = leadQuality(company.leadScore);
  return company;
}

function findCompany(id, source) {
  const list = source === "saved" ? state.saved : state.results;
  return list.find(item => item.id === id);
}

function openMessage(company) {
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
  $$(".view").forEach(view =>
    view.classList.toggle("active", view.id === viewId)
  );
  $$(".nav-btn").forEach(btn =>
    btn.classList.toggle("active", btn.dataset.view === viewId)
  );

  if (viewId === "savedView") renderSaved();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function openPlansDialog() {
  renderQuota();
  plansDialog.showModal();
}

function exportCsv(list, filename) {
  if (!list.length) {
    showToast("Brak danych do eksportu.");
    return;
  }

  const headers = [
    "Nazwa", "Branża", "Adres", "Telefon", "E-mail", "Strona",
    "Facebook", "Instagram", "Status", "Mapa"
  ];

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

  const csv = "\ufeff" +
    [headers, ...rows]
      .map(row => row.map(csvCell).join(";"))
      .join("\n");

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

function setLoadingStage(text) {
  searchBtn.querySelector(".btn-label").textContent = text;
}

function setLoading(isLoading) {
  searchBtn.disabled = isLoading;
  searchBtn.querySelector(".spinner").classList.toggle("hidden", !isLoading);

  if (!isLoading) {
    searchBtn.querySelector(".btn-label").textContent =
      state.session ? "Szukaj firm" : "Zaloguj się, aby szukać";
  }
}

function clearMessages() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function friendlyError(error) {
  if (error.message === "QUOTA_EXCEEDED") {
    return "Wykorzystałeś miesięczny limit wyszukiwań. Wybierz wyższy pakiet albo poczekaj na odnowienie limitu.";
  }
  if (error.message === "QUOTA_SERVICE_ERROR") {
    return "Nie udało się sprawdzić limitu konta. Uruchom poprawkę SQL i spróbuj ponownie.";
  }
  if (error.message === "CITY_NOT_FOUND") {
    return "Nie znaleziono tej miejscowości. Sprawdź pisownię i spróbuj ponownie.";
  }
  if (error.message === "RATE_LIMIT") {
    return "Publiczny serwer jest chwilowo przeciążony. Spróbuj ponownie za moment.";
  }
  if (error.message === "GEOCODING_FAILED") {
    return "Nie udało się ustalić położenia miasta.";
  }
  if (error.message === "GEOCODING_TIMEOUT") {
    return "Serwer lokalizacji nie odpowiedział. Spróbuj ponownie za chwilę.";
  }
  if (error.message === "OVERPASS_TIMEOUT") {
    return "Serwery firm nie odpowiedziały w wyznaczonym czasie. Spróbuj ponownie albo wybierz mniejszy promień.";
  }
  if (error.message === "OVERPASS_FAILED") {
    return "Nie udało się pobrać firm. Publiczny serwer OpenStreetMap może być przeciążony.";
  }

  return "Wystąpił błąd połączenia. Sprawdź internet i spróbuj ponownie.";
}

function showToast(text) {
  const toast = $("#toast");
  toast.textContent = text;
  toast.classList.remove("hidden");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(
    () => toast.classList.add("hidden"),
    2800
  );
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
