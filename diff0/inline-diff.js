"use strict";

var oop = require("ace-code/src/lib/oop");
var Range = require("ace-code/src/range").Range;
var dom = require("ace-code/src/lib/dom");
var config = require("ace-code/src/config");

var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;
var css = require("text!./styles.css");
var computeDiff = require("./vscode-diff/index").computeDiff;

var Editor = require("ace-code/src/editor").Editor;
var Renderer = require("ace-code/src/virtual_renderer").VirtualRenderer;
var UndoManager = require("ace-code/src/undomanager").UndoManager;
var EditSession = require("ace-code/src/edit_session").EditSession;
var TextLayer = require("ace-code/src/layer/text").Text;
var text;

require("ace-code/src/theme/textmate");
// enable multiselect
require("ace-code/src/multi_select");

var {AceDiff, DiffHighlight, findChunkIndex} = require("./ace_diff");

function createEditor() {
    var editor = new Editor(new Renderer(), null, {
        customScrollbar: true,
        vScrollBarAlwaysVisible: true
    });
    editor.session.setUndoManager(new UndoManager());
    editor.renderer.setOption("decoratorType", "diff");
    return editor;
}

class DiffView {
    /**
     * Constructs a new DiffView instance.
     *
     * @param {HTMLElement} element - The container element for the DiffView.
     * @param {Object} options - The configuration options for the DiffView.
     * @param {boolean} [options.ignoreTrimWhitespace=true] - Whether to ignore whitespace changes when computing diffs.
     * @param {boolean} [options.foldUnchanged=false] - Whether to fold unchanged regions in the diff view.
     * @param {number} [options.maxComputationTimeMs=0] - The maximum time in milliseconds to spend computing diffs (0 means no limit).
     * @param {boolean} [options.syncSelections=false] - Whether to synchronize selections between the original and edited views.
     */
    constructor(element, options) {
        /**@type AceDiff[]*/this.chunks;
        this.onInput = this.onInput.bind(this);
        this.currentDiffIndex = 0;

        dom.importCssString(css, "diffview.css");
        if (options.ignoreTrimWhitespace === undefined)
            options.ignoreTrimWhitespace = true;
        this.options = {
            ignoreTrimWhitespace: options.ignoreTrimWhitespace,
            foldUnchanged: options.foldUnchanged || false,
            maxComputationTimeMs: options.maxComputationTimeMs || 0, // time in milliseconds, 0 => no computation limit.
            syncSelections: options.syncSelections || false //experimental option
        };
        this.container = element;

        oop.mixin(this.options, {
            showDiffs: true,
            maxDiffs: 5000
        }, options);

        this.edit = this.right = createEditor();
        element.appendChild(this.right.container);

        const diffEditorOptions = {
            "scrollPastEnd": 0.5,
            "highlightActiveLine": false,
            "highlightGutterLine": false,
            "animatedScroll": true,
        };

        this.right.setOptions(diffEditorOptions);

        this.markerRight = new DiffHighlight(this, 1);

        this.init();

        this.setSession({
            orig: new EditSession(""),
            edit: this.edit.session,
            chunks: []
        });



        config.resetOptions(this);
        config._signal("diffView", this);
    }

    init() {
        this.bindEventHandlers();
        text = new TextLayer(this.right.container);
        this.edit.renderer.on("afterRender", renderWidgets);

        this.$attachEventHandlers();
    }

    bindEventHandlers() {
        this.onInput = this.onInput.bind(this);
    }

    /*** theme/session ***/
    setSession(session) {
        if (this.session) {
            this.$detachEditorsEventHandlers();
        }
        this.session = session;
        if (this.session) {
            this.chunks = this.session.chunks;
            //TODO:
            this.leftSession = session.orig;
            text.setSession(this.leftSession);

            this.edit.setSession(session.edit);
            this.$attachEditorsEventHandlers();
        }

    }

    align() {
        var diffView = this;

        function add(editor, w) {
            let lineWidget = editor.session.lineWidgets[w.row];
            if (lineWidget) {
                w.rowsAbove += lineWidget.rowsAbove > w.rowsAbove ? lineWidget.rowsAbove : w.rowsAbove;
                w.rowCount += lineWidget.rowCount;
            }
            editor.session.lineWidgets[w.row] = w;
            editor.session.widgetManager.lineWidgets[w.row] = w;
        }

        function init(editor) {
            var session = editor.session;
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                session.widgetManager.attach(editor);
            }
            editor.session.lineWidgets = [];
            editor.session.widgetManager.lineWidgets = [];
            text.element.innerHTML = "";
        }

        init(diffView.edit);

        diffView.chunks.forEach(function (ch) {
            var diff1 = ch.old.end.row - ch.old.start.row;
            add(diffView.edit, {
                rowCount: diff1,
                rowsAbove: diff1,
                row: ch.new.start.row,
                fixedWidth: true,
                firstLine: ch.old.start.row,
                lastLine: ch.old.end.row,
            });
        });
        diffView.edit.session._emit("changeFold", {data: {start: {row: 0}}});
    }

    getSession() {
        return this.session;
    }

    setTheme(theme) {
        this.right.setTheme(theme);
    }

    getTheme() {
        return this.right.getTheme();
    }

    resize() {
        this.edit.resize();
    }

    onInput() {
        //TODO:
        var val1 = this.leftSession.doc.getAllLines();
        var val2 = this.right.session.doc.getAllLines();

        this.selectionSetBy = false;
        this.leftSelectionRange = null;
        this.rightSelectionRange = null;

        var chunks = this.$diffLines(val1, val2);

        this.session.chunks = this.chunks = chunks;
        // if we"re dealing with too many chunks, fail silently
        if (this.chunks && this.chunks.length > this.options.maxDiffs) {
            return;
        }

        if (this.$alignDiffs) this.align();

        this.right.renderer.updateBackMarkers();

    }

    $diffLines(val1, val2) {
        var chunks = computeDiff(val1, val2, {
            ignoreTrimWhitespace: this.options.ignoreTrimWhitespace,
            maxComputationTimeMs: this.options.maxComputationTimeMs
        });
        if (chunks) {
            return chunks.map((changes) => {
                return new AceDiff(new Range(changes.origStart, 0, changes.origEnd, 0),
                    new Range(changes.editStart, 0, changes.editEnd, 0), changes.charChanges
                );
            });
        }
    }

    $attachEditorsEventHandlers() {
        this.$attachEditorEventHandlers(this.right, this.markerRight);
    }

    $attachEditorEventHandlers(editor, marker) {
        editor.session.addDynamicMarker(marker);
    }

    $detachEditorsEventHandlers() {
        this.$detachEditorEventHandlers(this.right, this.markerRight);
    }

    $detachEditorEventHandlers(editor, marker) {
        editor.session.removeMarker(marker.id);
    }

    $attachEventHandlers() {
        this.right.on("input", this.onInput);
    }

    /*** other ***/
    destroy() {
        this.right.destroy();
    }

    gotoNext(dir) {
        var orig = false;
        //TODO:
        //var ace = orig ? this.orig : this.edit;
        var ace = this.edit;
        var row = ace.selection.lead.row;
        var i = findChunkIndex(this.chunks, row, orig);
        var chunk = this.chunks[i + dir] || this.chunks[i];

        var scrollTop = ace.session.getScrollTop();
        if (chunk) {
            var line = Math.max(chunk.new.start.row, chunk.new.end.row - 1);
            ace.selection.setRange(new Range(line, 0, line, 0));
        }
        ace.renderer.scrollSelectionIntoView(ace.selection.lead, ace.selection.anchor, 0.5);
        ace.renderer.animateScrolling(scrollTop);
    }


    firstDiffSelected() {
        return this.currentDiffIndex <= 0;
    }

    lastDiffSelected() {
        return this.currentDiffIndex == this.chunks.length - 1;
    }

    transformRange(range, orig) {
        return Range.fromPoints(this.transformPosition(range.start, orig), this.transformPosition(range.end, orig));
    }

    /**
     * @param {Ace.Point} pos
     * @param {boolean} isOrig
     * @return {Ace.Point}
     */
    transformPosition(pos, isOrig) {
        //TODO: old/new -> edit only
        var chunkIndex = findChunkIndex(this.chunks, pos.row, isOrig);
        this.currentDiffIndex = chunkIndex;

        var chunk = this.chunks[chunkIndex];

        var clonePos = this.right.session.doc.clonePos;
        var result = clonePos(pos);

        var [from, to] = isOrig ? ["old", "new"] : ["new", "old"];
        var deltaChar = 0;
        var ignoreIndent = false;

        if (chunk) {
            if (chunk[from].end.row <= pos.row) {
                result.row -= chunk[from].end.row - chunk[to].end.row;
            } else {
                if (chunk.charChanges) {
                    for (let i = 0; i < chunk.charChanges.length; i++) {
                        let change = chunk.charChanges[i];

                        let fromRange = change.getChangeRange(from);
                        let toRange = change.getChangeRange(to);

                        if (fromRange.end.row < pos.row)
                            continue;

                        if (fromRange.start.row > pos.row)
                            break;

                        if (fromRange.isMultiLine() && fromRange.contains(pos.row, pos.column)) {
                            result.row = toRange.start.row + pos.row - fromRange.start.row;
                            var maxRow = toRange.end.row;
                            if (toRange.end.column === 0)
                                maxRow--;

                            if (result.row > maxRow) {
                                result.row = maxRow;
                                result.column = (isOrig ? this.right : this.right).session.getLine(maxRow).length;
                                ignoreIndent = true;
                            }
                            result.row = Math.min(result.row, maxRow);
                        } else {
                            result.row = toRange.start.row;
                            if (fromRange.start.column > pos.column)
                                break;
                            ignoreIndent = true;

                            if (!fromRange.isEmpty() && fromRange.contains(pos.row, pos.column)) {
                                result.column = toRange.start.column;
                                deltaChar = pos.column - fromRange.start.column;
                                deltaChar = Math.min(deltaChar, toRange.end.column - toRange.start.column);
                            } else {
                                result = clonePos(toRange.end);
                                deltaChar = pos.column - fromRange.end.column;
                            }
                        }
                    }
                }
            }
        }


        if (!ignoreIndent) {
            var [fromEditor, toEditor] = isOrig ? [this.right, this.right] : [this.right, this.right];
            deltaChar -= this.$getDeltaIndent(fromEditor, toEditor, pos.row, result.row);
        }

        result.column += deltaChar;
        return result;
    }

    $getDeltaIndent(fromEditor, toEditor, fromLine, toLine) {
        let origIndent = this.$getIndent(fromEditor, fromLine);
        let editIndent = this.$getIndent(toEditor, toLine);
        return origIndent - editIndent;
    }

    $getIndent(editor, line) {
        return editor.session.getLine(line).match(/^\s*/)[0].length;
    }

    printDiffs() {
       this.chunks.forEach((diff) => {
           console.log(diff.toString());
       });
    }
}

/*** options ***/
config.defineOptions(DiffView.prototype, "editor", {
    alignDiffs: {
        set: function (val) {
            if (val) this.align();
        },
        initialValue: true
    }
});

/**
 * @param {number} changes
 * @param {import("ace-code").VirtualRenderer} renderer
 */
function renderWidgets(changes, renderer) {
    var config = renderer.layerConfig;
    var session = renderer.session;
    var lineWidgets = renderer.session.lineWidgets;
    if (!lineWidgets)
        return;
    var first = Math.min(0, config.firstRow);
    var last = Math.max(config.lastRow, lineWidgets.length);

    while (first > 0 && !lineWidgets[first])
        first--;

    //this.firstRow = config.firstRow;
    //this.lastRow = config.lastRow;

    renderer.$cursorLayer.config = config;
    for (var i = first; i <= last; i++) {
        var w = lineWidgets[i];
        if (!w) continue;
        if (!w.customEl) {
            w.customEl = dom.buildDom(["div", {class: "ace_diff_widgets ace_diff delete inline"}], text.element);
            w.customEl.style.position = "absolute";
            w.customEl.style.zIndex = "5";
            //TODO::::: !!!!!
            for (let j = w.firstLine; j < w.lastLine; j++) {
                let child = dom.createElement("div");
                child.style.height = config.lineHeight + "px";
                w.customEl.appendChild(child);
                text.$renderLine(child, j);
            }
        }
        if (w.hidden) {
            w.customEl.style.top = -100 - (w.pixelHeight || 0) + "px";
            continue;
        }
        var top = renderer.$cursorLayer.getPixelPosition({row: i, column:0}, true).top;
        w.customEl.style.top = top - config.lineHeight * w.rowsAbove - config.offset + "px";

        var left = w.coverGutter ? 0 : renderer.gutterWidth;
        if (!w.fixedWidth)
            left -= renderer.scrollLeft;
        w.customEl.style.left = left + "px";

        if (w.fullWidth && w.screenWidth) {
            w.customEl.style.minWidth = config.width + 2 * config.padding + "px";
        }

        if (w.fixedWidth) {
            w.customEl.style.right = renderer.scrollBar.getWidth() + "px";
        } else {
            w.customEl.style.right = "";
        }
    }
}

exports.DiffView = DiffView;
