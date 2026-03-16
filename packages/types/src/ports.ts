import { PresetId, DocumentId, VariantGroupId, DataDocument, Preset } from './entities.js';
import { Result, DataStoreError } from './results.js';

// -----------------------------------------------------------------------------
// Storage Adapters (e.g. SQLite) must implement this to feed the Engine.
// Notice it returns fully populated trees (Preset with its Rules attached).
// -----------------------------------------------------------------------------
export interface DataStorePort {
  getPreset(id: PresetId): Promise<Result<Preset, DataStoreError>>;
  getDocument(id: DocumentId): Promise<Result<DataDocument, DataStoreError>>;
  
  // Resolves a VariantGroup to its member document IDs (ordered)
  getVariantGroupMembers(id: VariantGroupId): Promise<Result<DocumentId[], DataStoreError>>;
}

// -----------------------------------------------------------------------------
// The Product App (Reader App vs Power App) injects this to control visibility.
// -----------------------------------------------------------------------------
export interface AccessFilterPort {
  canAccess(documentId: DocumentId): Promise<boolean>;
}

// -----------------------------------------------------------------------------
// The Product App implements this to receive the final Engine output strings.
// -----------------------------------------------------------------------------
export interface OutputPort {
  writeOutput(filename: string, content: string): Promise<Result<void, Error>>;
}
