"use strict";

var dom = require("ace-code/src/lib/dom");

var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;

var TextLayer = require("ace-code/src/layer/text").Text;
var text;

const {BaseDiffView} = require("./base_diff_view");

class InlineDiffView extends BaseDiffView {
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
        super(element, options, true);
        this.init();
    }

    init() {
        text = new TextLayer(this.right.container);
        this.edit.renderer.on("afterRender", renderWidgets);
        text.setSession(this.session.orig);

        this.$attachEventHandlers();
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
                lastLine: ch.old.end.row
            });
        });
        diffView.edit.session["_emit"]("changeFold", {data: {start: {row: 0}}});
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
        this.right.on("input", this.onInput.bind(this));
    }
}

/**
 * @param {number} changes
 * @param {import("ace-code").VirtualRenderer} renderer
 */
function renderWidgets(changes, renderer) {
    var config = renderer.layerConfig;
    var session = renderer.session;
    var lineWidgets = renderer.session.lineWidgets;
    if (!lineWidgets) return;
    var first = Math.min(0, config.firstRow);
    var last = Math.max(config.lastRow, lineWidgets.length);

    while (first > 0 && !lineWidgets[first]) first--;

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
        var top = renderer.$cursorLayer.getPixelPosition({
            row: i,
            column: 0
        }, true).top;
        w.customEl.style.top = top - config.lineHeight * w.rowsAbove - config.offset + "px";

        var left = w.coverGutter ? 0 : renderer.gutterWidth;
        if (!w.fixedWidth) left -= renderer.scrollLeft;
        w.customEl.style.left = left + "px";

        if (w.fullWidth && w.screenWidth) {
            w.customEl.style.minWidth = config.width + 2 * config.padding + "px";
        }

        if (w.fixedWidth) {
            w.customEl.style.right = renderer.scrollBar.getWidth() + "px";
        }
        else {
            w.customEl.style.right = "";
        }
    }
}

exports.InlineDiffView = InlineDiffView;
