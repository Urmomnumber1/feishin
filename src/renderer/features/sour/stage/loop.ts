import { useEffect } from 'react';
import { create } from 'zustand';

import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useSettingsStore } from '/@/renderer/store/settings.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';

// A-B loop: play the part between A and B over and over (handy for learning lyrics). Forgotten when
// the song changes.
interface LoopState {
    a: null | number;
    b: null | number;
    songId: null | string;
}

export const useLoop = create<LoopState>(() => ({ a: null, b: null, songId: null }));

export const setLoopPoint = (which: 'a' | 'b') => {
    const t = useTimestampStoreBase.getState().timestamp;
    const songId = usePlayerStoreBase.getState().getCurrentSong()?.id ?? null;
    const { a, b } = useLoop.getState();
    if (which === 'a') useLoop.setState({ a: t, b: b !== null && b > t ? b : null, songId });
    else if (a !== null && t > a + 0.5) useLoop.setState({ b: t, songId });
};

export const clearLoop = () => useLoop.setState({ a: null, b: null, songId: null });

export const LoopWatcher = () => {
    useEffect(() => {
        const unsubscribe = useTimestampStoreBase.subscribe(
            (state) => state.timestamp,
            (t) => {
                const { a, b, songId } = useLoop.getState();
                if (a === null || b === null) return;
                const current = usePlayerStoreBase.getState().getCurrentSong()?.id ?? null;
                if (current !== songId) {
                    clearLoop();
                    return;
                }
                if (t >= b || t < a - 1) usePlayerStoreBase.getState().mediaSeekToTimestamp(a);
            },
        );
        return unsubscribe;
    }, []);
    return null;
};

// speed presets: slowed (lower and slower) and nightcore (faster and higher)
export const SPEEDS: { id: string; label: string; speed: number }[] = [
    { id: 'slowed', label: 'Slowed', speed: 0.85 },
    { id: 'normal', label: 'Normal', speed: 1 },
    { id: 'nightcore', label: 'Nightcore', speed: 1.25 },
];

let pitchBefore: boolean | null = null;
export const setSpeedPreset = (id: string) => {
    const preset = SPEEDS.find((s) => s.id === id) ?? SPEEDS[1];
    const settings = useSettingsStore.getState();
    if (preset.speed !== 1) {
        // the "slowed" and "nightcore" sound needs the pitch to move with the speed
        if (pitchBefore === null) pitchBefore = settings.playback.preservePitch;
        settings.actions.setSettings({ playback: { preservePitch: false } });
    } else if (pitchBefore !== null) {
        settings.actions.setSettings({ playback: { preservePitch: pitchBefore } });
        pitchBefore = null;
    }
    usePlayerStoreBase.getState().setSpeed(preset.speed);
};
