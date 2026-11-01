// Link to the geometry side of part edits: dashboard/public/blueprint3d/partedit.js (pure ESM, owned by the
// partedit thread). organism.mjs validates targets and lists geometric params through THIS file, so the MCP
// server and the browser accept exactly the same part ids and params. dashboard/build-engine.mjs writes a
// browser copy of this link that points at ../../partedit.js (the same file, served next to engine/).
export { resolveTarget, editableParams, metresPerUnit } from '../../dashboard/public/blueprint3d/partedit.js';
