"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var GDShaderHighlightRules = require("./gdshader_highlight_rules").GDShaderHighlightRules;
var FoldMode = require("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = GDShaderHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = "//";
    this.blockComment = {start: "/*", end: "*/"};
    this.$id = "ace/mode/gdshader";
}).call(Mode.prototype);

exports.Mode = Mode;