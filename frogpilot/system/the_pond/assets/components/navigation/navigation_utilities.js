export function highlightRoute(map, routes, selectedRouteId) {
  if (!map || !routes) return;
  routes.forEach((routeObj) => {
    if (routeObj.polyline) {
      const isSelected = routeObj.id === selectedRouteId;
      routeObj.polyline.setOptions({
        strokeWeight: isSelected ? 8 : 4,
        strokeOpacity: isSelected ? 1.0 : 0.5,
        zIndex: isSelected ? 50 : 10
      });
    }
  });
}

function safeGetId(fn) {
  try { return fn?.() ?? null } catch { return null }
}

export function addRouteToMap(map, routes, start, dest, onRouteSelect, useMetric = true, getSelectedRouteId) {
  // routes here are objects from our AMap api format
  routes.forEach((route, idx) => {
    const routeId = idx === 0 ? 'main' : `alt-${idx}`;
    route.id = routeId;
    
    // Parse polyline string "lng,lat;lng,lat"
    const pathStr = route.polyline || "";
    const path = pathStr.split(";").filter(x => x).map(pt => {
      const parts = pt.split(",");
      return [parseFloat(parts[0]), parseFloat(parts[1])];
    });

    const duration = parseInt(route.time) || 0;
    const distance = parseInt(route.distance) || 0;

    const polyline = new AMap.Polyline({
      path: path,
      strokeColor: "#3b82f6",
      strokeWeight: idx === 0 ? 8 : 4,
      strokeOpacity: idx === 0 ? 1.0 : 0.5,
      zIndex: idx === 0 ? 50 : 10,
      showDir: true,
      cursor: "pointer"
    });

    route.polyline = polyline;
    map.add(polyline);

    let infoWindow = null;

    const showTooltip = (e) => {
      const durStr = useMetric ? formatSecondsToHuman(duration) : formatSecondsToAmerican(duration);
      const distStr = useMetric ? formatMetersToHuman(distance, true) : formatMetersToMiles(distance);
      const arrival = new Date(Date.now() + duration * 1000);
      const isLong = duration > 24 * 3600;
      const timeStr = arrival.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
      const eta = isLong ? `${arrival.getFullYear()}年${arrival.getMonth() + 1}月${arrival.getDate()}日 ${timeStr}` : timeStr;

      const tooltip = document.createElement('div');
      tooltip.className = 'custom-tooltip amap-info-content';
      tooltip.style.whiteSpace = 'nowrap';
      tooltip.style.padding = "10px";
      tooltip.style.background = "var(--bg-secondary)";
      tooltip.style.color = "var(--text-primary)";
      tooltip.style.borderRadius = "8px";
      tooltip.style.border = "1px solid var(--border-color)";
      
      tooltip.innerHTML = `
        <div class="tooltip-row" style="margin-bottom: 4px;"><span class="emoji">🛣️</span><span class="label"> 距离：</span><span class="value">${distStr}</span></div>
        <div class="tooltip-row" style="margin-bottom: 4px;"><span class="emoji">⌛</span><span class="label"> 时长：</span><span class="value">${durStr}</span></div>
        <div class="tooltip-row"><span class="emoji">🕗</span><span class="label"> 预计到达：</span><span class="value">${eta}</span></div>
      `;

      infoWindow = new AMap.InfoWindow({
        content: tooltip,
        offset: new AMap.Pixel(0, -10),
        closeWhenClickMap: true
      });
      infoWindow.open(map, e.lnglat);
    };

    polyline.on("click", (e) => {
      onRouteSelect(route, routeId);
      showTooltip(e);
    });

    polyline.on("mouseover", showTooltip);
    polyline.on("mouseout", () => {
      const id = safeGetId(getSelectedRouteId);
      highlightRoute(map, routes, id);
      if (infoWindow) {
        infoWindow.close();
      }
    });
  });

  const allPaths = routes.filter(r => r.polyline).map(r => r.polyline);
  if (allPaths.length > 0) {
    map.setFitView(allPaths, false, [50, 50, 50, 50]);
  }
}

export async function getCoordinatesFromSearch(searchValue) {
  const response = await fetch(`/api/geocode/forward?q=${encodeURIComponent(searchValue)}`);
  const data = await response.json();
  if (data.pois && data.pois.length > 0) {
    const loc = data.pois[0].location;
    if (loc) {
      const pts = loc.split(",");
      return [parseFloat(pts[0]), parseFloat(pts[1])];
    }
  }
  return null;
}

export async function getRoutes(from, to, strategy = "32") {
  const url = `/api/route?origin=${from[0]},${from[1]}&destination=${to[0]},${to[1]}&strategy=${strategy}`;
  const response = await fetch(url);
  const data = await response.json();
  if (data.route && data.route.paths) {
    return data.route.paths;
  }
  return [];
}

export function removeRouteFromMap(map, routes) {
  if (!map) return;
  if (routes && Array.isArray(routes)) {
    routes.forEach(r => {
      if (r.polyline) {
        map.remove(r.polyline);
      }
    });
  }
  map.clearInfoWindow();
}

export function formatSecondsToHuman(s) {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
}

export function formatMetersToHuman(m, metric = true) {
  return metric ? (m >= 1000 ? `${(m / 1000).toFixed(1)} 公里` : `${Math.round(m)} 米`) : (m * 3.28084 >= 5280 ? `${((m * 3.28084) / 5280).toFixed(1)} 英里` : `${Math.round(m * 3.28084)} 英尺`);
}

export function formatSecondsToAmerican(s) {
  const mins = Math.round(s / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}小时${m}分钟` : `${m}分钟`;
}

export function formatMetersToMiles(m) {
  const miles = m / 1609.34;
  return miles >= 0.1 ? `${miles.toFixed(1)} 英里` : `${(miles * 5280).toFixed(0)} 英尺`;
}

export function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * Math.PI) + 40.0 * Math.sin(y / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * Math.PI) + 320 * Math.sin(y * Math.PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * Math.PI) + 20.0 * Math.sin(2.0 * x * Math.PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * Math.PI) + 40.0 * Math.sin(x / 3.0 * Math.PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * Math.PI) + 300.0 * Math.sin(x / 30.0 * Math.PI)) * 2.0 / 3.0;
  return ret;
}

function outOfChina(lng, lat) {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

export function gcj02ToWgs84(lng, lat) {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dlat = transformLat(lng - 105.0, lat - 35.0);
  let dlng = transformLng(lng - 105.0, lat - 35.0);
  const radlat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radlat);
  magic = 1 - ee * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI);
  dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * Math.PI);
  const mglat = lat + dlat;
  const mglng = lng + dlng;
  return [lng * 2 - mglng, lat * 2 - mglat];
}

export function wgs84ToGcj02(lng, lat) {
  if (outOfChina(lng, lat)) {
    return [lng, lat];
  }
  const a = 6378245.0;
  const ee = 0.00669342162296594323;
  let dlat = transformLat(lng - 105.0, lat - 35.0);
  let dlng = transformLng(lng - 105.0, lat - 35.0);
  const radlat = lat / 180.0 * Math.PI;
  let magic = Math.sin(radlat);
  magic = 1 - ee * magic * magic;
  const sqrtmagic = Math.sqrt(magic);
  dlat = (dlat * 180.0) / ((a * (1 - ee)) / (magic * sqrtmagic) * Math.PI);
  dlng = (dlng * 180.0) / (a / sqrtmagic * Math.cos(radlat) * Math.PI);
  return [lng + dlng, lat + dlat];
}
