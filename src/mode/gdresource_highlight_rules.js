"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var gdResourceHighlightRules = function() {

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
        "#embedded_shader": [{ //TODO: link to shader
            token: [
                "variable.other.property.gdresource",
                "meta.embedded.block.gdshader"
            ],
            regex: /(code)( = ")/,
            push: [{
                token: "meta.embedded.block.gdshader",
                regex: /"/,
                next: "pop"
            }, {
                include: "source.gdshader"
            }, {
                defaultToken: "meta.embedded.block.gdshader"
            }]
        }],
        "#embedded_gdscript": [{ //TODO: link to script
            token: ["variable.other.property.gdresource", "text"],
            regex: /(script\/source)( = ")/,
            push: [{
                token: "text",
                regex: /"/,
                next: "pop"
            }, {
                include: "source.gdscript"
            }],
            comment: "meta.embedded.block.gdscript"
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
    
    this.normalizeRules();
};

oop.inherits(gdResourceHighlightRules, TextHighlightRules);

exports.gdResourceHighlightRules = gdResourceHighlightRules;