"use strict";

var Range = require("ace-code/src/range").Range;
var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;

const {
    AceDiff,
    findChunkIndex
} = require("./ace_diff");
const { BaseDiffView } = require("./base_diff_view");

class SideBySideDiffView extends BaseDiffView {
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
        options = options || {};
        super(element, options);
        this.init();
    }

    init() {
        this.$attachEventHandlers();
    }

    /*** scroll locking ***/
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
        }

        init(diffView.edit);
        init(diffView.orig);

        diffView.chunks.forEach(function (ch) {
            var diff1 = ch.old.end.row - ch.old.start.row;
            var diff2 = ch.new.end.row - ch.new.start.row;
            if (diff1 < diff2) {
                add(diffView.orig, {
                    rowCount: diff2 - diff1,
                    rowsAbove: ch.old.end.row === 0 ? diff2 : 0,
                    row: ch.old.end.row === 0 ? 0 : ch.old.end.row - 1
                });
            }
            else if (diff1 > diff2) {
                add(diffView.edit, {
                    rowCount: diff1 - diff2,
                    rowsAbove: ch.new.end.row === 0 ? diff1 : 0,
                    row: ch.new.end.row === 0 ? 0 : ch.new.end.row - 1
                });
            }
        });
        diffView.edit.session["_emit"]("changeFold", {data: {start: {row: 0}}});
        diffView.orig.session["_emit"]("changeFold", {data: {start: {row: 0}}});
    }

    onSelect(e, selection) {
        this.syncSelect(selection);
    }

    syncSelect(selection) {
        if (this.$updatingSelection) return;
        var isOrig = selection.session === this.left.session;
        var selectionRange = selection.getRange();

        var currSelectionRange = isOrig ? this.leftSelectionRange : this.rightSelectionRange;
        if (currSelectionRange && selectionRange.isEqual(currSelectionRange))
            return;

        if (isOrig) {
            this.leftSelectionRange = selectionRange;
        } else {
            this.rightSelectionRange = selectionRange;
        }

        this.$updatingSelection = true;
        var newRange = this.transformRange(selectionRange, isOrig);

        if (this.options.syncSelections) {
            (isOrig ? this.right : this.left).session.selection.setSelectionRange(newRange);
        }
        this.$updatingSelection = false;

        if (isOrig) {
            this.leftSelectionRange = selectionRange;
            this.rightSelectionRange = newRange;
        } else {
            this.leftSelectionRange = newRange;
            this.rightSelectionRange = selectionRange;
        }

        this.updateSelectionMarker(this.syncSelectionMarkerLeft, this.left.session, this.leftSelectionRange);
        this.updateSelectionMarker(this.syncSelectionMarkerRight, this.right.session, this.rightSelectionRange);
    }

    updateSelectionMarker(marker, session, range) {
        marker.setRange(range);
        session._signal("changeBackMarker");
    }

    onScroll(e, session) {
        this.syncScroll(this.left.session === session ? this.left.renderer : this.right.renderer);
    }

    /**
     * @param {import("ace-code/src/virtual_renderer").VirtualRenderer} renderer
     */
    syncScroll(renderer) {
        if (this.$syncScroll == false) return;

        var r1 = this.left.renderer;
        var r2 = this.right.renderer;
        var isOrig = renderer == r1;
        if (r1["$scrollAnimation"] && r2["$scrollAnimation"]) return;

        var now = Date.now();
        if (this.scrollSetBy != renderer && now - this.scrollSetAt < 500) return;

        var r = isOrig ? r1 : r2;
        if (this.scrollSetBy != renderer) {
            if (isOrig && this.scrollOrig == r.session.getScrollTop()) return; else if (!isOrig && this.scrollEdit
                == r.session.getScrollTop()) return;
        }
        var rOther = isOrig ? r2 : r1;

        if (this["$alignDiffs"]) {
            targetPos = r.session.getScrollTop();
        }
        else {
            var layerConfig = r.layerConfig;
            var chunks = this.chunks;
            var halfScreen = 0.4 * r["$size"].scrollerHeight;

            var lc = layerConfig;
            var midY = halfScreen + r.scrollTop;
            var mid = r.session.screenToDocumentRow(midY / lc.lineHeight, 0);

            var i = findChunkIndex(chunks, mid, isOrig);
            /**
             *
             * @type {Partial<AceDiff>}
             */
            var ch = chunks[i];

            if (!ch) {
                ch = {
                    old: new Range(0, 0, 0, 0),
                    new: new Range(0, 0, 0, 0)
                };
            }
            if (mid >= (isOrig ? ch.old.end.row : ch.new.end.row)) {
                var next = chunks[i + 1] || {
                    old: new Range(r1.session.getLength(), 0, r1.session.getLength(), 0),
                    new: new Range(r2.session.getLength(), 0, r2.session.getLength(), 0)
                };
                ch = {
                    old: new Range(ch.old.end.row, 0, next.old.start.row, 0),
                    new: new Range(ch.new.end.row, 0, next.new.start.row, 0)
                };
            }
            if (r == r1) {
                var start = ch.old.start.row;
                var end = ch.old.end.row;
                var otherStart = ch.new.start.row;
                var otherEnd = ch.new.end.row;
            }
            else {
                otherStart = ch.old.start.row;
                otherEnd = ch.old.end.row;
                start = ch.new.start.row;
                end = ch.new.end.row;
            }

            var offOtherTop = rOther.session.documentToScreenRow(otherStart, 0) * lc.lineHeight;
            var offOtherBot = rOther.session.documentToScreenRow(otherEnd, 0) * lc.lineHeight;

            var offTop = r.session.documentToScreenRow(start, 0) * lc.lineHeight;
            var offBot = r.session.documentToScreenRow(end, 0) * lc.lineHeight;

            var ratio = (midY - offTop) / (offBot - offTop || offOtherBot - offOtherTop);
            var targetPos = offOtherTop - halfScreen + ratio * (offOtherBot - offOtherTop);
            targetPos = Math.max(0, targetPos);
        }

        this.$syncScroll = false;

        if (isOrig) {
            this.scrollOrig = r.session.getScrollTop();
            this.scrollEdit = targetPos;
        }
        else {
            this.scrollOrig = targetPos;
            this.scrollEdit = r.session.getScrollTop();
        }
        this.scrollSetBy = renderer;
        rOther.session.setScrollTop(targetPos);
        this.$syncScroll = true;
        this.scrollSetAt = now;
    }

    onMouseWheel(ev) {
        if (ev.getAccelKey()) return;
        if (ev.getShiftKey() && ev.wheelY && !ev.wheelX) {
            ev.wheelX = ev.wheelY;
            ev.wheelY = 0;
        }

        var editor = ev.editor;
        var isScrolable = editor.renderer.isScrollableBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed);
        if (!isScrolable) {
            var other = editor == this.left ? this.right : this.left;
            if (other.renderer.isScrollableBy(ev.wheelX * ev.speed, ev.wheelY * ev.speed)) other.renderer.scrollBy(
                ev.wheelX * ev.speed, ev.wheelY * ev.speed);
            return ev.stop();
        }
    }

    $attachEditorsEventHandlers() {
        this.$attachEditorEventHandlers(this.left, this.markerLeft);
        this.$attachEditorEventHandlers(this.right, this.markerRight);
    }

    $attachEditorEventHandlers(editor, marker) {
        editor.session.on("changeScrollTop", this.onScroll.bind(this));
        editor.session.on("changeFold", this.onChangeFold.bind(this));
        editor.session.addDynamicMarker(marker);
        editor.selection.on("changeCursor", this.onSelect.bind(this));
        editor.selection.on("changeSelection", this.onSelect.bind(this));
    }

    $detachEditorsEventHandlers() {
        this.$detachEditorEventHandlers(this.left, this.markerLeft);
        this.$detachEditorEventHandlers(this.right, this.markerRight);
    }

    $detachEditorEventHandlers(editor, marker) {
        editor.session.off("changeScrollTop", this.onScroll.bind(this));
        editor.session.off("changeFold", this.onChangeFold.bind(this));
        editor.session.removeMarker(marker.id);
        editor.selection.off("changeCursor", this.onSelect.bind(this));
        editor.selection.off("changeSelection", this.onSelect.bind(this));
    }

    $attachEventHandlers() {
        this.left.renderer.on("themeLoaded", this.onChangeTheme.bind(this));

        this.left.on("mousewheel", this.onMouseWheel.bind(this));
        this.right.on("mousewheel", this.onMouseWheel.bind(this));

        this.left.on("input", this.onInput.bind(this));
        this.right.on("input", this.onInput.bind(this));

    }
}

exports.SideBySideDiffView = SideBySideDiffView;
