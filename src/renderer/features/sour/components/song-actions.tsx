import { openModal } from '@mantine/modals';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';

import { groupApi, toGroupSong } from '/@/renderer/features/group-play/api/group-play-api';
import {
    type GroupSong,
    useGroupPlayStore,
} from '/@/renderer/features/group-play/store/group-play.store';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { songsQueries } from '/@/renderer/features/songs/api/songs-api';
import { favoriteKind, sourApi } from '/@/renderer/features/sour/api/sour-api';
import { ProfileAvatar } from '/@/renderer/features/sour/components/profile-bits';
import {
    useMyProfile,
    useSourProfiles,
    useSourStore,
} from '/@/renderer/features/sour/store/sour.store';
import { useCurrentServer } from '/@/renderer/store';
import { Button } from '/@/shared/components/button/button';
import { ContextMenu } from '/@/shared/components/context-menu/context-menu';
import { Group } from '/@/shared/components/group/group';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { Textarea } from '/@/shared/components/textarea/textarea';
import { toast } from '/@/shared/components/toast/toast';
import {
    type Album,
    type AlbumArtist,
    type Artist,
    type Playlist,
    type Song,
} from '/@/shared/types/domain-types';

// Adds songs, albums or artists to the favourites on your profile (skipping ones already there), or
// takes them off again when they're all on it already.
const AddFavoritesItem = ({ entries }: { entries: GroupSong[] }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const queryClient = useQueryClient();
    const mine = useMyProfile().data;
    const onProfile = new Set((mine?.favorites ?? []).map((f) => f.id));
    const allThere = !!entries.length && entries.every((entry) => onProfile.has(entry.id));

    const onSelect = useCallback(async () => {
        if (!url || !me) return;
        try {
            const profile = await sourApi.me(url, me);
            const ids = new Set(entries.map((entry) => entry.id));
            const have = new Set(profile.favorites.map((f) => f.id));
            const added = entries.filter((entry) => !have.has(entry.id));
            if (allThere) {
                await sourApi.update(url, me, {
                    favorites: profile.favorites.filter((f) => !ids.has(f.id)),
                });
            } else {
                await sourApi.update(url, me, { favorites: [...profile.favorites, ...added] });
            }
            queryClient.invalidateQueries({ queryKey: ['sour-profiles', url] });
            queryClient.invalidateQueries({ queryKey: ['sour-me', url] });
            toast.success({
                message: allThere
                    ? 'Taken off your profile'
                    : added.length
                      ? 'Added to your profile'
                      : 'Already on your profile',
            });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        }
    }, [allThere, entries, me, queryClient, url]);

    if (!url || !me || !entries.length) return null;

    return (
        <ContextMenu.Item leftIcon={allThere ? 'x' : 'favorite'} onSelect={onSelect}>
            {allThere ? 'Remove from my profile' : 'Add to my profile'}
        </ContextMenu.Item>
    );
};

// Song right-click menu
export const AddToProfileAction = ({ songs }: { songs: Song[] }) => (
    <AddFavoritesItem entries={songs.map(toGroupSong)} />
);

// Album right-click menu
export const AddAlbumToProfileAction = ({ albums }: { albums: Album[] }) => (
    <AddFavoritesItem
        entries={albums.map((a) => ({
            album: a.name,
            artist: a.albumArtistName,
            duration: 0,
            id: `album:${a.id}`,
            imageId: a.imageId,
            title: a.name,
        }))}
    />
);

// Artist right-click menu
export const AddArtistToProfileAction = ({ artists }: { artists: (AlbumArtist | Artist)[] }) => (
    <AddFavoritesItem
        entries={artists.map((a) => ({
            album: '',
            artist: a.name,
            duration: 0,
            id: `artist:${a.id}`,
            imageId: a.imageId,
            title: a.name,
        }))}
    />
);

// Song right-click menu: never let Auto DJ add this song's artist for you.
export const BlockArtistAction = ({ songs }: { songs: Song[] }) => {
    const block = useSourStore((state) => state.block);
    const song = songs[0];

    const onSelect = useCallback(() => {
        if (!song) return;
        const artist = song.artists?.[0];
        const name = artist?.name || song.artistName;
        if (!name) return;
        block({ id: artist?.id || null, name });
        toast.info({ message: `Auto DJ won't play ${name} for you` });
    }, [block, song]);

    if (songs.length !== 1 || !song?.artistName) return null;

    return (
        <ContextMenu.Item leftIcon="x" onSelect={onSelect}>
            Block artist from Auto DJ
        </ContextMenu.Item>
    );
};

// Song right-click menu: keep this song out of "listening to" and your recent plays.
export const HideFromActivityAction = ({ songs }: { songs: Song[] }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const onSelect = useCallback(async () => {
        if (!url || !me) return;
        try {
            const profile = await sourApi.me(url, me);
            const hidden = new Set([
                ...(profile.custom?.hiddenSongs ?? []),
                ...songs.map((s) => s.id),
            ]);
            await sourApi.update(url, me, {
                custom: { ...profile.custom, hiddenSongs: [...hidden] },
            });
            toast.info({ message: 'Hidden from your activity' });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        }
    }, [me, songs, url]);
    if (!url || !me) return null;
    return (
        <ContextMenu.Item leftIcon="visibilityOff" onSelect={onSelect}>
            Hide from my activity
        </ContextMenu.Item>
    );
};

// a private note on a song (only on this computer)
const SongNote = ({ song }: { song: Song }) => {
    const notes = useSourStore((state) => state.notes);
    const set = useSourStore((state) => state.set);
    const [text, setText] = useState(notes[song.id] ?? '');
    return (
        <Stack gap="sm">
            <Text isMuted size="sm">
                Only you see this note.
            </Text>
            <Textarea
                autosize
                minRows={3}
                onChange={(e) => setText(e.currentTarget.value)}
                value={text}
            />
            <Group justify="flex-end">
                <Button
                    onClick={() => {
                        const next = { ...notes };
                        if (text.trim()) next[song.id] = text.trim();
                        else delete next[song.id];
                        set({ notes: next });
                        toast.success({ message: 'Note saved' });
                    }}
                    variant="filled"
                >
                    Save note
                </Button>
            </Group>
        </Stack>
    );
};
export const SongNoteAction = ({ songs }: { songs: Song[] }) => {
    const song = songs[0];
    const has = useSourStore((state) => (song ? !!state.notes[song.id] : false));
    if (songs.length !== 1 || !song) return null;
    return (
        <ContextMenu.Item
            leftIcon="edit"
            onSelect={() =>
                openModal({ children: <SongNote song={song} />, title: `Note: ${song.name}` })
            }
        >
            {has ? 'Edit my note' : 'Add a note'}
        </ContextMenu.Item>
    );
};

// which friends have this song in their favourites or top songs
const WhoElseLikes = ({ song }: { song: Song }) => {
    const profiles = useSourProfiles().data ?? [];
    const fans = profiles.filter(
        (p) =>
            p.favorites.some((f) => favoriteKind(f) === 'song' && f.id === song.id) ||
            p.stats?.topSongs.some((s) => s.id === song.id) ||
            p.custom?.top5?.some((s) => s.id === song.id),
    );
    if (!fans.length)
        return <Text isMuted>Nobody has this one in their favourites or top songs yet.</Text>;
    return (
        <Stack gap="xs">
            {fans.map((p) => (
                <Group gap="sm" key={p.id}>
                    <ProfileAvatar profile={p} size={28} />
                    <Text>{p.name}</Text>
                    <Text isMuted size="xs">
                        {p.favorites.some((f) => f.id === song.id)
                            ? 'favourite'
                            : p.custom?.top5?.some((s) => s.id === song.id)
                              ? 'in their top 5'
                              : 'plays it a lot'}
                    </Text>
                </Group>
            ))}
        </Stack>
    );
};
export const WhoElseLikesAction = ({ songs }: { songs: Song[] }) => {
    const url = useHermesUrl();
    const song = songs[0];
    if (!url || songs.length !== 1 || !song) return null;
    return (
        <ContextMenu.Item
            leftIcon="user"
            onSelect={() =>
                openModal({ children: <WhoElseLikes song={song} />, title: 'Who else likes this' })
            }
        >
            Who else likes this
        </ContextMenu.Item>
    );
};

// send a song to a friend: it shows up for them with a Play button (and on their wall)
const ShareSong = ({ song }: { song: Song }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const profiles = (useSourProfiles().data ?? []).filter((p) => p.id !== me?.id);
    const [text, setText] = useState('');
    return (
        <Stack gap="sm">
            <TextInput
                onChange={(e) => setText(e.currentTarget.value)}
                placeholder="Add a message (optional)"
                value={text}
            />
            {profiles.map((p) => (
                <Group gap="sm" justify="space-between" key={p.id}>
                    <Group gap="sm">
                        <ProfileAvatar online={p.online} profile={p} size={28} />
                        <Text>{p.name}</Text>
                    </Group>
                    <Button
                        onClick={() =>
                            me &&
                            sourApi
                                .wall(url, me, p.id, { song: toGroupSong(song), text })
                                .then(() => toast.success({ message: `Sent to ${p.name}` }))
                                .catch((error: Error) => toast.error({ message: error.message }))
                        }
                        size="xs"
                        variant="default"
                    >
                        Send
                    </Button>
                </Group>
            ))}
        </Stack>
    );
};
export const ShareSongAction = ({ songs }: { songs: Song[] }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const song = songs[0];
    if (!url || !me || songs.length !== 1 || !song) return null;
    return (
        <ContextMenu.Item
            leftIcon="share"
            onSelect={() =>
                openModal({ children: <ShareSong song={song} />, title: `Send ${song.name}` })
            }
        >
            Send to a friend
        </ContextMenu.Item>
    );
};

// Playlist right-click: hide it from this computer's sidebar (Settings > Sour Player brings it back)
export const HidePlaylistAction = ({ playlist }: { playlist?: Playlist }) => {
    const hidden = useSourStore((state) => state.hiddenPlaylists) ?? [];
    const set = useSourStore((state) => state.set);
    if (!playlist) return null;
    const isHidden = hidden.some((h) => h.id === playlist.id);
    return (
        <ContextMenu.Item
            leftIcon={isHidden ? 'add' : 'x'}
            onSelect={() => {
                set({
                    hiddenPlaylists: isHidden
                        ? hidden.filter((h) => h.id !== playlist.id)
                        : [...hidden, { id: playlist.id, name: playlist.name }],
                });
                toast.info({
                    message: isHidden
                        ? `${playlist.name} is back in the sidebar`
                        : `${playlist.name} is hidden (Settings > Sour Player to bring it back)`,
                });
            }}
        >
            {isHidden ? 'Show in the sidebar again' : 'Hide playlist'}
        </ContextMenu.Item>
    );
};

// Album / playlist right-click: pin it to the top of the sidebar
export const PinAction = ({
    item,
    kind,
}: {
    item?: { id: string; imageId?: null | string; name: string };
    kind: 'album' | 'playlist';
}) => {
    const pins = useSourStore((state) => state.pins);
    const set = useSourStore((state) => state.set);
    if (!item) return null;
    const pinned = pins.some((p) => p.kind === kind && p.id === item.id);
    return (
        <ContextMenu.Item
            leftIcon="pin"
            onSelect={() =>
                set({
                    pins: pinned
                        ? pins.filter((p) => !(p.kind === kind && p.id === item.id))
                        : [
                              ...pins,
                              { id: item.id, imageId: item.imageId ?? null, kind, name: item.name },
                          ],
                })
            }
        >
            {pinned ? 'Unpin from sidebar' : 'Pin to sidebar'}
        </ContextMenu.Item>
    );
};

// Playlist right-click: show it on your profile
export const PinPlaylistToProfileAction = ({ playlist }: { playlist?: Playlist }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    if (!url || !me || !playlist) return null;
    return (
        <ContextMenu.Item
            leftIcon="user"
            onSelect={async () => {
                try {
                    const profile = await sourApi.me(url, me);
                    await sourApi.update(url, me, {
                        custom: {
                            ...profile.custom,
                            pinnedPlaylist: {
                                id: playlist.id,
                                imageId: playlist.imageId,
                                name: playlist.name,
                            },
                        },
                    });
                    toast.success({ message: `${playlist.name} is on your profile` });
                } catch (error) {
                    toast.error({ message: (error as Error).message });
                }
            }}
        >
            Pin to my profile
        </ContextMenu.Item>
    );
};

// Artists whose new releases Hermes Music downloads by itself (checked every 6 hours)
const followKey = (name: string) =>
    name
        .toLowerCase()
        .split(/,|&| feat\.? | ft\.? /)[0]
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

export const useFollows = () => {
    const url = useHermesUrl();
    return useQuery({
        enabled: !!url,
        queryFn: () => sourApi.follows(url),
        queryKey: ['sour-follows', url],
        staleTime: 30000,
    });
};

export const useFollowToggle = (name?: string) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const queryClient = useQueryClient();
    const follows = useFollows().data ?? [];
    const followed = name
        ? follows.find((f) => followKey(f.artist) === followKey(name))
        : undefined;
    const toggle = () => {
        if (!url || !me || !name) return;
        const work = followed
            ? sourApi.unfollow(url, me, followed.deezerId).then(() =>
                  toast.info({
                      message: `Stopped following ${followed.artist}'s new releases`,
                  }),
              )
            : sourApi.follow(url, me, name).then((r) =>
                  toast.success({
                      message: `Following ${r.artist}: new releases download by themselves`,
                  }),
              );
        work.then(() => queryClient.invalidateQueries({ queryKey: ['sour-follows', url] })).catch(
            (error: Error) => toast.error({ message: error.message }),
        );
    };
    return { available: !!url && !!me && !!name, followed: !!followed, toggle };
};

// Artist right-click: follow (or stop following) their new releases
export const FollowArtistAction = ({ artists }: { artists: (AlbumArtist | Artist)[] }) => {
    const artist = artists.length === 1 ? artists[0] : undefined;
    const { available, followed, toggle } = useFollowToggle(artist?.name);
    if (!available) return null;
    return (
        <ContextMenu.Item leftIcon={followed ? 'x' : 'add'} onSelect={toggle}>
            {followed ? 'Unfollow new releases' : 'Follow new releases'}
        </ContextMenu.Item>
    );
};

// Artist page: the same, as a button next to Artist radio
export const FollowArtistButton = ({ name }: { name?: string }) => {
    const { available, followed, toggle } = useFollowToggle(name);
    if (!available) return null;
    return (
        <Button
            leftSection={<Icon icon={followed ? 'check' : 'add'} size="lg" />}
            onClick={toggle}
            p={0}
            size="compact-md"
            title="Hermes Music downloads their new releases by themselves"
            variant="transparent"
        >
            {followed ? 'FOLLOWING' : 'FOLLOW'}
        </Button>
    );
};

// Artist right-click: put a few of their songs on Sour Radio
export const ArtistToRadioAction = ({ artists }: { artists: (AlbumArtist | Artist)[] }) => {
    const url = useHermesUrl();
    const queryClient = useQueryClient();
    const serverId = useCurrentServer()?.id;
    const artist = artists[0];
    if (!url || !serverId || artists.length !== 1 || !artist) return null;
    return (
        <ContextMenu.Item
            leftIcon="radio"
            onSelect={async () => {
                try {
                    const res = await queryClient.fetchQuery(
                        songsQueries.artistRadio({
                            query: { artistId: artist.id, count: 30 },
                            serverId,
                        }),
                    );
                    const theirs = res
                        .filter((s) =>
                            s.artistName.toLowerCase().includes(artist.name.toLowerCase()),
                        )
                        .sort(() => Math.random() - 0.5)
                        .slice(0, 3);
                    if (!theirs.length) throw new Error(`Couldn't find songs by ${artist.name}`);
                    const { member, userName } = useGroupPlayStore.getState();
                    await groupApi.add(
                        url,
                        'RADIO',
                        userName || 'Someone',
                        theirs.map(toGroupSong),
                        member,
                    );
                    toast.success({
                        message: `Added ${theirs.length} ${artist.name} songs to Sour Radio`,
                    });
                } catch (error) {
                    toast.error({ message: (error as Error).message });
                }
            }}
        >
            Add to Sour Radio
        </ContextMenu.Item>
    );
};
