export {
  analyzeSchemaSource,
  computeCompletionItems,
  computeDiagnostics,
  computeSemanticTokens,
  createDocumentManager,
  createLanguageServer,
  getSemanticTokensLegend,
  type CompletionContext,
  type SchemaAnalysis,
  type SemanticTokenEntry,
} from "./server.js";

export const PACKAGE_NAME = "@zed-orm/language-server" as const;
