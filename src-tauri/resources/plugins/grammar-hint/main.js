/*
 * grammar-hint：基于规则的中文语法 / 标点检查插件。
 * 运行在插件沙箱（Web Worker）内，通过 host.editor API 读取正文，
 * 用 setDiagnostics 在编辑器中标注问题位置。
 */

var MAX_DIAGS = 300;
var debounceTimer = null;
var lastText = "";

function activate(ctx) {
  host.window.registerView({
    id: "grammarHint.help",
    title: "语法检查说明",
    render: renderHelp
  });

  host.commands.register("grammarHint.check", function () {
    return runCheckNow();
  });

  host.commands.register("grammarHint.clear", function () {
    host.editor.setDiagnostics([]);
    return true;
  });

  host.events.onDidChangeText(function (payload) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runCheckNow();
    }, 600);
  });

  host.events.onDidChangeActiveChapter(function () {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(function () {
      runCheckNow();
    }, 300);
  });

  return true;
}

function runCheckNow() {
  return host.editor.getDoc().then(function (doc) {
    lastText = doc;
    var diags = checkText(doc);
    host.editor.setDiagnostics(diags.slice(0, MAX_DIAGS));
    return diags.length;
  });
}

/* ===== 规则引擎 ===== */

function push(list, text, index, length, message, severity) {
  list.push({
    from: index,
    to: index + length,
    message: message,
    severity: severity || "warning"
  });
}

function checkText(text) {
  var out = [];

  // 1. 重复标点（。。 ，， ；； ：： ！！ ？？）
  var repPunct = /([。，；：！？、])\1+/g;
  var m;
  while ((m = repPunct.exec(text)) !== null) {
    push(out, text, m.index, m[0].length, "重复标点：" + m[0], "error");
  }

  // 2. 连续感叹号 / 问号（过度使用）
  var loud = /[！？!?]{2,}/g;
  while ((m = loud.exec(text)) !== null) {
    if (/^[！?]{2,}$/.test(m[0])) {
      push(out, text, m.index, m[0].length, "连续语气词过多：" + m[0], "info");
    }
  }

  // 3. 中英标点混用：中文之间夹英文逗号 / 句号 / 分号
  var mixed = /([\u4e00-\u9fa5])([,.;])([\u4e00-\u9fa5])/g;
  while ((m = mixed.exec(text)) !== null) {
    push(out, text, m.index + 1, 1, "中英文标点混用：建议使用中文标点", "error");
  }

  // 4. 空格问题：中文文字之间插入空格
  var cjkSpace = /([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g;
  while ((m = cjkSpace.exec(text)) !== null) {
    push(out, text, m.index + 1, m[0].length - 2, "中文之间不宜加空格", "info");
  }

  // 5. 冗余表达：双重程度副词
  var redundant = /((非常|十分|特别|相当|极其|非常非常|十分十分|特别特别|真的很|的确是|确实是)\s*(非常|十分|特别|相当|极其|真的))/g;
  while ((m = redundant.exec(text)) !== null) {
    push(out, text, m.index, m[0].length, "冗余表达：" + m[0], "warning");
  }

  // 6. 「的地得」典型误用：动词后应是「得」（跑的快 → 跑得快）
  var verbChars = "跑走写说做吃读看打睡喝玩听想";
  var deRe = new RegExp("([" + verbChars + "][\\u4e00-\\u9fa5]{0,3})的([\\u4e00-\\u9fa5])", "g");
  while ((m = deRe.exec(text)) !== null) {
    var after = m[2];
    // "X 的 很" 大概率是 "得"；但如果后面是"的时候/的地方"这类名词，跳过
    if (after === "时" || after === "地" || after === "方") continue;
    push(out, text, m.index + m[1].length, 1, "疑似「的」误用，应为「得」", "warning");
  }

  // 7. 引号不配对：中文书名号 / 双引号 / 单引号
  var pairs = [
    { open: "《", close: "》", name: "书名号" },
    { open: "“", close: "”", name: "双引号" },
    { open: "‘", close: "’", name: "单引号" },
  ];
  for (var i = 0; i < pairs.length; i++) {
    var p = pairs[i];
    var openCount = countOccurrences(text, p.open);
    var closeCount = countOccurrences(text, p.close);
    if (openCount !== closeCount) {
      push(out, text, 0, 1, p.name + "不配对（开 " + openCount + " / 闭 " + closeCount + "）", "warning");
    }
  }

  // 8. 常见错别字 / 成语误用（简单词库）
  var typoPairs = [
    ["的", "得", "的"], // 需要特殊规则，跳过
  ];
  var commonTypos = [
    ["做为", "作为"],
    ["在次", "再次"],
    ["即然", "既然"],
    ["按装", "安装"],
    ["一幅画", "一幅"],
    ["描术", "描述"],
    ["励害", "厉害"],
    ["以经", "已经"],
    ["因该", "应该"],
    ["决对", "绝对"],
  ];
  for (var t = 0; t < commonTypos.length; t++) {
    var wrong = commonTypos[t][0];
    var right = commonTypos[t][1];
    var idx = 0;
    while ((idx = text.indexOf(wrong, idx)) !== -1) {
      push(out, text, idx, wrong.length, "疑似错别字：「" + wrong + "」应为「" + right + "」", "warning");
      idx += wrong.length;
    }
  }

  return out;
}

function countOccurrences(str, sub) {
  var count = 0;
  var idx = 0;
  while ((idx = str.indexOf(sub, idx)) !== -1) {
    count++;
    idx += sub.length;
  }
  return count;
}

function renderHelp() {
  return '<div style="font-size:13px;color:#d4d4d4;line-height:1.9;padding:4px;">'
    + '<div><b>中文语法提示</b></div>'
    + '<div>基于规则的常见问题检查：</div>'
    + '<div>· 重复标点 / 连续语气词</div>'
    + '<div>· 中英文标点混用</div>'
    + '<div>· 中文间多余空格</div>'
    + '<div>· 冗余表达</div>'
    + '<div>· 「的地得」误用</div>'
    + '<div>· 引号 / 书名号不配对</div>'
    + '<div>· 常见错别字</div>'
    + '<div style="margin-top:8px;color:#8a8a8a;">输入时自动检查（600ms 防抖）。</div>'
    + '<div style="color:#8a8a8a;">可在命令面板执行「语法检查」。</div>'
    + '</div>';
}

function deactivate() {
  if (debounceTimer) clearTimeout(debounceTimer);
  host.editor.setDiagnostics([]);
}
