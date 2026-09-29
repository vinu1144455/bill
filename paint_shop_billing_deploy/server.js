const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const db = require('./db');

const app = express();

const INDIAN_STATES = [
  "01 - Jammu & Kashmir", "02 - Himachal Pradesh", "03 - Punjab", "04 - Chandigarh",
  "05 - Uttarakhand", "06 - Haryana", "07 - Delhi", "08 - Rajasthan",
  "09 - Uttar Pradesh", "10 - Bihar", "11 - Sikkim", "12 - Arunachal Pradesh",
  "13 - Nagaland", "14 - Manipur", "15 - Mizoram", "16 - Tripura",
  "17 - Meghalaya", "18 - Assam", "19 - West Bengal", "20 - Jharkhand",
  "21 - Odisha", "22 - Chhattisgarh", "23 - Madhya Pradesh", "24 - Gujarat",
  "25 - Daman & Diu", "26 - Dadra & Nagar Haveli", "27 - Maharashtra", "29 - Karnataka",
  "30 - Goa", "31 - Lakshadweep", "32 - Kerala", "33 - Tamil Nadu",
  "34 - Puducherry", "35 - Andaman & Nicobar Islands", "36 - Telangana",
  "37 - Andhra Pradesh", "38 - Ladakh"
];

function numberToWordsINR(amount) {
  const words = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convertChunk(n) {
    if (n < 20) return words[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + words[n % 10] : '');
    return words[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convertChunk(n % 100) : '');
  }

  const num = Math.floor(Math.abs(amount || 0));
  const paise = Math.round((Math.abs(amount || 0) - num) * 100);

  if (num === 0 && paise === 0) return 'Zero Rupees Only';

  let str = '';
  const crore = Math.floor(num / 10000000);
  const lakh = Math.floor((num % 10000000) / 100000);
  const thousand = Math.floor((num % 100000) / 1000);
  const hundred = Math.floor((num % 1000) / 100);
  const remainder = num % 100;

  if (crore) str += convertChunk(crore) + ' Crore ';
  if (lakh) str += convertChunk(lakh) + ' Lakh ';
  if (thousand) str += convertChunk(thousand) + ' Thousand ';
  if (hundred) str += words[hundred] + ' Hundred ';
  if (remainder) {
    if (str !== '') str += 'and ';
    str += convertChunk(remainder) + ' ';
  }

  str = str.trim() + ' Rupees';
  if (paise > 0) {
    str += ' and ' + convertChunk(paise) + ' Paise';
  }
  return str + ' Only';
}

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(
  cookieSession({
    name: 'paint_shop_session',
    keys: [process.env.SECRET_KEY || 'paint-shop-secret-key-node-2026'],
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  })
);

// Global context middleware
app.use((req, res, next) => {
  const userId = req.session && req.session.userId ? req.session.userId : null;
  res.locals.user = req.session && req.session.user ? req.session.user : null;
  res.locals.userId = userId;
  res.locals.shop = db.getSettings(userId);
  res.locals.states = INDIAN_STATES;
  res.locals.numberToWordsINR = numberToWordsINR;
  res.locals.flash = req.session && req.session.flash ? req.session.flash : [];
  if (req.session) {
    req.session.flash = [];
  }
  next();
});

// Flash helper
function flash(req, msg) {
  if (!req.session) req.session = {};
  if (!req.session.flash) req.session.flash = [];
  req.session.flash.push(msg);
}

// Authentication middleware
function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

// ---------------------------------------------------- Auth routes
app.get('/login', (req, res) => {
  if (req.session && req.session.userId) {
    return res.redirect('/');
  }
  const tab = req.query.tab === 'register' ? 'register' : 'login';
  res.render('login', { tab, active: 'login' });
});

// User Login handler
app.post('/login', async (req, res) => {
  const username = (req.body.username || '').trim();
  const password = req.body.password || '';

  if (!username || !password) {
    flash(req, 'Please enter both username and password.');
    return res.redirect('/login?tab=login');
  }

  const user = db.findUser(username);
  if (user && (await bcrypt.compare(password, user.pw))) {
    req.session.userId = user.id;
    req.session.user = user.username;
    return res.redirect('/');
  }

  flash(req, 'Wrong username or password.');
  return res.redirect('/login?tab=login');
});

// User Registration handler with GST & Shop info
app.post('/register', async (req, res) => {
  const f = req.body;
  const username = (f.username || '').trim();
  const password = f.password || '';
  const shopName = (f.shopName || '').trim();
  const gstin = (f.gstin || '').trim().toUpperCase();
  const phone = (f.phone || '').trim();
  const email = (f.email || '').trim();
  const state = (f.state || '').trim();
  const address = (f.address || '').trim();

  if (username.length < 2) {
    flash(req, 'Username must be at least 2 characters.');
    return res.redirect('/login?tab=register');
  }
  if (password.length < 4) {
    flash(req, 'Password must be at least 4 characters.');
    return res.redirect('/login?tab=register');
  }
  if (!shopName) {
    flash(req, 'Please enter your Shop / Business Name.');
    return res.redirect('/login?tab=register');
  }
  if (!phone) {
    flash(req, 'Please enter your Contact Phone / Mobile number.');
    return res.redirect('/login?tab=register');
  }

  const existing = db.findUser(username);
  if (existing) {
    flash(req, `Username "${username}" is already taken. Please log in or choose another.`);
    return res.redirect('/login?tab=login');
  }

  const hash = await bcrypt.hash(password, 10);
  const newUser = db.addUser(username, hash, {
    shopName,
    gstin,
    phone,
    email,
    state: state || '27 - Maharashtra',
    address
  });

  req.session.userId = newUser.id;
  req.session.user = newUser.username;
  flash(req, 'Account and GST Shop profile created successfully!');
  return res.redirect('/');
});

app.get('/logout', (req, res) => {
  req.session = null;
  res.redirect('/login');
});

// ---------------------------------------------------- Dashboard
app.get('/', requireAuth, (req, res) => {
  const { st, low, recent } = db.getStats(req.session.userId);
  res.render('home', { st, low, recent, active: 'home' });
});

// ---------------------------------------------------- Inventory
app.get('/inventory', requireAuth, (req, res) => {
  const rows = db.getProducts(req.session.userId);
  res.render('inventory', { rows, active: 'inventory' });
});

app.get('/inventory/edit', requireAuth, (req, res) => {
  res.render('product', { p: null, active: 'inventory' });
});

app.get('/inventory/edit/:id', requireAuth, (req, res) => {
  const p = db.getProduct(req.params.id, req.session.userId);
  if (!p) return res.redirect('/inventory');
  res.render('product', { p, active: 'inventory' });
});

app.post('/inventory/edit', requireAuth, (req, res) => {
  const f = req.body;
  db.saveProduct(
    {
      name: (f.name || '').trim(),
      brand: (f.brand || '').trim(),
      hsn: (f.hsn || '3208').trim(),
      unit: f.unit || 'L',
      price: parseFloat(f.price) || 0,
      gst: parseFloat(f.gst) || 18,
      stock: parseFloat(f.stock) || 0,
      low: parseFloat(f.low) || 5
    },
    null,
    req.session.userId
  );
  flash(req, 'Product saved.');
  res.redirect('/inventory');
});

app.post('/inventory/edit/:id', requireAuth, (req, res) => {
  const f = req.body;
  db.saveProduct(
    {
      name: (f.name || '').trim(),
      brand: (f.brand || '').trim(),
      hsn: (f.hsn || '3208').trim(),
      unit: f.unit || 'L',
      price: parseFloat(f.price) || 0,
      gst: parseFloat(f.gst) || 18,
      stock: parseFloat(f.stock) || 0,
      low: parseFloat(f.low) || 5
    },
    req.params.id,
    req.session.userId
  );
  flash(req, 'Product saved.');
  res.redirect('/inventory');
});

app.post('/inventory/delete/:id', requireAuth, (req, res) => {
  db.deleteProduct(req.params.id, req.session.userId);
  flash(req, 'Product deleted.');
  res.redirect('/inventory');
});

// ---------------------------------------------------- Billing
app.get('/billing', requireAuth, (req, res) => {
  const prods = db.getProducts(req.session.userId).filter(p => p.stock > 0);
  res.render('billing', { products: prods, active: 'billing' });
});

app.post('/billing', requireAuth, (req, res) => {
  const f = req.body;
  let pids = f.pid;
  let qtys = f.qty;

  if (!Array.isArray(pids)) pids = pids ? [pids] : [];
  if (!Array.isArray(qtys)) qtys = qtys ? [qtys] : [];

  const lines = [];
  let sub = 0;
  let tax = 0;

  for (let idx = 0; idx < pids.length; idx++) {
    const pid = pids[idx];
    const q = parseFloat(qtys[idx]) || 0;
    const p = db.getProduct(pid, req.session.userId);

    if (!p || q <= 0) continue;
    if (q > p.stock) {
      flash(req, `Only ${p.stock} ${p.unit} of ${p.name} in stock.`);
      return res.redirect('/billing');
    }

    const amt = Math.round(p.price * q * 100) / 100;
    lines.push({
      productId: p.id,
      pname: p.brand ? `${p.name} (${p.brand})` : p.name,
      hsn: p.hsn,
      unit: p.unit,
      qty: q,
      price: p.price,
      gst: p.gst,
      amt: amt
    });

    sub += amt;
    tax += (amt * p.gst) / 100;
  }

  if (!lines.length) {
    flash(req, 'Add at least one product.');
    return res.redirect('/billing');
  }

  sub = Math.round(sub * 100) / 100;
  tax = Math.round(tax * 100) / 100;
  const total = Math.round((sub + tax) * 100) / 100;

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

  const newInv = db.addInvoice(
    {
      date: dateStr,
      cname: (f.cname || '').trim() || 'Walk-in customer',
      cgstin: (f.cgstin || '').trim().toUpperCase(),
      cphone: (f.cphone || '').trim(),
      cemail: (f.cemail || '').trim(),
      caddress: (f.caddress || '').trim(),
      cstate: (f.cstate || '').trim(),
      inter: f.inter ? 1 : 0,
      sub,
      tax,
      total,
      user: req.session.user
    },
    lines,
    req.session.userId
  );

  res.redirect(`/invoice/${newInv.id}`);
});

// ---------------------------------------------------- Invoices
app.get('/invoices', requireAuth, (req, res) => {
  const rows = db.getInvoices(req.session.userId);
  res.render('invoices', { rows, active: 'invoices' });
});

app.get('/invoice/:id', requireAuth, (req, res) => {
  const data = db.getInvoice(req.params.id, req.session.userId);
  if (!data) return res.redirect('/invoices');
  res.render('invoice', { inv: data.inv, items: data.items, active: 'invoices' });
});

// ---------------------------------------------------- Settings
app.get('/settings', requireAuth, (req, res) => {
  res.render('settings', { active: 'settings' });
});

app.post('/settings', requireAuth, (req, res) => {
  const f = req.body;
  db.saveSettings(
    {
      name: (f.name || 'My Paint Shop').trim(),
      gstin: (f.gstin || '').trim().toUpperCase(),
      address: (f.address || '').trim(),
      phone: (f.phone || '').trim(),
      email: (f.email || '').trim(),
      state: (f.state || '').trim(),
      bankName: (f.bankName || '').trim(),
      bankAccount: (f.bankAccount || '').trim(),
      bankIfsc: (f.bankIfsc || '').trim().toUpperCase(),
      terms: (f.terms || '').trim()
    },
    req.session.userId
  );
  flash(req, 'Shop and GST details updated.');
  res.redirect('/');
});

if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Paint Shop Billing app running at http://localhost:${PORT}`);
  });
}

module.exports = app;
