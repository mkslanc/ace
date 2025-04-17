var dom = require("ace/lib/dom");

const ChangeType = {
    Modify: 0,
    Add:    1,
    Delete: 2,
};

function getChangeType(change) { //TODO: different algorithm
    if (change.old.end.row === 0) {
        return ChangeType.Add;
    } else if (change.new.end.row === 0) {
        return ChangeType.Delete;
    } else {
        return ChangeType.Modify;
    }
}

class DirtyDiffDecorator {
    constructor(editor) {
        this.editor = editor;
        this.decorations = [];
        this.attachToEditor();
    }

    attachToEditor() {
        dom.addCssClass(
            this.editor.renderer.$gutterLayer.element,
            "ace_diff_gutter-enabled"
        );
        this.editor.renderer.on(
            "afterRender",
            this.renderGutters.bind(this)
        );
    }

    renderGutters(changes, renderer) {
        function extractCellsAndScheduleRerender(renderer) {
            const gutter = renderer.$gutterLayer;
            const gutterCells = gutter.$lines.cells;
            gutter.$padding = null;
            renderer.$loop.schedule(renderer.CHANGE_GUTTER);
            return gutterCells;
        }

        // Decide if we need to re-extract gutter cells
        if (arguments.length > 0) {
            const changed =
                (changes & renderer.CHANGE_LINES) ||
                (changes & renderer.CHANGE_FULL) ||
                (changes & renderer.CHANGE_SCROLL) ||
                (changes & renderer.CHANGE_TEXT);
            if (!changed) return;
            this.gutterCells = extractCellsAndScheduleRerender(renderer);
        } else if (!this.gutterCells) {
            if (!this.editor.renderer) return;
            this.gutterCells = extractCellsAndScheduleRerender(
                this.editor.renderer
            );
        }

        // Clear existing glyph classes
        for (const cell of this.gutterCells) {
            if (cell.glyph) {
                cell.glyph.className = "dirty-diff-glyph";
            }
        }

        // Render new decorations
        let di = 0;
        for (const cell of this.gutterCells) {
            const lineNo = cell.row + 1;
            while (
                di < this.decorations.length &&
                this.decorations[di].endLineNumber < lineNo
                ) {
                di++;
            }
            if (di >= this.decorations.length ||
                this.decorations[di].startLineNumber > lineNo) {
                this.removeGutter(cell);
                continue;
            }
            let inner = di;
            while (
                inner < this.decorations.length &&
                this.decorations[inner].startLineNumber <= lineNo &&
                this.decorations[inner].endLineNumber >= lineNo
                ) {
                this.addGutter(cell, this.decorations[inner].class);
                inner++;
            }
        }
    }

    addGutter(cell, cssClass) {
        if (!cell.glyph) {
            cell.glyph = cell.element.appendChild(
                dom.buildDom(["span", { class: "dirty-diff-glyph" }])
            );
        }
        cell.glyph.classList.add(cssClass);
    }

    removeGutter(cell) {
        if (!cell.glyph) return;
        cell.glyph.remove();
        delete cell.glyph;
    }

    setDecorations(changes) {
        this.decorations = changes.map(change => {
            const type = getChangeType(change);
            const start = change.new.start.row;
            const end = change.new.end.row || start;
            switch (type) {
                case ChangeType.Add:
                    return { startLineNumber: start, endLineNumber: end, class: "dirty-diff-added" };
                case ChangeType.Delete:
                    return { startLineNumber: start, endLineNumber: end, class: "dirty-diff-deleted" };
                case ChangeType.Modify:
                    return { startLineNumber: start, endLineNumber: end, class: "dirty-diff-modified" };
            }
        });
        this.renderGutters();
    }

    dispose() { //TODO: call it in dispose of diff view
        dom.removeCssClass(
            this.editor.renderer.$gutterLayer.element,
            "ace_diff_gutter-enabled"
        );
        this.editor.renderer.off( //TODO:
            "afterRender",
            this.renderGutters.bind(this)
        );
    }
}

exports.DirtyDiffDecorator = DirtyDiffDecorator;
