"use strict";

require("ace/ext/rtl");

require("ace/multi_select");
require("./inline_editor");
var devUtil = require("./dev_util");
require("./file_drop");

var config = require("ace/config");
config.setLoader(function(moduleName, cb) {
    require([moduleName], function(module) {
        cb(null, module);
    });
});

var env = {};

var dom = require("ace/lib/dom");
var net = require("ace/lib/net");
var lang = require("ace/lib/lang");

var event = require("ace/lib/event");
var theme = require("ace/theme/textmate");
var EditSession = require("ace/edit_session").EditSession;
var UndoManager = require("ace/undomanager").UndoManager;

var HashHandler = require("ace/keyboard/hash_handler").HashHandler;

var Renderer = require("ace/virtual_renderer").VirtualRenderer;
var Editor = require("ace/editor").Editor;
var Range = require("ace/range").Range;

var whitespace = require("ace/ext/whitespace");

var createDiffView = require("ace/ext/diff").createDiffView;


var doclist = require("./doclist");
var layout = require("./layout");
var util = require("./util");
var saveOption = util.saveOption;

require("ace/ext/elastic_tabstops_lite");
require("ace/incremental_search");

var TokenTooltip = require("./token_tooltip").TokenTooltip;
require("ace/config").defineOptions(Editor.prototype, "editor", {
    showTokenInfo: {
        set: function(val) {
            if (val) {
                this.tokenTooltip = this.tokenTooltip || new TokenTooltip(this);
            }
            else if (this.tokenTooltip) {
                this.tokenTooltip.destroy();
                delete this.tokenTooltip;
            }
        },
        get: function() {
            return !!this.tokenTooltip;
        },
        handlesSet: true
    }
});

require("ace/config").defineOptions(Editor.prototype, "editor", {
    useAceLinters: {
        set: function(val) {
            if (val && !window.languageProvider) {
                loadLanguageProvider(editor);
            }
            else if (val) {
                window.languageProvider.registerEditor(this);
            } else {
                // todo unregister
            }
        }
    }
});

var {HoverTooltip} = require("ace/tooltip");
var MarkerGroup = require("ace/marker_group").MarkerGroup;
var docTooltip = new HoverTooltip();
function loadLanguageProvider(editor) {
    function loadScript(cb) {
        if (define.amd) {
            require([
                "https://mkslanc.github.io/ace-linters/build/ace-linters.js"
            ], function(m) {
                cb(m.LanguageProvider);
            });
        } else {
            net.loadScript([
                "https://mkslanc.github.io/ace-linters/build/ace-linters.js"
            ], function() {
                cb(window.LanguageProvider);
            });
        }
    }
    loadScript(function(LanguageProvider) {
        var languageProvider = LanguageProvider.fromCdn("https://mkslanc.github.io/ace-linters/build", {
            functionality: {
                hover: true,
                completion: {
                    overwriteCompleters: true
                },
                completionResolve: true,
                format: true,
                documentHighlights: true,
                signatureHelp: false
            }
        });
        window.languageProvider = languageProvider;
        languageProvider.registerEditor(editor);
    });
}



var workerModule = require("ace/worker/worker_client");
if (location.href.indexOf("noworker") !== -1) {
    workerModule.WorkerClient = workerModule.UIWorkerClient;
}

/*********** create editor ***************************/
var container = document.getElementById("editor-container");

// Splitting.
var Split = require("ace/split").Split;
var split = new Split(container, theme, 1);
env.editor = split.getEditor(0);
split.on("focus", function(editor) {
    env.editor = editor;
    updateUIEditorOptions();
});
env.split = split;
window.env = env;


var consoleEl = dom.createElement("div");
container.parentNode.appendChild(consoleEl);
consoleEl.style.cssText = "position:fixed; bottom:1px; right:0;\
border:1px solid #baf; z-index:100";

var cmdLine = new layout.singleLineEditor(consoleEl);
cmdLine.setOption("placeholder", "Enter a command...");
cmdLine.editor = env.editor;
env.editor.cmdLine = cmdLine;

env.editor.showCommandLine = function(val) {
    this.cmdLine.focus();
    if (typeof val == "string")
        this.cmdLine.setValue(val, 1);
};

/**
 * This demonstrates how you can define commands and bind shortcuts to them.
 */
env.editor.commands.addCommands([{
    name: "snippet",
    bindKey: {win: "Alt-C", mac: "Command-Alt-C"},
    exec: function(editor, needle) {
        if (typeof needle == "object") {
            editor.cmdLine.setValue("snippet ", 1);
            editor.cmdLine.focus();
            return;
        }
        var s = snippetManager.getSnippetByName(needle, editor);
        if (s)
            snippetManager.insertSnippet(editor, s.content);
    },
    readOnly: true
}, {
    name: "focusCommandLine",
    bindKey: "shift-esc|ctrl-`",
    exec: function(editor, needle) { editor.cmdLine.focus(); },
    readOnly: true
}, {
    name: "nextFile",
    bindKey: "Ctrl-tab",
    exec: function(editor) { doclist.cycleOpen(editor, 1); },
    readOnly: true
}, {
    name: "previousFile",
    bindKey: "Ctrl-shift-tab",
    exec: function(editor) { doclist.cycleOpen(editor, -1); },
    readOnly: true
}, {
    name: "execute",
    bindKey: "ctrl+enter",
    exec: function(editor) {
        try {
            var r = window.eval(editor.getCopyText() || editor.getValue());
        } catch(e) {
            r = e;
        }
        editor.cmdLine.setValue(r + "");
    },
    readOnly: true
}, {
    name: "showKeyboardShortcuts",
    bindKey: {win: "Ctrl-Alt-h", mac: "Command-Alt-h"},
    exec: function(editor) {
        config.loadModule("ace/ext/keybinding_menu", function(module) {
            module.init(editor);
            editor.showKeyboardShortcuts();
        });
    }
}, {
    name: "increaseFontSize",
    bindKey: "Ctrl-=|Ctrl-+",
    exec: function(editor) {
        var size = parseInt(editor.getFontSize(), 10) || 12;
        editor.setFontSize(size + 1);
    }
}, {
    name: "decreaseFontSize",
    bindKey: "Ctrl+-|Ctrl-_",
    exec: function(editor) {
        var size = parseInt(editor.getFontSize(), 10) || 12;
        editor.setFontSize(Math.max(size - 1 || 1));
    }
}, {
    name: "resetFontSize",
    bindKey: "Ctrl+0|Ctrl-Numpad0",
    exec: function(editor) {
        editor.setFontSize(12);
    }
}]);


env.editor.commands.addCommands(whitespace.commands);

cmdLine.commands.bindKeys({
    "Shift-Return|Ctrl-Return|Alt-Return": function(cmdLine) { cmdLine.insert("\n"); },
    "Esc|Shift-Esc": function(cmdLine){ cmdLine.editor.focus(); },
    "Return": function(cmdLine){
        var command = cmdLine.getValue().split(/\s+/);
        var editor = cmdLine.editor;
        editor.commands.exec(command[0], editor, command[1]);
        editor.focus();
    }
});

cmdLine.commands.removeCommands(["find", "gotoline", "findall", "replace", "replaceall"]);

var commands = env.editor.commands;
commands.addCommand({
    name: "save",
    bindKey: {win: "Ctrl-S", mac: "Command-S"},
    exec: function(arg) {
        var session = env.editor.session;
        var name = session.name.match(/[^\/]+$/);
        localStorage.setItem(
            "saved_file:" + name,
            session.getValue()
        );
        env.editor.cmdLine.setValue("saved "+ name);
    }
});

commands.addCommand({
    name: "load",
    bindKey: {win: "Ctrl-O", mac: "Command-O"},
    exec: function(arg) {
        var session = env.editor.session;
        var name = session.name.match(/[^\/]+$/);
        var value = localStorage.getItem("saved_file:" + name);
        if (typeof value == "string") {
            session.setValue(value);
            env.editor.cmdLine.setValue("loaded "+ name);
        } else {
            env.editor.cmdLine.setValue("no previuos value saved for "+ name);
        }
    }
});


/*********** manage layout ***************************/
function handleToggleActivate(target) {
    if (dom.hasCssClass(sidePanelContainer, "closed"))
        onResize(null, false);
    else if (dom.hasCssClass(target, "toggleButton"))
        onResize(null, true);
};
var sidePanelContainer = document.getElementById("sidePanel");
sidePanelContainer.onclick = function(e) {
    handleToggleActivate(e.target);
};
var optionToggle = document.getElementById("optionToggle");
optionToggle.onkeydown = function(e) {
    if (e.code === "Space" || e.code === "Enter") {
        handleToggleActivate(e.target);
    }
};
var consoleHeight = 20;
function onResize(e, closeSidePanel) {
    var left = 280;
    var width = document.documentElement.clientWidth;
    var height = document.documentElement.clientHeight;
    if (closeSidePanel == null)
        closeSidePanel = width < 2 * left;
    if (closeSidePanel) {
        left = 20;
        document.getElementById("optionToggle").setAttribute("aria-label", "Show Options");
    } else
        document.getElementById("optionToggle").setAttribute("aria-label", "Hide Options");
    width -= left;
    container.style.width = width + "px";
    container.style.height = height - consoleHeight + "px";
    container.style.left = left + "px";
    env.split.resize();

    consoleEl.style.width = width + "px";
    consoleEl.style.left = left + "px";
    cmdLine.resize();
    
    sidePanel.style.width = left + "px";
    sidePanel.style.height = height + "px";
    dom.setCssClass(sidePanelContainer, "closed", closeSidePanel);
}

window.onresize = onResize;
onResize();

/*********** options panel ***************************/
var diffView;
doclist.history = doclist.docs.map(function(doc) {
    return doc.name;
});
doclist.history.index = 0;
doclist.cycleOpen = function(editor, dir) {
    var h = this.history;
    h.index += dir;
    if (h.index >= h.length)
        h.index = 0;
    else if (h.index <= 0)
        h.index = h.length - 1;
    var s = h[h.index];
    doclist.pickDocument(s);
};
doclist.addToHistory = function(name) {
    var h = this.history;
    var i = h.indexOf(name);
    if (i != h.index) {
        if (i != -1)
            h.splice(i, 1);
        h.index = h.push(name);
    }
};
doclist.pickDocument = function(name) {
    doclist.loadDoc(name, function(session) {
        if (!session)
            return;
        doclist.addToHistory(session.name);
        session = env.split.setSession(session);
        whitespace.detectIndentation(session);
        optionsPanel.render();
        env.editor.focus();
        if (diffView) {
            diffView.detach()
            diffView = createDiffView({
                inline: "b",
                editorB: editor,
                valueA: editor.getValue()
            });
        }
    });
};



var OptionPanel = require("ace/ext/options").OptionPanel;
var optionsPanel = env.optionsPanel = new OptionPanel(env.editor);

var originalAutocompleteCommand = null;


optionsPanel.add({
    Main: {
        Document: {
            type: "select",
            path: "doc",
            items: doclist.all,
            position: -101,
            onchange: doclist.pickDocument,
            getValue: function() {
                return env.editor.session.name || "javascript";
            }
        },
        Split: {
            type: "buttonBar",
            path: "split",
            values: ["None", "Below", "Beside"],
            position: -100,
            onchange: function(value) {
                var sp = env.split;
                if (value == "Below" || value == "Beside") {
                    var newEditor = (sp.getSplits() == 1);
                    sp.setOrientation(value == "Below" ? sp.BELOW : sp.BESIDE);
                    sp.setSplits(2);

                    if (newEditor) {
                        var session = sp.getEditor(0).session;
                        var newSession = sp.setSession(session, 1);
                        newSession.name = session.name;
                    }
                } else {
                    sp.setSplits(1);
                }
            },
            getValue: function() {
                var sp = env.split;
                return sp.getSplits() == 1
                    ? "None"
                    : sp.getOrientation() == sp.BELOW
                    ? "Below"
                    : "Beside";
            }
        },
        "Show diffs": {
            position: 0,
            type: "buttonBar",
            path: "diffView",
            values: ["None", "Inline"],
            onchange: function (value) {
                    if (value === "Inline" && !diffView) {
                        diffView = createDiffView({
                            inline: "b",
                            editorB: editor,
                            valueA: editor.getValue()
                        });
                    }
                    else if (value === "None") {
                        if (diffView) {
                            diffView.detach();
                            diffView = null;
                        }
                    }
            },
            getValue: function() {
                return !diffView ? "None"
                    : "Inline";
            }
        }
    },
    More: {
        "RTL": {
            path: "rtl",
            position: 900
        },
        "Line based RTL switching": {
            path: "rtlText",
            position: 900
        },
        "Show token info": {
            path: "showTokenInfo",
            position: 2000
        },
        "Inline preview for autocomplete": {
            path: "inlineEnabledForAutocomplete",
            position: 2000,
            onchange: function(value) {
                var Autocomplete = require("ace/autocomplete").Autocomplete;
                if (value && !originalAutocompleteCommand) {
                    originalAutocompleteCommand = Autocomplete.startCommand.exec;
                    Autocomplete.startCommand.exec = function(editor) {
                        var autocomplete = Autocomplete.for(editor);
                        autocomplete.inlineEnabled = true;
                        originalAutocompleteCommand(...arguments);
                    }
                } else if (!value) {
                    var autocomplete = Autocomplete.for(editor);
                    autocomplete.destroy();
                    if (originalAutocompleteCommand)
                        Autocomplete.startCommand.exec = originalAutocompleteCommand;
                    originalAutocompleteCommand = null;
                }
            },
            getValue: function() {
                return !!originalAutocompleteCommand;
            }
        },
        "Use Ace Linters": {
            position: 3000,
            path: "useAceLinters"
        },
        "Show Textarea Position": devUtil.textPositionDebugger,
        "Text Input Debugger": devUtil.textInputDebugger,
    }
});

var optionsPanelContainer = document.getElementById("optionsPanel");
optionsPanel.render();
optionsPanelContainer.insertBefore(optionsPanel.container, optionsPanelContainer.firstChild);
optionsPanel.on("setOption", function(e) {
    util.saveOption(e.name, e.value);
});

function updateUIEditorOptions() {
    optionsPanel.editor = env.editor;
    optionsPanel.render();
}

env.editor.on("changeSession", function() {
    for (var i in env.editor.session.$options) {
        if (i == "mode") continue;
        var value = util.getOption(i);
        if (value != undefined) {
            env.editor.setOption(i, value);
        }
    }
});

optionsPanel.setOption("doc", util.getOption("doc") || "JavaScript");
for (var i in optionsPanel.options) {
    var value = util.getOption(i);
    if (value != undefined) {
        if ((i == "mode" || i == "theme") && !/[/]/.test(value))
            value = "ace/" + i + "/" + value;
        optionsPanel.setOption(i, value);
    }
}


function synchroniseScrolling() {
    var s1 = env.split.$editors[0].session;
    var s2 = env.split.$editors[1].session;
    s1.on('changeScrollTop', function(pos) {s2.setScrollTop(pos)});
    s2.on('changeScrollTop', function(pos) {s1.setScrollTop(pos)});
    s1.on('changeScrollLeft', function(pos) {s2.setScrollLeft(pos)});
    s2.on('changeScrollLeft', function(pos) {s1.setScrollLeft(pos)});
}

var StatusBar = require("ace/ext/statusbar").StatusBar;
new StatusBar(env.editor, cmdLine.container);

require("ace/placeholder").PlaceHolder;

var snippetManager = require("ace/snippets").snippetManager;

env.editSnippets = function() {
    var sp = env.split;
    if (sp.getSplits() == 2) {
        sp.setSplits(1);
        return;
    }
    sp.setSplits(1);
    sp.setSplits(2);
    sp.setOrientation(sp.BESIDE);
    var editor = sp.$editors[1];
    var id = sp.$editors[0].session.$mode.$id || "";
    var m = snippetManager.files[id];
    if (!doclist["snippets/" + id]) {
        var text = m.snippetText;
        var s = doclist.initDoc(text, "", {});
        s.setMode("ace/mode/snippets");
        doclist["snippets/" + id] = s;
    }
    editor.on("blur", function() {
        m.snippetText = editor.getValue();
        snippetManager.unregister(m.snippets);
        m.snippets = snippetManager.parseSnippetFile(m.snippetText, m.scope);
        snippetManager.register(m.snippets);
    });
    sp.$editors[0].once("changeMode", function() {
        sp.setSplits(1);
    });
    editor.setSession(doclist["snippets/" + id], 1);
    editor.focus();
};

optionsPanelContainer.insertBefore(
    dom.buildDom(["div", {style: "text-align:right;width: 80%"},
        ["div", {}, 
            ["button", {onclick: env.editSnippets}, "Edit Snippets"]],
        ["div", {}, 
            ["button", {onclick: function() {
                var info = navigator.platform + "\n" + navigator.userAgent;
                if (env.editor.getValue() == info)
                    return env.editor.undo();
                env.editor.setValue(info, -1);
                env.editor.setOption("wrap", 80);
            }}, "Show Browser Info"]],
        devUtil.getUI(),
        ["div", {},
            "Open Dialog ",
            ["button",  {onclick: openTestDialog.bind(null, false)}, "Scale"],
            ["button",  {onclick: openTestDialog.bind(null, true)}, "Height"]
        ]
    ]),
    optionsPanelContainer.children[1]
);

function openTestDialog(animateHeight) {
    if (window.dialogEditor) 
        window.dialogEditor.destroy();
    var editor = ace.edit(null, {
        value: "test editor", 
        mode: "ace/mode/javascript"
    });
    window.dialogEditor = editor;

    var dialog = dom.buildDom(["div", {
        style: "transition: all 1s; position: fixed; z-index: 100000;"
          + "background: darkblue; border: solid 1px black; display: flex; flex-direction: column"
        }, 
        ["div", {}, "test dialog"],
        editor.container
    ], document.body);
    editor.container.style.flex = "1";
    if (animateHeight) {
        dialog.style.width = "0vw";
        dialog.style.height = "0vh";
        dialog.style.left = "20vw";
        dialog.style.top = "20vh";
        setTimeout(function() {            
            dialog.style.width = "80vw";
            dialog.style.height = "80vh";
            dialog.style.left = "10vw";
            dialog.style.top = "10vh";
        }, 0);
        
    } else {
        dialog.style.width = "80vw";
        dialog.style.height = "80vh";
        dialog.style.left = "10vw";
        dialog.style.top = "10vh";
        dialog.style.transform = "scale(0)";
        setTimeout(function() {
            dialog.style.transform = "scale(1)"
        }, 0);
    }
    function close(e) {
        if (!e || !dialog.contains(e.target)) {
            if (animateHeight) {
                dialog.style.width = "0vw";
                dialog.style.height = "0vh";
                dialog.style.left = "80vw";
                dialog.style.top = "80vh";
            } else {
                dialog.style.transform = "scale(0)"
            }
            window.removeEventListener("mousedown", close);
            dialog.addEventListener("transitionend", function() {
                dialog.remove();
                editor.destroy();
            });
        }
    }
    window.addEventListener("mousedown", close);
    editor.focus()
    editor.commands.bindKey("Esc", function() { close(); });
}


require("ace/ext/language_tools");
require("ace/ext/inline_autocomplete");
env.editor.setOptions({
    enableBasicAutocompletion: true,
    enableInlineAutocompletion: true,
    enableSnippets: true
});

var beautify = require("ace/ext/beautify");
env.editor.commands.addCommands(beautify.commands);


// global keybindings

var KeyBinding = require("ace/keyboard/keybinding").KeyBinding;
var CommandManager = require("ace/commands/command_manager").CommandManager;
var commandManager = new CommandManager();
var kb = new KeyBinding({
    commands: commandManager,
    fake: true
});
event.addCommandKeyListener(document.documentElement, kb.onCommandKey.bind(kb));
event.addListener(document.documentElement, "keyup", function(e) {
    if (e.keyCode === 18) // do not trigger browser menu on windows
        e.preventDefault();
});
commandManager.addCommands([{
    name: "window-left",
    bindKey: {win: "cmd-alt-left", mac: "ctrl-cmd-left"},
    exec: function() {
        moveFocus();
    }
}, {
    name: "window-right",
    bindKey: {win: "cmd-alt-right", mac: "ctrl-cmd-right"},
    exec: function() {
        moveFocus();
    }
}, {
    name: "window-up",
    bindKey: {win: "cmd-alt-up", mac: "ctrl-cmd-up"},
    exec: function() {
        moveFocus();
    }
}, {
    name: "window-down",
    bindKey: {win: "cmd-alt-down", mac: "ctrl-cmd-down"},
    exec: function() {
        moveFocus();
    }
}]);

function moveFocus() {
    var el = document.activeElement;
    if (el == env.editor.textInput.getElement())
        env.editor.cmdLine.focus();    
    else
        env.editor.focus();
}