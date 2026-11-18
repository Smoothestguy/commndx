export interface WorkspaceTab {
  key: string; path: string; label: string; openedAt: number; lastUsed: number; pinned: boolean;
  entries: string[]; index: number;
}
export const MAX_UNPINNED_TABS = 5;
export function limitWorkspaceTabs(tabs: WorkspaceTab[]): WorkspaceTab[] {
  const pinned = tabs.filter(t => t.pinned);
  const keep = new Set(tabs.filter(t => !t.pinned).sort((a,b) => b.lastUsed-a.lastUsed).slice(0, MAX_UNPINNED_TABS).map(t => t.key));
  return [...pinned, ...tabs.filter(t => !t.pinned && keep.has(t.key))];
}
export function migrateWorkspaceTabs(raw: Partial<WorkspaceTab>[]): WorkspaceTab[] {
  const home: WorkspaceTab = {key:'/',path:'/',label:'Home',openedAt:0,lastUsed:0,pinned:true,entries:['/'],index:0};
  return limitWorkspaceTabs([home, ...raw.filter(t => t.key && t.key!=='/' && t.path?.startsWith('/')).map(t => ({...t,key:String(t.key),path:String(t.path),label:t.label||'Page',openedAt:t.openedAt||0,lastUsed:t.lastUsed||t.openedAt||0,pinned:!!t.pinned,entries:t.entries?.length?t.entries:[String(t.path)],index:t.index||0}))]);
}