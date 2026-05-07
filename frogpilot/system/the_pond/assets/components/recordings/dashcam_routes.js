import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { Modal } from "/assets/components/modal.js";

const state = reactive({
  loading: true,
  error: null,
  routes: [],
  selectedRoute: null,
  showPreservedOnly: false,
  progress: 0,
  total: 0,
  showDeleteAllModal: false,
  isDeletingAll: false,
})

function pad2(n) {
  return n < 10 ? "0" + n : String(n)
  }

  function formatRouteDate(dateString) {
  const date = new Date(dateString)
  if (isNaN(date.getTime())) {
    return dateString
  }
  const month = date.getMonth() + 1
  const day = date.getDate()
  const year = date.getFullYear()
  const hour = date.getHours()
  const minute = date.getMinutes()
  return `${year}年${month}月${day}日 ${pad2(hour)}:${pad2(minute)}`
}

async function fetchRoutes() {
  try {
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch(`/api/routes?timezone=${encodeURIComponent(userTimezone)}`);
    if (!response.ok) throw new Error();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.substring(6));
            if (data.progress !== undefined && data.total !== undefined) {
              state.progress = data.progress;
              state.total = data.total;
            }
            if (data.routes) {
              const routes = data.routes.map(route => ({
                ...route,
                timestamp: formatRouteDate(route.timestamp),
              }));
              state.routes.push(...routes);
            }
          } catch (e) {
            console.error("Failed to parse JSON:", e);
          }
        }
      }
    }
  } catch (_) {
    state.error = "路线加载失败，请稍后重试..."
  } finally {
    state.loading = false
  }
}

fetchRoutes()

function refresh() {
  state.loading = true
  state.routes = []
  fetchRoutes()
}

let overlay = null

function openDialog(htmlStr) {
  const o = document.createElement("div")
  o.className = "dialog-overlay"
  o.innerHTML = htmlStr
  document.body.appendChild(o)
  return o
}

function closeDialog(o) {
  if (o) o.remove()
}

async function deleteRoute(route) {
  const dlg = openDialog(`
    <div class="dialog-box">
      <p>删除 “${route.timestamp}”？</p>
      <div class="dialog-buttons">
        <button class="btn btn-cancel" ...>取消</button>
        <button class="btn btn-danger btn-del" ...>删除</button>
      </div>
    </div>`)
  dlg.querySelector(".btn-cancel").onclick = () => closeDialog(dlg)
  dlg.querySelector(".btn-del").onclick = async () => {
    const res = await fetch(`/api/routes/${route.name}`, { method: "DELETE" })
    if (res.ok) {
      state.routes = state.routes.filter(r => r.name !== route.name)
      closeDialog(dlg)
      closeOverlay()
      refresh()
      showSnackbar("路线已删除！")
    } else {
      showSnackbar("删除失败...", "error")
    }
  }
}

async function resetRouteName(route, dlg) {
    const res = await fetch(`/api/routes/reset_name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: route.name })
    });
    if (res.ok) {
      const { timestamp } = await res.json();
      closeDialog(dlg);
      const routeInList = state.routes.find(r => r.name === route.name);
      if (routeInList) {
        routeInList.timestamp = formatRouteDate(timestamp);
      }
      route.timestamp = formatRouteDate(timestamp);
      const overlayTitleSpan = overlay.querySelector(".media-player-title span");
      if (overlayTitleSpan) {
        overlayTitleSpan.textContent = formatRouteDate(timestamp);
      }
      showSnackbar("路线名称已重置！");
    } else {
      showSnackbar("重置名称失败...", "error");
    }
}

async function renameRoute(route) {
  const dlg = openDialog(`
    <div class="dialog-box">
      <p>重命名 "${route.timestamp}"</p>
      <input class="rn-input" value="${route.timestamp}" />
      <div class="dialog-buttons">
        <button class="btn-cancel">取消</button>
        <button class="btn-reset">重置</button>
        <button class="btn-save">保存</button>
      </div>
    </div>`);
  dlg.querySelector(".btn-cancel").onclick = () => closeDialog(dlg);
  dlg.querySelector(".btn-reset").onclick = () => resetRouteName(route, dlg);
  dlg.querySelector(".btn-save").onclick = async () => {
    const newName = dlg.querySelector(".rn-input").value.trim();
    if (!newName) return;
    const res = await fetch(`/api/routes/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ old: route.name, new: newName })
    });
    if (res.ok) {
      closeDialog(dlg);
      const routeInList = state.routes.find(r => r.name === route.name);
      if (routeInList) {
        routeInList.timestamp = newName;
      }
      route.timestamp = newName;
      const overlayTitleSpan = overlay.querySelector(".media-player-title span");
      if (overlayTitleSpan) {
        overlayTitleSpan.textContent = newName;
      }
      showSnackbar("路线已重命名！");
    } else {
      showSnackbar("重命名失败...", "error");
    }
  };
}

async function openOverlay(route) {
  if (overlay) return;

  overlay = document.createElement("div");
  overlay.className = "media-player-overlay";
  overlay.innerHTML = `
    <div class="media-player-content">
      <div class="media-player-title">
        <span>${route.timestamp}</span>
        <i class="bi bi-pencil-fill action-rename-icon"></i>
      </div>
      <video controls autoplay muted>
        <source src="/thumbnails/${route.name}--0/preview.png" type="video/mp4">
      </video>
      <div class="button-row">
        <button class="close-button action-close">关闭</button>
        <button class="close-button camera-button active" data-camera="forward">前视</button>
        <button class="close-button camera-button" data-camera="wide">广角</button>
        <button class="close-button camera-button" data-camera="driver">驾驶员</button>
        <button class="close-button action-download">下载</button>
        <button class="close-button action-delete">删除</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.addEventListener("click", e => {
    if (e.target === overlay) closeOverlay();
  });
  overlay.querySelector(".action-rename-icon").onclick = () => renameRoute(route);
  overlay.querySelector(".action-close").onclick = closeOverlay;
  overlay.querySelector(".action-delete").onclick = () => deleteRoute(route);

  const vid = overlay.querySelector("video");
  const downloadButton = overlay.querySelector(".action-download");

  let segments;
  let current = 0;
  let selectedCamera = "forward";

  downloadButton.onclick = () => {
    const link = document.createElement("a");
    const videoPath = `/video/${route.name}/combined?camera=${selectedCamera}`;
    link.href = videoPath;
    link.download = `${route.timestamp}-${selectedCamera}.mp4`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  (async () => {
    try {
      const response = await fetch(`/api/routes/${route.name}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      segments = data.segment_urls;

      if (!segments || segments.length === 0) {
        segments = [`/video/${route.name}--0`];
      }
      vid.src = `${segments[0]}?camera=forward`;
      vid.load();
      vid.play();
    } catch (error) {
      showSnackbar("错误：无法加载合并路线视频。", "error");
    }
  })();

  vid.addEventListener("ended", () => {
    current++;
    if (current < segments.length) {
      const videoPath = segments[current].includes("?") ? `${segments[current]}&camera=${selectedCamera}` : `${segments[current]}?camera=${selectedCamera}`
      vid.src = videoPath;
      vid.load();
      vid.play();
    }
  });

  overlay.querySelectorAll(".camera-button").forEach(button => {
    button.addEventListener("click", e => {
      overlay.querySelectorAll(".camera-button").forEach(btn => btn.classList.remove("active"));
      e.target.classList.add("active");
      selectedCamera = e.target.dataset.camera;
      vid.src = segments[current].includes("?") ? `${segments[current]}&camera=${selectedCamera}` : `${segments[current]}?camera=${selectedCamera}`;
      vid.load();
      vid.play();
    });
  });
}

function closeOverlay() {
  if (!overlay) return
  overlay.remove()
  overlay = null
  state.selectedRoute = null
}

async function togglePreserved(route, e) {
  e.stopPropagation()
  const newPreservedState = !route.is_preserved
  const method = newPreservedState ? "POST" : "DELETE"
  try {
    const response = await fetch(`/api/routes/${route.name}/preserve`, { method })
    if (response.ok) {
      route.is_preserved = newPreservedState
    } else {
      const errorData = await response.json()
      showSnackbar(errorData.error || "更新保留状态失败...", "error")
    }
  } catch (_) {
    showSnackbar("发生错误...", "error")
  }
}

async function deleteAllRoutes() {
  state.showDeleteAllModal = false
  state.isDeletingAll = true
  try {
    const res = await fetch("/api/routes/delete_all", { method: "DELETE" })
    if (!res.ok) throw new Error()
    await refresh()
    showSnackbar("已删除全部路线！")
  } catch {
    showSnackbar("删除全部路线时发生错误...", "error")
  } finally {
    state.isDeletingAll = false
  }
}

export function RouteRecordings() {
  if (state.selectedRoute && !overlay) openOverlay(state.selectedRoute);

  return html`
    <div class="screen-recordings-wrapper">
      <div class="screen-recordings-widget">
        <div class="screen-recordings-title">行车录像路线</div>
        <button
          class="show-preserved-button"
          @click="${() => (state.showPreservedOnly = !state.showPreservedOnly)}"
          ?disabled="${state.loading && state.routes.length === 0}"
        >
          ${() => (state.showPreservedOnly ? "显示全部" : "仅显示已保留路线")}
        </button>

        ${() => {
          const routesToShow = state.routes.filter(r => !state.showPreservedOnly || r.is_preserved);

          if (routesToShow.length === 0) {
            if (state.loading && state.total > 0) {
              return html`<p class="screen-recordings-message">正在处理路线：${state.progress} / ${state.total}</p>`;
            }
            if (state.loading && !state.isDeletingAll) {
              return html`<p class="screen-recordings-message">加载中...</p>`;
            }
            if (state.isDeletingAll) {
              return html`<p class="screen-recordings-message">正在删除路线...</p>`;
            }
            if (state.showPreservedOnly) {
              return html`<p class="screen-recordings-message">暂无已保留路线...</p>`;
            }
            if (state.error) {
              return html`<p class="screen-recordings-message">${state.error}</p>`;
            }
            return html`<p class="screen-recordings-message">未找到路线...</p>`;
          }

          return html`
            <div class="screen-recordings-grid">
              ${routesToShow.map(
                route => html`
                  <div
                    class="recording-card"
                    @mouseenter="${e => {
                      if (state.selectedRoute) return;

                      const card = e.currentTarget;
                      const gif = card.querySelector(".recording-preview-gif");
                      const png = card.querySelector(".recording-preview-png");

                      if (card.dataset.gifLoaded) {
                        png.style.display = "none";
                        gif.style.display = "block";
                        return;
                      }

                      card.dataset.loadingGif = "true";
                      const preloader = new Image();
                      preloader.onload = () => {
                        if (card.dataset.loadingGif === "true") {
                          gif.src = preloader.src;
                          png.style.display = "none";
                          gif.style.display = "block";
                          card.dataset.gifLoaded = true;
                        }
                        delete card.dataset.loadingGif;
                      };
                      preloader.onerror = () => {
                        console.error("Failed to load preview GIF:", preloader.src);
                        delete card.dataset.loadingGif;
                      };

                      preloader.src = gif.dataset.src;
                    }}"
                    @mouseleave="${e => {
                      const card = e.currentTarget;
                      card.querySelector(".recording-preview-png").style.display = "block";
                      card.querySelector(".recording-preview-gif").style.display = "none";
                      if (card.dataset.loadingGif === "true") {
                        delete card.dataset.loadingGif;
                      }
                    }}"
                    @click="${() => {
                      state.selectedRoute = route;
                    }}"
                  >
                    <div class="preserved-icon" @click="${e => togglePreserved(route, e)}">
                      ${() => html`<i class="bi ${route.is_preserved ? "bi-heart-fill" : "bi-heart"}"></i>`}
                    </div>
                    <div class="recording-preview-container">
                      <img
                        src="${route.png}"
                        class="recording-preview recording-preview-png"
                        style="display:block;"
                      >
                      <img
                        data-src="${route.gif}"
                        class="recording-preview recording-preview-gif"
                        style="display:none;"
                      >
                    </div>
                    <p class="recording-filename">${route.timestamp}</p>
                  </div>
                `
              )}
            </div>
          `;
        }}
        ${() => {
          if (state.routes.length > 0) {
            return html`
              <button
                class="delete-all-button"
                @click="${() => (state.showDeleteAllModal = true)}"
                ?disabled="${state.isDeletingAll}"
              >
                ${() => (state.isDeletingAll ? "删除中..." : "删除全部路线")}
              </button>
            `;
          }
          return "";
        }}
      </div>
      ${() => state.showDeleteAllModal ? Modal({
          title: "确认全部删除",
          message: "确定要删除全部路线吗？此操作无法撤销...",
          onConfirm: deleteAllRoutes,
          onCancel: () => { state.showDeleteAllModal = false; },
          confirmText: "全部删除"
      }) : ""}
    </div>
  `;
}
