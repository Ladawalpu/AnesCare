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
  const defaults = {
    surgeryDate: null,
    procedure: null,
    textScale: "normal",
    doctorNotes: { npoDate:null, npoTime:null, npoException:"", relativeAccompany:null, relativeNote:"", otherText:"" },
    checklist: {},
    assessment: null,
    feedbackHistory: []
  };
  try{
    const raw = localStorage.getItem(LS_KEY);
    if(raw){
      const saved = JSON.parse(raw);
      // merge เผื่อผู้ใช้เดิมมี state ที่บันทึกไว้ก่อนฟีเจอร์ใหม่นี้จะถูกเพิ่มเข้ามา
      return {
        ...defaults,
        ...saved,
        doctorNotes: { ...defaults.doctorNotes, ...(saved.doctorNotes||{}) }
      };
    }
  }catch(e){}
  return defaults;
}
function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

let state = loadState();

/* ---------------------------------------------------------------------- */
/* CONTENT DATA                                                           */
/* ---------------------------------------------------------------------- */

const SYMPTOM_WATCH_ITEM = ["🤒","สังเกตอาการก่อนผ่าตัด","หากมีไข้ ไอ มีเสมหะ หรือน้ำมูก ควรรีบแจ้งให้ทางโรงพยาบาลทราบก่อนวันผ่าตัด เนื่องจากอาจมีผลต่อการวางแผนระงับความรู้สึกและอาจต้องเลื่อนการผ่าตัด"];

const TIMELINE = [
  { when:"7 วันก่อนผ่าตัด", key:"d7", items:[
    ["💊","ยาที่ต้องหยุด","แจ้งวิสัญญีแพทย์เรื่องยาละลายลิ่มเลือด/ยาต้านเกล็ดเลือด และอาหารเสริม/สมุนไพรที่รับประทานอยู่ทั้งหมด บางชนิดต้องหยุดล่วงหน้า 5-7 วัน"],
    ["📋","วิธีเตรียมตัว","พักผ่อนให้เพียงพอ งดสูบบุหรี่และแอลกอฮอล์เพื่อลดความเสี่ยงระหว่างดมยาสลบ"],
    SYMPTOM_WATCH_ITEM,
  ]},
  { when:"5 วันก่อนผ่าตัด", key:"d5", items:[
    ["💊","ตรวจสอบยาที่ต้องหยุด","ยาบางชนิด เช่น ยาต้านเกล็ดเลือดบางตัว อาจต้องเริ่มหยุดตั้งแต่วันนี้ตามที่แพทย์สั่ง โปรดตรวจสอบรายการยาที่บันทึกไว้ในหน้าประเมินความเสี่ยงอีกครั้ง"],
    ["📞","ติดต่อสอบถามหากไม่แน่ใจ","หากไม่แน่ใจว่ายาตัวใดต้องหยุดวันไหน สามารถติดต่อสอบถามทีมวิสัญญีได้ที่แท็บ ติดต่อ/แจ้งกลับ"],
    SYMPTOM_WATCH_ITEM,
  ]},
  { when:"3 วันก่อนผ่าตัด", key:"d3", items:[
    ["💊","ยาที่รับประทานต่อ","ยาโรคประจำตัวส่วนใหญ่ (เช่น ความดัน หัวใจ) มักให้กินต่อตามปกติ ยกเว้นแพทย์สั่งให้หยุด"],
    ["🩺","ตรวจสอบสุขภาพทั่วไป","สังเกตอาการไข้ ไอ หวัด หากไม่สบายควรแจ้งเจ้าหน้าที่ก่อนถึงวันนัด"],
    SYMPTOM_WATCH_ITEM,
  ]},
  { when:"1 วันก่อนผ่าตัด", key:"d1", items:[
    ["🛁","การอาบน้ำ","อาบน้ำสระผมให้สะอาด ตัดเล็บให้สั้น ล้างเครื่องสำอาง/ทาเล็บออกให้หมด"],
    ["📦","จัดเตรียมของใช้","เตรียมเอกสารประจำตัว บัตรโรงพยาบาล ยาประจำตัว (ถ้าต้องนำมา) และของใช้ส่วนตัวที่จำเป็น"],
    SYMPTOM_WATCH_ITEM,
  ]},
  { when:"คืนก่อนผ่าตัด", key:"night", items:[
    ["🚫","งดน้ำงดอาหาร (NPO)","งดอาหารมื้อหนัก/นมตามเวลาที่ทีมแจ้ง โดยทั่วไปมักเริ่มงดอาหารตั้งแต่เที่ยงคืน (ยึดตามคำสั่งแพทย์ของท่านเป็นหลัก)"],
    ["😴","พักผ่อน","นอนหลับให้เพียงพอ หลีกเลี่ยงความเครียดและกิจกรรมหนัก"],
    SYMPTOM_WATCH_ITEM,
  ]},
  { when:"เช้าวันผ่าตัด", key:"morning", items:[
    ["💍","ถอดเครื่องประดับ","ถอดแหวน สร้อย ต่างหู นาฬิกา และของมีค่าฝากญาติหรือเก็บไว้ที่บ้าน"],
    ["🏥","การมาถึงโรงพยาบาล","มาถึงตามเวลานัดหมาย แจ้งชื่อ-นามสกุลและ HN ที่จุดลงทะเบียนก่อนผ่าตัด"],
    SYMPTOM_WATCH_ITEM,
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
  ["😴","ดมยาสลบคืออะไร","การใช้ยาเพื่อทำให้ผู้ป่วยหลับ ไม่รู้สึกตัว และไม่เจ็บปวดระหว่างการผ่าตัด โดยมีวิสัญญีพยาบาลดูแลสัญญาณชีพอย่างใกล้ชิดตลอดการผ่าตัด"],
  ["🧊","บล็อกหลังคืออะไร","การฉีดยาชาเข้าบริเวณหลังเพื่อทำให้ร่างกายส่วนล่างชาและไม่รู้สึกเจ็บ โดยผู้ป่วยยังรู้สึกตัวอยู่ (อาจให้ยาเพื่อช่วยให้ผ่อนคลาย/ง่วงร่วมด้วยได้)"],
  ["🌙","การหลับแบบตื้น (Sedation) คืออะไร","การให้ยาทางหลอดเลือดดำเพื่อช่วยให้ผู้ป่วยรู้สึกผ่อนคลาย ง่วง หรือหลับตื้น แตกต่างจากการดมยาสลบตรงที่ผู้ป่วยยังหายใจได้เองตลอดเวลาและปลุกตื่นได้ง่ายกว่า มักใช้ร่วมกับการฉีดยาชาเฉพาะที่ในหัตถการที่ไม่ซับซ้อนมาก เช่น การส่องกล้อง หรือผ่าตัดเล็ก ผู้ป่วยส่วนใหญ่มักจดจำเหตุการณ์ระหว่างทำหัตถการได้น้อยหรือจำไม่ได้เลย และมักฟื้นตัวได้เร็วกว่าการดมยาสลบ ทีมวิสัญญีจะติดตามการหายใจ ความดันโลหิต และระดับออกซิเจนอย่างใกล้ชิดตลอดหัตถการเช่นเดียวกับวิธีอื่น"],
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

/**
 * ปรับขนาดตัวอักษร/เนื้อหาทั้งแอปให้ใหญ่ขึ้นได้ตามต้องการ (การเข้าถึงสำหรับผู้สูงอายุ)
 * ใช้ CSS zoom กับ .views เท่านั้น (ไม่รวม topbar/bottomnav) เพื่อไม่ให้กระทบตำแหน่งเมนูด้านล่างที่ fixed อยู่
 */
const TEXT_SCALES = [
  {key:"normal", label:"ปกติ", value:1},
  {key:"large", label:"ใหญ่", value:1.15},
  {key:"xlarge", label:"ใหญ่มาก", value:1.3},
];

function applyTextScale(){
  const current = TEXT_SCALES.find(t=>t.key===(state.textScale||"normal")) || TEXT_SCALES[0];
  const viewsEl = document.querySelector(".views");
  if(viewsEl) viewsEl.style.zoom = current.value;
}

function renderTextSizeMenu(){
  const el = document.getElementById("textSizeMenu");
  if(!el) return;
  const current = state.textScale || "normal";
  el.innerHTML = TEXT_SCALES.map(t=>`
    <div class="text-size-option ${current===t.key?'active':''}" onclick="setTextScale('${t.key}')">${t.label}</div>
  `).join("");
}

function setTextScale(key){
  state.textScale = key;
  saveState();
  applyTextScale();
  renderTextSizeMenu();
  const menu = document.getElementById("textSizeMenu");
  if(menu) menu.classList.remove("open");
}

function toggleTextSizeMenu(e){
  if(e) e.stopPropagation();
  const menu = document.getElementById("textSizeMenu");
  if(menu) menu.classList.toggle("open");
}

document.addEventListener("click", (e)=>{
  const menu = document.getElementById("textSizeMenu");
  const btn = document.getElementById("textSizeBtn");
  if(menu && menu.classList.contains("open") && !menu.contains(e.target) && e.target!==btn){
    menu.classList.remove("open");
  }
});


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
    renderProcedureCard();
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
    <p class="surgery-date-label">📅 วันผ่าตัด: ${formatThaiDateShort(state.surgeryDate)}</p>
    <button class="btn-ghost" onclick="clearSurgeryDate()">แก้ไขวันผ่าตัด</button>
  `;

  // Today todo based on nearest timeline stage
  let stageKey = null;
  if(diffDays >= 7) stageKey = "d7";
  else if(diffDays === 5 || diffDays === 6) stageKey = "d5";
  else if(diffDays === 3 || diffDays === 4) stageKey = "d3";
  else if(diffDays === 2) stageKey = "d1";
  else if(diffDays === 0) stageKey = "morning";
  if(diffDays === 1) stageKey = "night";

  const stage = TIMELINE.find(s=>s.key===stageKey);
  let todoItems = (stage && diffDays >= 0) ? stage.items.map(i=>i[1]) : [];
  todoItems = todoItems.concat(computeMedAlertsForToday());
  todoItems = todoItems.concat(computeNpoAlertForToday());
  todoItems = todoItems.concat(computeProcedureAlertsForToday());

  if(todoItems.length){
    todoCard.style.display = "block";
    todoList.innerHTML = todoItems.map(t=>`<li>${t}</li>`).join("");
  } else {
    todoCard.style.display = "none";
  }

  renderProgress();
  renderProcedureCard();
}

let procedureCardOpen = false;

function renderProcedureCard(){
  const el = document.getElementById("procedureCard");
  if(!el) return;
  const selected = PROCEDURES.find(p=>p.name===state.procedure);

  const itemsHtml = PROCEDURES.map(p=>`
    <div class="custom-select-item ${state.procedure===p.name?'active':''}" onclick="selectProcedure('${p.name.replace(/'/g,"\\'")}')">${p.name}</div>
  `).join("");

  el.innerHTML = `
    <div class="proc-head" onclick="toggleProcedureCard()">
      <div>
        <span class="eyebrow">หัตถการ/การผ่าตัดที่จะเข้ารับบริการ</span>
        ${selected
          ? `<div class="proc-selected-name">${selected.name}</div>`
          : `<div class="muted" style="margin-top:4px;">แตะเพื่อเลือกรายการ</div>`}
      </div>
      <span class="caret proc-caret ${procedureCardOpen?'open':''}">▾</span>
    </div>
    <div class="proc-body ${procedureCardOpen?'open':''}">
      <div class="custom-select" id="procedureCustomSelect">
        <button type="button" class="custom-select-trigger ${selected?'':'placeholder'}" onclick="toggleProcedureDropdown(event)">
          <span>${selected ? selected.name : "— เลือกรายการ —"}</span>
          <span class="caret">▾</span>
        </button>
        <div class="custom-select-list" id="procedureDropdownList">
          <div class="custom-select-item ${!selected?'active':''}" onclick="selectProcedure('')">— เลือกรายการ —</div>
          ${itemsHtml}
        </div>
      </div>
      ${selected ? `
        <div class="summary-flag info" style="margin-top:12px;">
          <b>เกี่ยวกับหัตถการนี้</b><br>${selected.desc}
        </div>
        <div class="summary-flag warn" style="margin-top:8px;">
          <b>การปฏิบัติตัว</b><br>${selected.care}
        </div>
      ` : `<p class="muted" style="margin-top:8px;">เลือกรายการเพื่อดูคำอธิบายและวิธีปฏิบัติตัวเฉพาะของหัตถการนั้นๆ</p>`}
    </div>
  `;
}

function toggleProcedureCard(){
  procedureCardOpen = !procedureCardOpen;
  renderProcedureCard();
}

function toggleProcedureDropdown(e){
  if(e) e.stopPropagation();
  const wrap = document.getElementById("procedureCustomSelect");
  if(wrap) wrap.classList.toggle("open");
}

function selectProcedure(name){
  state.procedure = name || null;
  saveState();
  renderProcedureCard();
  renderTimelineContentOnly();
  renderHome();
}

// ปิด dropdown เมื่อแตะที่อื่นนอกกล่อง
document.addEventListener("click", (e)=>{
  const wrap = document.getElementById("procedureCustomSelect");
  if(wrap && !wrap.contains(e.target)){
    wrap.classList.remove("open");
  }
});


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

const THAI_MONTHS_SHORT = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
function formatThaiDateShort(iso){
  if(!iso) return "";
  const d = new Date(iso+"T00:00:00");
  if(isNaN(d.getTime())) return "";
  return `${d.getDate()} ${THAI_MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

/** แทรกคำแนะนำเฉพาะจากแพทย์ (ที่ผู้ป่วย/ญาติพิมพ์เอง) เข้าไปแทนที่/เสริมเนื้อหาทั่วไปของ stage ที่เกี่ยวข้อง */
/**
 * รายการเตือนเพิ่มเติมเฉพาะหัตถการ ผนวกเข้ากับการ์ด Timeline ที่เกี่ยวข้องโดยอัตโนมัติ
 * เมื่อผู้ป่วยเลือกหัตถการนั้นไว้ในหน้าแรก (เนื้อหาอ้างอิงจากคำแนะนำเตรียมตัวก่อนส่องกล้องลำไส้ใหญ่)
 */
const PROCEDURE_TIMELINE_EXTRAS = {
  "ส่องกล้องทางเดินอาหาร (Gastroscopy / Colonoscopy)": {
    d3: [["🥗","หลีกเลี่ยงอาหารกากใยสูง","งดผักสด ผลไม้ที่มีเมล็ด ธัญพืช (ข้าวโพด งา ถั่ว สาหร่าย) และข้าวกล้อง ตั้งแต่วันนี้ เนื่องจากต้องเตรียมลำไส้ก่อนส่องกล้อง รับประทานอาหารอ่อนย่อยง่ายแทนได้"]],
    d1: [
      ["🥣","รับประทานอาหารเหลวใสเท่านั้น","วันนี้รับประทานเฉพาะน้ำเปล่า น้ำหวานใส น้ำผลไม้ไม่มีเนื้อ น้ำซุปใส หรือเครื่องดื่มเกลือแร่ หลีกเลี่ยงนมและน้ำสีแดง/ม่วง"],
      ["💊","รับประทานยาระบายเตรียมลำไส้","รับประทานยาระบายตามที่แพทย์สั่งอย่างเคร่งครัด และดื่มน้ำตามปริมาณที่กำหนด เพื่อให้ลำไส้สะอาดพร้อมตรวจ"],
    ],
    night: [["⏰","เช้าวันตรวจ","05.00 น. เช้าวันตรวจ รับประทานเฉพาะยาที่แพทย์สั่งอย่างเคร่งครัด (ถ้ามี) ห้ามรับประทานอาหารหรือน้ำอื่นใด"]],
    morning: [["👪","ต้องมีผู้ดูแลมารับกลับ","เนื่องจากได้รับยาระงับความรู้สึก ไม่ควรขับรถกลับเอง หากไม่มีผู้ดูแลอาจต้องเลื่อนตรวจตามนโยบายของโรงพยาบาล"]],
  },
  "ผ่าตัดไส้เลื่อน (Hernia Repair)": {
    night: [["🥤","ดื่มน้ำใสได้ถึง 2 ชั่วโมงก่อนผ่าตัด","น้ำเปล่า ชาไม่ใส่นม หรือกาแฟดำ ดื่มได้จนถึง 2 ชั่วโมงก่อนผ่าตัดตามคำแนะนำของแพทย์ (แม้ไม่ได้ดมยาสลบก็ควรงดตามเวลาเช่นกัน เผื่อต้องเปลี่ยนวิธีระงับความรู้สึกกะทันหัน)"]],
    morning: [["💊","รับประทานยาประจำเฉพาะที่แพทย์อนุญาต","เช้าวันผ่าตัดรับประทานยาประจำได้เฉพาะที่แพทย์อนุญาตเท่านั้น"]],
  },
  "ผ่าตัดเนื้องอกหรือซีสต์ (Tumor/Cyst Excision)": {
    d7: [["🚭","งดสูบบุหรี่/แอลกอฮอล์","ควรงดสูบบุหรี่อย่างน้อย 4-8 สัปดาห์ก่อนผ่าตัดหากทำได้ และงดแอลกอฮอล์อย่างน้อย 24 ชั่วโมงก่อนผ่าตัด เพื่อช่วยให้ปอดทำงานดีขึ้นและฟื้นตัวเร็วขึ้น"]],
    night: [["🍽️","งดอาหารตามประเภท","อาหารมื้อหนัก/มัน/เนื้อสัตว์ งดอย่างน้อย 8 ชั่วโมง · นมผง/นมวัว งดอย่างน้อย 6 ชั่วโมง · นมแม่ งดอย่างน้อย 4 ชั่วโมง · น้ำใสดื่มได้ถึง 2 ชั่วโมงก่อนผ่าตัด"]],
    morning: [["💄","ไม่แต่งหน้า ไม่ทาเล็บ","เช้าวันผ่าตัดไม่แต่งหน้า ไม่ทาลิปสติก ไม่ทาเล็บมือ/เท้า และไม่ติดเล็บปลอม งดเครื่องประดับทุกชนิด"]],
  },
};

/** ข้อความแจ้งเตือนเฉพาะหัตถการสำหรับการ์ด "วันนี้ควรทำ" ที่หน้าแรก คีย์เป็นจำนวนวันก่อนผ่าตัด (diffDays) */
const PROCEDURE_HOME_ALERTS = {
  "ส่องกล้องทางเดินอาหาร (Gastroscopy / Colonoscopy)": {
    3: ["🥗 วันนี้ควรเริ่มงดอาหารกากใยสูง (ผัก ผลไม้มีเมล็ด ธัญพืช) เตรียมลำไส้ก่อนส่องกล้อง"],
    1: ["🥣 วันนี้รับประทานเฉพาะอาหารเหลวใส และรับประทานยาระบายเตรียมลำไส้ตามที่แพทย์สั่ง"],
    0: ["⏰ งดอาหารและน้ำหลังเที่ยงคืน เช้านี้รับประทานเฉพาะยาที่แพทย์สั่ง (ถ้ามี)", "👪 ต้องมีผู้ดูแลมารับกลับ ไม่ควรขับรถเอง"],
  },
  "ผ่าตัดไส้เลื่อน (Hernia Repair)": {
    0: ["🥤 ดื่มน้ำใสได้ถึง 2 ชั่วโมงก่อนผ่าตัด งดอาหารอย่างน้อย 6-8 ชั่วโมงตามคำแนะนำ"],
  },
  "ผ่าตัดเนื้องอกหรือซีสต์ (Tumor/Cyst Excision)": {
    0: ["🍽️ งดอาหารตามประเภทอาหาร น้ำใสดื่มได้ถึง 2 ชั่วโมงก่อนผ่าตัด", "💄 ไม่แต่งหน้า ไม่ทาเล็บ งดเครื่องประดับทุกชนิด"],
  },
};

function getStageItemsOverridden(stage){
  let items = stage.items.slice();
  const n = state.doctorNotes || {};

  if(stage.key === "night" && n.npoDate && n.npoTime){
    let desc = `งดน้ำงดอาหารตั้งแต่เวลา ${n.npoTime} น. วันที่ ${formatThaiDateShort(n.npoDate)} ตามที่แพทย์แจ้ง (พิมพ์โดยผู้ป่วย/ญาติ)`;
    if(n.npoException && n.npoException.trim()) desc += ` — ${n.npoException.trim()}`;
    items = items.map(i => i[1]==="งดน้ำงดอาหาร (NPO)" ? ["🚫","งดน้ำงดอาหาร (NPO)", desc] : i);
  }

  if(stage.key === "morning" && (n.relativeAccompany === true || n.relativeAccompany === false)){
    const desc = n.relativeAccompany
      ? `แพทย์แจ้งให้พาญาติมาด้วย${n.relativeNote && n.relativeNote.trim() ? ` — ${n.relativeNote.trim()}` : ""} (พิมพ์โดยผู้ป่วย/ญาติ)`
      : "ไม่จำเป็นต้องพาญาติมาด้วยตามที่แพทย์แจ้ง (พิมพ์โดยผู้ป่วย/ญาติ)";
    items = items.concat([["👪","พาญาติมาด้วย", desc]]);
  }

  const procExtras = state.procedure && PROCEDURE_TIMELINE_EXTRAS[state.procedure];
  if(procExtras && procExtras[stage.key]){
    items = items.concat(procExtras[stage.key]);
  }

  return items;
}

function renderTimeline(){
  renderDoctorNotesCard();
  renderTimelineContentOnly();
}
function toggleTimeline(idx){
  document.querySelectorAll(`#timelineList .tl-item`)[idx].classList.toggle("open");
}

/* ---------------------------------------------------------------------- */
/* คำแนะนำเฉพาะจากแพทย์ (พิมพ์เองโดยผู้ป่วย/ญาติ) — แท็บย่อยในหน้าเตรียมตัว   */
/* ---------------------------------------------------------------------- */

function renderDoctorNotesCard(){
  const el = document.getElementById("doctorNotesCard");
  if(!el) return;
  const n = state.doctorNotes || {};

  el.innerHTML = `
    <span class="eyebrow">คำแนะนำเฉพาะจากแพทย์</span>
    <p class="muted" style="margin-top:4px;">บันทึกคำสั่งเฉพาะที่ได้รับจากแพทย์/พยาบาลในวันตรวจ กันลืม</p>

    <div class="disclaimer" style="margin-top:14px;">
      ข้อมูลในส่วนนี้ <b>พิมพ์โดยผู้ป่วย/ญาติเอง</b> ตามที่ได้รับแจ้งจากแพทย์หรือพยาบาล เพื่อใช้เป็นบันทึกช่วยจำส่วนตัวเท่านั้น <b>ไม่ใช่คำสั่งแพทย์อย่างเป็นทางการ</b> หากข้อมูลคลาดเคลื่อนหรือไม่แน่ใจ โปรดยึดคำสั่งที่ได้รับจากโรงพยาบาลโดยตรงเป็นหลักเสมอ
    </div>

    <div class="field">
      <label>งดน้ำงดอาหารตั้งแต่วันที่ / เวลา</label>
      <div style="display:flex; gap:8px;">
        <input type="date" class="txt-input" id="npoDateInput" value="${n.npoDate||''}" onchange="setDoctorNoteAndRerender('npoDate', this.value)">
        <input type="time" class="txt-input" id="npoTimeInput" value="${n.npoTime||''}" onchange="setDoctorNoteAndRerender('npoTime', this.value)">
      </div>
      <textarea rows="2" class="txt-input" style="margin-top:8px;" placeholder="ข้อยกเว้น (ถ้ามี) เช่น จิบน้ำเปล่าได้ถึง 6 โมงเช้า" id="npoExceptionInput" oninput="setDoctorNoteField('npoException', this.value)">${n.npoException||''}</textarea>
    </div>

    <div class="field">
      <label>พาญาติมาด้วยในวันผ่าตัด</label>
      <div class="seg">
        <button class="seg-btn ${n.relativeAccompany===true?'sel':''}" onclick="setRelativeAccompany(true)">ต้องพามา</button>
        <button class="seg-btn ${n.relativeAccompany===false?'sel':''}" onclick="setRelativeAccompany(false)">ไม่ต้อง</button>
      </div>
      ${n.relativeAccompany===true ? `
        <textarea rows="2" class="txt-input" style="margin-top:8px;" placeholder="เช่น 1 คน สำหรับเซ็นยินยอมและรับตัวกลับ" id="relativeNoteInput" oninput="setDoctorNoteField('relativeNote', this.value)">${n.relativeNote||''}</textarea>
      ` : ``}
    </div>

    <div class="field">
      <label>คำแนะนำอื่นๆ จากแพทย์ (ถ้ามี)</label>
      <textarea rows="3" class="txt-input" placeholder="พิมพ์คำแนะนำเพิ่มเติมที่ได้รับจากแพทย์/พยาบาล" id="otherNoteInput" oninput="setDoctorNoteField('otherText', this.value)">${n.otherText||''}</textarea>
    </div>
  `;
}

/** สำหรับช่องพิมพ์ข้อความ (oninput ทุกตัวอักษร) — อัปเดตค่าและซิงก์ไปยัง Timeline/หน้าแรก โดยไม่ re-render การ์ดนี้เอง เพื่อไม่ให้ cursor หลุดระหว่างพิมพ์ */
function setDoctorNoteField(key, val){
  state.doctorNotes[key] = val;
  saveState();
  renderTimelineContentOnly();
  renderHome();
}

/** สำหรับปุ่ม/วันที่/เวลา (คอมมิทค่าทีเดียว ไม่ใช่ทุกตัวอักษร) — ปลอดภัยที่จะ re-render การ์ดทั้งหมด */
function setDoctorNoteAndRerender(key, val){
  state.doctorNotes[key] = val;
  saveState();
  renderDoctorNotesCard();
  renderTimelineContentOnly();
  renderHome();
}

function setRelativeAccompany(val){
  state.doctorNotes.relativeAccompany = val;
  saveState();
  renderDoctorNotesCard();
  renderTimelineContentOnly();
  renderHome();
}

/** re-render รายการ Timeline (แทรกคำแนะนำแพทย์เข้าไปในการ์ดที่เกี่ยวข้องโดยอัตโนมัติ) */
function renderTimelineContentOnly(){
  const el = document.getElementById("timelineList");
  if(!el) return;
  el.innerHTML = TIMELINE.map((stage, idx)=>{
    const medItems = getMedItemsForStage(stage.key);
    const items = getStageItemsOverridden(stage);
    return `
    <div class="tl-item" data-idx="${idx}">
      <div class="tl-dot"></div>
      <div class="tl-head" onclick="toggleTimeline(${idx})">
        <span class="when">${stage.when}</span>
        <span class="caret">▾</span>
      </div>
      <div class="tl-body">
        <div class="tl-body-inner">
          ${items.map(i=>`
            <div class="row">
              <div class="ic">${i[0]}</div>
              <div class="txt"><b>${i[1]}</b><span>${i[2]}</span></div>
            </div>`).join("")}
          ${medItems.length ? `
            <div class="tl-med-divider">💊 ยาที่ต้องดูแลเป็นพิเศษ</div>
            ${medItems.map(m=>`
              <div class="row">
                <div class="ic">${m.icon}</div>
                <div class="txt"><b>${m.title}</b><span>${m.desc}</span></div>
              </div>`).join("")}
          ` : ``}
        </div>
      </div>
    </div>
  `;
  }).join("");
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
  {name:"Enalapril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Lisinopril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Ramipril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Perindopril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Captopril", category:"ยาลดความดันโลหิต (ACEI)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Losartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Valsartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Telmisartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Candesartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Irbesartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Olmesartan", category:"ยาลดความดันโลหิต (ARB)", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด เนื่องจากเสี่ยงความดันโลหิตต่ำระหว่างระงับความรู้สึก ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Amlodipine", category:"ยาลดความดันโลหิต (CCB)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Nifedipine", category:"ยาลดความดันโลหิต (CCB)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Felodipine", category:"ยาลดความดันโลหิต (CCB)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Diltiazem", category:"ยาลดความดันโลหิต (CCB)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Verapamil", category:"ยาลดความดันโลหิต (CCB)", note:"โดยทั่วไปกินต่อได้ถึงเช้าวันผ่าตัด", flag:"info"},
  {name:"Atenolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Metoprolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Bisoprolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Carvedilol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Propranolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Nebivolol", category:"ยาลดความดันโลหิต (Beta-blocker)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงหัวใจเต้นเร็ว/ความดันสูงตีกลับ (rebound)", flag:"warn"},
  {name:"Prazosin", category:"ยาลดความดันโลหิต (Alpha-blocker)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Doxazosin", category:"ยาลดความดันโลหิต (Alpha-blocker)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Terazosin", category:"ยาลดความดันโลหิต (Alpha-blocker)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Methyldopa", category:"ยาลดความดันโลหิต (Central-acting)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงความดันโลหิตสูงตีกลับ (rebound hypertension)", flag:"warn"},
  {name:"Clonidine", category:"ยาลดความดันโลหิต (Central-acting)", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหัน เสี่ยงความดันโลหิตสูงตีกลับ (rebound hypertension)", flag:"warn"},
  {name:"Hydralazine", category:"ยาลดความดันโลหิต (Vasodilator)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Minoxidil", category:"ยาลดความดันโลหิต (Vasodilator)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Hydrochlorothiazide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Chlorthalidone", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Indapamide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Furosemide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Torsemide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Bumetanide", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Spironolactone", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Eplerenone", category:"ยาขับปัสสาวะ/ลดความดัน", note:"บางกรณีแพทย์อาจให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Metformin", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Glibenclamide", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Gliclazide", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Glimepiride", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Glipizide", category:"ยาเบาหวาน (ชนิดกิน)", note:"มักให้งดเช้าวันผ่าตัด (ขณะงดอาหาร) ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Sitagliptin", category:"ยาเบาหวาน (DPP-4 inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Linagliptin", category:"ยาเบาหวาน (DPP-4 inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Saxagliptin", category:"ยาเบาหวาน (DPP-4 inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Vildagliptin", category:"ยาเบาหวาน (DPP-4 inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Alogliptin", category:"ยาเบาหวาน (DPP-4 inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Empagliflozin", category:"ยาเบาหวาน (SGLT2 inhibitor)", note:"ควรหยุดล่วงหน้า 3-4 วันก่อนผ่าตัดตามคำสั่งแพทย์ เพื่อลดความเสี่ยงภาวะเลือดเป็นกรดจากเบาหวานชนิดน้ำตาลไม่สูง (euglycemic DKA)", flag:"warn"},
  {name:"Dapagliflozin", category:"ยาเบาหวาน (SGLT2 inhibitor)", note:"ควรหยุดล่วงหน้า 3-4 วันก่อนผ่าตัดตามคำสั่งแพทย์ เพื่อลดความเสี่ยงภาวะเลือดเป็นกรดจากเบาหวานชนิดน้ำตาลไม่สูง (euglycemic DKA)", flag:"warn"},
  {name:"Canagliflozin", category:"ยาเบาหวาน (SGLT2 inhibitor)", note:"ควรหยุดล่วงหน้า 3-4 วันก่อนผ่าตัดตามคำสั่งแพทย์ เพื่อลดความเสี่ยงภาวะเลือดเป็นกรดจากเบาหวานชนิดน้ำตาลไม่สูง (euglycemic DKA)", flag:"warn"},
  {name:"Ertugliflozin", category:"ยาเบาหวาน (SGLT2 inhibitor)", note:"ควรหยุดล่วงหน้า 3-4 วันก่อนผ่าตัดตามคำสั่งแพทย์ เพื่อลดความเสี่ยงภาวะเลือดเป็นกรดจากเบาหวานชนิดน้ำตาลไม่สูง (euglycemic DKA)", flag:"warn"},
  {name:"Semaglutide", category:"ยาเบาหวาน (GLP-1 receptor agonist)", note:"อาจทำให้กระเพาะบีบตัวช้าลง เพิ่มความเสี่ยงสำลักระหว่างดมยาสลบ ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Liraglutide", category:"ยาเบาหวาน (GLP-1 receptor agonist)", note:"อาจทำให้กระเพาะบีบตัวช้าลง เพิ่มความเสี่ยงสำลักระหว่างดมยาสลบ ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Dulaglutide", category:"ยาเบาหวาน (GLP-1 receptor agonist)", note:"อาจทำให้กระเพาะบีบตัวช้าลง เพิ่มความเสี่ยงสำลักระหว่างดมยาสลบ ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Exenatide", category:"ยาเบาหวาน (GLP-1 receptor agonist)", note:"อาจทำให้กระเพาะบีบตัวช้าลง เพิ่มความเสี่ยงสำลักระหว่างดมยาสลบ ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Pioglitazone", category:"ยาเบาหวาน (Thiazolidinedione)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Repaglinide", category:"ยาเบาหวาน (Meglitinide)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Nateglinide", category:"ยาเบาหวาน (Meglitinide)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Acarbose", category:"ยาเบาหวาน (Alpha-glucosidase inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Voglibose", category:"ยาเบาหวาน (Alpha-glucosidase inhibitor)", note:"มักให้งดเช้าวันผ่าตัด ควรปรึกษาแพทย์เรื่องการปรับยา", flag:"warn"},
  {name:"Regular insulin", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"NPH insulin", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Lispro", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Aspart", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Glulisine", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Glargine", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Detemir", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Insulin Degludec", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Premixed insulin 70/30", category:"ยาฉีดเบาหวาน (Insulin)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องการปรับขนาดฉีดในวันงดอาหาร ห้ามหยุด/ปรับเอง", flag:"warn"},
  {name:"Atorvastatin", category:"ยาลดไขมัน (Statin)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Rosuvastatin", category:"ยาลดไขมัน (Statin)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Simvastatin", category:"ยาลดไขมัน (Statin)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Pravastatin", category:"ยาลดไขมัน (Statin)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Pitavastatin", category:"ยาลดไขมัน (Statin)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Fenofibrate", category:"ยาลดไขมัน (Fibrate)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Gemfibrozil", category:"ยาลดไขมัน (Fibrate)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Ezetimibe", category:"ยาลดไขมัน (Cholesterol Absorption Inhibitor)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Evolocumab", category:"ยาลดไขมัน (PCSK9 inhibitor)", note:"ยาฉีด ความถี่ห่าง โดยทั่วไปไม่กระทบวันผ่าตัด ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Alirocumab", category:"ยาลดไขมัน (PCSK9 inhibitor)", note:"ยาฉีด ความถี่ห่าง โดยทั่วไปไม่กระทบวันผ่าตัด ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Nitroglycerin", category:"ยาโรคหัวใจ (Antianginal)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Isosorbide dinitrate", category:"ยาโรคหัวใจ (Antianginal)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Isosorbide mononitrate", category:"ยาโรคหัวใจ (Antianginal)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Nicorandil", category:"ยาโรคหัวใจ (Antianginal)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Ranolazine", category:"ยาโรคหัวใจ (Antianginal)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Amiodarone", category:"ยาโรคหัวใจ (Antiarrhythmic)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามใกล้ชิด", flag:"warn"},
  {name:"Flecainide", category:"ยาโรคหัวใจ (Antiarrhythmic)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามใกล้ชิด", flag:"warn"},
  {name:"Propafenone", category:"ยาโรคหัวใจ (Antiarrhythmic)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามใกล้ชิด", flag:"warn"},
  {name:"Sotalol", category:"ยาโรคหัวใจ (Antiarrhythmic)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามใกล้ชิด", flag:"warn"},
  {name:"Digoxin", category:"ยาโรคหัวใจ (Antiarrhythmic)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์เนื่องจากต้องติดตามใกล้ชิด", flag:"warn"},
  {name:"Sacubitril/Valsartan", category:"ยาโรคหัวใจล้มเหลว (Heart Failure)", note:"ควรแจ้งวิสัญญีแพทย์ บางตัวอาจต้องพิจารณาหยุดก่อนผ่าตัดเนื่องจากเสี่ยงความดันโลหิตต่ำ ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Ivabradine", category:"ยาโรคหัวใจล้มเหลว (Heart Failure)", note:"ควรแจ้งวิสัญญีแพทย์ บางตัวอาจต้องพิจารณาหยุดก่อนผ่าตัดเนื่องจากเสี่ยงความดันโลหิตต่ำ ควรปรึกษาแพทย์เฉพาะราย", flag:"warn"},
  {name:"Aspirin", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Clopidogrel", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Prasugrel", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Ticagrelor", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Cilostazol", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Dipyridamole", category:"ยาต้านเกล็ดเลือด", note:"ประเมินความจำเป็นหยุดยาตามชนิดการผ่าตัดและข้อบ่งชี้ทางหัวใจ ควรปรึกษาแพทย์เฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Warfarin", category:"ยาต้านการแข็งตัวของเลือด (Vitamin K antagonist)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยาและอาจต้องเจาะเลือดตรวจก่อนผ่าตัด ห้ามหยุดเอง", flag:"warn"},
  {name:"Apixaban", category:"ยาต้านการแข็งตัวของเลือด (DOAC)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Rivaroxaban", category:"ยาต้านการแข็งตัวของเลือด (DOAC)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Dabigatran", category:"ยาต้านการแข็งตัวของเลือด (DOAC)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Edoxaban", category:"ยาต้านการแข็งตัวของเลือด (DOAC)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Enoxaparin", category:"ยาต้านการแข็งตัวของเลือด (ยาฉีด)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Dalteparin", category:"ยาต้านการแข็งตัวของเลือด (ยาฉีด)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Nadroparin", category:"ยาต้านการแข็งตัวของเลือด (ยาฉีด)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Fondaparinux", category:"ยาต้านการแข็งตัวของเลือด (ยาฉีด)", note:"ต้องปรึกษาแพทย์เฉพาะรายเรื่องวันหยุดยา ห้ามหยุดเอง", flag:"warn"},
  {name:"Allopurinol", category:"ยาโรคเกาต์ (ลดกรดยูริก)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Febuxostat", category:"ยาโรคเกาต์ (ลดกรดยูริก)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Probenecid", category:"ยาโรคเกาต์ (เพิ่มการขับกรดยูริก)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Colchicine", category:"ยาโรคเกาต์ (รักษาอาการเฉียบพลัน)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Naproxen", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Indomethacin", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Diclofenac", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Ibuprofen", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Celecoxib", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Etoricoxib", category:"ยาแก้อักเสบกลุ่ม NSAIDs", note:"อาจเพิ่มความเสี่ยงเลือดออก ควรปรึกษาแพทย์เรื่องวันหยุดยาก่อนผ่าตัด", flag:"warn"},
  {name:"Salbutamol", category:"ยาขยายหลอดลม (SABA)", note:"กินต่อ/พ่นได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Terbutaline", category:"ยาขยายหลอดลม (SABA)", note:"กินต่อ/พ่นได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Formoterol", category:"ยาขยายหลอดลม (LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Salmeterol", category:"ยาขยายหลอดลม (LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Budesonide", category:"ยาสูดพ่นสเตียรอยด์ (ICS)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Fluticasone", category:"ยาสูดพ่นสเตียรอยด์ (ICS)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Beclomethasone", category:"ยาสูดพ่นสเตียรอยด์ (ICS)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Budesonide/Formoterol", category:"ยาสูดพ่นผสม (ICS/LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Fluticasone/Salmeterol", category:"ยาสูดพ่นผสม (ICS/LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Fluticasone/Vilanterol", category:"ยาสูดพ่นผสม (ICS/LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Ipratropium", category:"ยาสูดพ่น (Anticholinergic)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Tiotropium", category:"ยาสูดพ่น (Anticholinergic)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Montelukast", category:"ยาโรคหอบหืด (Leukotriene receptor antagonist)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Prednisolone", category:"ยาสเตียรอยด์ชนิดกิน", note:"ควรแจ้งวิสัญญีแพทย์ ห้ามหยุดยากะทันหัน อาจต้องพิจารณาให้สเตียรอยด์เสริมเฉพาะราย (stress-dose steroid)", flag:"warn"},
  {name:"Glycopyrronium", category:"ยาสูดพ่น COPD (LAMA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Umeclidinium", category:"ยาสูดพ่น COPD (LAMA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Indacaterol", category:"ยาขยายหลอดลม (LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Olodaterol", category:"ยาขยายหลอดลม (LABA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Indacaterol/Glycopyrronium", category:"ยาสูดพ่น COPD (LABA/LAMA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Umeclidinium/Vilanterol", category:"ยาสูดพ่น COPD (LABA/LAMA)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Budesonide/Glycopyrronium/Formoterol", category:"ยาสูดพ่น COPD (Triple therapy)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Fluticasone/Umeclidinium/Vilanterol", category:"ยาสูดพ่น COPD (Triple therapy)", note:"พ่นต่อได้ตามปกติ ควรนำยาพ่นติดตัวมาในวันผ่าตัด", flag:"info"},
  {name:"Levothyroxine", category:"ยาไทรอยด์ (Hypothyroidism)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Methimazole", category:"ยาไทรอยด์ (Hyperthyroidism)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Carbimazole", category:"ยาไทรอยด์ (Hyperthyroidism)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Propylthiouracil (PTU)", category:"ยาไทรอยด์ (Hyperthyroidism)", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Tamsulosin", category:"ยาต่อมลูกหมากโต (BPH)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Alfuzosin", category:"ยาต่อมลูกหมากโต (BPH)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Finasteride", category:"ยาต่อมลูกหมากโต (BPH)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Dutasteride", category:"ยาต่อมลูกหมากโต (BPH)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Omeprazole", category:"ยากรดไหลย้อน (PPI)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Pantoprazole", category:"ยากรดไหลย้อน (PPI)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Esomeprazole", category:"ยากรดไหลย้อน (PPI)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Lansoprazole", category:"ยากรดไหลย้อน (PPI)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Rabeprazole", category:"ยากรดไหลย้อน (PPI)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Famotidine", category:"ยากรดไหลย้อน (H2 blocker)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Ranitidine", category:"ยากรดไหลย้อน (H2 blocker)", note:"โดยทั่วไปกินต่อได้ตามปกติ", flag:"info"},
  {name:"Sodium bicarbonate", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Calcium carbonate", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Sevelamer", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Lanthanum carbonate", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Calcitriol", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Erythropoietin", category:"ยาโรคไต/เกลือแร่", note:"โดยทั่วไปกินต่อได้ตามปกติ ควรแจ้งวิสัญญีแพทย์", flag:"info"},
  {name:"Sertraline", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Fluoxetine", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Escitalopram", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Paroxetine", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Venlafaxine", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Duloxetine", category:"ยาโรคซึมเศร้า", note:"ควรรับประทานต่อเนื่อง ไม่ควรหยุดกะทันหัน ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Risperidone", category:"ยารักษาโรคทางจิตเวช", note:"ควรรับประทานต่อเนื่อง ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Olanzapine", category:"ยารักษาโรคทางจิตเวช", note:"ควรรับประทานต่อเนื่อง ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Quetiapine", category:"ยารักษาโรคทางจิตเวช", note:"ควรรับประทานต่อเนื่อง ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Haloperidol", category:"ยารักษาโรคทางจิตเวช", note:"ควรรับประทานต่อเนื่อง ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Diazepam", category:"ยากลุ่มเบนโซไดอาซีปีน", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหันเสี่ยงอาการจากการขาดยา ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Lorazepam", category:"ยากลุ่มเบนโซไดอาซีปีน", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหันเสี่ยงอาการจากการขาดยา ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Clonazepam", category:"ยากลุ่มเบนโซไดอาซีปีน", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหันเสี่ยงอาการจากการขาดยา ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Alprazolam", category:"ยากลุ่มเบนโซไดอาซีปีน", note:"ควรรับประทานต่อเนื่อง ห้ามหยุดกะทันหันเสี่ยงอาการจากการขาดยา ควรแจ้งวิสัญญีแพทย์", flag:"warn"},
  {name:"Phenytoin", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Carbamazepine", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Sodium valproate", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Levetiracetam", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Lamotrigine", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Topiramate", category:"ยากันชัก", note:"ควรรับประทานต่อเนื่อง หลีกเลี่ยงการขาดยาเพราะเสี่ยงชัก", flag:"warn"},
  {name:"Dexamethasone", category:"ยาสเตียรอยด์ชนิดกิน", note:"ควรแจ้งวิสัญญีแพทย์ ห้ามหยุดยากะทันหัน อาจต้องพิจารณาให้สเตียรอยด์เสริมเฉพาะราย (stress-dose steroid)", flag:"warn"},
  {name:"Tacrolimus", category:"ยากดภูมิคุ้มกัน", note:"ควรแจ้งวิสัญญีแพทย์ อาจต้องพิจารณาปรับยาหรือให้สเตียรอยด์เสริมเฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Cyclosporine", category:"ยากดภูมิคุ้มกัน", note:"ควรแจ้งวิสัญญีแพทย์ อาจต้องพิจารณาปรับยาหรือให้สเตียรอยด์เสริมเฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Mycophenolate mofetil", category:"ยากดภูมิคุ้มกัน", note:"ควรแจ้งวิสัญญีแพทย์ อาจต้องพิจารณาปรับยาหรือให้สเตียรอยด์เสริมเฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Azathioprine", category:"ยากดภูมิคุ้มกัน", note:"ควรแจ้งวิสัญญีแพทย์ อาจต้องพิจารณาปรับยาหรือให้สเตียรอยด์เสริมเฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"Methotrexate", category:"ยากดภูมิคุ้มกัน", note:"ควรแจ้งวิสัญญีแพทย์ อาจต้องพิจารณาปรับยาหรือให้สเตียรอยด์เสริมเฉพาะราย ห้ามหยุดเอง", flag:"warn"},
  {name:"น้ำมันปลา", category:"อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"แปะก๊วย", category:"สมุนไพร", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"โสม", category:"สมุนไพร", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจมีผลต่อการแข็งตัวของเลือดและระดับน้ำตาล", flag:"warn"},
  {name:"กระเทียมสกัด", category:"อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด เนื่องจากอาจเพิ่มความเสี่ยงเลือดออก", flag:"warn"},
  {name:"วิตามินอี", category:"วิตามิน/อาหารเสริม", note:"ควรหยุดล่วงหน้าอย่างน้อย 5-7 วันก่อนผ่าตัด หากรับประทานขนาดสูงต่อเนื่อง", flag:"info"},
];

const PROCEDURES = [
  {name:"ผ่าตัดไส้เลื่อน (Hernia Repair)",
   desc:"ผ่าตัดซ่อมผนังหน้าท้องบริเวณที่มีไส้เลื่อนโป่งออกมา ใช้เวลาผ่าตัดประมาณ 30-60 นาที ส่วนใหญ่กลับบ้านได้ในวันเดียวกัน",
   care:"งดยกของหนักและงดเบ่งแรงๆ ประมาณ 2-4 สัปดาห์ ดูแลแผลให้แห้งสะอาด สังเกตอาการบวม แดง หรือมีไข้ผิดปกติ"},
  {name:"ผ่าตัดเนื้องอกหรือซีสต์ (Tumor/Cyst Excision)",
   desc:"ผ่าตัดนำก้อนเนื้องอกหรือถุงน้ำ (ซีสต์) ออกจากร่างกาย มักใช้การดมยาสลบ (General Anesthesia) โดยมีทั้งวิสัญญีแพทย์และวิสัญญีพยาบาลดูแลอย่างใกล้ชิดตลอดการผ่าตัด",
   care:"งดสูบบุหรี่อย่างน้อย 4-8 สัปดาห์และงดแอลกอฮอล์อย่างน้อย 24 ชั่วโมงก่อนผ่าตัดหากทำได้ ต้องมีญาติหรือผู้ดูแลมารับกลับและอยู่ดูแลอย่างน้อย 24 ชั่วโมงแรกหลังผ่าตัด"},
  {name:"ผ่าตัดส่องกล้องถุงน้ำดี (Laparoscopic Cholecystectomy)",
   desc:"ผ่าตัดนำถุงน้ำดีออกผ่านกล้อง แผลเล็ก 3-4 จุด ฟื้นตัวเร็วกว่าการผ่าตัดแบบเปิดหน้าท้อง",
   care:"งดอาหารมันในช่วงแรก เดินเบาๆ ได้ตั้งแต่วันแรก หลีกเลี่ยงยกของหนัก 1-2 สัปดาห์ สังเกตอาการปวดท้องรุนแรงหรือไข้"},
  {name:"ส่องกล้องทางเดินอาหาร (Gastroscopy / Colonoscopy)",
   desc:"ส่องกล้องตรวจภายในกระเพาะอาหารหรือลำไส้ใหญ่ อาจมีการตัดชิ้นเนื้อตรวจร่วมด้วย ใช้เวลาประมาณ 15-45 นาที",
   care:"หลังส่องกล้องอาจมีอาการท้องอืดเล็กน้อย ควรมีผู้ดูแลมารับกลับหากได้รับยาระงับความรู้สึก งดขับรถในวันที่ทำหัตถการ"},
  {name:"ผ่าตัดต้อกระจก (Cataract Surgery)",
   desc:"ผ่าตัดเปลี่ยนเลนส์ตาที่ขุ่นเป็นเลนส์แก้วตาเทียม ใช้เวลาประมาณ 15-30 นาที ส่วนใหญ่ใช้ยาชาเฉพาะที่",
   care:"งดขยี้ตาและงดโดนน้ำบริเวณดวงตา 1-2 สัปดาห์ ใส่ยาหยอดตาตามแพทย์สั่งอย่างเคร่งครัด สวมแว่นกันแดด/ที่ครอบตาตามคำแนะนำ"},
  {name:"ผ่าตัดริดสีดวงทวาร (Hemorrhoidectomy)",
   desc:"ผ่าตัดเอาหัวริดสีดวงทวารที่โตออก อาจใช้การระงับความรู้สึกแบบบล็อกหลังหรือดมยาสลบ",
   care:"แช่ก้นในน้ำอุ่นตามคำแนะนำ รับประทานอาหารที่มีกากใยและดื่มน้ำมากเพื่อป้องกันท้องผูก หลีกเลี่ยงการนั่งนานๆ"},
  {name:"ผ่าตัดก้อนเนื้อเต้านม (Breast Lump Excision)",
   desc:"ผ่าตัดนำก้อนเนื้อในเต้านมออกเพื่อตรวจวินิจฉัยหรือรักษา แผลมักมีขนาดเล็ก ใช้เวลาผ่าตัดไม่นาน",
   care:"ใส่เสื้อชั้นในที่กระชับตามคำแนะนำ งดยกแขนสูงหรือยกของหนักข้างที่ผ่าตัดชั่วคราว สังเกตแผลบวมหรือมีเลือดออก"},
  {name:"ส่องกล้องข้อเข่า (Knee Arthroscopy)",
   desc:"ผ่าตัดส่องกล้องเข้าไปตรวจหรือซ่อมแซมโครงสร้างภายในข้อเข่า แผลเล็ก 2-3 จุด",
   care:"ใช้ไม้ค้ำยันหรืออุปกรณ์พยุงตามคำแนะนำ ประคบเย็นลดบวมในช่วงแรก ทำกายภาพบำบัดตามแพทย์นัด"},
  {name:"ผ่าตัดนิ้วล็อก (Trigger Finger Release)",
   desc:"ผ่าตัดคลายปลอกเอ็นที่รัดแน่นบริเวณนิ้วมือ ใช้ยาชาเฉพาะที่ ใช้เวลาสั้น",
   care:"ขยับนิ้วเบาๆ ตามคำแนะนำเพื่อลดข้อติด ดูแลแผลให้แห้ง หลีกเลี่ยงการหยิบจับของหนักด้วยนิ้วที่ผ่าตัดชั่วคราว"},
  {name:"ผ่าตัดพังผืดข้อมือกดทับเส้นประสาท (Carpal Tunnel Release)",
   desc:"ผ่าตัดคลายพังผืดที่กดทับเส้นประสาทบริเวณข้อมือ ใช้ยาชาเฉพาะที่หรือระงับความรู้สึกเฉพาะส่วน",
   care:"ยกมือให้สูงกว่าระดับหัวใจช่วงแรกเพื่อลดบวม ขยับนิ้วเบาๆ ได้ตามคำแนะนำ หลีกเลี่ยงยกของหนักด้วยมือข้างนั้น"},
  {name:"ผ่าตัดเส้นเลือดขอด (Varicose Vein Surgery)",
   desc:"ผ่าตัดหรือจี้ปิดเส้นเลือดขอดที่ขา อาจใช้การระงับความรู้สึกเฉพาะส่วนหรือดมยาสลบ",
   care:"สวมถุงน่องทางการแพทย์ตามคำแนะนำ เดินเบาๆ บ่อยๆ แต่หลีกเลี่ยงการยืนนิ่งนาน ยกขาสูงเวลาพัก"},
  {name:"ทำหมัน (Sterilization: ชาย/หญิง)",
   desc:"หัตถการคุมกำเนิดถาวร ทำได้ทั้งในชาย (ตัดหลอดนำอสุจิ) และหญิง (ผูก/ตัดท่อนำไข่) ใช้เวลาสั้น",
   care:"งดยกของหนักและมีเพศสัมพันธ์ตามระยะเวลาที่แพทย์แนะนำ ดูแลแผลให้แห้งสะอาด สังเกตอาการบวมหรือปวดผิดปกติ"},
  {name:"ผ่าตัดเล็บขบ (Ingrown Toenail Surgery)",
   desc:"ผ่าตัดแก้ไขเล็บที่ขบเข้าเนื้อจนอักเสบ ใช้ยาชาเฉพาะที่บริเวณนิ้ว ใช้เวลาสั้น",
   care:"แช่เท้าในน้ำอุ่นตามคำแนะนำ สวมรองเท้าหลวมไม่บีบนิ้ว ดูแลแผลให้แห้งสะอาดจนกว่าแผลจะหาย"},
  {name:"ผ่าตัดก้อนไขมันใต้ผิวหนัง (Lipoma Excision)",
   desc:"ผ่าตัดนำก้อนไขมันใต้ผิวหนังออก ใช้ยาชาเฉพาะที่ แผลมีขนาดตามขนาดก้อน",
   care:"ดูแลแผลให้แห้งสะอาด หลีกเลี่ยงการเกร็งหรือกระทบกระเทือนบริเวณแผล สังเกตอาการบวมแดงผิดปกติ"},
  {name:"ขูดมดลูก (Dilatation and Curettage - D&C)",
   desc:"หัตถการขยายปากมดลูกและขูดเนื้อเยื่อภายในโพรงมดลูกเพื่อการวินิจฉัยหรือรักษา ใช้เวลาสั้น",
   care:"อาจมีเลือดออกกะปริดกะปรอยได้ 1-2 สัปดาห์ งดมีเพศสัมพันธ์และงดใช้ผ้าอนามัยแบบสอดตามคำแนะนำแพทย์ สังเกตไข้หรือเลือดออกมาก"},
  {name:"ผ่าตัดต้อเนื้อ/ผังผืดตา (Pterygium Excision)",
   desc:"ผ่าตัดนำเนื้อเยื่อผังผืดที่ลุกลามบนตาขาวออก มักใช้ยาชาเฉพาะที่",
   care:"งดขยี้ตาและป้องกันฝุ่น/แสงแดดตามคำแนะนำ ใส่ยาหยอดตาตามแพทย์สั่ง สังเกตอาการปวดตาหรือมองเห็นผิดปกติ"},
  {name:"ขลิบหนังหุ้มปลายอวัยวะเพศ (Circumcision)",
   desc:"ผ่าตัดตัดหนังหุ้มปลายอวัยวะเพศชายออก ใช้ยาชาเฉพาะที่หรือดมยาสลบตามความเหมาะสมของอายุผู้ป่วย",
   care:"ดูแลแผลให้แห้งสะอาด ใส่เสื้อผ้าหลวมสบาย งดกิจกรรมที่กระทบกระเทือนบริเวณแผลตามระยะเวลาที่แพทย์แนะนำ"},
];

/**
 * คำแนะนำเตรียมตัวแบบละเอียดเฉพาะหัตถการ (แสดงในแท็บคลังความรู้ > "เตรียมตัวเฉพาะหัตถการ")
 * key ต้องตรงกับ PROCEDURES[].name เพื่อให้เชื่อมกับ Timeline/หน้าแรกอัตโนมัติได้เมื่อผู้ป่วยเลือกหัตถการนั้นไว้
 */
const PROCEDURE_GUIDES = {
  "ส่องกล้องทางเดินอาหาร (Gastroscopy / Colonoscopy)": {
    intro: "การส่องกล้องลำไส้ใหญ่เป็นการตรวจวินิจฉัยและรักษาโรคของลำไส้ใหญ่ โดยแพทย์จะใช้กล้องส่องผ่านทางทวารหนัก ในผู้ป่วยบางรายวิสัญญีแพทย์จะให้ยาระงับความรู้สึกแบบ Sedation (หลับตื้น) หรือ Total Intravenous Anesthesia (TIVA) เพื่อให้ผู้ป่วยรู้สึกผ่อนคลาย ไม่เจ็บ และไม่จดจำเหตุการณ์ระหว่างการตรวจ",
    sections: [
      {icon:"🧻", title:"1. การเตรียมลำไส้ (Bowel Preparation)",
       body:"การทำความสะอาดลำไส้เป็นปัจจัยสำคัญที่สุด เพราะหากลำไส้สะอาด แพทย์จะสามารถตรวจพบความผิดปกติได้ชัดเจน ผู้ป่วยควรรับประทานยาระบายตามที่แพทย์สั่งอย่างเคร่งครัด ดื่มน้ำตามปริมาณที่กำหนด หากอุจจาระยังขุ่นหรือมีเศษอาหารควรแจ้งเจ้าหน้าที่"},
      {icon:"🍽️", title:"2. อาหารก่อนตรวจ",
       body:"3 วันก่อนตรวจ: หลีกเลี่ยงอาหารที่มีกากใยสูง เช่น ผักสด ผลไม้ที่มีเมล็ด ธัญพืช (ข้าวโพด งา ถั่ว สาหร่าย) และข้าวกล้อง สามารถรับประทานอาหารอ่อนที่ย่อยง่ายได้<br><br>1 วันก่อนตรวจ: รับประทานเฉพาะน้ำเปล่า น้ำหวานใส น้ำผลไม้ไม่มีเนื้อ น้ำซุปใส และเครื่องดื่มเกลือแร่ หลีกเลี่ยงนม น้ำสีแดงหรือม่วง และอาหารทุกชนิดหลังเวลาที่แพทย์กำหนด"},
      {icon:"🚫", title:"3. การงดน้ำและอาหาร (Fasting)",
       body:"เพื่อป้องกันการสำลักขณะได้รับยาระงับความรู้สึก ให้งดอาหารและน้ำหลังเที่ยงคืนก่อนวันตรวจ ส่วนเวลา 05.00 น. เช้าวันตรวจ รับประทานเฉพาะยาที่แพทย์สั่งอย่างเคร่งครัด (ถ้ามี)"},
      {icon:"💊", title:"4. ยาประจำ",
       body:"ควรแจ้งแพทย์ทุกชนิดที่รับประทานอยู่ เช่น ยาความดัน ยาเบาหวาน ยาหัวใจ ยาละลายลิ่มเลือด ยาต้านเกล็ดเลือด สมุนไพร และอาหารเสริม <b>ไม่ควรหยุดยาเอง</b> ยกเว้นได้รับคำแนะนำจากแพทย์"},
      {icon:"🩺", title:"5. แจ้งข้อมูลสำคัญแก่ทีมวิสัญญี",
       body:"ควรแจ้งหากมี: ประวัติแพ้ยา โรคหัวใจ โรคปอด โรคหอบหืด โรคไต โรคตับ ภาวะหยุดหายใจขณะหลับ (OSA) การตั้งครรภ์ หรือเคยได้รับยาระงับความรู้สึกแล้วเกิดภาวะแทรกซ้อน"},
      {icon:"📄", title:"6. สิ่งที่ควรนำมาในวันตรวจ",
       body:"บัตรประชาชนหรือเอกสารนัด, รายชื่อยาที่ใช้ประจำ, ผลตรวจหรือฟิล์มเอกซเรย์ (ถ้ามี), ผลตรวจเลือดหรือคลื่นไฟฟ้าหัวใจ (ถ้าแพทย์นัดให้นำมา)"},
      {icon:"👕", title:"7. การแต่งกาย",
       body:"สวมเสื้อผ้าที่สบาย งดเครื่องประดับ งดทาเล็บหรือเล็บปลอม (หากโรงพยาบาลกำหนด) ถอดฟันปลอมก่อนตรวจ และถอดคอนแทคเลนส์"},
      {icon:"👪", title:"8. ญาติควรมาด้วย",
       body:"เนื่องจากได้รับยาระงับความรู้สึก ผู้ป่วยไม่ควรขับรถกลับเอง ต้องมีญาติหรือผู้ดูแลมารับกลับบ้าน หากไม่มีผู้ดูแล อาจต้องเลื่อนการตรวจตามนโยบายของโรงพยาบาล"},
      {icon:"📈", title:"9. ระหว่างการตรวจ",
       body:"ทีมวิสัญญีจะดูแลอย่างใกล้ชิด โดยติดตามคลื่นไฟฟ้าหัวใจ (ECG) ความดันโลหิต ชีพจร ระดับออกซิเจนในเลือด (SpO₂) และการหายใจ ผู้ป่วยจะได้รับออกซิเจนและยาระงับความรู้สึกทางหลอดเลือดดำ พร้อมเฝ้าระวังตลอดการตรวจ"},
      {icon:"😴", title:"10. หลังการตรวจ",
       body:"หลังได้รับยาระงับความรู้สึก อาจมีอาการง่วงซึม เวียนศีรษะ หรือท้องอืดจากลมที่ใช้ระหว่างส่องกล้อง อาการเหล่านี้มักดีขึ้นภายในไม่กี่ชั่วโมง<br><br><b>หลังกลับบ้าน ควรหลีกเลี่ยงภายใน 24 ชั่วโมง:</b> ขับรถ ใช้เครื่องจักร ดื่มเครื่องดื่มแอลกอฮอล์ เซ็นเอกสารสำคัญ หรือตัดสินใจเรื่องสำคัญ ควรพักผ่อนและดื่มน้ำให้เพียงพอ"},
      {icon:"🚨", title:"11. อาการที่ควรรีบกลับมาพบแพทย์",
       body:"หากมีอาการต่อไปนี้ ควรรีบมาพบแพทย์ทันที: ปวดท้องรุนแรง ท้องแข็ง เลือดออกทางทวารหนักจำนวนมาก ไข้สูง หนาวสั่น อาเจียนมาก หายใจลำบาก เจ็บหน้าอก หรือซึมผิดปกติ"},
    ],
    tip: "การเตรียมลำไส้ที่สะอาดและการงดอาหารตามคำแนะนำ เป็นปัจจัยสำคัญที่ช่วยให้การส่องกล้องมีคุณภาพ ลดโอกาสต้องตรวจซ้ำ และเพิ่มความปลอดภัยระหว่างการให้ยาระงับความรู้สึก"
  },

  "ผ่าตัดไส้เลื่อน (Hernia Repair)": {
    intro: "การผ่าตัดไส้เลื่อนสามารถทำได้ทั้งแบบเปิดแผล (Open Hernia Repair) และแบบส่องกล้อง ทั้งนี้วิธีการระงับความรู้สึกจะพิจารณาตามชนิดของการผ่าตัด ตำแหน่งของไส้เลื่อน โรคประจำตัว และดุลยพินิจของศัลยแพทย์ร่วมกับวิสัญญีแพทย์",
    sections: [
      {icon:"💉", title:"1. การระงับความรู้สึกสำหรับการผ่าตัด",
       body:"สำหรับการผ่าตัดแบบเปิด ผู้ป่วยส่วนใหญ่มักได้รับวิธีใดวิธีหนึ่ง: <b>การฉีดยาชาทางช่องไขสันหลัง (Spinal Anesthesia)</b> ทำให้ร่างกายตั้งแต่ระดับเอวลงไปชา ยังรู้สึกตัวแต่ไม่เจ็บบริเวณผ่าตัด หรือ <b>การฉีดยาชาเฉพาะบริเวณแผลร่วมกับยาระงับความรู้สึกแบบหลับตื้น (Local + Sedation)</b> ทำให้รู้สึกผ่อนคลาย ง่วง หรือหลับตื้น มักจำเหตุการณ์ระหว่างผ่าตัดได้น้อยหรือจำไม่ได้ ในบางกรณี เช่น ผ่าตัดที่ซับซ้อนหรือผ่าตัดส่องกล้อง อาจจำเป็นต้องดมยาสลบ"},
      {icon:"🩺", title:"2. แจ้งข้อมูลสุขภาพให้ครบถ้วน",
       body:"โปรดแจ้งทีมวิสัญญีหากมีโรคประจำตัว (หัวใจ ปอด เบาหวาน ความดันโลหิตสูง) ประวัติแพ้ยาหรือเคยมีภาวะแทรกซ้อนจากการระงับความรู้สึก กำลังรับประทานยาละลายลิ่มเลือด/ยาต้านเกล็ดเลือด/สมุนไพร หรือมีไข้ ไอ เจ็บคอ ก่อนวันผ่าตัด"},
      {icon:"🚫", title:"3. การงดอาหารและน้ำ",
       body:"งดอาหารและน้ำตามคำแนะนำของโรงพยาบาล <b>แม้จะไม่ได้ดมยาสลบ</b> เนื่องจากอาจต้องเปลี่ยนวิธีระงับความรู้สึกกะทันหัน โดยทั่วไปงดอาหารอย่างน้อย 6-8 ชั่วโมง และดื่มน้ำใสได้จนถึง 2 ชั่วโมงก่อนผ่าตัดตามคำแนะนำของแพทย์"},
      {icon:"🛁", title:"4. เช้าวันผ่าตัด",
       body:"อาบน้ำทำความสะอาดร่างกาย งดสวมเครื่องประดับและของมีค่า สวมเสื้อผ้าตามที่โรงพยาบาลจัดให้ รับประทานยาประจำเฉพาะที่แพทย์อนุญาตเท่านั้น"},
      {icon:"📈", title:"5. ระหว่างการผ่าตัด",
       body:"หากฉีดยาชาทางช่องไขสันหลัง: จะรู้สึกชาตั้งแต่เอวลงไป ไม่สามารถขยับขาได้ชั่วคราว หากกังวลสามารถแจ้งทีมวิสัญญีเพื่อรับยาช่วยผ่อนคลายได้<br><br>หากฉีดยาชาเฉพาะที่ร่วมกับหลับตื้น: จะรู้สึกผ่อนคลาย ง่วง หรือหลับตื้น หายใจเองได้ตลอด ทีมวิสัญญีจะติดตามการหายใจ ความดันโลหิต ชีพจร และออกซิเจนอย่างใกล้ชิด"},
      {icon:"😴", title:"6. หลังการผ่าตัด",
       body:"พักฟื้นจนสัญญาณชีพคงที่ หากฉีดยาชาทางช่องไขสันหลัง ขาจะยังชาและอ่อนแรงประมาณ 2-6 ชั่วโมง <b>ไม่ควรลุกเดินเองจนกว่าเจ้าหน้าที่จะอนุญาต</b> อาจมีอาการปัสสาวะลำบากชั่วคราวซึ่งดีขึ้นเมื่อฤทธิ์ยาหมด อาการอื่นที่อาจพบ: ง่วงนอน คลื่นไส้ เวียนศีรษะ ปวดแผล หรือปวดหลังเล็กน้อยบริเวณที่ฉีดยาชา"},
      {icon:"🏨", title:"7. การพักรักษาตัว",
       body:"ขึ้นอยู่กับชนิดการผ่าตัดและการฟื้นตัว บางรายกลับบ้านได้ภายในวันเดียว (Day Surgery) บางรายอาจต้องนอนโรงพยาบาล 1 คืนหรือมากกว่านั้นตามดุลยพินิจแพทย์"},
      {icon:"🏠", title:"8. เมื่อกลับบ้าน",
       body:"เดินและทำกิจกรรมเบาๆ ได้ตามคำแนะนำ หลีกเลี่ยงยกของหนัก เบ่งแรง หรือออกกำลังกายหนักในช่วงแรก รับประทานยาและดูแลแผลตามคำแนะนำ หากได้รับยาระงับความรู้สึกแบบหลับตื้น <b>ไม่ควรขับรถ ดื่มแอลกอฮอล์ หรือทำงานกับเครื่องจักรอย่างน้อย 24 ชั่วโมง</b> มาพบแพทย์ตามนัด"},
      {icon:"🚨", title:"9. อาการที่ควรรีบกลับมาพบแพทย์",
       body:"แผลบวมแดง มีหนอง หรือเลือดออกมาก, ไข้สูง, ปวดแผลรุนแรงผิดปกติ, ปัสสาวะไม่ออกเป็นเวลานานหลังผ่าตัด, ขาชาหรืออ่อนแรงนานกว่าที่แพทย์แจ้ง, หรือหายใจลำบาก เจ็บหน้าอก หมดสติ"},
    ],
    tip: "หากได้รับการฉีดยาชาทางช่องไขสันหลัง ควรรอให้ขาหายชาและได้รับอนุญาตจากเจ้าหน้าที่ก่อนลุกเดิน และหากกลับบ้านภายในวันเดียว ควรมีญาติหรือผู้ดูแลพากลับบ้านและอยู่ดูแลอย่างน้อย 24 ชั่วโมงแรก"
  },

  "ผ่าตัดเนื้องอกหรือซีสต์ (Tumor/Cyst Excision)": {
    intro: "กรณีได้รับการระงับความรู้สึกแบบดมยาสลบ (General Anesthesia) คือการให้ยาทางหลอดเลือดดำและ/หรือยาดมผ่านทางเดินหายใจ เพื่อให้ผู้ป่วยหลับ ไม่รู้สึกเจ็บปวด และไม่รับรู้ระหว่างการผ่าตัด โดยมีทั้งวิสัญญีแพทย์และวิสัญญีพยาบาลดูแลอย่างใกล้ชิดตลอดการผ่าตัด",
    sections: [
      {icon:"🩺", title:"1. แจ้งข้อมูลสุขภาพให้ครบถ้วน",
       body:"โปรดแจ้งทีมวิสัญญีหากมีโรคประจำตัว (ความดันโลหิตสูง เบาหวาน หัวใจ ปอด ไต ตับ) ประวัติแพ้ยา แพ้อาหาร หรือแพ้สารต่างๆ เคยมีภาวะแทรกซ้อนจากการดมยาสลบ ฟันโยก ฟันปลอม ครอบฟัน กำลังตั้งครรภ์หรือสงสัยว่าตั้งครรภ์ หรือเป็นหวัด ไอ มีไข้ก่อนวันผ่าตัด"},
      {icon:"💊", title:"2. แจ้งยาที่รับประทานเป็นประจำ",
       body:"นำรายการยาหรือยาที่ใช้ประจำมาด้วยทุกครั้ง ทั้งยาความดัน ยาเบาหวาน ยาละลายลิ่มเลือด/ยาต้านเกล็ดเลือด สมุนไพร อาหารเสริม และวิตามิน <b>ห้ามหยุดยาเอง</b> ควรปฏิบัติตามคำแนะนำของแพทย์อย่างเคร่งครัด"},
      {icon:"🚭", title:"3. งดสูบบุหรี่และแอลกอฮอล์",
       body:"ควรงดสูบบุหรี่อย่างน้อย 4-8 สัปดาห์ก่อนผ่าตัดหากทำได้ และงดเครื่องดื่มแอลกอฮอล์อย่างน้อย 24 ชั่วโมงก่อนผ่าตัด เพื่อช่วยให้การทำงานของปอดและการฟื้นตัวดีขึ้น"},
      {icon:"🍽️", title:"4. การงดอาหารและน้ำก่อนผ่าตัด",
       body:"เพื่อป้องกันการสำลักอาหารเข้าปอดระหว่างดมยาสลบ: อาหารมื้อหนัก/อาหารมัน/เนื้อสัตว์ งดอย่างน้อย 8 ชั่วโมง · นมผง/นมวัว/อาหารเหลวข้น งดอย่างน้อย 6 ชั่วโมง · นมแม่ งดอย่างน้อย 4 ชั่วโมง · น้ำใส (น้ำเปล่า ชา/กาแฟไม่ใส่นม น้ำผลไม้ไม่มีเนื้อ) ดื่มได้ถึง 2 ชั่วโมงก่อนผ่าตัด หากรับประทานผิดเวลา กรุณาแจ้งเจ้าหน้าที่ทันที เพราะอาจต้องเลื่อนผ่าตัดเพื่อความปลอดภัย"},
      {icon:"🛁", title:"5. เช้าวันผ่าตัด",
       body:"อาบน้ำทำความสะอาดร่างกาย ไม่แต่งหน้า ไม่ทาลิปสติก ไม่ทาเล็บมือ/เท้าและไม่ติดเล็บปลอม งดเครื่องประดับทุกชนิด ถอดคอนแทคเลนส์ ฟันปลอม เครื่องช่วยฟัง ก่อนเข้าห้องผ่าตัด สวมเสื้อผ้าตามที่โรงพยาบาลจัดให้ รับประทานยาตามคำสั่งแพทย์เท่านั้น โดยดื่มน้ำเพียงเล็กน้อย"},
      {icon:"📈", title:"6. ระหว่างการผ่าตัด",
       body:"ทีมวิสัญญีจะดูแลอย่างต่อเนื่อง โดยติดตามคลื่นไฟฟ้าหัวใจ ความดันโลหิต ระดับออกซิเจนในเลือด การหายใจ และระดับความลึกของการระงับความรู้สึก (ในรายที่จำเป็น) เพื่อความปลอดภัยสูงสุด"},
      {icon:"😴", title:"7. หลังการผ่าตัด",
       body:"จะได้รับการดูแลในห้องพักฟื้น (PACU) จนกว่าจะปลอดภัยก่อนกลับหอผู้ป่วย อาการที่อาจพบและมักหายเอง: ง่วงนอน เจ็บคอหรือเสียงแหบเล็กน้อย คลื่นไส้อาเจียน หนาวสั่น เวียนศีรษะ หากปวดมาก หายใจลำบาก เจ็บหน้าอก หรือคลื่นไส้อาเจียนรุนแรง ควรแจ้งเจ้าหน้าที่ทันที"},
      {icon:"👪", title:"8. ก่อนกลับบ้าน",
       body:"ควรมีญาติหรือผู้ดูแลมารับและอยู่ดูแลอย่างน้อย 24 ชั่วโมงแรก ไม่ควรขับรถหรือเดินทางกลับเพียงลำพัง รับฟังคำแนะนำเรื่องการดูแลแผล การรับประทานยา และวันนัดหมายให้ครบถ้วน สอบถามข้อสงสัยก่อนเดินทางกลับ"},
      {icon:"⚠️", title:"9. ภายใน 24 ชั่วโมงหลังได้รับยาสลบ",
       body:"ยาระงับความรู้สึกอาจมีผลต่อการตัดสินใจ การทรงตัว และการตอบสนอง แม้จะรู้สึกเป็นปกติแล้วก็ตาม จึงควรหลีกเลี่ยง: ขับรถ/ขี่มอเตอร์ไซค์/ควบคุมเครื่องจักร, ทำงานบนที่สูงหรือกิจกรรมเสี่ยงอุบัติเหตุ, ดื่มแอลกอฮอล์, รับประทานยานอนหลับ/ยาที่ทำให้ง่วงโดยไม่ได้รับคำแนะนำจากแพทย์, และการลงนามเอกสารสำคัญหรือตัดสินใจเรื่องสำคัญ"},
      {icon:"🍚", title:"10. คำแนะนำเมื่อกลับบ้าน",
       body:"<b>การรับประทานอาหาร:</b> เริ่มจากจิบน้ำ เมื่อไม่คลื่นไส้จึงเริ่มอาหารอ่อนย่อยง่าย รับประทานครั้งละน้อยแต่บ่อยครั้งหากยังคลื่นไส้ ดื่มน้ำให้เพียงพอ<br><br><b>การดูแลตนเอง:</b> พักผ่อนให้เพียงพอในวันแรก ลุกเดินเบาๆ ภายในบ้านเมื่อพร้อม รับประทานยาแก้ปวดตามแพทย์สั่งอย่างสม่ำเสมอ ดูแลแผลให้สะอาดแห้ง มาพบแพทย์ตามนัดทุกครั้ง"},
      {icon:"🚨", title:"11. อาการที่ควรรีบกลับมาพบแพทย์",
       body:"เลือดออกจากแผลมากหรือซึมไม่หยุด, ปวดแผลรุนแรงผิดปกติแม้กินยาแล้ว, ไข้สูง หนาวสั่น หรือแผลบวมแดงมีหนอง, หายใจลำบาก เจ็บหน้าอก หรือหมดสติ, คลื่นไส้อาเจียนตลอดเวลาจนกินอาหาร/น้ำไม่ได้, เวียนศีรษะมาก หน้ามืด หรือเป็นลม, หรือปัสสาวะไม่ออกภายใน 6-8 ชั่วโมงหลังกลับบ้าน (ในรายที่ไม่ได้ใส่สายสวนปัสสาวะ)"},
    ],
    tip: "งดอาหารและน้ำตามเวลาที่กำหนดอย่างเคร่งครัด รับประทานยาประจำตามคำแนะนำของแพทย์เท่านั้น และแจ้งข้อมูลโรคประจำตัว ยาที่ใช้ และประวัติการแพ้ยาให้ครบถ้วน — กลับบ้านได้ ไม่ได้หมายความว่าร่างกายฟื้นตัวเต็มที่ ควรมีผู้ดูแลอยู่ด้วยอย่างน้อย 24 ชั่วโมงแรก และหากมีข้อสงสัยหรืออาการผิดปกติควรติดต่อโรงพยาบาลทันที ไม่ควรรอดูอาการเอง"
  },
};

const ASSESS_STEPS = [
  {key:"disease", q:"ท่านมีโรคประจำตัวข้อใดต่อไปนี้บ้าง (เลือกได้มากกว่า 1 ข้อ)", type:"multi"},
  {key:"meds", q:"ยาที่รับประทานเป็นประจำ (ถ้ามี ระบุได้สูงสุด 10 รายการ)", type:"meds"},
  {key:"allergy", q:"ท่านแพ้ยาหรือแพ้อาหารหรือไม่", type:"yn_text", ph:"ระบุยา/อาหารที่แพ้ และอาการที่เกิดขึ้น"},
  {key:"prevAnes", q:"ท่านเคยดมยาสลบ/ระงับความรู้สึกมาก่อนหรือไม่", type:"yn_text", ph:"ระบุปัญหาที่เคยพบ (ถ้ามี) เช่น แพ้ยาสลบ อาเจียนมาก"},
  {key:"familyAnesAllergy", q:"คนในครอบครัวหรือญาติเคยมีประวัติแพ้ยาสลบหรือไม่", type:"yn_text", ph:"ระบุความเกี่ยวข้อง (เช่น พ่อ/แม่/พี่น้อง) และอาการที่เคยเกิดขึ้น (ถ้าทราบ)"},
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
    else if(s.type==="meds") assessAnswers[s.key] = {items: Array.from({length:10}, ()=>({name:"",category:"",note:"",flag:"",action:null,stopDays:null}))};
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

const STOP_DAY_OPTIONS = [1,2,3,5,7,10,14];

function renderMedsRows(cur){
  return cur.items.map((it,idx)=>`
    <div class="med-row">
      <label class="med-row-label">ยาตัวที่ ${idx+1}</label>
      <input type="text" class="txt-input autocomplete-input" id="medInput-${idx}"
        placeholder="พิมพ์ชื่อยา เช่น Amlodipine, Metformin"
        value="${(it.name||'').replace(/"/g,'&quot;')}"
        oninput="onMedInput(${idx}, this.value)"
        onfocus="onMedInput(${idx}, this.value)"
        onblur="setTimeout(function(){hideMedSuggest(${idx});}, 150)">
      <div class="med-suggest" id="medSuggest-${idx}"></div>
      <div id="medNote-${idx}">${it.name && it.note ? renderMedNoteHtml(it) : ""}</div>
      ${renderMedActionHtml(idx, it)}
    </div>
  `).join("");
}

function renderMedNoteHtml(it){
  const icon = it.flag === "warn" ? "⚠️" : "ℹ️";
  return `<div class="summary-flag ${it.flag||'info'}" style="margin-top:8px;">${icon} <b>${it.category}</b><br>${it.note}</div>`;
}

/**
 * ปุ่มให้ผู้ป่วย/เจ้าหน้าที่บันทึกว่า "แพทย์สั่งให้จัดการยาตัวนี้อย่างไร"
 * ตั้งใจไม่ preselect ค่าใดๆ ไว้ล่วงหน้า แม้ฐานข้อมูลยาจะมีคำแนะนำทั่วไปอยู่แล้วก็ตาม
 * เพราะคำสั่งจริงต้องมาจากแพทย์ผู้ดูแลเฉพาะราย แอปมีหน้าที่แค่ "บันทึก" ไม่ใช่ "ตัดสินใจ" แทน
 */
function renderMedActionHtml(idx, item){
  if(!item.name || !item.name.trim()) return `<div id="medAction-${idx}"></div>`;
  const action = item.action || null;
  return `
    <div id="medAction-${idx}" class="med-action-group">
      <div class="med-action-label">แพทย์แนะนำให้จัดการยาตัวนี้อย่างไร</div>
      <div class="seg" style="margin-top:6px;">
        <button class="seg-btn small ${action==='continue'?'sel':''}" onclick="setMedAction(${idx}, 'continue')">กินต่อถึงเช้าวันผ่าตัด</button>
        <button class="seg-btn small ${action==='stopMorning'?'sel':''}" onclick="setMedAction(${idx}, 'stopMorning')">หยุดเช้าวันผ่าตัด</button>
        <button class="seg-btn small ${action==='sprayMorning'?'sel':''}" onclick="setMedAction(${idx}, 'sprayMorning')">พ่นยาเช้าก่อนไปผ่าตัด</button>
        <button class="seg-btn small ${action==='stopDays'?'sel':''}" onclick="setMedAction(${idx}, 'stopDays')">หยุดล่วงหน้า...</button>
      </div>
      ${action==='stopDays' ? `
        <div class="days-chip-row">
          ${STOP_DAY_OPTIONS.map(d=>`<button class="seg-btn small ${item.stopDays===d?'sel':''}" onclick="setMedStopDays(${idx}, ${d})">${d} วัน</button>`).join("")}
        </div>
      ` : ``}
    </div>
  `;
}

function setMedAction(idx, action){
  const item = assessAnswers.meds.items[idx];
  item.action = action;
  if(action !== "stopDays") item.stopDays = null;
  refreshMedActionArea(idx);
}
function setMedStopDays(idx, days){
  const item = assessAnswers.meds.items[idx];
  item.action = "stopDays";
  item.stopDays = days;
  refreshMedActionArea(idx);
}
function refreshMedActionArea(idx){
  const item = assessAnswers.meds.items[idx];
  const box = document.getElementById(`medAction-${idx}`);
  if(box) box.outerHTML = renderMedActionHtml(idx, item);
}

function onMedInput(idx, val){
  const items = assessAnswers.meds.items;
  // ถ้าผู้ใช้พิมพ์ใหม่ไม่ตรงกับที่เคยเลือกไว้ ให้ล้างข้อมูลยาเดิมก่อน (เก็บแค่ข้อความที่พิมพ์)
  if(items[idx].name !== val){
    items[idx] = {name: val, category:"", note:"", flag:"", action:null, stopDays:null};
  }
  const noteBox = document.getElementById(`medNote-${idx}`);
  if(noteBox) noteBox.innerHTML = "";
  refreshMedActionArea(idx);

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
  assessAnswers.meds.items[idx] = {name: drug.name, category: drug.category, note: drug.note, flag: drug.flag, action:null, stopDays:null};
  const input = document.getElementById(`medInput-${idx}`);
  if(input) input.value = drug.name;
  const noteBox = document.getElementById(`medNote-${idx}`);
  if(noteBox) noteBox.innerHTML = renderMedNoteHtml(drug);
  refreshMedActionArea(idx);
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
    renderHome();
    renderTimeline();
  }
}

function medActionLabel(m){
  if(m.action === "continue") return "กินต่อได้ถึงเช้าวันผ่าตัด";
  if(m.action === "stopMorning") return "หยุดเช้าวันผ่าตัด";
  if(m.action === "sprayMorning") return "พ่นยาเช้าก่อนไปผ่าตัด";
  if(m.action === "stopDays" && m.stopDays) return `หยุดล่วงหน้า ${m.stopDays} วันก่อนผ่าตัด`;
  return "";
}

/** จับคู่ "หยุดล่วงหน้ากี่วัน" เข้ากับหมวดใน Timeline ที่ใกล้เคียงที่สุด */
function stageKeyForStopDays(days){
  if(days >= 7) return "d7";
  if(days === 5 || days === 6) return "d5";
  if(days === 3 || days === 4) return "d3";
  if(days === 2) return "d1";
  if(days === 1) return "night";
  return null;
}

/** รายการยาที่ควรแสดงเตือนในการ์ดของแต่ละ stage บน Timeline */
function getMedItemsForStage(stageKey){
  if(!state.assessment || !state.assessment.meds) return [];
  const meds = (state.assessment.meds.items||[]).filter(m=>m.name && m.name.trim() && m.action);

  if(stageKey === "morning"){
    return meds.filter(m=>m.action==="stopMorning" || m.action==="continue" || m.action==="sprayMorning").map(m=>{
      if(m.action==="stopMorning"){
        return {icon:"🚫", title:`งดยา ${m.name}`, desc:"งดรับประทานเช้าวันผ่าตัด ตามที่แพทย์สั่ง"};
      }
      if(m.action==="sprayMorning"){
        return {icon:"💨", title:`พ่นยา ${m.name}`, desc:"พ่นยาเช้าก่อนออกจากบ้านมาโรงพยาบาล ตามที่แพทย์สั่ง"};
      }
      return {icon:"✅", title:`กินยา ${m.name} ได้ตามปกติ`, desc:"รับประทานต่อได้ถึงเช้าวันผ่าตัด (จิบน้ำเปล่าเล็กน้อยได้)"};
    });
  }

  return meds.filter(m=>m.action==="stopDays" && m.stopDays && stageKeyForStopDays(m.stopDays)===stageKey)
    .map(m=>({
      icon:"💊",
      title:`หยุดยา ${m.name}`,
      desc:`ตามแผนหยุดล่วงหน้า ${m.stopDays} วันก่อนผ่าตัด ตามที่แพทย์สั่ง`
    }));
}

/** แจ้งเตือนเรื่องยาที่ตรงกับ "วันนี้" พอดี ใช้แสดงในการ์ด "วันนี้ควรทำ" หน้าแรก */
/** แจ้งเตือนเรื่องงดน้ำงดอาหาร (ตามที่ผู้ป่วย/ญาติพิมพ์บันทึกไว้เอง) ที่ตรงกับวันนี้พอดี */
function computeNpoAlertForToday(){
  const n = state.doctorNotes;
  if(!n || !n.npoDate || !n.npoTime) return [];
  const npoDateOnly = n.npoDate;
  const todayIso = new Date().toISOString().slice(0,10);
  if(npoDateOnly !== todayIso) return [];
  let msg = `🚫 งดน้ำงดอาหารตั้งแต่เวลา ${n.npoTime} น. วันนี้ (ตามที่บันทึกไว้)`;
  if(n.npoException && n.npoException.trim()) msg += ` — ${n.npoException.trim()}`;
  return [msg];
}

/** แจ้งเตือนเฉพาะหัตถการ (เช่น การเตรียมลำไส้ก่อนส่องกล้อง) ที่ตรงกับวันนี้พอดี ตามหัตถการที่เลือกไว้ */
function computeProcedureAlertsForToday(){
  if(!state.surgeryDate || !state.procedure) return [];
  const alertsByDay = PROCEDURE_HOME_ALERTS[state.procedure];
  if(!alertsByDay) return [];
  const sd = new Date(state.surgeryDate); sd.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((sd - today)/86400000);
  return alertsByDay[diff] || [];
}

function computeMedAlertsForToday(){
  if(!state.surgeryDate || !state.assessment || !state.assessment.meds) return [];
  const sd = new Date(state.surgeryDate); sd.setHours(0,0,0,0);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((sd - today)/86400000);

  const meds = (state.assessment.meds.items||[]).filter(m=>m.name && m.name.trim() && m.action);
  const alerts = [];
  meds.forEach(m=>{
    if(m.action === "stopDays" && m.stopDays){
      if(diff === m.stopDays){
        alerts.push(`💊 วันนี้ควรหยุดยา ${m.name} ตามที่แพทย์แนะนำ (${m.stopDays} วันก่อนผ่าตัด)`);
      } else if(diff >= 0 && diff < m.stopDays){
        // ผ่านวันที่ควรหยุดมาแล้ว แต่ยังไม่ถึงวันผ่าตัด — เตือนซ้ำทุกวันกันลืม/กันพลาด
        alerts.push(`💊 ยา ${m.name} ควรหยุดไปแล้วตั้งแต่ ${m.stopDays} วันก่อนผ่าตัด (โปรดตรวจสอบว่าหยุดแล้ว)`);
      }
    } else if(m.action === "stopMorning"){
      if(diff === 0){
        alerts.push(`💊 งดยา ${m.name} เช้านี้ (วันผ่าตัด)`);
      } else if(diff > 0 && diff <= 3){
        alerts.push(`💊 กินยา ${m.name} ได้ตามปกติวันนี้ (จะงดเฉพาะเช้าวันผ่าตัดเท่านั้น)`);
      }
    } else if(m.action === "continue" && diff >= 0 && diff <= 3){
      alerts.push(diff === 0
        ? `💊 กินยา ${m.name} ได้ตามปกติถึงเช้านี้`
        : `💊 กินยา ${m.name} ตามปกติต่อไปได้ถึงเช้าวันผ่าตัด`);
    } else if(m.action === "sprayMorning" && diff === 0){
      alerts.push(`💨 พ่นยา ${m.name} เช้าวันนี้ก่อนออกจากบ้านมาโรงพยาบาล ตามที่แพทย์สั่ง`);
    }
  });
  return alerts;
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
      const actionText = medActionLabel(m);
      if(m.note){
        flags.push({type: m.flag||"info", text:`${m.name} (${m.category}): ${m.note}${actionText ? ` — <b>คำสั่งแพทย์: ${actionText}</b>` : ""}`});
      } else {
        flags.push({type:"info", text:`${m.name}: ไม่พบข้อมูลยานี้ในฐานข้อมูล โปรดแจ้งชื่อยานี้กับวิสัญญีแพทย์โดยตรง${actionText ? ` — <b>คำสั่งแพทย์: ${actionText}</b>` : ""}`});
      }
    });
  }

  if(answers.allergy && answers.allergy.yn) flags.push({type:"warn", text:"มีประวัติแพ้ยา/อาหาร — โปรดแจ้งวิสัญญีแพทย์โดยละเอียด" + (answers.allergy.text?` (${answers.allergy.text})`:"")});
  if(answers.prevAnes && answers.prevAnes.yn) flags.push({type:"info", text:"เคยดมยาสลบมาก่อน — โปรดแจ้งปัญหาที่เคยพบให้ทีมทราบ" + (answers.prevAnes.text?` (${answers.prevAnes.text})`:"")});
  if(answers.familyAnesAllergy && answers.familyAnesAllergy.yn) flags.push({type:"warn", text:"คนในครอบครัว/ญาติเคยมีประวัติแพ้ยาสลบ — โปรดแจ้งวิสัญญีแพทย์โดยละเอียด" + (answers.familyAnesAllergy.text?` (${answers.familyAnesAllergy.text})`:"")});
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
  renderHome();
  renderTimeline();
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
    text += `- ยาที่รับประทานประจำ: ${meds.length ? meds.map(m=>{
      const a = medActionLabel(m);
      return a ? `${m.name} (${a})` : m.name;
    }).join(", ") : "ไม่มี"}\n`;
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

/** แท็บ "เตรียมตัวเฉพาะหัตถการ" — รายการหัตถการที่มีคำแนะนำละเอียด กดเพื่อขยายดูทุกหัวข้อ */
let openProcedureGuide = null;

function renderProcedureGuides(){
  const el = document.getElementById("learn-prep");
  if(!el) return;
  const names = Object.keys(PROCEDURE_GUIDES);

  if(names.length === 0){
    el.innerHTML = `<div class="empty-state">ยังไม่มีคำแนะนำเฉพาะหัตถการในระบบ</div>`;
    return;
  }

  el.innerHTML = `
    <p class="muted" style="margin-bottom:14px;">คำแนะนำละเอียดสำหรับการเตรียมตัวก่อน-หลังหัตถการเฉพาะทาง แตะชื่อหัตถการเพื่อดูรายละเอียดทั้งหมด</p>
    ${names.map((name, idx)=>{
      const guide = PROCEDURE_GUIDES[name];
      const isOpen = openProcedureGuide === idx;
      return `
      <div class="qa-card ${isOpen?'open':''}">
        <div class="qa-q" onclick="toggleProcedureGuide(${idx})">
          <span class="emoji">📖</span>
          <span class="txt">${name}</span>
          <span class="caret">▾</span>
        </div>
        <div class="qa-a"><div class="qa-a-inner" style="max-height:none;">
          <p class="muted" style="margin-bottom:14px;">${guide.intro}</p>
          ${guide.sections.map(s=>`
            <div class="row" style="margin-bottom:16px;">
              <div class="ic">${s.icon}</div>
              <div class="txt"><b>${s.title}</b><span>${s.body}</span></div>
            </div>
          `).join("")}
          <div class="summary-flag info" style="margin-top:6px;">💜 <b>AnesCare Tip:</b><br>${guide.tip}</div>
        </div></div>
      </div>`;
    }).join("")}
  `;
}

function toggleProcedureGuide(idx){
  openProcedureGuide = (openProcedureGuide === idx) ? null : idx;
  renderProcedureGuides();
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
  applyTextScale();
  renderTextSizeMenu();
  renderHome();
  renderTimeline();
  renderChecklist();
  renderAssessWizard();
  renderQaList("learn-qa", ANES_QA);
  renderProcedureGuides();
  renderPostOp();
  renderGoingHome();
  renderFaq();
  renderRatingCard();
  renderHistory();

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("service-worker.js")
        .then((reg)=>{
          // เช็คทันทีว่ามีเวอร์ชันใหม่ไหม (เผื่อ browser ยังไม่ได้เช็คให้เอง)
          reg.update().catch(()=>{});
        })
        .catch(()=>{});
    });

    // เมื่อ service worker เวอร์ชันใหม่เข้าควบคุมหน้าแล้ว (หลังอัปเดตไฟล์บน GitHub)
    // ให้รีโหลดหน้าอัตโนมัติหนึ่งครั้ง เพื่อให้ผู้ใช้เห็นเนื้อหาล่าสุดโดยไม่ต้องปิด-เปิดแอปเอง
    let swRefreshed = false;
    navigator.serviceWorker.addEventListener("controllerchange", ()=>{
      if(swRefreshed) return;
      swRefreshed = true;
      window.location.reload();
    });
  }
}
init();
