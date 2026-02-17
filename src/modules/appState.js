import { AppStore } from './store.js';

// Backwards-compatible app slice reference.
export const AppState = AppStore.getState().app;
