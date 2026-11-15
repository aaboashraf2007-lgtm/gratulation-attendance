firebase.initializeApp(FIREBASE_CONFIG);
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null;

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const $ = (id) => document.getElementById(id);

async function loadStudents() {
  const r = await fetch('students.json');
  return r.json();
}

// المسافة بالمتر بين نقطتين (Haversine)
function distanceM(lat1, lon1, lat2, lon2) {
  const R = 6371000, rad = (x) => x * Math.PI / 180;
  const dLat = rad(lat2 - lat1), dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function getPosition() {
  return new Promise((res, rej) => {
    if (!('geolocation' in navigator)) return rej(new Error('nogps'));
    navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
  });
}

const fmtTime = (ms) => new Date(ms).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });

// ---- توكن بيتغير كل 15 ثانية، محسوب من seed الجلسة + رقم الفترة (مفيش كتابة في قاعدة البيانات) ----
const SLOT_MS = 15000;            // عمر الـ QR
const OFFLINE_MS = 10 * 60000;    // أقصى وقت بين مسح الكود وتأكيد الحضور (للي النت قطع عنده)

// نضبط ساعة الجهاز على ساعة السيرفر عشان فروق ساعات الموبايلات ما تبوظش التحقق
let clockOffset = 0;
async function syncClock() {
  try {
    const r = await fetch(location.pathname + '?_=' + Date.now(), { method: 'HEAD', cache: 'no-store' });
    const d = r.headers.get('Date');
    if (d) clockOffset = new Date(d).getTime() - Date.now();
  } catch (e) {}
}
const nowMs = () => Date.now() + clockOffset;

function cyrb53(str) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}
const tokenFor = (seed, slot) => cyrb53(seed + ':' + slot).toString(36);

// معرّف ثابت للجهاز/المتصفح (بيتحفظ في الجهاز نفسه)
function getDeviceId() {
  let id = localStorage.getItem('deviceId');
  if (!id) {
    id = 'DEV-' + (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
    localStorage.setItem('deviceId', id);
  }
  return id;
}