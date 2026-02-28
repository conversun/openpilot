import { html, reactive } from "https://esm.sh/@arrow-js/core";
import { Modal } from "/assets/components/modal.js";

const defaultColors = {
  LaneLines: { red: 23, green: 134, blue: 68, alpha: 255 },
  LeadMarker: { red: 23, green: 134, blue: 68, alpha: 255 },
  Path: { red: 23, green: 134, blue: 68, alpha: 255 },
  PathEdge: { red: 18, green: 107, blue: 54, alpha: 255 },
  Sidebar1: { red: 23, green: 134, blue: 68, alpha: 255 },
  Sidebar2: { red: 23, green: 134, blue: 68, alpha: 255 },
  Sidebar3: { red: 23, green: 134, blue: 68, alpha: 255 },
};

const COLOR_LABELS = {
  LaneLines: "车道线",
  LeadMarker: "前车标记",
  Path: "路径",
  PathEdge: "路径边缘",
  Sidebar1: "侧栏上部",
  Sidebar2: "侧栏中部",
  Sidebar3: "侧栏下部",
};

const ICON_LABELS = {
  homeButton: "主页按钮",
  settingsButton: "设置按钮",
};

const SOUND_DEFINITIONS = [
  { key: "disengage", label: "退出提示音" },
  { key: "engage", label: "接管提示音" },
  { key: "prompt", label: "提醒提示音" },
  { key: "startup", label: "启动提示音" },
];

const fileStore = {
  images: { distanceIcons: {} },
  sounds: {},
  sequentialFiles: [],
};

const state = reactive({
  themeName: "",
  discordUsername: "",
  downloadable: {
    colors: [],
    distance_icons: [],
    icons: [],
    signals: [],
    sounds: [],
    wheels: []
  },
  turnSignalStyle: "Static",
  turnSignalLength: 100,
  turnSignalType: "Single Image",
  sequentialImages: [],
  selectorAction: null,
  isApplying: false,
  isSaving: false,
  isSubmitting: false,
  isLoadingAsset: false,
  themeSubmitted: false,
  colors: { ...defaultColors },
  imageFileNames: {
    homeButton: "",
    settingsButton: "",
    steeringWheel: "",
    turnSignal: "",
    turnSignalBlindspot: "",
    distanceIcons: {
      traffic: "",
      aggressive: "",
      standard: "",
      relaxed: "",
    },
  },
  soundFileNames: {
    startup: "",
    prompt: "",
    engage: "",
    disengage: "",
  },
  saveChecklist: {
    colors: false,
    distance_icons: false,
    icons: false,
    sounds: false,
    turn_signals: false,
    steering_wheel: false,
  },
  showTurnSignalHelp: false,
  showSubmitConfirmation: false,
  showSaveConfirmModal: false,
  showApplyConfirmModal: false,
  showManageThemesModal: false,
  showSequenceOrderModal: false,
  showDeleteConfirmModal: false,
  themeToDelete: null,
  themes: [],
  activeTab: "colors"
});

let draggedIndex = -1;
let dropIndex = -1;

function handleDragStart(e, index) {
  draggedIndex = index;
  e.dataTransfer.effectAllowed = "move";
  e.dataTransfer.setData("text/plain", String(index));
  e.target.style.opacity = "0.5";
}

function handleDragOver(e, index) {
  e.preventDefault();
  const target = e.target.closest(".draggable-item");
  if (target) {
    const rect = target.getBoundingClientRect();
    const isAfter = e.clientY > rect.top + rect.height / 2;
    target.classList.toggle("drop-after", isAfter);
    target.classList.toggle("drop-before", !isAfter);
    dropIndex = isAfter ? index + 1 : index;
  }
}

function handleDrop(e) {
  e.preventDefault();
  document.querySelectorAll(".draggable-item").forEach(el => {
    el.classList.remove("drop-before", "drop-after");
  });

  if (draggedIndex !== -1 && dropIndex !== -1 && draggedIndex !== dropIndex) {
    const move = (arr, from, to) => {
      const a = [...arr];
      const [m] = a.splice(from, 1);
      const insertAt = from < to ? to - 1 : to;
      a.splice(insertAt, 0, m);
      return a;
    };
    state.sequentialImages = move(state.sequentialImages, draggedIndex, dropIndex);
    fileStore.sequentialFiles = move(fileStore.sequentialFiles, draggedIndex, dropIndex);
  }

  draggedIndex = -1;
  dropIndex = -1;
}

function handleDragLeave(e) {
  const target = e.target.closest(".draggable-item");
  if (target) target.classList.remove("drop-before", "drop-after");
}

function handleDragEnd(e) {
  e.target.style.opacity = "1";
  draggedIndex = -1;
  dropIndex = -1;
  document.querySelectorAll(".draggable-item").forEach(item => {
    item.classList.remove("drop-before", "drop-after");
  });
}

const clearAsset = (type, key, subkey = null) => {
  state.themeSubmitted = false;
  if (key === "turnSignal") {
    if (state.turnSignalType === "Sequential") {
      fileStore.sequentialFiles = [];
      state.sequentialImages = [];
      state.imageFileNames.turnSignal = "";
    } else {
      fileStore.images.turnSignal = undefined;
      state.imageFileNames.turnSignal = "";
    }
    return;
  }
  const store = type === "image" ? fileStore.images : fileStore.sounds;
  const nameState = type === "image" ? state.imageFileNames : state.soundFileNames;
  if (subkey) {
    if (store[key]) store[key][subkey] = undefined;
    if (nameState[key]) nameState[key][subkey] = "";
  } else {
    store[key] = undefined;
    nameState[key] = "";
  }
};

const onClearClick = (e, type, key, subkey = null) => {
  e.preventDefault();
  e.stopPropagation();
  clearAsset(type, key, subkey);
  const input = e.currentTarget.parentElement.querySelector('input[type="file"]');
  if (input) input.value = "";
};

const clearAssetType = (assetType) => {
  if (assetType === "colors") {
    state.colors = { ...defaultColors };
  }
  if (assetType === "distance_icons") {
    ["traffic", "aggressive", "standard", "relaxed"].forEach(sub => {
      if (!fileStore.images.distanceIcons) fileStore.images.distanceIcons = {};
      fileStore.images.distanceIcons[sub] = undefined;
      state.imageFileNames.distanceIcons[sub] = "";
    });
  }
  if (assetType === "icons") {
    ["homeButton", "settingsButton"].forEach(k => {
      fileStore.images[k] = undefined;
      state.imageFileNames[k] = "";
    });
  }
  if (assetType === "steering_wheel") {
    fileStore.images.steeringWheel = undefined;
    state.imageFileNames.steeringWheel = "";
  }
  if (assetType === "sounds") {
    Object.keys(state.soundFileNames).forEach(k => {
      fileStore.sounds[k] = undefined;
      state.soundFileNames[k] = "";
    });
  }
  if (assetType === "turn_signals") {
    fileStore.images.turnSignal = undefined;
    fileStore.images.turnSignalBlindspot = undefined;
    state.imageFileNames.turnSignal = "";
    state.imageFileNames.turnSignalBlindspot = "";
    fileStore.sequentialFiles = [];
    state.sequentialImages = [];
  }
};

const populateAssetNames = (themeData = {}) => {
  const { images = {}, sounds = {} } = themeData;
  const { distanceIcons = {} } = images;

  for (const key in state.imageFileNames) {
    if (key === "distanceIcons") {
      for (const subkey in state.imageFileNames.distanceIcons) {
        state.imageFileNames.distanceIcons[subkey] = (distanceIcons[subkey] || "").split("/").pop();
      }
    } else {
      state.imageFileNames[key] = (images[key] || "").split("/").pop();
    }
  }

  for (const key in state.soundFileNames) {
    state.soundFileNames[key] = (sounds[key] || "").split("/").pop();
  }
};

const isThemeAssetEmpty = () => {
  const hasNewFiles =
    Object.values(fileStore.images).some(val => {
      if (!val) return false;
      return typeof val === "object" && !(val instanceof File) ? Object.values(val).some(f => f) : true;
    }) ||
    Object.values(fileStore.sounds).some(file => file) ||
    fileStore.sequentialFiles.length > 0;

  if (hasNewFiles) return false;

  const hasExistingFileNames =
    Object.values(state.imageFileNames).some(val => {
      if (!val) return false;
      return typeof val === "object" ? Object.values(val).some(name => name) : val;
    }) ||
    Object.values(state.soundFileNames).some(name => name) ||
    state.sequentialImages.length > 0;

  return !hasExistingFileNames;
};

const loadDefaultTheme = async () => {
  try {
    const response = await fetch("/api/themes/default");
    const data = await response.json();

    if (data.colors) {
      state.colors = data.colors;
    }

    if (data.images) {
      if (data.images.homeButton) {
        state.imageFileNames.homeButton = data.theme_names.icons || "Active";
      }
      if (data.images.settingsButton) {
        state.imageFileNames.settingsButton = data.theme_names.icons || "Active";
      }
      if (data.images.steeringWheel) {
        state.imageFileNames.steeringWheel = data.theme_names.steeringWheel || "Active";
      }
      if (data.images.turnSignal) {
        state.imageFileNames.turnSignal = data.theme_names.turnSignals || "Active";
      }
      if (data.images.turnSignalBlindspot) {
        state.imageFileNames.turnSignalBlindspot = data.theme_names.turnSignals || "Active";
      }
      if (data.images.distanceIcons) {
        for (const key in data.images.distanceIcons) {
          if (data.images.distanceIcons[key]) {
            state.imageFileNames.distanceIcons[key] = data.theme_names.distanceIcons || "Active";
          }
        }
      }
    }

    if (data.sounds) {
      for (const key in data.sounds) {
        if (data.sounds[key]) {
          state.soundFileNames[key] = data.theme_names.sounds || "Active";
        }
      }
    }

    if (data.turnSignalLength) {
      state.turnSignalLength = data.turnSignalLength;
    }

    if (data.turnSignalStyle) {
      state.turnSignalStyle = data.turnSignalStyle;
    }

    if (data.turnSignalType) {
      state.turnSignalType = data.turnSignalType;
    }

    if (data.sequentialImages && data.sequentialImages.length > 0) {
      state.sequentialImages = data.sequentialImages;
      state.imageFileNames.turnSignal = data.theme_names.turnSignals || "Active";
    }

    const fetchActive = async (relPath) => {
      const res = await fetch(`/api/themes/asset/__active__/${relPath}?type=active`);
      if (!res.ok) return null;
      const blob = await res.blob();
      return new File([blob], relPath.split("/").pop(), { type: blob.type });
    };

    if (data.images?.turnSignal) {
      const f = await fetchActive(`signals/${data.images.turnSignal}`);
      if (f) fileStore.images.turnSignal = f;
    }

    if (data.images?.turnSignalBlindspot) {
      const f = await fetchActive(`signals/${data.images.turnSignalBlindspot}`);
      if (f) fileStore.images.turnSignalBlindspot = f;
    }

    fileStore.sequentialFiles = [];
    if (Array.isArray(data.sequentialImages) && data.sequentialImages.length) {
      for (const img of data.sequentialImages) {
        const f = await fetchActive(`signals/${img}`);
        if (f) fileStore.sequentialFiles.push(f);
      }
    }

    if (data.images?.distanceIcons) {
      if (!fileStore.images.distanceIcons) fileStore.images.distanceIcons = {};
      for (const [k, v] of Object.entries(data.images.distanceIcons)) {
        const f = await fetchActive(`distance_icons/${v}`);
        if (f) fileStore.images.distanceIcons[k] = f;
      }
    }

    if (data.images?.homeButton) {
      const f = await fetchActive(`icons/${data.images.homeButton}`);
      if (f) fileStore.images.homeButton = f;
    }

    if (data.images?.settingsButton) {
      const f = await fetchActive(`icons/${data.images.settingsButton}`);
      if (f) fileStore.images.settingsButton = f;
    }

    if (data.images?.steeringWheel) {
      const f = await fetchActive(`steering_wheel/${data.images.steeringWheel}`);
      if (f) fileStore.images.steeringWheel = f;
    }

    if (data.sounds) {
      for (const [k, v] of Object.entries(data.sounds)) {
        const f = await fetchActive(`sounds/${v}`);
        if (f) fileStore.sounds[k] = f;
      }
    }
  } catch (error) {
    console.error("Failed to load default theme:", error);
    showSnackbar("加载默认主题失败。", "error");
  }
};

const fetchDownloadables = async () => {
  const keys = {
    colors: "DownloadableColors",
    distance_icons: "DownloadableDistanceIcons",
    icons: "DownloadableIcons",
    signals: "DownloadableSignals",
    sounds: "DownloadableSounds",
    wheels: "DownloadableWheels"
  };
  const parseList = s => (s || "").split(",").map(v => v.trim()).filter(Boolean);
  for (const [slot, param] of Object.entries(keys)) {
    const r = await fetch(`/api/params?key=${encodeURIComponent(param)}`);
    const txt = await r.text();
    state.downloadable[slot] = parseList(txt);
  }
};


(async () => {
  try {
    const response = await fetch("/api/params?key=DiscordUsername");
    state.discordUsername = await response.text();
    await loadDefaultTheme();
    await fetchDownloadables();

  } catch {}
})();

export function ThemeMaker() {
  const normalize = (str) => (str || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const isDownloadable = (tab, name) => {
    const map = { colors: "colors", distance_icons: "distance_icons", icons: "icons", sounds: "sounds", steering_wheel: "wheels", turn_signals: "signals" };
    const key = map[tab] || tab;
    const list = state.downloadable[key] || [];
    const target = normalize(name);
    return list.some(v => normalize(v) === target);
  };

  const sortThemesAlphabetically = () => {
    state.themes.sort((a, b) => {
      const an = (a?.name || "").toString();
      const bn = (b?.name || "").toString();
      return an.localeCompare(bn, undefined, { sensitivity: "base", numeric: true });
    });
  };



  const hasDistanceIcons = () => Object.values(fileStore.images.distanceIcons).some(f => f) || Object.values(state.imageFileNames.distanceIcons).some(name => name);
  const hasIcons = () => ["homeButton", "settingsButton"].some(key => fileStore.images[key] || state.imageFileNames[key]);
  const hasSounds = () => Object.values(fileStore.sounds).some(f => f) || Object.values(state.soundFileNames).some(name => name);
  const hasTurnSignals = () => fileStore.images.turnSignal || state.imageFileNames.turnSignal || fileStore.images.turnSignalBlindspot || state.imageFileNames.turnSignalBlindspot || fileStore.sequentialFiles.length > 0 || state.sequentialImages.length > 0;
  const hasSteeringWheel = () => fileStore.images.steeringWheel || state.imageFileNames.steeringWheel;

  const handleFileUpload = (e, type, key, subkey = null) => {
    const { files } = e.target;
    if (files.length === 0) return;

    for (const file of files) {
      if (key === "turnSignal" && state.turnSignalType === "Sequential" && file.type === "image/gif") {
        showSnackbar("序列转向灯不支持 GIF...", "error");
        e.target.value = "";
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showSnackbar(`文件 ${file.name} 过大！请上传小于 5MB 的文件。`, "error");
        e.target.value = "";
        return;
      }

      if (!file.type.startsWith(`${type}/`)) {
        showSnackbar(`文件类型无效！请上传 ${type} 类型文件。`, "error");
        e.target.value = "";
        return;
      }
    }

    state.themeSubmitted = false;

    if (key === "turnSignal" && state.turnSignalType === "Sequential") {
      fileStore.sequentialFiles.push(...files);
      state.sequentialImages.push(...Array.from(files).map(file => file.name));
      state.imageFileNames.turnSignal = "";
    } else {
      const file = files[0];
      const store = type === "image" ? fileStore.images : fileStore.sounds;
      const nameState = type === "image" ? state.imageFileNames : state.soundFileNames;

      if (subkey) {
        store[key][subkey] = file;
        nameState[key][subkey] = file ? file.name : "";
      } else {
        store[key] = file;
        nameState[key] = file ? file.name : "";
      }
    }
  };

  const handleColorChange = (e, key) => {
    const hex = e.target.value;
    state.colors[key] = {
      red: parseInt(hex.slice(1, 3), 16),
      green: parseInt(hex.slice(3, 5), 16),
      blue: parseInt(hex.slice(5, 7), 16),
      alpha: 255,
    };
    state.themeSubmitted = false;
  };

  const validateTurnSignalLength = (e) => {
    const value = parseInt(e.target.value, 10);
    const clampedValue = isNaN(value) ? 25 : Math.max(25, Math.min(1000, value));
    state.turnSignalLength = clampedValue;
    e.target.value = clampedValue;
  };

  const toggleTurnSignalType = (type) => {
    state.turnSignalType = type;
    state.themeSubmitted = false;
    state.sequentialImages = [];
    fileStore.sequentialFiles = [];
    fileStore.images.turnSignal = undefined;
    state.imageFileNames.turnSignal = "";
  };

  const getFormData = () => {
    const formData = new FormData();
    formData.append("themeName", state.themeName);
    formData.append("saveChecklist", JSON.stringify(state.saveChecklist));

    if (state.discordUsername && state.discordUsername.trim()) {
      formData.append("discordUsername", state.discordUsername.trim());
    }

    if (state.saveChecklist.colors) {
      formData.append("colors", JSON.stringify(state.colors));
    }

    if (state.saveChecklist.turn_signals) {
      formData.append("turnSignalStyle", state.turnSignalStyle);
      formData.append("turnSignalType", state.turnSignalType);
      formData.append("turnSignalLength", state.turnSignalLength);

      if (state.turnSignalType === "Sequential") {
        fileStore.sequentialFiles.forEach((file, index) => {
          formData.append(`turn_signal_${index + 1}`, file);
        });
      }
      if (fileStore.images.turnSignal) {
        formData.append("turnSignal", fileStore.images.turnSignal);
      }
      if (fileStore.images.turnSignalBlindspot) {
        formData.append("turnSignalBlindspot", fileStore.images.turnSignalBlindspot);
      }
    }

    if (state.saveChecklist.icons) {
      ["homeButton", "settingsButton"].forEach(key => {
        if (fileStore.images[key]) formData.append(key, fileStore.images[key]);
      });
    }

    if (state.saveChecklist.steering_wheel) {
      if (fileStore.images.steeringWheel) formData.append("steeringWheel", fileStore.images.steeringWheel);
    }

    if (state.saveChecklist.distance_icons) {
      for (const subkey in fileStore.images.distanceIcons) {
        const file = fileStore.images.distanceIcons[subkey];
        if (file) formData.append(`distanceIcons_${subkey}`, file);
      }
    }

    if (state.saveChecklist.sounds) {
      for (const key in fileStore.sounds) {
        if (fileStore.sounds[key]) formData.append(key, fileStore.sounds[key]);
      }
    }
    return formData;
  };

  const performApiAction = async (url, options, successMessage, errorMessage) => {
    try {
      const response = await fetch(url, options);
      const result = await response.json();
      const message = result.message || (response.ok ? successMessage : errorMessage);
      if (message) {
        showSnackbar(message, response.ok ? "success" : "error");
      }
      return { ok: response.ok, result };
    } catch(e) {
      showSnackbar(`An error occurred: ${errorMessage} (${e.message})`, "error");
      return { ok: false };
    }
  };

  const applyTheme = async () => {
    if (!Object.values(state.saveChecklist).some(v => v)) {
      return showSnackbar("请至少选择一个要应用的组件！", "error");
    }
    state.showApplyConfirmModal = false;
    state.isApplying = true;
    await performApiAction(
      "/api/themes/apply",
      { method: "POST", body: getFormData() },
      "主题应用成功！",
      "主题应用失败。"
    );
    state.isApplying = false;
  };

  const saveTheme = async () => {
    if (!state.themeName.trim()) {
      return showSnackbar("请输入主题名称！", "error");
    }
    if (!Object.values(state.saveChecklist).some(v => v)) {
      return showSnackbar("请至少选择一个要保存的组件！", "error");
    }
    state.showSaveConfirmModal = false;
    state.isSaving = true;
    const { ok } = await performApiAction("/api/themes", { method: "POST", body: getFormData() }, "主题保存成功！", "主题保存失败。");
    if (ok) {
      state.themeName = "";
    }
    state.isSaving = false;
  };

  const submitTheme = async () => {
    if (!state.discordUsername.trim()) {
      return showSnackbar("提交时必须填写 Discord 用户名...", "error");
    }
    if (!state.themeName.trim()) {
      return showSnackbar("请输入主题名称...", "error");
    }
    if (!Object.values(state.saveChecklist).some(v => v)) {
      return showSnackbar("请至少选择一个要提交的组件！", "error");
    }

    state.isSubmitting = true;
    state.showSubmitConfirmation = false;

    const { ok } = await performApiAction("/api/themes/submit", { method: "POST", body: getFormData() }, "主题提交成功！", "主题提交失败。");
    if (ok) {
      state.themeSubmitted = true;
      state.themeName = "";
    }
    state.isSubmitting = false;
  };

  const confirmApply = () => {
    state.saveChecklist = {
      colors: false,
      distance_icons: false,
      icons: false,
      sounds: false,
      turn_signals: false,
      steering_wheel: false,
    };
    state.showApplyConfirmModal = true;
  };

  const confirmSave = () => {
    state.saveChecklist = {
      colors: false,
      distance_icons: false,
      icons: false,
      sounds: false,
      turn_signals: false,
      steering_wheel: false,
    };
    state.showSaveConfirmModal = true;
  };

  const confirmSubmit = () => {
    if (state.themeSubmitted) {
      return showSnackbar("该主题已提交过...", "error");
    }
    if (isThemeAssetEmpty()) {
      return showSnackbar("无法提交空主题...", "error");
    }
    state.saveChecklist = {
      colors: false,
      distance_icons: false,
      icons: false,
      sounds: false,
      turn_signals: false,
      steering_wheel: false,
    };
    state.showSubmitConfirmation = true;
  };

  const manageThemes = async () => {
    const response = await fetch("/api/themes/list");
    const data = await response.json();
    state.themes = (data.themes || []).map(t => ({
      ...t,
      localHasColors: !!t.hasColors,
      localHasDistanceIcons: !!t.hasDistanceIcons,
      localHasIcons: !!t.hasIcons,
      localHasSounds: !!t.hasSounds,
      localHasSteeringWheel: !!t.hasSteeringWheel,
      localHasTurnSignals: !!t.hasTurnSignals,
    }));
    mergeDownloadablesIntoThemes();
    sortThemesAlphabetically();
    state.showManageThemesModal = true;
  };

  const mergeDownloadablesIntoThemes = () => {
    const byName = new Map();
    const norm = (s) => (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    for (const t of state.themes) byName.set(norm(t.name), t);

    const tabToFlag = {
      colors: "hasColors",
      distance_icons: "hasDistanceIcons",
      icons: "hasIcons",
      sounds: "hasSounds",
      steering_wheel: "hasSteeringWheel",
      turn_signals: "hasTurnSignals"
    };

    const addIfMissing = (bucketKey, tabName) => {
      const list = state.downloadable[bucketKey] || [];
      for (const name of list) {
        const key = norm(name);
        if (!byName.has(key)) {
          const t = {
            name,
            type: "holiday",
            path: encodeURIComponent(name),
            is_user_created: false
          };
          for (const flag of Object.values(tabToFlag)) t[flag] = false;
          t[tabToFlag[tabName]] = true;
          state.themes.push(t);
          byName.set(key, t);
        } else {
          const t = byName.get(key);
          t[tabToFlag[tabName]] = true;
        }
      }
    };

    addIfMissing("colors", "colors");
    addIfMissing("distance_icons", "distance_icons");
    addIfMissing("icons", "icons");
    addIfMissing("sounds", "sounds");
    addIfMissing("wheels", "steering_wheel");
    addIfMissing("signals", "turn_signals");
  };

  const refreshThemesAndDownloadables = async () => {
    const r = await fetch("/api/themes/list");
    const data = await r.json();
    state.themes = (data.themes || []).map(t => ({
      ...t,
      localHasColors: !!t.hasColors,
      localHasDistanceIcons: !!t.hasDistanceIcons,
      localHasIcons: !!t.hasIcons,
      localHasSounds: !!t.hasSounds,
      localHasSteeringWheel: !!t.hasSteeringWheel,
      localHasTurnSignals: !!t.hasTurnSignals,
    }));
    mergeDownloadablesIntoThemes();
    sortThemesAlphabetically();
    await fetchDownloadables();
  };

  const pollDownloadProgress = async () => {
    return new Promise((resolve) => {
      const timer = setInterval(async () => {
        try {
          const r = await fetch("/api/params_memory?key=ThemeDownloadProgress");
          const txt = (await r.text()) || "";
          if (!txt) return;
          if (/Downloaded!/i.test(txt)) {
            clearInterval(timer);
            resolve({ ok: true, status: "done" });
          } else if (/failed|cancelled/i.test(txt)) {
            clearInterval(timer);
            resolve({ ok: false, status: txt });
          }
        } catch {}
      }, 1000);
    });
  };

  const startAssetDownload = async (tab, displayName) => {
    if (!displayName) return;
    state.isLoadingAsset = true;
    try {
      const res = await fetch("/api/themes/download_asset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ component: tab, name: displayName })
      });
      if (!res.ok) {
        showSnackbar("无法启动下载。", "error");
        state.isLoadingAsset = false;
        return;
      }
      showSnackbar(`正在下载主题“${displayName}”的 ${tab.replace('_', ' ')}...`);
      const result = await pollDownloadProgress();
      if (!result.ok) {
        showSnackbar(`下载失败：${result.status}`, "error");
        state.isLoadingAsset = false;
        return;
      }
      await refreshThemesAndDownloadables();
      const norm = s => (s || "").toString().trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
      const theme = state.themes.find(t => norm(t.name) === norm(displayName));
      if (theme) {
        const tabToLocalFlag = {
          colors: "localHasColors",
          distance_icons: "localHasDistanceIcons",
          icons: "localHasIcons",
          sounds: "localHasSounds",
          steering_wheel: "localHasSteeringWheel",
          turn_signals: "localHasTurnSignals"
        };
        const f = tabToLocalFlag[tab];
        if (f) theme[f] = true;
      }
      showSnackbar(`已下载“${displayName}”的 ${tab.replace('_', ' ')}。`);
    } catch (e) {
      showSnackbar("下载过程中发生异常。", "error");
    } finally {
      state.isLoadingAsset = false;
    }
  };

  const loadThemeAsset = async (theme, assetType) => {
    if (state.isLoadingAsset) return;
    state.isLoadingAsset = true;

    clearAssetType(assetType);

    try {
      const response = await fetch(`/api/themes/load/${theme.path}?type=${theme.type}`);
      const data = await response.json();

      const fetchAndStoreFile = async (assetPath, key, subkey = null, type = "image", assetGroup = "") => {
        if (!assetPath) return;
        try {
          const url = `/api/themes/asset/${theme.path}/${assetPath}?type=${theme.type}`;
          const fileResponse = await fetch(url);
          const blob = await fileResponse.blob();
          const filename = assetPath.split("/").pop();
          const file = new File([blob], filename, { type: blob.type });

          const store = type === "image" ? fileStore.images : fileStore.sounds;
          if (subkey) {
            store[key][subkey] = file;
          } else {
            store[key] = file;
          }
        } catch (err) {
          console.error(`Failed to load file from ${assetPath}`, err);
        }
      };

      if (assetType === "colors" && data.colors) {
        state.colors = data.colors;
      }

      if (assetType === "distance_icons" && data.images.distanceIcons) {
        for (const [subkey, asset] of Object.entries(data.images.distanceIcons)) {
          state.imageFileNames.distanceIcons[subkey] = theme.name;
          await fetchAndStoreFile(asset.path, "distanceIcons", subkey, "image", "distance_icons");
        }
      }

      if (assetType === "icons" && (data.images.homeButton || data.images.settingsButton)) {
        if (data.images.homeButton) {
          state.imageFileNames.homeButton = theme.name;
          await fetchAndStoreFile(data.images.homeButton.path, "homeButton", null, "image", "icons");
        }
        if (data.images.settingsButton) {
          state.imageFileNames.settingsButton = theme.name;
          await fetchAndStoreFile(data.images.settingsButton.path, "settingsButton", null, "image", "icons");
        }
      }

      if (assetType === "steering_wheel" && theme.path) {
        const url = `/api/themes/asset/${theme.path}/${data.images.steeringWheel.path}?type=${theme.type}`;
        const fileResponse = await fetch(url);
        const blob = await fileResponse.blob();
        const file = new File([blob], theme.path, { type: blob.type });
        fileStore.images.steeringWheel = file;
        state.imageFileNames.steeringWheel = theme.name;
      }

      if (assetType === "sounds" && Object.keys(data.sounds).length) {
        for (const [key, asset] of Object.entries(data.sounds)) {
          state.soundFileNames[key] = theme.name;
          await fetchAndStoreFile(asset.path, key, null, "audio", "sounds");
        }
      }

      if (assetType === "turn_signals") {
        state.turnSignalLength = data.turnSignalLength;
        state.turnSignalType = data.turnSignalType;
        state.turnSignalStyle = data.turnSignalStyle || "Static";

        state.imageFileNames.turnSignal = data.images.turnSignal?.filename ? theme.name : "";
        state.imageFileNames.turnSignalBlindspot = data.images.turnSignalBlindspot?.filename ? theme.name : "";

        if (data.images.turnSignal) {
          await fetchAndStoreFile(data.images.turnSignal.path, "turnSignal", null, "image", "signals");
        }
        if (data.images.turnSignalBlindspot) {
          await fetchAndStoreFile(data.images.turnSignalBlindspot.path, "turnSignalBlindspot", null, "image", "signals");
        }

        state.sequentialImages = data.sequentialImages || [];
        fileStore.sequentialFiles = [];

        if (data.sequentialImages && data.sequentialImages.length > 0) {
          state.imageFileNames.turnSignal = theme.name;
          for (const img of data.sequentialImages) {
            const url = `/api/themes/asset/${theme.path}/signals/${img}?type=${theme.type}`;
            const fileResponse = await fetch(url);
            const blob = await fileResponse.blob();
            const file = new File([blob], img, { type: blob.type });
            fileStore.sequentialFiles.push(file);
          }
        }
      }

      showSnackbar(`已从“${theme.name}”加载 ${assetType.replace("_", " ")}！`);
    } catch (err) {
      console.error("Failed to load theme asset:", err);
      showSnackbar("主题资源加载失败。", "error");
    } finally {
      state.isLoadingAsset = false;
    }
  };

  const confirmDelete = (theme) => {
    state.themeToDelete = theme;
    state.showDeleteConfirmModal = true;
  };

  const deleteThemeAndRestoreDownloadables = (themeName) => {
    const norm = (s) => (s || "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const flagToBucket = {
      hasColors: "colors",
      hasDistanceIcons: "distance_icons",
      hasIcons: "icons",
      hasSounds: "sounds",
      hasSteeringWheel: "wheels",
      hasTurnSignals: "signals"
    };

    const index = state.themes.findIndex((t) => norm(t.name) === norm(themeName));
    if (index === -1) return;

    const theme = state.themes[index];
    state.themes.splice(index, 1);

    const ensureInBucket = (bucket, name) => {
      if (!state.downloadable[bucket]) state.downloadable[bucket] = [];
      const exists = state.downloadable[bucket].some((n) => norm(n) === norm(name));
      if (!exists) state.downloadable[bucket].push(name);
    };

    for (const [flag, bucket] of Object.entries(flagToBucket)) {
      if (theme[flag]) ensureInBucket(bucket, theme.name);
    }
  };

  const deleteTheme = async () => {
    const theme = state.themeToDelete;
    if (!theme) return;

    const component = state.activeTab === "steering_wheel"
      ? ""
      : `&component=${state.activeTab === "turn_signals" ? "signals" : state.activeTab}`;

    const response = await fetch(`/api/themes/delete/${theme.path}?type=${theme.type}${component}`, { method: "DELETE" });
    const result = await response.json();
    if (response.ok) {
      showSnackbar(result.message, "success");
      deleteThemeAndRestoreDownloadables(theme.name);
      manageThemes();
    } else {
      showSnackbar(result.message, "error");
    }
    state.showDeleteConfirmModal = false;
    state.themeToDelete = null;
  };

  return html`<div class="theme-maker-container">
      <div class="theme-maker-main-widget">
        <div class="theme-maker-main-title">主题制作器</div>
        <div class="theme-maker-sub-widgets">
          <section class="theme-maker-widget">
            <div class="theme-maker-title">颜色</div>
            <div class="theme-maker-form">
              <div class="color-section">
                ${Object.keys(COLOR_LABELS).sort().map(key => html`<label class="color-label">
                    ${COLOR_LABELS[key]}
                    <input type="color"
                      value="${() => {
                        const c = state.colors[key];
                        return `#${c.red.toString(16).padStart(2, "0")}${c.green.toString(16).padStart(2, "0")}${c.blue.toString(16).padStart(2, "0")}`;
                      }}"
                      @input="${e => handleColorChange(e, key)}" />
                  </label>`)}
              </div>
            </div>
          </section>

          <section class="theme-maker-widget">
            <div class="theme-maker-title">跟车距离图标</div>
            <div class="theme-maker-form">
              <div class="upload-section">
                ${["traffic", "aggressive", "standard", "relaxed"].map(key => html`<div>
                    <input type="file" class="file-upload-input" id="file-upload-distance-${key}" accept="image/*"
                      @change="${e => handleFileUpload(e, "image", "distanceIcons", key)}" />
                    <div class="file-upload-label">
                      <span class="file-upload-text">${key.charAt(0).toUpperCase() + key.slice(1)}</span>
                      <span class="file-name-display">${() => state.imageFileNames.distanceIcons[key] || ''}</span>
                      <label for="file-upload-distance-${key}" class="file-upload-button">选择文件</label>
                      ${() => state.imageFileNames.distanceIcons[key] ? html`
                        <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "image", "distanceIcons", key)}">
                          <i class="bi bi-trash-fill"></i>
                        </button>
                      ` : ""}
                    </div>
                  </div>`)}
              </div>
            </div>
            <div class="turn-signal-help-text">
              <p><strong>Recommended size: 250x250</strong></p>
            </div>
          </section>

          <section class="theme-maker-widget">
            <div class="theme-maker-title">图标</div>
            <div class="theme-maker-form">
              <div class="upload-section">
                ${Object.keys(ICON_LABELS).map(key => html`<div>
                    <input type="file" class="file-upload-input" id="file-upload-${key}" accept="image/*"
                      @change="${e => handleFileUpload(e, "image", key)}" />
                    <div class="file-upload-label">
                      <span class="file-upload-text">${ICON_LABELS[key]}</span>
                      <span class="file-name-display">${() => state.imageFileNames[key] || ''}</span>
                      <label for="file-upload-${key}" class="file-upload-button">选择文件</label>
                      ${() => state.imageFileNames[key] ? html`
                        <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "image", key)}">
                          <i class="bi bi-trash-fill"></i>
                        </button>
                      ` : ""}
                    </div>
                  </div>`)}
              </div>
            </div>
            <div class="turn-signal-help-text">
              <p><strong>Home Button: 250x250</strong></p>
              <p><strong>Settings Button: 169x104</strong></p>
            </div>
          </section>

          <section class="theme-maker-widget">
            <div class="theme-maker-title">声音</div>
            <div class="theme-maker-form">
              <div class="upload-section">
                ${SOUND_DEFINITIONS.map(({ key, label }) => html`<div>
                    <input type="file" class="file-upload-input" id="file-upload-${key}" accept="audio/*"
                      @change="${e => handleFileUpload(e, "audio", key)}" />
                    <div class="file-upload-label">
                      <span class="file-upload-text">${label}</span>
                      <span class="file-name-display">${() => state.soundFileNames[key] || ''}</span>
                      <label for="file-upload-${key}" class="file-upload-button">选择文件</label>
                      ${() => state.soundFileNames[key] ? html`
                        <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "audio", key)}">
                          <i class="bi bi-trash-fill"></i>
                        </button>
                      ` : ""}
                    </div>
                  </div>`)}
              </div>
            </div>
          </section>

          <section class="theme-maker-widget">
            <div class="theme-maker-title">方向盘</div>
            <div class="theme-maker-form">
              <div class="upload-section">
                <div>
                  <input type="file" class="file-upload-input" id="file-upload-steeringWheel" accept="image/*"
                    @change="${e => handleFileUpload(e, "image", "steeringWheel")}" />
                  <div class="file-upload-label">
                    <span class="file-upload-text">方向盘</span>
                    <span class="file-name-display">${() => state.imageFileNames.steeringWheel || ''}</span>
                    <label for="file-upload-steeringWheel" class="file-upload-button">选择文件</label>
                    ${() => state.imageFileNames.steeringWheel ? html`
                      <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "image", "steeringWheel")}">
                        <i class="bi bi-trash-fill"></i>
                      </button>
                    ` : ""}
                  </div>
                </div>
              </div>
            </div>
            <div class="turn-signal-help-text">
              <p><strong>Recommended size: 250x250</strong></p>
            </div>
          </section>

          <section class="theme-maker-widget">
            <div class="theme-maker-title">转向灯</div>
            <div class="theme-maker-form">
              <div class="upload-section">
                <div class="turn-signal-length-section">
                  <label for="turnSignalLength" class="theme-name-label turn-signal-label">
                    转向灯时长（25-1000ms）
                  </label>
                  <input type="text" pattern="\\d*" id="turnSignalLength"
                    value="${() => state.turnSignalLength}"
                    @input="${e => state.turnSignalLength = e.target.value}" @blur="${validateTurnSignalLength}"
                    class="turn-signal-input">
                </div>
                <div class="turn-signal-style-section">
                  <label class="theme-name-label turn-signal-label">
                    转向灯样式
                    <span class="help-icon" @click="${() => state.showTurnSignalHelp = !state.showTurnSignalHelp}">?</span>
                  </label>
                  <div class="signal-type-toggle">
                    <button class="${() => `toggle-button ${state.turnSignalStyle === "Static" ? "active" : ""}`}"
                      @click="${() => state.turnSignalStyle = "Static"}">静态</button>
                    <button class="${() => `toggle-button ${state.turnSignalStyle === "Traditional" ? "active" : ""}`}"
                      @click="${() => state.turnSignalStyle = "Traditional"}">传统</button>
                  </div>
                  ${() => state.showTurnSignalHelp && html`<div class="turn-signal-help-text">
                      <p><strong>静态</strong> - 转向灯动画显示在当前车速旁边。</p>
                      <p><strong>传统</strong> - 转向灯动画在屏幕底部移动显示。</p>
                    </div>`}
                </div>
                ${() => state.turnSignalStyle === "Traditional" && html`<div class="turn-signal-style-section">
                    <label class="theme-name-label turn-signal-label">转向灯类型</label>
                    <div class="signal-type-toggle">
                      <button class="${() => `toggle-button ${state.turnSignalType === "Sequential" ? "active" : ""}`}"
                        @click="${() => toggleTurnSignalType("Sequential")}">序列帧</button>
                      <button class="${() => `toggle-button ${state.turnSignalType === "Single Image" ? "active" : ""}`}"
                        @click="${() => toggleTurnSignalType("Single Image")}">单图</button>
                    </div>
                  </div>`}
                <div>
                  <input type="file" class="file-upload-input" id="file-upload-turnSignalBlindspot" accept="image/*"
                    @change="${e => handleFileUpload(e, "image", "turnSignalBlindspot")}" />
                  <div class="file-upload-label">
                    <span class="file-upload-text">盲区提示</span>
                    <span class="file-name-display">${() => state.imageFileNames.turnSignalBlindspot || ''}</span>
                    <label for="file-upload-turnSignalBlindspot" class="file-upload-button">选择文件</label>
                    ${() => state.imageFileNames.turnSignalBlindspot ? html`
                      <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "image", "turnSignalBlindspot")}">
                        <i class="bi bi-trash-fill"></i>
                      </button>
                    ` : ""}
                  </div>
                </div>
                <div>
                  <input type="file" class="file-upload-input" id="file-upload-turnSignal" accept="image/*"
                    :multiple="${() => state.turnSignalType === "Sequential"}"
                    @change="${e => handleFileUpload(e, "image", "turnSignal")}" />
                  <div class="file-upload-label">
                    <span class="file-upload-text">${() => state.turnSignalType === "Sequential" ? "转向灯序列" : "转向灯"}</span>
                    <span class="file-name-display">
                      ${() => {
                        if (state.turnSignalType === "Sequential") {
                          if (state.imageFileNames.turnSignal) return state.imageFileNames.turnSignal;
                          return state.sequentialImages.length > 0 ? `${state.sequentialImages.length} image(s) selected` : '';
                        }
                        return state.imageFileNames.turnSignal || '';
                      }}
                    </span>
                    <label for="file-upload-turnSignal" class="file-upload-button">${() => state.turnSignalType === "Sequential" ? "选择文件" : "选择文件"}</label>
                    ${() => (state.imageFileNames.turnSignal || state.sequentialImages.length > 0) ? html`
                      <button class="file-clear-button" title="Clear" @click="${e => onClearClick(e, "image", "turnSignal")}">
                        <i class="bi bi-trash-fill"></i>
                      </button>
                    ` : ""}
                  </div>
                </div>
                ${() => state.turnSignalType === "Sequential" ? html`
                <button class="sequence-order-button" @click="${() => state.showSequenceOrderModal = true}">转向灯序列顺序</button>
                ` : ""}
              </div>
            </div>
          </section>
        </div>
        <div class="save-button-wrapper">
          <button class="apply-button" @click="${confirmApply}" :disabled="${() => state.isApplying}">
            ${() => state.isApplying ? "应用中..." : "应用主题"}
          </button>
          <button class="manage-themes-button" @click="${manageThemes}">管理主题</button>
          <button class="save-button" @click="${confirmSave}" :disabled="${() => state.isSaving}">
            ${() => state.isSaving ? "保存中..." : "保存主题"}
          </button>
          <button class="submit-button" @click="${confirmSubmit}" :disabled="${() => state.isSubmitting}">
            ${() => state.isSubmitting ? "提交中..." : "提交主题"}
          </button>
        </div>
      </div>

      ${() => state.showApplyConfirmModal && Modal({
        title: "应用主题",
        message: html`
          <div class="checklist-container">
            <p style="margin-bottom: 10px; text-align: left; font-weight: bold;">选择要应用的组件：</p>
            <label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.colors}" @click="${() => state.saveChecklist.colors = !state.saveChecklist.colors}">
              <span class="label-text">颜色</span>
              <span class="custom-checkbox"></span>
            </label>
            ${() => hasDistanceIcons() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.distance_icons}" @click="${() => state.saveChecklist.distance_icons = !state.saveChecklist.distance_icons}">
              <span class="label-text">跟车距离图标</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasIcons() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.icons}" @click="${() => state.saveChecklist.icons = !state.saveChecklist.icons}">
              <span class="label-text">图标</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSounds() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.sounds}" @click="${() => state.saveChecklist.sounds = !state.saveChecklist.sounds}">
              <span class="label-text">声音</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSteeringWheel() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.steering_wheel}" @click="${() => state.saveChecklist.steering_wheel = !state.saveChecklist.steering_wheel}">
              <span class="label-text">方向盘</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasTurnSignals() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.turn_signals}" @click="${() => state.saveChecklist.turn_signals = !state.saveChecklist.turn_signals}">
              <span class="label-text">转向灯</span>
              <span class="custom-checkbox"></span>
            </label>`}
          </div>
        `,
        onConfirm: applyTheme,
        onCancel: () => state.showApplyConfirmModal = false,
        confirmText: "应用",
        confirmClass: "btn-primary",
      })}

      ${() => state.showSaveConfirmModal && Modal({
        title: "保存主题",
        message: html`
          <div class="theme-name-section">
            <label for="themeName" class="theme-name-label">主题名称</label>
            <input type="text" id="themeName" placeholder="输入主题名称..." autocomplete="off"
              value="${() => state.themeName}" @input="${(e) => state.themeName = e.target.value}" />
          </div>
          <div class="checklist-container">
            <p style="margin-bottom: 10px; text-align: left; font-weight: bold;">选择要保存的组件：</p>
            <label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.colors}" @click="${() => state.saveChecklist.colors = !state.saveChecklist.colors}">
              <span class="label-text">颜色</span>
              <span class="custom-checkbox"></span>
            </label>
            ${() => hasDistanceIcons() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.distance_icons}" @click="${() => state.saveChecklist.distance_icons = !state.saveChecklist.distance_icons}">
              <span class="label-text">跟车距离图标</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasIcons() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.icons}" @click="${() => state.saveChecklist.icons = !state.saveChecklist.icons}">
              <span class="label-text">图标</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSounds() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.sounds}" @click="${() => state.saveChecklist.sounds = !state.saveChecklist.sounds}">
              <span class="label-text">声音</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSteeringWheel() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.steering_wheel}" @click="${() => state.saveChecklist.steering_wheel = !state.saveChecklist.steering_wheel}">
              <span class="label-text">方向盘</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasTurnSignals() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.turn_signals}" @click="${() => state.saveChecklist.turn_signals = !state.saveChecklist.turn_signals}">
              <span class="label-text">转向灯</span>
              <span class="custom-checkbox"></span>
            </label>`}
          </div>
        `,
        onConfirm: saveTheme,
        onCancel: () => state.showSaveConfirmModal = false,
        confirmText: "保存",
        confirmClass: "btn-primary",
      })}

      ${() => state.showSubmitConfirmation && Modal({
        title: "提交主题到社区",
        message: html`
          <p>提交你的主题，供所有人使用！</p>
          <div class="theme-name-section">
            <label for="submitThemeName" class="theme-name-label">主题名称</label>
            <input type="text" id="submitThemeName" placeholder="输入主题名称..." autocomplete="off"
              value="${() => state.themeName}" @input="${e => state.themeName = e.target.value}" />
          </div>
          <p>请填写你的 Discord 用户名，便于我们在需要时联系你。</p>
          <input type="text" placeholder="Discord 用户名" class="discord-username-input" value="${() => state.discordUsername}" @input="${e => state.discordUsername = e.target.value}" />
          <div class="checklist-container">
            <p style="margin-bottom: 10px; text-align: left; font-weight: bold;">选择要提交的组件：</p>
            <label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.colors}" @click="${() => state.saveChecklist.colors = !state.saveChecklist.colors}">
              <span class="label-text">颜色</span>
              <span class="custom-checkbox"></span>
            </label>
            ${() => hasDistanceIcons() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.distance_icons}" @click="${() => state.saveChecklist.distance_icons = !state.saveChecklist.distance_icons}">
              <span class="label-text">跟车距离图标</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSounds() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.sounds}" @click="${() => state.saveChecklist.sounds = !state.saveChecklist.sounds}">
              <span class="label-text">声音</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasSteeringWheel() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.steering_wheel}" @click="${() => state.saveChecklist.steering_wheel = !state.saveChecklist.steering_wheel}">
              <span class="label-text">方向盘</span>
              <span class="custom-checkbox"></span>
            </label>`}
            ${() => hasTurnSignals() && html`<label class="checklist-item">
              <input type="checkbox" :checked="${() => state.saveChecklist.turn_signals}" @click="${() => state.saveChecklist.turn_signals = !state.saveChecklist.turn_signals}">
              <span class="label-text">转向灯</span>
              <span class="custom-checkbox"></span>
            </label>`}
          </div>
        `,
        onConfirm: submitTheme,
        onCancel: () => state.showSubmitConfirmation = false,
        confirmText: "提交",
        confirmClass: "btn-primary",
      })}

      ${() => state.showManageThemesModal && Modal({
        title: "管理主题",
        message: html`
          <div class="manage-themes-tabs">
            ${["colors", "distance_icons", "icons", "sounds", "steering_wheel", "turn_signals"].map(tab => html`
              <button class="${() => `tab-button ${state.activeTab === tab ? "active" : ""}`}"
                @click="${() => {
                  state.activeTab = tab;
                  const themesList = document.querySelector('.themes-list');
                  if (themesList) themesList.scrollTop = 0;
                }}">${tab.replace("_", " ").replace(/\b\w/g, l => l.toUpperCase())}</button>
            `)}
          </div>
          <div class="themes-list">
            ${() => state.themes.filter(theme => {
              if (state.activeTab === "steering_wheel") {
                return theme.type === "steering_wheel" || (theme.type === "holiday" && theme.hasSteeringWheel);
              }
              const key = `has${state.activeTab.charAt(0).toUpperCase() + state.activeTab.slice(1).replace(/_([a-z])/g, g => g[1].toUpperCase())}`;
              return theme[key];
            }).map(theme => html`
              <div class="theme-item" @click="${() => !state.isLoadingAsset && loadThemeAsset(theme, state.activeTab)}">
                <span class="theme-button">${theme.name} ${theme.is_user_created ? " 🌟" : ""}</span>
                ${() => {
                  const key = `localHas${state.activeTab
                    .replace(/_([a-z])/g, (_, c) => c.toUpperCase())
                    .replace(/^[a-z]/, c => c.toUpperCase())}`;
                  if (theme.type !== "holiday" && theme[key]) {
                    return html`
                      <button class="delete-theme-button" @click="${(e) => { e.stopPropagation(); confirmDelete(theme); }}">
                        <i class="bi bi-trash-fill"></i>
                      </button>
                    `;
                  }
                  return isDownloadable(state.activeTab, theme.name) ? html`
                    <button class="download-theme-button"
                      @click="${async (e) => {
                        e.stopPropagation();
                        if (state.isLoadingAsset) return;
                        await startAssetDownload(state.activeTab, theme.name);
                      }}">
                      <i class="bi bi-download"></i>
                    </button>
                  ` : "";
                }}
              </div>
            `)}
          </div>
        `,
        onCancel: () => state.showManageThemesModal = false,
        cancelText: "关闭",
        customClass: "manage-themes-modal"
      })}

      ${() => state.showDeleteConfirmModal && Modal({
        title: "确认删除",
        message: `确定要删除主题“${state.themeToDelete.name}”吗？`,
        onConfirm: deleteTheme,
        onCancel: () => {
          state.showDeleteConfirmModal = false;
          state.themeToDelete = null;
        },
        confirmText: "删除",
        confirmClass: "btn-danger",
      })}

    ${() => state.showSequenceOrderModal && Modal({
      title: "转向灯序列顺序",
      message: html`
      <div
        class="draggable-list"
        @dragover.prevent
      >
        ${() => state.sequentialImages.map((item, index) => {
          const file = fileStore.sequentialFiles[index] ||
            fileStore.sequentialFiles.find(f => f && f.name === item);
          const imageUrl = file ? URL.createObjectURL(file) : '';
          return html`
            <div
              class="draggable-item"
              draggable="true"
              @dragstart="${(e) => handleDragStart(e, index)}"
              @dragover="${(e) => handleDragOver(e, index)}"
              @drop="${handleDrop}"
              @dragleave="${handleDragLeave}"
              @dragend="${handleDragEnd}"
            >
              <img src="${imageUrl}" alt="${item}" class="sequential-image-preview" />
              <span>${item}</span>
            </div>
          `;
        })}
      </div>
      `,
      onCancel: () => state.showSequenceOrderModal = false,
      cancelText: "关闭"
    })}
    </div>`;
}
