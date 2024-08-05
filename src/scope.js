"use strict";

class Scope extends String {
    /**
     * @param {any} name
     * @param {Scope} [parent]
     */
    constructor(name, parent) {
        super(name);
        this.name = this.toString();
        this.children = {};
        this.parent = parent;
        this.data = name;
    }

    /**
     * @param {any} name
     * @param {string|undefined} [extraId]
     */
    get(name, extraId) {
        var id = "" + name + (extraId || "");
        if (this.children[id]) {
            return this.children[id];
        }
        this.children[id] = new Scope(name, this);
        if (extraId) {
            this.children[id].data = extraId;
        }
        return this.children[id];
    }
    
    find(states) {
        var s = this;
        while (s && !states[s.name]) {
            s = s.parent;
        }
        return states[s ? s.name : "start"];
    }

    hasParent(states) {
        var s = this;
        while (s && states !== s.name) {
            s = s.parent;
        }
        return s ? 1 : -1;
    }

    count() {
        var s = 1;
        for (var i in this.children) s += this.children[i].count();
        return s;
    }

    /**
     *
     * @returns {string[]}
     */
    getAllScopeNames() {
        var scopeNames = [];
        var self = this;
        do {
            scopeNames.push(self.name);
        } while (self = self.parent);
        return scopeNames;
    }

    toStack() {
        var stack = [];
        var self = this;
        do {
            stack.push(self.data);
        } while (self = self.parent);
        return stack;
    }
}

exports.Scope = Scope;
