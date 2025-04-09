var Range = require("ace-code/src/range").Range;

class AceDiff {
    constructor(originalRange, modifiedRange, charChanges) {
        this.old = originalRange;
        this.new = modifiedRange;
        this.charChanges = charChanges && charChanges.map(m => new AceDiff(
            new Range(m.originalStartLineNumber, m.originalStartColumn,
                m.originalEndLineNumber, m.originalEndColumn
            ), new Range(m.modifiedStartLineNumber, m.modifiedStartColumn,
                m.modifiedEndLineNumber, m.modifiedEndColumn
            )));
    }

    /**
     *
     * @param {string} dir
     * @return {Range}
     */
    getChangeRange(dir) {
        return this[dir];
    }

    padCenter(str, length) {
        const totalPadding = length - str.length;
        const leftPadding = Math.floor(totalPadding / 2);
        const rightPadding = totalPadding - leftPadding;
        return ' '.repeat(leftPadding) + str + ' '.repeat(rightPadding);
    }

    rangeToString(range, columnWidths) {
        const startRow = this.padCenter(String(range.start.row), columnWidths[0]);
        const startColumn = this.padCenter(String(range.start.column), columnWidths[1]);
        const endRow = this.padCenter(String(range.end.row), columnWidths[2]);
        const endColumn = this.padCenter(String(range.end.column), columnWidths[3]);
        return `${startRow}${startColumn}${endRow}${endColumn}`;
    }

    toString() {
        const columnWidths = [12, 14, 12, 14];
        let result = "Original Range                                       | Modified Range\n";
        result += " Start Row    Start Column    End Row    End Column   | Start Row    Start Column    End Row    End Column\n";
        result += "-----------------------------------------------------|----------------------------------------------------\n";
        result += `${this.rangeToString(this.old, columnWidths)} | ${this.rangeToString(this.new, columnWidths)}\n`;

        if (this.charChanges) {
            result += "\nCharacter Changes:\n";
            result += " Start Row    Start Column    End Row    End Column   | Start Row    Start Column    End Row    End Column\n";
            result += "-----------------------------------------------------|----------------------------------------------------\n";
            for (const change of this.charChanges) {
                result += `${this.rangeToString(change.old, columnWidths)} | ${this.rangeToString(
                    change.new, columnWidths)}\n`;
            }
        }
        result += "-----------------------------------------------------|----------------------------------------------------\n";
        result += "\n\n";
        return result;
    }
}

class DiffHighlight {
    /**
     * @param {import("./base_diff_view").BaseDiffView} diffView
     * @param type
     */
    constructor(diffView, type) {
        this.diffView = diffView;
        this.type = type;
    }

    static MAX_RANGES = 500;

    update(html, markerLayer, session, config) {
        let side, dir, operation, opOperation;
        if (this.type === -1) {// original editor
            side = "left";
            dir = "old";
            operation = "delete";
            opOperation = "insert";
            //TODO: experiment
            markerLayer = this.diffView.markerLayer;
        }
        else { //modified editor
            side = "right";
            dir = "new";
            operation = "insert";
            opOperation = "delete";
        }

        var diffView = this.diffView;
        var ignoreTrimWhitespace = diffView.options.ignoreTrimWhitespace;
        var lineChanges = diffView.chunks;
        //TODO: experiment
        let editor = diffView["right"];

        /*if (editor.session.lineWidgets) {
            let ranges = editor.session.lineWidgets.reduce((allRanges, lineWidget, row) => {
                if (!lineWidget) {
                    console.log("Shouldn't get here");
                    return allRanges;
                }

                if (lineWidget.hidden)
                    return allRanges;

                let start = editor.session.documentToScreenRow(row, 0);

                if (lineWidget.rowsAbove > 0) {
                    start -= lineWidget.rowsAbove;
                } else {
                    start++;
                }
                let end = start + lineWidget.rowCount - 1;

                allRanges.push(new Range(start, 0, end, 1 << 30));
                return allRanges;
            }, []);

            ranges.forEach((range) => {
                markerLayer.drawFullLineMarker(html, range, "ace_diff aligned_diff inline", config);
            })
        }*/

        editor.renderer.$scrollDecorator.zones = [];
        lineChanges.forEach((lineChange) => {
            let startRow = lineChange[dir].start.row;
            let endRow = lineChange[dir].end.row;
            let range = new Range(startRow, 0, endRow - 1, 1 << 30);
            editor.renderer.$scrollDecorator.addZone(range.start.row, range.end.row, operation);
            if (startRow !== endRow) {
                range = range.toScreenRange(session);
                markerLayer.drawFullLineMarker(html, range, "ace_diff " + operation + " inline", config);
            }

            if (lineChange.charChanges) {
                for (const charChange of lineChange.charChanges) {
                    if (ignoreTrimWhitespace) {
                        for (let lineNumber = charChange[dir].start.row;
                             lineNumber <= charChange[dir].end.row; lineNumber++) {
                            let startColumn;
                            let endColumn;
                            let sessionLineStart = session.getLine(lineNumber).match(/^\s*/)[0].length;
                            let sessionLineEnd = session.getLine(lineNumber).length;

                            if (lineNumber === charChange[dir].start.row) {
                                startColumn = charChange[dir].start.column;
                            }
                            else {
                                startColumn = sessionLineStart;
                            }
                            if (lineNumber === charChange[dir].end.row) {
                                endColumn = charChange[dir].end.column;
                            }
                            else {
                                endColumn = sessionLineEnd;
                            }
                            let range = new Range(lineNumber, startColumn, lineNumber, endColumn);
                            var screenRange = range.toScreenRange(session);

                            if (sessionLineStart === startColumn && sessionLineEnd === endColumn) {
                                continue;
                            }

                            let cssClass = "inline " + operation;
                            if (range.isEmpty() && startColumn !== 0) {
                                cssClass = "inline " + opOperation + " empty";
                            }

                            markerLayer.drawSingleLineMarker(html, screenRange, "ace_diff " + cssClass, config);
                        }
                    }
                    else {
                        let range = new Range(charChange[dir].start.row, charChange[dir].start.column,
                            charChange[dir].end.row, charChange[dir].end.column
                        );
                        var screenRange = range.toScreenRange(session);
                        let cssClass = "inline " + operation;
                        if (range.isEmpty() && charChange[dir].start.column !== 0) {
                            cssClass = "inline empty " + opOperation;
                        }

                        if (screenRange.isMultiLine()) {
                            markerLayer.drawTextMarker(html, range, "ace_diff " + cssClass, config);
                        }
                        else {
                            markerLayer.drawSingleLineMarker(html, screenRange, "ace_diff " + cssClass, config);
                        }
                    }
                }
            }
        });
        //TODO: hack for decorators to be forcely updated until we got new change type in VirtualRenderer
        editor.renderer.$scrollDecorator.$updateDecorators(config);
    }
}

/**
 *
 * @param {AceDiff[]} chunks
 * @param {number} row
 * @param {boolean} isOrig
 * @return {number}
 */
function findChunkIndex(chunks, row, isOrig) {
    for (var i = 0; i < chunks.length; i++) {
        var ch = chunks[i];
        var chunk = isOrig ? ch.old : ch.new;
        if (chunk.end.row < row) continue;
        if (chunk.start.row > row) break;
    }

    return i - 1;
}

exports.AceDiff = AceDiff;
exports.DiffHighlight = DiffHighlight;
exports.findChunkIndex = findChunkIndex;