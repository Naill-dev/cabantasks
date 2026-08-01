(function () {
  "use strict";

  var STORAGE_KEY = "kanban-tasks-v1";
  var STATUSES = ["todo", "inprogress", "done"];
  var PRIORITY_LABEL = {
    low: "Aşağı",
    medium: "Orta",
    high: "Yüksək"
  };

  var tasks = loadTasks();
  var draggedId = null;
  var editingId = null;
  var searchQuery = "";
  var priorityFilter = "all";

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
  }

  function loadTasks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedTasks();
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return seedTasks();
      // Normalize old data (med → medium, progress → inprogress)
      return parsed.map(function (t) {
        if (t.priority === "med") t.priority = "medium";
        if (t.status === "progress") t.status = "inprogress";
        if (!t.title && t.text) {
          t.title = t.text;
          delete t.text;
        }
        if (!t.desc) t.desc = "";
        if (!t.code) t.code = "";
        return t;
      });
    } catch (e) {
      console.warn("Board oxuna bilmədi, sıfırdan başlanır.", e);
      return seedTasks();
    }
  }

  function seedTasks() {
    return [
      {
        id: uid(),
        code: "TSK-001",
        title: "Layihə qovluğunu qur (html/css/js)",
        desc: "Baza strukturunu hazırla",
        status: "done",
        priority: "low"
      },
      {
        id: uid(),
        code: "TSK-002",
        title: "Sürükləmə (drag-and-drop) məntiqini yaz",
        desc: "Kartları sütunlar arasında hərəkət etdir",
        status: "inprogress",
        priority: "high"
      },
      {
        id: uid(),
        code: "TSK-003",
        title: "localStorage ilə saxlamanı bağla",
        desc: "Məlumatların itməsinin qarşısını al",
        status: "todo",
        priority: "medium"
      }
    ];
  }

  function computeNextSeq() {
    var max = 0;
    tasks.forEach(function (t) {
      var n = parseInt((t.code || "").replace(/\D/g, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return max + 1;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (e) {
      console.warn("Board saxlanıla bilmədi.", e);
    }
  }

  function applyFilters(items) {
    return items.filter(function (t) {
      var q = searchQuery;
      var matchesQuery =
        !q ||
        (t.title && t.title.toLowerCase().indexOf(q) !== -1) ||
        (t.desc && t.desc.toLowerCase().indexOf(q) !== -1) ||
        (t.code && t.code.toLowerCase().indexOf(q) !== -1);
      var matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesQuery && matchesPriority;
    });
  }

  function persistAndRender() {
    save();
    render();
  }

  function render() {
    STATUSES.forEach(function (status) {
      var list = document.querySelector('[data-list="' + status + '"]');
      var countEl = document.querySelector('[data-count="' + status + '"]');
      if (!list) return;

      var items = tasks.filter(function (t) {
        return t.status === status;
      });
      items = applyFilters(items);

      list.innerHTML = "";
      if (countEl) countEl.textContent = items.length;

      if (items.length === 0) {
        var hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "Bu sütunda tapşırıq yoxdur";
        list.appendChild(hint);
      } else {
        items.forEach(function (task) {
          list.appendChild(renderCard(task));
        });
      }
    });
    renderStats();
  }

  function renderStats() {
    var total = tasks.length;
    var done = tasks.filter(function (t) {
      return t.status === "done";
    }).length;
    var statsEl = document.getElementById("boardStats");
    if (statsEl) {
      statsEl.innerHTML =
        "<span>Cəmi: <b>" + total + "</b></span>" +
        "<span>Bitmiş: <b>" + done + "</b></span>" +
        (total > 0
          ? "<span>İrəliləyiş: <b>" + Math.round((done / total) * 100) + "%</b></span>"
          : "");
    }
  }

  function renderCard(task) {
    var card = document.createElement("div");
    card.className = "task-card priority-" + (task.priority || "medium");
    card.draggable = true;
    card.dataset.id = task.id;

    var title = document.createElement("div");
    title.className = "title";
    title.textContent = task.title || "";

    var desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = task.desc || "";

    var meta = document.createElement("div");
    meta.className = "meta";

    var badge = document.createElement("span");
    badge.className = "priority-badge priority-" + (task.priority || "medium");
    badge.textContent = PRIORITY_LABEL[task.priority] || task.priority;

    var code = document.createElement("span");
    code.className = "code";
    code.textContent = task.code || "";

    var actions = document.createElement("div");
    actions.className = "actions";

    var editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "edit-btn";
    editBtn.title = "Redaktə et";
    editBtn.textContent = "✏️";
    editBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      openModal(task);
    });

    var delBtn = document.createElement("button");
    delBtn.type = "button";
    delBtn.className = "delete-btn";
    delBtn.title = "Sil";
    delBtn.textContent = "🗑️";
    delBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      deleteTask(task.id);
    });

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    meta.appendChild(badge);
    meta.appendChild(code);
    meta.appendChild(actions);

    card.appendChild(title);
    if (task.desc) card.appendChild(desc);
    card.appendChild(meta);

    card.addEventListener("dragstart", function (e) {
      draggedId = task.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    });

    card.addEventListener("dragend", function () {
      card.classList.remove("dragging");
      draggedId = null;
      document.querySelectorAll(".column").forEach(function (col) {
        col.classList.remove("drop-over");
      });
    });

    return card;
  }

  function deleteTask(id) {
    if (!confirm("Tapşırığı silmək istədiyinizə əminsiniz?")) return;
    tasks = tasks.filter(function (t) {
      return t.id !== id;
    });
    persistAndRender();
  }

  /* ---------- Modal ---------- */
  var overlay = document.getElementById("modalOverlay");
  var form = document.getElementById("taskForm");
  var modalTitle = document.getElementById("modalTitle");
  var titleInput = document.getElementById("taskTitle");
  var descInput = document.getElementById("taskDesc");
  var prioritySelect = document.getElementById("taskPriority");
  var cancelBtn = document.getElementById("cancelBtn");

  function openModal(task) {
    editingId = task ? task.id : null;
    modalTitle.textContent = task ? "Tapşırığı redaktə et" : "Yeni Tapşırıq";
    titleInput.value = task ? task.title : "";
    descInput.value = task ? task.desc || "" : "";
    prioritySelect.value = task ? task.priority || "medium" : "medium";
    overlay.classList.add("open");
    setTimeout(function () {
      titleInput.focus();
    }, 50);
  }

  function closeModal() {
    overlay.classList.remove("open");
    editingId = null;
    form.reset();
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    var title = titleInput.value.trim();
    if (!title) return;

    var desc = descInput.value.trim();
    var priority = prioritySelect.value;

    if (editingId) {
      var task = tasks.find(function (t) {
        return t.id === editingId;
      });
      if (task) {
        task.title = title;
        task.desc = desc;
        task.priority = priority;
      }
    } else {
      var next = computeNextSeq();
      tasks.push({
        id: uid(),
        code: "TSK-" + String(next).padStart(3, "0"),
        title: title,
        desc: desc,
        status: "todo",
        priority: priority
      });
    }
    persistAndRender();
    closeModal();
  });

  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay.classList.contains("open")) closeModal();
  });

  document.getElementById("addTaskBtn").addEventListener("click", function () {
    openModal(null);
  });

  /* ---------- Drag & Drop ---------- */
  document.querySelectorAll(".column").forEach(function (column) {
    column.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      column.classList.add("drop-over");
    });

    column.addEventListener("dragleave", function (e) {
      if (!column.contains(e.relatedTarget)) {
        column.classList.remove("drop-over");
      }
    });

    column.addEventListener("drop", function (e) {
      e.preventDefault();
      column.classList.remove("drop-over");
      var id = e.dataTransfer.getData("text/plain") || draggedId;
      if (!id) return;
      var task = tasks.find(function (t) {
        return t.id === id;
      });
      var newStatus = column.dataset.column;
      if (task && task.status !== newStatus) {
        task.status = newStatus;
        persistAndRender();
      }
    });
  });

  /* ---------- Toolbar ---------- */
  document.getElementById("searchInput").addEventListener("input", function (e) {
    searchQuery = e.target.value.trim().toLowerCase();
    render();
  });

  document.getElementById("filterPriority").addEventListener("change", function (e) {
    priorityFilter = e.target.value;
    render();
  });

  document.getElementById("resetBtn").addEventListener("click", function () {
    searchQuery = "";
    priorityFilter = "all";
    document.getElementById("searchInput").value = "";
    document.getElementById("filterPriority").value = "all";
    render();
  });

  // İlk render
  render();
})();
