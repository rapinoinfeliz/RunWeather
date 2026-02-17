import { AppStore } from '../store.js';

// Backwards-compatible UI slice reference.
export const UIState = AppStore.getState().ui;
