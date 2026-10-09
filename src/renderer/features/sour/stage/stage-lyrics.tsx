import { useQuery, useQueryClient } from '@tanstack/react-query';
import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import styles from './sour-stage.module.css';

import { queryKeys } from '/@/renderer/api/query-keys';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { type LyricsQueryResult } from '/@/renderer/features/lyrics/api/lyrics-api';
import { openLyricSearchModal } from '/@/renderer/features/lyrics/components/lyrics-search-form';
import { searchQueries } from '/@/renderer/features/search/api/search-api';
import { useSourStore } from '/@/renderer/features/sour/store/sour.store';
import { useCurrentServer } from '/@/renderer/store';
import { addToQueueByData, usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';
import { Icon } from '/@/shared/components/icon/icon';
import { toast } from '/@/shared/components/toast/toast';
import { type LyricsOverride, type QueueSong, type Song } from '/@/shared/types/domain-types';
import { Play, PlayerStatus } from '/@/shared/types/types';

export interface Line {
    cues?: { endMs: number; startMs: number; text: string }[];
    startMs: number;
    text: string;
}

// The song position, smooth: the player only reports it about twice a second, which made karaoke
// words light up in jumps. In between it's worked out from the clock (about 30 times a second).
export const useSmoothMs = (offsetMs: number) => {
    const [ms, setMs] = useState(
        () => useTimestampStoreBase.getState().timestamp * 1000 + offsetMs,
    );
    useEffect(() => {
        let raw = useTimestampStoreBase.getState().timestamp;
        let at = performance.now();
        let shown = raw;
        const unsubscribe = useTimestampStoreBase.subscribe((state) => {
            raw = state.timestamp;
            at = performance.now();
        });
        let frame = 0;
        let last = 0;
        const loop = (now: number) => {
            frame = requestAnimationFrame(loop);
            if (now - last < 33) return;
            last = now;
            const { speed, status } = usePlayerStoreBase.getState().player;
            const playing = status === PlayerStatus.PLAYING;
            let t = raw + (playing ? ((now - at) / 1000) * (speed > 0 ? speed : 1) : 0);
            // a report that lands a little behind the estimate shouldn't make words un-light
            if (t < shown && shown - t < 0.35) t = shown;
            shown = t;
            setMs(t * 1000 + offsetMs);
        };
        frame = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(frame);
            unsubscribe();
        };
    }, [offsetMs]);
    return ms;
};

// when each word is sung: the lyrics' own word timings, or the line's time shared out by letters
const timedWords = (line: Line, next?: Line) => {
    if (line.cues?.length) {
        return line.cues.map((c, i, all) => ({
            end: c.endMs > c.startMs ? c.endMs : (all[i + 1]?.startMs ?? c.startMs + 400),
            start: c.startMs,
            text: c.text,
        }));
    }
    const gap = (next ? next.startMs : line.startMs + 5000) - line.startMs;
    // people finish a line a little before the next one starts
    const length = Math.min(9000, Math.max(700, gap * 0.88));
    const tokens = line.text.split(/(\s+)/).filter((t) => t.length);
    const letters = tokens.reduce((n, t) => n + (t.trim() ? t.length : 0), 0) || 1;
    let at = line.startMs;
    return tokens.map((text) => {
        const span = text.trim() ? (text.length / letters) * length : 0;
        const word = { end: at + span, start: at, text };
        at += span;
        return word;
    });
};

// Karaoke: each word fills with colour as it's sung
export const KaraokeLine = ({
    line,
    next,
    offsetMs,
}: {
    line: Line;
    next?: Line;
    offsetMs: number;
}) => {
    const nowMs = useSmoothMs(offsetMs);
    const words = useMemo(() => timedWords(line, next), [line, next]);
    return (
        <>
            {words.map((w, i) => {
                const fill = Math.min(
                    1,
                    Math.max(0, (nowMs - w.start) / Math.max(1, w.end - w.start)),
                );
                return (
                    <span
                        className={styles.word}
                        key={`${i}-${w.start}`}
                        style={{ '--fill': `${Math.round(fill * 100)}%` } as CSSProperties}
                    >
                        {w.text}
                    </span>
                );
            })}
        </>
    );
};

const plainTitle = (name: string) =>
    name.replace(/\s*[([](instrumental|karaoke|off vocal)[^)\]]*[)\]]/i, '').trim();
const simple = (s: string) =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();

// Karaoke mode: switch to the song's instrumental (from Hermes Music's /karaoke) at the same spot, or
// ask Hermes Music to get it
const SingAlong = ({ song }: { song: QueueSong }) => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const serverId = useCurrentServer()?.id;
    const title = plainTitle(song.name);
    const instrumentalNow = title !== song.name;
    const found = useQuery(
        searchQueries.search({
            options: { enabled: !!serverId && !!title, staleTime: 5 * 60000 },
            query: { albumArtistLimit: 0, albumLimit: 0, query: title, songLimit: 40 },
            serverId: serverId || '',
        }),
    );
    const artist = simple(song.artistName || '');
    const sameArtist = (s: Song) =>
        !artist || simple(s.artistName || '').includes(artist.split(' ')[0]);
    const other = (found.data?.songs ?? []).find(
        (s) =>
            s.id !== song.id &&
            sameArtist(s) &&
            simple(plainTitle(s.name)) === simple(title) &&
            (instrumentalNow ? plainTitle(s.name) === s.name : plainTitle(s.name) !== s.name),
    );

    const swap = async () => {
        if (!other) return;
        const position = useTimestampStoreBase.getState().timestamp;
        await addToQueueByData(Play.NEXT, [other]);
        usePlayerStoreBase.getState().mediaNext(false);
        window.setTimeout(() => usePlayerStoreBase.getState().mediaSeekToTimestamp(position), 450);
    };
    const ask = async () => {
        try {
            const res = await fetch(`${url}/api/requests`, {
                body: JSON.stringify({
                    by: undefined,
                    profile: me?.id,
                    query: `${song.artistName} - ${title}`,
                    type: 'karaoke',
                }),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(json.error || `Hermes Music returned ${res.status}`);
            toast.success({
                message: `Hermes Music is getting the instrumental of ${title} - it's here after the next library scan`,
            });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        }
    };

    if (other) {
        return (
            <button
                className={styles.textTool}
                onClick={swap}
                title={instrumentalNow ? 'Back to the song with vocals' : 'Play the instrumental'}
                type="button"
            >
                <Icon icon="microphone" /> {instrumentalNow ? 'With vocals' : 'Sing it'}
            </button>
        );
    }
    if (instrumentalNow || !url || !found.isFetched) return null;
    return (
        <button
            className={styles.textTool}
            onClick={ask}
            title="Ask Hermes Music for this song's instrumental"
            type="button"
        >
            <Icon icon="download" /> Get the instrumental
        </button>
    );
};

// lyrics timing and source (what used to be in the separate lyrics view)
export const LyricsTools = ({
    karaoke,
    offsetMs,
    song,
}: {
    karaoke: boolean;
    offsetMs: number;
    song?: QueueSong;
}) => {
    const queryClient = useQueryClient();
    if (!song?._serverId || !song.id) return null;
    const key = queryKeys.songs.lyrics(song._serverId, { songId: song.id });
    const shift = (by: number) =>
        queryClient.setQueryData<LyricsQueryResult>(key, (prev) =>
            prev ? { ...prev, selectedOffsetMs: (prev.selectedOffsetMs ?? 0) + by } : prev,
        );
    const find = () =>
        openLyricSearchModal({
            artist: song.artistName,
            name: song.name,
            onSearchOverride: (params: LyricsOverride) => {
                queryClient.setQueryData<LyricsQueryResult>(key, (prev) =>
                    prev ? { ...prev, overrideSelection: params } : prev,
                );
                queryClient.invalidateQueries({ queryKey: key });
            },
        });
    return (
        <div className={styles.lyricTools}>
            <button
                className={styles.textTool}
                onClick={() => shift(-250)}
                title="Lyrics too early? Show them later"
                type="button"
            >
                -0.25s
            </button>
            <span className={styles.offset} title="Lyrics timing">
                {offsetMs > 0 ? '+' : ''}
                {(offsetMs / 1000).toFixed(2)}s
            </span>
            <button
                className={styles.textTool}
                onClick={() => shift(250)}
                title="Lyrics too late? Show them sooner"
                type="button"
            >
                +0.25s
            </button>
            <button
                className={styles.textTool}
                onClick={find}
                title="Find other lyrics"
                type="button"
            >
                <Icon icon="search" /> Lyrics
            </button>
            {karaoke && <SingAlong song={song} />}
        </div>
    );
};
