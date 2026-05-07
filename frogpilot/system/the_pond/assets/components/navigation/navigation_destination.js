import { html, reactive } from "https://esm.sh/@arrow-js/core";
import {
  addRouteToMap,
  formatMetersToHuman,
  formatSecondsToHuman,
  gcj02ToWgs84,
  getCoordinatesFromSearch,
  getRoutes,
  removeRouteFromMap,
  getOrdinalSuffix,
  highlightRoute,
  wgs84ToGcj02,
} from "./navigation_utilities.js";
import { Modal } from "/assets/components/modal.js";

async function setSpecial(favorite, type, state, loadFavoritesAlphabetically) {
  try {
    const isCurrentlyHome = favorite.is_home;
    const isCurrentlyWork = favorite.is_work;
    let newIsHome = null;
    let newIsWork = null;
    let message = "";
    if (type === "home") {
      if (isCurrentlyHome) {
        newIsHome = false;
        message = "已取消家庭地址！";
      } else {
        newIsHome = true;
        if (isCurrentlyWork) newIsWork = false;
        message = "已设置家庭地址！";
      }
    } else if (type === "work") {
      if (isCurrentlyWork) {
        newIsWork = false;
        message = "已取消工作地址！";
      } else {
        newIsWork = true;
        if (isCurrentlyHome) newIsHome = false;
        message = "已设置工作地址！";
      }
    }
    const body = { routeId: favorite.routeId, id: favorite.id };
    if (newIsHome !== null) body.is_home = newIsHome;
    if (newIsWork !== null) body.is_work = newIsWork;
    await fetch("/api/navigation/favorite/rename", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    showSnackbar(message);
    const sorted = await loadFavoritesAlphabetically();
    state.suggestions = "[]";
    await new Promise(resolve => setTimeout(resolve, 0));
    state.suggestions = JSON.stringify(sorted);
  } catch {
    showSnackbar(`更新${type === "home" ? "家庭" : "工作"}地址失败...`);
  }
}

export function NavDestination() {
  let map;
  let destinationMarker;
  let favoriteMarkers = [];
  const state = reactive({
amap1Key: undefined,
    amap2Key: undefined,
    amapWebKey: undefined,
    confirmedRoute: null,
    confirmedRouteRefresh: 0,
    destination: undefined,
    favoriteToRemove: null,
    favoriteToRename: null,
    favoritesCount: 0,
    favoritesVisible: false,
    initialized: false,
    isMetric: true,
    lastPosition: undefined,
    loadingRoute: false,
    missingKeys: null,
    newFavoriteName: "",
    noResults: false,
    previousDestinations: "[]",
    searchLoading: false,
    selectedRoute: null,
    showRemoveFavoriteModal: false,
    showRenameFavoriteModal: false,
    suggestions: "[]",
    useAMapRouting: false,
    amapRouteStrategy: 32
  });
  const searchFieldState = reactive({ value: "" });

  let amapLoadPromise = null;
  let amapNamespace = null;
let amapAutoComplete = null;
  let searchRequestId = 0;
  let isComposing = false;
  let drawnRoutes = [];

  /**
   * Loads AMap JS API v2 once and returns the AMap namespace.
   * Callers needing the AutoComplete instance must call ensureAMapAutoComplete().
   */
  async function ensureAMapLoaded() {
    if (amapNamespace) return amapNamespace;
    if (amapLoadPromise) return await amapLoadPromise;

    if (!state.amap1Key || !state.amap2Key) {
      showSnackbar("高德地图密钥未配置", "error");
      return null;
    }

    if (typeof AMapLoader === 'undefined') {
      showSnackbar("高德地图加载器不可用，请检查网络连接。", "error");
      return null;
    }

    window._AMapSecurityConfig = {
      securityJsCode: state.amap2Key
    };

    amapLoadPromise = AMapLoader.load({
      key: state.amap1Key,
      version: '2.0',
      plugins: ['AMap.AutoComplete', 'AMap.PlaceSearch', 'AMap.Geocoder']
    }).then(AMap => {
      amapNamespace = AMap;
      return AMap;
    }).catch(e => {
      console.error("Failed to load AMap SDK:", e);
      showSnackbar(`高德地图加载失败: ${e?.message || e?.info || String(e)}`, "error");
      amapLoadPromise = null;
      return null;
    });

    return await amapLoadPromise;
  }

  async function ensureAMapAutoComplete() {
    if (amapAutoComplete) return amapAutoComplete;
    const AMap = await ensureAMapLoaded();
    if (!AMap) return null;
    amapAutoComplete = new AMap.AutoComplete({ city: '全国', datatype: 'all' });
    return amapAutoComplete;
  }

  function confirmRemoveFavorite(favorite) {
    state.favoriteToRemove = favorite;
    state.showRemoveFavoriteModal = true;
  }

  function confirmRenameFavorite(fav) {
    state.favoriteToRename = fav;
    state.newFavoriteName = fav.name;
    state.showRenameFavoriteModal = true;
  }

  async function setHome(favorite) {
    await setSpecial(favorite, "home", state, loadFavoritesAlphabetically);
  }

  async function setWork(favorite) {
    await setSpecial(favorite, "work", state, loadFavoritesAlphabetically);
  }

  async function initiateNavigation(destination, { resume = false } = {}) {
    state.selectedRoute = null;
    state.confirmedRoute = null;
    state.loadingRoute = true;
    try {
      const { name, longitude, latitude } = destination;
      const coords = [longitude, latitude]; // WGS84

      const inputEl = document.getElementById("search-field");
      if (inputEl && !resume) {
        inputEl.value = name;
      }

      if (destinationMarker) {
        map.remove(destinationMarker);
      }

      const gloc = wgs84ToGcj02(coords[0], coords[1]);
      destinationMarker = new AMap.Marker({ position: gloc });
      map.add(destinationMarker);

      const routes = await getRoutes(
        [state.lastPosition.longitude, state.lastPosition.latitude],
        [coords[0], coords[1]],
        state.amapRouteStrategy
      );

      removeRouteFromMap(map, drawnRoutes);

      if (routes.length > 0) {
        const selectedRouteId = "main";
        const selectedRouteData = routes[0];
        const routeHash = String(selectedRouteData.distance + selectedRouteData.time);
        const selected = {
          name,
          duration: parseInt(selectedRouteData.time),
          distance: parseInt(selectedRouteData.distance),
          destinationCoordinates: coords,
          startingCoordinates: [state.lastPosition.longitude, state.lastPosition.latitude],
          routeId: selectedRouteId,
          routeHash,
          steps: selectedRouteData.steps || []
        };

        state.selectedRoute = selected;
        if (resume) state.confirmedRoute = JSON.parse(JSON.stringify(selected));

        localStorage.setItem("lastRouteId", selected.routeId);

        drawnRoutes = routes;
        addRouteToMap(
          map,
          routes,
          [state.lastPosition.longitude, state.lastPosition.latitude],
          coords,
          (route, routeId) => {
            state.selectedRoute = {
              ...state.selectedRoute,
              duration: parseInt(route.time),
              distance: parseInt(route.distance),
              routeId,
              steps: route.steps || []
            };
            highlightRoute(map, routes, routeId);
          },
          state.isMetric,
          () => state.selectedRoute?.routeId ?? null
        );

        if (resume && map) {
          map.setZoomAndCenter(18, gloc);
        }
      }

      state.suggestions = "[]";
    } catch (err) {
      console.error("Failed to calculate route:", err);
      showSnackbar(`路径计算失败: ${err?.message || "未知错误"}`, "error");
    } finally {
      state.loadingRoute = false;
    }
  }



  async function getNavigationData() {
    const res = await fetch("/api/navigation");
    const data = await res.json();
state.amap1Key = data.amap1Key?.trim() || "";
    state.amap2Key = data.amap2Key?.trim() || "";
    state.amapWebKey = data.amapWebKey?.trim() || "";
    state.isMetric = data.isMetric ?? true;
    
    const paramsRes = await fetch("/api/params?keys=UseAMapRouting,AMapRouteStrategy");
    if (paramsRes.ok) {
      const p = await paramsRes.json();
      state.useAMapRouting = p.UseAMapRouting === "1";
      state.amapRouteStrategy = parseInt(p.AMapRouteStrategy) || 32;
    }

    const hasJsKeys = !!state.amap1Key && !!state.amap2Key;
    const hasWebKey = !!state.amapWebKey;
    state.missingKeys = !(hasJsKeys && hasWebKey);
    if (state.missingKeys) return;
    
    state.lastPosition = {
      latitude: parseFloat(data.lastPosition.latitude),
      longitude: parseFloat(data.lastPosition.longitude)
    };
    try {
      state.destination = JSON.parse(data.destination);
    } catch {}
    try {
      const prev = JSON.parse(data.previousDestinations);
      state.previousDestinations = prev.map(d => ({ name: d.place_name }));
      state.suggestions = JSON.stringify(state.previousDestinations);
    } catch {}
    setupMap();
    loadFavoritesAlphabetically();
  }

  async function handleFavoritesClick() {
    if (state.favoritesVisible) {
      state.suggestions = "[]";
      state.favoritesVisible = false;
      return;
    }
    searchFieldState.value = "";
    state.selectedRoute = null;
    state.confirmedRoute = null;
    state.noResults = false;
    state.searchLoading = false;
    const sorted = await loadFavoritesAlphabetically();
    state.suggestions = JSON.stringify(sorted);
    state.favoritesVisible = true;
  }

  async function handleSearchKey(e) {
    if (e.key === "Enter") {
      clearTimeout(window.searchTimeout);
      if (isComposing) return;
      const val = e.target.value.trim();
      searchFieldState.value = e.target.value;
      if (val.length < 1) {
        if (val.length === 0) { state.suggestions = "[]"; state.noResults = false; }
        return;
      }
      state.selectedRoute = null;
      state.confirmedRoute = null;
      state.suggestions = "[]";
      state.noResults = false;
      state.searchLoading = true;
      const currentRequestId = ++searchRequestId;
      try {
        const auto = await ensureAMapAutoComplete();
        if (!auto) { state.searchLoading = false; return; }
        auto.search(val, (status, result) => {
          if (currentRequestId !== searchRequestId) return;
          if (status === "complete" && result.tips?.length > 0) {
            state.suggestions = JSON.stringify(result.tips.filter(t => t.location || t.adcode));
          } else if (status === "error") {
            showSnackbar("搜索失败，请重试", "error");
          } else {
            state.noResults = true;
          }
          state.searchLoading = false;
        });
      } catch {
        if (currentRequestId === searchRequestId) {
          showSnackbar("搜索失败，请重试", "error");
          state.searchLoading = false;
        }
      }
    }
  }

  function isRouteFavorited(route, favorites) {
    return favorites.some(fav =>
      fav.latitude === route.destinationCoordinates[1] &&
      fav.longitude === route.destinationCoordinates[0]
    );
  }

  function addFavoriteMarkers(favorites) {
    favoriteMarkers.forEach(marker => map.remove(marker));
    favoriteMarkers = [];
    if (!map) return;
    favorites.forEach(fav => {
      let icon = "❤️";
      let popupText = fav.name;
      if (fav.is_home) {
        icon = "🏠";
        popupText = `家庭：${fav.name}`;
      } else if (fav.is_work) {
        icon = "💼";
        popupText = `工作：${fav.name}`;
      }
      
      const content = `<div class="favorite-marker" style="font-size: 24px; cursor: pointer;">${icon}</div>`;
      const gloc = wgs84ToGcj02(fav.longitude, fav.latitude);
      
      const marker = new AMap.Marker({
        position: gloc,
        content: content,
        title: popupText
      });

      marker.on("click", () => {
        initiateNavigation(fav);
      });
      
      map.add(marker);
      favoriteMarkers.push(marker);
    });
  }

  async function loadFavoritesAlphabetically() {
    try {
      const res = await fetch("/api/navigation/favorite");
      const json = await res.json();
      const sorted = json.favorites.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
      state.favoritesCount = sorted.length;
      state.favoriteRoutes = sorted;
      addFavoriteMarkers(sorted);
      if (state.favoritesVisible) {
        state.suggestions = JSON.stringify(sorted);
      }
      return sorted;
    } catch {
      showSnackbar("收藏夹加载失败...");
      return [];
    }
  }

  async function removeFavorite() {
    if (!state.favoriteToRemove) return;
    const { id, name, latitude, longitude, routeId } = state.favoriteToRemove;
    try {
      await fetch("/api/navigation/favorite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name, latitude, longitude, routeId })
      });
      await loadFavoritesAlphabetically();
      showSnackbar("已取消收藏！");
    } catch {
      showSnackbar("取消收藏失败...");
    } finally {
      state.showRemoveFavoriteModal = false;
      state.favoriteToRemove = null;
    }
  }

  async function renameFavorite() {
    const fav = state.favoriteToRename;
    const newName = state.newFavoriteName.trim();
    if (!fav || !newName || newName === fav.name) {
      state.showRenameFavoriteModal = false;
      return;
    }
    try {
      await fetch("/api/navigation/favorite", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fav)
      });

      await fetch("/api/navigation/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName,
          longitude: fav.longitude,
          latitude: fav.latitude,
          routeId: fav.routeId
        })
      });

      if (state.favoritesVisible) {
        state.suggestions = "[]";
        state.favoritesVisible = false;
      }

      handleFavoritesClick();

      showSnackbar(`已将“${fav.name}”重命名为“${newName}”！`, "success");
    } catch {
      showSnackbar("修改收藏名称失败...");
    } finally {
      state.showRenameFavoriteModal = false;
    }
  }

  async function searchInput(e) {
    const newVal = e.target.value.trim();
    searchFieldState.value = e.target.value;
    clearTimeout(window.searchTimeout);
    if (isComposing) return;
    window.searchTimeout = setTimeout(async () => {
      const val = newVal;
      if (val.length < 1) {
        if (val.length === 0) {
          state.suggestions = "[]";
          state.noResults = false;
        }
        return;
      }
      state.selectedRoute = null;
      state.confirmedRoute = null;
      state.suggestions = "[]";
      state.noResults = false;
      state.searchLoading = true;
      const currentRequestId = ++searchRequestId;
      try {
        const auto = await ensureAMapAutoComplete();
        if (!auto) { state.searchLoading = false; return; }
        auto.search(val, (status, result) => {
          if (currentRequestId !== searchRequestId) return;
          if (status === "complete" && result.tips?.length > 0) {
            state.suggestions = JSON.stringify(result.tips.filter(t => t.location || t.adcode));
          } else if (status === "error") {
            showSnackbar("搜索失败，请重试", "error");
          } else {
            state.noResults = true;
          }
          state.searchLoading = false;
        });
      } catch {
        if (currentRequestId === searchRequestId) {
          showSnackbar("搜索失败，请重试", "error");
          state.searchLoading = false;
        }
      }
    }, 400);
  }

  async function selectSuggestion(sugg) {
    const label = sugg.name || sugg.address || "未命名地点";
    let coords;
    if (sugg.routeId) {
      initiateNavigation({
        name: sugg.name,
        longitude: sugg.longitude,
        latitude: sugg.latitude,
        routeId: sugg.routeId
      });
      return;
    }
    state.loadingRoute = true;
    let coords = null;
    try {
      // Resolve coords through the REST forward-geocode endpoint as the primary path.
      // This ensures the destination is canonical AMap web-service POI data (not just
      // the JS AutoComplete tip cache) and surfaces backend errors uniformly.
      coords = await getCoordinatesFromSearch(label);
      if (coords) {
        coords = gcj02ToWgs84(coords[0], coords[1]);
      } else if (sugg.location && typeof sugg.location === 'object') {
        // Fallback: AutoComplete tip already carries a location (rare but possible).
        const lng = sugg.location.lng || sugg.location[0];
        const lat = sugg.location.lat || sugg.location[1];
        if (lng && lat) {
          coords = gcj02ToWgs84(parseFloat(lng), parseFloat(lat));
        }
      }

      if (coords) {
        initiateNavigation({
          name: label,
          longitude: coords[0],
          latitude: coords[1],
          routeId: null
        });
      } else {
        throw new Error("无法确定地点。");
      }
    } catch (err) {
      console.error(err);
      showSnackbar("错误：无法确定地点。", "error");
      state.loadingRoute = false;
    }
  }

  const setupMap = async () => {
    if (state.initialized) return;
    const container = document.getElementById("map");
    if (!container) {
      requestAnimationFrame(setupMap);
      return;
    }

    const AMap = await ensureAMapLoaded();
    if (!AMap) return;

    state.initialized = true;
    const gloc = wgs84ToGcj02(state.lastPosition.longitude, state.lastPosition.latitude);
    
    map = new AMap.Map("map", {
      center: gloc,
      zoom: 15,
      viewMode: "3D",
      pitch: 45,
      mapStyle: "amap://styles/normal"
    });

    const startMarker = new AMap.Marker({ position: gloc });
    map.add(startMarker);

    map.on("complete", () => {
      map.setZoomAndCenter(18, gloc);
      addFavoriteMarkers(state.favoriteRoutes || []);
      
      if (state.destination) {
        const savedId = localStorage.getItem("activeRouteId");
        initiateNavigation({ ...state.destination, routeId: savedId }, { resume: true });
      }
    });

    // Long press or click
    map.on("click", async (e) => {
      const lng = e.lnglat.getLng();
      const lat = e.lnglat.getLat();
      const wgs = gcj02ToWgs84(lng, lat);

      // fetch reverse geocode to get name
      try {
        const res = await fetch(`/api/geocode/reverse?lng=${wgs[0]}&lat=${wgs[1]}`);
        if (res.ok) {
          const data = await res.json();
          let name = "未知地点";
          if (data.regeocode && data.regeocode.formatted_address) {
            name = data.regeocode.formatted_address;
          }
          initiateNavigation({ name, longitude: wgs[0], latitude: wgs[1] });
        }
      } catch (err) {
        console.error(err);
        initiateNavigation({ name: "已选择位置", longitude: wgs[0], latitude: wgs[1] });
      }
    });
  };

  getNavigationData();

  return html`
    <div class="navigation-container">
      ${() => {
        if (state.missingKeys === null) return "";
        return state.missingKeys
          ? html`
              <section class="keys-required-wrapper">
                <div class="keys-required-widget">
                  <div class="keys-required-title">需要导航密钥</div>
                  <p class="keys-required-text">使用导航功能前，必须设置高德 API Key 和安全密钥。</p>
                  <a href="/manage_navigation_keys" class="keys-required-button">前往“密钥管理”</a>
                </div>
              </section>
            `
          : html`
              <div class="map-wrapper">
                <div class="search-wrapper">
                  <div class="search-controls">
                    <input autocomplete="off" id="search-field" class="${() => state.searchLoading ? 'searching' : ''}" placeholder="在此搜索" value="${() => searchFieldState.value}" @input="${searchInput}" @keydown="${handleSearchKey}" @compositionstart="${() => { isComposing = true; }}" @compositionend="${(e) => { isComposing = false; searchInput(e); }}" />
                    ${() => (state.favoritesCount > 0 ? html`<button class="favorites-toggle-button" @click="${handleFavoritesClick}">❤️ 收藏</button>` : "")}
                  </div>
                  <div id="infobox">
                    ${() => {
                      if (state.loadingRoute) {
                        return html`<div class="navigation-summary-widget loading-status"><span class="spinner"></span> 正在计算路线...</div>`;
                      } else if (state.selectedRoute) {
                        return NavigationDestination({
                          ...state.selectedRoute,
                          isFavorited: isRouteFavorited(state.selectedRoute, state.favoriteRoutes),
                          isConfirmed: () => areRoutesEqual(state.selectedRoute, state.confirmedRoute),
                          map,
                          isMetric: state.isMetric,
                          cancelNavigationFn: () => {
                            state.selectedRoute = null;
                            state.confirmedRoute = null;
                            state.suggestions = state.previousDestinations;
                            if (destinationMarker) map.remove(destinationMarker);
                            removeRouteFromMap(map, drawnRoutes);
                          },
                          onConfirm: () => {
                            state.confirmedRoute = JSON.parse(JSON.stringify(state.selectedRoute));
                            state.confirmedRouteRefresh = Math.random();
                          },
                          loadFavorites: loadFavoritesAlphabetically,
                          removeFavorite: confirmRemoveFavorite,
                          searchFieldState,
                          favoriteRoutes: state.favoriteRoutes
                        }, state.confirmedRouteRefresh);
                      } else if (state.searchLoading) {
                        return html`<div class="navigation-summary-widget search-loading"><span class="spinner"></span> 正在搜索...</div>`;
                      } else if (state.noResults) {
                        return html`<div class="navigation-summary-widget no-results-message">未找到相关地点</div>`;
                      } else if (JSON.parse(state.suggestions).length > 0) {
                        return SearchSuggestions({
                          suggestions: JSON.parse(state.suggestions),
                          selectSuggestion,
                          removeFavorite: confirmRemoveFavorite,
                          renameFavorite: confirmRenameFavorite,
                          setHome: setHome,
                          setWork: setWork
                        });
                      }
                    }}
                  </div>
                </div>
                <div id="map"></div>
              </div>
            `;
      }}
    </div>
    ${() => (state.showRemoveFavoriteModal ? Modal({
      title: "取消收藏",
      message: `确定要将 <strong>${state.favoriteToRemove?.name}</strong> 从收藏中移除吗？`,
      onConfirm: removeFavorite,
      onCancel: () => { state.showRemoveFavoriteModal = false; state.favoriteToRemove = null; },
      confirmText: "移除"
    }) : "")}
    ${() => (state.showRenameFavoriteModal ? Modal({
      title: "重命名收藏",
      message: html`
        <div>
          <p>将 <strong>${state.favoriteToRename.name}</strong> 重命名为：</p>
          <div style="margin-top: 10px;">
            <input class="modal-input" type="text" value="${state.newFavoriteName}" @click="${e => e.stopPropagation()}" @input="${e => state.newFavoriteName = e.target.value}" />
          </div>
        </div>
      `,
      onConfirm: renameFavorite,
      onCancel: () => { state.showRenameFavoriteModal = false; },
      confirmText: "重命名",
      confirmClass: "btn-primary"
    }) : "")}
  `;
}

function SearchSuggestions({ suggestions, selectSuggestion, removeFavorite, renameFavorite, setHome, setWork }) {
  const isFavorite = s => s.name && s.latitude != null && s.longitude != null && s.routeId;
  const item = s => html`
    <div class="suggestion-item" @click="${() => selectSuggestion(s)}">
      <p>
        ${s.is_home ? "🏠 " : ""}
        ${s.is_work ? "💼 " : ""}
        ${s.name || s.address}${s.district ? html`<span class="suggestion-district">· ${s.district}</span>` : ""}
      </p>
      ${isFavorite(s) ? html`
        <div class="favorite-actions">
          <button class="${`home-favorite-button ${s.is_home ? "active" : ""}`}" title="设为家庭" @click="${e => { e.stopPropagation(); setHome(s); }}">🏠</button>
          <button class="${`work-favorite-button ${s.is_work ? "active" : ""}`}" title="设为工作" @click="${e => { e.stopPropagation(); setWork(s); }}">💼</button>
          <button class="edit-favorite-button" title="重命名收藏" @click="${e => { e.stopPropagation(); renameFavorite(s); }}">✏️</button>
          <button class="remove-favorite-button" title="从收藏中移除" @click="${e => { e.stopPropagation(); removeFavorite(s); }}">🗑️</button>
        </div>
      ` : ""}
    </div>
  `;
  return html`<div id="searchSuggestions">${suggestions.map(item)}</div>`;
}

function NavigationDestination({
  name,
  duration,
  distance,
  routeId,
  routeHash,
  isConfirmed,
  destinationCoordinates,
  startingCoordinates,
  isMetric,
  map,
  cancelNavigationFn,
  onConfirm,
  loadFavorites,
  removeFavorite,
  searchFieldState,
  isFavorited,
  favoriteRoutes = [],
  steps = []
}) {
  async function cancelNavigation() {
    showSnackbar("导航已取消...");
    cancelNavigationFn();
    localStorage.removeItem("activeRouteId");

    const gloc = wgs84ToGcj02(startingCoordinates[0], startingCoordinates[1]);
    map.setZoomAndCenter(15, gloc);
    await fetch("/api/navigation", { method: "DELETE" });
  }


  async function confirmDestination() {
    onConfirm?.();
    showSnackbar("导航已设置！");
    localStorage.setItem("activeRouteId", routeId);
    await fetch("/api/navigation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        longitude: destinationCoordinates[0],
        latitude: destinationCoordinates[1]
      })
    });
    await loadFavorites();
    const searchInputEl = document.getElementById("search-field");
    if (searchInputEl) searchInputEl.value = "";
    searchFieldState.value = "";
    requestAnimationFrame(() => {
      const gloc = wgs84ToGcj02(startingCoordinates[0], startingCoordinates[1]);
      map?.setZoomAndCenter(18, gloc);
    });
  }
  async function favoriteDestination() {
    try {
      const res = await fetch("/api/navigation/favorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          longitude: destinationCoordinates[0],
          latitude: destinationCoordinates[1],
          routeId
        })
      });
      const { message } = await res.json();
      showSnackbar(message || "已加入收藏！");
      await loadFavorites();
    } catch {
      showSnackbar("添加收藏失败...");
    }
  }
  async function toggleFavorite() {
    if (isFavorited) {
      const fav = favoriteRoutes.find(
        f => f.latitude === destinationCoordinates[1] && f.longitude === destinationCoordinates[0]
      );
      if (fav) {
        removeFavorite(fav);
      } else {
        showSnackbar("未找到对应收藏项...");
      }
    } else {
      await favoriteDestination();
    }
  }
  const eta = new Date(Date.now() + duration * 1000);
  const isLong = duration > 86400;
  const timeStr = eta.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const month = eta.toLocaleString([], { month: "long" });
  const day = eta.getDate();
  const year = eta.getFullYear();
  const etaString = isLong ? `${year}年${month + 1}月${day}日 ${timeStr}` : timeStr;
  return html`
    <div class="navigation-summary-widget">
      <div class="navigation-summary-title">${name}</div>
      <div class="summary-row">
        <span class="emoji">🛣️</span>
        <span class="label">距离：</span>
        <span class="value">${formatMetersToHuman(distance, isMetric)}</span>
      </div>
      <div class="summary-row">
        <span class="emoji">⌛</span>
        <span class="label">时长：</span>
        <span class="value">${formatSecondsToHuman(duration)}</span>
      </div>
      <div class="summary-row">
        <span class="emoji">🕗</span>
        <span class="label">预计到达：</span>
        <span class="value">${etaString}</span>
      </div>
      <div class="buttonCluster">
        ${() =>
          isConfirmed()
            ? html`<button class="cancel" @click="${cancelNavigation}"><i class="bi bi-x-lg"></i> 取消导航</button>`
            : html`<button class="directions" @click="${confirmDestination}"><i class="bi bi-sign-turn-right"></i> 开始导航</button>`}
        <button class="favorite" @click="${toggleFavorite}">${isFavorited ? "💔 取消收藏" : "❤️ 收藏"}</button>
      </div>
    </div>
  `;
}
