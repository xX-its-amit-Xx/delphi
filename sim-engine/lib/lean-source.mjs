// Re-export of the shared loader at lib/lean-source.mjs (repo root), which the hosted mcp/ server also
// imports. One implementation; this path exists so sim-engine code can import it locally.
export * from '../../lib/lean-source.mjs';
