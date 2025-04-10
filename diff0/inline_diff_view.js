"use strict";

var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;
var TextLayer = require("ace-code/src/layer/text").Text;
var MarkerLayer = require("ace-code/src/layer/marker").Marker;
var textLayer, markerLayer;

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
        textLayer = new TextLayer(this.right.renderer.content);
        this.edit.renderer.on("afterRender", renderWidgets.bind(this));
        textLayer.setSession(this.session.orig);
        textLayer.setPadding(4);


        //TODO: start experiment
        markerLayer = this.markerLayer = new MarkerLayer(this.right.renderer.content);
        this.markerLayer.setSession(this.session.orig);
        this.markerLayer.setPadding(4);

        //TODO: end experiment


        this.$attachEventHandlers();
    }

    align() {
        var diffView = this;

        function add(session, w) {
            let lineWidget = session.lineWidgets[w.row];
            if (lineWidget) {
                w.rowsAbove += lineWidget.rowsAbove > w.rowsAbove ? lineWidget.rowsAbove : w.rowsAbove;
                w.rowCount += lineWidget.rowCount;
            }
            session.lineWidgets[w.row] = w;
            session.widgetManager.lineWidgets[w.row] = w;
        }

        function init(session) {
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                if (session.$editor) session.widgetManager.attach(session.$editor);
            }
            session.lineWidgets = [];
            session.widgetManager.lineWidgets = [];
            textLayer.element.innerHTML = "";
        }

        init(diffView.session.orig);
        init(diffView.session.edit);

        diffView.chunks.forEach(function (ch) {
            var diff1 = ch.old.end.row - ch.old.start.row;
            var diff2 = ch.new.end.row - ch.new.start.row;
            add(diffView.session.orig, {
                rowCount: diff2,
                rowsAbove: ch.old.end.row === 0 ? diff2 : 0,
                row: ch.old.end.row === 0 ? 0 : ch.old.end.row - 1
            });
            add(diffView.session.edit, {
                rowCount: diff1,
                rowsAbove: diff1,
                row: ch.new.start.row,
            });
        });
        diffView.session.orig["_emit"]("changeFold", {data: {start: {row: 0}}});
        diffView.edit.session["_emit"]("changeFold", {data: {start: {row: 0}}});
    }

    $attachEditorsEventHandlers() {
        this.$attachEditorEventHandlers(this.right, this.markerRight);
        this.session.orig.addDynamicMarker(this.markerLeft);
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

    onInput() {
        super.onInput();
    }
}

/**
 * @param {number} changes
 * @param {import("ace-code").VirtualRenderer} renderer
 */
function renderWidgets(changes, renderer) {
    var config = renderer.layerConfig;
    textLayer.element.style.top = `${config.offset}px`;

    function filterLines(lines, chunks) {
        const indicesToKeep = new Set();
        chunks.forEach(ch => {
            const start = ch.old.start.row;
            const end   = ch.old.end.row;
            for (let i = start; i < end; i++) {
                indicesToKeep.add(i);
            }
        });

        const filtered = lines.map((line, index) => {
            return indicesToKeep.has(index) ? line : [];
        });

        return filtered;
    }

    this.session.orig.bgTokenizer.lines = filterLines(this.session.orig.bgTokenizer.lines, this.chunks);
    textLayer.update(config);
    //TODO: force update after onInput

    markerLayer.setMarkers(this.session.orig.getMarkers());
    markerLayer.update(config);
}

exports.InlineDiffView = InlineDiffView;
