"use strict";

var oop = require("../lib/oop");
var TextMode = require("./text").Mode;
var gdResourceHighlightRules = require("./gdresource_highlight_rules").gdResourceHighlightRules;
var FoldMode = require("./folding/cstyle").FoldMode;

var Mode = function() {
    this.HighlightRules = gdResourceHighlightRules;
    this.foldingRules = new FoldMode();
};
oop.inherits(Mode, TextMode);

(function() {
    this.lineCommentStart = ";";
    // this.blockComment = {start: ""/*"", end: ""*/""};
    this.$id = "ace/mode/gdresource";
}).call(Mode.prototype);

exports.Mode = Mode;