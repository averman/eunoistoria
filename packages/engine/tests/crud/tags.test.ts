import { describe, it, expect, beforeEach } from 'vitest';
import { createMockDataStore } from '../helpers/mock-data-store.js';
import { assignTag, removeTag, getTagsForDocument } from '../../src/crud/tags.js';
import { DataStorePort, TagError } from '@eunoistoria/types';

describe('ENG-011: CRUD Tags', () => {
  let store: DataStorePort;

  beforeEach(() => {
    store = createMockDataStore();
  });

  async function mkDoc() {
    const r = await store.createDocument({ projectId: 'p', title: 'D', isComposition: false, content: 'c' });
    if (!r.ok) throw new Error();
    return r.value.id;
  }

  it('TC-011-01: assign tag to document succeeds', async () => {
    const docId = await mkDoc();
    const r = await assignTag(docId, 'lang', 'en', store);
    expect(r.ok).toBe(true);
    const tags = await getTagsForDocument(docId, store);
    expect(tags.ok).toBe(true);
    if (!tags.ok) return;
    expect(tags.value.some(t => t.key === 'lang' && t.value === 'en')).toBe(true);
  });

  it('TC-011-02: assign duplicate tag returns DuplicateTagOnDocument', async () => {
    const docId = await mkDoc();
    await assignTag(docId, 'lang', 'en', store);
    const r = await assignTag(docId, 'lang', 'en', store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TagError.DuplicateTagOnDocument);
  });

  it('TC-011-03: assign same key different value succeeds', async () => {
    const docId = await mkDoc();
    await assignTag(docId, 'tag', 'val1', store);
    const r = await assignTag(docId, 'tag', 'val2', store);
    expect(r.ok).toBe(true);
  });

  it('TC-011-04: remove tag succeeds', async () => {
    const docId = await mkDoc();
    const tagResult = await assignTag(docId, 'lang', 'en', store);
    if (!tagResult.ok) return;
    const r = await removeTag(docId, tagResult.value.id, store);
    expect(r.ok).toBe(true);
    const tags = await getTagsForDocument(docId, store);
    if (!tags.ok) return;
    expect(tags.value).toHaveLength(0);
  });

  it('TC-011-05: remove nonexistent tag returns NotFound', async () => {
    const docId = await mkDoc();
    const r = await removeTag(docId, 'non-existent' as any, store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TagError.NotFound);
  });

  it('TC-011-06: assign tag to nonexistent document returns DocumentNotFound', async () => {
    const r = await assignTag('non-existent' as any, 'lang', 'en', store);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(TagError.DocumentNotFound);
  });
});
