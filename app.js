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
  AEON: ["อิออน", "#b6007a"],
};

const $ = (s) => document.querySelector(s);
const fmt = (n) => Math.round(n).toLocaleString("th-TH");
const num = (s) => Number(String(s).replace(/[^\d.]/g, "")) || 0;
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const state = { spend: {}, income: 0, fee: "any", off: new Set() };
const opened = new Set();
try { Object.assign(state, JSON.parse(localStorage.getItem("khum") || "{}"), { off: new Set() }); } catch {}

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

// monthly spend -> miles/month for one card
function milesOf(card) {
  const rows = CATS.map(([k, label]) => {
    const s = state.spend[k] || 0;
    const rate = k in card.earn ? card.earn[k] : card.earn.base;
    return { label, s, rate, m: rate ? s / rate : 0 };
  });
  return { total: rows.reduce((a, r) => a + r.m, 0), rows };
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
    ? `<b>${fmt(r.total * 12)}</b><span>ไมล์/ปี</span>`
    : c.cashback ? `<b>฿${fmt(cashOf(c) * 12)}</b><span>เงินคืน/ปี</span>` : `<span>สะสมแต้ม</span>`;
  const split = miles ? `<table class="split"><tbody>${r.rows.filter((x) => x.s).map((x) => `
      <tr><td>${x.label}</td><td>${x.rate ? `${x.rate} บาท = 1 ไมล์` : "ไม่ได้แต้ม"}</td><td>${fmt(x.m * 12)}</td></tr>`).join("")}
    </tbody></table>` : "";
  return `<li class="item${miles && i === 0 ? " first" : ""}${opened.has(c.id) ? " open" : ""}" data-id="${esc(c.id)}">
    <button type="button" aria-expanded="${opened.has(c.id)}">
      <span class="rank">${miles ? i + 1 : ""}</span>
      <span class="art${c.image ? " has-img" : ""}" style="--c:${color}" aria-hidden="true">${c.image ? `<img src="${esc(c.image)}" alt="" loading="lazy" onerror="this.parentElement.classList.remove('has-img');this.remove()">` : ""}</span>
      <span class="name"><b>${esc(c.name)}${c.inviteOnly ? '<span class="tag">เชิญเท่านั้น</span>' : ""}${c.kind === "cash" ? '<span class="tag">บัตรกดเงินสด</span>' : ""}${c.discontinued ? '<span class="tag">ยกเลิกแล้ว</span>' : ""}</b><span>${bankTh} · ${esc(c.network)}</span></span>
      <span class="score">${score}</span>
    </button>
    <div class="detail">
      ${c.image ? `<img class="big" src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">` : ""}
      <dl class="facts">
        <div><dt>ค่าธรรมเนียมรายปี</dt><dd>${feeText(c)}${c.feeNote ? `<br><span class="muted">${esc(c.feeNote)}</span>` : ""}</dd></div>
        <div><dt>รายได้ขั้นต่ำ</dt><dd>${c.minIncome ? `฿${fmt(c.minIncome)}/เดือน` : "—"}</dd></div>
        ${c.milesPartners?.length ? `<div><dt>โอนไมล์ไป</dt><dd>${c.milesPartners.map(esc).join(", ")}</dd></div>` : ""}
      </dl>
      ${split}
      ${c.perks?.length ? `<p class="note">${c.perks.map(esc).join(" · ")}</p>` : ""}
      ${c.caps ? `<p class="note">เงื่อนไข: ${esc(c.caps)}</p>` : ""}
      ${c.confidence === "low" ? `<p class="note warn">อัตรานี้ยังไม่ยืนยัน กรุณาเช็กกับธนาคาร</p>` : ""}
      ${c.url ? `<p class="note"><a href="${esc(c.url)}" target="_blank" rel="noopener">ดูรายละเอียดที่เว็บธนาคาร ↗</a></p>` : ""}
    </div>
  </li>`;
}

const canMile = (c) => c.earn && Object.values(c.earn).some((v) => v);

function render() {
  const pool = CARDS.filter(eligible);
  const ranked = pool.filter(canMile).sort((a, b) => milesOf(b).total - milesOf(a).total || (a.annualFee ?? 0) - (b.annualFee ?? 0));
  const rest = pool.filter((c) => !canMile(c)).sort((a, b) => cashOf(b) - cashOf(a));
  const total = CATS.reduce((a, [k]) => a + (state.spend[k] || 0), 0);

  $("#total").textContent = fmt(total);
  $("#meta").textContent = `${ranked.length} ใบที่แลกไมล์ได้` + (CARDS.length - pool.length ? ` · ซ่อน ${CARDS.length - pool.length} ใบตามตัวกรอง` : "");
  $("#list").innerHTML = ranked.length
    ? ranked.map((c, i) => item(c, i, true)).join("")
    : `<li class="empty">ไม่มีบัตรที่ตรงกับตัวกรอง ลองเปิดธนาคารเพิ่มหรือเปลี่ยนค่าธรรมเนียม</li>`;
  if (!total && ranked.length) $("#list").insertAdjacentHTML("afterbegin", `<li class="empty">กรอกยอดใช้จ่ายเพื่อจัดอันดับ</li>`);
  $("#nomiles").hidden = !rest.length;
  $("#nomiles summary").textContent = `บัตรที่แลกไมล์ไม่ได้ (${rest.length})`;
  $("#list2").innerHTML = rest.map((c, i) => item(c, i, false)).join("");

  try { localStorage.setItem("khum", JSON.stringify({ spend: state.spend, income: state.income, fee: state.fee })); } catch {}
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
document.addEventListener("click", (e) => {
  const btn = e.target.closest(".item > button");
  if (!btn) return;
  const li = btn.parentElement, open = li.classList.toggle("open");
  btn.setAttribute("aria-expanded", String(open));
  opened[open ? "add" : "delete"](li.dataset.id);
});

render();
