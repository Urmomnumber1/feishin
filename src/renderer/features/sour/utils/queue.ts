import { type QueryClient } from '@tanstack/react-query';

import { type GroupSong } from '/@/renderer/features/group-play/store/group-play.store';
import { getSongById } from '/@/renderer/features/player/utils';
import { setReason } from '/@/renderer/features/sour/utils/reasons';
import { addToQueueByData } from '/@/renderer/store/player.store';
import { type Song } from '/@/shared/types/domain-types';
import { Play } from '/@/shared/types/types';

// Looks the songs up on the music server (songs Hermes Music knows about are stored without
// credentials) and queues the ones that exist. Returns how many were queued.
export const queueGroupSongs = async (
    songs: GroupSong[],
    play: Play,
    ctx: { queryClient: QueryClient; serverId: string },
    reason?: string,
) => {
    const found = await Promise.all(
        songs.map((s) =>
            getSongById({ id: s.id, queryClient: ctx.queryClient, serverId: ctx.serverId })
                .then((res) => res.items as Song[])
                .catch(() => [] as Song[]),
        ),
    );
    const items = found.flat();
    if (!items.length) return 0;
    if (reason) setReason(items.map((s) => s.id), reason);
    await addToQueueByData(play, items);
    return items.length;
};

export const shuffled = <T>(list: T[]) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
};
