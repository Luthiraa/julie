import { promises as p, createReadStream as m } from "fs";
import { basename as w } from "path";
import { g as b, F as M } from "./main-D1qx1LB3.js";
import { i as O } from "./main-D1qx1LB3.js";
var d, h;
function y() {
  if (h) return d;
  if (h = 1, !globalThis.DOMException)
    try {
      const { MessageChannel: t } = require("worker_threads"), e = new t().port1, o = new ArrayBuffer();
      e.postMessage(o, [o, o]);
    } catch (t) {
      t.constructor.name === "DOMException" && (globalThis.DOMException = t.constructor);
    }
  return d = globalThis.DOMException, d;
}
var g = y();
const F = /* @__PURE__ */ b(g), E = (t) => Object.prototype.toString.call(t).slice(8, -1).toLowerCase();
function x(t) {
  if (E(t) !== "object")
    return !1;
  const e = Object.getPrototypeOf(t);
  return e == null ? !0 : (e.constructor && e.constructor.toString()) === Object.toString();
}
var u = function(t, e, o, r, i) {
  if (r === "m") throw new TypeError("Private method is not writable");
  if (r === "a" && !i) throw new TypeError("Private accessor was defined without a setter");
  if (typeof e == "function" ? t !== e || !i : !e.has(t)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
  return r === "a" ? i.call(t, o) : i ? i.value = o : e.set(t, o), o;
}, s = function(t, e, o, r) {
  if (o === "a" && !r) throw new TypeError("Private accessor was defined without a getter");
  if (typeof e == "function" ? t !== e || !r : !e.has(t)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
  return o === "m" ? r : o === "a" ? r.call(t) : r ? r.value : e.get(t);
}, a, c;
const P = "The requested file could not be read, typically due to permission problems that have occurred after a reference to a file was acquired.";
class f {
  constructor(e) {
    a.set(this, void 0), c.set(this, void 0), u(this, a, e.path, "f"), u(this, c, e.start || 0, "f"), this.name = w(s(this, a, "f")), this.size = e.size, this.lastModified = e.lastModified;
  }
  slice(e, o) {
    return new f({
      path: s(this, a, "f"),
      lastModified: this.lastModified,
      size: o - e,
      start: e
    });
  }
  async *stream() {
    const { mtimeMs: e } = await p.stat(s(this, a, "f"));
    if (e > this.lastModified)
      throw new F(P, "NotReadableError");
    this.size && (yield* m(s(this, a, "f"), {
      start: s(this, c, "f"),
      end: s(this, c, "f") + this.size - 1
    }));
  }
  get [(a = /* @__PURE__ */ new WeakMap(), c = /* @__PURE__ */ new WeakMap(), Symbol.toStringTag)]() {
    return "File";
  }
}
function T(t, { mtimeMs: e, size: o }, r, i = {}) {
  let n;
  x(r) ? [i, n] = [r, void 0] : n = r;
  const l = new f({ path: t, size: o, lastModified: e });
  return n || (n = l.name), new M([l], n, {
    ...i,
    lastModified: l.lastModified
  });
}
async function S(t, e, o) {
  const r = await p.stat(t);
  return T(t, r, e, o);
}
export {
  S as fileFromPath,
  O as isFile
};
