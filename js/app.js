/* ================================================================
   EXPENSE & BUDGET VISUALIZER — app.js
   Fase 7: Optional Challenge — Sort Transactions

   Struktur file:
   1. DOM Elements        — referensi ke elemen HTML
   2. State               — data aplikasi yang disimpan di memori
   3. Helper              — fungsi-fungsi pembantu kecil
   4. Local Storage       — simpan & muat data dari browser
   5. Render              — fungsi untuk menampilkan data ke UI
   6. Transaction Actions — aksi pada data transaksi
   7. Spending Limit      — simpan, muat, validasi, dan cek limit
   8. Dark/Light Mode     — toggle tema & persistensi
   9. Sort Transactions   — urutkan tampilan transaksi
  10. Form Handler        — event listener & validasi form
  11. Init                — titik masuk aplikasi
================================================================ */


/* ================================================================
   1. DOM ELEMENTS
   Semua referensi ke elemen HTML dikumpulkan di satu tempat.
   Tujuannya agar mudah dicari dan tidak berulang-ulang
   memanggil querySelector di seluruh kode.
================================================================ */

const DOM = {
  /* --- Balance --- */
  totalBalance:     document.getElementById('total-balance'),
  spendingWarning:  document.getElementById('spending-warning'),

  /* --- Spending Limit --- */
  limitInput:       document.getElementById('limit-input'),
  limitSaveBtn:     document.getElementById('limit-save-btn'),
  limitDisplay:     document.getElementById('limit-display'),
  limitValue:       document.getElementById('limit-value'),

  /* --- Form Transaksi --- */
  transactionForm:  document.getElementById('transaction-form'),
  itemName:         document.getElementById('item-name'),
  itemAmount:       document.getElementById('item-amount'),
  itemCategory:     document.getElementById('item-category'),

  /* --- Error Messages --- */
  itemNameError:     document.getElementById('item-name-error'),
  itemAmountError:   document.getElementById('item-amount-error'),
  itemCategoryError: document.getElementById('item-category-error'),

  /* --- Transaction List --- */
  transactionList:   document.getElementById('transaction-list'),
  transactionsEmpty: document.getElementById('transactions-empty'),
  sortSelect:        document.getElementById('sort-select'),

  /* --- Chart --- */
  spendingChart:    document.getElementById('spending-chart'),
  chartEmpty:       document.getElementById('chart-empty'),
  chartLegend:      document.getElementById('chart-legend'),

  /* --- Theme Toggle --- */
  themeToggle:      document.getElementById('theme-toggle'),
  themeIcon:        document.getElementById('theme-icon'),
};


/* ================================================================
   2. STATE
   Satu objek terpusat untuk semua data aplikasi.
   Dengan cara ini, seluruh data ada di satu tempat
   dan tidak tersebar sebagai variabel global terpisah.
================================================================ */

const state = {
  /**
   * Array yang menyimpan semua transaksi.
   * Setiap elemen adalah objek dengan struktur:
   * {
   *   id       : string  — ID unik berbasis timestamp (misal: "tx_1695000000000")
   *   name     : string  — nama item pengeluaran
   *   amount   : number  — jumlah pengeluaran dalam Rupiah
   *   category : string  — "Food" | "Transport" | "Fun"
   *   date     : string  — tanggal ISO 8601 (misal: "2026-09-25T10:30:00.000Z")
   * }
   */
  transactions: [],

  /**
   * Batas maksimal pengeluaran yang diatur user.
   * Nilai null berarti limit belum diatur.
   */
  spendingLimit: null,

  /**
   * Preferensi tema: "light" atau "dark".
   * Default "light".
   */
  theme: 'light',

  /**
   * Kriteria pengurutan transaksi yang sedang aktif.
   * Nilai sesuai dengan value <option> di sort-select:
   * "default" | "amount-asc" | "amount-desc" | "category"
   */
  sortCriteria: 'default',
};


/**
 * Menyimpan instance Chart.js yang sedang aktif.
 * Nilainya null saat chart belum pernah dibuat.
 *
 * Mengapa perlu disimpan?
 * Chart.js tidak otomatis menghapus chart lama saat dibuat ulang.
 * Jika chart baru dibuat di atas canvas yang sudah terpakai,
 * Chart.js akan error. Dengan menyimpan instance-nya, kita bisa
 * memanggil .destroy() sebelum membuat chart baru, atau
 * mengupdate data chart yang sudah ada tanpa destroy.
 */
let chartInstance = null;

/**
 * Warna untuk setiap kategori — digunakan konsisten
 * di pie chart maupun di legenda.
 * Nilai diambil dari CSS custom properties yang sudah ada di style.css.
 */
const CATEGORY_COLORS = {
  Food:      '#f97316',  /* --color-food      : oranye */
  Transport: '#3b82f6',  /* --color-transport : biru   */
  Fun:       '#a855f7',  /* --color-fun       : ungu   */
};


/* ================================================================
   3. HELPER FUNCTIONS
   Fungsi-fungsi kecil yang digunakan berulang kali.
================================================================ */

/**
 * Membuat ID unik untuk setiap transaksi baru.
 * Menggunakan prefix "tx_" + timestamp agar mudah dibaca.
 * @returns {string} — contoh: "tx_1695000000000"
 */
function generateId() {
  return 'tx_' + Date.now();
}

/**
 * Memformat angka menjadi format Rupiah.
 * Contoh: 25000 → "Rp 25.000"
 * @param {number} amount
 * @returns {string}
 */
function formatRupiah(amount) {
  return 'Rp ' + amount.toLocaleString('id-ID');
}

/**
 * Menampilkan atau menyembunyikan elemen HTML
 * dengan mengatur atribut 'hidden'.
 * @param {HTMLElement} element
 * @param {boolean} isVisible - true = tampilkan, false = sembunyikan
 */
function setVisible(element, isVisible) {
  if (isVisible) {
    element.removeAttribute('hidden');
  } else {
    element.setAttribute('hidden', '');
  }
}


/* ================================================================
   4. LOCAL STORAGE
   Fungsi untuk menyimpan dan memuat data transaksi
   dari Browser Local Storage API.

   Mengapa Local Storage membutuhkan JSON.stringify / JSON.parse?
   Local Storage hanya bisa menyimpan STRING — bukan array atau objek.
   Oleh karena itu:
   - Saat MENYIMPAN : array objek diubah ke string dulu dengan JSON.stringify()
   - Saat MEMUAT    : string diubah kembali ke array objek dengan JSON.parse()
================================================================ */

/** Key yang digunakan untuk menyimpan data di Local Storage. */
const STORAGE_KEY = 'transactions';

/**
 * Menyimpan state.transactions ke Local Storage.
 *
 * Cara kerja:
 * 1. JSON.stringify() mengubah array objek JavaScript menjadi string JSON.
 *    Contoh: [{id:"tx_1", name:"Makan", amount:25000, ...}]
 *         → '[{"id":"tx_1","name":"Makan","amount":25000,...}]'
 * 2. localStorage.setItem() menyimpan string tersebut dengan key "transactions".
 *
 * Fungsi ini dipanggil setiap kali state.transactions berubah
 * (setelah tambah atau hapus transaksi).
 */
function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.transactions));
}

/**
 * Memuat data transaksi dari Local Storage ke state.transactions.
 *
 * Cara kerja:
 * 1. localStorage.getItem() mengambil string yang tersimpan.
 *    Jika key belum ada, getItem() mengembalikan null.
 * 2. Jika data ditemukan (bukan null):
 *    JSON.parse() mengubah string JSON kembali menjadi array objek JavaScript.
 *    Hasilnya dimasukkan ke state.transactions.
 * 3. Jika belum ada data (null):
 *    state.transactions tetap array kosong [] — tidak ada yang berubah.
 *
 * Fungsi ini hanya dipanggil SEKALI saat aplikasi pertama kali dibuka,
 * sebelum render dilakukan.
 */
function loadTransactions() {
  const stored = localStorage.getItem(STORAGE_KEY);

  if (stored !== null) {
    // Data ditemukan: parse string JSON → array objek → simpan ke state
    state.transactions = JSON.parse(stored);
  }
  // Jika stored === null: tidak lakukan apa-apa, state.transactions tetap []
}


/* ================================================================
   5. RENDER FUNCTIONS
   Fungsi-fungsi yang bertanggung jawab memperbarui tampilan HTML
   berdasarkan data yang ada di state.
================================================================ */

/**
 * Menghasilkan nama CSS class badge berdasarkan kategori transaksi.
 * Hasilnya digunakan di elemen <span class="badge badge--...">
 *
 * @param {string} category — "Food" | "Transport" | "Fun"
 * @returns {string} — nama class CSS untuk badge
 */
function getBadgeClass(category) {
  const map = {
    Food:      'badge--food',
    Transport: 'badge--transport',
    Fun:       'badge--fun',
  };
  // Jika kategori tidak dikenali, kembalikan string kosong
  return map[category] || '';
}

/**
 * Membuat satu elemen <li> untuk satu transaksi.
 * Fungsi ini hanya membuat elemen, tidak langsung memasangnya ke DOM.
 *
 * Struktur HTML yang dihasilkan:
 * <li class="transaction-item" data-id="tx_...">
 *   <div class="transaction-item__info">
 *     <span class="transaction-item__name">Nama Item</span>
 *     <span class="badge badge--food">Food</span>
 *   </div>
 *   <div class="transaction-item__right">
 *     <span class="transaction-item__amount">Rp 25.000</span>
 *     <button class="btn btn--delete" ...>🗑️</button>
 *   </div>
 * </li>
 *
 * @param {Object} transaction — objek transaksi dari state.transactions
 * @returns {HTMLElement} — elemen <li> yang sudah siap dipasang ke DOM
 */
function createTransactionElement(transaction) {
  const li = document.createElement('li');
  li.classList.add('transaction-item');
  // Simpan id transaksi di atribut data-id agar mudah diakses saat hapus nanti
  li.dataset.id = transaction.id;

  li.innerHTML = `
    <div class="transaction-item__info">
      <span class="transaction-item__name">${transaction.name}</span>
      <span class="badge ${getBadgeClass(transaction.category)}">${transaction.category}</span>
    </div>
    <div class="transaction-item__right">
      <span class="transaction-item__amount">${formatRupiah(transaction.amount)}</span>
      <button
        class="btn btn--delete"
        data-id="${transaction.id}"
        aria-label="Hapus transaksi ${transaction.name}"
      >🗑️</button>
    </div>
  `;

  return li;
}

/**
 * Me-render seluruh transaction list ke DOM.
 *
 * Cara kerja:
 * 1. Kosongkan isi <ul> terlebih dahulu.
 * 2. Jika state.transactions kosong → tampilkan pesan empty state.
 * 3. Jika ada transaksi → sembunyikan pesan empty state,
 *    buat elemen <li> untuk setiap transaksi, lalu pasang ke <ul>.
 *
 * Fungsi ini dipanggil setiap kali data transaksi berubah
 * (tambah atau hapus) agar tampilan selalu sinkron dengan state.
 */
function renderTransactions() {
  // Kosongkan list sebelum diisi ulang
  DOM.transactionList.innerHTML = '';

  const isEmpty = state.transactions.length === 0;

  // Tampilkan atau sembunyikan pesan "Belum ada transaksi"
  setVisible(DOM.transactionsEmpty, isEmpty);

  // Jika kosong, tidak perlu melanjutkan
  if (isEmpty) return;

  // Buat salinan array lalu urutkan sesuai kriteria aktif.
  // state.transactions TIDAK diubah — hanya salinannya yang diurutkan.
  const sorted = sortTransactions(state.transactions, state.sortCriteria);

  // Buat dan pasang elemen <li> untuk setiap transaksi hasil sort
  sorted.forEach((transaction) => {
    const li = createTransactionElement(transaction);
    DOM.transactionList.appendChild(li);
  });
}


/**
 * Menghitung total pengeluaran dari semua transaksi di state.
 *
 * Array.reduce() bekerja dengan mengakumulasi satu nilai dari seluruh
 * elemen array. Di sini, ia menjumlahkan semua nilai amount satu per satu.
 *
 * Cara kerja reduce(callback, initialValue):
 * - initialValue = 0  → akumulator dimulai dari 0
 * - Setiap iterasi: akumulator = akumulator + amount transaksi saat ini
 *
 * Contoh dengan 3 transaksi [25000, 15000, 10000]:
 *   mulai  : total = 0
 *   iterasi 1: total = 0      + 25000 = 25000
 *   iterasi 2: total = 25000  + 15000 = 40000
 *   iterasi 3: total = 40000  + 10000 = 50000
 *   hasil  : 50000
 *
 * Jika array kosong, reduce() langsung mengembalikan initialValue (0).
 *
 * @returns {number} — total pengeluaran dalam Rupiah
 */
function calculateTotalExpense() {
  return state.transactions.reduce(
    (total, transaction) => total + transaction.amount,
    0  // nilai awal akumulator
  );
}

/**
 * Memperbarui tampilan total pengeluaran di elemen DOM.totalBalance.
 *
 * Cara kerja:
 * 1. Panggil calculateTotalExpense() untuk mendapat angka total.
 * 2. Format angka ke Rupiah dengan formatRupiah().
 * 3. Tulis hasilnya ke textContent elemen total balance.
 *
 * Fungsi ini dipanggil setiap kali data transaksi berubah
 * agar angka yang ditampilkan selalu sinkron dengan state.
 */
function renderTotalExpense() {
  const total = calculateTotalExpense();
  DOM.totalBalance.textContent = formatRupiah(total);
}


/**
 * Menghitung total pengeluaran per kategori dari state.transactions.
 *
 * Cara kerja:
 * - Mulai dengan objek akumulator { Food: 0, Transport: 0, Fun: 0 }.
 * - Untuk setiap transaksi, tambahkan amount-nya ke key kategori yang sesuai.
 * - Kembalikan objek hasil akumulasi.
 *
 * Contoh hasil:
 * { Food: 50000, Transport: 30000, Fun: 20000 }
 *
 * @returns {Object} — total per kategori
 */
function calculateCategoryTotals() {
  const totals = { Food: 0, Transport: 0, Fun: 0 };

  state.transactions.forEach((transaction) => {
    // Hanya tambahkan jika kategori dikenali (ada di objek totals)
    if (totals[transaction.category] !== undefined) {
      totals[transaction.category] += transaction.amount;
    }
  });

  return totals;
}

/**
 * Me-render pie chart berdasarkan data state.transactions.
 *
 * Alur kerja:
 * 1. Cek apakah ada transaksi.
 *    - Tidak ada → sembunyikan canvas, tampilkan pesan kosong, return.
 *    - Ada       → tampilkan canvas, sembunyikan pesan kosong.
 * 2. Hitung total per kategori dengan calculateCategoryTotals().
 * 3. Saring kategori yang totalnya 0 agar tidak muncul di chart.
 * 4. Jika chartInstance sudah ada → update data-nya (lebih efisien).
 *    Jika belum ada               → buat instance Chart.js baru.
 * 5. Render legenda di bawah chart.
 */
function renderChart() {
  const isEmpty = state.transactions.length === 0;

  // --- Tampilan canvas & pesan kosong ---
  setVisible(DOM.spendingChart, !isEmpty);
  setVisible(DOM.chartEmpty,     isEmpty);

  // Jika tidak ada transaksi, hancurkan chart lama (jika ada) lalu berhenti
  if (isEmpty) {
    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }
    DOM.chartLegend.innerHTML = '';
    return;
  }

  // --- Siapkan data untuk Chart.js ---
  const totals = calculateCategoryTotals();

  // Hanya sertakan kategori yang memiliki nilai > 0
  const categories = Object.keys(totals).filter((cat) => totals[cat] > 0);
  const amounts    = categories.map((cat) => totals[cat]);
  const colors     = categories.map((cat) => CATEGORY_COLORS[cat]);

  // --- Buat atau update chart ---
  if (chartInstance) {
    // Chart sudah ada: update data tanpa destroy agar transisi lebih halus
    chartInstance.data.labels                           = categories;
    chartInstance.data.datasets[0].data                = amounts;
    chartInstance.data.datasets[0].backgroundColor     = colors;
    chartInstance.update();
  } else {
    // Chart belum ada: buat instance baru
    const ctx = DOM.spendingChart.getContext('2d');

    chartInstance = new Chart(ctx, {
      type: 'pie',
      data: {
        labels:   categories,
        datasets: [{
          data:            amounts,
          backgroundColor: colors,
          borderColor:     '#ffffff',
          borderWidth:     2,
        }],
      },
      options: {
        responsive:          true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            // Legenda bawaan Chart.js disembunyikan —
            // kita render legenda sendiri agar tampilannya konsisten
            // dengan desain dan bisa menampilkan nilai Rupiah.
            display: false,
          },
          tooltip: {
            callbacks: {
              // Format tooltip: "Food: Rp 50.000"
              label: (context) => {
                const label  = context.label || '';
                const value  = context.parsed;
                return ` ${label}: ${formatRupiah(value)}`;
              },
            },
          },
        },
      },
    });
  }

  // --- Render legenda manual ---
  // Kosongkan legenda lama terlebih dahulu
  DOM.chartLegend.innerHTML = '';

  categories.forEach((category) => {
    const li = document.createElement('li');
    li.classList.add('chart-legend__item');

    li.innerHTML = `
      <span
        class="chart-legend__color"
        style="background-color: ${CATEGORY_COLORS[category]};"
        aria-hidden="true"
      ></span>
      <span class="chart-legend__label">${category}:</span>
      <span class="chart-legend__value">${formatRupiah(totals[category])}</span>
    `;

    DOM.chartLegend.appendChild(li);
  });
}


/* ================================================================
   6. TRANSACTION ACTIONS
   Fungsi-fungsi yang mengubah data di state.transactions.
================================================================ */

/**
 * Menghapus satu transaksi dari state.transactions berdasarkan id-nya.
 *
 * Menggunakan Array.filter() yang menghasilkan array BARU berisi
 * semua transaksi KECUALI yang id-nya cocok dengan targetId.
 * Array lama diganti dengan array baru ini.
 *
 * @param {string} targetId — id transaksi yang akan dihapus
 */
function deleteTransaction(targetId) {
  state.transactions = state.transactions.filter(
    (transaction) => transaction.id !== targetId
  );

  // Simpan perubahan ke Local Storage
  saveTransactions();

  // Perbarui tampilan list, total, chart, dan cek limit
  renderTransactions();
  renderTotalExpense();
  renderChart();
  checkSpendingLimit();
}

/**
 * Event handler untuk klik di dalam transaction list.
 *
 * Menggunakan EVENT DELEGATION:
 * Satu event listener dipasang di <ul> (parent),
 * bukan di setiap tombol hapus (child) satu per satu.
 *
 * Cara kerjanya:
 * - Setiap klik di dalam <ul> akan sampai ke sini.
 * - Kita periksa apakah elemen yang diklik adalah tombol hapus
 *   dengan mengecek keberadaan class "btn--delete".
 * - Jika ya, ambil data-id dari tombol tersebut lalu panggil deleteTransaction().
 * - Jika bukan tombol hapus, abaikan klik.
 *
 * @param {MouseEvent} event
 */
function handleListClick(event) {
  // event.target adalah elemen yang BENAR-BENAR diklik user
  const clickedEl = event.target;

  // Periksa apakah yang diklik adalah tombol hapus
  // closest() mencari ancestor terdekat yang cocok dengan selector,
  // berguna jika di dalam tombol ada elemen lain (misal ikon/span)
  const deleteBtn = clickedEl.closest('.btn--delete');

  // Jika klik bukan pada tombol hapus, hentikan proses
  if (!deleteBtn) return;

  // Ambil id transaksi dari atribut data-id milik tombol
  const transactionId = deleteBtn.dataset.id;

  // Hapus transaksi dengan id tersebut dari state
  deleteTransaction(transactionId);
}


/* ================================================================
   7. SPENDING LIMIT
   Fungsi untuk menyimpan, memuat, memvalidasi, dan mengecek
   spending limit terhadap total pengeluaran.
================================================================ */

/** Key Local Storage untuk spending limit. */
const LIMIT_KEY = 'spendingLimit';

/**
 * Menyimpan state.spendingLimit ke Local Storage.
 * Nilainya adalah angka, langsung disimpan sebagai string
 * (tidak perlu JSON.stringify karena bukan array/objek).
 */
function saveSpendingLimit() {
  localStorage.setItem(LIMIT_KEY, String(state.spendingLimit));
}

/**
 * Memuat spending limit dari Local Storage ke state.spendingLimit.
 *
 * Cara kerja:
 * - getItem() mengembalikan string atau null.
 * - Konversi ke Number: Number("500000") → 500000.
 * - Jika hasilnya NaN atau <= 0, berarti data tidak valid — abaikan.
 * - Jika valid, simpan ke state dan tampilkan di UI.
 */
function loadSpendingLimit() {
  const stored = localStorage.getItem(LIMIT_KEY);
  if (stored === null) return;

  const parsed = Number(stored);
  if (isNaN(parsed) || parsed <= 0) return;

  // Data valid: masukkan ke state dan perbarui tampilan
  state.spendingLimit = parsed;
  renderSpendingLimit();
}

/**
 * Memperbarui tampilan spending limit di UI.
 *
 * Menampilkan nilai limit yang aktif pada DOM.limitValue
 * dan memunculkan DOM.limitDisplay jika sebelumnya tersembunyi.
 * Dipanggil saat limit pertama kali disimpan dan saat dimuat dari storage.
 */
function renderSpendingLimit() {
  DOM.limitValue.textContent = formatRupiah(state.spendingLimit);
  setVisible(DOM.limitDisplay, true);
}

/**
 * Membandingkan total pengeluaran dengan state.spendingLimit
 * lalu menampilkan atau menyembunyikan peringatan.
 *
 * Aturan:
 * 1. Jika limit belum diatur (null) → sembunyikan warning, keluar.
 * 2. Jika total > limit             → tampilkan warning.
 * 3. Jika total <= limit            → sembunyikan warning.
 *
 * Fungsi ini tidak mengubah data — hanya membaca state lalu
 * memperbarui tampilan DOM.spendingWarning.
 */
function checkSpendingLimit() {
  // Kondisi 1: limit belum diatur
  if (state.spendingLimit === null) {
    setVisible(DOM.spendingWarning, false);
    return;
  }

  const total = calculateTotalExpense();

  // Kondisi 2 & 3: bandingkan total dengan limit
  const isOver = total > state.spendingLimit;
  setVisible(DOM.spendingWarning, isOver);
}

/**
 * Event handler untuk tombol simpan spending limit.
 *
 * Alur:
 * 1. Ambil nilai dari input limit.
 * 2. Validasi: harus angka > 0.
 * 3. Simpan ke state dan Local Storage.
 * 4. Perbarui tampilan limit display.
 * 5. Langsung cek apakah total pengeluaran sudah melampaui limit baru.
 * 6. Kosongkan input setelah berhasil disimpan.
 */
function handleLimitSave() {
  const inputVal = Number(DOM.limitInput.value);

  // Validasi: kosong atau bukan angka positif
  if (!DOM.limitInput.value.trim() || isNaN(inputVal) || inputVal <= 0) {
    DOM.limitInput.classList.add('input--error');
    DOM.limitInput.focus();
    return;
  }

  // Input valid — hapus state error jika ada
  DOM.limitInput.classList.remove('input--error');

  // Simpan ke state
  state.spendingLimit = inputVal;

  // Simpan ke Local Storage
  saveSpendingLimit();

  // Perbarui tampilan limit display
  renderSpendingLimit();

  // Cek apakah total sekarang melampaui limit baru
  checkSpendingLimit();

  // Kosongkan input
  DOM.limitInput.value = '';
}


/* ================================================================
   8. DARK/LIGHT MODE
   Fungsi untuk toggle tema, persistensi ke Local Storage,
   dan memulihkan tema saat aplikasi dibuka kembali.
================================================================ */

/** Key Local Storage untuk menyimpan preferensi tema. */
const THEME_KEY = 'theme';

/**
 * Menerapkan tema ke halaman berdasarkan nilai string yang diberikan.
 *
 * Cara kerja:
 * - Jika tema "dark": tambah class "dark-mode" ke <body>, ganti icon ke ☀️
 * - Jika tema "light" (atau apapun selain "dark"): hapus class, kembalikan icon ke 🌙
 *
 * Fungsi ini tidak menyimpan ke Local Storage — itu tugas caller-nya.
 * Pemisahan ini memudahkan penggunaan ulang saat load dari storage.
 *
 * @param {string} theme — "dark" atau "light"
 */
function applyTheme(theme) {
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    DOM.themeIcon.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-mode');
    DOM.themeIcon.textContent = '🌙';
  }

  // Sinkronkan state dengan tema yang diterapkan
  state.theme = theme;
}

/**
 * Menyimpan preferensi tema ke Local Storage.
 * Nilainya adalah string "dark" atau "light".
 */
function saveTheme() {
  localStorage.setItem(THEME_KEY, state.theme);
}

/**
 * Memuat preferensi tema dari Local Storage dan menerapkannya.
 *
 * Jika belum ada data (null), tidak melakukan apa-apa —
 * tema default "light" sudah terpasang karena tidak ada
 * class "dark-mode" di <body> saat halaman pertama dimuat.
 */
function loadTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === 'dark' || stored === 'light') {
    applyTheme(stored);
  }
}

/**
 * Event handler untuk tombol toggle theme.
 *
 * Membaca tema saat ini dari state, membaliknya,
 * menerapkan, lalu menyimpan ke Local Storage.
 */
function handleThemeToggle() {
  const newTheme = state.theme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  saveTheme();
}


/* ================================================================
   9. SORT TRANSACTIONS
   Fungsi untuk mengurutkan tampilan transaksi tanpa mengubah
   data asli di state.transactions.
================================================================ */

/**
 * Membuat salinan array transaksi lalu mengurutkannya
 * berdasarkan kriteria yang diberikan.
 *
 * Menggunakan spread operator [...transactions] untuk membuat
 * salinan dangkal (shallow copy) — array baru berisi referensi
 * objek yang sama, tapi urutan elemen bebas diubah tanpa
 * memengaruhi array aslinya (state.transactions).
 *
 * Kriteria yang didukung:
 * - "default"      : urutan asli (terbaru di atas, sesuai urutan di state)
 * - "amount-desc"  : amount terbesar ke terkecil
 * - "amount-asc"   : amount terkecil ke terbesar
 * - "category"     : nama kategori A–Z (alfabetis)
 *
 * @param {Array}  transactions — array transaksi sumber (state.transactions)
 * @param {string} criteria     — kriteria pengurutan
 * @returns {Array} — array baru yang sudah diurutkan
 */
function sortTransactions(transactions, criteria) {
  // Buat salinan array agar state.transactions tidak termutasi
  const copy = [...transactions];

  switch (criteria) {
    case 'amount-desc':
      // Terbesar ke terkecil: b - a
      copy.sort((a, b) => b.amount - a.amount);
      break;

    case 'amount-asc':
      // Terkecil ke terbesar: a - b
      copy.sort((a, b) => a.amount - b.amount);
      break;

    case 'category':
      // Alfabetis berdasarkan nama kategori
      copy.sort((a, b) => a.category.localeCompare(b.category));
      break;

    case 'default':
    default:
      // Urutan default = urutan di state (terbaru di atas karena unshift)
      // Tidak perlu sort — salinan sudah mencerminkan urutan state
      break;
  }

  return copy;
}

/**
 * Event handler untuk perubahan pada dropdown sort.
 *
 * Mengambil value yang dipilih, menyimpannya ke state.sortCriteria,
 * lalu memanggil renderTransactions() yang akan membaca kriteria
 * tersebut dan menampilkan list yang sudah diurutkan.
 *
 * Total, chart, dan spending limit TIDAK dipanggil ulang karena
 * sorting tidak mengubah data — hanya urutan tampilan.
 */
function handleSortChange() {
  state.sortCriteria = DOM.sortSelect.value;
  renderTransactions();
}


/* ================================================================
  10. FORM HANDLER
   Menangani validasi dan submit form penambahan transaksi.
================================================================ */

/**
 * Memvalidasi satu field input.
 * Jika tidak valid: tampilkan pesan error & tambah class --error.
 * Jika valid: sembunyikan pesan error & hapus class --error.
 *
 * @param {HTMLElement} inputEl  — elemen input yang diperiksa
 * @param {HTMLElement} errorEl  — elemen <span> untuk pesan error
 * @param {Function}    testFn   — fungsi yang mengembalikan true jika valid
 * @returns {boolean}
 */
function validateField(inputEl, errorEl, testFn) {
  const isValid = testFn(inputEl.value);

  if (!isValid) {
    inputEl.classList.add('input--error');
    setVisible(errorEl, true);
  } else {
    inputEl.classList.remove('input--error');
    setVisible(errorEl, false);
  }

  return isValid;
}

/**
 * Memvalidasi semua field form sekaligus.
 * @returns {boolean} — true jika semua field valid
 */
function validateForm() {
  // Nama item: tidak boleh kosong setelah di-trim
  const nameValid = validateField(
    DOM.itemName,
    DOM.itemNameError,
    (val) => val.trim() !== ''
  );

  // Amount: harus angka dan lebih dari 0
  const amountValid = validateField(
    DOM.itemAmount,
    DOM.itemAmountError,
    (val) => val.trim() !== '' && Number(val) > 0
  );

  // Kategori: harus dipilih (bukan opsi kosong "")
  const categoryValid = validateField(
    DOM.itemCategory,
    DOM.itemCategoryError,
    (val) => val !== ''
  );

  return nameValid && amountValid && categoryValid;
}

/**
 * Membersihkan semua field form dan error setelah submit berhasil.
 */
function resetForm() {
  DOM.transactionForm.reset();

  // Hapus semua class error yang mungkin masih ada
  [DOM.itemName, DOM.itemAmount, DOM.itemCategory].forEach((el) => {
    el.classList.remove('input--error');
  });

  // Sembunyikan semua pesan error
  [DOM.itemNameError, DOM.itemAmountError, DOM.itemCategoryError].forEach((el) => {
    setVisible(el, false);
  });
}

/**
 * Membuat objek transaksi baru dari nilai form yang sudah divalidasi.
 * @returns {Object} — objek transaksi dengan struktur lengkap
 */
function createTransactionObject() {
  return {
    id:       generateId(),
    name:     DOM.itemName.value.trim(),
    amount:   Number(DOM.itemAmount.value),
    category: DOM.itemCategory.value,
    date:     new Date().toISOString(),
  };
}

/**
 * Event handler untuk submit form transaksi.
 * Alur: validasi → buat objek → simpan ke state → render ulang → reset form.
 * @param {Event} event
 */
function handleFormSubmit(event) {
  // Mencegah browser me-reload halaman (perilaku default form)
  event.preventDefault();

  // Hentikan proses jika ada field yang tidak valid
  if (!validateForm()) return;

  // Buat objek transaksi dari input user
  const newTransaction = createTransactionObject();

  // Masukkan transaksi baru ke depan array agar tampil paling atas
  state.transactions.unshift(newTransaction);

  // Simpan perubahan ke Local Storage
  saveTransactions();

  // Render ulang transaction list, total, chart, dan cek limit
  renderTransactions();
  renderTotalExpense();
  renderChart();
  checkSpendingLimit();

  // Bersihkan form setelah submit berhasil
  resetForm();
}


/* ================================================================
  11. INIT
   Fungsi init() adalah titik masuk aplikasi.
   Dipanggil sekali saat halaman selesai dimuat.
   Semua "pendaftaran" event listener dilakukan di sini.
================================================================ */

function init() {
  // Terapkan tema terlebih dahulu agar tidak ada flash of unstyled content
  loadTheme();

  // Muat data dari Local Storage
  loadTransactions();
  loadSpendingLimit();

  // Render awal berdasarkan data yang sudah dimuat
  renderTransactions();
  renderTotalExpense();
  renderChart();
  checkSpendingLimit();

  // Daftarkan event listener untuk form transaksi
  DOM.transactionForm.addEventListener('submit', handleFormSubmit);

  // Daftarkan event delegation untuk tombol hapus di transaction list
  DOM.transactionList.addEventListener('click', handleListClick);

  // Daftarkan event listener untuk tombol simpan spending limit
  DOM.limitSaveBtn.addEventListener('click', handleLimitSave);

  // Izinkan user menekan Enter di input limit untuk menyimpan
  DOM.limitInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLimitSave();
  });

  // Daftarkan event listener untuk tombol toggle theme
  DOM.themeToggle.addEventListener('click', handleThemeToggle);

  // Daftarkan event listener untuk dropdown sort
  DOM.sortSelect.addEventListener('change', handleSortChange);
}

// Jalankan init() setelah seluruh DOM siap
document.addEventListener('DOMContentLoaded', init);
