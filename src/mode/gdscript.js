"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var GDScriptHighlightRules = require("./gdscript_highlight_rules").GDScriptHighlightRules;
var FoldMode = require("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = GDScriptHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "#";
    this.$id = "ace/mode/gdscript";
}).call(Mode.prototype);

exports.Mode = Mode;