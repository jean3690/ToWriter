/**
 * 插件运行时：注入到 Worker 中的宿主 API。
 * 插件代码通过全局 `host` 与主进程通信（postMessage RPC）。
 */
export const RUNTIME_SOURCE = `
var __twPending = new Map();
var __twNextId = 1;
var __twEventCbs = new Map();
var __twStreamCbs = new Map();
var __twViews = new Map();
var __twCommands = new Map();

function __twPost(msg) { self.postMessage(msg); }

function __twCall(ns, method, args) {
  return new Promise(function (resolve, reject) {
    var id = __twNextId++;
    __twPending.set(id, { resolve: resolve, reject: reject });
    __twPost({ kind: "api", id: id, ns: ns, method: method, args: args });
  });
}

function __twDisposable(fn) { return { dispose: function () { fn(); } }; }

function __twSubscribe(name, cb) {
  var set = __twEventCbs.get(name);
  if (!set) {
    set = new Set();
    __twEventCbs.set(name, set);
    __twPost({ kind: "subscribeEvent", name: name });
  }
  set.add(cb);
  return __twDisposable(function () {
    set.delete(cb);
    if (set.size === 0) __twPost({ kind: "unsubscribeEvent", name: name });
  });
}

self.addEventListener("message", function (e) {
  var msg = e.data;
  if (!msg || typeof msg !== "object") return;

  if (msg.kind === "activate") {
    var fn = self.__towriterPlugin && self.__towriterPlugin.activate;
    try {
      var ret = fn ? fn(msg.ctx) : null;
      if (ret && typeof ret.then === "function") {
        ret.then(
          function () { __twPost({ kind: "activated" }); },
          function (err) { __twPost({ kind: "activatedError", error: String(err && err.message || err) }); }
        );
      } else {
        __twPost({ kind: "activated" });
      }
    } catch (err) {
      __twPost({ kind: "activatedError", error: String(err && err.message || err) });
    }
  } else if (msg.kind === "command") {
    var cmd = __twCommands.get(msg.id);
    var reply = function (ok, value, error) {
      __twPost({ kind: "commandResult", reqId: msg.reqId, ok: ok, value: value, error: error });
    };
    if (!cmd) { reply(false, null, "命令未注册: " + msg.id); return; }
    try {
      var r = cmd(msg.args);
      if (r && typeof r.then === "function") {
        r.then(function (v) { reply(true, v); }, function (err) { reply(false, null, String(err && err.message || err)); });
      } else {
        reply(true, r);
      }
    } catch (err) {
      reply(false, null, String(err && err.message || err));
    }
  } else if (msg.kind === "apiResult") {
    var p = __twPending.get(msg.id);
    if (p) {
      __twPending.delete(msg.id);
      __twStreamCbs.delete(msg.id);
      if (msg.ok) p.resolve(msg.value);
      else p.reject(new Error(msg.error || "调用失败"));
    }
  } else if (msg.kind === "aiToken") {
    var cb = __twStreamCbs.get(msg.id);
    if (cb) cb(msg.delta);
  } else if (msg.kind === "event") {
    var set = __twEventCbs.get(msg.name);
    if (set) set.forEach(function (cb) { try { cb(msg.payload); } catch (err) {} });
  } else if (msg.kind === "requestViewHtml") {
    var rfn = __twViews.get(msg.viewId);
    var respond = function (html, error) {
      __twPost({ kind: "viewHtml", reqId: msg.reqId, html: html, error: error });
    };
    if (!rfn) { respond(null, "视图不存在: " + msg.viewId); return; }
    try {
      var r = rfn();
      if (r && typeof r.then === "function") {
        r.then(function (h) { respond(h); }, function (err) { respond(null, String(err && err.message || err)); });
      } else {
        respond(r);
      }
    } catch (err) {
      respond(null, String(err && err.message || err));
    }
  }
});

var host = {
  commands: {
    register: function (id, fn) {
      if (__twCommands.has(id)) return __twDisposable(function () {});
      __twCommands.set(id, fn);
      __twPost({ kind: "registerCommand", id: id });
      return __twDisposable(function () {
        __twCommands.delete(id);
        __twPost({ kind: "unregisterCommand", id: id });
      });
    },
    execute: function (id, args) { return __twCall("commands", "execute", [id, args]); }
  },
  workspace: {
    readFile: function (relPath) { return __twCall("workspace", "readFile", [relPath]); },
    writeFile: function (relPath, content) { return __twCall("workspace", "writeFile", [relPath, content]); },
    getBooks: function () { return __twCall("workspace", "getBooks", []); },
    getCurrentChapter: function () { return __twCall("workspace", "getCurrentChapter", []); }
  },
  editor: {
    getDoc: function () { return __twCall("editor", "getDoc", []); },
    getSelection: function () { return __twCall("editor", "getSelection", []); },
    replaceSelection: function (text) { return __twCall("editor", "replaceSelection", [text]); },
    insertAtCursor: function (text) { return __twCall("editor", "insertAtCursor", [text]); },
    setDoc: function (text) { return __twCall("editor", "setDoc", [text]); },
    setDiagnostics: function (diags) {
      var clean = Array.isArray(diags) ? diags.map(function (d) {
        return {
          from: d.from || 0,
          to: d.to || 0,
          message: String(d.message || ""),
          severity: (d.severity === "error" || d.severity === "info") ? d.severity : "warning"
        };
      }) : [];
      __twPost({ kind: "setDiagnostics", diags: clean });
    }
  },
  window: {
    showMessage: function (text) { return __twCall("window", "showMessage", [text]); },
    showErrorMessage: function (text) { return __twCall("window", "showErrorMessage", [text]); },
    setStatusBarItem: function (text) { return __twCall("window", "setStatusBarItem", [text]); },
    registerView: function (view) {
      if (view && view.id && typeof view.render === "function") {
        __twViews.set(view.id, view.render);
        __twPost({ kind: "registerView", view: { id: view.id, title: view.title || view.id } });
      }
      return __twDisposable(function () {
        __twViews.delete(view.id);
        __twPost({ kind: "unregisterView", viewId: view.id });
      });
    }
  },
  ai: {
    chatStream: function (prompt, onToken) {
      return new Promise(function (resolve, reject) {
        var id = __twNextId++;
        __twPending.set(id, { resolve: resolve, reject: reject });
        if (onToken) __twStreamCbs.set(id, onToken);
        __twPost({ kind: "api", id: id, ns: "ai", method: "chatStream", args: [prompt] });
      });
    }
  },
  events: {
    onDidChangeActiveChapter: function (cb) { return __twSubscribe("onDidChangeActiveChapter", cb); },
    onDidChangeText: function (cb) { return __twSubscribe("onDidChangeText", cb); },
    onDidSaveChapter: function (cb) { return __twSubscribe("onDidSaveChapter", cb); }
  }
};

self.host = host;
`;
