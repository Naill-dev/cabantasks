(function () {
  "use strict";

  var STORAGE_KEY = "kanban-tasks-v1";
  var STATUSES = ["todo", "progress", "done"];
  var ACCENT_BY_PRIORITY = { low: "accent-teal", med: "accent-gold", high: "accent-rose" };

  var tasks = loadTasks();
  var draggedId = null;
  var nextSeq = computeNextSeq();
  var searchQuery = "";
  var priorityFilter = "all";

  function computeNextSeq() {
    var max = 0;
    tasks.forEach(function (t) {
      var n = parseInt((t.code || "").replace(/\D/g, ""), 10);
      if (!isNaN(n)) max = Math.max(max, n);
    });
    return max + 1;
  }

  function loadTasks() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seedTasks();
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : seedTasks();
    } catch (e) {
      console.warn("Board oxuna bilmədi, sıfırdan başlanır.", e);
      return seedTasks();
    }
  }

  function seedTasks() {
    return [
      { id: uid(), code: "TSK-001", text: "Layihə qovluğunu qur (html/css/js)", status: "done", priority: "low" },
      { id: uid(), code: "TSK-002", text: "Sürükləmə (drag-and-drop) məntiqini yaz", status: "progress", priority: "high" },
      { id: uid(), code: "TSK-003", text: "localStorage ilə saxlamanı bağla", status: "todo", priority: "med" }
    ];
  }

  function uid() {
    return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
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
      var matchesQuery = !searchQuery || t.text.toLowerCase().indexOf(searchQuery) !== -1;
      var matchesPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchesQuery && matchesPriority;
    });
  }

  function render() {
    STATUSES.forEach(function (status) {
      var list = document.querySelector('[data-list="' + status + '"]');
      var countEl = document.querySelector('[data-count="' + status + '"]');
      var items = tasks.filter(function (t) { return t.status === status; });
      items = applyFilters(items);

      list.innerHTML = "";
      countEl.textContent = items.length;

      if (items.length === 0) {
        var hint = document.createElement("div");
        hint.className = "empty-hint";
        hint.textContent = "Bu sütunda tapşırıq yoxdur";
        list.appendChild(hint);
      } else {
        items.forEach(function (task) { list.appendChild(renderCard(task)); });
      }

      renderFoot(status);
    });
    renderStats();
  }

  function renderStats() {
    var total = tasks.length;
    var done = tasks.filter(function (t) { return t.status === "done"; }).length;
    var statsEl = document.getElementById("boardStats");
    if (statsEl) {
      statsEl.innerHTML =
        "<span>Cəmi: <b>" + total + "</b></span><span>Bitmiş: <b>" + done + "</b></span>";
    }
  }

  function renderCard(task) {
    var card = document.createElement("div");
    card.className = "card " + (ACCENT_BY_PRIORITY[task.priority] || "");
    card.draggable = true;
    card.dataset.id = task.id;

    var top = document.createElement("div");
    top.className = "card-top";

    var code = document.createElement("span");
    code.className = "card-id";
    code.textContent = task.code;

    var prio = document.createElement("span");
    prio.className = "priority " + task.priority;
    prio.textContent = task.priority;

    top.appendChild(code);
    top.appendChild(prio);

    var text = document.createElement("div");
    text.className = "card-text";
    text.textContent = task.text;
    text.title = "Redaktə etmək üçün klikləyin";

    var actions = document.createElement("div");
    actions.className = "card-actions";
    actions.appendChild(iconButton("edit", function () { startEdit(text, task); }));
    actions.appendChild(iconButton("delete", function () { deleteTask(task.id); }));

    card.appendChild(top);
    card.appendChild(text);
    card.appendChild(actions);

    card.addEventListener("dragstart", function (e) {
      draggedId = task.id;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", task.id);
    });

    card.addEventListener("dragend", function () {
      card.classList.remove("dragging");
      draggedId = null;
    });

    return card;
  }

  function iconButton(kind, onClick) {
    var btn = document.createElement("button");
    btn.className = "icon-btn";
    btn.type = "button";
    btn.title = kind === "edit" ? "Redaktə et" : "Sil";
    btn.innerHTML = kind === "edit"
      ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="M19 6l-1 14H6L5 6"/></svg>';
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      onClick();
    });
    return btn;
  }

  function startEdit(textEl, task) {
    textEl.contentEditable = "true";
    textEl.focus();
    placeCursorAtEnd(textEl);

    function finish(doSave) {
      textEl.contentEditable = "false";
      textEl.removeEventListener("blur", onBlur);
      textEl.removeEventListener("keydown", onKey);
      if (doSave) {
        var newText = textEl.textContent.trim();
        if (newText) {
          task.text = newText;
          persistAndRender();
        } else {
          textEl.textContent = task.text;
        }
      } else {
        textEl.textContent = task.text;
      }
    }

    function onBlur() {
      finish(true);
    }

    function onKey(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        textEl.blur();
      }
      if (e.key === "Escape") {
        finish(false);
      }
    }

    textEl.addEventListener("blur", onBlur);
    textEl.addEventListener("keydown", onKey);
  }

  function placeCursorAtEnd(el) {
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
  }

  function deleteTask(id) {
    if (confirm("Tapşırığı silmək istədiyinizə əminsiniz?")) {
      tasks = tasks.filter(function (t) { return t.id !== id; });
      persistAndRender();
    }
  }

  function renderFoot(status) {
    var foot = document.querySelector('[data-foot="' + status + '"]');
    foot.innerHTML = "";
    var trigger = document.createElement("button");
    trigger.className = "new-task-trigger";
    trigger.type = "button";
    trigger.textContent = "+ Tapşırıq əlavə et";
    trigger.addEventListener("click", function () { showAddForm(status); });
    foot.appendChild(trigger);
  }

  function showAddForm(status) {
    var foot = document.querySelector('[data-foot="' + status + '"]');
    foot.innerHTML = "";

    var form = document.createElement("div");
    form.className = "add-form";

    var textarea = document.createElement("textarea");
    textarea.placeholder = "Tapşırığı yazın…";
    textarea.rows = 2;

    var row = document.createElement("div");
    row.className = "add-form-row";

    var select = document.createElement("select");
    select.className = "prio-select";
    ["low", "med", "high"].forEach(function (p) {
      var opt = document.createElement("option");
      opt.value = p;
      opt.textContent = p.toUpperCase();
      if (p === "med") opt.selected = true;
      select.appendChild(opt);
    });

    var btnRow = document.createElement("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "6px";

    var cancelBtn = document.createElement("button");
    cancelBtn.className = "icon-btn cancel-btn";
    cancelBtn.type = "button";
    cancelBtn.textContent = "Ləğv et";
    cancelBtn.addEventListener("click", function () { renderFoot(status); });

    var addBtn = document.createElement("button");
    addBtn.className = "add-btn-mini";
    addBtn.type = "button";
    addBtn.textContent = "Əlavə et";
    addBtn.addEventListener("click", function () {
      commitNewTask(textarea.value, select.value, status);
    });

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(addBtn);
    row.appendChild(select);
    row.appendChild(btnRow);
    form.appendChild(textarea);
    form.appendChild(row);
    foot.appendChild(form);

    textarea.focus();
    textarea.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        commitNewTask(textarea.value, select.value, status);
      }
    });
  }

  function commitNewTask(text, priority, status) {
    var trimmed = (text || "").trim();
    if (!trimmed) return;

    var isDuplicate = tasks.some(function (t) {
      return t.status === status && t.text.trim().toLowerCase() === trimmed.toLowerCase();
    });

    if (isDuplicate) {
      alert("Bu tapşırıq artıq bu sütunda mövcuddur.");
      return;
    }

    tasks.push({
      id: uid(),
      code: "TSK-" + String(nextSeq++).padStart(3, "0"),
      text: trimmed,
      status: status,
      priority: priority
    });
    persistAndRender();
    renderFoot(status);
  }

  function persistAndRender() {
    save();
    render();
  }


  document.querySelectorAll(".lane").forEach(function (lane) {
    lane.addEventListener("dragover", function (e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      lane.classList.add("drag-over");
    });

    lane.addEventListener("dragleave", function () {
      lane.classList.remove("drag-over");
    });

    lane.addEventListener("drop", function (e) {
      e.preventDefault();
      lane.classList.remove("drag-over");
      var id = e.dataTransfer.getData("text/plain") || draggedId;
      if (!id) return;
      var task = tasks.find(function (t) { return t.id === id; });
      if (task && task.status !== lane.dataset.status) {
        task.status = lane.dataset.status;
        persistAndRender();
      }
    });
  });


  var spotlight = document.getElementById("spotlight");
  if (spotlight) {
    window.addEventListener("mousemove", function (e) {
      spotlight.style.setProperty("--mx", e.clientX + "px");
      spotlight.style.setProperty("--my", e.clientY + "px");
    });
  }


  var field = document.getElementById("particles");
  if (field) {
    var PARTICLE_COUNT = 22;
    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var p = document.createElement("i");
      p.style.left = (Math.random() * 100) + "vw";
      var duration = 10 + Math.random() * 14;
      p.style.animationDuration = duration + "s";
      p.style.animationDelay = (Math.random() * duration) + "s";
      p.style.width = p.style.height = (2 + Math.random() * 2) + "px";
      if (Math.random() > 0.6) p.style.background = "var(--teal)";
      field.appendChild(p);
    }
  }

  
  var searchInput = document.getElementById("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", function (e) {
      searchQuery = e.target.value.trim().toLowerCase();
      render();
    });
  }

  var priorityFilterEl = document.getElementById("priorityFilter");
  if (priorityFilterEl) {
    priorityFilterEl.addEventListener("change", function (e) {
      priorityFilter = e.target.value;
      render();
    });
  }

  render();
})();
