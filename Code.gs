/**
 * ดมยาแคร์ — Code.gs
 * Google Apps Script สำหรับรับข้อมูล "แบบประเมินความพึงพอใจ" และ "แจ้งปัญหา/สอบถาม"
 * จากแอป แล้วบันทึกลง Google Sheets โดยอัตโนมัติ
 *
 * จุดเด่น: ถ้าฝั่งแอปเพิ่มหัวข้อประเมินใหม่ในอนาคต (เช่น เพิ่มคะแนนหมวดใหม่)
 * สคริปต์นี้จะ "สร้างคอลัมน์ใหม่ในชีตให้อัตโนมัติ" ตามชื่อ key ที่ส่งมา
 * โดยไม่ต้องแก้โค้ดสคริปต์นี้ใหม่ทุกครั้ง
 *
 * วิธีติดตั้ง:
 * 1. สร้าง Google Sheet ใหม่ 1 ไฟล์ (ยังไม่ต้องใส่หัวคอลัมน์ใดๆ ก็ได้)
 * 2. เปิด Extensions > Apps Script วางโค้ดนี้ทับของเดิมทั้งหมด แล้วกด Save
 * 3. กด Deploy > New deployment > เลือกประเภท "Web app"
 *    - Execute as: Me
 *    - Who has access: Anyone
 * 4. กด Deploy แล้วคัดลอก "Web app URL" ที่ได้
 * 5. นำ URL นั้นไปวางในไฟล์ app.js ที่ตัวแปร SHEET_WEBAPP_URL
 */

// ชื่อชีตย่อยสำหรับแต่ละประเภทข้อมูล (สร้างอัตโนมัติถ้ายังไม่มี)
const SHEET_NAMES = {
  survey: "SatisfactionSurvey",
  concern: "ConcernMessages"
};

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const sheetType = data.sheetType === "concern" ? "concern" : "survey";
    const payload = data.payload || {};

    const sheet = getOrCreateSheet_(SHEET_NAMES[sheetType]);
    appendRowWithAutoColumns_(sheet, payload);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// สำหรับทดสอบว่า Web App ทำงานอยู่ (เปิด URL ตรงๆ ในเบราว์เซอร์)
function doGet(e) {
  return ContentService.createTextOutput("ดมยาแคร์ Apps Script กำลังทำงานอยู่ค่ะ");
}

/** หา sheet ตามชื่อ ถ้ายังไม่มีให้สร้างใหม่พร้อมหัวคอลัมน์ Timestamp */
function getOrCreateSheet_(name) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1).setValue("Timestamp");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

/**
 * เพิ่มแถวใหม่ลง sheet โดยจับคู่ key ของ payload กับหัวคอลัมน์ที่มีอยู่
 * ถ้าเจอ key ที่ไม่มีคอลัมน์มาก่อน จะเพิ่มคอลัมน์ใหม่ให้ท้ายสุดอัตโนมัติ
 */
function appendRowWithAutoColumns_(sheet, payload) {
  const lastCol = Math.max(sheet.getLastColumn(), 1);
  let headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  if (headers[0] !== "Timestamp") {
    sheet.getRange(1, 1).setValue("Timestamp");
    headers = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
  }

  // เพิ่มคอลัมน์ใหม่สำหรับ key ที่ยังไม่เคยเจอ
  Object.keys(payload).forEach(function (key) {
    if (headers.indexOf(key) === -1) {
      headers.push(key);
      sheet.getRange(1, headers.length).setValue(key);
    }
  });

  // เรียงค่าตามลำดับหัวคอลัมน์ปัจจุบัน
  const row = headers.map(function (h) {
    if (h === "Timestamp") return new Date();
    const v = payload[h];
    if (v === undefined || v === null) return "";
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });

  sheet.appendRow(row);
}
