const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.VERCEL
  ? path.join('/tmp', 'shop.json')
  : path.join(__dirname, 'data', 'shop.json');

const INITIAL_DATA = {
  users: [],
  products: [],
  invoices: [],
  items: [],
  userSettings: {}
};

function ensureDb() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    const seedFile = path.join(__dirname, 'data', 'shop.json');
    if (fs.existsSync(seedFile) && DB_PATH !== seedFile) {
      try {
        fs.copyFileSync(seedFile, DB_PATH);
        return;
      } catch (e) {}
    }
    fs.writeFileSync(DB_PATH, JSON.stringify(INITIAL_DATA, null, 2), 'utf-8');
  }
}

function getDb() {
  ensureDb();
  try {
    const raw = fs.readFileSync(DB_PATH, 'utf-8');
    const data = JSON.parse(raw);
    if (!data.users) data.users = [];
    if (!data.products) data.products = [];
    if (!data.invoices) data.invoices = [];
    if (!data.items) data.items = [];
    if (!data.userSettings) data.userSettings = {};
    return data;
  } catch (err) {
    return JSON.parse(JSON.stringify(INITIAL_DATA));
  }
}

function saveDb(data) {
  ensureDb();
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

// ------------------------------------------------ User methods
function getUsersCount() {
  return getDb().users.length;
}

function findUser(username) {
  const db = getDb();
  return db.users.find(u => u.username.toLowerCase() === (username || '').toLowerCase().trim());
}

function addUser(username, pwHash, shopDetails = {}) {
  const db = getDb();
  const userId = (db.users.length ? Math.max(...db.users.map(u => u.id)) : 0) + 1;
  const cleanUsername = (username || '').trim();
  const newUser = {
    id: userId,
    username: cleanUsername,
    pw: pwHash,
    createdAt: new Date().toISOString()
  };
  db.users.push(newUser);

  // Initialize per-user shop settings with provided GST & contact details
  if (!db.userSettings) db.userSettings = {};
  db.userSettings[userId] = {
    name: shopDetails.shopName || `${cleanUsername}'s Paint Shop`,
    gstin: (shopDetails.gstin || '').toUpperCase().trim(),
    address: shopDetails.address || '',
    phone: shopDetails.phone || '',
    email: shopDetails.email || '',
    state: shopDetails.state || '27 - Maharashtra',
    bankName: shopDetails.bankName || '',
    bankAccount: shopDetails.bankAccount || '',
    bankIfsc: shopDetails.bankIfsc || '',
    terms: shopDetails.terms || '1. Goods once sold will not be taken back.\n2. Certified that all particulars given above are true and correct.'
  };

  saveDb(db);
  return newUser;
}

// ------------------------------------------------ Product methods
function getProducts(userId) {
  const db = getDb();
  return db.products
    .filter(p => p.userId === userId || (!p.userId && userId === 1))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getProduct(id, userId) {
  const db = getDb();
  return db.products.find(
    p => p.id === Number(id) && (p.userId === userId || (!p.userId && userId === 1))
  );
}

function saveProduct(pData, pid = null, userId) {
  const db = getDb();
  if (pid) {
    const idx = db.products.findIndex(
      p => p.id === Number(pid) && (p.userId === userId || (!p.userId && userId === 1))
    );
    if (idx !== -1) {
      db.products[idx] = { ...db.products[idx], ...pData, id: Number(pid), userId };
    }
  } else {
    const newId = (db.products.length ? Math.max(...db.products.map(p => p.id)) : 0) + 1;
    db.products.push({ ...pData, id: newId, userId });
  }
  saveDb(db);
}

function deleteProduct(pid, userId) {
  const db = getDb();
  db.products = db.products.filter(
    p => !(p.id === Number(pid) && (p.userId === userId || (!p.userId && userId === 1)))
  );
  saveDb(db);
}

// ------------------------------------------------ Invoices
function getInvoices(userId) {
  const db = getDb();
  return db.invoices
    .filter(i => i.userId === userId || (!i.userId && userId === 1))
    .slice()
    .sort((a, b) => b.id - a.id);
}

function getInvoice(id, userId) {
  const db = getDb();
  const inv = db.invoices.find(
    i => i.id === Number(id) && (i.userId === userId || (!i.userId && userId === 1))
  );
  if (!inv) return null;
  const items = db.items.filter(item => item.inv === Number(id));
  return { inv, items };
}

function addInvoice(invData, itemsList, userId) {
  const db = getDb();
  const invId = (db.invoices.length ? Math.max(...db.invoices.map(i => i.id)) : 0) + 1;
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const invNo = `INV-${yy}${mm}-${String(invId).padStart(4, '0')}`;

  const newInv = {
    id: invId,
    userId: userId,
    no: invNo,
    ...invData
  };
  db.invoices.push(newInv);

  let itemId = db.items.length ? Math.max(...db.items.map(i => i.id)) : 0;
  for (const it of itemsList) {
    itemId++;
    db.items.push({
      id: itemId,
      userId: userId,
      inv: invId,
      ...it
    });
    // Deduct stock for this user's product
    const p = db.products.find(
      x => x.id === it.productId && (x.userId === userId || (!x.userId && userId === 1))
    );
    if (p) {
      p.stock = Math.max(0, p.stock - it.qty);
    }
  }
  saveDb(db);
  return newInv;
}

// ------------------------------------------------ Settings
function getSettings(userId) {
  const db = getDb();
  const defaultSettings = {
    name: "My Paint Shop",
    gstin: "",
    address: "",
    phone: "",
    email: "",
    state: "27 - Maharashtra",
    bankName: "",
    bankAccount: "",
    bankIfsc: "",
    terms: "1. Goods once sold will not be taken back.\n2. Certified that all particulars given above are true and correct."
  };
  if (userId && db.userSettings && db.userSettings[userId]) {
    return { ...defaultSettings, ...db.userSettings[userId] };
  }
  if (db.settings) {
    return { ...defaultSettings, ...db.settings };
  }
  return defaultSettings;
}

function saveSettings(settings, userId) {
  const db = getDb();
  if (!db.userSettings) db.userSettings = {};
  if (userId) {
    db.userSettings[userId] = { ...(db.userSettings[userId] || {}), ...settings };
  } else {
    db.settings = { ...(db.settings || {}), ...settings };
  }
  saveDb(db);
}

// ------------------------------------------------ Dashboard statistics
function getStats(userId) {
  const db = getDb();
  const userInvoices = db.invoices.filter(
    i => i.userId === userId || (!i.userId && userId === 1)
  );
  const userProducts = db.products.filter(
    p => p.userId === userId || (!p.userId && userId === 1)
  );

  const todayStr = new Date().toISOString().slice(0, 10);
  const todaySales = userInvoices
    .filter(i => (i.date || '').startsWith(todayStr))
    .reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const totalSales = userInvoices.reduce((sum, i) => sum + (Number(i.total) || 0), 0);
  const lowStock = userProducts
    .filter(p => p.stock <= p.low)
    .sort((a, b) => a.stock - b.stock);
  const recentBills = userInvoices.slice().sort((a, b) => b.id - a.id).slice(0, 5);

  return {
    st: {
      products: userProducts.length,
      today: todaySales,
      total: totalSales,
      bills: userInvoices.length
    },
    low: lowStock,
    recent: recentBills
  };
}

module.exports = {
  getUsersCount,
  findUser,
  addUser,
  getProducts,
  getProduct,
  saveProduct,
  deleteProduct,
  getInvoices,
  getInvoice,
  addInvoice,
  getSettings,
  saveSettings,
  getStats
};
