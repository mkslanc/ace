"use strict";

var oop = require("../lib/oop");
var TextHighlightRules = require("./text_highlight_rules").TextHighlightRules;

var GDShaderHighlightRules = function() {
    this.$rules = {
        start: [{
            include: "#any"
        }],
        "#any": [{
            include: "#comment"
        }, {
            include: "#preprocessorInclude"
        }, {
            include: "#hintEnum"
        }, {
            include: "#enclosed"
        }, {
            include: "#classifier"
        }, {
            include: "#definition"
        }, {
            include: "#keyword"
        }, {
            include: "#element"
        }, {
            include: "#separator"
        }, {
            include: "#operator"
        }],
        "#comment": [{
            include: "#commentLine"
        }, {
            include: "#commentBlock"
        }],
        "#commentLine": [{
            token: "comment",
            regex: /\/\//,
            push: [{
                token: "comment",
                regex: /$/,
                next: "pop"
            }, {
                defaultToken: "comment"
            }]
        }],
        "#commentBlock": [{
            token: "comment",
            regex: /\/\*/,
            push: [{
                token: "comment",
                regex: /\*\//,
                next: "pop"
            }, {
                defaultToken: "comment"
            }]
        }],
        "#preprocessorInclude": [{
            token: [
                "keyword.control.directive.gdshader",
                "text",
                "string"
            ],
            regex: /(#[ \t]*include)([ \t]+)("[^"\r\n]*")/
        }],
        "#hintEnum": [{
            token: [
                "support.type.annotation.gdshader",
                "text",
                "paren.lparen"
            ],
            regex: /(\bhint_enum\b)(\s*)(\()/,
            push: [{
                token: "paren.rparen",
                regex: /\)/,
                next: "pop"
            }, {
                token: "string",
                regex: /"[^"\r\n]*"/
            }, {
                include: "#comment"
            }, {
                include: "#separatorComma"
            }, {
                defaultToken: "text"
            }]
        }],
        "#enclosed": [{
            token: "paren.lparen",
            regex: /\(/,
            push: [{
                token: "paren.rparen",
                regex: /\)/,
                next: "pop"
            }, {
                include: "#any"
            }, {
                defaultToken: "text"
            }]
        }],
        "#classifier": [{
            token: "meta.classifier.gdshader",
            regex: /(?=\b(?:shader_type|render_mode)\b)/,
            push: [{
                token: "meta.classifier.gdshader",
                regex: /(?<=;)/,
                next: "pop"
            }, {
                include: "#comment"
            }, {
                include: "#keyword"
            }, {
                include: "#identifierClassification"
            }, {
                include: "#separator"
            }, {
                defaultToken: "meta.classifier.gdshader"
            }]
        }],
        "#classifierKeyword": [{
            token: "keyword.language.classifier.gdshader",
            regex: /\b(?:shader_type|render_mode)\b/
        }],
        "#identifierClassification": [{
            token: "entity.other.inherited-class.gdshader",
            regex: /\b[a-z_]+\b/
        }],
        "#definition": [{
            include: "#structDefinition"
        }],
        "#arraySize": [{
            token: "paren.lparen",
            regex: /\[/,
            push: [{
                token: "paren.rparen",
                regex: /\]/,
                next: "pop"
            }, {
                include: "#comment"
            }, {
                include: "#keyword"
            }, {
                include: "#element"
            }, {
                include: "#separator"
            }, {
                defaultToken: "text"
            }]
        }],
        "#structDefinition": [{
            token: "text",
            regex: /(?=\bstruct\b)/,
            push: [{
                token: "text",
                regex: /(?<=;)/,
                next: "pop"
            }, {
                include: "#comment"
            }, {
                include: "#keyword"
            }, {
                include: "#structName"
            }, {
                include: "#structDefinitionBlock"
            }, {
                include: "#separator"
            }]
        }],
        "#structKeyword": [{
            token: "keyword.other.struct.gdshader",
            regex: /\bstruct\b/
        }],
        "#structName": [{
            token: "entity.name.type.struct.gdshader",
            regex: /\b[a-zA-Z_]\w*\b/
        }],
        "#structDefinitionBlock": [{
            token: "paren.lparen",
            regex: /\{/,
            push: [{
                token: "paren.rparen",
                regex: /\}/,
                next: "pop"
            }, {
                include: "#comment"
            }, {
                include: "#precisionKeyword"
            }, {
                include: "#fieldDefinition"
            }, {
                include: "#keyword"
            }, {
                include: "#any"
            }, {
                defaultToken: "text"
            }]
        }],
        "#fieldDefinition": [{
            token: [
                "support.type.gdshader",
                "entity.name.type.gdshader"
            ],
            regex: /\b(?:(void|bool|[biu]?vec[234]|u?int|float|mat[234]|[iu]?sampler(?:3D|2D(?:Array)?)|samplerCube)|([a-zA-Z_]\w*))\b/,
            push: [{
                token: "meta.definition.field.gdshader",
                regex: /(?<=;)/,
                next: "pop"
            }, {
                include: "#comment"
            }, {
                include: "#keyword"
            }, {
                include: "#arraySize"
            }, {
                include: "#fieldName"
            }, {
                include: "#any"
            }, {
                defaultToken: "text"
            }]
        }],
        "#fieldName": [{
            token: "entity.name.variable.field.gdshader",
            regex: /\b[a-zA-Z_]\w*\b/
        }],
        "#keyword": [{
            include: "#classifierKeyword"
        }, {
            include: "#structKeyword"
        }, {
            include: "#controlKeyword"
        }, {
            include: "#modifierKeyword"
        }, {
            include: "#precisionKeyword"
        }, {
            include: "#typeKeyword"
        }, {
            include: "#hintKeyword"
        }],
        "#controlKeyword": [{
            token: "keyword.control.gdshader",
            regex: /\b(?:if|else|do|while|for|continue|break|switch|case|default|return|discard)\b/
        }],
        "#modifierKeyword": [{
            token: "storage.modifier.gdshader",
            regex: /\b(?:const|global|instance|uniform|varying|in|out|inout|flat|smooth)\b/
        }],
        "#precisionKeyword": [{
            token: "storage.type.built-in.primitive.precision.gdshader",
            regex: /\b(?:low|medium|high)p\b/
        }],
        "#typeKeyword": [{
            token: "support.type.gdshader",
            regex: /\b(?:void|bool|[biu]?vec[234]|u?int|float|mat[234]|[iu]?sampler(?:3D|2D(?:Array)?)|samplerCube)\b/
        }],
        "#hintKeyword": [{
            token: "support.type.annotation.gdshader",
            regex: /\b(?:source_color|hint_(?:color|range|(?:black_)?albedo|normal|(?:default_)?(?:white|black)|aniso|anisotropy|roughness_(?:[rgba]|normal|gray))|filter_(?:nearest|linear)(?:_mipmap(?:_anisotropic)?)?|repeat_(?:en|dis)able)\b/
        }],
        "#element": [{
            include: "#literalFloat"
        }, {
            include: "#literalInt"
        }, {
            include: "#literalBool"
        }, {
            include: "#identifierType"
        }, {
            include: "#constructor"
        }, {
            include: "#processorFunction"
        }, {
            include: "#identifierFunction"
        }, {
            include: "#swizzling"
        }, {
            include: "#identifierField"
        }, {
            include: "#constantFloat"
        }, {
            include: "#languageVariable"
        }, {
            include: "#identifierVariable"
        }],
        "#literalFloat": [{
            token: "constant.numeric.float.gdshader",
            regex: /\b(?:\d+[eE][-+]?\d+|(?:\d*[.]\d+|\d+[.])(?:[eE][-+]?\d+)?)[fF]?/
        }],
        "#literalInt": [{
            token: "constant.numeric.integer.gdshader",
            regex: /\b(?:0[xX][0-9A-Fa-f]+|\d+[uU]?)\b/
        }],
        "#literalBool": [{
            token: "constant.language.boolean.gdshader",
            regex: /\b(?:false|true)\b/
        }],
        "#identifierType": [{
            token: "entity.name.type.gdshader",
            regex: /\b[a-zA-Z_]\w*(?=(?:\s*\[\s*\w*\s*\])?\s+[a-zA-Z_]\w*\b)/
        }],
        "#constructor": [{
            token: "entity.name.type.constructor.gdshader",
            regex: /\b[a-zA-Z_]\w*(?=\s*\[\s*\w*\s*\]\s*[(])|\b[A-Z]\w*(?=\s*[(])/
        }],
        "#processorFunction": [{
            token: "support.function.gdshader",
            regex: /\b(?:vertex|fragment|light|start|process|sky|fog)(?=(?:\s|\/\*(?:\*(?!\/)|[^*])*\*\/)*[(])/
        }],
        "#identifierFunction": [{
            token: "entity.name.function.gdshader",
            regex: /\b[a-zA-Z_]\w*(?=(?:\s|\/\*(?:\*(?!\/)|[^*])*\*\/)*[(])/
        }],
        "#swizzling": [{
            token: [
                "punctuation.accessor.gdshader",
                "text",
                "variable.other.property.gdshader"
            ],
            regex: /([.])(\s*)([xyzw]{2,4}|[rgba]{2,4}|[stpq]{2,4})\b/
        }],
        "#identifierField": [{
            token: [
                "punctuation.accessor.gdshader",
                "text",
                "entity.name.variable.field.gdshader"
            ],
            regex: /([.])(\s*)([a-zA-Z_]\w*)\b(?!\s*\()/
        }],
        "#constantFloat": [{
            token: "constant.language.float.gdshader",
            regex: /\b(?:E|PI|TAU)\b/
        }],
        "#languageVariable": [{
            token: "variable.language.gdshader",
            regex: /\b[A-Z][A-Z_0-9]*\b/
        }],
        "#identifierVariable": [{
            token: "variable.name.gdshader",
            regex: /\b[a-zA-Z_]\w*\b/
        }],
        "#separator": [{
            token: "punctuation.accessor.gdshader",
            regex: /[.]/
        }, {
            include: "#separatorComma"
        }, {
            token: "punctuation.terminator.statement.gdshader",
            regex: /[;]/
        }, {
            token: "keyword.operator.type.annotation.gdshader",
            regex: /[:]/
        }],
        "#separatorComma": [{
            token: "punctuation.separator.comma.gdshader",
            regex: /[,]/
        }],
        "#operator": [{
            token: "keyword.operator.gdshader",
            regex: /\<\<\=?|\>\>\=?|[-+*\/&|<>=!]\=|\&\&|[|][|]|[-+~!*\/%<>&^|=]/
        }]
    };
    
    this.normalizeRules();
};

oop.inherits(GDShaderHighlightRules, TextHighlightRules);

exports.GDShaderHighlightRules = GDShaderHighlightRules;
