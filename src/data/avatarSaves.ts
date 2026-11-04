import { normalizeAvatarDesign, type AvatarDesign } from '../models/avatar/design';

export const AVATAR_STORAGE_KEY = 'monterey-bay-cozy.avatars.v1';
export const AVATAR_SAVE_LIMIT = 24;
export interface SavedAvatar { id: string; design: AvatarDesign; savedAt: string }
export interface AvatarCollection { version: 1; selectedId: string | null; avatars: SavedAvatar[] }
export const emptyAvatarCollection = (): AvatarCollection => ({ version: 1, selectedId: null, avatars: [] });

/** Small, versioned design recipes. Geometry, textures and executable code are never saved. */
export function parseAvatarCollection(text: string | null): AvatarCollection {
  if (!text) return emptyAvatarCollection();
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('version' in value) || value.version !== 1 || !('avatars' in value) || !Array.isArray(value.avatars)) throw Error('This saved collection has an unsupported format.');
  if (value.avatars.length > AVATAR_SAVE_LIMIT) throw Error('The saved collection exceeds the 24-avatar limit.');
  const ids = new Set<string>();
  const avatars = value.avatars.map((item: unknown): SavedAvatar => {
    if (!item || typeof item !== 'object' || !('id' in item) || typeof item.id !== 'string' || !item.id || item.id.length > 100 || ids.has(item.id) || !('design' in item) || !item.design || typeof item.design !== 'object') throw Error('A saved avatar is damaged.');
    ids.add(item.id);
    return { id: item.id, design: normalizeAvatarDesign(item.design), savedAt: 'savedAt' in item && typeof item.savedAt === 'string' ? item.savedAt : '' };
  });
  const selectedId = 'selectedId' in value && typeof value.selectedId === 'string' && ids.has(value.selectedId) ? value.selectedId : avatars[0]?.id ?? null;
  return { version: 1, selectedId, avatars };
}

export function avatarDownload(design: AvatarDesign) { return JSON.stringify({ format: 'monterey-bay-cozy-avatar', version: 1, design: normalizeAvatarDesign(design) }, null, 2); }
export function parseAvatarDownload(text: string): AvatarDesign {
  if (text.length > 32768) throw Error('Avatar files must be smaller than 32 KB.');
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== 'object' || !('format' in value) || value.format !== 'monterey-bay-cozy-avatar' || !('version' in value) || value.version !== 1 || !('design' in value) || !value.design || typeof value.design !== 'object') throw Error('Choose a version 1 Monterey Bay Cozy avatar JSON file.');
  return normalizeAvatarDesign(value.design);
}
