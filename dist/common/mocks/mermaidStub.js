"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mermaid = {
    initialize: () => {
        // Mermaid rendering is disabled for this environment.
    },
    parse(_definition) {
        // Mock parse method that always succeeds
        // In real mermaid, this validates the diagram syntax
        return Promise.resolve();
    },
    render(id, _definition) {
        return Promise.resolve({
            svg: `<svg id="${id}" xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>`,
            bindFunctions: () => {
                // no-op
            },
        });
    },
};
exports.default = mermaid;
//# sourceMappingURL=mermaidStub.js.map