/**
 * Per-item recipe draft store.
 *
 * The workbench keeps one authored draft per gallery item so switching
 * specimens never loses an edit, while a reset returns that item to its
 * canonical specimen script. Drafts live in memory for the session only;
 * they are never persisted alongside the image-object.
 */

export type RecipeDraftStore = {
  get: (specimenId: string, fallbackScript: string) => string;
  set: (specimenId: string, draft: string) => void;
  clear: (specimenId: string) => void;
};

export function createRecipeDraftStore(): RecipeDraftStore {
  const drafts = new Map<string, string>();

  return {
    get(specimenId, fallbackScript) {
      return drafts.get(specimenId) ?? fallbackScript;
    },
    set(specimenId, draft) {
      drafts.set(specimenId, draft);
    },
    clear(specimenId) {
      drafts.delete(specimenId);
    },
  };
}
