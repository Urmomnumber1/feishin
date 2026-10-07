import { create } from 'zustand';

// Whether the mini player is showing. While it is, the app keeps its desktop layout even though the
// window is tiny (otherwise it would switch to the phone layout and the mini player would vanish).
export const useMiniStore = create<{ on: boolean }>(() => ({ on: false }));
