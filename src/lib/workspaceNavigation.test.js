import { describe,it,expect } from 'bun:test';
import {limitWorkspaceTabs,migrateWorkspaceTabs} from './workspaceNavigation';
const tab=(i,pinned=false)=>({key:String(i),path:'/page/'+i,label:String(i),openedAt:i,lastUsed:i,pinned,entries:['/page/'+i],index:0});
describe('optional workspace tabs',()=>{
 it('limits unpinned tabs to five and evicts least recently used',()=>{const tabs=Array.from({length:6},(_,i)=>tab(i));tabs[0].lastUsed=10;expect(limitWorkspaceTabs(tabs).map(t=>t.key)).toEqual(['0','2','3','4','5']);});
 it('never evicts pins and sorts them first',()=>{const result=limitWorkspaceTabs([...Array.from({length:6},(_,i)=>tab(i)),tab(9,true),tab(10,true)]);expect(result.length).toBe(7);expect(result.slice(0,2).map(t=>t.key)).toEqual(['9','10']);});
 it('migrates old open tabs with pinned Home and the five newest',()=>{const result=migrateWorkspaceTabs(Array.from({length:8},(_,i)=>({key:'/p/'+i,path:'/p/'+i,openedAt:i})));expect(result.length).toBe(6);expect(result[0].key).toBe('/');expect(result[0].pinned).toBe(true);expect(result.slice(1).map(t=>t.openedAt)).toEqual([3,4,5,6,7]);});
});