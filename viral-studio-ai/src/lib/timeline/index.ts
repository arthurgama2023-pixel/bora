// packages/timeline (futuro) — núcleo do editor.
// types + ops são autocontidos; build/compile fazem a ponte com o pipeline.
export * from "./types";
export { applyTransaction, undoTransaction, validateDoc, recomputeDuration } from "./ops";
export { buildTimeline } from "./build";
export { compileSegments, compileCaptionWords, compileFilterStyle, timelineSummary } from "./compile";
