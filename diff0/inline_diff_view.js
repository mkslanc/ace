"use strict";

var dom = require("ace-code/src/lib/dom");

var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;

var TextLayer = require("ace-code/src/layer/text").Text;
var MarkerLayer = require("ace-code/src/layer/marker").Marker;
var textLayer, markerLayer;

const {BaseDiffView} = require("./base_diff_view");
const {DiffHighlight} = require("./ace_diff");

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
        this.edit.renderer.on("afterRender", renderWidgets);
        textLayer.setSession(this.session.orig);
        textLayer.setPadding(4);


        //TODO: start experiment
        markerLayer = this.markerLayer = new MarkerLayer(this.right.renderer.content);
        this.markerLayer.setSession(this.session.orig);
        this.markerLayer.setPadding(4);

        this.markerLeft = new DiffHighlight(this, -1);
        //TODO: end experiment


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
            textLayer.element.innerHTML = "";
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
        //TODO: start experiment
        editor.renderer.session1 = this.session.orig; //TODO: this is just for test
        this.session.orig.addDynamicMarker(this.markerLeft);
        //TODO: end experiment
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
            w.customEl = dom.buildDom(["div", {class: "ace_diff_widgets"}], textLayer.element);
            w.customEl.style.position = "absolute";
            w.customEl.style.zIndex = "5";
            //TODO::::: !!!!!
            for (let j = w.firstLine; j < w.lastLine; j++) {
                let child = dom.createElement("div");
                child.style.height = config.lineHeight + "px";
                w.customEl.appendChild(child);
                textLayer.$renderLine(child, j);
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

    }
    //TODO: start experiment
    textLayer.element.style.top = `${config.offset}px`;
    markerLayer.element.style.top = `${config.offset}px`;

    markerLayer.setMarkers(renderer.session1.getMarkers());
    let newConfig = {...config};
    //newConfig.offset = 0;
    newConfig.firstRowScreen = config.firstRowScreen - (lineWidgets[0].lastLine - lineWidgets[0].firstLine);
    markerLayer.update(newConfig);
    //TODO: end experiment
}

exports.InlineDiffView = InlineDiffView;
