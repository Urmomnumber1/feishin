import { type QueryClient, useQueryClient } from '@tanstack/react-query';

import {
    playAsVideos,
    type VideoEntry,
    withVideos,
} from '/@/renderer/features/hermes-video/components/music-video-button';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { getAlbumSongsById, getPlaylistSongsById } from '/@/renderer/features/player/utils';
import { useMyProfile } from '/@/renderer/features/sour/store/sour.store';
import { useCurrentServer } from '/@/renderer/store';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem, type Song } from '/@/shared/types/domain-types';

type Collection = LibraryItem.ALBUM | LibraryItem.PLAYLIST;

const songsOf = async (
    ids: string[],
    itemType: Collection,
    queryClient: QueryClient,
    serverId: string,
) => {
    if (itemType === LibraryItem.ALBUM)
        return (await getAlbumSongsById({ id: ids, queryClient, serverId })).items;
    let songs: Song[] = [];
    for (const id of ids)
        songs = songs.concat((await getPlaylistSongsById({ id, queryClient, serverId })).items);
    return songs;
};

// Album / playlist right-click: play only the songs that have a music video, in the Stage's video view
export const PlayAsVideosAction = ({ ids, itemType }: { ids: string[]; itemType: Collection }) => {
    const url = useHermesUrl();
    const serverId = useCurrentServer()?.id;
    const queryClient = useQueryClient();
    if (!url || !serverId) return null;
    const onSelect = async () => {
        try {
            const [songs, list] = await Promise.all([
                songsOf(ids, itemType, queryClient, serverId),
                fetch(`${url}/api/videos`).then((r) => r.json() as Promise<VideoEntry[]>),
            ]);
            await playAsVideos(withVideos(songs, Array.isArray(list) ? list : []));
        } catch (error) {
            toast.error({ message: (error as Error).message });
        }
    };
    return (
        <ContextMenu.Item leftIcon="musicVideo" onSelect={onSelect}>
            Play as videos
        </ContextMenu.Item>
    );
};

// Album / playlist right-click (admins): Hermes Music looks for every song's music video in the background
export const FindVideosAction = ({ ids, itemType }: { ids: string[]; itemType: Collection }) => {
    const url = useHermesUrl();
    const serverId = useCurrentServer()?.id;
    const queryClient = useQueryClient();
    const admin = !!useMyProfile().data?.perks?.includes('admin');
    if (!url || !serverId || !admin) return null;
    const onSelect = async () => {
        try {
            const songs = await songsOf(ids, itemType, queryClient, serverId);
            const res = await fetch(`${url}/api/videos/find`, {
                body: JSON.stringify({
                    songs: songs.map((s) => ({ artist: s.artistName, title: s.name })),
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Hermes Music returned ${res.status}`);
            toast.info({
                message: `Looking for videos for ${songs.length} songs - they show up as they're found (Sour Library > Videos shows how far it got)`,
            });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        }
    };
    return (
        <ContextMenu.Item leftIcon="search" onSelect={onSelect}>
            Find music videos
        </ContextMenu.Item>
    );
};
