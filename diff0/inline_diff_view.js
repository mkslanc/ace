"use strict";

var LineWidgets = require("ace-code/src/line_widgets").LineWidgets;
var TextLayer = require("ace-code/src/layer/text").Text;
var MarkerLayer = require("ace-code/src/layer/marker").Marker;

const {BaseDiffView} = require("./base_diff_view");
const config = require("ace-code/src/config");

class InlineDiffView extends BaseDiffView {
    /**
     * Constructs a new inline DiffView instance.
     * @param {HTMLElement} element - The container element for the DiffView.
     * @param {Object} [diffModel] - The model for the diff view.
     * @param {import("ace-code").Editor} [diffModel.editorA] - The editor for the original view.
     * @param {import("ace-code").Editor} [diffModel.editorB] - The editor for the edited view.
     * @param {import("ace-code").EditSession} [diffModel.sessionA] - The edit session for the original view.
     * @param {import("ace-code").EditSession} [diffModel.sessionB] - The edit session for the edited view.
     * @param {string} [diffModel.valueA] - The original content.
     * @param {string} [diffModel.valueB] - The modified content.
     * @param {boolean} [diffModel.showSideA] - Whether to show the original view or modified view.
     */
    constructor(element, diffModel) {
        diffModel = diffModel || {};
        super(element, true);
        this.init(diffModel);
    }

    init(diffModel) {
        this.showSideA = diffModel.showSideA == undefined ? true : diffModel.showSideA;

        this.onInput = this.onInput.bind(this);
        this.onSelect = this.onSelect.bind(this);
        this.onAfterRender = this.onAfterRender.bind(this);

        this.$setupModels(diffModel);
        this.onChangeTheme();
        config.resetOptions(this);
        config["_signal"]("diffView", this);

        this.textLayerA = new TextLayer(this.editorB.renderer.content);
        this.textLayerA.setSession(this.diffSession.sessionA);
        this.textLayerA.setPadding(4);
        this.markerLayerA = new MarkerLayer(this.editorB.renderer.content);
        this.markerLayerA.setSession(this.diffSession.sessionA);
        this.markerLayerA.setPadding(4);
        // this.markerLayerA.element.style.position = "static"; //TODO: check for side effects
        
        this.markerLayerA.element.parentNode.insertBefore(
            this.markerLayerA.element,
            this.markerLayerA.element.parentNode.firstChild
        )

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

        var init = (session) => {
            if (!session.widgetManager) {
                session.widgetManager = new LineWidgets(session);
                if (session.$editor) session.widgetManager.attach(session.$editor);
            }
            session.lineWidgets = [];
            session.widgetManager.lineWidgets = [];
            this.textLayerA.element.innerHTML = "";
        };

        init(diffView.diffSession.sessionA);
        init(diffView.diffSession.sessionB);

        diffView.chunks.forEach(function (ch) {
            var diff1 = ch.old.end.row - ch.old.start.row;
            var diff2 = ch.new.end.row - ch.new.start.row;

            //TODO: diffView.showSideA is not used
            add(diffView.diffSession.sessionA, {
                rowCount: diff2,
                rowsAbove: ch.old.end.row === 0 ? diff2 : 0,
                row: ch.old.end.row === 0 ? 0 : ch.old.end.row - 1
            });
            add(diffView.diffSession.sessionB, {
                rowCount: diff1,
                rowsAbove: diff1,
                row: ch.new.start.row,
            });

        });
        diffView.diffSession.sessionA["_emit"]("changeFold", {data: {start: {row: 0}}});
        diffView.diffSession.sessionB["_emit"]("changeFold", {data: {start: {row: 0}}});
    }

    onSelect(e, selection) {
        var selectionRange = selection.getRange();
        this.findChunkIndex(this.chunks, selectionRange.start.row, false);
    }

    $attachSessionsEventHandlers() {
        this.$attachSessionEventHandlers(this.editorB, this.markerB);
        this.diffSession.sessionA.addDynamicMarker(this.markerA);
    }

    $attachSessionEventHandlers(editor, marker) {
        editor.session.addDynamicMarker(marker);
        editor.selection.on("changeCursor", this.onSelect);
        editor.selection.on("changeSelection", this.onSelect);
    }

    $detachSessionsEventHandlers() {
        this.$detachSessionEventHandlers(this.editorB, this.markerB);
        this.diffSession.sessionA.removeMarker(this.markerA.id);
    }

    $detachSessionEventHandlers(editor, marker) {
        editor.session.removeMarker(marker.id);
        editor.selection.off("changeCursor", this.onSelect);
        editor.selection.off("changeSelection", this.onSelect);
    }

    $attachEventHandlers() {
        this.editorB.on("input", this.onInput);
        this.editorB.renderer.on("afterRender", this.onAfterRender);
    }

    $detachEventHandlers() {
        this.$detachSessionsEventHandlers();
        this.editorB.off("input", this.onInput);
        this.editorB.renderer.off("afterRender", this.onAfterRender);

        this.editorB.renderer["$scrollDecorator"].zones = [];
        this.editorB.renderer["$scrollDecorator"].$updateDecorators(this.editorB.renderer.layerConfig);

        this.textLayerA.element.textContent = "";
        this.markerLayerA.element.textContent = "";
    }

    /**
     * @param {number} changes
     * @param {import("ace-code").VirtualRenderer} renderer
     */
    onAfterRender(changes, renderer) {
        var config = renderer.layerConfig;

        function filterLines(lines, chunks) {
            var i = 0;
            var nextChunkIndex = 0;

            var nextChunk = chunks[nextChunkIndex];
            nextChunkIndex++;
            var nextStart = nextChunk ? nextChunk.old.start.row : lines.length;
            var nextEnd = nextChunk ? nextChunk.old.end.row : lines.length;
            while (i < lines.length) {
                while (i < nextStart) {
                    if (lines[i] && lines[i].length) lines[i].length = 0;
                    i++;
                }
                while (i < nextEnd) {
                    if (lines[i] && lines[i].length == 0) lines[i] = undefined;
                    i++;
                }
                nextChunk = chunks[nextChunkIndex];
                nextChunkIndex++;
                nextStart = nextChunk ? nextChunk.old.start.row : lines.length;
                nextEnd = nextChunk ? nextChunk.old.end.row : lines.length;
            }
        }

        filterLines(this.diffSession.sessionA.bgTokenizer.lines, this.chunks);


        var session = this.diffSession.sessionA;

        session.$scrollTop = renderer.scrollTop;
        session.$scrollLeft = renderer.scrollLeft;

        var cloneRenderer = {
            scrollTop: renderer.scrollTop,
            scrollLeft: renderer.scrollLeft,
            $size: renderer.$size,
            session: session,
            $horizScroll: renderer.$horizScroll,
            $vScroll: renderer.$vScroll,
            $padding: renderer.$padding,
            scrollMargin: renderer.scrollMargin,
            characterWidth: renderer.characterWidth,
            lineHeight: renderer.lineHeight,
            $computeLayerConfig: renderer.$computeLayerConfig,
            $getLongestLine: renderer.$getLongestLine,
            scrollBarV: {
                setVisible: function () {}
            },
            layerConfig: renderer.layerConfig,
            $updateCachedSize: function () {},
            _signal: function () {},
        };

        cloneRenderer.$computeLayerConfig();

        console.log(config, cloneRenderer.layerConfig);
        var newConfig = cloneRenderer.layerConfig;
        newConfig.firstRowScreen = config.firstRowScreen;

        this.textLayerA.update(newConfig);

        this.markerLayerA.setMarkers(this.diffSession.sessionA.getMarkers());
        this.markerLayerA.update(newConfig);
    }

}



exports.InlineDiffView = InlineDiffView;
