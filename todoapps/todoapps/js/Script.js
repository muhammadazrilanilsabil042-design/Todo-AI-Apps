// Daftarkan Service Worker untuk fitur PWA Offline
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('PWA Service Worker terdaftar!'))
            .catch(err => console.log('Gagal mendaftar Service Worker:', err));
    });
}

let todos = [];
let subtasks = [];
let currentFilter = 'Semua';
let taskToDeleteId = null;
let taskToEditId = null;
let taskChart = null;
const RENDER_EVENT = 'render-todo';

const SAVED_EVENT = 'saved-todo';
const STORAGE_KEY = 'TODO_APPS';

function addTodo() {
    const titleElement = document.getElementById('title');
    const dateElement = document.getElementById('date');
    const priorityElement = document.getElementById('priority');
    const routineElement = document.getElementById('is-routine');
    
    // Mencegah error jika elemen HTML belum termuat
    if (!titleElement || !dateElement) return;

    const textTodo = titleElement.value;
    const timestamp = dateElement.value;
    const priority = priorityElement ? priorityElement.value : 'Sedang';
    const isRoutine = routineElement ? routineElement.checked : false;

    // Mencegah input kosong
    if (textTodo.trim() === '') {
        showToast('Judul tugas tidak boleh kosong! ⚠️');
        return;
    }

    const generateID = generateId();
    const todoObject = generateTodoObject(generateID, textTodo, timestamp, false, priority, isRoutine);
    
    todos.push(todoObject);
    document.dispatchEvent(new Event(RENDER_EVENT));
    saveDate();

    addActivityLog(`Menambah tugas: "${textTodo}"`);
    showToast('Tugas baru berhasil ditambahkan! ✅');
    document.getElementById('form').reset();
}

document.addEventListener('DOMContentLoaded',function(){
    checkStreakStatus();
    requestNotificationPermission();
    const submitForm = document.getElementById('form');
    submitForm.addEventListener('submit',function(event){
      event.preventDefault();
      addTodo();
     
    });
     if(isStorageExist()){
        loadDataFromStorage();
        resetRecurringTasks();
      }

const btnClear = document.getElementById('clear-completed');
if (btnClear) {
    btnClear.addEventListener('click', function() {
        if (confirm('Yakin ingin menghapus semua tugas yang sudah selesai?')) {
            // Saring array: hanya simpan yang isCompleted == false
            todos = todos.filter(todoItem => !todoItem.isCompleted);
            document.dispatchEvent(new Event(RENDER_EVENT));
            saveDate();
        }
    });
}

        // Logika klik untuk tombol filter
    const filterButtons = document.querySelectorAll('.btn-filter');
    for (const btn of filterButtons) {
        btn.addEventListener('click', function() {
            // Hapus class 'active' dari semua tombol
            for (const b of filterButtons) {
                b.classList.remove('active');
            }
            // Tambahkan class 'active' ke tombol yang baru saja diklik
            this.classList.add('active');
            
            // Simpan nilai filternya dan perbarui layar
            currentFilter = this.getAttribute('data-filter');
            document.dispatchEvent(new Event(RENDER_EVENT));
        });
    }

    const modal = document.getElementById('custom-modal');
    const btnCancel = document.getElementById('btn-cancel-delete');
    const btnConfirm = document.getElementById('btn-confirm-delete');

    if (btnCancel && btnConfirm) {
        // Jika tombol Batal ditekan
        btnCancel.addEventListener('click', function() {
            modal.classList.remove('show');
            taskToDeleteId = null; 
        });

        // Jika tombol Ya, Hapus ditekan
        btnConfirm.addEventListener('click', function() {
            if (taskToDeleteId !== null) {
                todos.splice(taskToDeleteId, 1);
                playTrashSound();
                document.dispatchEvent(new Event(RENDER_EVENT));
                saveDate();
                modal.classList.remove('show');
                taskToDeleteId = null; 
                showToast('Tugas dihapus! 🗑️');
            }

            addActivityLog('Menghapus salah satu tugas 🗑️');
        });
    }
    const editModal = document.getElementById('edit-modal');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnSaveEdit = document.getElementById('btn-save-edit');

    if (btnCancelEdit && btnSaveEdit) {
        // Tombol Batal ditekan
        btnCancelEdit.addEventListener('click', function() {
            editModal.classList.remove('show');
            taskToEditId = null; // Lupakan memori
        });

        // Tombol Simpan ditekan
        btnSaveEdit.addEventListener('click', function() {
            if (taskToEditId !== null) {
                // Ambil nilai baru dari form modal
                const newTitle = document.getElementById('edit-title').value;
                const newDate = document.getElementById('edit-date').value;
                const newPriority = document.getElementById('edit-priority').value;

                // Cek agar nama tugas tidak kosong
                if (newTitle.trim() === '') {
                    showToast('Nama tugas tidak boleh kosong! ⚠️');
                    return; // Hentikan proses jika kosong
                }

                // Cari tugas di array, dan timpa datanya
                const targetTodo = findTodo(taskToEditId);
                if (targetTodo !== null) {
                    targetTodo.task = newTitle;
                    targetTodo.timestamp = newDate;
                    targetTodo.priority = newPriority;

                    document.dispatchEvent(new Event(RENDER_EVENT));
                    saveDate();
                    
                    editModal.classList.remove('show');
                    taskToEditId = null;
                    showToast('Tugas berhasil diperbarui! 📝');
                }
            }
        });
    }
    
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
        btnExport.addEventListener('click', function() {
            // 1. Ubah array todos menjadi format teks JSON yang rapi
            const dataJSON = JSON.stringify(todos, null, 2);
            
            // 2. Bungkus teks tersebut ke dalam Blob (kapsul file)
            const blob = new Blob([dataJSON], { type: 'application/json' });
            
            // 3. Buat URL sementara untuk kapsul file tersebut
            const url = URL.createObjectURL(blob);
            
            // 4. Buat elemen link <a> bayangan (tidak terlihat di layar)
            const a = document.createElement('a');
            a.href = url;
            a.download = 'tugas_azril.json'; // Nama file yang akan terunduh
            
            // 5. Paksa browser mengklik link tersebut, lalu langsung hapus
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            // 6. Bersihkan memori agar browser tidak berat
            URL.revokeObjectURL(url);
            
            showToast('Data berhasil diunduh! 📁');
        });
    }

    // === LOGIKA IMPORT DATA (FILE READER) ===
    const btnImport = document.getElementById('btn-import');
    const importFile = document.getElementById('import-file');

    if (btnImport && importFile) {
        // 1. Saat tombol hijau diklik, alihkan kliknya ke input file yang tersembunyi
        btnImport.addEventListener('click', function() {
            importFile.click();
        });

        // 2. Saat file JSON dipilih dari komputer
        importFile.addEventListener('change', function(event) {
            const file = event.target.files[0];
            
            if (file) {
                const reader = new FileReader();
                
                // 3. Saat file selesai dibaca oleh browser
                reader.onload = function(e) {
                    try {
                        const importedData = JSON.parse(e.target.result);
                        
                        // 4. Pastikan file yang dimasukkan benar-benar array tugas
                        if (Array.isArray(importedData)) {
                            // Suntikkan data baru ke array tugas lama
                            for (const todo of importedData) {
                                todos.push(todo);
                            }
                            
                            // Render ulang layar dan simpan ke LocalStorage
                            document.dispatchEvent(new Event(RENDER_EVENT));
                            saveDate();
                            showToast('Data berhasil di-import! 📥');
                        } else {
                            showToast('Format file JSON tidak sesuai! ❌');
                        }
                    } catch (error) {
                        showToast('Gagal membaca file JSON! ❌');
                    }
                };
                
                // Mulai proses membaca file sebagai teks
                reader.readAsText(file);
                
                // Reset value agar kamu bisa import file yang sama dua kali jika mau
                importFile.value = '';
            }
        });
    }

    // === LOGIKA POMODORO TIMER ===
    let waktuTersisa = 1500; // 25 Menit dalam hitungan detik
    let timerBerjalan = null;

    const btnStart = document.getElementById('btn-start-timer');
    const btnPause = document.getElementById('btn-pause-timer');
    const btnReset = document.getElementById('btn-reset-timer');
    const teksTimer = document.getElementById('timer-display');

    function updateTampilanTimer() {
        const menit = Math.floor(waktuTersisa / 60);
        const detik = waktuTersisa % 60;
        teksTimer.innerText = `${menit}:${detik < 10 ? '0' : ''}${detik}`;
    }

    if (btnStart && btnPause && btnReset) {
        // Tombol Mulai
        btnStart.addEventListener('click', function() {
            if (timerBerjalan !== null) return; // Mencegah timer makin cepat kalau diklik berkali-kali

            timerBerjalan = setInterval(function() {
                if (waktuTersisa > 0) {
                    waktuTersisa--;
                    updateTampilanTimer();
                } else {
                    clearInterval(timerBerjalan);
                    timerBerjalan = null;
                    playAlarmSound();
                    showToast('Waktu fokus habis! Istirahat dulu yuk! 🍅');
                    sendDesktopNotification("Waktu Habis! 🍅", "Sesi Pomodoro selesai. Kinerja yang bagus, waktunya istirahat sejenak!");
                }
            }, 1000);
        });

        // Tombol Jeda (Pause)
        btnPause.addEventListener('click', function() {
            clearInterval(timerBerjalan);
            timerBerjalan = null;
            showToast('Timer dijeda ⏸️');
        });

        // Tombol Reset
        btnReset.addEventListener('click', function() {
            clearInterval(timerBerjalan);
            timerBerjalan = null;
            waktuTersisa = 1500;
            updateTampilanTimer();
            showToast('Timer di-reset ke 25 menit 🔄');
        });
    }

    renderActivityLog();

    const btnClearLog = document.getElementById('btn-clear-log');
    if (btnClearLog) {
        btnClearLog.addEventListener('click', function() {
            localStorage.removeItem(LOG_KEY);
            renderActivityLog();
            showToast('Riwayat aktivitas dibersihkan! 🧹');
        });
    }

    // === LOGIKA MODAL POMODORO & RIWAYAT (NAVBAR) ===
    const btnPomodoro = document.getElementById('btn-pomodoro');
    const modalPomodoro = document.getElementById('modal-pomodoro');
    const btnTutupPomodoro = document.getElementById('tutup-pomodoro');

    const btnRiwayat = document.getElementById('btn-riwayat');
    const modalRiwayat = document.getElementById('modal-riwayat');
    const btnTutupRiwayat = document.getElementById('tutup-riwayat');

    // Buka & Tutup Modal Pomodoro
    if (btnPomodoro && modalPomodoro) {
        btnPomodoro.addEventListener('click', () => modalPomodoro.classList.add('show'));
    }
    if (btnTutupPomodoro) {
        btnTutupPomodoro.addEventListener('click', () => modalPomodoro.classList.remove('show'));
    }

    // Buka & Tutup Modal Riwayat
    if (btnRiwayat && modalRiwayat) {
        btnRiwayat.addEventListener('click', () => modalRiwayat.classList.add('show'));
    }
    if (btnTutupRiwayat) {
        btnTutupRiwayat.addEventListener('click', () => modalRiwayat.classList.remove('show'));
    }

    // Tutup modal jika area gelap di luar modal diklik
    window.addEventListener('click', (event) => {
        if (event.target === modalPomodoro) modalPomodoro.classList.remove('show');
        if (event.target === modalRiwayat) modalRiwayat.classList.remove('show');
    });
    // =============================
});


function generateId(){
    return +new Date();
}

function generateTodoObject(id,task,timestamp,isCompleted,priority,isRoutine = false){
    return{
        id,
        task,
        timestamp,
        isCompleted,
        priority,
        isRoutine,
        subtasks: []
    }
}

document.addEventListener(RENDER_EVENT,function(){
    const uncompletedTODOList = document.getElementById('todos');
    uncompletedTODOList.innerHTML = '';
  
    const completedTODOList = document.getElementById('completed-todos');
    completedTODOList.innerHTML = '';

    // Logika pencarian yang baru ditambahkan
    const searchElement = document.getElementById('searchTodo');
    const searchText = searchElement ? searchElement.value.toLowerCase() : '';
  
    // Mengurutkan dari tangga terkecil (terdekat) ke terbesar
    //todos.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    for (const todoItem of todos){
        // Cek kecocokan pencarian
        const matchSearch = todoItem.task.toLowerCase().includes(searchText);
        
        // Cek kecocokan tab filter (jika 'Semua', tampilkan. Jika tidak, cocokkan dengan prioritas tugas)
        const matchFilter = (currentFilter === 'Semua') || (todoItem.priority === currentFilter);

        // Hanya tampilkan jika cocok dengan pencarian DAN cocok dengan tab filter
        if (matchSearch && matchFilter) {
            const todoElement = makeTodo(todoItem);
            if(!todoItem.isCompleted){
                uncompletedTODOList.append(todoElement);
            } else {
                completedTODOList.append(todoElement);
            }
        }
    }

    // Mengecek jika daftar tugas belum selesai kosong
    if(uncompletedTODOList.innerHTML === ''){
        uncompletedTODOList.innerHTML = '<p class="text-center" style="color: #a0aabf; margin: 24px 0;">Belum ada tugas nih. Waktunya bersantai! ☕</p>';
    }

    // Mengecek jika daftar tugas sudah selesai kosong
    if(completedTODOList.innerHTML === ''){
        completedTODOList.innerHTML = '<p class="text-center" style="color: #a0aabf; margin: 24px 0;">Belum ada tugas yang diselesaikan. Tetap semangat! 🚀</p>';
    }
    updateProgress();
    updateChart();
});

function makeTodo(todoObject){
    const textTitle = document.createElement('h2');
    textTitle.innerText = todoObject.task;

    const textTimestamp = document.createElement('p');
    textTimestamp.innerText = todoObject.timestamp;

    const textPriority = document.createElement('span');
    // Jika tugas lama belum ada prioritasnya, set default ke "Sedang"
    const prioValue = todoObject.priority || 'Sedang'; 
    textPriority.innerText = `Prioritas: ${prioValue}`;
    textPriority.classList.add('priority-label', `priority-${prioValue}`);

    const textContainer = document.createElement('div');
    textContainer.classList.add('inner');
    textContainer.append(textPriority,textTitle,textTimestamp);

    // === LOGIKA SUB-TASKS (ANAK TUGAS) ===
    const subtasks = todoObject.subtasks || [];
    
    const subtaskContainer = document.createElement('div');
    subtaskContainer.classList.add('subtask-container');

    // 1. Hitung Progress Sub-task
    const totalSub = subtasks.length;
    const completedSub = subtasks.filter(s => s.isCompleted).length;
    const subPercent = totalSub > 0 ? Math.round((completedSub / totalSub) * 100) : 0;

    // 2. Tampilkan Mini Progress Bar jika ada sub-task
    if (totalSub > 0) {
        const miniProgress = document.createElement('div');
        miniProgress.classList.add('subtask-progress-wrapper');
        miniProgress.innerHTML = `
            <div class="subtask-progress-bar" style="width: ${subPercent}%"></div>
            <span class="subtask-progress-text">${completedSub}/${totalSub} Anak Tugas (${subPercent}%)</span>
        `;
        subtaskContainer.append(miniProgress);
    }

    // 3. Render Daftar Sub-task
    const subtaskList = document.createElement('ul');
    subtaskList.classList.add('subtask-list');

    subtasks.forEach((sub, index) => {
        const subLi = document.createElement('li');
        subLi.classList.add('subtask-item');
        if (sub.isCompleted) subLi.classList.add('completed');

        subLi.innerHTML = `
            <label>
                <input type="checkbox" ${sub.isCompleted ? 'checked' : ''}>
                <span>${sub.text}</span>
            </label>
            <button class="btn-delete-sub" title="Hapus anak tugas">✕</button>
        `;

        // Event Centang Sub-task
        const checkbox = subLi.querySelector('input');
        checkbox.addEventListener('change', function() {
            sub.isCompleted = checkbox.checked;
            document.dispatchEvent(new Event(RENDER_EVENT));
            saveDate();
        });

        // Event Hapus Sub-task
        const btnDeleteSub = subLi.querySelector('.btn-delete-sub');
        btnDeleteSub.addEventListener('click', function() {
            subtasks.splice(index, 1);
            document.dispatchEvent(new Event(RENDER_EVENT));
            saveDate();
        });

        subtaskList.append(subLi);
    });

    // 4. Form Cepat Tambah Sub-task di Dalam Kartu
    const addSubForm = document.createElement('form');
    addSubForm.classList.add('subtask-form');

    addSubForm.innerHTML = `
        <input type="text" placeholder="+ Tambah anak tugas..." required style="flex: 1;">
        <button type="submit">Tambah</button>
        <button type="button" class="btn-ai-sub" title="Generate dengan AI" style="background: #a855f7; border: none; border-radius: 8px; color: white; font-weight: bold; cursor: pointer; padding: 0 12px;">⚡</button>
    `;
    
    addSubForm.addEventListener('submit', function(e) {
        e.preventDefault();
        const input = addSubForm.querySelector('input');
        const newSubText = input.value.trim();
        if (newSubText) {
            if (!todoObject.subtasks) todoObject.subtasks = [];
            todoObject.subtasks.push({
                id: +new Date(),
                text: newSubText,
                isCompleted: false
            });
            document.dispatchEvent(new Event(RENDER_EVENT));
            saveDate();
        }
    });

    const btnAiSub = addSubForm.querySelector('.btn-ai-sub');
    btnAiSub.addEventListener('click', async function() {
        const originalText = btnAiSub.innerHTML;
        btnAiSub.innerHTML = '⏳';
        btnAiSub.disabled = true;
        showToast('AI sedang menyusun langkah operasional...');

        const prompt = `Berikan 3 sampai 4 langkah operasional spesifik untuk menyelesaikan tugas utama ini: "${todoObject.task}". Kembalikan HANYA format JSON array of strings murni tanpa markdown (tanpa \`\`\`json). Contoh: ["Siapkan alat", "Cek harga", "Eksekusi"]`;

        try {
            const response = await fetch('/.netlify/functions/gemini', {
               method: "POST",
               headers: { "Content-Type": "application/json" },
               body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
            });
            
            const data = await response.json();
            let textResult = data.candidates[0].content.parts[0].text;
            const cleanJson = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
            const aiSubTasks = JSON.parse(cleanJson);

            if (!todoObject.subtasks) todoObject.subtasks = [];
            
            // Masukkan hasil dari AI ke dalam array subtasks
            aiSubTasks.forEach(subText => {
                todoObject.subtasks.push({
                    id: +new Date() + Math.random(), // Agar ID unik
                    text: subText,
                    isCompleted: false
                });
            });

            document.dispatchEvent(new Event(RENDER_EVENT));
            saveDate();
            showToast('Langkah-langkah berhasil dibuat AI! ⚡');
        } catch (error) {
            console.error(error);
            showToast('Gagal terhubung ke AI. Coba lagi! ❌');
            btnAiSub.innerHTML = originalText;
            btnAiSub.disabled = false;
        }
    });

    subtaskContainer.append(subtaskList, addSubForm);
    textContainer.append(subtaskContainer);
    // ======================================

    const container = document.createElement('div');
    container.classList.add('item','shadow');
    container.append(textContainer);
    container.setAttribute('id',`todo-${todoObject.id}`);
    
    if(todoObject.isCompleted){
        const undoButton = document.createElement('button');
        undoButton.classList.add('undo-button');

        undoButton.addEventListener('click',function(){
            undoTaskFromCompleted(todoObject.id);
        });

        const trashButton = document.createElement('button');
        trashButton.classList.add('trash-button');

        trashButton.addEventListener('click',function(){
            removeTaskFromCompleted(todoObject.id);
        });

       
        container.append(undoButton,trashButton);
    }else{
        const editButton = document.createElement('button');
        editButton.innerText = '✏️'; 
        editButton.style.cursor = 'pointer';
        editButton.style.marginRight = '8px';

        editButton.style.background = 'transparent';
        editButton.style.border = 'none';

        editButton.addEventListener('click', function() {
            taskToEditId = todoObject.id; // Ingat tugas mana yang diedit
            
            // Isi otomatis form di modal dengan data lama
            document.getElementById('edit-title').value = todoObject.task;
            document.getElementById('edit-date').value = todoObject.timestamp;
            document.getElementById('edit-priority').value = todoObject.priority || 'Sedang';
            
            // Munculkan Modal
            const editModal = document.getElementById('edit-modal');
            editModal.classList.add('show');
        });

        const checkButton = document.createElement('button');
        checkButton.classList.add('check-button');
        checkButton.addEventListener('click',function(){
            addTaskToCompleted(todoObject.id);
        });

        container.append(checkButton,editButton);
    }

    const hariIni = new Date().toISOString().split('T')[0]; 
    if (todoObject.timestamp < hariIni && !todoObject.isCompleted) {
        container.style.border = '2px solid red';
    }
    return container;
}

function addTaskToCompleted(todoId){
    const todoTarget = findTodo(todoId);
    if(todoTarget == null) return;

    todoTarget.isCompleted = true;
    
    updateDailyStreak();

    addActivityLog(`Menyelesaikan tugas: "${todoTarget.task}"`);
    addWaterReward();

    if(typeof playPopSound === 'function') playPopSound(); 
    document.dispatchEvent(new Event(RENDER_EVENT));
    saveDate();
}

function findTodo(todoId){
    for(const todoItem of todos){
        if(todoItem.id === todoId){
            return todoItem;
        }
    }
    return null;
}


// Variabel penampung (wajib ditaruh tepat di atas fungsinya)

function removeTaskFromCompleted(todoId){
    const todoTarget = findTodoIndex(todoId);
    if(todoTarget === -1) return;

    // 1. Simpan ID tugas yang mau dihapus ke dalam ingatan
    taskToDeleteId = todoTarget;

    // 2. Munculkan Modal Kustom elegan buatanmu
    const modal = document.getElementById('custom-modal');
    modal.classList.add('show');
}

function undoTaskFromCompleted(todoId){
    const todoTarget = findTodo(todoId);

    if(todoTarget == null) return;

    addActivityLog(`Mengembalikan tugas: "${todoTarget.task}"`);

      todoTarget.isCompleted = false;
      document.dispatchEvent(new Event(RENDER_EVENT));
      saveDate();  
       
}

function findTodoIndex(todoId){
    for(const index in todos){
        if(todos[index].id === todoId){
            return index;
        }
    }
    return -1;
}

function saveDate(){
    if(isStorageExist()){
        const parsed = JSON.stringify(todos);
        localStorage.setItem(STORAGE_KEY,parsed);
        document.dispatchEvent(new Event(SAVED_EVENT));
    }
}

function isStorageExist(){
    if(typeof (Storage) === undefined){
        alert('Browser kamu tidak mendukung local storage');
        return false;
    }

    return true;
}

document.addEventListener(SAVED_EVENT,function(){
    console.log(localStorage.getItem(STORAGE_KEY));
});

function loadDataFromStorage(){
    const serializeData = localStorage.getItem(STORAGE_KEY);
    let Data = JSON.parse(serializeData);

    if(Data !== null){
        for(const todo of Data){
            todos.push(todo);
        }
    }
    document.dispatchEvent(new Event(RENDER_EVENT));
}    

function updateProgress() {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');

    if (!progressBar || !progressText) return;

    const totalTasks = todos.length;
    const completedCount = todos.filter(t => t.isCompleted).length;

    // Mencegah error jika belum ada tugas sama sekali
    let percentage = 0;
    if (totalTasks > 0) {
        percentage = Math.round((completedCount / totalTasks) * 100);
    }

    // Mengubah lebar CSS dan teks HTML
    progressBar.style.width = `${percentage}%`;
    progressText.innerText = `${percentage}% Selesai`;
}

const searchInput = document.getElementById('searchTodo');
if (searchInput) {
    searchInput.addEventListener('input', function() {
        document.dispatchEvent(new Event(RENDER_EVENT));
    });
}

const themeToggle = document.getElementById('theme-toggle');
if (themeToggle) { 
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        
        const isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('DARK_MODE', isDark);
    });
}

// Untuk membaca saat halaman dimuat (taruh di dalam DOMContentLoaded)
if (localStorage.getItem('DARK_MODE') === 'true') {
    document.body.classList.add('dark-mode');
}

function showToast(messege){
    const toast = document.getElementById('toast');
    toast.innerText = messege;

    toast.classList.add('show');

    setTimeout(function(){
        toast.classList.remove('show');
    },3000);
}

function updateChart() {
    const ctx = document.getElementById('taskChart');
    if (!ctx) return;

    // 1. Menghitung jumlah tugas di masing-masing prioritas
    const countTinggi = todos.filter(t => t.priority === 'Tinggi').length;
    // Jika tugas lama tidak ada prioritasnya, kita anggap 'Sedang'
    const countSedang = todos.filter(t => t.priority === 'Sedang' || !t.priority).length; 
    const countRendah = todos.filter(t => t.priority === 'Rendah').length;

    // 2. Hancurkan grafik lama jika sudah ada (mencegah grafik bertumpuk/glitch)
    if (taskChart !== null) {
        taskChart.destroy();
    }

    // 3. Gambar grafik diagram batang yang baru
    taskChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Tinggi 🔥', 'Sedang ⚡', 'Rendah 🍃'],
            datasets: [{
                label: 'Jumlah Tugas',
                data: [countTinggi, countSedang, countRendah],
                backgroundColor: [
                    'rgba(255, 48, 48, 0.8)',   // Merah transparan untuk Tinggi
                    'rgba(233, 173, 23, 0.8)',  // Kuning untuk Sedang
                    'rgba(27, 201, 201, 0.8)'   // Hijau untuk Rendah
                ],
                borderColor: [
                    '#e43232',
                    '#ac8525',
                    '#1fa7a73a'
                ],
                borderWidth: 2,
                borderRadius: 8 // Membuat ujung batangnya membulat elegan
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 } // Angka di sumbu Y dibulatkan (1, 2, 3)
                }
            },
            plugins: {
                legend: { display: false } // Menyembunyikan kotak legenda agar lebih bersih
            }
        }
    });
}

// === SISTEM EFEK SUARA (WEB AUDIO SYNTHESIZER) ===
function playPopSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(400, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
}

function playTrashSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.2);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.2);
}

function playAlarmSound() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.2, 0.4].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime + delay);
        gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.15);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.15);
    });
}

// === LOGIKA DAILY STREAK ===
function checkStreakStatus() {
    const lastDate = localStorage.getItem('LAST_COMPLETED_DATE');
    const today = new Date().toISOString().split('T')[0];
    
    if (lastDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        // Jika terakhir nyelesain tugas sebelum kemarin, streak hangus
        if (lastDate !== today && lastDate !== yesterdayStr) {
            localStorage.setItem('STREAK_COUNT', '0');
        }
    }

    renderStreakUI();
}

function updateDailyStreak() {
    const today = new Date().toISOString().split('T')[0];
    const lastDate = localStorage.getItem('LAST_COMPLETED_DATE');
    let streakCount = parseInt(localStorage.getItem('STREAK_COUNT') || '0');

    if (lastDate === today) {
        return; // Hari ini sudah dicatat, tidak perlu bertambah lagi
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    if (lastDate === yesterdayStr) {
        // Berturut-turut dari kemarin!
        streakCount++;
        sendDesktopNotification("Streak Bertambah! 🔥", `Luar biasa! Kamu konsisten produktif selama ${streakCount} hari berturut-turut!`);
    } else {
        // Mulai baru dari 1 hari
        streakCount = 1;
        sendDesktopNotification("Awal yang Baru! 🚀", "Langkah pertama yang bagus! Selesaikan tugas besok untuk mulai membangun Streak.");
    }

    localStorage.setItem('STREAK_COUNT', streakCount.toString());
    localStorage.setItem('LAST_COMPLETED_DATE', today);
    renderStreakUI();
}

function renderStreakUI() {
    const streakEl = document.getElementById('streak-count');
    if (streakEl) {
        const count = localStorage.getItem('STREAK_COUNT') || '0';
        streakEl.innerText = `${count} Hari`;
    }
}

// === LOGIKA RIWAYAT AKTIVITAS (ACTIVITY LOG) ===
const LOG_KEY = 'ACTIVITY_LOGS';

function addActivityLog(actionText) {
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Tambah riwayat baru di urutan paling atas
    logs.unshift({
        text: actionText,
        time: timeString
    });

    // Batasi maksimal 15 riwayat terakhir agar tidak bikin penuh
    if (logs.length > 15) logs.pop();

    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    renderActivityLog();
}

function renderActivityLog() {
    const logList = document.getElementById('activity-log-list');
    if (!logList) return;

    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    logList.innerHTML = '';

    if (logs.length === 0) {
        logList.innerHTML = '<li class="activity-item" style="justify-content:center; color:#94a3b8;">Belum ada aktivitas tercatat.</li>';
        return;
    }

    logs.forEach(log => {
        const li = document.createElement('li');
        li.classList.add('activity-item');
        li.innerHTML = `
            <span class="activity-text">${log.text}</span>
            <span class="activity-time">${log.time}</span>
        `;
        logList.appendChild(li);
    });
}

// === SISTEM NOTIFIKASI DESKTOP ===
function requestNotificationPermission() {
    // Cek apakah browser mendukung fitur notifikasi
    if ("Notification" in window) {
        if (Notification.permission !== "granted" && Notification.permission !== "denied") {
            Notification.requestPermission(); // Meminta izin ke pengguna
        }
    }
}

function sendDesktopNotification(title, message) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, {
            body: message,
            icon: "https://cdn-icons-png.flaticon.com/512/1055/1055672.png" // Ikon kecil untuk notifikasi
        });
    }
}

// === LOGIKA TUGAS RUTIN (RECURRING HABITS) ===
function resetRecurringTasks() {
    const today = new Date().toISOString().split('T')[0];
    const lastLogin = localStorage.getItem('LAST_LOGIN');

    if (lastLogin !== today) {
        let isUpdated = false;

        // Loop untuk memeriksa semua tugas
        for (const todoItem of todos) {
            // Jika tugas adalah rutinitas DAN sudah selesai kemarin
            if (todoItem.isRoutine === true && todoItem.isCompleted === true) {
                todoItem.isCompleted = false; // Kembalikan ke daftar belum selesai
                todoItem.timestamp = today;   // Perbarui tanggal deadline jadi hari ini
                isUpdated = true;
            }
        }
        
        // Simpan perubahan ke memori jika ada yang di-reset
        if (isUpdated) {
            saveDate();
            document.dispatchEvent(new Event(RENDER_EVENT));
        }

        // Catat hari ini agar tidak me-reset dua kali di hari yang sama
        localStorage.setItem('LAST_LOGIN', today);
    }
}

// === LOGIKA SIMULASI SINKRONISASI CLOUD (ASYNC/AWAIT) ===
document.addEventListener('DOMContentLoaded', function() {
    const btnSyncCloud = document.getElementById('btn-sync-cloud');

    if (btnSyncCloud) {
        // Kata kunci 'async' menandakan fungsi ini berjalan di latar belakang
        btnSyncCloud.addEventListener('click', async function() {
            // 1. Ubah tampilan tombol menjadi status "Loading"
            const originalText = btnSyncCloud.innerHTML;
            btnSyncCloud.innerHTML = 'Menyambungkan ke server... ⏳';
            btnSyncCloud.disabled = true; // Matikan tombol agar tidak di-klik 2 kali
            btnSyncCloud.style.opacity = '0.7';
            btnSyncCloud.style.cursor = 'not-allowed';

            try {
                // 2. SIMULASI JEDA JARINGAN INTERNET (2.5 Detik)
                // Di dunia nyata, ini adalah tempat untuk fungsi fetch() atau axios API
                await new Promise(function(resolve) {
                    setTimeout(resolve, 2500); 
                });

                // 3. Setelah 2.5 detik, ubah tampilan menjadi Sukses
                btnSyncCloud.innerHTML = 'Tersimpan di Cloud! ✅';
                btnSyncCloud.style.background = '#22c55e'; // Ubah warna jadi hijau sukses
                btnSyncCloud.style.borderColor = '#22c55e';
                
                if (typeof playPopSound === 'function') playPopSound();
                showToast('Data berhasil dicadangkan ke Cloud! ☁️');

                // 4. Kembalikan tombol ke kondisi semula setelah 2 detik
                setTimeout(() => {
                    btnSyncCloud.innerHTML = originalText;
                    btnSyncCloud.disabled = false;
                    btnSyncCloud.style.opacity = '1';
                    btnSyncCloud.style.cursor = 'pointer';
                    btnSyncCloud.style.background = '#6366f1';
                    btnSyncCloud.style.borderColor = '#6366f1';
                }, 2000);

            } catch (error) {
                // Jika terjadi error (misal internet putus)
                showToast('Gagal terhubung ke Cloud! Coba lagi. ❌');
                btnSyncCloud.innerHTML = originalText;
                btnSyncCloud.disabled = false;
            }
        });
    }
});

// === LOGIKA KEBUN VIRTUAL ===
let waterStock = parseInt(localStorage.getItem('WATER_STOCK') || '3');
let plantExp = parseInt(localStorage.getItem('PLANT_EXP') || '0');

function updatePlantUI() {
    const plantDisplay = document.getElementById('plant-display');
    const plantStatus = document.getElementById('plant-status');
    const plantProgress = document.getElementById('plant-progress');
    const waterStockEl = document.getElementById('water-stock');

    if (!plantDisplay) return;

    waterStockEl.innerText = waterStock;
    let percent = (plantExp % 5) * 20; // Setiap 5 exp naik tingkat
    plantProgress.style.width = `${percent}%`;

    // Evolusi Tanaman Berdasarkan EXP
    if (plantExp < 5) {
        plantDisplay.innerText = '🌱';
        plantStatus.innerText = `Fase: Benih Kecil (${plantExp}/5 Air)`;
    } else if (plantExp < 10) {
        plantDisplay.innerText = '🌿';
        plantStatus.innerText = `Fase: Tunas Tumbuh (${plantExp}/10 Air)`;
    } else if (plantExp < 15) {
        plantDisplay.innerText = '🌳';
        plantStatus.innerText = `Fase: Tanaman Berdaun (${plantExp}/15 Air)`;
    } else {
        plantDisplay.innerText = '🍅';
        plantStatus.innerText = `Selamat! Tanaman Berbuah & Panen! 🎉`;
    }
}

document.addEventListener('DOMContentLoaded', function() {
    updatePlantUI();

    const btnWater = document.getElementById('btn-water-plant');
    if (btnWater) {
        btnWater.addEventListener('click', function() {
            if (waterStock > 0) {
                waterStock--;
                plantExp++;
                localStorage.setItem('WATER_STOCK', waterStock);
                localStorage.setItem('PLANT_EXP', plantExp);
                updatePlantUI();
                showToast('Tanaman disiram! Tumbuh lebih sehat 💧🌱');
                if (typeof playPopSound === 'function') playPopSound();
            } else {
                showToast('Stok air habis! Selesaikan tugas untuk dapat air ⚠️');
            }
        });
    }
});

// Tambahkan fungsi ini di dalam fungsi saat tugas selesai (addTaskToCompleted)
function addWaterReward() {
    waterStock += 2; // Dapat 2 air setiap selesai tugas
    localStorage.setItem('WATER_STOCK', waterStock);
    updatePlantUI();
}

// === LOGIKA VOICE COMMAND (SPEECH RECOGNITION) ===
document.addEventListener('DOMContentLoaded', function() {
    const btnMic = document.getElementById('btn-mic');
    const titleInput = document.getElementById('title');

    // Cek apakah browser mendukung Web Speech API
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (btnMic && SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.lang = 'id-ID'; // Mengatur bahasa Indonesia
        recognition.interimResults = false;

        btnMic.addEventListener('click', function() {
            recognition.start();
            showToast('Mendengarkan... Silakan bicara 🎙️');
            btnMic.innerText = '🔴'; // Berubah jadi titik merah merekam
            btnMic.style.animation = 'pulse 1.5s infinite'; // Efek berdenyut
        });

        recognition.onresult = function(event) {
            const speechText = event.results[0][0].transcript;
            titleInput.value = speechText;
            showToast(`Suara terdeteksi: "${speechText}" ✍️`);
            resetMicButton();
        };

        recognition.onerror = function() {
            showToast('Gagal mengenali suara. Coba lagi! ❌');
            resetMicButton();
        };

        recognition.onend = function() {
            resetMicButton();
        };

        function resetMicButton() {
            btnMic.innerText = '🎙️';
            btnMic.style.animation = 'none';
        }
    }
});

// Tangkap elemen yang dibutuhkan
document.addEventListener('DOMContentLoaded', () => {
    const btnProfile = document.getElementById('btn-profile');
    const modalProfil = document.getElementById('modal-profil');
    const closeProfil = document.getElementById('close-profil');

    if (btnProfile && modalProfil) {
        btnProfile.addEventListener('click', () => {
            modalProfil.classList.add('show');
        });

        closeProfil.addEventListener('click', () => {
            modalProfil.classList.remove('show');
        });

        window.addEventListener('click', (event) => {
            if (event.target === modalProfil) {
                modalProfil.classList.remove('show');
            }
        });
    } else {
        console.log("Tombol atau modal tidak ditemukan. Cek ID di HTML!");
    }
});

// === LOGIKA SMART TASK AI (GEMINI) ===
document.addEventListener('DOMContentLoaded', function() {
    const btnAiSubmit = document.getElementById('btn-ai-submit');
    const aiInput = document.getElementById('ai-smart-input');

    if (btnAiSubmit && aiInput) {
        btnAiSubmit.addEventListener('click', async function() {
            const textRequest = aiInput.value.trim();
            if (!textRequest) {
                showToast('Ketik dulu tugasnya untuk AI! ⚠️');
                return;
            }

            // Ubah tampilan tombol saat proses loading
            const originalBtnText = btnAiSubmit.innerHTML;
            btnAiSubmit.innerHTML = 'Mikir... 🤔';
            btnAiSubmit.disabled = true;
            showToast('AI sedang memproses tugasmu... ⏳');

            // Kita beritahu AI tanggal hari ini agar dia bisa menghitung "besok" atau "minggu depan"
            const hariIni = new Date().toISOString().split('T')[0];

            const prompt = `
                Kamu adalah asisten Todo List. Ubah teks berikut menjadi format JSON MURNI tanpa markdown (jangan gunakan \`\`\`json).
                Aturan:
                - "judul": string (nama tugas yang rapi dan singkat)
                - "tanggal": string format YYYY-MM-DD (hitung dari hari ini: ${hariIni}. Jika tidak ada info hari/tanggal, setel ke hari ini).
                - "prioritas": pilih salah satu dari ["Tinggi", "Sedang", "Rendah"]. Jika tidak disebutkan, tebak prioritasnya atau set ke "Sedang".
                Teks input: "${textRequest}"
            `;

            try {
                // Menembak API Google ke Back-End netliy langsung dengan fungsi fetch
                const response = await fetch('/.netlify/functions/gemini', {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                });

                const data = await response.json();
                let textResult = data.candidates[0].content.parts[0].text;
                
                // Bersihkan teks dari markdown jika AI masih mengembalikannya
                textResult = textResult.replace(/```json/g, "").replace(/```/g, "").trim();
                
                // Ubah teks AI menjadi objek JavaScript
                const taskData = JSON.parse(textResult);

                // Otomatis isikan hasil AI ke form input manualmu
                document.getElementById('title').value = taskData.judul;
                document.getElementById('date').value = taskData.tanggal;
                
                // Setel dropdown prioritas
                const prioritySelect = document.getElementById('priority');
                if (taskData.prioritas && Array.from(prioritySelect.options).some(opt => opt.value === taskData.prioritas)) {
                    prioritySelect.value = taskData.prioritas;
                }

                showToast('Berhasil di-generate AI! Silakan cek form di bawah lalu klik Submit ✅');
                aiInput.value = ''; // Kosongkan kolom AI setelah berhasil
                
            } catch (error) {
                console.error("Error AI:", error);
                showToast('Gagal memproses dengan AI! Pastikan internet jalan. ❌');
            } finally {
                // Kembalikan tombol ke keadaan semula
                btnAiSubmit.innerHTML = originalBtnText;
                btnAiSubmit.disabled = false;
            }
        });
    }
});