//  Formatting for INR 
var fmt = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

// Helper function to get element by id
function byId(id) {
  return document.getElementById(id);
}

// State 
var STORAGE_KEY = "et_transactions_v2";
var THEME_KEY = "et_theme_v1";
var transactions = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");

//  Elements 
var balanceEl = byId("balance");
var incomeEl = byId("income");
var expensesEl = byId("expenses");
var txForm = byId("txForm");
var txList = byId("txList");
var searchInput = byId("search");
var filterCat = byId("filterCat");
var darkToggle = byId("darkToggle");
var pieCanvas = byId("pie");
var legendEl = byId("legend");

//  Theme initialization 
var savedTheme = localStorage.getItem(THEME_KEY) || "light";
if (savedTheme === "dark") {
  document.body.classList.add("dark");
  darkToggle.checked = true;
}

// Toggle theme when switch is clicked
darkToggle.addEventListener("change", function () {
  document.body.classList.toggle("dark", darkToggle.checked);
  localStorage.setItem(THEME_KEY, darkToggle.checked ? "dark" : "light");
  drawPie();
});

//  Handling Form Submission 
txForm.addEventListener("submit", function (e) {
  e.preventDefault();

  var amount = parseFloat(byId("amount").value);
  var description = byId("description").value.trim();
  var category = byId("category").value;
  var date = byId("date").value; // yyyy-mm-dd

  // Basic validation
  if (!date || isNaN(amount) || amount < 0 || !description) {
    return;
  }

  // Create transaction object
  var tx = {
    id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString()),
    amount: amount,
    description: description,
    category: category,
    date: date,
  };

  // Add new transaction to the beginning
  transactions.unshift(tx);
  persist();
  updateUI();
  txForm.reset();

  // Reset date to today
  byId("date").value = new Date().toISOString().slice(0, 10);
  byId("amount").focus();
});

//  Save to Local Storage 
function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

//  Calculations 
function calcSummary() {
  var income = 0;
  var expenses = 0;

  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (t.category === "Income") {
      income += t.amount;
    } else {
      expenses += t.amount;
    }
  }

  return {
    income: income,
    expenses: expenses,
    balance: income - expenses,
  };
}

//  Render Summary 
function renderSummary() {
  var s = calcSummary();

  incomeEl.textContent = fmt.format(s.income);
  expensesEl.textContent = fmt.format(s.expenses);
  balanceEl.textContent = fmt.format(s.balance);

  balanceEl.classList.toggle("positive", s.balance >= 0);
  balanceEl.classList.toggle("negative", s.balance < 0);
}

//  Render Transactions List 
function renderList() {
  var term = searchInput.value.trim().toLowerCase();
  var cat = filterCat.value;

  // Filtering transactions
  var filtered = transactions.filter(function (t) {
    var matchesCat = (cat === "All" || t.category === cat);
    var matchesText = (!term || t.description.toLowerCase().includes(term));
    return matchesCat && matchesText;
  });

  // Remove previous rows (except header)
  txList.querySelectorAll(".row:not(.header)").forEach(function (n) {
    n.remove();
  });

  // If no results
  if (filtered.length === 0) {
    var empty = document.createElement("div");
    empty.className = "row";
    empty.innerHTML =
      '<div style="grid-column:1/-1;color:var(--muted);text-align:center">No transactions.</div>';
    txList.appendChild(empty);
    return;
  }

  // Render each transaction
  for (var i = 0; i < filtered.length; i++) {
    var t = filtered[i];
    var row = document.createElement("div");
    row.className = "row";

    var date = new Date(t.date + "T00:00:00");
    var human = date.toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    var isIncome = (t.category === "Income");

    row.innerHTML =
      "<div>" + escapeHtml(t.description) + "</div>" +
      "<div>" + t.category + "</div>" +
      "<div>" + human + "</div>" +
      '<div class="amount ' + (isIncome ? "income" : "expense") + '">' +
      (isIncome ? "+" : "-") + fmt.format(t.amount).replace("₹", "") +
      "</div>" +
      '<div><button class="del" title="Delete" data-id="' + t.id + '">✕</button></div>';

    txList.appendChild(row);
  }
}

//  Escape HTML to prevent XSS 
function escapeHtml(str) {
  return str.replace(/[&<>"]+/g, function (s) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[s];
  });
}

//  Delete Transaction (Event Delegation) 
txList.addEventListener("click", function (e) {
  var btn = e.target.closest("button.del");
  if (!btn) return;

  var id = btn.getAttribute("data-id");
  transactions = transactions.filter(function (t) {
    return t.id !== id;
  });

  persist();
  updateUI();
});

// Filters
searchInput.addEventListener("input", renderList);
filterCat.addEventListener("change", renderList);

//  Pie Chart (Expenses Only)
function getExpenseByCategory() {
  var map = {};

  for (var i = 0; i < transactions.length; i++) {
    var t = transactions[i];
    if (t.category === "Income") continue;

    if (!map[t.category]) {
      map[t.category] = 0;
    }
    map[t.category] += t.amount;
  }

  // Convert object to array and sort
  var arr = [];
  for (var key in map) {
    arr.push([key, map[key]]);
  }
  arr.sort(function (a, b) {
    return b[1] - a[1];
  });
  return arr;
}

function pickColors(n) {
  var base = document.body.classList.contains("dark") ? 60 : 50;
  var arr = [];
  for (var i = 0; i < n; i++) {
    arr.push("hsl(" + ((base + i * 47) % 360) + " 70% 50%)");
  }
  return arr;
}

function drawPie() {
  var ctx = pieCanvas.getContext("2d");
  var rect = pieCanvas.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;

  pieCanvas.width = Math.floor(rect.width * dpr);
  pieCanvas.height = Math.floor(rect.height * dpr);
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, rect.width, rect.height);

  var data = getExpenseByCategory();
  var total = data.reduce(function (s, item) { return s + item[1]; }, 0);

  legendEl.innerHTML = "";

  // No expenses case
  if (total === 0) {
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--muted");
    ctx.font = "14px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.textAlign = "center";
    ctx.fillText("No expense data yet", rect.width / 2, rect.height / 2);
    return;
  }

  var colors = pickColors(data.length);
  var cx = rect.width / 2;
  var cy = rect.height / 2;
  var r = Math.min(rect.width, rect.height) / 2 - 12;

  var start = -Math.PI / 2;

  data.forEach(function (item, i) {
    var label = item[0];
    var value = item[1];
    var angle = (value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, r, start, start + angle);
    ctx.closePath();
    ctx.fillStyle = colors[i];
    ctx.fill();

    start += angle;

    // Legend
    var itemDiv = document.createElement("div");
    itemDiv.style.display = "inline-flex";
    itemDiv.style.alignItems = "center";
    itemDiv.style.gap = "6px";
    itemDiv.style.border = "1px solid var(--border)";
    itemDiv.style.borderRadius = "999px";
    itemDiv.style.padding = "4px 8px";
    itemDiv.style.boxShadow = "var(--shadow)";

    var sw = document.createElement("span");
    sw.style.width = "12px";
    sw.style.height = "12px";
    sw.style.borderRadius = "3px";
    sw.style.background = colors[i];

    var txt = document.createElement("span");
    var pct = ((value / total) * 100).toFixed(1);
    txt.textContent = label + " · " + pct + "%";

    itemDiv.appendChild(sw);
    itemDiv.appendChild(txt);
    legendEl.appendChild(itemDiv);
  });

  // Donut hole
  ctx.globalCompositeOperation = "destination-out";
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";

  // Center text
  ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text");
  ctx.font = "600 14px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.textAlign = "center";
  ctx.fillText("Expenses", cx, cy - 2);

  ctx.font = "800 16px system-ui, -apple-system, Segoe UI, Roboto";
  ctx.fillText(fmt.format(total), cx, cy + 16);
}

window.addEventListener("resize", drawPie);

//  Update UI 
function updateUI() {
  renderSummary();
  renderList();
  drawPie();
}

// Default date to today
byId("date").value = new Date().toISOString().slice(0, 10);

// First render
updateUI();
