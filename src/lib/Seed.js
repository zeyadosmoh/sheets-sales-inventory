/**
 * Deterministic synthetic sample data. PURE (no Apps Script services).
 * Same seed -> same products, stock and sales, every time.
 * All names are generic / made up. Synthetic sample data only.
 */

/** Small seeded PRNG (mulberry32). Returns a function -> float in [0, 1). */
function makeRng(seed) {
  var a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rngInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

/** [prefix, category, [[name, price], ...]] - 40 products in total. */
var SEED_CATALOG = [
  ['BEV', 'Beverages', [['Mango Juice 1L', 32], ['Orange Juice 1L', 30], ['Mineral Water 1.5L', 9], ['Cola Can 330ml', 15],
    ['Green Tea 25 bags', 45], ['Ground Coffee 250g', 160], ['Instant Coffee 100g', 120]]],
  ['SNK', 'Snacks', [['Potato Chips 150g', 25], ['Salted Peanuts 200g', 40], ['Chocolate Bar 50g', 20], ['Oat Biscuits 300g', 38],
    ['Mixed Nuts 250g', 140], ['Popcorn 100g', 18], ['Date Bars 6-pack', 55]]],
  ['DAI', 'Dairy', [['Full Cream Milk 1L', 36], ['Plain Yogurt 500g', 28], ['White Cheese 500g', 75], ['Butter 200g', 85],
    ['Cheddar Slices 200g', 90], ['Labneh 250g', 48]]],
  ['BAK', 'Bakery', [['Brown Bread Loaf', 22], ['Croissant 4-pack', 60], ['Pita Bread 10-pack', 15], ['Rusks 400g', 42],
    ['Cake Slice Box', 95], ['Sesame Rings 6-pack', 30]]],
  ['HOU', 'Household', [['Dish Soap 750ml', 48], ['Laundry Powder 2kg', 165], ['Paper Towels 4-roll', 70], ['Trash Bags 30-pack', 52],
    ['Glass Cleaner 500ml', 58], ['Sponges 5-pack', 25], ['Aluminium Foil 10m', 44]]],
  ['PER', 'Personal Care', [['Shampoo 400ml', 110], ['Toothpaste 100ml', 45], ['Hand Soap 500ml', 50], ['Body Lotion 250ml', 125],
    ['Deodorant 150ml', 95], ['Razor 3-pack', 80], ['Tissues Box 200', 30]]]
];

var SEED_FIRST_NAMES = ['Ahmed', 'Mona', 'Omar', 'Sara', 'Youssef', 'Nour', 'Karim', 'Laila', 'Hassan', 'Dina',
  'Tarek', 'Heba', 'Mostafa', 'Salma', 'Amr', 'Rana'];
var SEED_LAST_NAMES = ['Hassan', 'Mahmoud', 'Ali', 'Ibrahim', 'Saleh', 'Fathy', 'Nabil', 'Kamal', 'Adel', 'Samir'];

function seedProducts(rng) {
  var products = [];
  SEED_CATALOG.forEach(function (group) {
    group[2].forEach(function (item, i) {
      var price = item[1];
      var costRatio = 0.55 + rng() * 0.2;
      products.push({
        sku: group[0] + '-' + pad(i + 1, 3),
        name: item[0],
        category: group[1],
        cost: round2(price * costRatio),
        price: price,
        reorderLevel: rngInt(rng, 2, 6) * 5
      });
    });
  });
  return products;
}

function seedCustomers(rng, count) {
  var out = [];
  var used = {};
  while (out.length < count) {
    var n = SEED_FIRST_NAMES[rngInt(rng, 0, SEED_FIRST_NAMES.length - 1)] + ' ' +
      SEED_LAST_NAMES[rngInt(rng, 0, SEED_LAST_NAMES.length - 1)];
    if (!used[n]) { used[n] = true; out.push(n); }
  }
  return out;
}

/** Pick an index with probability proportional to weights[i]. */
function weightedPick(rng, weights, total) {
  var r = rng() * total;
  for (var i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}

/**
 * options: { seed, startIso, endIso, salesLines }
 * Returns { products, inventory: [{ sku, opening, purchases }], sales: [{ date, invoice, sku, qty, unitPrice, customer }] }
 */
function generateSeedData(options) {
  var o = options || {};
  var seed = o.seed === undefined ? 2026 : o.seed;
  var startIso = o.startIso || '2026-05-01';
  var endIso = o.endIso || '2026-10-31';
  var target = o.salesLines || 1500;
  var rng = makeRng(seed);

  var products = seedProducts(rng);
  var customers = seedCustomers(rng, 40);
  var days = daysBetweenIso(startIso, endIso) + 1;

  // Popularity: shuffled Zipf-like weights so a few products sell much more.
  var order = products.map(function (p, i) { return i; });
  for (var i = order.length - 1; i > 0; i--) {
    var j = rngInt(rng, 0, i);
    var tmp = order[i]; order[i] = order[j]; order[j] = tmp;
  }
  var weights = [];
  order.forEach(function (productIndex, rank) { weights[productIndex] = 1 / Math.pow(rank + 1, 0.8); });
  var totalWeight = weights.reduce(function (s, w) { return s + w; }, 0);

  // Orders: half spread evenly, half skewed to later months (a growing shop).
  var orders = [];
  var lineCount = 0;
  while (lineCount < target) {
    var u = rng();
    var dayIndex = Math.min(days - 1, Math.floor(days * (rng() < 0.5 ? u : Math.sqrt(u))));
    var nLines = Math.min(rngInt(rng, 1, 3), target - lineCount);
    var walkIn = rng() < 0.3;
    var customer = walkIn ? 'Walk-in' : customers[rngInt(rng, 0, customers.length - 1)];
    var picked = {};
    var lines = [];
    for (var k = 0; k < nLines; k++) {
      var pi = weightedPick(rng, weights, totalWeight);
      if (picked[pi]) continue; // keep one line per product per order
      picked[pi] = true;
      var qtyRoll = rng();
      lines.push({ sku: products[pi].sku, qty: qtyRoll < 0.6 ? 1 : qtyRoll < 0.85 ? 2 : rngInt(rng, 3, 5), unitPrice: products[pi].price });
    }
    orders.push({ date: addDaysIso(startIso, dayIndex), customer: customer, lines: lines, tie: orders.length });
    lineCount += lines.length;
  }
  orders.sort(function (a, b) { return a.date < b.date ? -1 : a.date > b.date ? 1 : a.tie - b.tie; });

  var sales = [];
  var seqByYear = {};
  orders.forEach(function (ord) {
    var year = Number(ord.date.slice(0, 4));
    seqByYear[year] = (seqByYear[year] || 0) + 1;
    var invoice = formatInvoiceNumber(year, seqByYear[year]);
    ord.lines.forEach(function (l) {
      sales.push({ date: ord.date, invoice: invoice, sku: l.sku, qty: l.qty, unitPrice: l.unitPrice, customer: ord.customer });
    });
  });

  // Stock: opening + purchases = sold + target ending stock.
  // A few products are pushed to OUT / LOW / just above reorder so the alerts have something to show.
  var sold = soldBySku(sales);
  var special = products.map(function (p, idx) { return idx; });
  for (var s = special.length - 1; s > 0; s--) {
    var t = rngInt(rng, 0, s);
    var tmp2 = special[s]; special[s] = special[t]; special[t] = tmp2;
  }
  var plan = {};
  special.slice(0, 1).forEach(function (idx) { plan[idx] = 'OUT'; });
  special.slice(1, 4).forEach(function (idx) { plan[idx] = 'LOW'; });
  special.slice(4, 7).forEach(function (idx) { plan[idx] = 'NEAR'; });

  var inventory = products.map(function (p, idx) {
    var ending;
    if (plan[idx] === 'OUT') ending = 0;
    else if (plan[idx] === 'LOW') ending = Math.max(1, p.reorderLevel - rngInt(rng, 1, 5));
    else if (plan[idx] === 'NEAR') ending = p.reorderLevel + rngInt(rng, 1, 3);
    else ending = p.reorderLevel + rngInt(rng, 15, 80);
    var needed = (sold[p.sku] || 0) + ending;
    var purchases = Math.floor((needed * 0.5) / 10) * 10;
    return { sku: p.sku, opening: needed - purchases, purchases: purchases };
  });

  return { products: products, inventory: inventory, sales: sales };
}
