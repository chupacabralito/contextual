export type ContextType =
  | 'research'
  | 'taste'
  | 'strategy'
  | 'design-system'
  | 'stakeholders';

export const CONTEXT_TYPES: ContextType[] = [
  'research',
  'taste',
  'strategy',
  'design-system',
  'stakeholders',
];

export interface ContextFilePreview {
  relativePath: string;
  fileName: string;
  summary: string;
  preview: string;
}

export interface ContextTypeGroup {
  type: ContextType;
  fileCount: number;
  summary: string;
  files: ContextFilePreview[];
}

export interface ContextRootResponse {
  contextRoot: string;
  projectPath: string;
  previousProjectsPath: string;
  groups: ContextTypeGroup[];
}

export interface PreviousProjectSummary {
  name: string;
  path: string;
  groups: Array<{
    type: ContextType;
    fileCount: number;
    files: string[];
  }>;
}

export interface PreviousProjectsResponse {
  projects: PreviousProjectSummary[];
}

export interface PastedEntry {
  id: string;
  label: string;
  suggestedType: ContextType | '';
  content: string;
}

export interface ImportSelection {
  projectName: string;
  projectPath: string;
  importedTypes: ContextType[];
  files: string[];
}

export interface HandoffPayload {
  timestamp: string;
  defaultContext: {
    included: ContextType[];
    excluded: ContextType[];
  };
  pastedContent: Array<{
    label: string;
    suggestedType?: ContextType;
    content: string;
  }>;
  importedFrom?: {
    projectName: string;
    importedTypes: ContextType[];
    files: string[];
  };
}

export interface SubmitResponse {
  handoffPath: string;
  copiedFiles: string[];
}

// ---------------------------------------------------------------------------
// Tool Configuration (talks to server on port 4700)
// ---------------------------------------------------------------------------

export interface ConfiguredTool {
  name: string;
  label: string;
  enabled: boolean;
}

// ---------------------------------------------------------------------------
// Repository Browser
// ---------------------------------------------------------------------------

export interface RepositoryFile {
  relativePath: string;
  fileName: string;
  type: ContextType;
  size: number;
  preview: string;
}

export interface RepositoryResponse {
  contextRoot: string;
  files: RepositoryFile[];
  totalFiles: number;
}
