import { html, reactive } from "https://esm.sh/@arrow-js/core"
import { formatSecondsToHuman } from "/assets/js/utils.js"
import { Modal } from "/assets/components/modal.js";

const logSelectorState = reactive({
  loading: false,
  files: [],
  logsLoadedOnce: false,
  showDeleteAllModal: false,
  logToDelete: null,
  logToRename: null,
  newName: ""
});

async function loadTmuxLogs() {
  if (logSelectorState.loading || logSelectorState.logsLoadedOnce) return;

  logSelectorState.loading = true;
  try {
    const res = await fetch("/api/tmux_log/list");
    if (!res.ok) throw new Error(await res.text());

    const data = await res.json();
    logSelectorState.files = data.map(f => {
      const date = new Date(f.timestamp * 1000);
      return {
        filename: f.filename,
        date: date.toLocaleString(),
        timeSince: (Date.now() - date.getTime()) / 1000,
      };
    });
  } catch (err) {
    showSnackbar(`获取日志失败：${err.message}`, "error");
    logSelectorState.files = [];
  } finally {
    logSelectorState.loading = false;
    logSelectorState.logsLoadedOnce = true;
  }
}

function TmuxLogSelector({ action, closeFn }) {
  loadTmuxLogs();

  async function handleFileClick(file) {
    if (action === "download") {
      const link = document.createElement("a");
      link.href = `/api/tmux_log/download/${encodeURIComponent(file.filename)}`;
      link.download = file.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } else if (action === "rename") {
      logSelectorState.logToRename = file;
      logSelectorState.newName = file.filename;

    } else if (action === "delete") {
      logSelectorState.logToDelete = file;
    }
  }

  async function confirmDeleteFile() {
    const file = logSelectorState.logToDelete;
    if (!file) return;

    try {
      const res = await fetch(`/api/tmux_log/delete/${encodeURIComponent(file.filename)}`, {
        method: "DELETE"
      });
      if (!res.ok) throw new Error(await res.text());

      showSnackbar(`${file.filename} 删除成功！`, "success");
      logSelectorState.files = logSelectorState.files.filter(f => f.filename !== file.filename);
      if (logSelectorState.files.length === 0) {
        logSelectorState.logsLoadedOnce = false;
      }
    } catch (err) {
      showSnackbar(`删除失败：${err.message}`, "error");
    } finally {
      logSelectorState.logToDelete = null;
    }
  }

  async function confirmRenameFile() {
    const file = logSelectorState.logToRename;
    let newName = logSelectorState.newName.trim();
    if (!newName.endsWith(".json")) {
      newName += ".json";
    }

    if (!file || !newName || newName === file.filename) {
      logSelectorState.logToRename = null;
      logSelectorState.newName = "";
      return;
    }

    try {
      const res = await fetch(`/api/tmux_log/rename/${encodeURIComponent(file.filename)}/${encodeURIComponent(newName)}`, {
        method: "PUT"
      });
      if (!res.ok) throw new Error(await res.text());

      showSnackbar(`${file.filename} 已重命名为 ${newName}！`, "success");
      logSelectorState.files = logSelectorState.files.map(f =>
        f.filename === file.filename ? { ...f, filename: newName } : f
      );
    } catch (err) {
      showSnackbar(`重命名失败：${err.message}`, "error");
    } finally {
      logSelectorState.logToRename = null;
      logSelectorState.newName = "";
    }
  }

  return html`
    <div class="tmux-log-selector-wrapper" @click="${(e) => e.target === e.currentTarget && closeFn()}">
      <div id="fileList">
        <div class="fileEntry header">
          <p>文件名</p>
          <p>日期</p>
          <p>时间</p>
        </div>

        ${() => {
          if (logSelectorState.loading && !logSelectorState.logsLoadedOnce) {
            return html`<div class="fileEntry"><p>加载中...</p></div>`;
          }
          if (logSelectorState.files.length === 0) {
            return html`<div class="fileEntry"><p>未找到 tmux 日志！</p></div>`;
          }
          return logSelectorState.files.map(file => html`
            <div class="fileEntry" @click="${() => handleFileClick(file)}">
              <p><span class="label">文件名：</span> <span class="value">${file.filename}</span></p>
              <p><span class="label">日期：</span> <span class="value">${file.date}</span></p>
              <p><span class="label">时间：</span> <span class="value">${file.timeSince < 60 ? "刚刚" : `${formatSecondsToHuman(file.timeSince, "minutes")}前`}</span></p>
            </div>
          `);
        }}

        <button @click="${closeFn}" class="cancel-button">关闭</button>

        ${() => logSelectorState.logToDelete ? Modal({
          title: "确认删除",
          message: `确定要删除 <strong>${logSelectorState.logToDelete.filename}</strong> 吗？`,
          onConfirm: confirmDeleteFile,
          onCancel: () => { logSelectorState.logToDelete = null },
          confirmText: "确认删除"
        }) : ""}

        ${() => logSelectorState.logToRename ? Modal({
          title: "重命名日志",
          message: html`
            <div>
              <p>将 <strong>${logSelectorState.logToRename.filename}</strong> 重命名为：</p>
              <div style="margin-top: 10px;">
                <input
                  class="modal-input"
                  type="text"
                  value="${logSelectorState.newName}"
                  @click="${e => e.stopPropagation()}"
                  @input="${(e) => logSelectorState.newName = e.target.value}"
                />
              </div>
            </div>
          `,
          onConfirm: confirmRenameFile,
          onCancel: () => {
            logSelectorState.logToRename = null;
            logSelectorState.newName = "";
          },
          confirmText: "重命名",
          confirmClass: "btn-primary"
        }) : ""}
      </div>
    </div>
  `
}

export function TmuxLog() {
  const state = reactive({
    paused: false,
    latest: '',
    log: '',
    selectorAction: null,
  });

  const event_source = new EventSource("/api/tmux_log/live");

  event_source.onmessage = e => {
    state.latest = e.data;
    if (!state.paused) {
      state.log = state.latest;
    }
  }

  event_source.onerror = err => {
    console.error("Error receiving tmux log:", err);
    event_source.close();
  }

  function togglePause () {
    state.paused = !state.paused;
    if (!state.paused) {
      state.log = state.latest;
    }
  }

  function captureLog() {
    fetch("/api/tmux_log/capture", { method: "POST" })
      .then(res => {
        if (!res.ok) return res.text().then(msg => { throw new Error(msg); });
        showSnackbar("当前会话已保存！", "success");
        logSelectorState.files = [];
        logSelectorState.logsLoadedOnce = false;
      })
      .catch(err => {
        showSnackbar(`保存失败：${err.message}`, "error");
      });
  }

  function downloadSessions() {
    state.selectorAction = "download";
  }

  function deleteSession() {
    state.selectorAction = "delete";
  }

  function confirmDeleteAllSessions() {
    logSelectorState.showDeleteAllModal = true;
  }

  function deleteAllSessions() {
    logSelectorState.showDeleteAllModal = false;
    fetch("/api/tmux_log/delete_all", { method: "DELETE" })
      .then(res => {
        if (!res.ok) return res.text().then(msg => { throw new Error(msg); });
        showSnackbar("全部日志已删除！", "success");
        logSelectorState.files = [];
        logSelectorState.logsLoadedOnce = false;
      })
      .catch(err => {
        showSnackbar(`全部删除失败：${err.message}`, "error");
      });
  }

  return html`
    <div class="tmux-block">
      <div class="tmux-wrapper">
        <div class="tmuxContainer">
          <div class="tmuxHeader">Tmux 实时日志</div>
          <pre class="tmuxLog">${() => state.log}</pre>
        </div>
      </div>

      <div class="tmux-controls">
        <button class="tmux-control-button" @click="${captureLog}">💾 保存日志</button>
        <button class="tmux-control-button" @click="${deleteSession}">🗑️ 删除日志</button>
        <button class="tmux-control-button" @click="${confirmDeleteAllSessions}">🧨 删除全部日志</button>
        <button class="tmux-control-button" @click="${downloadSessions}">⬇️ 下载日志</button>
        <button class="tmux-control-button" @click="${togglePause}">${() => state.paused ? "▶️ 恢复日志" : "⏸️ 暂停日志"}</button>
        <button class="tmux-control-button" @click="${() => state.selectorAction = 'rename'}">✏️ 重命名日志</button>
      </div>

      ${() => state.selectorAction
        ? TmuxLogSelector({
            action: state.selectorAction,
            closeFn: () => (state.selectorAction = null)
          })
        : ""
      }

      ${() => logSelectorState.showDeleteAllModal ? Modal({
        title: "删除全部日志",
        message: "确定要删除所有会话日志吗？",
        onConfirm: deleteAllSessions,
        onCancel: () => { logSelectorState.showDeleteAllModal = false },
        confirmText: "全部删除"
      }) : ""}
    </div>
  `;
}
