function activate(ctx) {
  host.window.registerView({
    id: "wordCount.panel",
    title: "写作统计",
    render: renderPanel
  });

  host.commands.register("wordCount.show", async function () {
    var doc = await host.editor.getDoc();
    await host.window.showMessage("当前字数：" + countWords(doc));
    return true;
  });

  host.commands.register("wordCount.insertDate", async function () {
    var d = new Date();
    var s = d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
    await host.editor.insertAtCursor(s);
    return true;
  });

  host.events.onDidChangeText(function (payload) { return true; });
  host.events.onDidChangeActiveChapter(function (payload) { return true; });
  host.events.onDidSaveChapter(function (payload) { return true; });

  host.window.setStatusBarItem("示例插件运行中");
  return true;
}

async function renderPanel() {
  var chapter = await host.workspace.getCurrentChapter();
  var doc = await host.editor.getDoc();
  var wc = countWords(doc);
  var title = chapter ? chapter.title : "无";
  return '<div style="font-size:13px;color:#d4d4d4;line-height:1.8;padding:4px;">'
    + '<div><b>当前章节：</b>' + esc(title) + '</div>'
    + '<div><b>本章字数：</b>' + wc + '</div>'
    + '<div><b>插件版本：</b>0.1.0</div>'
    + '<div style="margin-top:8px;color:#8a8a8a;">编辑内容时此面板会自动刷新</div>'
    + '</div>';
}

function countWords(text) {
  var n = 0;
  var inWord = false;
  for (var i = 0; i < text.length; i++) {
    var c = text.charAt(i);
    var code = text.codePointAt(i);
    if (code >= 0x4e00 && code <= 0x9fff) {
      n++;
      inWord = false;
    } else if (/[a-zA-Z0-9]/.test(c)) {
      if (!inWord) {
        n++;
        inWord = true;
      }
    } else {
      inWord = false;
    }
  }
  return n;
}

function pad(n) {
  return n < 10 ? "0" + n : "" + n;
}

function esc(s) {
  return String(s).replace(/[<>&]/g, function (c) {
    return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
  });
}

function deactivate() {}
