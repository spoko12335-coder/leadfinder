const SUPABASE_URL = "https://dgvhhzfhhwrbhdxaolap.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ibOSYMgLX6RHRv5wVQIsMg_-njehHH9";
const MAX_RESULTS_PER_SEARCH = 10;

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
  profile: null,
  quota: null,
  orders: [],
  paymentSettings: null,
  currentOrder: null,
  adminOrders: [],
  lastSearch: null,
  detectedLocation: null,
  selectedCity: null,
  citySuggestions: [],
  citySuggestionTimer: null,
  citySuggestionController: null,
  citySuggestionCache: new Map(),
  recentCities: [],
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
  restaurant: ['nwr["amenity"="restaurant"]'],
  cafe: ['nwr["amenity"="cafe"]'],
  bakery: ['nwr["shop"="bakery"]'],
  florist: ['nwr["shop"="florist"]'],
  hotel: [
    'nwr["tourism"="hotel"]',
    'nwr["tourism"="guest_house"]'
  ],
  accountant: ['nwr["office"="accountant"]'],
  real_estate: ['nwr["office"="estate_agent"]'],
  retail: ['nwr["shop"]']
};

const categoryFallbackQueries = {
  hairdresser: [
    'nwr["shop"]["name"~"fryzjer|barber|hair",i]',
    'nwr["craft"]["name"~"fryzjer|barber|hair",i]',
    'nwr["name"~"fryzjer|barber|hair",i]["phone"]',
    'nwr["name"~"fryzjer|barber|hair",i]["contact:phone"]'
  ],
  beauty: [
    'nwr["shop"]["name"~"kosmet|beauty|urod",i]',
    'nwr["office"="company"]["name"~"kosmet|beauty|urod",i]',
    'nwr["name"~"kosmet|beauty|urod",i]["phone"]',
    'nwr["name"~"kosmet|beauty|urod",i]["contact:phone"]'
  ],
  nails: [
    'nwr["shop"]["name"~"paznok|manicure|nail",i]',
    'nwr["office"="company"]["name"~"paznok|manicure|nail",i]',
    'nwr["name"~"paznok|manicure|nail",i]["phone"]',
    'nwr["name"~"paznok|manicure|nail",i]["contact:phone"]'
  ],
  car_repair: [
    'nwr["shop"]["name"~"mechanik|warsztat|auto.?serwis|wulkaniz",i]',
    'nwr["craft"]["name"~"mechanik|warsztat|auto.?serwis|wulkaniz",i]',
    'nwr["name"~"mechanik|warsztat|auto.?serwis|wulkaniz",i]["phone"]',
    'nwr["name"~"mechanik|warsztat|auto.?serwis|wulkaniz",i]["contact:phone"]'
  ],
  plumber: [
    'nwr["craft"="heating_engineer"]',
    'nwr["office"="company"]["name"~"hydraul|wod.?kan|sanitar|instalacj|ogrzew",i]',
    'nwr["craft"]["name"~"hydraul|wod.?kan|sanitar|instalacj|ogrzew",i]',
    'nwr["name"~"hydraul|wod.?kan|sanitar|instalacj|ogrzew",i]["phone"]',
    'nwr["name"~"hydraul|wod.?kan|sanitar|instalacj|ogrzew",i]["contact:phone"]'
  ],
  electrician: [
    'nwr["office"="company"]["name"~"elektryk|elektr|instalacj.*elektr",i]',
    'nwr["craft"]["name"~"elektryk|elektr|instalacj.*elektr",i]',
    'nwr["name"~"elektryk|elektr|instalacj.*elektr",i]["phone"]',
    'nwr["name"~"elektryk|elektr|instalacj.*elektr",i]["contact:phone"]'
  ],
  builder: [
    'nwr["office"="company"]["name"~"budowl|remont|wykończe|wykoncze",i]',
    'nwr["craft"]["name"~"budowl|remont|wykończe|wykoncze",i]',
    'nwr["name"~"budowl|remont|wykończe|wykoncze",i]["phone"]',
    'nwr["name"~"budowl|remont|wykończe|wykoncze",i]["contact:phone"]'
  ],
  photographer: [
    'nwr["office"="company"]["name"~"fotograf|foto|photography",i]',
    'nwr["craft"]["name"~"fotograf|foto|photography",i]',
    'nwr["name"~"fotograf|foto|photography",i]["phone"]',
    'nwr["name"~"fotograf|foto|photography",i]["contact:phone"]'
  ],
  physiotherapist: [
    'nwr["healthcare"]["name"~"fizjo|rehabilit",i]',
    'nwr["office"="company"]["name"~"fizjo|rehabilit",i]',
    'nwr["name"~"fizjo|rehabilit",i]["phone"]',
    'nwr["name"~"fizjo|rehabilit",i]["contact:phone"]'
  ],
  restaurant: [
    'nwr["amenity"="fast_food"]',
    'nwr["amenity"="food_court"]'
  ],
  cafe: [
    'nwr["name"~"kawiarn|cafe|coffee",i]["amenity"]',
    'nwr["name"~"kawiarn|cafe|coffee",i]["phone"]'
  ],
  bakery: [
    'nwr["name"~"piekarni|cukierni|bakery",i]["shop"]',
    'nwr["name"~"piekarni|cukierni|bakery",i]["phone"]'
  ],
  florist: [
    'nwr["name"~"kwiaciar|floryst",i]["shop"]',
    'nwr["name"~"kwiaciar|floryst",i]["phone"]'
  ],
  hotel: [
    'nwr["name"~"hotel|pensjonat|nocleg",i]["tourism"]',
    'nwr["name"~"hotel|pensjonat|nocleg",i]["phone"]'
  ],
  accountant: [
    'nwr["office"="company"]["name"~"księg|ksieg|rachunk",i]',
    'nwr["name"~"księg|ksieg|rachunk",i]["phone"]',
    'nwr["name"~"księg|ksieg|rachunk",i]["contact:phone"]'
  ],
  real_estate: [
    'nwr["office"="company"]["name"~"nieruchomo|estate",i]',
    'nwr["name"~"nieruchomo|estate",i]["phone"]',
    'nwr["name"~"nieruchomo|estate",i]["contact:phone"]'
  ],
  retail: [
    'nwr["shop"]["phone"]',
    'nwr["shop"]["contact:phone"]',
    'nwr["shop"]["website"]'
  ]
};

const categorySearchPhrases = {
  hairdresser: "fryzjer",
  beauty: "salon kosmetyczny",
  nails: "manicure paznokcie",
  car_repair: "mechanik samochodowy warsztat",
  plumber: "hydraulik instalacje sanitarne",
  electrician: "elektryk instalacje elektryczne",
  builder: "firma budowlana remonty",
  photographer: "fotograf",
  physiotherapist: "fizjoterapeuta rehabilitacja",
  restaurant: "restauracja",
  cafe: "kawiarnia",
  bakery: "piekarnia cukiernia",
  florist: "kwiaciarnia",
  hotel: "hotel pensjonat noclegi",
  accountant: "biuro rachunkowe księgowość",
  real_estate: "biuro nieruchomości",
  retail: "sklep"
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
  restaurant: "restauracja",
  cafe: "kawiarnia",
  bakery: "piekarnia lub cukiernia",
  florist: "kwiaciarnia",
  hotel: "hotel lub obiekt noclegowy",
  accountant: "biuro rachunkowe",
  real_estate: "biuro nieruchomości",
  retail: "sklep",
  custom: "własna branża"
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
const paymentDialog = $("#paymentDialog");
const adminDialog = $("#adminDialog");

bindEvents();
initApp();

function bindEvents() {
  searchForm.addEventListener("submit", handleSearch);
  $$('input[name="searchPurpose"]').forEach(input =>
    input.addEventListener("change", handlePurposeChange)
  );
  $("#category").addEventListener("change", handleCategoryChange);
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
  $("#guestRegisterBtn").addEventListener("click", openRegistrationDialog);
  $("#guestLoginBtn").addEventListener("click", openLoginDialog);
  $("#locateBtn").addEventListener("click", detectCurrentLocation);
  $("#city").addEventListener("input", handleCityInput);
  $("#city").addEventListener("keydown", handleCityKeydown);
  $("#city").addEventListener("focus", handleCityFocus);
  $("#citySuggestions").addEventListener("click", handleCitySuggestionClick);
  $("#clearSelectedCity").addEventListener("click", clearSelectedCity);
  document.addEventListener("click", handleOutsideCitySuggestions);
  $("#closeAuthDialog").addEventListener("click", () => authDialog.close());
  $("#closePlansDialog").addEventListener("click", () => plansDialog.close());
  $("#closePaymentDialog").addEventListener("click", () => paymentDialog.close());
  $("#closeAdminDialog").addEventListener("click", () => adminDialog.close());
  $("#openPlansBtn").addEventListener("click", openPlansDialog);
  $("#accountPlansBtn").addEventListener("click", () => {
    authDialog.close();
    openPlansDialog();
  });
  $("#logoutBtn").addEventListener("click", logout);
  $("#adminPanelBtn").addEventListener("click", () => {
    authDialog.close();
    openAdminDialog();
  });
  $("#refreshOrdersBtn").addEventListener("click", async () => {
    await loadMyOrders();
    showToast("Lista zamówień odświeżona.");
  });
  $("#refreshAdminOrdersBtn").addEventListener("click", loadAdminOrders);
  $("#paymentSettingsForm").addEventListener("submit", savePaymentSettings);
  $("#copyPaymentBtn").addEventListener("click", copyPaymentDetails);
  $("#loginForm").addEventListener("submit", login);
  $("#registerForm").addEventListener("submit", register);
  $("#closeDialog").addEventListener("click", () => messageDialog.close());
  $("#copyMessage").addEventListener("click", copyGeneratedMessage);

  $$(".auth-tab").forEach(button => {
    button.addEventListener("click", () => setAuthTab(button.dataset.authTab));
  });

  $$(".buy-plan").forEach(button => {
    button.addEventListener("click", () => createPlanOrder(button.dataset.planCode));
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

  state.recentCities = loadRecentCities();
  handlePurposeChange();
  handleCategoryChange();
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
    await loadProfile();
    await loadQuota();
    await loadPaymentSettings();
    await loadMyOrders();
    await migrateLegacyLeads();
    await loadSavedLeads();
  } else {
    state.profile = null;
    state.quota = null;
    state.orders = [];
    state.paymentSettings = null;
    state.saved = [];
    renderQuota();
    renderMyOrders();
    renderSaved();
  }
}

function updateAuthUI() {
  const loggedIn = Boolean(state.session);

  $("#authLoadingScreen").classList.add("hidden");
  $("#guestLanding").classList.toggle("hidden", loggedIn);
  $("#appShell").classList.toggle("hidden", !loggedIn);
  document.body.classList.toggle("guest-mode", !loggedIn);

  $("#authBtn").textContent = loggedIn ? "Konto" : "Zaloguj";
  $("#quotaPanel").classList.toggle("hidden", !loggedIn);
  $("#loginRequiredNotice").classList.toggle("hidden", loggedIn);
  $("#savedLoginNotice").classList.toggle("hidden", loggedIn);
  $("#authGuestContent").classList.toggle("hidden", loggedIn);
  $("#authUserContent").classList.toggle("hidden", !loggedIn);
  $("#adminPanelBtn").classList.toggle(
    "hidden",
    !loggedIn || !state.profile?.is_admin
  );

  if (loggedIn) {
    const email = state.session.user.email || "";
    $("#quotaEmail").textContent = email;
    $("#accountDialogEmail").textContent = email;
    searchBtn.querySelector(".btn-label").textContent = "Szukaj firm";
  } else {
    searchBtn.querySelector(".btn-label").textContent =
      "Zaloguj się, aby szukać";
  }
}

function openRegistrationDialog() {
  clearAuthMessage();
  setAuthTab("register");
  authDialog.showModal();
}

function openLoginDialog() {
  clearAuthMessage();
  setAuthTab("login");
  authDialog.showModal();
}

function openAuthDialog() {
  clearAuthMessage();

  if (state.session) {
    $("#authDialogTitle").textContent = "Twoje konto";
  } else {
    $("#authDialogTitle").textContent = "Utwórz darmowe konto";
    setAuthTab("register");
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

async function loadProfile() {
  if (!state.session) return;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id,email,full_name,is_admin")
    .eq("id", state.session.user.id)
    .single();

  if (error) {
    console.error("Błąd profilu:", error);
    state.profile = null;
  } else {
    state.profile = data;
  }

  updateAuthUI();
}

async function loadPaymentSettings() {
  if (!state.session) return;

  const { data, error } = await supabaseClient.rpc("get_payment_settings");

  if (error) {
    console.error("Błąd danych płatności:", error);
    state.paymentSettings = null;
    return;
  }

  state.paymentSettings = Array.isArray(data) ? data[0] : data;
}

async function loadMyOrders() {
  if (!state.session) {
    state.orders = [];
    renderMyOrders();
    return;
  }

  const { data, error } = await supabaseClient
    .from("plan_orders")
    .select("id,order_code,plan_code,amount_pln,status,created_at,paid_at,activated_until,plans(name,monthly_search_limit)")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("Błąd zamówień:", error);
    showToast("Nie udało się pobrać zamówień.");
    return;
  }

  state.orders = data || [];
  renderMyOrders();
}

function renderMyOrders() {
  const container = $("#myOrders");
  const empty = $("#myOrdersEmpty");
  if (!container || !empty) return;

  if (!state.session || !state.orders.length) {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  container.innerHTML = state.orders.map(order => {
    const planName = order.plans?.name || order.plan_code;
    const limit = order.plans?.monthly_search_limit || "";
    return `<article class="order-card">
      <div>
        <strong>${escapeHtml(order.order_code)}</strong>
        <span>${escapeHtml(planName)}${limit ? ` · ${limit} wyszukiwań` : ""}</span>
      </div>
      <div class="order-card-side">
        <strong>${formatPrice(order.amount_pln)}</strong>
        <span class="order-status ${escapeAttr(order.status)}">${orderStatusLabel(order.status)}</span>
      </div>
    </article>`;
  }).join("");
}

async function createPlanOrder(planCode) {
  if (!state.session) {
    plansDialog.close();
    openAuthDialog();
    return;
  }

  const button = document.querySelector(`[data-plan-code="${CSS.escape(planCode)}"]`);
  if (button) button.disabled = true;

  try {
    const { data, error } = await supabaseClient.rpc("create_my_order", {
      p_plan_code: planCode
    });

    if (error) throw error;

    state.currentOrder = Array.isArray(data) ? data[0] : data;
    await loadPaymentSettings();
    await loadMyOrders();
    plansDialog.close();
    renderPaymentDialog();
    paymentDialog.showModal();
  } catch (error) {
    console.error("Błąd zamówienia:", error);
    showToast("Nie udało się utworzyć zamówienia.");
  } finally {
    if (button) button.disabled = false;
  }
}

function renderPaymentDialog() {
  const order = state.currentOrder;
  const settings = state.paymentSettings || {};
  if (!order) return;

  const account = formatBankAccount(settings.bank_account || "");
  const hasAccount = Boolean(account);
  $("#paymentDialogTitle").textContent = `${order.plan_name} — ${order.monthly_search_limit} wyszukiwań`;

  $("#paymentInstructions").innerHTML = `
    <div class="payment-row"><span>Kwota</span><strong>${formatPrice(order.amount_pln)}</strong></div>
    <div class="payment-row"><span>Tytuł przelewu</span><strong>${escapeHtml(order.order_code)}</strong></div>
    <div class="payment-row"><span>Odbiorca</span><strong>${escapeHtml(settings.seller_name || "Do uzupełnienia przez administratora")}</strong></div>
    <div class="payment-row"><span>Numer konta</span><strong>${hasAccount ? escapeHtml(account) : "Nie skonfigurowano"}</strong></div>
    ${settings.bank_name ? `<div class="payment-row"><span>Bank</span><strong>${escapeHtml(settings.bank_name)}</strong></div>` : ""}
    ${!hasAccount ? `<div class="payment-warning">Numer konta nie został jeszcze dodany. Skontaktuj się: <a href="mailto:${escapeAttr(settings.payment_email || "logo.wizytowka@gmail.com")}">${escapeHtml(settings.payment_email || "logo.wizytowka@gmail.com")}</a></div>` : ""}
    ${settings.instructions ? `<div class="payment-note">${escapeHtml(settings.instructions)}</div>` : ""}
  `;
}

async function copyPaymentDetails() {
  const order = state.currentOrder;
  const settings = state.paymentSettings || {};
  if (!order) return;

  const text = [
    `Pakiet: ${order.plan_name} (${order.monthly_search_limit} wyszukiwań)`,
    `Kwota: ${formatPrice(order.amount_pln)}`,
    `Odbiorca: ${settings.seller_name || "nie skonfigurowano"}`,
    `Numer konta: ${formatBankAccount(settings.bank_account || "") || "nie skonfigurowano"}`,
    `Tytuł przelewu: ${order.order_code}`
  ].join("\n");

  try {
    await navigator.clipboard.writeText(text);
    showToast("Dane do przelewu skopiowane.");
  } catch {
    showToast("Nie udało się skopiować danych.");
  }
}

async function openAdminDialog() {
  if (!state.profile?.is_admin) {
    showToast("Brak uprawnień administratora.");
    return;
  }

  await loadPaymentSettings();
  fillPaymentSettingsForm();
  await loadAdminOrders();
  adminDialog.showModal();
}

function fillPaymentSettingsForm() {
  const settings = state.paymentSettings || {};
  $("#settingSellerName").value = settings.seller_name || "";
  $("#settingBankAccount").value = settings.bank_account || "";
  $("#settingBankName").value = settings.bank_name || "";
  $("#settingPaymentEmail").value = settings.payment_email || "logo.wizytowka@gmail.com";
  $("#settingInstructions").value = settings.instructions || "";
}

async function savePaymentSettings(event) {
  event.preventDefault();

  const { data, error } = await supabaseClient.rpc("admin_save_payment_settings", {
    p_seller_name: $("#settingSellerName").value.trim(),
    p_bank_account: $("#settingBankAccount").value.replace(/\s+/g, ""),
    p_bank_name: $("#settingBankName").value.trim(),
    p_payment_email: $("#settingPaymentEmail").value.trim(),
    p_instructions: $("#settingInstructions").value.trim()
  });

  if (error) {
    console.error(error);
    showToast("Nie udało się zapisać danych płatności.");
    return;
  }

  state.paymentSettings = Array.isArray(data) ? data[0] : data;
  showToast("Dane płatności zapisane.");
}

async function loadAdminOrders() {
  if (!state.profile?.is_admin) return;

  const { data, error } = await supabaseClient.rpc("admin_list_orders", {
    p_status: "pending"
  });

  if (error) {
    console.error("Błąd zamówień administratora:", error);
    showToast("Nie udało się pobrać zamówień.");
    return;
  }

  state.adminOrders = data || [];
  renderAdminOrders();
}

function renderAdminOrders() {
  const container = $("#adminOrders");
  const empty = $("#adminOrdersEmpty");

  if (!state.adminOrders.length) {
    container.innerHTML = "";
    empty.classList.remove("hidden");
    return;
  }

  empty.classList.add("hidden");
  container.innerHTML = state.adminOrders.map(order => `
    <article class="admin-order-card">
      <div class="admin-order-main">
        <strong>${escapeHtml(order.order_code)}</strong>
        <span>${escapeHtml(order.user_email || "brak e-maila")}</span>
        <span>${escapeHtml(order.plan_name)} · ${order.monthly_search_limit} wyszukiwań · ${formatPrice(order.amount_pln)}</span>
        <small>${new Date(order.created_at).toLocaleString("pl-PL")}</small>
      </div>
      <div class="admin-order-actions">
        <button class="approve-order" data-order-id="${escapeAttr(order.order_id)}" type="button">Potwierdź wpłatę</button>
        <button class="reject-order" data-order-id="${escapeAttr(order.order_id)}" type="button">Odrzuć</button>
      </div>
    </article>
  `).join("");

  container.querySelectorAll(".approve-order").forEach(button => {
    button.addEventListener("click", () => approveOrder(button.dataset.orderId));
  });
  container.querySelectorAll(".reject-order").forEach(button => {
    button.addEventListener("click", () => rejectOrder(button.dataset.orderId));
  });
}

async function approveOrder(orderId) {
  if (!confirm("Potwierdzić wpłatę i aktywować pakiet na 30 dni?")) return;

  const { error } = await supabaseClient.rpc("admin_approve_order", {
    p_order_id: orderId
  });

  if (error) {
    console.error(error);
    showToast("Nie udało się aktywować pakietu.");
    return;
  }

  showToast("Wpłata potwierdzona. Pakiet został aktywowany.");
  await loadAdminOrders();
}

async function rejectOrder(orderId) {
  if (!confirm("Odrzucić to zamówienie?")) return;

  const { error } = await supabaseClient.rpc("admin_reject_order", {
    p_order_id: orderId
  });

  if (error) {
    console.error(error);
    showToast("Nie udało się odrzucić zamówienia.");
    return;
  }

  showToast("Zamówienie odrzucone.");
  await loadAdminOrders();
}

function orderStatusLabel(status) {
  const labels = {
    pending: "Oczekuje na wpłatę",
    paid: "Opłacone — aktywne",
    rejected: "Odrzucone",
    cancelled: "Anulowane",
    expired: "Wygasłe"
  };
  return labels[status] || status;
}

function formatPrice(value) {
  return `${Number(value || 0).toFixed(2).replace(".", ",")} zł`;
}

function formatBankAccount(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  const first = digits.slice(0, 2);
  const rest = digits.slice(2).match(/.{1,4}/g) || [];
  return [first, ...rest].filter(Boolean).join(" ");
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
  const limit = Number(quota.monthly_limit || 3);
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
      used: result?.used ?? state.quota?.used ?? 3,
      monthly_limit: result?.monthly_limit ?? state.quota?.monthly_limit ?? 3,
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

function getSearchPurpose() {
  return document.querySelector('input[name="searchPurpose"]:checked')?.value
    || "website";
}

function handlePurposeChange() {
  const purpose = getSearchPurpose();
  const salesMode = purpose === "sales";

  $("#salesOfferFields").classList.toggle("hidden", !salesMode);
  $("#offerName").required = salesMode;
  $("#onlyNoWebsite").checked = !salesMode;
  $("#onlyContact").checked = true;
  $("#purposeHint").textContent = salesMode
    ? "Znajdziemy firmy, do których możesz kierować ofertę produktu lub usługi. Firmy mogą posiadać własną stronę WWW."
    : "Znajdziemy firmy, które w danych OpenStreetMap nie mają podanej własnej strony internetowej.";

  resultsSection.classList.add("hidden");
  emptyState.classList.add("hidden");
}

function handleCategoryChange() {
  const custom = $("#category").value === "custom";
  $("#customCategoryField").classList.toggle("hidden", !custom);
  $("#customCategory").required = custom;
}

function getCategoryDefinition(category, customCategory) {
  if (category !== "custom") {
    return {
      key: category,
      label: categoryLabels[category] || category,
      exactSelectors: categoryQueries[category] || [],
      fallbackSelectors: categoryFallbackQueries[category] || [],
      searchPhrase: categorySearchPhrases[category] || categoryLabels[category] || category
    };
  }

  const label = clean(customCategory);
  const regex = buildSafeOverpassRegex(label);

  return {
    key: "custom",
    label,
    exactSelectors: [],
    fallbackSelectors: regex
      ? [
          `nwr["shop"]["name"~"${regex}",i]`,
          `nwr["office"]["name"~"${regex}",i]`,
          `nwr["craft"]["name"~"${regex}",i]`,
          `nwr["amenity"]["name"~"${regex}",i]`,
          `nwr["tourism"]["name"~"${regex}",i]`,
          `nwr["healthcare"]["name"~"${regex}",i]`,
          `nwr["name"~"${regex}",i]["phone"]`,
          `nwr["name"~"${regex}",i]["contact:phone"]`
        ]
      : [],
    searchPhrase: label
  };
}

function buildSafeOverpassRegex(value) {
  const words = clean(value)
    .split(/\s+/)
    .map(word => word.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&"))
    .filter(word => word.length >= 2)
    .slice(0, 5);

  return words.join("|");
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
  const customCategory = $("#customCategory").value.trim();
  const radius = Number($("#radius").value);
  const purpose = getSearchPurpose();
  const offerName = $("#offerName").value.trim();
  const offerBenefit = $("#offerBenefit").value.trim();
  const categoryDefinition = getCategoryDefinition(category, customCategory);
  const requestId = createRequestId();

  if (category === "custom" && !categoryDefinition.label) {
    errorBox.textContent = "Wpisz branżę firm, których szukasz.";
    errorBox.classList.remove("hidden");
    return;
  }

  if (purpose === "sales" && !offerName) {
    errorBox.textContent = "Wpisz produkt lub usługę, którą chcesz zaoferować.";
    errorBox.classList.remove("hidden");
    return;
  }
  let reserved = false;

  $("#emptyState h3").textContent = "Brak wyników";
  $("#emptyState p").textContent = "Zwiększ promień albo wybierz inną branżę.";

  setLoading(true);

  try {
    setLoadingStage("Sprawdzam limit…");
    await reserveSearch(
      requestId,
      city,
      category === "custom" ? `custom:${categoryDefinition.label}` : category,
      radius
    );
    reserved = true;

    const location = await ensureSelectedSearchLocation(city);
    const elements = await fetchBusinesses(
      location.lat,
      location.lon,
      radius,
      categoryDefinition,
      city
    );

    const normalizedResults = normalizeBusinesses(
      elements,
      categoryDefinition,
      city,
      purpose,
      offerName,
      offerBenefit
    );

    state.results = normalizedResults
      .filter(company => isUsableLead(company, purpose))
      .slice(0, MAX_RESULTS_PER_SEARCH);

    state.lastSearch = {
      city,
      category,
      categoryLabel: categoryDefinition.label,
      radius,
      purpose,
      offerName,
      offerBenefit,
      location
    };

    $("#resultsTitle").textContent = purpose === "sales"
      ? `Firmy do oferty: ${categoryDefinition.label} — ${city}`
      : `Firmy bez WWW: ${categoryDefinition.label} — ${city}`;

    const usableLeadCount = state.results.length;

    if (usableLeadCount === 0) {
      await failSearch(requestId);
      reserved = false;
      resultsSection.classList.add("hidden");
      emptyState.classList.remove("hidden");
      $("#emptyState h3").textContent = "Brak firm z publicznym kontaktem";
      $("#emptyState p").textContent =
        purpose === "website"
          ? "OpenStreetMap nie zawiera w tym obszarze firm bez strony WWW, które mają telefon, e-mail lub social media. Wyszukiwanie nie zostało odjęte z pakietu."
          : "OpenStreetMap nie zawiera w tym obszarze firm z publicznym telefonem, e-mailem, social media ani stroną WWW. Wyszukiwanie nie zostało odjęte z pakietu.";
      return;
    }

    resultsSection.classList.remove("hidden");
    emptyState.classList.add("hidden");
    renderResults();

    await completeSearch(requestId, "openstreetmap", usableLeadCount);
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

function handleCityInput() {
  const query = clean($("#city").value);

  if (
    state.selectedCity &&
    query.toLocaleLowerCase("pl") !==
      state.selectedCity.city.toLocaleLowerCase("pl") &&
    query.toLocaleLowerCase("pl") !==
      state.selectedCity.inputLabel.toLocaleLowerCase("pl")
  ) {
    resetSelectedCity(false);
  }

  if (
    state.detectedLocation &&
    query.toLocaleLowerCase("pl") !==
      state.detectedLocation.city.toLocaleLowerCase("pl")
  ) {
    state.detectedLocation = null;
  }

  clearTimeout(state.citySuggestionTimer);

  if (query.length < 2) {
    setCityLoading(false);

    if (!query && state.recentCities.length) {
      state.citySuggestions = state.recentCities.map(item => ({
        ...item,
        recent: true
      }));
      renderCitySuggestions("Ostatnio wybrane");
    } else {
      closeCitySuggestions();
    }

    setLocationStatus(
      "Wpisz nazwę miejscowości lub kod pocztowy i wybierz pozycję z listy.",
      "neutral"
    );
    return;
  }

  setCityLoading(true);
  setLocationStatus("Szukam miejscowości w Polsce…", "loading");

  state.citySuggestionTimer = setTimeout(() => {
    loadCitySuggestions(query);
  }, 450);
}

function handleCityFocus() {
  const query = clean($("#city").value);

  if (!query && state.recentCities.length) {
    state.citySuggestions = state.recentCities.map(item => ({
      ...item,
      recent: true
    }));
    renderCitySuggestions("Ostatnio wybrane");
    return;
  }

  if (query.length >= 2 && state.citySuggestions.length) {
    openCitySuggestions();
  }
}

function handleCityKeydown(event) {
  const container = $("#citySuggestions");
  if (container.classList.contains("hidden")) {
    if (event.key === "ArrowDown" && state.citySuggestions.length) {
      openCitySuggestions();
    }
    return;
  }

  const options = [...container.querySelectorAll("[role='option']")];
  if (!options.length) return;

  const activeIndex = options.findIndex(option =>
    option.classList.contains("active")
  );

  if (event.key === "ArrowDown") {
    event.preventDefault();
    setActiveCitySuggestion(
      options,
      activeIndex < options.length - 1 ? activeIndex + 1 : 0
    );
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    setActiveCitySuggestion(
      options,
      activeIndex > 0 ? activeIndex - 1 : options.length - 1
    );
  }

  if (event.key === "Enter") {
    event.preventDefault();
    const index = activeIndex >= 0 ? activeIndex : 0;
    selectCitySuggestion(Number(options[index].dataset.index));
  }

  if (event.key === "Escape") {
    closeCitySuggestions();
  }
}

function handleCitySuggestionClick(event) {
  const option = event.target.closest("[data-index]");
  if (!option) return;
  selectCitySuggestion(Number(option.dataset.index));
}

function handleOutsideCitySuggestions(event) {
  if (!event.target.closest(".city-autocomplete")) {
    closeCitySuggestions();
  }
}

async function loadCitySuggestions(query) {
  const normalizedQuery = normalizeCityQuery(query);

  if (state.citySuggestionCache.has(normalizedQuery)) {
    state.citySuggestions = state.citySuggestionCache.get(normalizedQuery);
    setCityLoading(false);
    renderCitySuggestions();
    return state.citySuggestions;
  }

  if (state.citySuggestionController) {
    state.citySuggestionController.abort();
  }

  const controller = new AbortController();
  state.citySuggestionController = controller;

  try {
    const photonResults = await fetchPhotonCitySuggestions(
      query,
      controller.signal
    );

    let nominatimResults = [];
    if (photonResults.length < 6 || containsPostcode(query)) {
      nominatimResults = await fetchNominatimCitySuggestions(
        query,
        controller.signal
      );
    }

    const suggestions = rankAndDeduplicateCities(
      [...photonResults, ...nominatimResults],
      query
    ).slice(0, 10);

    state.citySuggestions = suggestions;
    state.citySuggestionCache.set(normalizedQuery, suggestions);
    renderCitySuggestions();
    return suggestions;
  } catch (error) {
    if (error?.name === "AbortError") return [];

    console.error("Błąd podpowiedzi miejscowości:", error);
    state.citySuggestions = [];
    renderCitySuggestions();
    setLocationStatus(
      "Nie udało się pobrać podpowiedzi. Sprawdź internet i spróbuj ponownie.",
      "error"
    );
    return [];
  } finally {
    setCityLoading(false);
    if (state.citySuggestionController === controller) {
      state.citySuggestionController = null;
    }
  }
}

async function fetchPhotonCitySuggestions(query, signal) {
  const params = new URLSearchParams({
    q: query,
    lang: "pl",
    limit: "15",
    bbox: "14.07,49.00,24.15,54.90"
  });

  const response = await fetch(
    `https://photon.komoot.io/api/?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal
    }
  );

  if (!response.ok) return [];

  const data = await response.json();

  return (data.features || [])
    .map(normalizePhotonCitySuggestion)
    .filter(Boolean);
}

async function fetchNominatimCitySuggestions(query, signal) {
  const params = new URLSearchParams({
    q: `${query}, Polska`,
    format: "jsonv2",
    limit: "12",
    countrycodes: "pl",
    addressdetails: "1",
    namedetails: "1",
    dedupe: "1",
    "accept-language": "pl"
  });

  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params.toString()}`,
    {
      headers: { Accept: "application/json" },
      signal
    }
  );

  if (!response.ok) return [];

  const rows = await response.json();
  return rows.map(normalizeNominatimCitySuggestion).filter(Boolean);
}

function normalizePhotonCitySuggestion(feature) {
  const properties = feature.properties || {};
  const coordinates = feature.geometry?.coordinates || [];
  const type = normalizePlaceType(
    properties.type ||
    properties.osm_value ||
    properties.osm_key
  );

  const city = clean(
    properties.name ||
    properties.city ||
    properties.locality ||
    properties.district ||
    ""
  );

  const countryCode = clean(properties.countrycode || "").toLowerCase();
  if (!city || (countryCode && countryCode !== "pl")) return null;

  const lat = Number(coordinates[1]);
  const lon = Number(coordinates[0]);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const postcode = clean(properties.postcode || "");
  const county = clean(properties.county || "");
  const stateName = clean(properties.state || "");
  const district = clean(properties.district || "");
  const locality = clean(properties.locality || "");

  return buildCitySuggestion({
    city,
    postcode,
    county,
    stateName,
    district,
    municipality: locality,
    lat,
    lon,
    type,
    importance: Number(properties.extent ? 0.55 : 0.35),
    source: "photon"
  });
}

function normalizeNominatimCitySuggestion(row) {
  const address = row.address || {};
  const city = clean(
    row.namedetails?.name ||
    row.name ||
    address.city ||
    address.town ||
    address.village ||
    address.municipality ||
    address.suburb ||
    ""
  );

  const countryCode = clean(address.country_code || "").toLowerCase();
  if (!city || (countryCode && countryCode !== "pl")) return null;

  const lat = Number(row.lat);
  const lon = Number(row.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  return buildCitySuggestion({
    city,
    postcode: clean(address.postcode || ""),
    county: clean(address.county || ""),
    stateName: clean(address.state || ""),
    district: clean(address.city_district || address.suburb || ""),
    municipality: clean(address.municipality || ""),
    lat,
    lon,
    type: normalizePlaceType(row.type || row.addresstype || row.class),
    importance: Number(row.importance || 0),
    source: "nominatim"
  });
}

function buildCitySuggestion({
  city,
  postcode,
  county,
  stateName,
  district,
  municipality,
  lat,
  lon,
  type,
  importance,
  source
}) {
  const regionParts = uniqueNonEmpty([
    district && district !== city ? district : "",
    municipality && municipality !== city ? municipality : "",
    county && county !== city ? county : "",
    stateName
  ]);

  const inputLabel = postcode
    ? `${city}, ${postcode}`
    : city;

  return {
    city,
    postcode,
    county,
    municipality,
    state: stateName,
    district,
    lat,
    lon,
    type,
    typeLabel: placeTypeLabel(type),
    importance,
    source,
    inputLabel,
    subtitle: regionParts.join(" • "),
    displayName: uniqueNonEmpty([
      city,
      postcode,
      ...regionParts
    ]).join(", "),
    key: [
      city.toLocaleLowerCase("pl"),
      postcode,
      county.toLocaleLowerCase("pl"),
      stateName.toLocaleLowerCase("pl")
    ].join("|")
  };
}

function rankAndDeduplicateCities(items, query) {
  const queryText = normalizeSearchText(query);
  const queryPostcode = extractPostcode(query);
  const queryName = normalizeSearchText(
    query.replace(/\b\d{2}-?\d{3}\b/g, "")
  );

  const deduplicated = new Map();

  items.forEach(item => {
    if (!item || !isPolishCoordinate(item.lat, item.lon)) return;

    const existing = deduplicated.get(item.key);
    if (!existing || cityResultScore(item, queryName, queryPostcode) >
      cityResultScore(existing, queryName, queryPostcode)) {
      deduplicated.set(item.key, item);
    }
  });

  return [...deduplicated.values()]
    .map(item => ({
      ...item,
      score: cityResultScore(item, queryName || queryText, queryPostcode)
    }))
    .sort((a, b) =>
      b.score - a.score ||
      a.city.localeCompare(b.city, "pl") ||
      a.postcode.localeCompare(b.postcode, "pl")
    );
}

function cityResultScore(item, queryName, queryPostcode) {
  const cityName = normalizeSearchText(item.city);
  let score = Math.round((item.importance || 0) * 30);

  if (queryName) {
    if (cityName === queryName) score += 160;
    else if (cityName.startsWith(queryName)) score += 95;
    else if (cityName.includes(queryName)) score += 55;
    else score -= 15;
  }

  if (queryPostcode) {
    if (item.postcode === queryPostcode) score += 180;
    else if (item.postcode.startsWith(queryPostcode.slice(0, 2))) score += 25;
  }

  const typeScores = {
    city: 55,
    town: 48,
    village: 35,
    municipality: 25,
    suburb: 12,
    district: 8,
    place: 5
  };

  score += typeScores[item.type] || 0;
  if (item.postcode) score += 12;
  if (item.state) score += 5;
  if (item.source === "nominatim") score += 2;

  return score;
}

function renderCitySuggestions(sectionTitle = "") {
  const container = $("#citySuggestions");

  if (!state.citySuggestions.length) {
    container.innerHTML = `
      <div class="city-suggestion-empty">
        <strong>Nie znaleziono miejscowości</strong>
        <span>Sprawdź pisownię albo wpisz kod pocztowy, np. 44-200.</span>
      </div>
    `;
    openCitySuggestions();
    setLocationStatus(
      "Brak jednoznacznego wyniku. Zmień nazwę lub wpisz kod pocztowy.",
      "error"
    );
    return;
  }

  const header = sectionTitle
    ? `<div class="city-suggestions-header">${escapeHtml(sectionTitle)}</div>`
    : `<div class="city-suggestions-header">Wybierz konkretną miejscowość</div>`;

  container.innerHTML = header + state.citySuggestions
    .map((item, index) => `
      <button
        type="button"
        class="city-suggestion ${index === 0 ? "active" : ""}"
        role="option"
        aria-selected="${index === 0}"
        data-index="${index}"
      >
        <span class="city-place-icon" aria-hidden="true">⌖</span>
        <span class="city-suggestion-copy">
          <span class="city-suggestion-main">
            <strong>${escapeHtml(item.city)}</strong>
            ${item.postcode ? `<b>${escapeHtml(item.postcode)}</b>` : ""}
          </span>
          <small>${escapeHtml(item.subtitle || "Polska")}</small>
        </span>
        <span class="city-type-badge">${escapeHtml(item.recent ? "ostatnio" : item.typeLabel)}</span>
      </button>
    `)
    .join("");

  openCitySuggestions();
  setLocationStatus(
    "Wybierz właściwą miejscowość. Kod pocztowy i region pomagają uniknąć pomyłki.",
    "neutral"
  );
}

function setActiveCitySuggestion(options, index) {
  options.forEach((option, optionIndex) => {
    const active = optionIndex === index;
    option.classList.toggle("active", active);
    option.setAttribute("aria-selected", String(active));
  });

  options[index]?.scrollIntoView({ block: "nearest" });
}

function selectCitySuggestion(index) {
  const item = state.citySuggestions[index];
  if (!item) return;

  state.selectedCity = { ...item };
  state.detectedLocation = {
    lat: item.lat,
    lon: item.lon,
    city: item.city,
    postcode: item.postcode,
    displayName: item.displayName
  };

  $("#city").value = item.inputLabel;
  renderSelectedCity();
  saveRecentCity(item);
  closeCitySuggestions();

  setLocationStatus(
    `Wybrano dokładną lokalizację: ${item.displayName}.`,
    "success"
  );
}

function renderSelectedCity() {
  const card = $("#selectedCityCard");
  const item = state.selectedCity;

  card.classList.toggle("hidden", !item);
  if (!item) return;

  $("#selectedCityName").textContent = item.postcode
    ? `${item.city} — ${item.postcode}`
    : item.city;

  $("#selectedCityDetails").textContent =
    uniqueNonEmpty([
      item.typeLabel,
      item.county,
      item.state
    ]).join(" • ");
}

function clearSelectedCity() {
  resetSelectedCity(true);
  $("#city").focus();
}

function resetSelectedCity(clearInput = false) {
  state.selectedCity = null;
  state.detectedLocation = null;
  renderSelectedCity();

  if (clearInput) {
    $("#city").value = "";
  }
}

function openCitySuggestions() {
  const container = $("#citySuggestions");
  container.classList.remove("hidden");
  $("#city").setAttribute("aria-expanded", "true");
}

function closeCitySuggestions() {
  $("#citySuggestions").classList.add("hidden");
  $("#city").setAttribute("aria-expanded", "false");
}

function setCityLoading(loading) {
  $("#cityInputLoader").classList.toggle("hidden", !loading);
}

async function ensureSelectedSearchLocation(cityInput) {
  const input = clean(cityInput);

  if (
    state.selectedCity &&
    (
      input.toLocaleLowerCase("pl") ===
        state.selectedCity.inputLabel.toLocaleLowerCase("pl") ||
      input.toLocaleLowerCase("pl") ===
        state.selectedCity.city.toLocaleLowerCase("pl")
    )
  ) {
    return {
      lat: state.selectedCity.lat,
      lon: state.selectedCity.lon,
      displayName: state.selectedCity.displayName
    };
  }

  const suggestions = await loadCitySuggestions(input);
  const exactMatches = suggestions.filter(item => {
    const normalizedInput = normalizeSearchText(input);
    const inputPostcode = extractPostcode(input);
    const sameName =
      normalizeSearchText(item.city) ===
      normalizeSearchText(input.replace(/\b\d{2}-?\d{3}\b/g, ""));
    const samePostcode = !inputPostcode || item.postcode === inputPostcode;
    return sameName && samePostcode;
  });

  if (exactMatches.length === 1) {
    state.citySuggestions = exactMatches;
    selectCitySuggestion(0);
    return {
      lat: exactMatches[0].lat,
      lon: exactMatches[0].lon,
      displayName: exactMatches[0].displayName
    };
  }

  openCitySuggestions();
  setLocationStatus(
    "Przed wyszukiwaniem wybierz konkretną miejscowość z listy.",
    "error"
  );
  throw new Error("CITY_SELECTION_REQUIRED");
}

function normalizeCityQuery(value) {
  return clean(value)
    .toLocaleLowerCase("pl")
    .replace(/\s+/g, " ");
}

function normalizeSearchText(value) {
  return clean(value)
    .toLocaleLowerCase("pl")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9ąćęłńóśźż\s-]/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function containsPostcode(value) {
  return /\b\d{2}-?\d{3}\b/.test(value);
}

function extractPostcode(value) {
  const match = value.match(/\b(\d{2})-?(\d{3})\b/);
  return match ? `${match[1]}-${match[2]}` : "";
}

function normalizePlaceType(type) {
  const value = clean(type).toLowerCase();

  if (["city", "municipality"].includes(value)) return "city";
  if (["town"].includes(value)) return "town";
  if (["village", "hamlet"].includes(value)) return "village";
  if (["suburb", "quarter", "neighbourhood"].includes(value)) return "suburb";
  if (["district", "county"].includes(value)) return "district";
  if (["administrative"].includes(value)) return "municipality";

  return "place";
}

function placeTypeLabel(type) {
  const labels = {
    city: "miasto",
    town: "miasto",
    village: "wieś",
    municipality: "gmina",
    suburb: "dzielnica",
    district: "powiat",
    place: "miejscowość"
  };

  return labels[type] || "miejscowość";
}

function isPolishCoordinate(lat, lon) {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= 48.8 &&
    lat <= 55.1 &&
    lon >= 13.8 &&
    lon <= 24.5
  );
}

function uniqueNonEmpty(items) {
  return [...new Set(items.map(clean).filter(Boolean))];
}

function loadRecentCities() {
  try {
    const parsed = JSON.parse(localStorage.getItem("leadfinder_recent_cities") || "[]");
    return Array.isArray(parsed) ? parsed.slice(0, 5) : [];
  } catch {
    return [];
  }
}

function saveRecentCity(item) {
  const safeItem = {
    city: item.city,
    postcode: item.postcode,
    county: item.county,
    municipality: item.municipality,
    state: item.state,
    district: item.district,
    lat: item.lat,
    lon: item.lon,
    type: item.type,
    typeLabel: item.typeLabel,
    inputLabel: item.inputLabel,
    subtitle: item.subtitle,
    displayName: item.displayName,
    key: item.key,
    importance: item.importance || 0,
    source: item.source || "recent"
  };

  state.recentCities = [
    safeItem,
    ...state.recentCities.filter(city => city.key !== safeItem.key)
  ].slice(0, 5);

  try {
    localStorage.setItem(
      "leadfinder_recent_cities",
      JSON.stringify(state.recentCities)
    );
  } catch {
    // Brak miejsca w localStorage nie powinien blokować aplikacji.
  }
}


async function detectCurrentLocation() {
  clearMessages();

  if (!navigator.geolocation) {
    setLocationStatus(
      "Ta przeglądarka nie obsługuje lokalizacji. Wpisz miasto ręcznie.",
      "error"
    );
    return;
  }

  const button = $("#locateBtn");
  button.disabled = true;
  button.classList.add("is-locating");
  setLocationStatus("Pobieram lokalizację urządzenia…", "loading");

  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false,
          timeout: 15000,
          maximumAge: 300000
        }
      );
    });

    const lat = Number(position.coords.latitude);
    const lon = Number(position.coords.longitude);
    const place = await reverseGeocodePosition(lat, lon);

    const detectedItem = buildCitySuggestion({
      city: place.city,
      postcode: place.postcode || "",
      county: place.county || "",
      stateName: place.state || "",
      district: place.district || "",
      municipality: place.municipality || "",
      lat,
      lon,
      type: place.type || "city",
      importance: 1,
      source: "geolocation"
    });

    state.selectedCity = detectedItem;
    state.detectedLocation = {
      lat,
      lon,
      city: detectedItem.city,
      postcode: detectedItem.postcode,
      displayName: detectedItem.displayName
    };

    $("#city").value = detectedItem.inputLabel;
    renderSelectedCity();
    saveRecentCity(detectedItem);
    setLocationStatus(
      `Ustawiono dokładną lokalizację: ${detectedItem.displayName}.`,
      "success"
    );
  } catch (error) {
    console.error("Błąd lokalizacji:", error);
    setLocationStatus(geolocationErrorMessage(error), "error");
  } finally {
    button.disabled = false;
    button.classList.remove("is-locating");
  }
}

async function reverseGeocodePosition(lat, lon) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: "jsonv2",
    zoom: "10",
    addressdetails: "1",
    "accept-language": "pl"
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        signal: controller.signal
      }
    );

    if (!response.ok) throw new Error("REVERSE_GEOCODING_FAILED");

    const data = await response.json();
    const address = data.address || {};
    const city = clean(
      address.city ||
      address.town ||
      address.village ||
      address.municipality ||
      address.county ||
      ""
    );

    if (!city) throw new Error("LOCALITY_NOT_FOUND");

    return {
      city,
      postcode: clean(address.postcode || ""),
      county: clean(address.county || ""),
      state: clean(address.state || ""),
      district: clean(address.city_district || address.suburb || ""),
      municipality: clean(address.municipality || ""),
      type: normalizePlaceType(data.type || data.addresstype || "city"),
      displayName: clean(data.display_name || city)
    };
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("REVERSE_GEOCODING_TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function resolveSearchLocation(city) {
  if (
    state.detectedLocation &&
    clean(city).toLocaleLowerCase("pl") ===
      state.detectedLocation.city.toLocaleLowerCase("pl")
  ) {
    setLoadingStage("Używam Twojej lokalizacji…");
    return {
      lat: state.detectedLocation.lat,
      lon: state.detectedLocation.lon,
      displayName: state.detectedLocation.displayName
    };
  }

  return geocodeCity(city);
}

function setLocationStatus(text, type = "neutral") {
  const status = $("#locationStatus");
  status.textContent = text;
  status.classList.remove(
    "location-success",
    "location-error",
    "location-loading"
  );

  if (type === "success") status.classList.add("location-success");
  if (type === "error") status.classList.add("location-error");
  if (type === "loading") status.classList.add("location-loading");
}

function geolocationErrorMessage(error) {
  if (error?.code === 1) {
    return "Nie udzielono zgody na lokalizację. Wpisz miasto ręcznie albo zezwól na lokalizację w ustawieniach przeglądarki.";
  }
  if (error?.code === 2) {
    return "Nie udało się ustalić położenia urządzenia. Włącz lokalizację i spróbuj ponownie.";
  }
  if (error?.code === 3) {
    return "Ustalanie lokalizacji trwało zbyt długo. Spróbuj ponownie.";
  }
  if (error?.message === "REVERSE_GEOCODING_TIMEOUT") {
    return "Ustalono położenie, ale nie udało się szybko rozpoznać miasta. Wpisz je ręcznie.";
  }
  if (
    error?.message === "REVERSE_GEOCODING_FAILED" ||
    error?.message === "LOCALITY_NOT_FOUND"
  ) {
    return "Nie udało się rozpoznać miejscowości dla tej lokalizacji. Wpisz miasto ręcznie.";
  }

  return "Nie udało się pobrać lokalizacji. Wpisz miasto ręcznie.";
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

async function fetchBusinesses(lat, lon, radius, categoryDefinition, city) {
  setLoadingStage("Pobieram firmy…");

  const exactElements = await fetchOverpassSelectors(
    lat,
    lon,
    radius,
    categoryDefinition.exactSelectors,
    "Pobieram firmy…"
  );

  let combined = [...exactElements];

  if (combined.length < 20) {
    const fallbackSelectors = categoryDefinition.fallbackSelectors || [];

    if (fallbackSelectors.length) {
      setLoadingStage("Poszerzam wyszukiwanie…");

      try {
        const fallbackElements = await fetchOverpassSelectors(
          lat,
          lon,
          radius,
          fallbackSelectors,
          "Poszerzam wyszukiwanie…"
        );
        combined.push(...fallbackElements);
      } catch (error) {
        console.warn("Wyszukiwanie rozszerzone Overpass nie powiodło się:", error);
      }
    }
  }

  if (combined.length < 10) {
    setLoadingStage("Sprawdzam dodatkowe wpisy OSM…");

    try {
      const nominatimElements = await fetchNominatimBusinesses(
        city,
        categoryDefinition.searchPhrase
      );
      combined.push(...nominatimElements);
    } catch (error) {
      console.warn("Wyszukiwanie tekstowe Nominatim nie powiodło się:", error);
    }
  }

  return combined;
}

async function fetchOverpassSelectors(
  lat,
  lon,
  radius,
  selectors,
  loadingText
) {
  if (!selectors?.length) return [];

  const lines = selectors
    .map(selector => `${selector}(around:${radius},${lat},${lon});`)
    .join("\n");

  const query = `[out:json][timeout:18];
(
${lines}
);
out center 100;`;

  const endpoints = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
  ];

  let lastError = new Error("OVERPASS_FAILED");

  for (let index = 0; index < endpoints.length; index += 1) {
    setLoadingStage(
      index === 0 ? loadingText : "Próbuję serwera zapasowego…"
    );

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

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

async function fetchNominatimBusinesses(city, searchPhrase) {
  const phrase = clean(searchPhrase);
  const params = new URLSearchParams({
    q: `${phrase}, ${city}, Polska`,
    format: "jsonv2",
    limit: "20",
    countrycodes: "pl",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
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

    if (!response.ok) return [];

    const rows = await response.json();

    return rows.map(row => {
      const extras = row.extratags || {};
      const address = row.address || {};
      const displayName = clean(
        row.namedetails?.name ||
        row.name ||
        String(row.display_name || "").split(",")[0]
      );

      return {
        type: "nominatim",
        id: row.place_id,
        lat: Number(row.lat),
        lon: Number(row.lon),
        tags: {
          name: displayName,
          phone: extras.phone || extras["contact:phone"] || "",
          email: extras.email || extras["contact:email"] || "",
          website: extras.website || extras["contact:website"] || "",
          facebook: extras.facebook || extras["contact:facebook"] || "",
          instagram: extras.instagram || extras["contact:instagram"] || "",
          opening_hours: extras.opening_hours || "",
          description: extras.description || "",
          service: extras.service || extras.services || "",
          "addr:street": address.road || address.pedestrian || "",
          "addr:housenumber": address.house_number || "",
          "addr:postcode": address.postcode || "",
          "addr:city": address.city || address.town || address.village || city
        }
      };
    });
  } catch (error) {
    if (error?.name === "AbortError") return [];
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function normalizeBusinesses(
  elements,
  categoryDefinition,
  city,
  purpose,
  offerName,
  offerBenefit
) {
  const seenIds = new Set();
  const seenCompanies = new Set();

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
      const openingHours = clean(tags.opening_hours || "");
      const descriptionData = buildBusinessDescription({
        tags,
        categoryLabel: categoryDefinition.label,
        city,
        address,
        phone,
        email,
        website,
        facebook,
        instagram
      });
      const id = `${element.type}-${element.id}`;

      const company = {
        id,
        osmType: element.type,
        osmId: element.id,
        name,
        hasRealName: Boolean(rawName),
        category: categoryDefinition.key,
        categoryLabel: categoryDefinition.label,
        targetIndustry: categoryDefinition.label,
        leadPurpose: purpose,
        offerName,
        offerBenefit,
        lat,
        lon,
        address,
        website,
        phone,
        email,
        facebook,
        instagram,
        openingHours,
        description: descriptionData.text,
        descriptionSource: descriptionData.source,
        hasWebsite: Boolean(website),
        status: "new",
        createdAt: new Date().toISOString()
      };

      company.leadScore = calculateLeadScore(company, purpose);
      company.leadQuality = leadQuality(company.leadScore);

      return company;
    })
    .filter(company => {
      if (!company.lat || !company.lon) return false;
      if (seenIds.has(company.id)) return false;

      const normalizedPhone = company.phone.replace(/\D/g, "");
      const businessKey = normalizedPhone
        ? `phone:${normalizedPhone}`
        : `name:${company.name.toLocaleLowerCase("pl")}|address:${company.address.toLocaleLowerCase("pl")}`;

      if (seenCompanies.has(businessKey)) return false;

      seenIds.add(company.id);
      seenCompanies.add(businessKey);
      return true;
    })
    .sort((a, b) => {
      if (purpose === "sales") {
        return (
          b.leadScore - a.leadScore ||
          a.name.localeCompare(b.name, "pl")
        );
      }

      return (
        Number(a.hasWebsite) - Number(b.hasWebsite) ||
        b.leadScore - a.leadScore ||
        a.name.localeCompare(b.name, "pl")
      );
    });
}

function buildBusinessDescription({
  tags,
  categoryLabel,
  city,
  address,
  phone,
  email,
  website,
  facebook,
  instagram
}) {
  const directDescription = clean(
    tags["description:pl"] ||
    tags.description ||
    tags["contact:description"] ||
    ""
  );

  if (directDescription) {
    return {
      text: truncateText(directDescription, 420),
      source: "openstreetmap"
    };
  }

  const resolvedCategoryLabel = categoryLabel || "firma usługowa";
  const sentences = [
    `Firma została dopasowana do kategorii „${resolvedCategoryLabel}” w miejscowości ${city} na podstawie publicznych oznaczeń OpenStreetMap.`
  ];

  const serviceText = extractServiceDescription(tags);
  if (serviceText) {
    sentences.push(`Zakres oznaczony w danych: ${serviceText}.`);
  }

  const availableData = [];
  if (address && address !== "Adres niepodany w danych") {
    availableData.push("dokładny adres");
  }
  if (phone) availableData.push("numer telefonu");
  if (email) availableData.push("adres e-mail");
  if (facebook || instagram) availableData.push("profil społecznościowy");

  if (availableData.length) {
    sentences.push(`Dostępne dane kontaktowe: ${joinPolishList(availableData)}.`);
  }

  if (!website) {
    sentences.push("W publicznym wpisie nie podano własnej strony internetowej.");
  }

  sentences.push("Przed kontaktem należy potwierdzić aktualność danych.");

  return {
    text: sentences.join(" "),
    source: "generated"
  };
}

function extractServiceDescription(tags) {
  const rawValues = [
    tags.service,
    tags.services,
    tags.beauty,
    tags.cuisine,
    tags.speciality,
    tags["healthcare:speciality"]
  ]
    .filter(Boolean)
    .flatMap(value => String(value).split(/[;,]/))
    .map(value => translateOsmValue(value.trim()))
    .filter(Boolean);

  return [...new Set(rawValues)].slice(0, 5).join(", ");
}

function translateOsmValue(value) {
  const normalized = value.toLowerCase().replaceAll("_", " ").trim();
  const translations = {
    nails: "stylizacja paznokci",
    hair: "usługi fryzjerskie",
    massage: "masaże",
    cosmetics: "zabiegi kosmetyczne",
    facial: "zabiegi na twarz",
    tanning: "opalanie",
    piercing: "piercing",
    tattoo: "tatuaż",
    physiotherapy: "fizjoterapia",
    polish: "kuchnia polska",
    pizza: "pizza",
    burger: "burgery",
    coffee_shop: "kawiarnia"
  };

  return translations[normalized] || normalized;
}

function joinPolishList(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} i ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} i ${items.at(-1)}`;
}

function capitalizeFirst(value) {
  const text = clean(value);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
}

function truncateText(value, maxLength) {
  const text = clean(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function hasDirectContact(company) {
  return Boolean(
    company.phone ||
    company.email ||
    company.facebook ||
    company.instagram
  );
}

function hasSalesContact(company) {
  return Boolean(
    hasDirectContact(company) ||
    company.website
  );
}

function isUsableLead(company, purpose = company.leadPurpose || "website") {
  if (!company.hasRealName) return false;

  if (purpose === "website") {
    return !company.hasWebsite && hasDirectContact(company);
  }

  return hasSalesContact(company);
}

function contactChannelCount(company, purpose = company.leadPurpose || "website") {
  const channels = [
    Boolean(company.phone),
    Boolean(company.email),
    Boolean(company.facebook || company.instagram)
  ];

  if (purpose === "sales") {
    channels.push(Boolean(company.website));
  }

  return channels.filter(Boolean).length;
}

function calculateLeadScore(company, purpose = company.leadPurpose || "website") {
  let score = 0;

  if (company.hasRealName) score += 5;
  if (company.phone) score += 40;
  if (company.email) score += 25;
  if (company.facebook || company.instagram) score += 20;

  if (purpose === "sales" && company.website) {
    score += 15;
  }

  if (
    company.address &&
    company.address !== "Adres niepodany w danych"
  ) {
    score += 7;
  }

  if (company.openingHours) score += 3;

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
      !(company.leadPurpose === "sales"
        ? hasSalesContact(company)
        : hasDirectContact(company))
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
  const noWebsiteCount = list.filter(item => !item.hasWebsite).length;
  const phoneCount = list.filter(item => item.phone).length;
  const emailCount = list.filter(item => item.email).length;

  $("#resultsStats").textContent =
    `Pokazano: ${list.length} z maks. ${MAX_RESULTS_PER_SEARCH} wartościowych leadów • Telefon: ${phoneCount} • E-mail: ${emailCount} • Bez WWW: ${noWebsiteCount}`;

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
  const ceidgUrl =
    `https://www.biznes.gov.pl/pl/wyszukiwarka-firm/?companyName=${encodeURIComponent(company.name)}&searchType=advanced`;

  const siteBadge = company.hasWebsite
    ? `<span class="badge has-site">MA STRONĘ</span>`
    : `<span class="badge no-site">BRAK WWW</span>`;

  const quality = company.leadQuality ||
    leadQuality(company.leadScore || calculateLeadScore(company));

  const purposeBadge = company.leadPurpose === "sales"
    ? `<span class="purpose-badge sales-purpose">OFERTA B2B</span>`
    : `<span class="purpose-badge website-purpose">BEZ WWW</span>`;

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
        ${purposeBadge}
        ${siteBadge}
        <span class="quality-badge ${quality.className}">
          ${quality.label} · ${company.leadScore || 0}/100
        </span>
      </div>
    </div>

    <div class="company-description">
      <div class="description-heading">
        <strong>${company.descriptionSource === "openstreetmap" ? "Opis firmy" : "Podsumowanie danych"}</strong>
        <span>${company.descriptionSource === "openstreetmap" ? "z OpenStreetMap" : "na podstawie publicznego wpisu"}</span>
      </div>
      <p>${escapeHtml(company.description || "Brak opisu w danych.")}</p>
    </div>

    <div class="contact-summary">
      <strong>Dostępny kontakt</strong>
      <span>${contactChannelCount(company)} ${contactChannelCount(company) === 1 ? "kanał" : "kanały"}</span>
    </div>

    <div class="meta">
      ${company.phone ? `<div class="meta-row"><span class="key">Telefon:</span><span><a href="tel:${escapeAttr(company.phone)}">${escapeHtml(company.phone)}</a></span></div>` : ""}
      ${company.email ? `<div class="meta-row"><span class="key">E-mail:</span><span><a href="mailto:${escapeAttr(company.email)}">${escapeHtml(company.email)}</a></span></div>` : ""}
      ${company.website ? `<div class="meta-row"><span class="key">Strona:</span><span><a href="${escapeAttr(company.website)}" target="_blank" rel="noopener">Otwórz stronę</a></span></div>` : ""}
      ${socials ? `<div class="meta-row"><span class="key">Social:</span><span>${socials}</span></div>` : ""}
      ${company.openingHours ? `<div class="meta-row"><span class="key">Godziny:</span><span>${escapeHtml(company.openingHours)}</span></div>` : ""}
    </div>

    <div class="verification-box">
      <strong>Weryfikacja:</strong>
      <span>sprawdź firmę w Google oraz w publicznej wyszukiwarce CEIDG/KRS przed wysłaniem oferty.</span>
    </div>

    <div class="card-actions card-actions-3">
      <a href="${mapUrl}" target="_blank" rel="noopener">Google Maps</a>
      <a href="${googleUrl}" target="_blank" rel="noopener">Szukaj w Google</a>
      <a href="${facebookSearchUrl}" target="_blank" rel="noopener">Szukaj Facebooka</a>
      <a class="ceidg-action" href="${ceidgUrl}" target="_blank" rel="noopener">Sprawdź CEIDG/KRS</a>
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
    description: company.description || null,
    description_source: company.descriptionSource || "generated",
    opening_hours: company.openingHours || null,
    lead_purpose: company.leadPurpose || "website",
    offer_name: company.offerName || null,
    offer_benefit: company.offerBenefit || null,
    target_industry: company.targetIndustry || company.categoryLabel || null,
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
    description: row.description || buildSavedBusinessDescription(row),
    descriptionSource: row.description_source || "generated",
    openingHours: row.opening_hours || "",
    leadPurpose: row.lead_purpose || "website",
    offerName: row.offer_name || "",
    offerBenefit: row.offer_benefit || "",
    targetIndustry: row.target_industry ||
      categoryLabels[row.category] ||
      row.category ||
      "firma",
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

function buildSavedBusinessDescription(row) {
  const categoryLabel = categoryLabels[row.category] || row.category || "firma usługowa";
  const cityOrAddress = row.address && row.address !== "Adres niepodany w danych"
    ? ` Lokalizacja: ${row.address}.`
    : "";

  const contact = row.phone
    ? " Dostępny jest numer telefonu."
    : "";

  const website = row.website
    ? ""
    : " W danych nie podano własnej strony internetowej.";

  return `${capitalizeFirst(categoryLabel)}.${cityOrAddress}${contact}${website}`.trim();
}

function findCompany(id, source) {
  const list = source === "saved" ? state.saved : state.results;
  return list.find(item => item.id === id);
}

function openMessage(company) {
  const senderName = clean(
    state.profile?.full_name ||
    state.session?.user?.user_metadata?.full_name ||
    ""
  );
  const senderEmail = clean(
    state.profile?.email ||
    state.session?.user?.email ||
    ""
  );

  const signature = [
    "Pozdrawiam",
    senderName,
    senderEmail ? `E-mail: ${senderEmail}` : ""
  ].filter(Boolean).join("\n");

  let message;

  if (company.leadPurpose === "sales") {
    const offerName = clean(company.offerName) || "naszej oferty";
    const benefit = clean(company.offerBenefit);

    message = `Dzień dobry,

trafiłem na firmę „${company.name}” działającą w branży: ${company.targetIndustry || company.categoryLabel}.

Chciałbym przedstawić Państwu ofertę dotyczącą: ${offerName}.${benefit ? `\n\n${benefit}` : ""}

Czy mogę przesłać krótką ofertę albo ustalić, czy takie rozwiązanie może być przydatne w Państwa firmie?

${signature}`;
  } else {
    message = `Dzień dobry,

trafiłem na profil firmy „${company.name}” działającej w branży: ${company.categoryLabel}. Nie znalazłem obecnie własnej strony internetowej firmy.

Mogę przygotować nowoczesną stronę z opisem usług, galerią realizacji, danymi kontaktowymi, lokalizacją oraz szybkim kontaktem telefonicznym. Strona będzie dostosowana do telefonów i może pomóc klientom znaleźć firmę w Google.

Czy mogę przesłać krótką propozycję wyglądu strony oraz wycenę?

${signature}`;
  }

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

async function openPlansDialog() {
  if (!state.session) {
    openAuthDialog();
    return;
  }
  await loadMyOrders();
  await loadPaymentSettings();
  renderQuota();
  renderMyOrders();
  plansDialog.showModal();
}

function exportCsv(list, filename) {
  if (!list.length) {
    showToast("Brak danych do eksportu.");
    return;
  }

  const headers = [
    "Nazwa", "Branża", "Cel wyszukiwania", "Oferta", "Korzyść",
    "Adres", "Telefon", "E-mail", "Strona",
    "Facebook", "Instagram", "Status", "Mapa"
  ];

  const rows = list.map(company => [
    company.name,
    company.targetIndustry || company.categoryLabel,
    company.leadPurpose === "sales" ? "Sprzedaż B2B" : "Firma bez WWW",
    company.offerName || "",
    company.offerBenefit || "",
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
