"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;
var GDScriptHighlightRules = require("./gdscript_highlight_rules").GDScriptHighlightRules;
var GDShaderHighlightRules = require("./gdshader_highlight_rules").GDShaderHighlightRules;

var GDResourceHighlightRules = function() {

    this.$rules = {
        start: [{
            include: "#embedded_shader"
        }, {
            include: "#embedded_gdscript"
        }, {
            include: "#comment"
        }, {
            include: "#heading"
        }, {
            include: "#key_value"
        }],
        "#comment": [{
            token: [
                "punctuation.definition.comment.gdresource",
                "comment"
            ],
            regex: /(;)(.*$)/
        }],
        "#embedded_shader": [{
            token: ["text", "variable.other.property.gdresource", "text"],
            regex: /(\s*)(code)(\s*=\s*")/,
            push: "gdshader-start"
        }],
        "#embedded_gdscript": [{
            token: ["text", "variable.other.property.gdresource", "text"],
            regex: /(\s*)(script\/source)(\s*=\s*")/,
            push: "gdscript-start"
        }],
        "#heading": [{
            token: ["paren.lparen", "keyword.control.gdresource"],
            regex: /(\[)([a-z_]*)/,
            push: [{
                token: "paren.rparen",
                regex: /\]/,
                next: "pop"
            }, {
                include: "#heading_properties"
            }, {
                include: "#data"
            }]
        }],
        "#heading_properties": [{
            token: "invalid.illegal.noValue.gdresource",
            regex: /\s*[A-Za-z_\-][A-Za-z0-9_\-]*\s*=(?=\s*$)/
        }, {
            token: [
                "text",
                "variable.other.property.gdresource",
                "text",
                "punctuation.definition.keyValue.gdresource",
                "text"
            ],
            regex: /(\s*)([A-Za-z_-][^\s]*|".+"|'.+'|[0-9]+)(\s*)(=)(\s*)/,
            push: [{
                token: "text",
                regex: /^/,
                next: "pop"
            }, {
                token: "text",
                regex: /$|(?==)|\,?|\s*(?=\})/,
                next: "pop"
            }, {
                include: "#data"
            }]
        }],
        "#key_value": [{
            token: "invalid.illegal.noValue.gdresource",
            regex: /\s*[A-Za-z_\-][A-Za-z0-9_\-]*\s*=(?=\s*$)/
        }, {
            token: [
                "text",
                "variable.other.property.gdresource",
                "text",
                "punctuation.definition.keyValue.gdresource",
                "text"
            ],
            regex: /(\s*)([A-Za-z_-][^\s]*|".+"|'.+'|[0-9]+)(\s*)(=)(\s*)/,
            push: [{
                token: "text",
                regex: /^/,
                next: "pop"
            }, {
                token: "text",
                regex: /$|(?==)|\,|\s*(?=\})/,
                next: "pop"
            }, {
                include: "#data"
            }]
        }],
        "#data": [{
            include: "#comment"
        }, {
            token: [
                "paren.lparen",
                "text"
            ],
            regex: /(?<!\w)(\{)(\s*)/,
            push: [{
                token: [
                    "text",
                    "paren.rparen"
                ],
                regex: /(\s*)(\})(?!\w)/,
                next: "pop"
            }, {
                include: "#key_value"
            }, {
                include: "#data"
            }]
        }, {
            token: [
                "paren.lparen",
                "text"
            ],
            regex: /(?<!\w)(\[)(\s*)/,
            push: [{
                token: [
                    "text",
                    "paren.rparen"
                ],
                regex: /(\s*)(\])(?!\w)/,
                next: "pop"
            }, {
                include: "#data"
            }]
        }, {
            token: "string",
            regex: /"""/,
            push: [{
                token: "string",
                regex: /"""/,
                next: "pop"
            }, {
                token: "constant.character.escape.gdresource",
                regex: /\\(?:[btnfr"\\$\/ ]|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/
            }, {
                token: "invalid.illegal.escape.gdresource",
                regex: /\\[^btnfr\/"\\$]/
            }, {
                defaultToken: "string"
            }]
        }, {
            token: "support.function.any-method.gdresource",
            regex: /"res:\/\/[^"\\]*(?:\\.[^"\\]*)*"/
        }, {
            token: "support.class.library.gdresource",
            regex: /(?<=type=)"[^"\\]*(?:\\.[^"\\]*)*"/
        }, {
            token: "constant.character.escape.gdresource",
            regex: /(?<=NodePath\(|parent=|name=)"[^"\\]*(?:\\.[^"\\]*)*"/
        }, {
            token: "string",
            regex: /"/,
            push: [{
                token: "string",
                regex: /"/,
                next: "pop"
            }, {
                token: "constant.character.escape.gdresource",
                regex: /\\(?:[btnfr"\\$\/ ]|u[0-9A-Fa-f]{4}|U[0-9A-Fa-f]{8})/
            }, {
                token: "invalid.illegal.escape.gdresource",
                regex: /\\[^btnfr\/"\\$]/
            }, {
                defaultToken: "string"
            }]
        }, {
            token: "string",
            regex: /'.*?'/
        }, {
            token: "constant.language.gdresource",
            regex: /(?<!\w)(?:true|false)(?!\w)/
        }, {
            token: "constant.numeric.float.gdresource",
            regex: /(?<!\w)[\+\-]?(?:0|[1-9](?:(?:[0-9]|_[0-9])+)?)(?:(?:\.(?:0|[1-9](?:(?:[0-9]|_[0-9])+)?))?[eE][\+\-]?[1-9]_?[0-9]*|\.[0-9_]*)(?!\w)/
        }, {
            token: "constant.numeric.integer.gdresource",
            regex: /(?<!\w)[\+\-]?(?:0|[1-9](?:(?:[0-9]|_[0-9])+)?)(?!\w)/
        }, {
            token: "constant.numeric.inf.gdresource",
            regex: /(?<!\w)[\+\-]?inf(?!\w)/
        }, {
            token: "constant.numeric.nan.gdresource",
            regex: /(?<!\w)[\+\-]?nan(?!\w)/
        }, {
            token: "constant.numeric.hex.gdresource",
            regex: /(?<!\w)0x[0-9a-fA-F](?:(?:[0-9a-fA-F]|_[0-9a-fA-F])+)?(?!\w)/
        }, {
            token: "constant.numeric.oct.gdresource",
            regex: /(?<!\w)0o[0-7](?:_?[0-7])*(?!\w)/
        }, {
            token: "constant.numeric.bin.gdresource",
            regex: /(?<!\w)0b[01](?:_?[01])*(?!\w)/
        }, {
            token: [
                "support.class.library.gdresource",
                "paren.lparen",
                "text"
            ],
            regex: /(?<!\w)(Vector2|Vector2i|Vector3|Vector3i|Color|Rect2|Rect2i|Array|Basis|Dictionary|Plane|Quat|RID|Rect3|Transform|Transform2D|Transform3D|AABB|String|Color|NodePath|Object|PoolByteArray|PoolIntArray|PoolRealArray|PoolStringArray|PoolVector2Array|PoolVector3Array|PoolColorArray|bool|int|float|StringName|Quaternion|PackedByteArray|PackedInt32Array|PackedInt64Array|PackedFloat32Array|PackedFloat64Array|PackedStringArray|PackedVector2Array|PackedVector2iArray|PackedVector3Array|PackedVector3iArray|PackedColorArray)(\()(\s?)/,
            push: [{
                token: "paren.rparen",
                regex: /\s?\)/,
                next: "pop"
            }, {
                include: "#key_value"
            }, {
                include: "#data"
            }]
        }, {
            token: ["keyword.control.gdresource", "paren.lparen", "text"],
            regex: /(?<!\w)(ExtResource|SubResource)(\()(\s?)/,
            push: [{
                token: "paren.rparen",
                regex: /\s?\)/,
                next: "pop"
            }, {
                include: "#key_value"
            }, {
                include: "#data"
            }]
        }]
    };

    var gdshaderRules = new GDShaderHighlightRules().getRules();
    var shaderIncludePattern = /(#[ \t]*include)([ \t]+)("[^"\r\n]*")/.source;
    var shaderHintStringPattern = /"[^"\r\n]*"/.source;

    Object.keys(gdshaderRules).forEach(function(stateName) {
        gdshaderRules[stateName].forEach(function(rule) {
            var pattern = rule.regex && rule.regex.source;
            if (pattern === shaderIncludePattern) {
                rule.regex = /(#[ \t]*include)([ \t]+)(\\"[^"\r\n]*\\")/;
            } else if (pattern === shaderHintStringPattern) {
                rule.regex = /\\"[^"\r\n]*\\"/;
            }
        });
    });

    var endEmbeddedShader = function(currentState, stack) {
        stack.length = 0;
        return "start";
    };

    this.embedRules(gdshaderRules, "gdshader-", [{
        token: "text",
        regex: /(?<!\\)"/,
        next: endEmbeddedShader
    }]);

    var gdscriptRules = new GDScriptHighlightRules().getRules();
    var doubleQuotePattern = /((?:r)?)(")/.source;
    var tripleDoubleQuotePattern = /((?:r)?)(""")/.source;
    var doubleQuoteAtEolPattern = /"(?=$)/.source;
    var tripleDoubleQuoteAtEolPattern = /"""(?=$)/.source;
    var encodedDoubleStringStates = Object.create(null);
    var gdscriptEolStates = {
        "gdscript-signal_declaration": true,
        "gdscript-lambda_declaration": true,
        "gdscript-function_declaration": true,
        "gdscript-variable_declaration": true
    };

    var popEscapedStringAtEol = function(currentState, stack) {
        stack.shift();
        var parent = stack.shift() || "start";
        while (gdscriptEolStates[parent]) {
            stack.shift();
            parent = stack.shift() || "start";
        }
        return parent;
    };

    Object.keys(gdscriptRules).forEach(function(stateName) {
        var rules = gdscriptRules[stateName];
        for (var i = rules.length - 1; i >= 0; i--) {
            var rule = rules[i];
            var pattern = rule.regex && rule.regex.source;
            if (pattern === tripleDoubleQuotePattern) {
                rule.regex = /((?:r)?)((?:\\"){3})/;
                encodedDoubleStringStates[rule.nextState] = true;
            } else if (pattern === doubleQuotePattern || pattern === "\"" && rule.nextState) {
                rule.regex = pattern === doubleQuotePattern
                    ? /((?:r)?)(\\")/
                    : /\\"/;
                encodedDoubleStringStates[rule.nextState] = false;
            }
        }
    });

    Object.keys(encodedDoubleStringStates).forEach(function(stateName) {
        var isTripleQuoted = encodedDoubleStringStates[stateName];
        var rules = gdscriptRules[stateName];
        var hasEscapeRule = false;

        rules.forEach(function(rule) {
            var pattern = rule.regex && rule.regex.source;
            if (pattern === (isTripleQuoted ? tripleDoubleQuoteAtEolPattern : doubleQuoteAtEolPattern)) {
                rule.regex = isTripleQuoted ? /(?:\\"){3}(?=$)/ : /\\"(?=$)/;
                rule.next = popEscapedStringAtEol;
            } else if (pattern === (isTripleQuoted ? tripleDoubleQuotePattern : "\"")) {
                rule.regex = isTripleQuoted ? /(?:\\"){3}/ : /\\"/;
            } else if (pattern === /\\./.source) {
                // GDScript escapes such as \n, \", and \\ are themselves escaped by Variant serialization.
                rule.regex = /\\\\(?:\\\\|\\"|.)/;
                hasEscapeRule = true;
            }
        });

        if (!hasEscapeRule) {
            rules.splice(rules.length - 1, 0, {
                token: "constant.character.escape.gdscript",
                regex: /\\\\(?:\\\\|\\"|.)/
            });
        }
    });

    this.embedRules(gdscriptRules, "gdscript-", [{
        token: "text",
        regex: /"/,
        next: "pop"
    }], ["start"]);
    
    this.normalizeRules();
};

oop.inherits(GDResourceHighlightRules, TextHighlightRules);

exports.GDResourceHighlightRules = GDResourceHighlightRules;
