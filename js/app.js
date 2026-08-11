/**
 * ==========================================================================
 * AUTOHUB APPLICATION JAVASCRIPT — COMPLETE INTEGRATED SaaS ARCHITECTURE
 * ==========================================================================
 */

// --- SECURE HTML ESCAPE SANITIZER ---
function escapeHTML(str) {
  if (str === undefined || str === null) return "";
  const s = String(str);
  return s.replace(/[&<>"']/g, function(match) {
    switch (match) {
      case '&': return '&amp;';
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '"': return '&quot;';
      case "'": return '&#39;';
      default: return match;
    }
  });
}

// --- CENTRALIZED STATE ENGINE ---
const state = {
  cars: [],            // List of all loaded car records
  favorites: [],       // List of car IDs in the user's favorites
  compare: [],         // List of car IDs selected for comparison (max 3)
  filters: {
    brand: "all",
    engine: "all",
    fuel: "all",
    yearMin: null,
    yearMax: null,
    priceMin: null,
    priceMax: null,
    hpMin: null,
    hpMax: null,
    modified: "all",     // 'all', 'original', 'modified'
    availability: "all", // 'all', 'available', 'sold'
    tags: []             // Multi-select tags list
  },
  sort: "default",
  searchQuery: "",
  currentView: "marketplace", // 'marketplace', 'dashboard', 'favorites', 'compare'
  theme: "dark"               // 'dark', 'light'
};

// --- INITIALIZATION ENTRYPOINT ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    loadThemeFromLocalStorage();
    await fetchInitialDataset();
    loadFavoritesFromLocalStorage();
    loadCompareStateFromSession();
    setupEventListeners();
    updateUI();
  } catch (error) {
    console.error("Initialization Failed:", error);
    showNotification("Critical Error: Unable to initialize AutoHub dashboard.", "error");
  }
});

// --- DATA ACCESS LAYER ---
async function fetchInitialDataset() {
  const loadingGrid = document.getElementById("cars-grid-container");
  if (loadingGrid) {
    loadingGrid.innerHTML = `
      <div class="skeleton-loading-container" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: var(--primary-color); margin-bottom: 16px;"></i>
        <p style="color: var(--text-muted); font-weight: 600;">Loading premium vehicle fleet...</p>
      </div>
    `;
  }

  try {
    const storedCars = localStorage.getItem("autohub_cars");
    let parsedCars = null;
    if (storedCars) {
      try {
        parsedCars = JSON.parse(storedCars);
      } catch (e) {
        console.warn("Malformed LocalStorage autohub_cars data cleared:", e);
        localStorage.removeItem("autohub_cars");
      }
    }

    if (parsedCars && Array.isArray(parsedCars)) {
      state.cars = parsedCars;
    } else {
      const response = await fetch("./data/cars.json");
      if (!response.ok) {
        throw new Error(`HTTP Error Status: ${response.status}`);
      }
      const data = await response.json();
      state.cars = data.cars || [];
      saveCarsToLocalStorage();
    }
  } catch (err) {
    console.error("Fetch Failure:", err);
    if (loadingGrid) {
      loadingGrid.innerHTML = `
        <div class="loading-error-container" style="grid-column: 1 / -1; text-align: center; padding: 48px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 3rem; color: var(--color-danger); margin-bottom: 16px;"></i>
          <h3 style="margin-bottom: 8px;">Failed to Load Vehicle Database</h3>
          <p style="color: var(--text-muted); margin-bottom: 24px;">Please check your server connection or try resetting the database.</p>
          <button class="btn btn-primary" onclick="window.location.reload()"><i class="fa-solid fa-rotate-right"></i> Try Again</button>
        </div>
      `;
    }
    throw err;
  }
}

// --- STATE PERSISTENCE SYNCERS ---
function saveCarsToLocalStorage() {
  localStorage.setItem("autohub_cars", JSON.stringify(state.cars));
}

function loadFavoritesFromLocalStorage() {
  const favs = localStorage.getItem("autohub_favorites");
  if (favs) {
    try {
      state.favorites = JSON.parse(favs);
    } catch (e) {
      console.warn("Malformed favorites localStorage data cleared:", e);
      state.favorites = [];
      localStorage.removeItem("autohub_favorites");
    }
  } else {
    state.favorites = [];
  }
}

function saveFavoritesToLocalStorage() {
  localStorage.setItem("autohub_favorites", JSON.stringify(state.favorites));
}

// Persist the theme cleanly
function loadThemeFromLocalStorage() {
  const savedTheme = localStorage.getItem("autohub_theme");
  state.theme = savedTheme ? savedTheme : "dark";
  applyTheme();
}

function saveThemeToLocalStorage() {
  localStorage.setItem("autohub_theme", state.theme);
}

function loadCompareStateFromSession() {
  const compareStr = sessionStorage.getItem("autohub_compare");
  if (compareStr) {
    try {
      state.compare = JSON.parse(compareStr);
    } catch (e) {
      console.warn("Malformed compare sessionStorage data cleared:", e);
      state.compare = [];
      sessionStorage.removeItem("autohub_compare");
    }
  } else {
    state.compare = [];
  }
}

function saveCompareStateToSession() {
  sessionStorage.setItem("autohub_compare", JSON.stringify(state.compare));
}

// --- VISUAL THEME IMPLEMENTER ---
function applyTheme() {
  const body = document.body;
  if (state.theme === "light") {
    body.classList.remove("dark-theme");
    body.classList.add("light-theme");
  } else {
    body.classList.remove("light-theme");
    body.classList.add("dark-theme");
  }
}

// --- NOTIFICATION SYSTEM (TOAST) ---
function showNotification(message, type = "success") {
  const container = document.getElementById("toast-container");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;

  let iconClass = "fa-circle-check";
  if (type === "error") iconClass = "fa-circle-xmark";
  if (type === "warning") iconClass = "fa-circle-exclamation";

  toast.innerHTML = `
    <i class="fa-solid ${iconClass} toast-icon"></i>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

// --- GLOBAL UI UPDATE & RE-RENDERS ---
function updateUI() {
  navigateToView(state.currentView);
}

// --- VIEW SWAPPER (SPA ENGINE) ---
function navigateToView(view) {
  state.currentView = view;

  const marketFavoritesSection = document.getElementById("view-marketplace-favorites");
  const dashboardSection = document.getElementById("view-dashboard");
  const compareSection = document.getElementById("view-compare");
  const heroSection = document.getElementById("hero-banner");

  marketFavoritesSection.style.display = "none";
  dashboardSection.style.display = "none";
  compareSection.style.display = "none";

  document.querySelectorAll(".nav-btn, .mobile-nav-btn").forEach(btn => {
    if (btn.getAttribute("data-view") === view) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  const titleNode = document.getElementById("marketplace-view-title");

  if (view === "marketplace") {
    marketFavoritesSection.style.display = "block";
    heroSection.style.display = "flex";
    if (titleNode) titleNode.textContent = "Vehicle Marketplace";
    renderCars();
  } else if (view === "favorites") {
    marketFavoritesSection.style.display = "block";
    heroSection.style.display = "none";
    if (titleNode) titleNode.textContent = "Saved Favorites Collection";
    renderCars();
  } else if (view === "dashboard") {
    dashboardSection.style.display = "block";
    heroSection.style.display = "none";
    renderStatistics();
  } else if (view === "compare") {
    compareSection.style.display = "block";
    heroSection.style.display = "none";
    renderComparisonMatrix();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// --- DATA-DRIVEN DYNAMIC OPTIONS OPTIONS ---
function populateDynamicFilters() {
  const brands = [...new Set(state.cars.map(car => car.brand).filter(Boolean))].sort();
  const brandSelect = document.getElementById("filter-brand");
  if (brandSelect) {
    const currentVal = state.filters.brand;
    brandSelect.innerHTML = `<option value="all">All Brands (${state.cars.length})</option>`;
    brands.forEach(b => {
      const count = state.cars.filter(c => c.brand === b).length;
      const eb = escapeHTML(b);
      brandSelect.innerHTML += `<option value="${eb}" ${b === currentVal ? "selected" : ""}>${eb} (${count})</option>`;
    });
  }

  const engines = [...new Set(state.cars.map(car => car.engine?.type).filter(Boolean))].sort();
  const engineSelect = document.getElementById("filter-engine");
  if (engineSelect) {
    const currentVal = state.filters.engine;
    engineSelect.innerHTML = `<option value="all">All Engines</option>`;
    engines.forEach(eng => {
      const count = state.cars.filter(c => c.engine?.type === eng).length;
      const eeng = escapeHTML(eng);
      engineSelect.innerHTML += `<option value="${eeng}" ${eng === currentVal ? "selected" : ""}>${eeng} (${count})</option>`;
    });
  }

  const fuels = [...new Set(state.cars.map(car => car.engine?.fuel).filter(Boolean))].sort();
  const fuelSelect = document.getElementById("filter-fuel");
  if (fuelSelect) {
    const currentVal = state.filters.fuel;
    fuelSelect.innerHTML = `<option value="all">All Fuel Types</option>`;
    fuels.forEach(fl => {
      const count = state.cars.filter(c => c.engine?.fuel === fl).length;
      const efl = escapeHTML(fl);
      fuelSelect.innerHTML += `<option value="${efl}" ${fl === currentVal ? "selected" : ""}>${efl} (${count})</option>`;
    });
  }

  const tagsContainer = document.getElementById("filter-tags-container");
  if (tagsContainer) {
    const allTags = state.cars.reduce((acc, car) => {
      if (car.tags && Array.isArray(car.tags)) {
        car.tags.forEach(tag => {
          const t = tag.trim().toLowerCase();
          if (t) acc[t] = (acc[t] || 0) + 1;
        });
      }
      return acc;
    }, {});

    tagsContainer.innerHTML = "";
    Object.keys(allTags).sort().forEach(tag => {
      const count = allTags[tag];
      const isChecked = state.filters.tags.includes(tag);
      const etag = escapeHTML(tag);
      tagsContainer.innerHTML += `
        <div class="tag-option-wrapper">
          <label class="checkbox-label">
            <input type="checkbox" class="tag-checkbox-filter" value="${etag}" ${isChecked ? "checked" : ""}>
            <span>${etag}</span>
          </label>
          <span class="tag-badge-count">${count}</span>
        </div>
      `;
    });

    document.querySelectorAll(".tag-checkbox-filter").forEach(cb => {
      cb.addEventListener("change", (e) => {
        const val = e.target.value;
        if (e.target.checked) {
          if (!state.filters.tags.includes(val)) state.filters.tags.push(val);
        } else {
          state.filters.tags = state.filters.tags.filter(t => t !== val);
        }
        renderCars();
      });
    });
  }
}

// --- DYNAMIC CAR CARD GENERATOR ---
function createCarCard(car) {
  const isFav = state.favorites.includes(car.id);
  const isCompared = state.compare.includes(car.id);
  const fallbackedImg = car.image || "";

  let buildTypeBadge = "";
  if (car.isModified !== undefined) {
    buildTypeBadge = car.isModified
      ? `<span class="badge badge-modified"><i class="fa-solid fa-bolt"></i> Modified</span>`
      : `<span class="badge badge-original"><i class="fa-solid fa-certificate"></i> Factory Stock</span>`;
  }

  let priceStr = `${escapeHTML(car.currency ?? "USD")} ${Number(car.price).toLocaleString()}`;
  if (car.currency === "USD") priceStr = `$${Number(car.price).toLocaleString()}`;
  if (car.currency === "EUR") priceStr = `€${Number(car.price).toLocaleString()}`;
  if (car.currency === "GBP") priceStr = `£${Number(car.price).toLocaleString()}`;

  const soldBadge = !car.isAvailable ? `<span class="badge badge-sold">SOLD</span>` : "";

  const displayMileage = car.mileageKm !== undefined && car.mileageKm !== null
    ? `${Number(car.mileageKm).toLocaleString()} km`
    : "Not specified";

  const engineHpStr = car.engine?.powerHp ? `${Number(car.engine.powerHp)} HP` : "N/A HP";
  const engineTypeStr = car.engine?.type ? escapeHTML(car.engine.type) : "Standard Engine";
  const transmissionStr = car.specifications?.transmission ? escapeHTML(car.specifications.transmission) : "Manual/Auto";

  // If there's no real image, point directly to a styled HTML placeholder overlay instead of a broken thumbnail
  const imageElementHTML = fallbackedImg
    ? `<img src="${escapeHTML(fallbackedImg)}" alt="${escapeHTML(car.brand)} ${escapeHTML(car.model)}" class="card-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="image-fallback-placeholder" style="display: none;"><i class="fa-solid fa-car-rear"></i><span>Image Unavailable</span></div>`
    : `<div class="image-fallback-placeholder" style="display: flex;"><i class="fa-solid fa-car-rear"></i><span>Image Unavailable</span></div>`;

  return `
    <article class="car-card" data-id="${car.id}">
      <div class="card-image-wrapper">
        ${imageElementHTML}
        <div class="card-badges">
          ${car.isFeatured ? `<span class="badge badge-featured"><i class="fa-solid fa-star"></i> Featured</span>` : "<span></span>"}
          ${buildTypeBadge}
        </div>
        ${soldBadge}
      </div>

      <div class="card-body">
        <div class="card-meta-row">
          <span class="card-brand">${escapeHTML(car.brand)}</span>
          <span class="card-year">${Number(car.year)}</span>
        </div>
        <h3 class="card-title">${escapeHTML(car.title)}</h3>
        <p class="card-price">${priceStr}</p>

        <div class="card-specs-grid">
          <div class="spec-item" title="Engine Type">
            <i class="fa-solid fa-microchip"></i>
            <span>${engineTypeStr}</span>
          </div>
          <div class="spec-item" title="Horsepower">
            <i class="fa-solid fa-fire-flame-curved"></i>
            <span>${engineHpStr}</span>
          </div>
          <div class="spec-item" title="Transmission">
            <i class="fa-solid fa-gears"></i>
            <span>${transmissionStr}</span>
          </div>
          <div class="spec-item" title="Odometer Reading">
            <i class="fa-solid fa-gauge"></i>
            <span>${displayMileage}</span>
          </div>
        </div>

        <div class="card-location-row">
          <i class="fa-solid fa-location-dot"></i>
          <span>${escapeHTML(car.location ?? "Global Registry")}</span>
        </div>

        <div class="card-actions-row">
          <button class="btn btn-card-fav ${isFav ? "active" : ""}" data-action="favorite" aria-label="Add to favorites">
            <i class="fa-${isFav ? "solid" : "regular"} fa-heart"></i>
          </button>
          <button class="btn btn-outline btn-card-compare ${isCompared ? "active" : ""}" data-action="compare">
            <i class="fa-solid fa-code-compare"></i> Compare
          </button>
          <button class="btn btn-primary btn-card-action" data-action="details">
            <i class="fa-solid fa-circle-info"></i> Details
          </button>
        </div>
      </div>
    </article>
  `;
}

// --- DATA PIPELINE: SEARCH, FILTER, SORT & RENDER ---
function renderCars() {
  const gridContainer = document.getElementById("cars-grid-container");
  const emptyContainer = document.getElementById("empty-state-container");
  const resultsCounter = document.getElementById("results-count");

  if (!gridContainer) return;

  populateDynamicFilters();

  let filteredCars = [...state.cars];

  if (state.currentView === "favorites") {
    filteredCars = filteredCars.filter(car => state.favorites.includes(car.id));
  }

  if (state.searchQuery) {
    const s = state.searchQuery.toLowerCase().trim();
    filteredCars = filteredCars.filter(car => {
      const matchTitle = car.title?.toLowerCase().includes(s);
      const matchBrand = car.brand?.toLowerCase().includes(s);
      const matchModel = car.model?.toLowerCase().includes(s);
      const matchOwner = car.owner?.name?.toLowerCase().includes(s);
      const matchLocation = car.location?.toLowerCase().includes(s);
      const matchSpecNote = car.specialFeature?.toLowerCase().includes(s);
      const matchTags = car.tags?.some(tag => tag.toLowerCase().includes(s));
      return matchTitle || matchBrand || matchModel || matchOwner || matchLocation || matchSpecNote || matchTags;
    });
  }

  if (state.filters.brand !== "all") {
    filteredCars = filteredCars.filter(car => car.brand === state.filters.brand);
  }
  if (state.filters.engine !== "all") {
    filteredCars = filteredCars.filter(car => car.engine?.type === state.filters.engine);
  }
  if (state.filters.fuel !== "all") {
    filteredCars = filteredCars.filter(car => car.engine?.fuel === state.filters.fuel);
  }
  if (state.filters.modified !== "all") {
    const modValue = state.filters.modified === "modified";
    filteredCars = filteredCars.filter(car => car.isModified === modValue);
  }
  if (state.filters.availability !== "all") {
    const isAvail = state.filters.availability === "available";
    filteredCars = filteredCars.filter(car => car.isAvailable === isAvail);
  }

  if (state.filters.yearMin !== null) {
    filteredCars = filteredCars.filter(car => car.year >= state.filters.yearMin);
  }
  if (state.filters.yearMax !== null) {
    filteredCars = filteredCars.filter(car => car.year <= state.filters.yearMax);
  }
  if (state.filters.priceMin !== null) {
    filteredCars = filteredCars.filter(car => car.price >= state.filters.priceMin);
  }
  if (state.filters.priceMax !== null) {
    filteredCars = filteredCars.filter(car => car.price <= state.filters.priceMax);
  }
  if (state.filters.hpMin !== null) {
    filteredCars = filteredCars.filter(car => (car.engine?.powerHp ?? 0) >= state.filters.hpMin);
  }
  if (state.filters.hpMax !== null) {
    filteredCars = filteredCars.filter(car => (car.engine?.powerHp ?? 0) <= state.filters.hpMax);
  }

  if (state.filters.tags.length > 0) {
    filteredCars = filteredCars.filter(car => {
      return state.filters.tags.every(tag => {
        return car.tags?.some(t => t.toLowerCase().trim() === tag);
      });
    });
  }

  if (state.sort !== "default") {
    filteredCars.sort((a, b) => {
      switch (state.sort) {
        case "price-asc": return a.price - b.price;
        case "price-desc": return b.price - a.price;
        case "year-asc": return a.year - b.year;
        case "year-desc": return b.year - a.year;
        case "hp-asc": return (a.engine?.powerHp ?? 0) - (b.engine?.powerHp ?? 0);
        case "hp-desc": return (b.engine?.powerHp ?? 0) - (a.engine?.powerHp ?? 0);
        case "rating-desc": return (b.rating ?? 0) - (a.rating ?? 0);
        case "name-asc": return a.title.localeCompare(b.title);
        case "name-desc": return b.title.localeCompare(a.title);
        default: return 0;
      }
    });
  }

  if (filteredCars.length === 0) {
    gridContainer.style.display = "none";
    if (emptyContainer) emptyContainer.style.display = "block";
    if (resultsCounter) resultsCounter.textContent = "0 vehicles found";
  } else {
    if (emptyContainer) emptyContainer.style.display = "none";
    gridContainer.style.display = "grid";

    const fragment = document.createDocumentFragment();
    const tempDiv = document.createElement("div");

    filteredCars.forEach(car => {
      tempDiv.innerHTML = createCarCard(car);
      fragment.appendChild(tempDiv.firstElementChild);
    });

    gridContainer.innerHTML = "";
    gridContainer.appendChild(fragment);

    if (resultsCounter) {
      resultsCounter.textContent = `${filteredCars.length} vehicle${filteredCars.length === 1 ? "" : "s"} found`;
    }
  }

  updateGlobalBadges();
}

// --- EVENT DELEGATORS & STATE UTILS ---
function updateGlobalBadges() {
  const badgeDesk = document.getElementById("compare-count-badge");
  const badgeMobile = document.getElementById("compare-count-badge-mobile");

  const lenStr = state.compare.length.toString();
  if (badgeDesk) badgeDesk.textContent = lenStr;
  if (badgeMobile) badgeMobile.textContent = lenStr;

  const compareStatusText = document.getElementById("compare-selection-status");
  if (compareStatusText) {
    compareStatusText.textContent = `${state.compare.length} / 3 selected`;
  }
}

function handleGridAction(e) {
  const card = e.target.closest(".car-card");
  if (!card) return;

  const carId = parseInt(card.getAttribute("data-id"));
  const actionButton = e.target.closest("[data-action]");
  if (!actionButton) return;

  const action = actionButton.getAttribute("data-action");

  if (action === "favorite") {
    toggleFavoriteCar(carId);
  } else if (action === "compare") {
    toggleCompareVehicle(carId);
  } else if (action === "details") {
    openCarDetailModal(carId);
  }
}

function toggleFavoriteCar(id) {
  const index = state.favorites.indexOf(id);
  const car = state.cars.find(c => c.id === id);
  if (!car) return;

  if (index === -1) {
    state.favorites.push(id);
    showNotification(`Added ${car.title} to your saved favorites catalog.`, "success");
  } else {
    state.favorites.splice(index, 1);
    showNotification(`Removed ${car.title} from favorites.`, "warning");
  }

  saveFavoritesToLocalStorage();
  renderCars();

  if (state.currentView === "favorites") {
    renderCars();
  }
}

function toggleCompareVehicle(id) {
  const index = state.compare.indexOf(id);
  const car = state.cars.find(c => c.id === id);
  if (!car) return;

  if (index === -1) {
    if (state.compare.length >= 3) {
      showNotification("You can compare up to 3 vehicles.", "error");
      return;
    }
    state.compare.push(id);
    showNotification(`Added ${car.title} to comparison matrix.`, "success");
  } else {
    state.compare.splice(index, 1);
    showNotification(`Removed ${car.title} from compare list.`, "warning");
  }

  saveCompareStateToSession();
  updateGlobalBadges();
  renderCars();

  if (state.currentView === "compare") {
    renderComparisonMatrix();
  }
}

function clearComparisonState() {
  state.compare = [];
  saveCompareStateToSession();
  showNotification("Cleared comparison selection.", "success");
  updateGlobalBadges();
  if (state.currentView === "compare") {
    renderComparisonMatrix();
  } else {
    renderCars();
  }
}

function resetAllFilters() {
  state.searchQuery = "";
  state.sort = "default";

  state.filters = {
    brand: "all",
    engine: "all",
    fuel: "all",
    yearMin: null,
    yearMax: null,
    priceMin: null,
    priceMax: null,
    hpMin: null,
    hpMax: null,
    modified: "all",
    availability: "all",
    tags: []
  };

  const search = document.getElementById("search-input");
  if (search) search.value = "";
  const clearS = document.getElementById("clear-search-btn");
  if (clearS) clearS.style.display = "none";

  const brand = document.getElementById("filter-brand");
  if (brand) brand.value = "all";
  const engine = document.getElementById("filter-engine");
  if (engine) engine.value = "all";
  const fuel = document.getElementById("filter-fuel");
  if (fuel) fuel.value = "all";
  const mod = document.getElementById("filter-modified");
  if (mod) mod.value = "all";
  const avail = document.getElementById("filter-availability");
  if (avail) avail.value = "all";

  ["year-min", "year-max", "price-min", "price-max", "hp-min", "hp-max"].forEach(id => {
    const el = document.getElementById(`filter-${id}`);
    if (el) el.value = "";
  });

  const sortSelect = document.getElementById("catalog-sort");
  if (sortSelect) sortSelect.value = "default";

  showNotification("All search filters and sorting preferences have been reset.", "success");
  renderCars();
}

// --- DYNAMIC COMPARISON MATRIX RENDERER ---
function renderComparisonMatrix() {
  const container = document.getElementById("comparison-matrix-wrapper");
  const emptyState = document.getElementById("compare-empty-state");

  if (!container || !emptyState) return;

  if (state.compare.length === 0) {
    container.style.display = "none";
    emptyState.style.display = "block";
    return;
  }

  container.style.display = "block";
  emptyState.style.display = "none";

  const selectedCars = state.compare.map(id => state.cars.find(c => c.id === id)).filter(Boolean);

  const validPrices = selectedCars.map(c => c.price).filter(p => typeof p === 'number');
  const minPrice = validPrices.length ? Math.min(...validPrices) : null;

  const validHPs = selectedCars.map(c => c.engine?.powerHp).filter(hp => typeof hp === 'number');
  const maxHP = validHPs.length ? Math.max(...validHPs) : null;

  const validRatings = selectedCars.map(c => c.rating).filter(r => typeof r === 'number');
  const maxRating = validRatings.length ? Math.max(...validRatings) : null;

  const validSpeeds = selectedCars.map(c => c.specifications?.topSpeedKmh).filter(s => typeof s === 'number');
  const maxSpeed = validSpeeds.length ? Math.max(...validSpeeds) : null;

  const validWeights = selectedCars.map(c => c.specifications?.weightKg).filter(w => typeof w === 'number');
  const minWeight = validWeights.length ? Math.min(...validWeights) : null;

  let tableHTML = `<table class="comparison-table">`;

  // ROW 1: Headers
  tableHTML += `<tr><th>Specification Matrix</th>`;
  selectedCars.forEach(car => {
    let priceStr = `${car.currency ?? "USD"} ${Number(car.price).toLocaleString()}`;
    if (car.currency === "USD") priceStr = `$${Number(car.price).toLocaleString()}`;
    if (car.currency === "EUR") priceStr = `€${Number(car.price).toLocaleString()}`;
    if (car.currency === "GBP") priceStr = `£${Number(car.price).toLocaleString()}`;

    const fallImg = car.image || "";
    const imgElHTML = fallImg
      ? `<img class="compare-head-image" src="${fallImg}" alt="${car.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
         <div class="image-fallback-placeholder compare-head-image" style="display: none; height: 120px;"><i class="fa-solid fa-car-rear" style="font-size: 1.8rem; color: var(--primary-color);"></i></div>`
      : `<div class="image-fallback-placeholder compare-head-image" style="display: flex; height: 120px; align-items: center; justify-content: center; background: #222834;"><i class="fa-solid fa-car-rear" style="font-size: 1.8rem; color: var(--primary-color);"></i></div>`;

    tableHTML += `
      <td class="comparison-column-header">
        <button class="btn btn-link btn-remove-compare" onclick="toggleCompareVehicle(${car.id})" aria-label="Remove from compare">
          <i class="fa-solid fa-circle-xmark"></i>
        </button>
        ${imgElHTML}
        <div class="compare-head-title" style="margin-top: 8px;">${car.title}</div>
        <div class="compare-head-price">${priceStr}</div>
      </td>
    `;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Brand</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.brand}</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Price</th>`;
  selectedCars.forEach(car => {
    const isLowest = car.price === minPrice && selectedCars.length > 1;
    const cl = isLowest ? 'class="highlighted-metric" title="Best Price Value"' : '';
    let priceStr = `${car.currency ?? "USD"} ${Number(car.price).toLocaleString()}`;
    if (car.currency === "USD") priceStr = `$${Number(car.price).toLocaleString()}`;
    if (car.currency === "EUR") priceStr = `€${Number(car.price).toLocaleString()}`;
    if (car.currency === "GBP") priceStr = `£${Number(car.price).toLocaleString()}`;
    tableHTML += `<td ${cl}>${priceStr} ${isLowest ? '<i class="fa-solid fa-circle-check"></i>' : ''}</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Model Year</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.year}</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Engine Config</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.engine?.type ?? "Not specified"} (${car.engine?.volume ? car.engine.volume + " L" : "N/A"})</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Horsepower (HP)</th>`;
  selectedCars.forEach(car => {
    const isHighest = car.engine?.powerHp === maxHP && selectedCars.length > 1;
    const cl = isHighest ? 'class="highlighted-metric" title="Most Power"' : '';
    tableHTML += `<td ${cl}>${car.engine?.powerHp ?? "N/A"} HP ${isHighest ? '<i class="fa-solid fa-fire-flame-curved"></i>' : ''}</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Fuel Type</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.engine?.fuel ?? "Not specified"}</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Transmission</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.specifications?.transmission ?? "Not specified"}</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Drivetrain Layout</th>`;
  selectedCars.forEach(car => { tableHTML += `<td>${car.specifications?.drivetrain ?? "Not specified"}</td>`; });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Curb Weight</th>`;
  selectedCars.forEach(car => {
    const isLightest = car.specifications?.weightKg === minWeight && selectedCars.length > 1;
    const cl = isLightest ? 'class="highlighted-metric" title="Lightest Bodyweight"' : '';
    const weightVal = car.specifications?.weightKg ? `${Number(car.specifications.weightKg).toLocaleString()} kg` : "N/A";
    tableHTML += `<td ${cl}>${weightVal} ${isLightest ? '<i class="fa-solid fa-feather"></i>' : ''}</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Top Speed</th>`;
  selectedCars.forEach(car => {
    const isFastest = car.specifications?.topSpeedKmh === maxSpeed && selectedCars.length > 1;
    const cl = isFastest ? 'class="highlighted-metric" title="Highest Top Speed"' : '';
    const speedVal = car.specifications?.topSpeedKmh ? `${car.specifications.topSpeedKmh} km/h` : "N/A";
    tableHTML += `<td ${cl}>${speedVal} ${isFastest ? '<i class="fa-solid fa-gauge-high"></i>' : ''}</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Odometer Reading</th>`;
  selectedCars.forEach(car => {
    const milVal = car.mileageKm !== undefined && car.mileageKm !== null ? `${Number(car.mileageKm).toLocaleString()} km` : "Not specified";
    tableHTML += `<td>${milVal}</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Global Rating</th>`;
  selectedCars.forEach(car => {
    const isHighest = car.rating === maxRating && selectedCars.length > 1;
    const cl = isHighest ? 'class="highlighted-metric" title="Highest Rated"' : '';
    tableHTML += `<td ${cl}><i class="fa-solid fa-star" style="color: var(--color-warning);"></i> ${car.rating ?? "N/A"} / 5</td>`;
  });
  tableHTML += `</tr>`;

  tableHTML += `<tr><th>Inspect Item</th>`;
  selectedCars.forEach(car => {
    tableHTML += `
      <td>
        <button class="btn btn-primary" onclick="openCarDetailModal(${car.id})" style="width: 100%; font-size: 0.85rem;">
          <i class="fa-solid fa-circle-info"></i> Open Details
        </button>
      </td>
    `;
  });
  tableHTML += `</tr>`;

  tableHTML += `</table>`;
  container.innerHTML = tableHTML;
}

// --- DYNAMIC TELEMETRY STATISTICS ANALYTICS ---
function renderStatistics() {
  const statTotalCars = document.getElementById("stat-total-cars");
  const statAvgPrice = document.getElementById("stat-avg-price");
  const statAvgMileage = document.getElementById("stat-avg-mileage");
  const statModified = document.getElementById("stat-modified-cars");
  const statFeatured = document.getElementById("stat-featured-cars");
  const statTopBrand = document.getElementById("stat-top-brand");
  const statTopEngine = document.getElementById("stat-top-engine");

  if (!statTotalCars) return;

  const total = state.cars.length;
  statTotalCars.textContent = total.toString();

  if (total === 0) {
    statAvgPrice.textContent = "$0";
    statAvgMileage.textContent = "0 km";
    statModified.textContent = "0";
    statFeatured.textContent = "0";
    statTopBrand.textContent = "-";
    statTopEngine.textContent = "-";

    const chartDecade = document.getElementById("decade-chart-container");
    if (chartDecade) chartDecade.innerHTML = "<p style='color: var(--text-muted);'>No vehicle metrics available.</p>";

    const brandContainer = document.getElementById("brand-distribution-container");
    if (brandContainer) brandContainer.innerHTML = "<p style='color: var(--text-muted);'>No brand configurations listed.</p>";
    return;
  }

  const totalPrice = state.cars.reduce((sum, car) => sum + (car.price || 0), 0);
  const avgPrice = Math.round(totalPrice / total);
  statAvgPrice.textContent = `$${avgPrice.toLocaleString()}`;

  const carsWithMileage = state.cars.filter(car => car.mileageKm !== undefined && car.mileageKm !== null);
  if (carsWithMileage.length > 0) {
    const totalMileage = carsWithMileage.reduce((sum, car) => sum + car.mileageKm, 0);
    const avgMileage = Math.round(totalMileage / carsWithMileage.length);
    statAvgMileage.textContent = `${avgMileage.toLocaleString()} km`;
  } else {
    statAvgMileage.textContent = "Not specified";
  }

  const modifiedCount = state.cars.filter(car => car.isModified).length;
  statModified.textContent = modifiedCount.toString();

  const featuredCount = state.cars.filter(car => car.isFeatured).length;
  statFeatured.textContent = featuredCount.toString();

  const brandCounts = state.cars.reduce((acc, car) => {
    if (car.brand) acc[car.brand] = (acc[car.brand] || 0) + 1;
    return acc;
  }, {});
  let topBrand = "-";
  let maxBrandCount = 0;
  for (const b in brandCounts) {
    if (brandCounts[b] > maxBrandCount) {
      maxBrandCount = brandCounts[b];
      topBrand = b;
    }
  }
  statTopBrand.textContent = `${topBrand} (${maxBrandCount})`;

  const engineCounts = state.cars.reduce((acc, car) => {
    const t = car.engine?.type;
    if (t) acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  let topEngine = "-";
  let maxEngineCount = 0;
  for (const e in engineCounts) {
    if (engineCounts[e] > maxEngineCount) {
      maxEngineCount = engineCounts[e];
      topEngine = e;
    }
  }
  statTopEngine.textContent = `${topEngine} (${maxEngineCount})`;

  const decadeChartContainer = document.getElementById("decade-chart-container");
  if (decadeChartContainer) {
    const decadeCounts = state.cars.reduce((acc, car) => {
      if (car.year) {
        const decStart = Math.floor(car.year / 10) * 10;
        acc[`${decStart}s`] = (acc[`${decStart}s`] || 0) + 1;
      }
      return acc;
    }, {});

    const sortedDecades = Object.keys(decadeCounts).sort();
    const maxDecadeQty = Math.max(...Object.values(decadeCounts));

    decadeChartContainer.innerHTML = "";
    sortedDecades.forEach(dec => {
      const qty = decadeCounts[dec];
      const pct = maxDecadeQty ? (qty / maxDecadeQty) * 100 : 0;
      decadeChartContainer.innerHTML += `
        <div class="chart-bar-wrapper">
          <span class="chart-label">${dec}</span>
          <div class="chart-track">
            <div class="chart-fill" style="width: ${pct}%;"></div>
          </div>
          <span class="chart-value">${qty}</span>
        </div>
      `;
    });
  }

  const brandDistributionContainer = document.getElementById("brand-distribution-container");
  if (brandDistributionContainer) {
    brandDistributionContainer.innerHTML = "";
    const sortedBrands = Object.keys(brandCounts).sort();
    sortedBrands.forEach(b => {
      const count = brandCounts[b];
      const matchingCars = state.cars.filter(c => c.brand === b);
      const totalBrandVal = matchingCars.reduce((s, c) => s + (c.price || 0), 0);
      const avgBrandPrice = Math.round(totalBrandVal / count);
      brandDistributionContainer.innerHTML += `
        <div class="brand-dist-row">
          <span class="brand-dist-name">${b}</span>
          <div class="brand-dist-stats">
            <span class="brand-dist-badge">${count} vehicle${count === 1 ? "" : "s"}</span>
            <span class="brand-dist-price">Avg: $${avgBrandPrice.toLocaleString()}</span>
          </div>
        </div>
      `;
    });
  }
}

// --- DETAIL MODAL DYNAMIC SPEC RENDERER ---
function openCarDetailModal(id) {
  const car = state.cars.find(c => c.id === id);
  if (!car) return;

  const modal = document.getElementById("detail-modal");
  const body = document.getElementById("detail-modal-body");

  if (!modal || !body) return;

  const isFav = state.favorites.includes(car.id);
  const isCompared = state.compare.includes(car.id);

  let priceStr = `${escapeHTML(car.currency ?? "USD")} ${Number(car.price).toLocaleString()}`;
  if (car.currency === "USD") priceStr = `$${Number(car.price).toLocaleString()}`;
  if (car.currency === "EUR") priceStr = `€${Number(car.price).toLocaleString()}`;
  if (car.currency === "GBP") priceStr = `£${Number(car.price).toLocaleString()}`;

  const featuredBadge = car.isFeatured ? `<span class="badge badge-featured"><i class="fa-solid fa-star"></i> Featured Item</span>` : "";
  const buildBadge = car.isModified
    ? `<span class="badge badge-modified"><i class="fa-solid fa-bolt"></i> Custom Modified</span>`
    : `<span class="badge badge-original"><i class="fa-solid fa-certificate"></i> Factory Stock</span>`;

  const transmissionVal = car.specifications?.transmission ? escapeHTML(car.specifications.transmission) : "Not specified";
  const drivetrainVal = car.specifications?.drivetrain ? escapeHTML(car.specifications.drivetrain) : "Not specified";
  const weightVal = car.specifications?.weightKg ? `${Number(car.specifications.weightKg).toLocaleString()} kg` : "Not specified";
  const speedVal = car.specifications?.topSpeedKmh ? `${Number(car.specifications.topSpeedKmh)} km/h` : "Not specified";

  const engineTypeVal = car.engine?.type ? escapeHTML(car.engine.type) : "Standard Config";
  const engineVolumeVal = car.engine?.volume ? `${Number(car.engine.volume)} L` : "N/A";
  const enginePowerVal = car.engine?.powerHp ? `${Number(car.engine.powerHp)} HP` : "N/A";
  const engineFuelVal = car.engine?.fuel ? escapeHTML(car.engine.fuel) : "Not specified";

  const mileageVal = car.mileageKm !== undefined && car.mileageKm !== null
    ? `${Number(car.mileageKm).toLocaleString()} km`
    : "Not specified";

  const ratingVal = car.rating ? `${Number(car.rating)} / 5` : "N/A";

  let featuresHTML = "";
  if (car.features && car.features.length > 0) {
    car.features.forEach(feat => {
      featuresHTML += `<li class="detail-feature-item"><i class="fa-solid fa-check"></i> <span>${escapeHTML(feat)}</span></li>`;
    });
  } else {
    featuresHTML = `<li class="detail-feature-item" style="color: var(--text-muted);">No extra accessories specified.</li>`;
  }

  let tagsHTML = "";
  if (car.tags && car.tags.length > 0) {
    car.tags.forEach(tag => {
      tagsHTML += `<span class="detail-tag-badge">${escapeHTML(tag)}</span>`;
    });
  }

  const availText = car.isAvailable ? "Available For Purchase" : "Sold / Out of Stock";
  const availClass = car.isAvailable ? "badge-original" : "badge-sold";

  const ownerVerifiedBadge = car.owner?.verified
    ? `<span style="color: var(--color-success); font-size: 0.85rem;" title="Verified seller identity"><i class="fa-solid fa-circle-check"></i> Verified Owner</span>`
    : `<span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-solid fa-circle-minus"></i> Standard Account</span>`;

  const fallImg = car.image || "";
  const imgHTML = fallImg
    ? `<img class="detail-img" src="${escapeHTML(fallImg)}" alt="${escapeHTML(car.brand)} ${escapeHTML(car.model)}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
       <div class="image-fallback-placeholder detail-img" style="display: none; height: 100%; min-height: 250px;"><i class="fa-solid fa-car-rear" style="font-size: 3rem; color: var(--primary-color);"></i></div>`
    : `<div class="image-fallback-placeholder detail-img" style="display: flex; height: 100%; min-height: 250px; align-items: center; justify-content: center; background: #0c0e12;"><i class="fa-solid fa-car-rear" style="font-size: 3rem; color: var(--primary-color);"></i></div>`;

  body.innerHTML = `
    <div class="detail-grid">
      <div class="detail-left-pane">
        <div class="detail-img-container">
          ${imgHTML}
        </div>
        <div class="detail-tags-badges">
          ${tagsHTML}
        </div>
      </div>

      <div class="detail-info-pane">
        <span class="detail-brand">${escapeHTML(car.brand)}</span>
        <div class="detail-title-row">
          <h2 class="detail-title">${escapeHTML(car.title)}</h2>
          <span class="detail-year">(${Number(car.year)})</span>
        </div>

        <div class="detail-price-row">
          <span class="detail-price">${priceStr}</span>
          <span class="detail-availability-badge badge ${availClass}">${availText}</span>
        </div>

        <div class="detail-sections-wrapper">
          <div>
            <h4 class="detail-block-title">Engine configuration</h4>
            <div class="detail-specs-subgrid">
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Type Block</span>
                <span class="detail-spec-value">${engineTypeVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Displacement</span>
                <span class="detail-spec-value">${engineVolumeVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Engine Horsepower</span>
                <span class="detail-spec-value">${enginePowerVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Fuel Delivery</span>
                <span class="detail-spec-value">${engineFuelVal}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="detail-block-title">Mechanics & Telemetry</h4>
            <div class="detail-specs-subgrid">
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Transmission System</span>
                <span class="detail-spec-value">${transmissionVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Drivetrain Configuration</span>
                <span class="detail-spec-value">${drivetrainVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Curb Weight</span>
                <span class="detail-spec-value">${weightVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Calculated Top Speed</span>
                <span class="detail-spec-value">${speedVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Odometer Reading</span>
                <span class="detail-spec-value">${mileageVal}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Global Rating Score</span>
                <span class="detail-spec-value"><i class="fa-solid fa-star" style="color: var(--color-warning);"></i> ${ratingVal}</span>
              </div>
            </div>
          </div>

          <div>
            <h4 class="detail-block-title">Accessories & Features</h4>
            <ul class="detail-features-list">
              ${featuresHTML}
            </ul>
          </div>

          <div>
            <h4 class="detail-block-title">Custodian Identity</h4>
            <div class="detail-specs-subgrid">
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Owner Name</span>
                <span class="detail-spec-value">${escapeHTML(car.owner?.name ?? "Independent Dealer")}</span>
              </div>
              <div class="detail-spec-entry">
                <span class="detail-spec-label">Identity Status</span>
                <span class="detail-spec-value">${ownerVerifiedBadge}</span>
              </div>
            </div>
          </div>

          ${car.specialFeature ? `
            <div class="detail-special-note-box">
              <h5>Special Collector Telemetry</h5>
              <p>${escapeHTML(car.specialFeature)}</p>
            </div>
          ` : ""}
        </div>

        <div class="detail-modal-footer">
          <button class="btn btn-card-fav ${isFav ? "active" : ""}" onclick="toggleFavoriteCar(${car.id}); openCarDetailModal(${car.id});" style="width: 44px; height: 44px; border-radius: var(--radius-md);">
            <i class="fa-${isFav ? "solid" : "regular"} fa-heart" style="font-size: 1.15rem;"></i>
          </button>

          <button class="btn btn-outline ${isCompared ? "active" : ""}" onclick="toggleCompareVehicle(${car.id}); openCarDetailModal(${car.id});">
            <i class="fa-solid fa-code-compare"></i> Compare Selected
          </button>

          <div class="detail-actions-right">
            <button class="btn btn-outline" onclick="openEditCarModal(${car.id})">
              <i class="fa-solid fa-pen-to-square"></i> Edit
            </button>
            <button class="btn btn-danger" onclick="triggerDeleteCarConfirm(${car.id})">
              <i class="fa-solid fa-trash-can"></i> Delete
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

// --- CRUD OPERATIONS IMPLEMENTATION ---
function openAddCarModal() {
  const modal = document.getElementById("crud-modal");
  const title = document.getElementById("crud-modal-title");
  const form = document.getElementById("car-crud-form");

  if (!modal || !form) return;

  form.reset();
  document.getElementById("crud-car-id").value = "";
  clearFormValidationErrors();

  if (title) title.textContent = "Register New Vehicle";

  document.getElementById("crud-is-available").checked = true;
  document.getElementById("crud-is-featured").checked = false;
  document.getElementById("crud-is-modified").checked = false;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function openEditCarModal(id) {
  closeModal("detail-modal");

  const car = state.cars.find(c => c.id === id);
  if (!car) return;

  const modal = document.getElementById("crud-modal");
  const title = document.getElementById("crud-modal-title");
  const form = document.getElementById("car-crud-form");

  if (!modal || !form) return;

  clearFormValidationErrors();

  if (title) title.textContent = `Edit Details: ${car.title}`;

  document.getElementById("crud-car-id").value = car.id;
  document.getElementById("crud-title").value = car.title || "";
  document.getElementById("crud-brand").value = car.brand || "";
  document.getElementById("crud-model").value = car.model || "";
  document.getElementById("crud-year").value = car.year || "";
  document.getElementById("crud-price").value = car.price || "";
  document.getElementById("crud-currency").value = car.currency || "USD";
  document.getElementById("crud-image").value = car.image || "";
  document.getElementById("crud-location").value = car.location || "";

  document.getElementById("crud-mileage").value = car.mileageKm !== undefined && car.mileageKm !== null ? car.mileageKm : "";

  document.getElementById("crud-owner-name").value = car.owner?.name || "";
  document.getElementById("crud-owner-verified").checked = car.owner?.verified || false;
  document.getElementById("crud-rating").value = car.rating !== undefined && car.rating !== null ? car.rating : "";

  document.getElementById("crud-engine-type").value = car.engine?.type || "";
  document.getElementById("crud-engine-volume").value = car.engine?.volume !== undefined && car.engine?.volume !== null ? car.engine.volume : "";
  document.getElementById("crud-power").value = car.engine?.powerHp !== undefined && car.engine?.powerHp !== null ? car.engine.powerHp : "";
  document.getElementById("crud-fuel").value = car.engine?.fuel || "Petrol";

  document.getElementById("crud-transmission").value = car.specifications?.transmission || "";
  document.getElementById("crud-drivetrain").value = car.specifications?.drivetrain || "";
  document.getElementById("crud-weight").value = car.specifications?.weightKg || "";
  document.getElementById("crud-topspeed").value = car.specifications?.topSpeedKmh || "";

  document.getElementById("crud-special-feature").value = car.specialFeature || "";

  document.getElementById("crud-features").value = car.features ? car.features.join(", ") : "";
  document.getElementById("crud-tags").value = car.tags ? car.tags.join(", ") : "";

  document.getElementById("crud-is-modified").checked = car.isModified || false;
  document.getElementById("crud-is-featured").checked = car.isFeatured || false;
  document.getElementById("crud-is-available").checked = car.isAvailable !== false;

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function validateForm() {
  let isValid = true;
  clearFormValidationErrors();

  const title = document.getElementById("crud-title");
  const brand = document.getElementById("crud-brand");
  const model = document.getElementById("crud-model");
  const year = document.getElementById("crud-year");
  const price = document.getElementById("crud-price");
  const image = document.getElementById("crud-image");
  const location = document.getElementById("crud-location");
  const ownerName = document.getElementById("crud-owner-name");
  const engineType = document.getElementById("crud-engine-type");
  const engineVolume = document.getElementById("crud-engine-volume");
  const horsepower = document.getElementById("crud-power");
  const transmission = document.getElementById("crud-transmission");
  const drivetrain = document.getElementById("crud-drivetrain");
  const weight = document.getElementById("crud-weight");
  const topspeed = document.getElementById("crud-topspeed");
  const rating = document.getElementById("crud-rating");
  const mileage = document.getElementById("crud-mileage");

  if (!title.value.trim()) { showInputError("title", "Title heading is a required field."); isValid = false; }
  if (!brand.value.trim()) { showInputError("brand", "Vehicle Brand is a required field."); isValid = false; }
  if (!model.value.trim()) { showInputError("model", "Vehicle Model details are required."); isValid = false; }
  if (!location.value.trim()) { showInputError("location", "Registry location is required."); isValid = false; }
  if (!ownerName.value.trim()) { showInputError("owner-name", "Custodian owner name is required."); isValid = false; }
  if (!engineType.value.trim()) { showInputError("engine-type", "Engine layout type block is required."); isValid = false; }
  if (!transmission.value.trim()) { showInputError("transmission", "Gearbox transmission system is required."); isValid = false; }
  if (!drivetrain.value.trim()) { showInputError("drivetrain", "Chassis drivetrain layout is required."); isValid = false; }

  const yrNum = parseInt(year.value);
  if (isNaN(yrNum) || yrNum < 1886 || yrNum > 2100) {
    showInputError("year", "Please enter a valid production year (1886 - 2100).");
    isValid = false;
  }

  const priceNum = parseFloat(price.value);
  if (isNaN(priceNum) || priceNum < 0) {
    showInputError("price", "Pricing value cannot be a negative amount.");
    isValid = false;
  }

  const volNum = parseFloat(engineVolume.value);
  if (isNaN(volNum) || volNum < 0) {
    showInputError("engine-volume", "Displacement volume cannot be negative.");
    isValid = false;
  }

  const hpNum = parseInt(horsepower.value);
  if (isNaN(hpNum) || hpNum < 0) {
    showInputError("power", "Horsepower rating cannot be a negative number.");
    isValid = false;
  }

  const wtNum = parseInt(weight.value);
  if (isNaN(wtNum) || wtNum < 0) {
    showInputError("weight", "Curb weight capacity cannot be negative.");
    isValid = false;
  }

  const spNum = parseInt(topspeed.value);
  if (isNaN(spNum) || spNum < 0) {
    showInputError("topspeed", "Top speed speed value cannot be negative.");
    isValid = false;
  }

  if (!image.value.trim()) {
    showInputError("image", "Image URL location is required.");
    isValid = false;
  } else {
    try {
      new URL(image.value.trim());
    } catch (_) {
      showInputError("image", "Please specify a correctly formatted absolute http/https URL link.");
      isValid = false;
    }
  }

  if (rating.value.trim() !== "") {
    const rtVal = parseFloat(rating.value);
    if (isNaN(rtVal) || rtVal < 0 || rtVal > 5) {
      showInputError("rating", "Rating evaluation score must be between 0 and 5.");
      isValid = false;
    }
  }

  if (mileage.value.trim() !== "") {
    const milVal = parseFloat(mileage.value);
    if (isNaN(milVal) || milVal < 0) {
      showInputError("mileage", "Odometer mileage count cannot be negative.");
      isValid = false;
    }
  }

  return isValid;
}

function showInputError(id, msg) {
  const el = document.getElementById(`crud-${id}`);
  const errorLabel = document.getElementById(`error-${id}`);
  if (el && errorLabel) {
    el.closest(".form-group").classList.add("invalid");
    errorLabel.textContent = msg;
  }
}

function clearFormValidationErrors() {
  document.querySelectorAll(".form-group").forEach(fg => { fg.classList.remove("invalid"); });
  document.querySelectorAll(".error-message").forEach(label => { label.textContent = ""; });
}

function saveVehicle(e) {
  e.preventDefault();

  if (!validateForm()) {
    showNotification("Please correct the validation errors in the form.", "error");
    return;
  }

  const editIdStr = document.getElementById("crud-car-id").value;
  const isEdit = editIdStr !== "";

  const rawFeatures = document.getElementById("crud-features").value;
  const parsedFeatures = rawFeatures
    ? rawFeatures.split(",").map(item => item.trim()).filter(Boolean)
    : [];

  const rawTags = document.getElementById("crud-tags").value;
  const parsedTags = rawTags
    ? rawTags.split(",").map(item => item.trim()).filter(Boolean)
    : [];

  const ratingInput = document.getElementById("crud-rating").value;
  const mileageInput = document.getElementById("crud-mileage").value;

  const carObj = {
    id: isEdit ? parseInt(editIdStr) : generateNewCarId(),
    title: document.getElementById("crud-title").value.trim(),
    brand: document.getElementById("crud-brand").value.trim(),
    model: document.getElementById("crud-model").value.trim(),
    year: parseInt(document.getElementById("crud-year").value),
    price: parseFloat(document.getElementById("crud-price").value),
    currency: document.getElementById("crud-currency").value,
    image: document.getElementById("crud-image").value.trim(),
    location: document.getElementById("crud-location").value.trim(),
    owner: {
      name: document.getElementById("crud-owner-name").value.trim(),
      verified: document.getElementById("crud-owner-verified").checked
    },
    engine: {
      type: document.getElementById("crud-engine-type").value.trim(),
      volume: parseFloat(document.getElementById("crud-engine-volume").value),
      powerHp: parseInt(document.getElementById("crud-power").value),
      fuel: document.getElementById("crud-fuel").value
    },
    specifications: {
      transmission: document.getElementById("crud-transmission").value.trim(),
      drivetrain: document.getElementById("crud-drivetrain").value.trim(),
      weightKg: parseInt(document.getElementById("crud-weight").value),
      topSpeedKmh: parseInt(document.getElementById("crud-topspeed").value)
    },
    features: parsedFeatures,
    tags: parsedTags,
    isModified: document.getElementById("crud-is-modified").checked,
    isFeatured: document.getElementById("crud-is-featured").checked,
    isAvailable: document.getElementById("crud-is-available").checked,
    mileageKm: mileageInput !== "" ? parseFloat(mileageInput) : undefined,
    rating: ratingInput !== "" ? parseFloat(ratingInput) : undefined,
    specialFeature: document.getElementById("crud-special-feature").value.trim() || undefined
  };

  if (isEdit) {
    const idx = state.cars.findIndex(c => c.id === carObj.id);
    if (idx !== -1) {
      state.cars[idx] = carObj;
      showNotification(`Vehicle ${carObj.title} updated successfully!`, "success");
    }
  } else {
    state.cars.unshift(carObj);
    showNotification(`New vehicle ${carObj.title} registered successfully!`, "success");
  }

  saveCarsToLocalStorage();
  closeModal("crud-modal");

  if (state.currentView === "dashboard") {
    renderStatistics();
  } else {
    renderCars();
  }
}

function generateNewCarId() {
  if (state.cars.length === 0) return 1;
  const maxId = Math.max(...state.cars.map(c => c.id));
  return maxId + 1;
}

let pendingDeleteCarId = null;

function triggerDeleteCarConfirm(id) {
  closeModal("detail-modal");

  const car = state.cars.find(c => c.id === id);
  if (!car) return;

  pendingDeleteCarId = id;

  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-modal-title");
  const confirmDesc = document.getElementById("confirm-modal-description");
  const confirmBtn = document.getElementById("btn-confirm-accept");
  const cancelBtn = document.getElementById("btn-confirm-cancel");

  if (!confirmModal) return;

  if (confirmTitle) confirmTitle.textContent = `De-register ${car.title}?`;
  if (confirmDesc) confirmDesc.textContent = `Are you absolutely sure you want to remove this vehicle from the index catalog? This operation cannot be undone.`;

  confirmBtn.onclick = executeDeleteCar;
  cancelBtn.onclick = () => closeModal("confirm-modal");

  confirmModal.style.display = "flex";
}

function executeDeleteCar() {
  if (pendingDeleteCarId === null) return;

  const id = pendingDeleteCarId;
  const car = state.cars.find(c => c.id === id);

  if (car) {
    state.cars = state.cars.filter(c => c.id !== id);
    state.compare = state.compare.filter(cid => cid !== id);
    state.favorites = state.favorites.filter(fid => fid !== id);
    saveCompareStateToSession();
    saveFavoritesToLocalStorage();
    saveCarsToLocalStorage();

    showNotification(`De-registered ${car.title} successfully.`, "warning");
  }

  pendingDeleteCarId = null;
  closeModal("confirm-modal");

  if (state.currentView === "dashboard") {
    renderStatistics();
  } else {
    renderCars();
  }
}

// --- DATABASE ADMINISTRATION (RESET, IMPORT, EXPORT) ---
let pendingDbReset = false;

function triggerDatabaseResetConfirm() {
  pendingDbReset = true;

  const confirmModal = document.getElementById("confirm-modal");
  const confirmTitle = document.getElementById("confirm-modal-title");
  const confirmDesc = document.getElementById("confirm-modal-description");
  const confirmBtn = document.getElementById("btn-confirm-accept");
  const cancelBtn = document.getElementById("btn-confirm-cancel");

  if (!confirmModal) return;

  if (confirmTitle) confirmTitle.textContent = "Restore Original Dataset?";
  if (confirmDesc) confirmDesc.textContent = "This will restore the factory original vehicle records catalog. Any added, edited, or deleted records will be discarded. Your Favorites and Theme settings will NOT be changed.";

  confirmBtn.onclick = executeDatabaseReset;
  cancelBtn.onclick = () => closeModal("confirm-modal");

  confirmModal.style.display = "flex";
}

async function executeDatabaseReset() {
  if (!pendingDbReset) return;

  try {
    const response = await fetch("./data/cars.json");
    if (!response.ok) throw new Error("Reset Fetch Failure");
    const data = await response.json();

    state.cars = data.cars || [];
    saveCarsToLocalStorage();

    const validCarIds = state.cars.map(c => c.id);
    state.favorites = state.favorites.filter(id => validCarIds.includes(id));
    saveFavoritesToLocalStorage();

    state.compare = [];
    saveCompareStateToSession();

    showNotification("Localized database restored to factory specifications.", "success");
  } catch (error) {
    console.error(error);
    showNotification("Error: Factory dataset restoration failed.", "error");
  }

  pendingDbReset = false;
  closeModal("confirm-modal");
  navigateToView("marketplace");
}

function exportJSON() {
  try {
    const payload = { cars: state.cars };
    const str = JSON.stringify(payload, null, 2);
    const blob = new Blob([str], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `autohub_database_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();

    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification("JSON vehicle index registry exported successfully.", "success");
  } catch (err) {
    console.error(err);
    showNotification("Export Failure: Unable to stringify telemetry payload.", "error");
  }
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    try {
      const parsed = JSON.parse(evt.target.result);

      if (!parsed || typeof parsed !== 'object') {
        throw new Error("Invalid root layout config structure.");
      }
      if (!parsed.cars || !Array.isArray(parsed.cars)) {
        throw new Error("Import payload is missing the required 'cars' array.");
      }

      const validatedList = [];
      parsed.cars.forEach((car, index) => {
        if (!car.title || !car.brand || !car.model) {
          throw new Error(`Item at position #${index + 1} is missing mandatory title/brand/model details.`);
        }
        if (typeof car.price !== 'number' || car.price < 0) {
          throw new Error(`Item '${car.title}' has an invalid or negative pricing parameter.`);
        }
        if (typeof car.year !== 'number' || car.year < 1886) {
          throw new Error(`Item '${car.title}' has an invalid production year.`);
        }

        const validatedCar = {
          id: car.id || (1000 + index),
          title: String(car.title).trim(),
          brand: String(car.brand).trim(),
          model: String(car.model).trim(),
          year: Number(car.year),
          price: Number(car.price),
          currency: car.currency || "USD",
          image: car.image || "",
          location: car.location || "Unknown Registry",
          owner: {
            name: car.owner?.name || "Independent Dealer",
            verified: !!car.owner?.verified
          },
          engine: {
            type: car.engine?.type || "Standard Layout",
            volume: typeof car.engine?.volume === 'number' ? car.engine.volume : 0,
            powerHp: typeof car.engine?.powerHp === 'number' ? car.engine.powerHp : 0,
            fuel: car.engine?.fuel || "Petrol"
          },
          specifications: {
            transmission: car.specifications?.transmission || "Manual/Auto",
            drivetrain: car.specifications?.drivetrain || "RWD",
            weightKg: typeof car.specifications?.weightKg === 'number' ? car.specifications.weightKg : 1000,
            topSpeedKmh: typeof car.specifications?.topSpeedKmh === 'number' ? car.specifications.topSpeedKmh : 200
          },
          features: Array.isArray(car.features) ? car.features : [],
          tags: Array.isArray(car.tags) ? car.tags : [],
          isModified: !!car.isModified,
          isFeatured: !!car.isFeatured,
          isAvailable: car.isAvailable !== false,
          mileageKm: typeof car.mileageKm === 'number' ? car.mileageKm : undefined,
          rating: typeof car.rating === 'number' ? car.rating : undefined,
          specialFeature: car.specialFeature || undefined
        };

        validatedList.push(validatedCar);
      });

      state.cars = validatedList;
      saveCarsToLocalStorage();

      state.compare = [];
      saveCompareStateToSession();

      const validIds = state.cars.map(c => c.id);
      state.favorites = state.favorites.filter(id => validIds.includes(id));
      saveFavoritesToLocalStorage();

      showNotification(`Import success! Loaded ${state.cars.length} vehicles into database state.`, "success");
      navigateToView("marketplace");
    } catch (err) {
      console.error(err);
      showNotification(`Failed to import JSON: ${err.message}`, "error");
    } finally {
      e.target.value = "";
    }
  };

  reader.onerror = function() {
    showNotification("Unable to parse the selected file configuration.", "error");
  };

  reader.readAsText(file);
}

// --- MODALS CLOSE ACTIONS UTILS ---
function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

function closeAllModals() {
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.style.display = "none";
  });
  document.body.style.overflow = "";
}

// --- EVENTS REGISTRATION CORE CONTROLLER ---
function setupEventListeners() {
  document.querySelectorAll("[data-view]").forEach(btn => {
    btn.addEventListener("click", (e) => {
      const view = e.currentTarget.getAttribute("data-view");
      navigateToView(view);
      closeMobileMenu();
    });
  });

  const hamburger = document.getElementById("mobile-hamburger-btn");
  if (hamburger) {
    hamburger.addEventListener("click", toggleMobileMenu);
  }

  const themeBtn = document.getElementById("theme-toggle-btn");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      state.theme = state.theme === "dark" ? "light" : "dark";
      saveThemeToLocalStorage();
      applyTheme();
    });
  }

  const searchInput = document.getElementById("search-input");
  const clearSearch = document.getElementById("clear-search-btn");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      state.searchQuery = e.target.value;
      if (clearSearch) {
        clearSearch.style.display = state.searchQuery ? "block" : "none";
      }
      renderCars();
    });
  }
  if (clearSearch) {
    clearSearch.addEventListener("click", () => {
      if (searchInput) {
        searchInput.value = "";
        state.searchQuery = "";
      }
      clearSearch.style.display = "none";
      renderCars();
    });
  }

  const brandFilter = document.getElementById("filter-brand");
  if (brandFilter) {
    brandFilter.addEventListener("change", (e) => {
      state.filters.brand = e.target.value;
      renderCars();
    });
  }

  const engineFilter = document.getElementById("filter-engine");
  if (engineFilter) {
    engineFilter.addEventListener("change", (e) => {
      state.filters.engine = e.target.value;
      renderCars();
    });
  }

  const fuelFilter = document.getElementById("filter-fuel");
  if (fuelFilter) {
    fuelFilter.addEventListener("change", (e) => {
      state.filters.fuel = e.target.value;
      renderCars();
    });
  }

  const modifiedFilter = document.getElementById("filter-modified");
  if (modifiedFilter) {
    modifiedFilter.addEventListener("change", (e) => {
      state.filters.modified = e.target.value;
      renderCars();
    });
  }

  const availabilityFilter = document.getElementById("filter-availability");
  if (availabilityFilter) {
    availabilityFilter.addEventListener("change", (e) => {
      state.filters.availability = e.target.value;
      renderCars();
    });
  }

  ["year-min", "year-max", "price-min", "price-max", "hp-min", "hp-max"].forEach(id => {
    const el = document.getElementById(`filter-${id}`);
    if (el) {
      el.addEventListener("input", (e) => {
        const val = e.target.value === "" ? null : parseFloat(e.target.value);
        const camelKey = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
        state.filters[camelKey] = val;
        renderCars();
      });
    }
  });

  const sortingSelect = document.getElementById("catalog-sort");
  if (sortingSelect) {
    sortingSelect.addEventListener("change", (e) => {
      state.sort = e.target.value;
      renderCars();
    });
  }

  const resetSidebarBtn = document.getElementById("reset-filters-sidebar-btn");
  if (resetSidebarBtn) {
    resetSidebarBtn.addEventListener("click", resetAllFilters);
  }
  const resetEmptyStateBtn = document.getElementById("empty-state-reset-btn");
  if (resetEmptyStateBtn) {
    resetEmptyStateBtn.addEventListener("click", resetAllFilters);
  }

  const heroBrowse = document.getElementById("hero-browse-btn");
  if (heroBrowse) {
    heroBrowse.addEventListener("click", () => navigateToView("marketplace"));
  }
  const heroStats = document.getElementById("hero-stats-btn");
  if (heroStats) {
    heroStats.addEventListener("click", () => navigateToView("dashboard"));
  }

  const mobileFilterBtn = document.getElementById("mobile-filter-toggle");
  const closeSidebarBtn = document.getElementById("close-sidebar-btn");
  const filtersSidebar = document.getElementById("sidebar-filters-container");

  if (mobileFilterBtn && filtersSidebar) {
    mobileFilterBtn.addEventListener("click", () => {
      filtersSidebar.classList.add("active");
    });
  }
  if (closeSidebarBtn && filtersSidebar) {
    closeSidebarBtn.addEventListener("click", () => {
      filtersSidebar.classList.remove("active");
    });
  }

  const carsGrid = document.getElementById("cars-grid-container");
  if (carsGrid) {
    carsGrid.addEventListener("click", handleGridAction);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeAllModals();
    }
  });

  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeAllModals();
      }
    });
  });

  const closeDetailBtn = document.getElementById("close-detail-modal");
  if (closeDetailBtn) {
    closeDetailBtn.addEventListener("click", () => closeModal("detail-modal"));
  }

  const exportBtn = document.getElementById("btn-export-json");
  if (exportBtn) {
    exportBtn.addEventListener("click", exportJSON);
  }

  const importInput = document.getElementById("file-import-json");
  if (importInput) {
    importInput.addEventListener("change", importJSON);
  }

  const resetDbBtn = document.getElementById("btn-reset-db");
  if (resetDbBtn) {
    resetDbBtn.addEventListener("click", triggerDatabaseResetConfirm);
  }

  const addCarHeader = document.getElementById("add-car-header-btn");
  if (addCarHeader) {
    addCarHeader.addEventListener("click", openAddCarModal);
  }
  const addCarMobile = document.getElementById("mobile-add-car-btn");
  if (addCarMobile) {
    addCarMobile.addEventListener("click", () => {
      closeMobileMenu();
      openAddCarModal();
    });
  }

  const cancelCrud = document.getElementById("btn-cancel-crud");
  if (cancelCrud) {
    cancelCrud.addEventListener("click", () => closeModal("crud-modal"));
  }
  const closeCrudX = document.getElementById("close-crud-modal");
  if (closeCrudX) {
    closeCrudX.addEventListener("click", () => closeModal("crud-modal"));
  }

  const crudForm = document.getElementById("car-crud-form");
  if (crudForm) {
    crudForm.addEventListener("submit", saveVehicle);
  }

  const backToMarketCompare = document.getElementById("compare-back-to-market");
  if (backToMarketCompare) {
    backToMarketCompare.addEventListener("click", () => navigateToView("marketplace"));
  }
  const clearCompareBtn = document.getElementById("clear-compare-matrix-btn");
  if (clearCompareBtn) {
    clearCompareBtn.addEventListener("click", clearComparisonState);
  }

  const logoBtn = document.getElementById("logo-btn");
  if (logoBtn) {
    logoBtn.addEventListener("click", (e) => {
      e.preventDefault();
      navigateToView("marketplace");
    });
  }
}

// --- BURGER MENU MOBILE TOGGLES ---
function toggleMobileMenu() {
  const overlay = document.getElementById("mobile-nav-overlay");
  const bars = document.querySelector(".menu-open-icon");
  const close = document.querySelector(".menu-close-icon");
  const btn = document.getElementById("mobile-hamburger-btn");

  if (overlay && btn) {
    const active = overlay.classList.toggle("active");
    btn.setAttribute("aria-expanded", active);
    if (active) {
      bars.style.display = "none";
      close.style.display = "block";
    } else {
      bars.style.display = "block";
      close.style.display = "none";
    }
  }
}

function closeMobileMenu() {
  const overlay = document.getElementById("mobile-nav-overlay");
  const bars = document.querySelector(".menu-open-icon");
  const close = document.querySelector(".menu-close-icon");
  const btn = document.getElementById("mobile-hamburger-btn");

  if (overlay && overlay.classList.contains("active")) {
    overlay.classList.remove("active");
    btn.setAttribute("aria-expanded", "false");
    bars.style.display = "block";
    close.style.display = "none";
  }
}

// --- GLOBAL ATTACHMENTS FOR WINDOW CONTEXT LINKS ---
window.toggleCompareVehicle = toggleCompareVehicle;
window.openCarDetailModal = openCarDetailModal;
window.openEditCarModal = openEditCarModal;
window.triggerDeleteCarConfirm = triggerDeleteCarConfirm;
window.toggleFavoriteCar = toggleFavoriteCar;
