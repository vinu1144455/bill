const P = JSON.parse(document.getElementById('pdata').textContent);
const cart = {};
const $ = id => document.getElementById(id);

function tiles() {
  const q = $('search').value.toLowerCase();
  $('tiles').innerHTML = '';
  P.filter(p => (p.name + ' ' + (p.brand || '')).toLowerCase().includes(q)).forEach(p => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tile';
    b.innerHTML = '<b></b><small></small><span></span>';
    b.children[0].textContent = p.name;
    b.children[1].textContent = p.brand || '\u00a0';
    b.children[2].textContent = '₹' + Number(p.price).toFixed(2) + ' / ' + p.unit + ' · ' + p.stock + ' left';
    b.onclick = () => { cart[p.id] = Math.min((cart[p.id] || 0) + 1, p.stock); draw(); };
    $('tiles').append(b);
  });
}

function draw() {
  const box = $('items');
  box.innerHTML = '';
  let sub = 0, tax = 0;
  for (const id in cart) {
    const p = P.find(x => x.id == id), q = cart[id], amt = p.price * q;
    sub += amt;
    tax += amt * p.gst / 100;
    const r = document.createElement('div');
    r.className = 'item';
    r.innerHTML = '<div><b></b><small></small></div>' +
      '<div class="qty"><button type="button" data-d="-1">−</button>' +
      '<input name="qty" type="number" step="any" min="0.01"><button type="button" data-d="1">+</button></div>' +
      '<span class="amt"></span><button type="button" class="x" data-d="0" title="Remove">×</button>' +
      '<input type="hidden" name="pid">';
    r.querySelector('b').textContent = p.name;
    r.querySelector('small').textContent = (p.brand ? p.brand + ' · ' : '') + 'GST ' + p.gst + '%';
    r.querySelector('.amt').textContent = '₹' + amt.toFixed(2);
    r.querySelector('input[name=pid]').value = id;
    const inp = r.querySelector('input[name=qty]');
    inp.value = q;
    inp.onchange = () => { cart[id] = Math.min(Math.max(+inp.value || 1, 0.01), p.stock); draw(); };
    r.querySelectorAll('button').forEach(b => b.onclick = () => {
      const d = +b.dataset.d;
      if (!d) delete cart[id]; else cart[id] = Math.min(Math.max(q + d, 1), p.stock);
      draw();
    });
    box.append(r);
  }
  $('empty').style.display = box.children.length ? 'none' : 'block';
  $('sub').textContent = sub.toFixed(2);
  $('tax').textContent = tax.toFixed(2);
  $('tot').textContent = (sub + tax).toFixed(2);
  $('go').disabled = !box.children.length;
}

$('search').oninput = tiles;
tiles();
draw();
