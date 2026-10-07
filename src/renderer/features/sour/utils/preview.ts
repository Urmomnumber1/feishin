import { useRef } from 'react';

import { api } from '/@/renderer/api';
import { type GroupSong } from '/@/renderer/features/group-play/store/group-play.store';
import { useSourStore } from '/@/renderer/features/sour/store/sour.store';
import { useCurrentServer } from '/@/renderer/store';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { PlayerStatus } from '/@/shared/types/types';

// Hover previews (Sour Studio > Extras, off by default): hold the mouse on a cover in Sour Player's
// own shelves for a second and hear 10 seconds from the middle of the song. Your music pauses
// meanwhile and comes back after.
let audio: HTMLAudioElement | null = null;
let resume = false;
let stopTimer: ReturnType<typeof setTimeout> | undefined;

const stopPreview = () => {
    if (stopTimer) clearTimeout(stopTimer);
    stopTimer = undefined;
    if (audio) {
        audio.pause();
        audio.src = '';
        audio = null;
    }
    if (resume) {
        resume = false;
        usePlayerStoreBase.getState().mediaPlay();
    }
};

const startPreview = async (serverId: string, song: GroupSong) => {
    stopPreview();
    const url = await api.controller.getStreamUrl({
        apiClientProps: { serverId },
        query: { id: song.id },
    });
    const player = usePlayerStoreBase.getState();
    if (player.player.status === PlayerStatus.PLAYING) {
        resume = true;
        player.mediaPause();
    }
    audio = new Audio(url);
    audio.volume = 0.8;
    audio.addEventListener('loadedmetadata', () => {
        if (audio && Number.isFinite(audio.duration) && audio.duration > 40)
            audio.currentTime = audio.duration * 0.35;
    });
    await audio.play().catch(() => stopPreview());
    stopTimer = setTimeout(stopPreview, 10000);
};

export const useHoverPreview = (song: GroupSong) => {
    const on = useSourStore((s) => s.look.hoverPreview);
    const serverId = useCurrentServer()?.id;
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    if (!on || !serverId) return {};
    return {
        onMouseEnter: () => {
            timer.current = setTimeout(() => {
                startPreview(serverId, song).catch(() => stopPreview());
            }, 1000);
        },
        onMouseLeave: () => {
            if (timer.current) clearTimeout(timer.current);
            stopPreview();
        },
    };
};
