// ============ إعدادات Firebase الحقيقية (للتشغيل الفعلي) ============
const FIREBASE_CONFIG = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  appId: "PASTE_APP_ID",
};

// ============ الوضع التجريبي ============
// true  = تجربة على جهازك من غير Firebase (البيانات في المتصفح بس)
// false = الشغل الحقيقي مع Firebase
const DEMO_MODE = true;

if (DEMO_MODE)
  (function () {
    const KEY = "mockdb";
    const load = () => JSON.parse(localStorage.getItem(KEY) || "{}");
    const listeners = new Set();
    const notify = () => listeners.forEach((f) => f());
    const save = (db) => {
      localStorage.setItem(KEY, JSON.stringify(db));
      notify();
    };
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) notify();
    });
    const clean = (d) =>
      JSON.parse(JSON.stringify(d, (k, v) => (v && v.__ts ? Date.now() : v)));
    const user = () => sessionStorage.getItem("mockuser"); // تسجيل الدخول لكل تبويب لوحده

    function snap(path, d) {
      return {
        id: path.split("/").pop(),
        exists: d !== undefined,
        ref: docRef(path),
        data: () =>
          d === undefined ? undefined : JSON.parse(JSON.stringify(d)),
      };
    }
    function docRef(path) {
      return {
        id: path.split("/").pop(),
        path,
        get: async () => snap(path, load()[path]),
        set: async (data) => {
          const db = load();
          // نفس قاعدة الأمان الحقيقية: الطالب مايقدرش يعدّل حضور موجود
          if (/\/attendance\//.test(path) && db[path] && !user())
            throw new Error("permission-denied");
          db[path] = clean(data);
          save(db);
        },
        update: async (data) => {
          const db = load();
          db[path] = Object.assign({}, db[path], clean(data));
          save(db);
        },
        delete: async () => {
          const db = load();
          delete db[path];
          save(db);
        },
        collection: (n) => collRef(path + "/" + n),
      };
    }
    function collRef(path, o = {}) {
      const list = () => {
        const db = load(),
          pre = path + "/";
        let ks = Object.keys(db).filter(
          (k) => k.startsWith(pre) && !k.slice(pre.length).includes("/"),
        );
        if (o.field)
          ks.sort(
            (a, b) =>
              (db[a][o.field] - db[b][o.field]) * (o.dir === "desc" ? -1 : 1),
          );
        if (o.lim) ks = ks.slice(0, o.lim);
        const docs = ks.map((k) => snap(k, db[k]));
        return {
          docs,
          empty: !docs.length,
          size: docs.length,
          forEach: (f) => docs.forEach(f),
        };
      };
      return {
        doc: (id) => docRef(path + "/" + id),
        add: async (data) => {
          const id = Math.random().toString(36).slice(2, 12);
          await docRef(path + "/" + id).set(data);
          return { id };
        },
        get: async () => list(),
        onSnapshot: (cb) => {
          const f = () => cb(list());
          listeners.add(f);
          setTimeout(f, 0);
          return () => listeners.delete(f);
        },
        orderBy: (field, dir) =>
          collRef(path, Object.assign({}, o, { field, dir })),
        limit: (n) => collRef(path, Object.assign({}, o, { lim: n })),
      };
    }
    const firestore = () => ({
      collection: (n) => collRef(n),
      batch: () => {
        const ops = [];
        return {
          set: (r, d) => ops.push([r, d]),
          commit: async () => {
            for (const [r, d] of ops) await r.set(d);
          },
        };
      },
    });
    firestore.FieldValue = { serverTimestamp: () => ({ __ts: true }) };

    const authL = new Set();
    const authObj = {
      onAuthStateChanged: (cb) => {
        const f = () => cb(user() ? { email: user() } : null);
        authL.add(f);
        setTimeout(f, 0);
      },
      signInWithEmailAndPassword: async (e, p) => {
        if (!e || !p) throw new Error("bad");
        sessionStorage.setItem("mockuser", e);
        authL.forEach((f) => f());
      },
      signOut: async () => {
        sessionStorage.removeItem("mockuser");
        authL.forEach((f) => f());
      },
    };
    window.firebase = { initializeApp() {}, firestore, auth: () => authObj };

    // GPS وهمي (القاعة = نفس المكان)
    Object.defineProperty(navigator, "geolocation", {
      configurable: true,
      value: {
        getCurrentPosition: (ok) =>
          setTimeout(
            () =>
              ok({
                coords: { latitude: 30.0444, longitude: 31.2357, accuracy: 5 },
              }),
            300,
          ),
      },
    });

    // كل تبويب = موبايل مستقل (عشان تجرب أكتر من طالب)
    const _g = Storage.prototype.getItem,
      _s = Storage.prototype.setItem;
    Storage.prototype.getItem = function (k) {
      return _g.call(k === "deviceId" ? sessionStorage : this, k);
    };
    Storage.prototype.setItem = function (k, v) {
      return _s.call(k === "deviceId" ? sessionStorage : this, k, v);
    };

    // زرار "افتح كطالب" تحت الـ QR
    if (window.QRCode) {
      const Q = window.QRCode;
      window.QRCode = function (el, opts) {
        new Q(el, opts);
        let a = document.getElementById("demoLink");
        if (!a) {
          a = document.createElement("a");
          a.id = "demoLink";
          a.target = "_blank";
          a.rel = "noopener";
          a.className = "btn btn-green";
          a.textContent = "🧪 افتح كطالب (تجريبي)";
          el.parentNode.insertBefore(a, el.nextSibling);
        }
        a.href = opts.text;
      };
      window.QRCode.CorrectLevel = Q.CorrectLevel;
    }

    document.addEventListener("DOMContentLoaded", () => {
      const b = document.createElement("div");
      b.style.cssText =
        "position:fixed;top:0;left:0;right:0;background:#eab308;color:#000;text-align:center;padding:6px;font-size:.8rem;z-index:99";
      b.innerHTML =
        '🧪 وضع تجريبي: البيانات على جهازك بس. ادخل بأي إيميل وباسورد. <a href="#" style="color:#000" onclick="localStorage.removeItem(\'mockdb\');sessionStorage.clear();location.reload();return false">مسح بيانات التجربة</a>';
      document.body.prepend(b);
      document.body.style.paddingTop = "48px";
    });
  })();
