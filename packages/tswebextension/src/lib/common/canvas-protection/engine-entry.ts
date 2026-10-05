// The engine is injected into every page as code text, so its size matters.
// Its modules export plain functions instead of static classes, unlike the rest of the project:
// terser renames and drops unused module-level functions, but keeps method names and unused methods.
export { bootstrapCanvasProtection } from './bootstrap';
