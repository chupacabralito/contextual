// =============================================================================
// Context Manager Types
// =============================================================================
// Re-exports all context-manager-relevant types from @contextual/shared.
// The UI layer imports from this file, never directly from shared.
// =============================================================================

export type {
  ContextType,
  CompiledFileMeta,
  CompiledFileResponse,
  CorpusResponse,
  CorpusTypeEntry,
  SectionMeta,
  SectionResponse,
  SourceFile,
  SourceListResponse,
  SourceContentResponse,
  AddSourceRequest,
  AddSourceResponse,
  UpdateCompiledRequest,
  ImportRequest,
  ImportResponse,
  ContextFilePreview,
  ContextTypeGroup,
  ContextRootResponse,
  PreviousProjectSummary,
  PreviousProjectsResponse,
  PastedEntry,
  ImportSelection,
  HandoffPayload,
  SubmitResponse,
  ConfiguredTool,
  RepositoryFile,
  RepositoryResponse,
} from '@contextual/shared';

export { CONTEXT_TYPES } from '@contextual/shared';
