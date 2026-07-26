const STORAGE_KEY = 'kanban_tasks';
let tasks = [];
let editingId = null;
let nextId = 1;
const columns = ['todo', 'inprogress', 'done'];

const todoList = document.getElementById('todoList');
const inprogressList = document.getElementById('inprogressList');
const doneList = document.getElementById('doneList');
const searchInput = document.getElementById('searchInput');
const filterPriority = document.getElementById('filterPriority');
const resetBtn = document.getElementById('resetBtn');
const addTaskBtn = document.getElementById('addTaskBtn');
const modalOverlay = document.getElementById('modalOverlay');
const modalTitle = document.getElementById('modalTitle');
const taskForm = document.getElementById('taskForm');
const taskTitle = document.getElementById('taskTitle');
const taskDesc = document.getElementById('taskDesc');
const taskPriority = document.getElementById('taskPriority');
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');

function loadTasks() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        try {
            tasks = JSON.parse(stored);
            nextId = tasks.reduce((max, t) => Math.max(max, t.id), 0) + 1;
        } catch {
            tasks = [];
        }
    } else {
        tasks = [
            { id: nextId++, title: 'DEVJOINT', desc: 'M07 15', priority: 'high', column: 'inprogress' },
            { id: nextId++, title: 'Aşağı Deviont', desc: 'M07 15', priority: 'low', column: 'todo' },
            { id: nextId++, title: 'DEVJOINT', desc: 'M07 15', priority: 'medium', column: 'done' }
        ];
    }
    renderAll();
}

function saveTasks() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

function renderAll() {
    const search = searchInput.value.trim().toLowerCase();
    const priorityFilter = filterPriority.value;
    const filtered = tasks.filter(task => {
        const matchTitle = task.title.toLowerCase().includes(search);
        const matchPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        return matchTitle && matchPriority;
    });
    columns.forEach(col => {
        const list = document.getElementById(col + 'List');
        const colTasks = filtered.filter(t => t.column === col);
        list.innerHTML = colTasks.map(task => createTaskCard(task)).join('');
    });
    attachDragEvents();
    saveTasks();
}

function createTaskCard(task) {
    const priorityLabel = { low: 'Aşağı', medium: 'Orta', high: 'Yüksək' };
    return `
        <div class="task-card" draggable="true" data-id="${task.id}" data-column="${task.column}">
            <div class="title">${escapeHtml(task.title)}</div>
            <div class="desc">${escapeHtml(task.desc || '')}</div>
            <div class="meta">
                <span class="priority-badge priority-${task.priority}">${priorityLabel[task.priority]}</span>
                <div class="actions">
                    <button class="edit-btn" data-id="${task.id}">✎</button>
                    <button class="delete-btn" data-id="${task.id}">✕</button>
                </div>
            </div>
        </div>
    `;
}

function escapeHtml(text) {
    if (!text) return '';
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
    return text.replace(/[&<>"']/g, m => map[m]);
}

function attachDragEvents() {
    document.querySelectorAll('.task-card').forEach(card => {
        card.addEventListener('dragstart', handleDragStart);
        card.addEventListener('dragend', handleDragEnd);
        card.addEventListener('click', handleCardClick);
    });
    document.querySelectorAll('.task-list').forEach(list => {
        list.addEventListener('dragover', handleDragOver);
        list.addEventListener('dragenter', handleDragEnter);
        list.addEventListener('dragleave', handleDragLeave);
        list.addEventListener('drop', handleDrop);
    });
}

let draggedId = null;

function handleDragStart(e) {
    draggedId = parseInt(this.dataset.id);
    this.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.id);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    document.querySelectorAll('.task-list').forEach(l => l.classList.remove('drop-over'));
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    this.classList.add('drop-over');
}

function handleDragLeave(e) {
    this.classList.remove('drop-over');
}

function handleDrop(e) {
    e.preventDefault();
    this.classList.remove('drop-over');
    const id = parseInt(e.dataTransfer.getData('text/plain'));
    const newColumn = this.id.replace('List', '');
    const task = tasks.find(t => t.id === id);
    if (task && task.column !== newColumn) {
        task.column = newColumn;
        renderAll();
    }
}

function handleCardClick(e) {
    const target = e.target.closest('button');
    if (!target) return;
    const id = parseInt(target.dataset.id);
    if (target.classList.contains('edit-btn')) {
        openEditModal(id);
    } else if (target.classList.contains('delete-btn')) {
        deleteTask(id);
    }
}

function addTask(title, desc, priority, column = 'todo') {
    const newTask = {
        id: nextId++,
        title: title.trim(),
        desc: desc.trim(),
        priority: priority,
        column: column
    };
    tasks.push(newTask);
    renderAll();
}

function deleteTask(id) {
    if (confirm('Tapşırığı silmək istəyirsiniz?')) {
        tasks = tasks.filter(t => t.id !== id);
        renderAll();
    }
}

function updateTask(id, title, desc, priority) {
    const task = tasks.find(t => t.id === id);
    if (task) {
        task.title = title.trim();
        task.desc = desc.trim();
        task.priority = priority;
        renderAll();
    }
}

function openAddModal() {
    editingId = null;
    modalTitle.textContent = 'Yeni Tapşırıq';
    taskForm.reset();
    taskPriority.value = 'medium';
    modalOverlay.classList.add('open');
}

function openEditModal(id) {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    editingId = id;
    modalTitle.textContent = 'Tapşırığı redaktə et';
    taskTitle.value = task.title;
    taskDesc.value = task.desc;
    taskPriority.value = task.priority;
    modalOverlay.classList.add('open');
}

function closeModal() {
    modalOverlay.classList.remove('open');
    editingId = null;
}

taskForm.addEventListener('submit', function (e) {
    e.preventDefault();
    const title = taskTitle.value.trim();
    const desc = taskDesc.value.trim();
    const priority = taskPriority.value;
    if (!title) {
        alert('Başlıq daxil edin!');
        return;
    }
    if (editingId !== null) {
        updateTask(editingId, title, desc, priority);
    } else {
        const duplicate = tasks.some(t => t.title === title && t.column === 'todo');
        if (duplicate) {
            alert('Bu başlıqlı tapşırıq artıq "Gözləmədə" sütununda var!');
            return;
        }
        addTask(title, desc, priority);
    }
    closeModal();
});

cancelBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', function (e) {
    if (e.target === this) closeModal();
});
addTaskBtn.addEventListener('click', openAddModal);
searchInput.addEventListener('input', renderAll);
filterPriority.addEventListener('change', renderAll);
resetBtn.addEventListener('click', function () {
    searchInput.value = '';
    filterPriority.value = 'all';
    renderAll();
});

loadTasks();
