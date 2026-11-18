import { createBrowserHistory, createHashHistory } from 'history';
export const appHistory = window.electronAPI?.isElectron ? createHashHistory() : createBrowserHistory();