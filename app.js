const CATS = [
  ["dining", "ร้านอาหาร", ""],
  ["online", "ช้อปออนไลน์", ""],
  ["grocery", "ซูเปอร์มาร์เก็ต", ""],
  ["travel", "สายการบิน / โรงแรม", "จองตรงหรือผ่านเอเจนซี่"],
  ["overseas", "ใช้จ่ายต่างประเทศ", "สกุลเงินต่างประเทศ"],
  ["fuel", "เติมน้ำมัน", ""],
  ["base", "อื่น ๆ", "ทุกอย่างที่ไม่อยู่ในหมวดข้างบน"],
];

const BANKS = {
  KBank: ["กสิกรไทย", "#138f2d"],
  SCB: ["ไทยพาณิชย์", "#4e2a84"],
  KTC: ["กรุงไทย (KTC)", "#c8102e"],
  UOB: ["ยูโอบี", "#0b3b8c"],
  BBL: ["กรุงเทพ", "#1e4598"],
  AMEX: ["อเมริกัน เอ็กซ์เพรส", "#016fd0"],
  Krungsri: ["กรุงศรี", "#d4a000"],
  TTB: ["ทีทีบี", "#0050f0"],
  GSB: ["ออมสิน", "#eb198d"],
  ICBC: ["ไอซีบีซี", "#b5121b"],
  BOC: ["แบงก์ออฟไชน่า", "#a6192e"],
  AEON: ["อิออน", "#b5006b"],
  LOTUS: ["โลตัส มันนี่", "#1e9e48"],
};

const AIRLINES = {
  "Royal Orchid Plus": "การบินไทย",
  "KrisFlyer": "สิงคโปร์แอร์ไลน์",
  "Asia Miles": "คาเธ่ย์แปซิฟิค",
  "Enrich": "มาเลเซียแอร์ไลน์",
  "Flying Blue": "แอร์ฟรานซ์ / KLM",
  "Etihad Guest": "เอทิฮัด",
  "Emirates Skywards": "เอมิเรตส์",
  "Qatar Privilege Club": "กาตาร์แอร์เวย์",
  "British Airways Club": "บริติชแอร์เวย์",
  "JAL Mileage Bank": "เจแปนแอร์ไลน์",
  "ANA Mileage Club": "ออล นิปปอน แอร์เวย์",
  "EVA Infinity MileageLands": "อีวีเอแอร์",
  "Korean Air SKYPASS": "โคเรียนแอร์",
  "Qantas Frequent Flyer": "แควนตัส",
  "FlyerBonus": "บางกอกแอร์เวย์ส",
  "AirAsia Rewards": "แอร์เอเชีย (แต้ม ไม่ใช่ไมล์)",
  "Lotusmiles": "เวียดนามแอร์ไลน์",
  "Turkish Miles&Smiles": "เตอร์กิชแอร์ไลน์",
  "Garuda Miles": "การูด้าอินโดนีเซีย",
  "Velocity": "เวอร์จิน ออสเตรเลีย",
};

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString("th-TH");
const num = (s) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const state = { spend: {}, income: 0, fee: "any", off: new Set(), air: [] };
const opened = new Set();
try { Object.assign(state, JSON.parse(localStorage.getItem("khum") || "{}"), { off: new Set() }); } catch {}
// a shared link (?dining=8000&air=KrisFlyer...) wins over what this browser remembered
const qs = new URLSearchParams(location.search);
if ([...qs.keys()].length) {
  state.spend = {};
  CATS.forEach(([k]) => qs.has(k) && (state.spend[k] = num(qs.get(k))));
  state.income = num(qs.get("income"));
  state.fee = qs.get("fee") || "any";
  state.air = qs.getAll("air");
}
const partnersOf = (c) => (c.transfer ? Object.keys(c.transfer) : c.milesPartners || []);
const ALL_AIR = [...new Set(CARDS.flatMap(partnersOf))]
  .sort((a, b) => CARDS.filter((c) => partnersOf(c).includes(b)).length - CARDS.filter((c) => partnersOf(c).includes(a)).length);
state.air = (state.air || []).filter((a) => ALL_AIR.includes(a));
// AirAsia points are not airline miles: count them only when picked explicitly
const NOT_MILES = ["AirAsia Rewards"];
const unit = (a) => (NOT_MILES.includes(a) ? "แต้ม" : "ไมล์");
const pool = () => (state.air.length ? state.air : ALL_AIR.filter((a) => !NOT_MILES.includes(a)));

// inputs
$("#cats").innerHTML = CATS.map(([k, label, hint]) => `
  <label class="row" for="s-${k}">
    <span>${label}${hint ? `<small>${hint}</small>` : ""}</span>
    <input id="s-${k}" data-k="${k}" type="text" inputmode="numeric" placeholder="0"
      value="${state.spend[k] ? fmt(state.spend[k]) : ""}">
  </label>`).join("");
if (state.income) $("#income").value = fmt(state.income);
document.querySelector(`input[name="fee"][value="${state.fee}"]`)?.click();

const banksUsed = Object.keys(BANKS).filter((b) => CARDS.some((c) => c.bank === b));
$("#banks").innerHTML = banksUsed.map((b) =>
  `<button type="button" class="chip" aria-pressed="true" data-b="${b}" style="--c:${BANKS[b][1]}"><i></i>${BANKS[b][0]}</button>`).join("");

// THB per mile for category k when transferring to airline a (null = no earn)
function rate(card, k, a) {
  if (card.points && card.transfer) {
    const p = k in card.points ? card.points[k] : card.points.base;
    const t = card.transfer[a];
    return p && t ? p * t : null;
  }
  // older entries only know the best partner's rate
  if (!(card.milesPartners || []).includes(a)) return null;
  return k in card.earn ? card.earn[k] : card.earn.base;
}

// monthly spend -> miles/month, using the card's best airline among the chosen ones
function milesOf(card) {
  const air = pool();
  let best = { total: 0, rows: [], airline: null };
  for (const a of partnersOf(card)) {
    if (!air.includes(a)) continue;
    const rows = CATS.map(([k, label]) => {
      const s = state.spend[k] || 0, r = rate(card, k, a);
      return { k, label, s, rate: r, m: r ? s / r : 0 };
    });
    const total = rows.reduce((x, r) => x + r.m, 0);
    if (!best.airline || total > best.total) best = { total, rows, airline: a };
  }
  return best;
}
function cashOf(card) {
  const cb = card.cashback || {};
  return CATS.reduce((a, [k]) => a + (state.spend[k] || 0) * ((k in cb ? cb[k] : cb.base) || 0) / 100, 0);
}

function eligible(c) {
  if (state.off.has(c.bank)) return false;
  if (state.fee !== "any" && (c.annualFee ?? Infinity) > Number(state.fee)) return false;
  if (state.income && c.minIncome && c.minIncome > state.income) return false;
  return true;
}

function feeText(c) {
  return c.annualFee == null ? "—" : c.annualFee ? `฿${fmt(c.annualFee)}` : "ฟรี";
}

function item(c, i, miles) {
  const [bankTh, color] = BANKS[c.bank] || [c.bank, "#666"];
  const r = miles ? milesOf(c) : null;
  const score = miles
    ? `<b>${fmt(r.total * 12)}</b><span>${unit(r.airline)}/ปี · ${esc(AIRLINES[r.airline] || r.airline)}</span>`
    : c.cashback ? `<b>฿${fmt(cashOf(c) * 12)}</b><span>เงินคืน/ปี</span>` : `<span>สะสมแต้ม</span>`;
  const split = miles ? `<table class="split"><tbody>${r.rows.filter((x) => x.s).map((x) => `
      <tr><td>${x.label}</td><td>${x.rate ? `${+x.rate.toFixed(1)} บาท = 1 ไมล์` : "ไม่ได้แต้ม"}</td><td>${fmt(x.m * 12)}</td></tr>`).join("")}
    </tbody></table>` : "";
  return `<li class="item${miles && i === 0 ? " first" : ""}${opened.has(c.id) ? " open" : ""}" data-id="${esc(c.id)}">
    <button type="button" aria-expanded="${opened.has(c.id)}">
      <span class="rank">${miles ? i + 1 : ""}</span>
      <span class="art${c.image ? " has-img" : ""}" style="--c:${color}" aria-hidden="true">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.parentElement.classList.remove('has-img');this.remove()">` : ""}</span>
      <span class="name"><b>${esc(c.name)}${c.inviteOnly ? '<span class="tag">เชิญเท่านั้น</span>' : ""}${c.kind === "cash" ? '<span class="tag">บัตรกดเงินสด</span>' : ""}${c.discontinued ? '<span class="tag">ยกเลิกแล้ว</span>' : ""}${miles && c.confidence === "low" ? '<span class="tag warn">ยังไม่ยืนยัน</span>' : ""}</b><span>${bankTh} · ${esc(c.network)}</span></span>
      <span class="score">${score}</span>
    </button>
    <div class="detail">
      ${c.image ? `<img class="big" src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">` : ""}
      <dl class="facts">
        <div><dt>ค่าธรรมเนียมรายปี</dt><dd>${feeText(c)}${c.feeNote ? `<br><span class="muted">${esc(c.feeNote)}</span>` : ""}</dd></div>
        <div><dt>รายได้ขั้นต่ำ</dt><dd>${c.minIncome ? `฿${fmt(c.minIncome)}/เดือน` : "—"}</dd></div>
        ${partnersOf(c).length ? `<div><dt>โอนไมล์ไป</dt><dd>${partnersOf(c).map((a) => esc(a) + (c.transfer?.[a] ? ` <span class="muted">${+c.transfer[a]}:1</span>` : "")).join("<br>")}</dd></div>` : ""}
      </dl>
      ${split}
      ${c.perks?.length ? `<p class="note">${c.perks.map(esc).join(" · ")}</p>` : ""}
      ${c.transferNote ? `<p class="note">การโอนไมล์: ${esc(c.transferNote)}</p>` : ""}
      ${c.caps ? `<p class="note">เงื่อนไข: ${esc(c.caps)}</p>` : ""}
      ${c.confidence === "low" ? `<p class="note warn">อัตรานี้ยังไม่ยืนยัน กรุณาเช็กกับธนาคาร</p>` : ""}
      ${c.url ? `<p class="note"><a href="${esc(c.url)}" target="_blank" rel="noopener">ดูรายละเอียดที่เว็บธนาคาร ↗</a></p>` : ""}
    </div>
  </li>`;
}

const canMileAny = (c) => partnersOf(c).length > 0 && (c.points || c.earn) && Object.values(c.points || c.earn).some((v) => v);
const canMile = (c) => canMileAny(c) && partnersOf(c).some((a) => pool().includes(a));

// best two-card split for one airline: each category goes to whichever card earns more
function bestPair(ranked) {
  const cats = CATS.filter(([k]) => state.spend[k]);
  let best = null;
  for (const a of pool()) {
    const cs = ranked.filter((c) => partnersOf(c).includes(a)).slice(0, 15);
    const m = (c, k) => { const r = rate(c, k, a); return r ? state.spend[k] / r : 0; };
    for (let i = 0; i < cs.length; i++) for (let j = i + 1; j < cs.length; j++) {
      const pick = cats.map(([k, label]) => (m(cs[i], k) >= m(cs[j], k) ? [cs[i], label, m(cs[i], k)] : [cs[j], label, m(cs[j], k)]));
      const total = pick.reduce((x, p) => x + p[2], 0);
      if (!best || total > best.total) best = { a, total, pick, cards: [cs[i], cs[j]] };
    }
  }
  return best;
}

function renderTip(ranked) {
  const tip = $("#tip");
  const single = ranked[0] ? milesOf(ranked[0]).total : 0;
  const p = ranked.length > 1 && single ? bestPair(ranked) : null;
  if (!p || p.total < single * 1.08 || p.pick.every((x) => x[0] === p.pick[0][0])) { tip.hidden = true; return; }
  const uses = p.cards.map((c) => [c, p.pick.filter((x) => x[0] === c).map((x) => x[1])]).filter(([, l]) => l.length);
  const fee = uses.reduce((x, [c]) => x + (c.annualFee || 0), 0);
  tip.hidden = false;
  tip.innerHTML = `<p class="tip-k">ใช้ 2 ใบคู่กัน สะสม ${esc(AIRLINES[p.a] || p.a)}</p>
    <p class="tip-v"><b>${fmt(p.total * 12)}</b> ${unit(p.a)}/ปี <span class="muted">มากกว่าใช้ใบเดียว ${fmt((p.total - single) * 12)} ${unit(p.a)}</span></p>
    <ul>${uses.map(([c, l]) => `<li><b>${esc(c.name)}</b> <span class="muted">${l.join(", ")}</span></li>`).join("")}</ul>
    <p class="muted tip-f">ค่าธรรมเนียมรวม ${fee ? `฿${fmt(fee)}/ปี` : "ฟรี"} · ${unit(p.a)}รวมกันได้เพราะเป็นโปรแกรมเดียวกัน</p>`;
}

function renderAir() {
  const q = $("#airq").value.trim().toLowerCase();
  const list = ALL_AIR.filter((a) => !q || a.toLowerCase().includes(q) || (AIRLINES[a] || "").includes(q));
  $("#airs").innerHTML = list.map((a) => `<button type="button" class="chip air" aria-pressed="${state.air.includes(a)}" data-a="${esc(a)}">
      <span>${esc(AIRLINES[a] || a)}</span><small>${esc(a)}</small></button>`).join("") || `<p class="muted">ไม่พบสายการบิน</p>`;
  $("#airsum").textContent = state.air.length ? `เลือก ${state.air.length} สายการบิน` : "ทุกสายการบิน";
  $("#airclear").hidden = !state.air.length;
}

function render() {
  const pool = CARDS.filter(eligible);
  const ranked = pool.filter(canMile).sort((a, b) => milesOf(b).total - milesOf(a).total || (a.annualFee ?? 0) - (b.annualFee ?? 0));
  const rest = pool.filter((c) => !canMileAny(c)).sort((a, b) => cashOf(b) - cashOf(a));
  const total = CATS.reduce((a, [k]) => a + (state.spend[k] || 0), 0);

  $("#total").textContent = fmt(total);
  const other = pool.filter((c) => canMileAny(c) && !canMile(c)).length;
  $("#meta").textContent = `${ranked.length} ใบ` + (other ? ` · อีก ${other} ใบโอนได้แค่สายการบินอื่น` : "") + (CARDS.length - pool.length ? ` · ซ่อน ${CARDS.length - pool.length} ใบตามตัวกรอง` : "");
  renderTip(total ? ranked : []);
  $("#list").innerHTML = ranked.length
    ? ranked.map((c, i) => item(c, i, true)).join("")
    : `<li class="empty">ไม่มีบัตรที่ตรงกับตัวกรอง ลองเปิดธนาคารเพิ่มหรือเปลี่ยนค่าธรรมเนียม</li>`;
  if (!total && ranked.length) $("#list").insertAdjacentHTML("afterbegin", `<li class="empty">กรอกยอดใช้จ่ายเพื่อจัดอันดับ</li>`);
  $("#nomiles").hidden = !rest.length;
  $("#nomiles summary").textContent = `บัตรที่แลกไมล์ไม่ได้ (${rest.length})`;
  $("#list2").innerHTML = rest.map((c, i) => item(c, i, false)).join("");

  const q = new URLSearchParams();
  CATS.forEach(([k]) => state.spend[k] && q.set(k, state.spend[k]));
  if (state.income) q.set("income", state.income);
  if (state.fee !== "any") q.set("fee", state.fee);
  state.air.forEach((a) => q.append("air", a));
  history.replaceState(null, "", q.size ? `?${q}` : location.pathname);
  try { localStorage.setItem("khum", JSON.stringify({ spend: state.spend, income: state.income, fee: state.fee, air: state.air })); } catch {}
}

// keep thousands separators while typing
function onNumber(el, set) {
  el.addEventListener("input", () => {
    const v = num(el.value);
    set(v);
    el.value = v ? fmt(v) : "";
    render();
  });
}
document.querySelectorAll("#cats input").forEach((el) => onNumber(el, (v) => (state.spend[el.dataset.k] = v)));
onNumber($("#income"), (v) => (state.income = v));
document.querySelectorAll('input[name="fee"]').forEach((el) => el.addEventListener("change", () => { state.fee = el.value; render(); }));
$("#banks").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const on = b.getAttribute("aria-pressed") === "true";
  b.setAttribute("aria-pressed", String(!on));
  state.off[on ? "add" : "delete"](b.dataset.b);
  render();
});
$("#share").addEventListener("click", async (e) => {
  try { await navigator.clipboard.writeText(location.href); e.target.textContent = "คัดลอกแล้ว"; }
  catch { prompt("คัดลอกลิงก์นี้", location.href); }
  setTimeout(() => (e.target.textContent = "คัดลอกลิงก์ผลลัพธ์"), 2000);
});
$("#airq").addEventListener("input", renderAir);
$("#airs").addEventListener("click", (e) => {
  const b = e.target.closest(".chip");
  if (!b) return;
  const a = b.dataset.a;
  state.air = state.air.includes(a) ? state.air.filter((x) => x !== a) : [...state.air, a];
  renderAir();
  render();
});
$("#airclear").addEventListener("click", () => { state.air = []; renderAir(); render(); });
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".item > button");
  if (!btn) return;
  const li = btn.parentElement, open = li.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(open));
  opened[open ? "add" : "delete"](li.dataset.id);
});

renderAir();
render();
