import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { useVideoList } from '/@/renderer/features/hermes-video/components/music-video-button';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { Card } from '/@/renderer/features/sour/components/hub-panels';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

interface FindStatus {
    current: null | { artist: string; title: string };
    done: number;
    found: number;
    queue: unknown[];
    running: boolean;
}

interface Missing {
    album: string;
    artist: string;
    title: string;
    tried: null | string;
}

const post = async (url: string, body: unknown) => {
    const res = await fetch(url, {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json' },
        method: 'POST',
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || `Hermes Music returned ${res.status}`);
    return json;
};

// Sour Library > Videos: which songs have no music video yet, finding them (all at once or one by one)
// and pasting a link when the search can't find the right one
export const VideosCard = () => {
    const url = useHermesUrl();
    const queryClient = useQueryClient();
    const videos = useVideoList();
    const [q, setQ] = useState('');
    const [linkFor, setLinkFor] = useState<null | string>(null);
    const [link, setLink] = useState('');
    const missing = useQuery({
        enabled: !!url,
        queryFn: async () => {
            const res = await fetch(`${url}/api/videos/missing`);
            if (!res.ok) throw new Error(`Hermes Music returned ${res.status}`);
            return (await res.json()) as { songs: Missing[]; total: number };
        },
        queryKey: ['videos-missing', url],
    });
    const status = useQuery({
        enabled: !!url,
        queryFn: async () => (await (await fetch(`${url}/api/videos/find`)).json()) as FindStatus,
        queryKey: ['videos-find', url],
        refetchInterval: (query) => (query.state.data?.running ? 3000 : 20000),
    });
    const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ['videos-missing', url] });
        queryClient.invalidateQueries({ queryKey: ['video-wall', url] });
        queryClient.invalidateQueries({ queryKey: ['videos-find', url] });
    };
    const find = (songs: Missing[]) =>
        post(`${url}/api/videos/find`, {
            songs: songs.map(({ artist, title }) => ({ artist, title })),
        })
            .then(() => {
                toast.info({
                    message: `Looking for ${songs.length} video${songs.length === 1 ? '' : 's'}`,
                });
                refresh();
            })
            .catch((e: Error) => toast.error({ message: e.message }));
    const saveLink = (m: Missing) =>
        post(`${url}/api/videos`, { query: `${m.artist} - ${m.title} | ${link.trim()}` })
            .then(() => {
                toast.success({ message: `Video saved for ${m.title}` });
                setLinkFor(null);
                setLink('');
                refresh();
            })
            .catch((e: Error) => toast.error({ message: e.message }));

    const list = (missing.data?.songs ?? []).filter((m) =>
        `${m.artist} ${m.title} ${m.album}`.toLowerCase().includes(q.trim().toLowerCase()),
    );
    const s = status.data;
    const waiting = (s?.queue?.length ?? 0) + (s?.running ? 1 : 0);
    return (
        <Card icon="🎬" title="Videos">
            <Stack gap="sm">
                <Text size="sm">
                    {videos.data?.length ?? 0} songs have a video, {missing.data?.total ?? '...'}{' '}
                    don&#39;t yet. Songs without one are looked at again every week.
                </Text>
                {!!waiting && (
                    <Text isMuted size="sm">
                        Looking for videos:{' '}
                        {s?.current ? `${s.current.artist} - ${s.current.title}` : '...'} ({waiting}{' '}
                        to go, {s?.found ?? 0} found so far)
                    </Text>
                )}
                <Group gap="xs" wrap="nowrap">
                    <TextInput
                        onChange={(e) => setQ(e.currentTarget.value)}
                        placeholder="Filter by artist, song or album"
                        style={{ flex: 1 }}
                        value={q}
                    />
                    <Button
                        disabled={!list.length}
                        onClick={() => find(list.slice(0, 500))}
                        size="xs"
                        variant="filled"
                    >
                        Find {q.trim() ? 'these' : 'all'} ({Math.min(list.length, 500)})
                    </Button>
                </Group>
                <Stack gap={4} mah={360} style={{ overflowY: 'auto' }}>
                    {list.slice(0, 150).map((m) => {
                        const id = `${m.artist}|${m.title}`;
                        return (
                            <Stack gap={4} key={id}>
                                <Group gap="xs" justify="space-between" wrap="nowrap">
                                    <Stack gap={0} miw={0}>
                                        <Text fw={600} size="sm" truncate>
                                            {m.title}
                                        </Text>
                                        <Text isMuted size="xs" truncate>
                                            {m.artist}
                                            {m.album ? ` - ${m.album}` : ''}
                                            {m.tried
                                                ? ` - none found ${new Date(m.tried).toLocaleDateString()}`
                                                : ''}
                                        </Text>
                                    </Stack>
                                    <Group gap={4} wrap="nowrap">
                                        <Button
                                            onClick={() => find([m])}
                                            size="compact-xs"
                                            variant="default"
                                        >
                                            Find
                                        </Button>
                                        <Button
                                            onClick={() => setLinkFor(linkFor === id ? null : id)}
                                            size="compact-xs"
                                            variant="subtle"
                                        >
                                            Link
                                        </Button>
                                    </Group>
                                </Group>
                                {linkFor === id && (
                                    <Group gap="xs" wrap="nowrap">
                                        <TextInput
                                            autoFocus
                                            onChange={(e) => setLink(e.currentTarget.value)}
                                            placeholder="Paste the YouTube link"
                                            size="xs"
                                            style={{ flex: 1 }}
                                            value={link}
                                        />
                                        <Button
                                            disabled={link.trim().length < 11}
                                            onClick={() => saveLink(m)}
                                            size="xs"
                                        >
                                            Save
                                        </Button>
                                    </Group>
                                )}
                            </Stack>
                        );
                    })}
                    {missing.isFetched && !list.length && (
                        <Text isMuted size="sm">
                            Every song has a video.
                        </Text>
                    )}
                </Stack>
            </Stack>
        </Card>
    );
};
