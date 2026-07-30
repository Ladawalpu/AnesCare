/* ========================================================================
   ดมยาแคร์ — app.js
   เก็บ state ด้วย localStorage เพื่อให้ข้อมูลอยู่ครบแม้ปิดแอปไปแล้ว
   ======================================================================== */

/**
 * วาง Web App URL ของ Google Apps Script (ไฟล์ Code.gs) ตรงนี้
 * เมื่อ deploy แล้วจะได้ URL รูปแบบ:
 * https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxxxx/exec
 * ถ้ายังไม่ตั้งค่า แอปจะยังทำงานปกติ แต่จะบันทึกไว้แค่ในเครื่องนี้เท่านั้น (ไม่ส่งขึ้น Sheets)
 */
const SHEET_WEBAPP_URL = "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE";

/**
 * ส่งข้อมูลไปบันทึกที่ Google Sheets แบบไม่บล็อกการทำงานของแอป
 * ใช้ mode:"no-cors" เพราะ Apps Script ไม่ได้ตั้งค่า CORS header ให้อ่านผลลัพธ์กลับ
 * (เราไม่จำเป็นต้องอ่านผลลัพธ์ เพราะข้อมูลถูกบันทึกไว้ใน localStorage อยู่แล้วเป็นหลัก)
 */
function sendToSheet(sheetType, payload){
  if(!SHEET_WEBAPP_URL || SHEET_WEBAPP_URL.indexOf("PASTE_YOUR") !== -1) return;
  fetch(SHEET_WEBAPP_URL, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ sheetType, payload })
  }).catch(()=>{ /* เงียบไว้ — ข้อมูลยังปลอดภัยใน localStorage แม้ส่งขึ้น Sheets ไม่สำเร็จ */ });
}

const LS_KEY = "anescare_state_v1";

function loadState(){
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw) return JSON.parse(raw);
  }catch(e){}
  return {
    surgeryDate: null,
    checklist: {},
    assessment: null,
    feedbackHistory: []
  };
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

let state = loadState();

/* ---------------------------------------------------------------------- */
/* CONTENT DATA                                                           */
/* ---------------------------------------------------------------------- */

const TIMELINE = [
  { when:"7 วันก่อนผ่าตัด", key:"d7", items:[
    ["💊","ยาที่ต้องหยุด","แจ้งวิสัญญีแพทย์เรื่องยาละลายลิ่มเลือด/ยาต้านเกล็ดเลือด และอาหารเสริม/สมุนไพรที่รับประทานอยู่ทั้งหมด บางชนิดต้องหยุดล่วงหน้า 5-7 วัน"],
    ["📋","วิธีเตรียมตัว","พักผ่อนให้เพียงพอ งดสูบบุหรี่และแอลกอฮอล์เพื่อลดความเสี่ยงระหว่างดมยาสลบ"],
  ]},
  { when:"3 วันก่อนผ่าตัด", key:"d3", items:[
    ["💊","ยาที่รับประทานต่อ","ยาโรคประจำตัวส่วนใหญ่ (เช่น ความดัน หัวใจ) มักให้กินต่อตามปกติ ยกเว้นแพทย์สั่งให้หยุด"],
    ["🩺","ตรวจสอบสุขภาพทั่วไป","สังเกตอาการไข้ ไอ หวัด หากไม่สบายควรแจ้งเจ้าหน้าที่ก่อนถึงวันนัด"],
  ]},
  { when:"1 วันก่อนผ่าตัด", key:"d1", items:[
    ["🛁","การอาบน้ำ","อาบน้ำสระผมให้สะอาด ตัดเล็บให้สั้น ล้างเครื่องสำอาง/ทาเล็บออกให้หมด"],
    ["📦","จัดเตรียมของใช้","เตรียมเอกสารประจำตัว บัตรโรงพยาบาล ยาประจำตัว (ถ้าต้องนำมา) และของใช้ส่วนตัวที่จำเป็น"],
  ]},
  { when:"คืนก่อนผ่าตัด", key:"night", items:[
    ["🚫","งดน้ำงดอาหาร (NPO)","งดอาหารมื้อหนัก/นมตามเวลาที่ทีมแจ้ง โดยทั่วไปมักเริ่มงดอาหารตั้งแต่เที่ยงคืน (ยึดตามคำสั่งแพทย์ของท่านเป็นหลัก)"],
    ["😴","พักผ่อน","นอนหลับให้เพียงพอ หลีกเลี่ยงความเครียดและกิจกรรมหนัก"],
  ]},
  { when:"เช้าวันผ่าตัด", key:"morning", items:[
    ["💍","ถอดเครื่องประดับ","ถอดแหวน สร้อย ต่างหู นาฬิกา และของมีค่าฝากญาติหรือเก็บไว้ที่บ้าน"],
    ["🏥","การมาถึงโรงพยาบาล","มาถึงตามเวลานัดหมาย แจ้งชื่อ-นามสกุลและ HN ที่จุดลงทะเบียนก่อนผ่าตัด"],
  ]},
];

const CHECKLIST_ITEMS = [
  {id:"npo", label:"งดน้ำงดอาหารแล้ว"},
  {id:"denture", label:"ถอดฟันปลอม"},
  {id:"contact", label:"ถอดคอนแทคเลนส์"},
  {id:"jewelry", label:"ถอดเครื่องประดับ"},
  {id:"nail", label:"ถอดเล็บปลอม/ล้างสีทาเล็บ"},
  {id:"docs", label:"นำเอกสารครบ (บัตรประชาชน/บัตร รพ.)"},
];

const ANES_QA = [
  ["😴","ดมยาสลบคืออะไร","การใช้ยาเพื่อทำให้ผู้ป่วยหลับ ไม่รู้สึกตัว และไม่เจ็บปวดระหว่างการผ่าตัด โดยมีวิสัญญีแพทย์ดูแลสัญญาณชีพอย่างใกล้ชิดตลอดการผ่าตัด"],
  ["🧊","บล็อกหลังคืออะไร","การฉีดยาชาเข้าบริเวณหลังเพื่อทำให้ร่างกายส่วนล่างชาและไม่รู้สึกเจ็บ โดยผู้ป่วยยังรู้สึกตัวอยู่ (อาจให้ยาเพื่อช่วยให้ผ่อนคลาย/ง่วงร่วมด้วยได้)"],
  ["🫁","ต้องใส่ท่อช่วยหายใจหรือไม่","ขึ้นอยู่กับชนิดการผ่าตัดและวิธีระงับความรู้สึกที่แพทย์เลือกใช้ ทีมวิสัญญีจะประเมินและอธิบายให้ทราบก่อนวันผ่าตัดเสมอ"],
  ["⏰","จะตื่นเมื่อไร","ส่วนใหญ่จะเริ่มรู้สึกตัวภายในห้องพักฟื้นทันทีหลังผ่าตัดเสร็จ ระยะเวลาอาจแตกต่างกันไปตามชนิดการผ่าตัดและการตอบสนองของแต่ละคน"],
  ["🩹","เจ็บไหม","ระหว่างดมยาสลบจะไม่รู้สึกเจ็บ ส่วนความเจ็บแผลหลังผ่าตัดทีมงานจะมียาและวิธีจัดการความปวดให้อย่างเหมาะสม"],
];

const POST_OP = [
  ["🩹","ปวดแผล","เป็นอาการปกติหลังผ่าตัด ทีมงานจะประเมินและให้ยาแก้ปวดตามความเหมาะสม แจ้งพยาบาลได้หากปวดมาก"],
  ["🤢","คลื่นไส้","อาจเกิดขึ้นได้จากฤทธิ์ยาสลบ มักดีขึ้นภายในไม่กี่ชั่วโมง มียาช่วยบรรเทาอาการได้"],
  ["💫","เวียนศีรษะ","พบได้บ่อยในช่วงแรกหลังฟื้นจากยาสลบ ควรลุกนั่ง-ยืนอย่างช้าๆ และมีคนช่วยพยุงในการเคลื่อนไหวครั้งแรก"],
  ["😣","เจ็บคอ","อาจเกิดจากการใส่ท่อช่วยหายใจระหว่างผ่าตัด อาการมักดีขึ้นเองภายใน 1-2 วัน"],
  ["🍚","รับประทานอาหารเมื่อไร","เริ่มจากจิบน้ำทีละน้อยเมื่อรู้สึกตัวดีและไม่คลื่นไส้ ก่อนขยับไปอาหารอ่อนตามคำแนะนำของทีมงาน"],
  ["🚶","เดินเมื่อไร","ทีมงานจะช่วยประเมินและพยุงให้ลุกเดินครั้งแรกเมื่อร่างกายพร้อม เพื่อลดความเสี่ยงภาวะแทรกซ้อน"],
  ["🏡","กลับบ้านเมื่อไร","ขึ้นอยู่กับชนิดการผ่าตัดและการฟื้นตัวของแต่ละคน แพทย์จะเป็นผู้พิจารณาอนุญาตให้กลับบ้าน"],
];

const GOING_HOME = [
  ["💊","รับประทานยา","กินยาตามที่แพทย์สั่งให้ครบถ้วนตรงเวลา ไม่ควรปรับขนาดยาเองโดยไม่ปรึกษาแพทย์"],
  ["🚿","การอาบน้ำ","ทำตามคำแนะนำเรื่องแผลผ่าตัดที่ทีมงานให้ไว้ บางกรณีอาจต้องเลี่ยงไม่ให้แผลโดนน้ำโดยตรงในช่วงแรก"],
  ["🚗","การขับรถ","ควรงดขับรถอย่างน้อย 24 ชั่วโมงหลังดมยาสลบ หรือตามระยะเวลาที่แพทย์แนะนำ เนื่องจากฤทธิ์ยาอาจทำให้ปฏิกิริยาตอบสนองช้าลง"],
  ["🍷","การดื่มสุรา","งดเครื่องดื่มแอลกอฮอล์ในช่วงที่ยังรับประทานยาแก้ปวดหรือยาปฏิชีวนะ"],
  ["🏃","การออกกำลังกาย","หลีกเลี่ยงกิจกรรมหนักหรือยกของหนักจนกว่าแผลจะหายดี ควรปรึกษาแพทย์ก่อนกลับไปออกกำลังกายตามปกติ"],
];

const DANGER_SIGNS = [
  "หายใจลำบากหรือหายใจหอบเหนื่อยผิดปกติ",
  "เลือดออกจากแผลผ่าตัดไม่หยุด",
  "มีไข้สูง",
  "ปวดแผลรุนแรงผิดปกติ ไม่ดีขึ้นแม้กินยาแก้ปวด",
];

const FAQ = [
  ["ดมยาสลบทำให้ความจำเสื่อมหรือไม่","ไม่มีหลักฐานยืนยันว่าการดมยาสลบทั่วไปทำให้ความจำเสื่อมถาวรในผู้ป่วยส่วนใหญ่ อาการมึนงงหรือสับสนหลังผ่าตัดมักเป็นชั่วคราวและดีขึ้นได้เอง โดยเฉพาะในผู้สูงอายุอาจใช้เวลาฟื้นตัวนานกว่าเล็กน้อย"],
  ["ทำไมต้องงดน้ำงดอาหารก่อนผ่าตัด","เพื่อลดความเสี่ยงที่อาหารหรือน้ำในกระเพาะจะไหลย้อนเข้าปอดขณะสลบ ซึ่งอาจเป็นอันตรายร้ายแรงได้ จึงจำเป็นต้องงดตามระยะเวลาที่ทีมวิสัญญีกำหนดอย่างเคร่งครัด"],
  ["ทำไมบางคนต้องใส่สายสวนปัสสาวะ","ใช้สำหรับผ่าตัดที่ใช้เวลานาน หรือจำเป็นต้องติดตามปริมาณปัสสาวะอย่างใกล้ชิดระหว่างและหลังผ่าตัด ทีมงานจะถอดออกเมื่อไม่จำเป็นแล้ว"],
  ["หลังบล็อกหลังจะเดินได้เมื่อไร","ต้องรอจนกว่าฤทธิ์ยาชาจะหมดและกล้ามเนื้อขากลับมามีแรงและความรู้สึกเป็นปกติ ทีมงานจะประเมินความพร้อมก่อนช่วยพยุงให้ลุกเดินครั้งแรกเสมอ"],
  ["ให้นมลูกได้เมื่อไรหลังดมยาสลบ","โดยทั่วไปเมื่อคุณแม่รู้สึกตัวดีและพร้อมก็สามารถให้นมได้ตามคำแนะนำของแพทย์ผู้ดูแล ควรปรึกษาทีมวิสัญญีและสูติแพทย์ล่วงหน้าถึงชนิดยาที่ใช้"],
  ["ดมยาสลบอันตรายหรือไม่","การระงับความรู้สึกในปัจจุบันมีความปลอดภัยสูงจากการดูแลของวิสัญญีแพทย์ที่เฝ้าติดตามสัญญาณชีพตลอดเวลา ความเสี่ยงจะแตกต่างกันไปตามโรคประจำตัวและชนิดการผ่าตัดของแต่ละบุคคล ทีมงานจะประเมินและอธิบายความเสี่ยงเฉพาะบุคคลให้ทราบก่อนผ่าตัด"],
];

/* ---------------------------------------------------------------------- */
/* NAVIGATION                                                             */
/* ---------------------------------------------------------------------- */

const TABS = ["home","prepare","assess","learn","contact"];

function goTo(tab, sub){
  TABS.forEach(t=>{
    document.getElementById("view-"+t).classList.toggle("active", t===tab);
  });
  document.querySelectorAll(".navbtn").forEach(b=>{
    b.classList.toggle("active", b.dataset.tab===tab);
  });
  if(sub) switchSub(tab, sub);
  window.scrollTo({top:0, behavior:"instant"});
}

function switchSub(tab, sub){
  const parent = document.getElementById("view-"+tab);
  parent.querySelectorAll(".pill").forEach(p=>{
    p.classList.toggle("active", p.dataset.sub===sub);
  });
  parent.querySelectorAll(".subview").forEach(s=>{
    s.classList.toggle("active", s.id === tab+"-"+sub);
  });
}

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 2200);
}

/* ---------------------------------------------------------------------- */
/* HOME VIEW                                                              */
/* ---------------------------------------------------------------------- */

function renderHome(){
  const card = document.getElementById("homeDateCard");
  const todoCard = document.getElementById("todayTodoCard");
  const todoList = document.getElementById("todayTodoList");

  if(!state.surgeryDate){
    card.innerHTML = `
      <span class="eyebrow">เริ่มต้นใช้งาน</span>
      <div class="no-date">
        <div style="font-size:38px;">🗓️</div>
        <h3 style="margin-top:6px;">ระบุวันผ่าตัดของท่าน</h3>
        <p class="muted">เพื่อให้แอปแนะนำสิ่งที่ต้องเตรียมตัวในแต่ละวันให้อัตโนมัติ</p>
        <input type="date" id="surgeryDateInput">
        <button class="btn-primary" style="margin-top:12px;" onclick="setSurgeryDate()">บันทึกวันผ่าตัด</button>
      </div>`;
    todoCard.style.display = "none";
    return;
  }

  const today = new Date(); today.setHours(0,0,0,0);
  const sd = new Date(state.surgeryDate); sd.setHours(0,0,0,0);
  const diffDays = Math.round((sd - today)/86400000);

  let ringPct = 0, label = "", num = "";
  if(diffDays > 7){ ringPct = 10; num = diffDays; label = "วันก่อนถึงวันผ่าตัด"; }
  else if(diffDays > 0){ ringPct = Math.max(8,(1-(diffDays/8))*100); num = diffDays; label = "วันก่อนถึงวันผ่าตัด"; }
  else if(diffDays === 0){ ringPct = 100; num = "วันนี้"; label = "วันผ่าตัด ขอให้ผ่านไปด้วยดี 💜"; }
  else { ringPct = 100; num = "✓"; label = "ผ่าตัดเสร็จแล้ว ดูแลตัวเองต่อได้ที่คลังความรู้"; }

  const circumference = 2*Math.PI*65;
  const offset = circumference - (Math.min(ringPct,100)/100)*circumference;

  card.innerHTML = `
    <span class="eyebrow">${diffDays>=0 ? "นับถอยหลังวันผ่าตัด" : "สถานะการผ่าตัด"}</span>
    <div class="countdown-ring">
      <svg viewBox="0 0 150 150">
        <circle class="ring-bg" cx="75" cy="75" r="65"></circle>
        <circle class="ring-fg" cx="75" cy="75" r="65" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
      </svg>
      <div class="countdown-center">
        <div class="num">${num}</div>
      </div>
    </div>
    <p class="muted" style="text-align:center;">${label}</p>
    <button class="btn-ghost" onclick="clearSurgeryDate()">แก้ไขวันผ่าตัด</button>
  `;

  // Today todo based on nearest timeline stage
  let stageKey = null;
  if(diffDays >= 7) stageKey = "d7";
  else if(diffDays >= 4) stageKey = "d3";
  else if(diffDays === 2 || diffDays===1) stageKey = "d1";
  else if(diffDays === 0) stageKey = "morning";
  if(diffDays === 1) stageKey = "night";

  const stage = TIMELINE.find(s=>s.key===stageKey);
  if(stage && diffDays >= 0){
    todoCard.style.display = "block";
    todoList.innerHTML = stage.items.map(i=>`<li>${i[1]}</li>`).join("");
  } else {
    todoCard.style.display = "none";
  }

  renderProgress();
}

function setSurgeryDate(){
  const v = document.getElementById("surgeryDateInput").value;
  if(!v){ showToast("กรุณาเลือกวันที่"); return; }
  state.surgeryDate = v;
  saveState();
  renderHome();
  showToast("บันทึกวันผ่าตัดแล้ว");
}
function clearSurgeryDate(){
  state.surgeryDate = null;
  saveState();
  renderHome();
}

function renderProgress(){
  const total = CHECKLIST_ITEMS.length;
  const done = Object.values(state.checklist).filter(Boolean).length;
  const pct = Math.round((done/total)*100);
  const fill = document.getElementById("progressFill");
  const label = document.getElementById("progressLabel");
  if(fill){ fill.style.width = pct+"%"; }
  if(label){ label.textContent = `เตรียมตัวไปแล้ว ${done}/${total} ขั้นตอน`; }
}

/* ---------------------------------------------------------------------- */
/* PREPARE — TIMELINE + CHECKLIST                                         */
/* ---------------------------------------------------------------------- */

function renderTimeline(){
  const el = document.getElementById("timelineList");
  el.innerHTML = TIMELINE.map((stage, idx)=>`
    <div class="tl-item" data-idx="${idx}">
      <div class="tl-dot"></div>
      <div class="tl-head" onclick="toggleTimeline(${idx})">
        <span class="when">${stage.when}</span>
        <span class="caret">▾</span>
      </div>
      <div class="tl-body">
        <div class="tl-body-inner">
          ${stage.items.map(i=>`
            <div class="row">
              <div class="ic">${i[0]}</div>
              <div class="txt"><b>${i[1]}</b><span>${i[2]}</span></div>
            </div>`).join("")}
        </div>
      </div>
    </div>
  `).join("");
}
function toggleTimeline(idx){
  document.querySelectorAll(`#timelineList .tl-item`)[idx].classList.toggle("open");
}

function renderChecklist(){
  const el = document.getElementById("checklistItems");
  el.innerHTML = CHECKLIST_ITEMS.map(item=>`
    <div class="check-item ${state.checklist[item.id]?'checked':''}" onclick="toggleCheck('${item.id}')">
      <div class="box"></div>
      <div class="lbl">${item.label}</div>
    </div>
  `).join("");
  const done = Object.values(state.checklist).filter(Boolean).length;
  const bannerEl = document.getElementById("checklistBanner");
  if(done === CHECKLIST_ITEMS.length){
    bannerEl.innerHTML = `<div class="banner-ready">✅ พร้อมแล้ว! เตรียมตัวครบทุกข้อ ขอให้การผ่าตัดผ่านไปด้วยดีนะคะ</div>`;
  } else {
    bannerEl.innerHTML = `<div class="banner-locked">เหลืออีก ${CHECKLIST_ITEMS.length-done} ข้อ ก่อนพร้อมเดินทางมาโรงพยาบาล</div>`;
  }
}
function toggleCheck(id){
  state.checklist[id] = !state.checklist[id];
  saveState();
  renderChecklist();
  renderProgress();
}

/* ---------------------------------------------------------------------- */
/* SELF ASSESSMENT WIZARD                                                 */
/* ---------------------------------------------------------------------- */

const DISEASE_OPTIONS = [
  "โรคหัวใจ","ความดันโลหิตสูง","ไขมันในเลือดสูง","เบาหวาน","หอบหืด",
  "ถุงลมโป่งพอง","เกาต์","ไทรอยด์","กรดไหลย้อน","ต่อมลูกหมากโต"
];

// ฐานข้อมูลยาที่รับประทานประจำ (พิมพ์ตัวอักษรแรกแล้วขึ้นรายการให้เลือก)
// note = คำแนะนำทั่วไปเรื่องวันหยุดยา/กินต่อ (ไม่ใช่คำสั่งทางการแพทย์ ต้องยืนยันกับแพทย์เฉพาะรายเสมอ)
const DRUG_DB = [
  {name:"Amlodipine", category:"ยาลดความดันโลหิต", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด (จิบน้ำเปล่าเล็กน้อยได้)", flag:"info"},
  {name:"Enalapril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Losartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Valsartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Atenolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด การหยุดกะทันหันอาจเป็นอันตราย", flag:"info"},
  {name:"Propranolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด การหยุดกะทันหันอาจเป็นอันตราย", flag:"info"},
  {name:"Nifedipine", category:"ยาลดความดันโลหิต", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Hydrochlorothiazide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Metformin", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Glipizide", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Gliclazide", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Insulin", category:"ยาฉีดเบาหวาน", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Simvastatin", category:"ยาลดไขมัน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Atorvastatin", category:"ยาลดไขมัน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Rosuvastatin", category:"ยาลดไขมัน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Salbutamol", category:"ยาขยายหลอดลม (หอบหืด/ถุงลมโป่งพอง)", note:"กินต่อ/พ่นได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Budesonide", category:"ยาสูดพ่นสเตียรอยด์ (หอบหืด)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Theophylline", category:"ยาขยายหลอดลม", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากมีผลต่อระดับยาในเลือด", flag:"warn"},
  {name:"Ipratropium", category:"ยาสูดพ่น (ถุงลมโป่งพอง)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Allopurinol", category:"ยาโรคเกาต์", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Colchicine", category:"ยาโรคเกาต์", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Febuxostat", category:"ยาโรคเกาต์", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Levothyroxine", category:"ยาไทรอยด์", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Propylthiouracil", category:"ยาไทรอยด์ (คอพอกเป็นพิษ)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Methimazole", category:"ยาไทรอยด์ (คอพอกเป็นพิษ)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Omeprazole", category:"ยากรดไหลย้อน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Esomeprazole", category:"ยากรดไหลย้อน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Ranitidine", category:"ยากรดไหลย้อน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Domperidone", category:"ยาช่วยการบีบตัวของกระเพาะ", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Tamsulosin", category:"ยาต่อมลูกหมากโต", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Finasteride", category:"ยาต่อมลูกหมากโต", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Doxazosin", category:"ยาต่อมลูกหมากโต/ความดัน", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Aspirin", category:"ยาต้านเกล็ดเลือด", note:"มักต้องหยุดล่วงหน้าตามคำสั่งแพทย์ (มักประมาณ 5-7 วัน) ห้ามหยุดเอง", flag:"warn"},
  {name:"Clopidogrel", category:"ยาต้านเกล็ดเลือด", note:"มักต้องหยุดล่วงหน้าตามคำสั่งแพทย์ (มักประมาณ 5-7 วัน) ห้ามหยุดเอง", flag:"warn"},
  {name:"Warfarin", category:"ยาต้านการแข็งตัวของเลือด", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยาและอาจต้องเจาะเลือดตรวจก่อนผ่าตัด ห้ามหยุดเอง", flag:"warn"},
  {name:"Digoxin", category:"ยาโรคหัวใจ", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามระดับยาใกล้ชิด", flag:"warn"},
  {name:"น้ำมันปลา", category:"อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"แปะก๊วย", category:"สมุนไพร", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"โสม", category:"สมุนไพร", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจมีผลต่อการแข็งตัวของเลือดและระดับน้ำตาล", flag:"warn"},
  {name:"กระเทียมสกัด", category:"อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"วิตามินอี", category:"วิตามิน/อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด หากรับประทานขนาดสูงต่อเนื่อง", flag:"info"},
];

const ASSESS_STEPS = [
  {key:"disease", q:"ท่านมีโรคประจำตัวข้อใดต่อไปนี้บ้าง (เลือกได้มากกว่า 1 ข้อ)", type:"multi"},
  {key:"meds", q:"ยาที่รับประทานเป็นประจำ (ถ้ามี ระบุได้สูงสุด 7 รายการ)", type:"meds"},
  {key:"prevAnes", q:"ท่านเคยดมยาสลบ/ระงับความรู้สึกมาก่อนหรือไม่", type:"yn_text", ph:"ระบุปัญหาที่เคยพบ (ถ้ามี) เช่น แพ้ยาสลบ อาเจียนมาก"},
  {key:"looseTeeth", q:"ท่านมีฟันโยกหรือฟันปลอมหรือไม่", type:"yn"},
  {key:"snore", q:"ท่านนอนกรนเสียงดัง หรือเคยได้รับการวินิจฉัยภาวะหยุดหายใจขณะหลับหรือไม่", type:"yn"},
  {key:"smoke", q:"ท่านสูบบุหรี่หรือไม่", type:"yn"},
  {key:"alcohol", q:"ท่านดื่มเครื่องดื่มแอลกอฮอล์เป็นประจำหรือไม่", type:"yn"},
];

let assessStep = 0;
let assessAnswers = {};

function renderAssessWizard(){
  if(state.assessment){
    renderAssessSummary(state.assessment);
    return;
  }
  document.getElementById("assessWizard").style.display = "block";
  document.getElementById("assessSummary").style.display = "none";
  drawAssessStep();
}

function drawAssessStep(){
  const el = document.getElementById("assessWizard");
  const s = ASSESS_STEPS[assessStep];

  if(!assessAnswers[s.key]){
    if(s.type==="multi") assessAnswers[s.key] = {selected:[], other:""};
    else if(s.type==="meds") assessAnswers[s.key] = {items: Array.from({length:7}, ()=>({name:"",category:"",note:"",flag:""}))};
    else assessAnswers[s.key] = {yn:null, text:""};
  }
  const cur = assessAnswers[s.key];

  const dots = ASSESS_STEPS.map((_,i)=>`<div class="step-dot ${i===assessStep?'on':''}"></div>`).join("");

  let bodyHtml;
  if(s.type==="multi"){
    bodyHtml = `
      <div class="chip-grid">
        ${DISEASE_OPTIONS.map(opt=>`
          <button class="seg-btn ${cur.selected.includes(opt)?'sel':''}" onclick="toggleDisease('${opt.replace(/'/g,"\\'")}')">${opt}</button>
        `).join("")}
      </div>
      <div class="field" style="margin-top:14px;">
        <label style="font-size:12.5px;">อื่นๆ (ถ้ามี)</label>
        <textarea rows="2" id="diseaseOther" placeholder="ระบุโรคประจำตัวอื่นๆ ที่ไม่มีในรายการ" oninput="assessAnswers.disease.other=this.value">${cur.other||''}</textarea>
      </div>`;
  } else if(s.type==="meds"){
    bodyHtml = `
      <p class="muted" style="margin-bottom:12px;">ไม่จำเป็นต้องกรอกครบทุกช่อง เว้นว่างไว้ได้หากไม่มี</p>
      ${renderMedsRows(cur)}`;
  } else {
    bodyHtml = `
      <div class="seg" id="ynSeg">
        <button class="seg-btn ${cur.yn===true?'sel':''}" onclick="setYn(true)">มี / ใช่</button>
        <button class="seg-btn ${cur.yn===false?'sel':''}" onclick="setYn(false)">ไม่มี / ไม่ใช่</button>
      </div>
      ${s.type==="yn_text" ? `
        <div class="field" style="margin-top:14px;">
          <textarea rows="2" id="ynText" placeholder="${s.ph}" oninput="assessAnswers['${s.key}'].text=this.value">${cur.text}</textarea>
        </div>` : ``}`;
  }

  const answered = isStepAnswered(s);

  el.innerHTML = `
    <div class="step-dots">${dots}</div>
    <div class="card">
      <span class="eyebrow">ข้อ ${assessStep+1} จาก ${ASSESS_STEPS.length}</span>
      <h3 style="font-size:16px; margin-bottom:14px;">${s.q}</h3>
      ${bodyHtml}
    </div>
    <div style="display:flex; gap:10px;">
      ${assessStep>0 ? `<button class="btn-ghost" onclick="prevAssessStep()">ย้อนกลับ</button>` : ``}
      <button class="btn-primary" onclick="nextAssessStep()" ${answered?'':'disabled'} id="assessNextBtn">
        ${assessStep===ASSESS_STEPS.length-1 ? "ดูสรุปผล" : "ถัดไป"}
      </button>
    </div>
  `;
}

function isStepAnswered(s){
  if(s.type==="yn" || s.type==="yn_text"){
    return !!(assessAnswers[s.key] && assessAnswers[s.key].yn !== null);
  }
  return true; // multi/meds: ไม่เลือกเลยก็ถือว่าตอบแล้ว (แปลว่า "ไม่มี")
}

function toggleDisease(opt){
  const cur = assessAnswers.disease;
  const i = cur.selected.indexOf(opt);
  if(i>-1) cur.selected.splice(i,1); else cur.selected.push(opt);
  drawAssessStep();
}

/* --- ยาที่รับประทานประจำ: ช่อง autocomplete 7 ช่อง --- */

function findDrugMatches(q){
  if(!q) return [];
  const ql = q.trim().toLowerCase();
  if(!ql) return [];
  return DRUG_DB.filter(d => d.name.toLowerCase().startsWith(ql)).slice(0,6);
}

function renderMedsRows(cur){
  return cur.items.map((it,idx)=>`
    <div class="med-row">
      <label class="med-row-label">ยาตัวที่ ${idx+1}</label>
      <input type="text" class="txt-input" id="medInput-${idx}"
        placeholder="พิมพ์ชื่อยา เช่น Amlodipine, Metformin"
        value="${(it.name||'').replace(/"/g,'&quot;')}"
        oninput="onMedInput(${idx}, this.value)"
        onfocus="onMedInput(${idx}, this.value)"
        onblur="setTimeout(function(){hideMedSuggest(${idx});}, 150)">
      <div class="med-suggest" id="medSuggest-${idx}"></div>
      <div id="medNote-${idx}">${it.name && it.note ? renderMedNoteHtml(it) : ""}</div>
    </div>
  `).join("");
}

function renderMedNoteHtml(it){
  const icon = it.flag === "warn" ? "⚠️" : "ℹ️";
  return `<div class="summary-flag ${it.flag||'info'}" style="margin-top:8px;">${icon} <b>${it.category}</b><br>${it.note}</div>`;
}

function onMedInput(idx, val){
  const items = assessAnswers.meds.items;
  // ถ้าผู้ใช้พิมพ์ใหม่ไม่ตรงกับที่เคยเลือกไว้ ให้ล้างข้อมูลยาเดิมก่อน (เก็บแค่ข้อความที่พิมพ์)
  if(items[idx].name !== val){
    items[idx] = {name: val, category:"", note:"", flag:""};
  }
  const noteBox = document.getElementById(`medNote-${idx}`);
  if(noteBox) noteBox.innerHTML = "";

  const suggestBox = document.getElementById(`medSuggest-${idx}`);
  const matches = findDrugMatches(val);
  if(!suggestBox) return;
  if(matches.length===0){
    suggestBox.innerHTML = "";
    suggestBox.classList.remove("show");
    return;
  }
  suggestBox.classList.add("show");
  suggestBox.innerHTML = matches.map(m=>`
    <div class="med-suggest-item" onmousedown="selectMed(${idx}, '${m.name.replace(/'/g,"\\'")}')">
      ${m.name} <span class="cat">· ${m.category}</span>
    </div>
  `).join("");
}

function selectMed(idx, name){
  const drug = DRUG_DB.find(d=>d.name===name);
  if(!drug) return;
  assessAnswers.meds.items[idx] = {name: drug.name, category: drug.category, note: drug.note, flag: drug.flag};
  const input = document.getElementById(`medInput-${idx}`);
  if(input) input.value = drug.name;
  const noteBox = document.getElementById(`medNote-${idx}`);
  if(noteBox) noteBox.innerHTML = renderMedNoteHtml(drug);
  hideMedSuggest(idx);
}

function hideMedSuggest(idx){
  const box = document.getElementById(`medSuggest-${idx}`);
  if(box){ box.innerHTML=""; box.classList.remove("show"); }
}

function setYn(val){
  const s = ASSESS_STEPS[assessStep];
  if(!assessAnswers[s.key]) assessAnswers[s.key] = {yn:null, text:""};
  assessAnswers[s.key].yn = val;
  drawAssessStep();
}
function prevAssessStep(){ assessStep--; drawAssessStep(); }
function nextAssessStep(){
  const s = ASSESS_STEPS[assessStep];
  if(!isStepAnswered(s)) return;
  if(assessStep < ASSESS_STEPS.length-1){
    assessStep++;
    drawAssessStep();
  } else {
    state.assessment = JSON.parse(JSON.stringify(assessAnswers));
    saveState();
    renderAssessSummary(state.assessment);
  }
}

function renderAssessSummary(answers){
  document.getElementById("assessWizard").style.display = "none";
  const el = document.getElementById("assessSummary");
  el.style.display = "block";

  const flags = [];

  if(answers.disease){
    const list = answers.disease.selected || [];
    const other = (answers.disease.other || "").trim();
    if(list.length || other){
      const all = other ? [...list, other] : list;
      flags.push({type:"warn", text:`มีโรคประจำตัว: ${all.join(", ")} — โปรดแจ้งวิสัญญีแพทย์และนำยาประจำตัวมาด้วย`});
    }
  }

  if(answers.meds){
    const meds = (answers.meds.items||[]).filter(m=>m.name && m.name.trim());
    meds.forEach(m=>{
      if(m.note){
        flags.push({type: m.flag||"info", text:`${m.name} (${m.category}): ${m.note}`});
      } else {
        flags.push({type:"info", text:`${m.name}: ไม่พบข้อมูลยานี้ในฐานข้อมูล โปรดแจ้งชื่อยานี้กับวิสัญญีแพทย์โดยตรง`});
      }
    });
  }

  if(answers.prevAnes && answers.prevAnes.yn) flags.push({type:"info", text:"เคยดมยาสลบมาก่อน — โปรดแจ้งปัญหาที่เคยพบให้ทีมทราบ" + (answers.prevAnes.text?` (${answers.prevAnes.text})`:"")});
  if(answers.looseTeeth && answers.looseTeeth.yn) flags.push({type:"warn", text:"มีฟันโยก/ฟันปลอม — โปรดแจ้งทีมงานก่อนใส่ท่อช่วยหายใจ"});
  if(answers.snore && answers.snore.yn) flags.push({type:"warn", text:"นอนกรน/สงสัยภาวะหยุดหายใจขณะหลับ — โปรดแจ้งวิสัญญีแพทย์"});
  if(answers.smoke && answers.smoke.yn) flags.push({type:"info", text:"สูบบุหรี่ — ควรงดก่อนผ่าตัดตามคำแนะนำของทีมงาน"});
  if(answers.alcohol && answers.alcohol.yn) flags.push({type:"info", text:"ดื่มแอลกอฮอล์เป็นประจำ — โปรดแจ้งวิสัญญีแพทย์"});

  el.innerHTML = `
    <div class="card">
      <h3>สรุปผลการประเมิน</h3>
      <p class="muted">โปรดนำข้อมูลนี้ไปแจ้งวิสัญญีแพทย์อีกครั้งก่อนผ่าตัด คำแนะนำเรื่องยาเป็นข้อมูลทั่วไป ไม่ใช่คำสั่งทางการแพทย์เฉพาะราย</p>
    </div>
    ${flags.length ? flags.map(f=>`<div class="summary-flag ${f.type}">${f.type==='warn'?'⚠️':'ℹ️'} ${f.text}</div>`).join("")
      : `<div class="summary-flag info">✅ ไม่พบข้อมูลที่ต้องเน้นย้ำเป็นพิเศษ แต่ควรตอบคำถามของวิสัญญีแพทย์ตามจริงเสมอ</div>`}
    <button class="btn-ghost" onclick="editAssessment()">แก้ไขคำตอบ</button>
    <button class="btn-primary" style="margin-top:8px;" onclick="shareAssessment()">แชร์/ส่งออกให้ทีมวิสัญญี</button>
  `;
}

function editAssessment(){
  assessAnswers = JSON.parse(JSON.stringify(state.assessment));
  assessStep = 0;
  state.assessment = null;
  saveState();
  renderAssessWizard();
}

function shareAssessment(){
  const answers = state.assessment;
  let text = "สรุปข้อมูลก่อนผ่าตัด (จากแอปดมยาแคร์)\n\n";

  if(answers.disease){
    const list = answers.disease.selected || [];
    const other = (answers.disease.other||"").trim();
    const all = other ? [...list, other] : list;
    text += `- โรคประจำตัว: ${all.length ? all.join(", ") : "ไม่มี"}\n`;
  }
  if(answers.meds){
    const meds = (answers.meds.items||[]).filter(m=>m.name && m.name.trim());
    text += `- ยาที่รับประทานประจำ: ${meds.length ? meds.map(m=>m.name).join(", ") : "ไม่มี"}\n`;
  }
  ASSESS_STEPS.forEach(s=>{
    if(s.type==="multi" || s.type==="meds") return;
    const a = answers[s.key];
    if(!a) return;
    text += `- ${s.q}: ${a.yn ? "มี/ใช่" : "ไม่มี/ไม่ใช่"}`;
    if(a.text) text += ` (${a.text})`;
    text += "\n";
  });

  if(navigator.share){
    navigator.share({title:"สรุปข้อมูลก่อนผ่าตัด", text}).catch(()=>{});
  } else {
    navigator.clipboard?.writeText(text);
    showToast("คัดลอกสรุปผลแล้ว วางในแอปที่ต้องการส่งได้เลย");
  }
}

/* ---------------------------------------------------------------------- */
/* LEARN                                                                   */
/* ---------------------------------------------------------------------- */

function renderQaList(containerId, data){
  const el = document.getElementById(containerId);
  el.innerHTML = data.map((qa, idx)=>`
    <div class="qa-card" data-idx="${idx}">
      <div class="qa-q" onclick="toggleQa('${containerId}', ${idx})">
        <span class="emoji">${qa[0]}</span>
        <span class="txt">${qa[1]}</span>
        <span class="caret">▾</span>
      </div>
      <div class="qa-a"><div class="qa-a-inner">${qa[2]}</div></div>
    </div>
  `).join("");
}
function toggleQa(containerId, idx){
  const card = document.querySelectorAll(`#${containerId} .qa-card`)[idx];
  card.classList.toggle("open");
}

function renderPostOp(){
  const el = document.getElementById("learn-post");
  el.innerHTML = `<div id="postOpQa"></div>`;
  renderQaList("postOpQa", POST_OP);
}

function renderGoingHome(){
  const el = document.getElementById("learn-home2");
  el.innerHTML = `
    <div id="homeQa"></div>
    <div class="danger-box">
      <h3>🚨 อาการอันตราย ต้องรีบมาโรงพยาบาลทันที</h3>
      <ul>${DANGER_SIGNS.map(d=>`<li>${d}</li>`).join("")}</ul>
    </div>
  `;
  renderQaList("homeQa", GOING_HOME);
}

function renderFaq(){
  const q = (document.getElementById("faqSearch").value||"").trim();
  const filtered = FAQ.filter(f => !q || f[0].includes(q) || f[1].includes(q));
  const el = document.getElementById("faqList");
  if(filtered.length===0){
    el.innerHTML = `<div class="empty-state">ไม่พบคำถามที่ตรงกับ "${q}"<br>ลองค้นหาด้วยคำอื่น หรือสอบถามผ่านแท็บ "ติดต่อ"</div>`;
    return;
  }
  el.innerHTML = filtered.map((f, idx)=>`
    <div class="qa-card" data-idx="${idx}">
      <div class="qa-q" onclick="this.parentElement.classList.toggle('open')">
        <span class="emoji">❓</span>
        <span class="txt">${f[0]}</span>
        <span class="caret">▾</span>
      </div>
      <div class="qa-a"><div class="qa-a-inner">${f[1]}</div></div>
    </div>
  `).join("");
}

/* ---------------------------------------------------------------------- */
/* CONTACT & FEEDBACK                                                     */
/* ---------------------------------------------------------------------- */

const RATING_CATS = [
  {key:"prep", label:"การให้ข้อมูลเตรียมตัวก่อนผ่าตัด"},
  {key:"team", label:"การดูแลของทีมวิสัญญีวันผ่าตัด"},
  {key:"pain", label:"การดูแลความปวด/อาการหลังผ่าตัด"},
  {key:"overall", label:"ความประทับใจโดยรวม"},
];
let ratings = {};

function renderRatingCard(){
  const el = document.getElementById("ratingCard");
  el.innerHTML = RATING_CATS.map(c=>`
    <div class="rate-row">
      <div class="lbl">${c.label}</div>
      <div class="mini-stars" id="stars-${c.key}">
        ${[1,2,3,4,5].map(n=>`<span class="star ${((ratings[c.key]||0)>=n)?'on':''}" onclick="setRating('${c.key}',${n})">★</span>`).join("")}
      </div>
    </div>
  `).join("");
}
function setRating(key, n){
  ratings[key] = n;
  renderRatingCard();
}

function submitFeedback(){
  const total = RATING_CATS.length;
  const rated = Object.keys(ratings).length;
  if(rated < total){ showToast("กรุณาให้คะแนนครบทุกหัวข้อ"); return; }
  const comment = document.getElementById("fbComment").value;
  state.feedbackHistory.unshift({
    type:"survey", date:new Date().toISOString(), ratings:{...ratings}, comment, status:"done"
  });
  saveState();

  // ส่งขึ้น Google Sheets — key ของ ratings (prep/team/pain/overall ฯลฯ) จะกลายเป็นชื่อคอลัมน์อัตโนมัติ
  // ถ้าอนาคตเพิ่มหมวดคะแนนใหม่ใน RATING_CATS ก็จะมีคอลัมน์ใหม่ขึ้นในชีตให้เองโดยไม่ต้องแก้ Apps Script
  sendToSheet("survey", { ...ratings, comment });

  ratings = {};
  document.getElementById("fbComment").value = "";
  renderRatingCard();
  renderHistory();
  showToast("ขอบคุณสำหรับความคิดเห็นค่ะ 💜");
  goTo("contact","history");
}

function submitConcern(){
  const text = document.getElementById("concernText").value.trim();
  if(!text){ showToast("กรุณากรอกรายละเอียด"); return; }
  const typeBtn = document.querySelector("#concernType .seg-btn.sel");
  const typeVal = typeBtn ? typeBtn.dataset.v : "general";
  const typeLabel = {general:"สอบถามทั่วไป", symptom:"แจ้งอาการ (ไม่ฉุกเฉิน)", suggest:"ข้อเสนอแนะ"}[typeVal];
  state.feedbackHistory.unshift({
    type:"concern", date:new Date().toISOString(), category:typeLabel, text, status:"sent"
  });
  saveState();

  sendToSheet("concern", { category: typeLabel, text });

  document.getElementById("concernText").value = "";
  renderHistory();
  showToast("ส่งข้อความแล้ว ทีมงานจะติดต่อกลับโดยเร็ว");
  goTo("contact","history");
}

document.addEventListener("click", (e)=>{
  if(e.target.closest("#concernType")){
    document.querySelectorAll("#concernType .seg-btn").forEach(b=>b.classList.remove("sel"));
    e.target.closest(".seg-btn").classList.add("sel");
  }
});

function renderHistory(){
  const el = document.getElementById("historyList");
  if(!state.feedbackHistory.length){
    el.innerHTML = `<div class="empty-state">ยังไม่มีประวัติการประเมินหรือข้อความ<br>เริ่มได้จากแท็บ "ประเมิน" หรือ "แจ้งปัญหา"</div>`;
    return;
  }
  el.innerHTML = state.feedbackHistory.map(h=>{
    const d = new Date(h.date);
    const dstr = d.toLocaleDateString("th-TH", {day:"numeric", month:"short", year:"numeric"});
    if(h.type==="survey"){
      const avg = (Object.values(h.ratings).reduce((a,b)=>a+b,0)/Object.values(h.ratings).length).toFixed(1);
      return `<div class="history-item">
        <div class="top"><span>แบบประเมินความพึงพอใจ</span><span>${dstr}</span></div>
        <div class="body">คะแนนเฉลี่ย ${avg} / 5 ⭐${h.comment ? `<br><span class="muted">"${h.comment}"</span>`:""}</div>
      </div>`;
    }
    const chip = h.status==="sent" ? '<span class="status-chip sent">ส่งแล้ว</span>' : '<span class="status-chip done">ตอบกลับแล้ว</span>';
    return `<div class="history-item">
      <div class="top"><span>${h.category}</span><span>${dstr}</span></div>
      <div class="body">${h.text}</div>
      <div style="margin-top:8px;">${chip}</div>
    </div>`;
  }).join("");
}

/* ---------------------------------------------------------------------- */
/* INIT                                                                    */
/* ---------------------------------------------------------------------- */

function init(){
  renderHome();
  renderTimeline();
  renderChecklist();
  renderAssessWizard();
  renderQaList("learn-qa", ANES_QA);
  renderPostOp();
  renderGoingHome();
  renderFaq();
  renderRatingCard();
  renderHistory();

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("service-worker.js").catch(()=>{});
    });
  }
}
init();
