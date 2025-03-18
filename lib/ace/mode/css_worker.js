define(function(require, exports, module) {
"use strict";

var oop = require("../lib/oop");
var lang = require("../lib/lang");
var CssService = require("./css/css-service").CssService;

class Worker {
    constructor(sender) {
        this.sender = sender;
        this.setTimeout(400);

        this.service = new CssService("css"); //TODO: we could provide it for scss and less also
        this.defaultFileUri = "file://session1.css";
        var deferredUpdate = this.deferredUpdate = lang.delayedCall(this.onUpdate.bind(this));

        this.service.addDocument({uri: this.defaultFileUri, languageId: "css", version: 1, text: "" });

        var _self = this;
        sender.on("change", (e) => {
            var data = e.data;
            if (data[0].start) {
                //TODO:
                this.service.applyDeltas({uri: this.defaultFileUri}, data.map((el) => fromAceDelta(el, "\n")));
            } else {
                for (var i = 0; i < data.length; i += 2) {
                    var d, err;
                    if (Array.isArray(data[i+1])) {
                        d = {action: "insert", start: data[i], lines: data[i+1]};
                    } else {
                        d = {action: "remove", start: data[i], end: data[i+1]};
                    }

                    var doc = this.service.getDocument(this.defaultFileUri);
                    if ((d.action == "insert" ? d.start : d.end).row >= doc.lineCount) {
                        err = new Error("Invalid delta");
                        err.data = {
                            path: _self.$path,
                            linesLength: doc.lineCount,
                            start: d.start,
                            end: d.end
                        };
                        throw err;
                    }//TODO:
                    this.service.applyDeltas({uri: this.defaultFileUri}, [fromAceDelta(d, "\n")]);
                    console.log(doc);
                }
            }
            if (_self.$timeout)
                return deferredUpdate.schedule(_self.$timeout);
            _self.onUpdate();
        });
    }
    setValue(value) {
        this.service.setValue({uri: this.defaultFileUri}, value);
        this.deferredUpdate.schedule(this.$timeout);
    }

    async onUpdate() {
        var result = await this.service.doValidation({uri: this.defaultFileUri})
        this.sender.emit("annotate", toAnnotations(result));
    }

    setTimeout(timeout) {
        this.$timeout = timeout;
    };
}

    function fromAceDelta(delta, eol) {
        if (delta.action === "insert") {
            const text = delta.lines && delta.lines.length > 1 ? delta.lines.join(eol) : delta.lines[0];
            return {
                range: rangeFromPositions(fromPoint(delta.start), fromPoint(delta.start)),
                text: text
            };
        } else {
            return {
                range: rangeFromPositions(fromPoint(delta.start), fromPoint(delta.end)),
                text: ""
            }
        }
    }

    function rangeFromPositions(start, end) {
        return {
            start: start,
            end: end
        }
    }

    function fromPoint(point) {
        return {line: point.row, character: point.column}
    }

    function toAnnotations(diagnostics) {
        return diagnostics && diagnostics.map((el) => {
            return {
                row: el.range.start.line,
                column: el.range.start.character,
                text: el.message,
                type: el.severity === 1 ? "error" : el.severity === 2 ? "warning" : "info",
                code: el.code
            };
        });
    }


    exports.Worker = Worker;

});
