import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { create } from 'zustand';

import styles from './social-watchers.module.css';

import { toGroupSong } from '/@/renderer/features/group-play/api/group-play-api';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { socialApi, type WrappedNight } from '/@/renderer/features/sour/api/social-api';
import { usePlaySong } from '/@/renderer/features/sour/components/profile-bits';
import { notify, openRecap } from '/@/renderer/features/sour/components/social';
import { useSourStore } from '/@/renderer/features/sour/store/sour.store';
import { queueGroupSongs } from '/@/renderer/features/sour/utils/queue';
import { useCurrentServer, usePlayerSong } from '/@/renderer/store';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Text } from '/@/shared/components/text/text';
import { Play } from '/@/shared/types/types';

// the group's colour of the day (from Hermes Music; the look switches wear it)
export const useDailyColorStore = create<{ color: null | string }>(() => ({ color: null }));

const today = () => new Date().toISOString().slice(0, 10);
const told = new Set<string>();

// Things friends send you (gifts, "play this next"), sticky notes on songs, "on repeat", the colour of
// the day and the recap night countdown.
export const SocialWatchers = () => {
    const url = useHermesUrl();
    const me = useSourStore((s) => s.me);
    const toasts = useSourStore((s) => s.look.socialToasts);
    const dailyTheme = useSourStore((s) => s.look.dailyTheme);
    const song = usePlayerSong();
    const serverId = useCurrentServer()?.id;
    const qc = useQueryClient();
    const play = usePlaySong();
    const [night, setNight] = useState<WrappedNight>({});
    const [now, setNow] = useState(() => Date.now());
    const lastSong = useRef<null | string>(null);

    // gifts and asks
    useEffect(() => {
        if (!url || !me || !toasts) return undefined;
        let first = true;
        const check = async () => {
            const [gifts, asks] = await Promise.all([
                socialApi.gifts(url, me).catch(() => null),
                socialApi.asks(url, me).catch(() => null),
            ]);
            for (const g of gifts?.received ?? []) {
                if (g.opened || told.has(`gift:${g.id}`)) continue;
                told.add(`gift:${g.id}`);
                if (first && Date.now() - g.at > 3600000) continue; // old ones live in the Sour Hub
                notify(
                    `${g.fromName} sent you a gift`,
                    <Group gap="xs">
                        <Text size="sm">A wrapped song is waiting.</Text>
                        <Button
                            onClick={() =>
                                socialApi
                                    .openGift(url, me, g.id)
                                    .then((opened) => {
                                        play(opened.song);
                                        if (opened.note) notify(`From ${g.fromName}`, opened.note);
                                    })
                                    .catch(() => {})
                            }
                            size="compact-xs"
                        >
                            Unwrap
                        </Button>
                    </Group>,
                    20000,
                );
            }
            for (const a of asks?.received ?? []) {
                if (told.has(`ask:${a.id}`)) continue;
                told.add(`ask:${a.id}`);
                notify(
                    `${a.fromName} asks you to play this next`,
                    <Group gap="xs">
                        <Text size="sm">
                            {a.song.title} - {a.song.artist}
                        </Text>
                        <Button
                            onClick={() =>
                                serverId &&
                                queueGroupSongs(
                                    [a.song],
                                    Play.NEXT,
                                    { queryClient: qc, serverId },
                                    `${a.fromName} asked for this`,
                                )
                                    .then(() => socialApi.answerAsk(url, me, a.id, true))
                                    .catch(() => {})
                            }
                            size="compact-xs"
                        >
                            Play next
                        </Button>
                        <Button
                            onClick={() =>
                                socialApi.answerAsk(url, me, a.id, false).catch(() => {})
                            }
                            size="compact-xs"
                            variant="subtle"
                        >
                            No thanks
                        </Button>
                    </Group>,
                    30000,
                );
            }
            first = false;
        };
        check();
        const timer = setInterval(check, 45000);
        return () => clearInterval(timer);
    }, [me, play, qc, serverId, toasts, url]);

    // every song: remember it (queue history), sticky notes from friends, "on repeat"
    useEffect(() => {
        if (!song || song._uniqueId === lastSong.current) return;
        lastSong.current = song._uniqueId;
        const entry = toGroupSong(song);
        const { history, repeatNotified, set } = useSourStore.getState();
        const nextHistory = [{ at: Date.now(), song: entry }, ...history].slice(0, 300);
        set({ history: nextHistory });
        if (!url) return;
        if (toasts) {
            socialApi
                .notes(url, song.id)
                .then((notes) => {
                    const theirs = notes.filter((n) => n.from !== me?.id).slice(0, 3);
                    if (theirs.length && !told.has(`notes:${song.id}`)) {
                        told.add(`notes:${song.id}`);
                        notify(
                            'Sticky notes on this song',
                            theirs.map((n) => `${n.fromName}: ${n.text}`).join('\n'),
                            12000,
                        );
                    }
                })
                .catch(() => {});
        }
        const day = today();
        const plays = nextHistory.filter(
            (h) => h.song.id === song.id && new Date(h.at).toISOString().slice(0, 10) === day,
        ).length;
        if (me && plays >= 10 && repeatNotified[song.id] !== day) {
            set({
                repeatNotified: {
                    ...Object.fromEntries(
                        Object.entries(repeatNotified).filter(([, d]) => d === day),
                    ),
                    [song.id]: day,
                },
            });
            socialApi.repeat(url, me, entry, plays).catch(() => {});
        }
    }, [me, song, toasts, url]);

    // colour of the day
    useEffect(() => {
        if (!url || !dailyTheme) return undefined;
        const check = () =>
            socialApi
                .dailyColor(url, me)
                .then((d) => useDailyColorStore.setState({ color: d.today }))
                .catch(() => {});
        check();
        const timer = setInterval(check, 15 * 60000);
        return () => clearInterval(timer);
    }, [dailyTheme, me, url]);

    // recap night
    useEffect(() => {
        if (!url) return undefined;
        const check = () =>
            socialApi
                .wrapped(url)
                .then(setNight)
                .catch(() => {});
        check();
        const poll = setInterval(check, 120000);
        const tick = setInterval(() => setNow(Date.now()), 1000);
        return () => {
            clearInterval(poll);
            clearInterval(tick);
        };
    }, [url]);
    useEffect(() => {
        if (
            night.at &&
            now >= night.at &&
            now - night.at < 5000 &&
            !told.has(`wrapped:${night.at}`)
        ) {
            told.add(`wrapped:${night.at}`);
            notify('Recap night!', "It's time - everyone's opening their recap now.", 15000);
            openRecap();
        }
    }, [night.at, now]);

    const left = night.at ? night.at - now : 0;
    if (!night.at || left <= 0 || left > 3600000) return null;
    const m = Math.floor(left / 60000);
    const s = Math.floor((left % 60000) / 1000);
    return (
        <div className={styles.countdown} role="timer">
            Recap night in {m}:{String(s).padStart(2, '0')}
        </div>
    );
};
