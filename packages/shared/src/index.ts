// =============================================================================
// Contextual - Shared Types & API Contract
// =============================================================================
// This file defines the contract between the React annotation component
// and the local context server. Both packages depend on these types.
//
// Session 4: Added Pass, Instruction, ParsedAction, PreAttachedSnippet types
// for queue-based Instruct mode and pass persistence. Widened source/type
// fields from ContextType to string for protocol/UX separation.
// =============================================================================

// -----------------------------------------------------------------------------
// Context Types
// -----------------------------------------------------------------------------

/** The five local context repository types */
export type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders';

/** All valid local context types */
export const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
];

/** How much context depth to return. Lighter = fewer tokens = cheaper. */
export type ResolutionDepth = 'light' | 'standard' | 'detailed' | 'full';

/** Annotation mode: Instruct writes refinement instructions, Inspect shows decision trail */
export type AnnotationMode = 'instruct' | 'inspect';

// -----------------------------------------------------------------------------
// @Mention Types (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * A parsed @mention from an annotation string.
 * @deprecated Use ParsedAction for new code. ParsedMention restricts type to ContextType.
 */
export interface ParsedMention {
  /** The context type (e.g., "research", "taste") */
  type: ContextType;
  /** The search query within brackets (e.g., "user save button") */
  query: string;
  /** Start index in the original annotation string */
  startIndex: number;
  /** End index in the original annotation string */
  endIndex: number;
}

// -----------------------------------------------------------------------------
// Parsed Actions (Session 4 - open namespace)
// -----------------------------------------------------------------------------

/**
 * A parsed @source[instruction] directive from annotation text.
 * Unlike ParsedMention, source is a string -- accepts any @source, not just
 * the 5 local ContextType values. This is the protocol/UX separation:
 * the parser accepts anything, autocomplete suggests configured tools.
 */
export interface ParsedAction {
  /** The @mention source (any string: "research", "posthog", "figma", etc.) */
  source: string;
  /** The directive inside brackets (e.g., "find proof that trust indicators boost CTA conversion") */
  instruction: string;
  /** Start index in the original annotation string */
  startIndex: number;
  /** End index in the original annotation string */
  endIndex: number;
}

// -----------------------------------------------------------------------------
// Element Targeting
// -----------------------------------------------------------------------------

/** How the user selected the element */
export type SelectionMode = 'click' | 'highlight' | 'drag-select';

/** A bounding box for spatial context */
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Information about the targeted UI element */
export interface TargetedElement {
  /** CSS selector that identifies this element */
  selector: string;
  /** Human-readable label (button text, alt text, tag + class) */
  label: string;
  /** How the element was selected */
  selectionMode: SelectionMode;
  /** Bounding box in viewport coordinates */
  boundingBox: BoundingBox;
  /** If text was highlighted, the exact selected text */
  selectedText?: string;
  /** The element's tag name */
  tagName: string;
}

// -----------------------------------------------------------------------------
// Annotation (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * A complete annotation combining element + text + parsed mentions.
 * @deprecated Use QueuedInstruction for new queue-based flow.
 */
export interface Annotation {
  /** Unique ID for this annotation */
  id: string;
  /** The targeted element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer */
  rawText: string;
  /** Parsed @mentions extracted from the annotation text */
  mentions: ParsedMention[];
  /** Desired resolution depth */
  depth: ResolutionDepth;
  /** ISO timestamp */
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Instructions & Passes (Session 4 - queue-based Instruct mode)
// -----------------------------------------------------------------------------

/**
 * A pre-attached context snippet included in the pass record at submit time.
 * Stored so later analysis can determine what context the system handed the
 * agent, not just what the user asked for.
 */
export interface PreAttachedSnippet {
  /** Context type or tool source (e.g., "research", "posthog") */
  type: string;
  /** The query that produced this snippet */
  query: string;
  /** The matched content text */
  content: string;
  /** File path or origin (e.g., "research/checkout-friction.md") */
  source: string;
}

/**
 * An instruction in a submitted pass. This is the persisted form --
 * what gets written to /passes JSON files.
 */
export interface Instruction {
  /** The targeted UI element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer (including @mentions) */
  rawText: string;
  /** Parsed @source[instruction] directives */
  actions: ParsedAction[];
  /** Local context snippets that were pre-attached at submit time */
  preAttachedContext: PreAttachedSnippet[];
}

/**
 * A queued instruction in the annotation queue (in-memory, pre-submission).
 * Has an ID for queue management and resolved context for preview display.
 */
export interface QueuedInstruction {
  /** Unique ID for queue management */
  id: string;
  /** The targeted UI element */
  element: TargetedElement;
  /** The raw annotation text as typed by the designer */
  rawText: string;
  /** Parsed @source[instruction] directives */
  actions: ParsedAction[];
  /** ISO timestamp when added to queue */
  createdAt: string;
}

/**
 * A submitted pass -- the entire annotation queue processed as a unit.
 * Written as a timestamped JSON file to /passes on submit.
 */
export interface Pass {
  /** Unique ID (uuid or timestamp-based) */
  id: string;
  /** ISO 8601 timestamp */
  timestamp: string;
  /** Resolution depth (optional, defaults to 'standard') */
  depth?: ResolutionDepth;
  /** All instructions in the pass */
  instructions: Instruction[];
}

// -----------------------------------------------------------------------------
// API: POST /resolve
// -----------------------------------------------------------------------------

/**
 * A single mention to resolve against the local context index.
 * Type is string (not ContextType) -- the server resolves what it can
 * and returns empty matches for unknown sources.
 */
export interface ResolveMentionRequest {
  /** Source to search (any string; server resolves known ContextTypes, returns empty for others) */
  type: string;
  /** Search query */
  query: string;
}

/** Request body for POST /resolve */
export interface ResolveRequest {
  /** Mentions to resolve */
  mentions: ResolveMentionRequest[];
  /** Desired resolution depth (optional, defaults to 'standard') */
  depth?: ResolutionDepth;
}

// -----------------------------------------------------------------------------
// API: POST /resolve - Response
// -----------------------------------------------------------------------------

/** A single matched context result */
export interface ContextMatch {
  /** The matched content text */
  content: string;
  /** Source file path (relative to project context folder) */
  source: string;
  /** Date from the source document, if available */
  date?: string;
  /** Search relevance score (0-1) */
  relevance: number;
  /** Related findings (populated at 'detailed' and 'full' depth) */
  relatedFindings?: string[];
}

/**
 * Resolution result for a single mention.
 * Type is string to match the widened ResolveMentionRequest.
 */
export interface MentionResult {
  /** The source that was searched */
  type: string;
  /** The original search query */
  query: string;
  /** Matched context entries, ranked by relevance */
  matches: ContextMatch[];
}

/** Response body for POST /resolve */
export interface ResolveResponse {
  /** Results for each requested mention */
  results: MentionResult[];
}

// -----------------------------------------------------------------------------
// API: GET /health
// -----------------------------------------------------------------------------

export interface HealthResponse {
  status: 'ok' | 'error';
  /** Number of indexed context files */
  indexedFiles: number;
  /** Current project name */
  project: string;
  /** Available context types that have files */
  availableTypes: ContextType[];
}

// -----------------------------------------------------------------------------
// API: GET /suggest
// -----------------------------------------------------------------------------

/** Request params for autocomplete suggestions */
export interface SuggestRequest {
  /** Partial context type or query */
  partial: string;
  /** If type is already known, search within that type */
  type?: string;
}

/** A single autocomplete suggestion */
export interface Suggestion {
  /** The suggested text */
  text: string;
  /** Source type (local context type or configured tool) */
  type: string;
  /** Brief preview of what this matches */
  preview: string;
}

/** Response for autocomplete suggestions */
export interface SuggestResponse {
  suggestions: Suggestion[];
}

// -----------------------------------------------------------------------------
// API: POST /scaffold
// -----------------------------------------------------------------------------

/** Request to create a new project scaffold */
export interface ScaffoldRequest {
  /** Project name (used as folder name) */
  projectName: string;
  /** Base directory to create the project in */
  basePath: string;
}

/** Response after scaffolding */
export interface ScaffoldResponse {
  /** Full path to the created project */
  projectPath: string;
  /** Context types created */
  createdFolders: ContextType[];
}

// -----------------------------------------------------------------------------
// API: POST /passes
// -----------------------------------------------------------------------------

/** Request body for POST /passes (persist a submitted pass) */
export interface CreatePassRequest {
  /** The pass to persist */
  pass: Pass;
}

/** Response after persisting a pass */
export interface CreatePassResponse {
  /** Pass ID */
  id: string;
  /** File path where the pass was written */
  path: string;
  /** ISO timestamp */
  timestamp: string;
}

// -----------------------------------------------------------------------------
// API: GET /passes
// -----------------------------------------------------------------------------

/** Summary of a pass (for list views) */
export interface PassSummary {
  /** Pass ID */
  id: string;
  /** ISO timestamp */
  timestamp: string;
  /** Resolution depth (optional) */
  depth?: ResolutionDepth;
  /** Number of instructions in the pass */
  instructionCount: number;
  /** Element labels targeted in this pass */
  elementLabels: string[];
}

/** Response for GET /passes (list all passes) */
export interface PassListResponse {
  /** All passes, most recent first */
  passes: PassSummary[];
}

// -----------------------------------------------------------------------------
// API: GET /inspect
// -----------------------------------------------------------------------------

/** A reference to a specific instruction within a pass (for Inspect mode) */
export interface InspectPassReference {
  /** Pass ID */
  passId: string;
  /** Pass timestamp */
  timestamp: string;
  /** The instruction that targeted this element */
  instruction: Instruction;
}

/** Response for GET /inspect?selector=... (decision trail for an element) */
export interface InspectResponse {
  /** The CSS selector that was queried */
  selector: string;
  /** Passes that targeted this element, most recent first */
  passes: InspectPassReference[];
  /** Pre-attached context that was included when this element was targeted */
  contextHistory: PreAttachedSnippet[];
}

// -----------------------------------------------------------------------------
// API: GET /tools & POST /tools
// -----------------------------------------------------------------------------

/** A configured tool available as an @mention target */
export interface ConfiguredTool {
  /** Tool name (used as @mention source, e.g., "posthog", "figma") */
  name: string;
  /** Human-readable label */
  label: string;
  /** Whether this tool is enabled for the current project */
  enabled: boolean;
}

/** Response for GET /tools */
export interface ToolsResponse {
  /** All configured tools */
  tools: ConfiguredTool[];
}

/** Request body for POST /tools (update tool configuration) */
export interface UpdateToolsRequest {
  /** Tools to set (replaces full list) */
  tools: ConfiguredTool[];
}

// -----------------------------------------------------------------------------
// Structured Output (legacy - preserved for backward compatibility)
// -----------------------------------------------------------------------------

/**
 * The structured pass submitted to the agent (single annotation with pre-attached local context).
 * @deprecated Use Pass for new multi-instruction flow.
 */
export interface StructuredOutput {
  /** The annotation that produced this output */
  annotation: Annotation;
  /** Resolved context for each mention */
  resolvedContext: MentionResult[];
  /** The depth level used */
  depth: ResolutionDepth;
}

// -----------------------------------------------------------------------------
// Server Configuration
// -----------------------------------------------------------------------------

export interface ServerConfig {
  /** Port for the local HTTP server (default: 4700) */
  port: number;
  /** Path to the project's context folder root */
  contextRoot: string;
  /** Project name */
  projectName: string;
}

export const DEFAULT_SERVER_PORT = 4700;

export const DEFAULT_CONTEXT_FOLDERS: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
];

// -----------------------------------------------------------------------------
// Utility: Type guard for ContextType
// -----------------------------------------------------------------------------

/** Check if a string is one of the 5 local context types */
export function isContextType(value: string): value is ContextType {
  return CONTEXT_TYPES.includes(value as ContextType);
}
