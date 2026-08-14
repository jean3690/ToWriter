function activate(ctx) {
  host.window.registerView({
    id: "aiPromptPack.help",
    title: "AI 提示词帮助",
    render: renderHelp
  });

  host.commands.register("aiPromptPack.translate", async function () {
    var sel = await host.editor.getSelection();
    var text = sel && sel.text ? sel.text : "";
    if (!text) {
      host.window.showMessage("请先选中要翻译的文本");
      return;
    }
    var prompt = "请把下面这段中文翻译成英文，保留原有的叙事节奏：\n\n" + text;
    await host.ai.chatStream(prompt, function (token) {
      // 流式结果由插件决定如何展示；此处演示把 token 追加到剪贴板提示
    });
    host.window.showMessage("翻译请求已发送，结果请到 AI 对话中查看");
    return true;
  });

  host.commands.register("aiPromptPack.polish", async function () {
    var sel = await host.editor.getSelection();
    var text = sel && sel.text ? sel.text : "";
    if (!text) {
      host.window.showMessage("请先选中要润色的文本");
      return;
    }
    var prompt = "请润色下面这段文字，去掉 AI 腔，保持作者文风：\n\n" + text;
    await host.ai.chatStream(prompt, function () {});
    host.window.showMessage("润色请求已发送");
    return true;
  });

  host.commands.register("aiPromptPack.characterCard", async function () {
    var chapter = await host.workspace.getCurrentChapter();
    var doc = await host.editor.getDoc();
    var excerpt = doc.slice(-800);
    var prompt = "根据以下正文片段生成一个人物卡（姓名、年龄、外貌、性格、口头禅、与主角关系）：\n\n" + (excerpt || "（当前没有正文）");
    await host.ai.chatStream(prompt, function () {});
    host.window.showMessage("人物卡生成请求已发送");
    return true;
  });

  host.window.setStatusBarItem("AI 提示词包已加载（Ctrl+Shift+T 翻译）");
  return true;
}

async function renderHelp() {
  return '<div style="font-size:13px;color:#d4d4d4;line-height:1.8;padding:4px;">'
    + '<div><b>可用命令</b></div>'
    + '<div>· 翻译选中文本 → ctrl+shift+t</div>'
    + '<div>· 润色选中文本</div>'
    + '<div>· 生成人物卡</div>'
    + '<div style="margin-top:8px;color:#8a8a8a;">在命令面板（Ctrl+Shift+P）中搜索「AI」即可执行。</div>'
    + '</div>';
}

function deactivate() {}
