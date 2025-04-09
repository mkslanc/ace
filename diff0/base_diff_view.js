"use strict";

var oop = require("ace-code/src/lib/oop");
var Range = require("ace-code/src/range").Range;
var dom = require("ace-code/src/lib/dom");
var config = require("ace-code/src/config");

// @ts-ignore
var css = require("text!./styles.css");
var computeDiff = require("./vscode-diff/index").computeDiff;

var Editor = require("ace-code/src/editor").Editor;
var Renderer = require("ace-code/src/virtual_renderer").VirtualRenderer;
var UndoManager = require("ace-code/src/undomanager").UndoManager;
require("ace-code/src/theme/textmate");
// enable multiselect
require("ace-code/src/multi_select");

var {
    AceDiff,
    DiffHighlight,
    findChunkIndex
} = require("./ace_diff");
const {EditSession} = require("ace-code/src/edit_session");

function createEditor() {
    var editor = new Editor(new Renderer(), null, {
        customScrollbar: true,
        vScrollBarAlwaysVisible: true
    });
    editor.session.setUndoManager(new UndoManager());
    // @ts-expect-error we should add this to the editor options
    editor.renderer.setOption("decoratorType", "diff");
    return editor;
}

class BaseDiffView {
    /**
     * Constructs a new DiffView instance.
     *
     * @param {HTMLElement} element - The container element for the DiffView.
     * @param {Object} options - The configuration options for the DiffView.
     * @param {boolean} [options.ignoreTrimWhitespace=true] - Whether to ignore whitespace changes when computing diffs.
     * @param {boolean} [options.foldUnchanged=false] - Whether to fold unchanged regions in the diff view.
     * @param {number} [options.maxComputationTimeMs=0] - The maximum time in milliseconds to spend computing diffs (0 means no limit).
     * @param {boolean} [options.syncSelections=false] - Whether to synchronize selections between the original and edited views.
     * @param {boolean} [inlineDiffEditor] - Whether to use an inline diff editor.
     */
    constructor(element, options, inlineDiffEditor) {
        /**@type{{orig: EditSession, edit: EditSession, chunks: AceDiff[]}}*/this.session;
        /**@type AceDiff[]*/this.chunks;
        this.inlineDiffEditor = inlineDiffEditor || false;
        this.currentDiffIndex = 0;

        dom.importCssString(css, "diffview.css");
        if (options.ignoreTrimWhitespace === undefined) options.ignoreTrimWhitespace = true;
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
        });

        const diffEditorOptions = {
            "scrollPastEnd": 0.5,
            "highlightActiveLine": false,
            "highlightGutterLine": false,
            "animatedScroll": true
        };

        this.edit = this.right = createEditor();
        element.appendChild(this.right.container);
        this.right.setOptions(diffEditorOptions);
        this.markerRight = new DiffHighlight(this, 1);
        //TODO: experiment
        this.markerLeft = new DiffHighlight(this, -1);

        if (!this.inlineDiffEditor) {
            this.orig = this.left = createEditor();
            element.appendChild(this.left.container);
            this.left.setOptions(diffEditorOptions);
            //TODO: experiment
            //this.markerLeft = new DiffHighlight(this, -1);

            this.syncSelectionMarkerLeft = new SyncSelectionMarker();
            this.syncSelectionMarkerRight = new SyncSelectionMarker();
            this.left.session.addDynamicMarker(this.syncSelectionMarkerLeft);
            this.right.session.addDynamicMarker(this.syncSelectionMarkerRight);

            this.setSession({
                orig: this.orig.session,
                edit: this.edit.session,
                chunks: []
            });
        }
        else {
            this.setSession({
                orig: new EditSession(""),
                edit: this.edit.session,
                chunks: []
            });
        }

        this.onChangeTheme();

        config.resetOptions(this);
        config["_signal"]("diffView", this);
    }

    foldUnchanged() {
        if (!this.inlineDiffEditor) {
            this.orig.session.unfold();
        }
        this.edit.session.unfold();

        var chunks = this.chunks;
        var sep = "---";
        var prev = {
            old: new Range(0, 0, 0, 0),
            new: new Range(0, 0, 0, 0)
        };
        for (var i = 0; i < chunks.length + 1; i++) {
            let current = chunks[i] || {
                old: new Range(this.session.orig.getLength(), 0, this.session.orig.getLength(), 0),
                new: new Range(this.edit.session.getLength(), 0, this.edit.session.getLength(), 0)
            };
            var l = current.new.start.row - prev.new.end.row - 5;
            if (l > 2) {
                var s = prev.old.end.row + 2;
                var f1 = this.session.orig.addFold(sep, new Range(s, 0, s + l, Number.MAX_VALUE));
                s = prev.new.end.row + 2;
                var f2 = this.edit.session.addFold(sep, new Range(s, 0, s + l, Number.MAX_VALUE));
                if (f2 && f1) {
                    f1["other"] = f2;
                    f2["other"] = f1;
                }
            }

            prev = current;
        }

    }

    /**
     *
     * @param session
     * @abstract
     */
    setSession(session) {
        if (this.session) {
            this.$detachEditorsEventHandlers();
        }
        this.session = session;
        if (this.session) {
            this.chunks = this.session.chunks;
            if (!this.inlineDiffEditor) {
                this.orig.setSession(session.orig);
            }
            this.edit.setSession(session.edit);
            this.$attachEditorsEventHandlers();
        }
    }

    $attachEditorsEventHandlers() {
    }

    $detachEditorsEventHandlers() {
    }

    getSession() {
        return this.session;
    }

    setTheme(theme) {
        this.right.setTheme(theme);
        if (!this.inlineDiffEditor) {
            this.left.setTheme(theme);
        }
    }

    getTheme() {
        return this.left.getTheme();
    }

    onChangeTheme() {
        if (!this.inlineDiffEditor) {
            this.right.setTheme(this.left.getTheme());
        }
    }

    resize() {
        if (!this.inlineDiffEditor) {
            this.orig.resize();
        }
        this.edit.resize();
    }

    onInput() {
        var val1 = this.session.orig.doc.getAllLines();
        var val2 = this.session.edit.doc.getAllLines();

        this.selectionSetBy = false;
        this.leftSelectionRange = null;
        this.rightSelectionRange = null;

        var chunks = this.$diffLines(val1, val2);

        this.session.chunks = this.chunks = chunks;
        // if we"re dealing with too many chunks, fail silently
        if (this.chunks && this.chunks.length > this.options.maxDiffs) {
            return;
        }

        if (this["$alignDiffs"]) this.align();

        if (!this.inlineDiffEditor) {
            this.orig.renderer.updateBackMarkers();
        }
        this.right.renderer.updateBackMarkers();

        if (this.options.foldUnchanged) {
            this.foldUnchanged();
        }
    }

    /**
     *
     * @param {string[]} val1
     * @param {string[]} val2
     * @return {AceDiff[]}
     */
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

    /** scroll locking
     * @abstract
     **/
    align() {
    }

    /**
     * @param ev
     * @param {EditSession} session
     */
    onChangeFold(ev, session) {
        var fold = ev.data;
        if (this.$syncFold || !fold || !ev.action) return;

        const isOrig = session === this.session.orig;
        const other = isOrig ? this.session.edit : this.session.orig;

        if (ev.action === "remove") {
            if (fold.other) {
                fold.other.other = null;
                other.removeFold(fold.other);
            }
            else if (fold.lineWidget) {
                other.widgetManager.addLineWidget(fold.lineWidget);
                fold.lineWidget = null;
                if (other["$editor"]) {
                    other["$editor"].renderer.updateBackMarkers();
                }
            }
        }

        if (ev.action === "add") {
            const range = this.transformRange(fold.range, isOrig);
            if (range.isEmpty()) {
                const row = range.start.row + 1;
                if (other.lineWidgets[row]) {
                    fold.lineWidget = other.lineWidgets[row];
                    other.widgetManager.removeLineWidget(fold.lineWidget);
                    if (other["$editor"]) {
                        other["$editor"].renderer.updateBackMarkers();
                    }
                }
            }
            else {
                this.$syncFold = true;

                fold.other = other.addFold("---", range);
                fold.other.other = fold;

                this.$syncFold = false;

            }
        }
    }

    /*** other ***/
    destroy() {
        if (!this.inlineDiffEditor) {
            this.left.destroy();
        }
        this.right.destroy();
    }

    gotoNext(dir) { //TODO: wouldn't work in inline diff editor
        var orig = false;
        var ace = orig ? this.orig : this.edit;
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

    /**
     * @param {import("ace-code").Ace.Range} range
     * @param {boolean} orig
     */
    transformRange(range, orig) {
        return Range.fromPoints(this.transformPosition(range.start, orig), this.transformPosition(range.end, orig));
    }

    /**
     * @param {import("ace-code").Ace.Point} pos
     * @param {boolean} isOrig
     * @return {import("ace-code").Ace.Point}
     */
    transformPosition(pos, isOrig) {
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
            }
            else {
                if (chunk.charChanges) {
                    for (let i = 0; i < chunk.charChanges.length; i++) {
                        let change = chunk.charChanges[i];

                        let fromRange = change.getChangeRange(from);
                        let toRange = change.getChangeRange(to);

                        if (fromRange.end.row < pos.row) continue;

                        if (fromRange.start.row > pos.row) break;

                        if (fromRange.isMultiLine() && fromRange.contains(pos.row, pos.column)) {
                            result.row = toRange.start.row + pos.row - fromRange.start.row;
                            var maxRow = toRange.end.row;
                            if (toRange.end.column === 0) maxRow--;

                            if (result.row > maxRow) {
                                result.row = maxRow;
                                result.column = (isOrig ? this.session.edit : this.session.orig).getLine(maxRow).length;
                                ignoreIndent = true;
                            }
                            result.row = Math.min(result.row, maxRow);
                        }
                        else {
                            result.row = toRange.start.row;
                            if (fromRange.start.column > pos.column) break;
                            ignoreIndent = true;

                            if (!fromRange.isEmpty() && fromRange.contains(pos.row, pos.column)) {
                                result.column = toRange.start.column;
                                deltaChar = pos.column - fromRange.start.column;
                                deltaChar = Math.min(deltaChar, toRange.end.column - toRange.start.column);
                            }
                            else {
                                result = clonePos(toRange.end);
                                deltaChar = pos.column - fromRange.end.column;
                            }
                        }
                    }
                }
            }
        }


        if (!ignoreIndent) { //TODO:
            var [fromEditSession, toEditSession] = isOrig ? [this.session.orig, this.session.edit] : [
                this.session.edit, this.session.orig
            ];
            deltaChar -= this.$getDeltaIndent(fromEditSession, toEditSession, pos.row, result.row);
        }

        result.column += deltaChar;
        return result;
    }

    /**
     * @param {EditSession} fromEditSession
     * @param {EditSession} toEditSession
     * @param {number} fromLine
     * @param {number} toLine
     */
    $getDeltaIndent(fromEditSession, toEditSession, fromLine, toLine) {
        let origIndent = this.$getIndent(fromEditSession, fromLine);
        let editIndent = this.$getIndent(toEditSession, toLine);
        return origIndent - editIndent;
    }

    /**
     * @param {EditSession} editSession
     * @param {number} line
     */
    $getIndent(editSession, line) {
        return editSession.getLine(line).match(/^\s*/)[0].length;
    }

    printDiffs() {
        this.chunks.forEach((diff) => {
            console.log(diff.toString());
        });
    }
}

/*** options ***/
config.defineOptions(BaseDiffView.prototype, "editor", {
    alignDiffs: {
        set: function (val) {
            if (val) this.align();
        },
        initialValue: true
    }
});

class SyncSelectionMarker {
    constructor() {
        this.type = "fullLine";
        this.clazz = "ace_diff selection";
    }

    update(html, markerLayer, session, config) {
    }

    /**
     * @param {import("ace-code").Ace.Range} range
     */
    setRange(range) {//TODO
        var newRange = range.clone();
        newRange.end.column++;

        this.range = newRange;
    }
}

exports.BaseDiffView = BaseDiffView;
