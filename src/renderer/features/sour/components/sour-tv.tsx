import { closeAllModals, openModal } from '@mantine/modals';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';

import styles from './sour-tv.module.css';

import { useItemImageUrl } from '/@/renderer/components/item-image/item-image';
import { groupApi } from '/@/renderer/features/group-play/api/group-play-api';
import {
    type GroupChat,
    useGroupPlayStore,
} from '/@/renderer/features/group-play/store/group-play.store';
import {
    useHermesUrl,
    useHermesVideoStore,
} from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { lyricsQueries } from '/@/renderer/features/lyrics/api/lyrics-api';
import { ProfileAvatar } from '/@/renderer/features/sour/components/profile-bits';
import { isIosApp, sourMedia } from '/@/renderer/features/sour/mobile/android';
import { toLines } from '/@/renderer/features/sour/stage/sour-stage';
import {
    useMyProfile,
    useSourProfiles,
    useSourStore,
} from '/@/renderer/features/sour/store/sour.store';
import {
    ask,
    leaveGroupFirst,
    leaveListenAlongFirst,
} from '/@/renderer/features/sour/utils/switching';
import { usePlayerSong } from '/@/renderer/store';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';
import { Button } from '/@/shared/components/button/button';
import { Icon } from '/@/shared/components/icon/icon';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';
import { LibraryItem } from '/@/shared/types/domain-types';
import { type QueueSong } from '/@/shared/types/domain-types';
import { PlayerStatus } from '/@/shared/types/types';

// Sour Player TV: an admin's phone, mirrored to the TV (Screen Mirroring / AirPlay on iPhone, Cast
// screen on Android), runs Group Play for an in-person event. Only people the admin adds are in it;
// everyone else sees "Listening to ... on Sour Player TV - <event>" and can't join or listen along.
export const useSourTv = create<{ lyrics: boolean; open: boolean }>(() => ({
    lyrics: true,
    open: false,
}));

export const isTvHost = () => {
    const { role, state } = useGroupPlayStore.getState();
    return role === 'host' && !!state?.tv && !state.ended;
};

const StartTv = () => {
    const url = useHermesUrl();
    const me = useSourStore((state) => state.me);
    const profile = useMyProfile().data;
    const [event, setEvent] = useState('');
    const [busy, setBusy] = useState(false);
    const start = async () => {
        if (!me || !profile) return;
        if (!(await leaveListenAlongFirst())) return;
        setBusy(true);
        try {
            const res = await groupApi.create(url, event.trim() || 'Party', profile.name, me.id, {
                event: event.trim() || 'Party',
                key: me.key,
            });
            const player = usePlayerStoreBase.getState();
            player.mediaStop();
            player.clearQueue();
            const { actions } = useGroupPlayStore.getState();
            actions.setSession({ code: res.code, hostKey: res.hostKey, role: 'host' });
            actions.setState(res.state);
            saveTvSession({ code: res.code, hostKey: res.hostKey });
            closeAllModals();
            useSourTv.setState({ open: true });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };
    return (
        <Stack gap="md">
            <Text size="sm">
                Put this phone on the TV first: on iPhone, Control Center &gt; Screen Mirroring; on
                Android, Quick Settings &gt; Cast (or Screen Cast) and pick the Chromecast or TV.
            </Text>
            <TextInput
                autoFocus
                label="Event name"
                maxLength={60}
                onChange={(e) => setEvent(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && start()}
                placeholder="Friday Night Hangout"
                value={event}
            />
            <Text isMuted size="xs">
                Friends who aren&#39;t there see what&#39;s playing, but can&#39;t join or listen
                along. Add the people who are there from the TV screen.
            </Text>
            <Button loading={busy} onClick={start} variant="filled">
                Start Sour Player TV
            </Button>
        </Stack>
    );
};

// the party is remembered on this phone, so closing or reloading the app doesn't lose it
const TV_SESSION = 'sour-tv-session';
const saveTvSession = (session: null | { code: string; hostKey: string }) => {
    try {
        if (session) localStorage.setItem(TV_SESSION, JSON.stringify(session));
        else localStorage.removeItem(TV_SESSION);
    } catch {
        // private mode: the party just isn't remembered
    }
};

export const ResumeTv = () => {
    const url = useHermesUrl();
    useEffect(() => {
        if (!url || useGroupPlayStore.getState().code) return;
        let saved: null | { code: string; hostKey: string } = null;
        try {
            saved = JSON.parse(localStorage.getItem(TV_SESSION) || 'null');
        } catch {
            saved = null;
        }
        if (!saved?.code || !saved.hostKey) return;
        const { code, hostKey } = saved;
        groupApi
            .resume(url, code, hostKey)
            .then((res) => {
                if (!res.state.tv || res.state.ended) return saveTvSession(null);
                const { actions } = useGroupPlayStore.getState();
                actions.setSession({ code, hostKey, role: 'host' });
                actions.setState(res.state);
                useSourTv.setState({ open: true });
                toast.info({ message: `Back on ${res.state.tv.event}` });
                return undefined;
            })
            .catch(() => saveTvSession(null)); // the party ended while the app was closed
    }, [url]);
    return null;
};

export const openSourTv = () => {
    if (isTvHost()) {
        useSourTv.setState({ open: true });
        return;
    }
    openModal({ children: <StartTv />, title: 'Sour Player TV' });
};

// the people at the event: add them so they're in the party (their profile shows it, they can add songs)
const AddMembers = () => {
    const url = useHermesUrl();
    const profiles = useSourProfiles().data ?? [];
    const state = useGroupPlayStore((s) => s.state);
    const hostKey = useGroupPlayStore((s) => s.hostKey);
    const [q, setQ] = useState('');
    const members = new Set(state?.tv?.members ?? []);
    const shown = profiles
        .filter((p) => p.name.toLowerCase().includes(q.trim().toLowerCase()))
        .sort(
            (a, b) =>
                Number(members.has(b.id)) - Number(members.has(a.id)) ||
                a.name.localeCompare(b.name),
        );
    const toggle = (id: string) => {
        if (!state || !hostKey) return;
        groupApi
            .tvMember(url, state.code, hostKey, members.has(id) ? { remove: id } : { add: id })
            .catch((error: Error) => toast.error({ message: error.message }));
    };
    return (
        <Stack gap="sm">
            <TextInput
                leftSection={<Icon icon="search" />}
                onChange={(e) => setQ(e.currentTarget.value)}
                placeholder="Find someone"
                value={q}
            />
            <div className={styles.people}>
                {shown.map((p) => {
                    const here = members.has(p.id);
                    const isHost = p.id === state?.hostProfile;
                    return (
                        <button
                            className={here ? styles['person-here'] : styles.person}
                            disabled={isHost}
                            key={p.id}
                            onClick={() => toggle(p.id)}
                            type="button"
                        >
                            <ProfileAvatar profile={p} size={40} />
                            <Text fw={600} size="sm" truncate>
                                {p.name}
                            </Text>
                            <Text className={styles['person-state']} size="xs">
                                {isHost ? 'Host' : here ? 'Here' : 'Add'}
                            </Text>
                        </button>
                    );
                })}
            </div>
        </Stack>
    );
};

// above the TV screen (it covers everything else)
const openAddMembers = () =>
    openModal({ children: <AddMembers />, title: 'Who is here?', zIndex: 500 });

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// end the party for everyone (statuses clear, the TV screen closes)
const endParty = async () => {
    const { code, hostKey, state } = useGroupPlayStore.getState();
    if (!code || !hostKey) return;
    const yes = await ask(
        `End ${state?.tv?.event || 'the party'}?`,
        'The music stops for everyone and friends stop seeing it on your profiles.',
        'End party',
    );
    if (!yes) return;
    await groupApi.end(useHermesVideoStore.getState().url, code, hostKey).catch(() => {});
    saveTvSession(null);
    useGroupPlayStore.getState().actions.leave();
    useSourTv.setState({ open: false });
};

// the line being sung, big, with the next one under it (synced lyrics only)
const TvLyrics = ({ song, time }: { song: QueueSong | undefined; time: number }) => {
    const { data } = useQuery(
        lyricsQueries.songLyrics(
            {
                options: { enabled: !!song?.id },
                query: { songId: song?.id || '' },
                serverId: song?._serverId || '',
            },
            song,
        ),
    );
    const selected = data?.selected as null | undefined | { lyrics?: unknown };
    const { lines, synced } = useMemo(() => toLines(selected?.lyrics), [selected]);
    if (!synced || !lines.length) return null;
    const nowMs = time * 1000 + (data?.selectedOffsetMs ?? 0);
    let current = -1;
    for (let i = 0; i < lines.length; i++) if (lines[i].startMs <= nowMs + 150) current = i;
    return (
        <div className={styles.lyrics}>
            <div className={styles['lyric-now']} key={current}>
                {current >= 0 ? lines[current].text || '...' : '...'}
            </div>
            <div className={styles['lyric-next']}>{lines[current + 1]?.text || ''}</div>
        </div>
    );
};

// The TV screen: big and readable from the couch, landscape or portrait
export const SourTvScreen = () => {
    const open = useSourTv((s) => s.open);
    const showLyrics = useSourTv((s) => s.lyrics);
    const state = useGroupPlayStore((s) => s.state);
    const role = useGroupPlayStore((s) => s.role);
    const clockOffset = useGroupPlayStore((s) => s.clockOffset);
    const song = usePlayerSong();
    const status = usePlayerStoreBase((s) => s.player.status);
    const time = useTimestampStoreBase((s) => s.timestamp);
    const profiles = useSourProfiles().data ?? [];
    // the cover the way the rest of the app gets it (from the music server, big enough for a TV)
    const cover =
        useItemImageUrl({
            id: song?.imageId,
            imageUrl: song?.imageUrl,
            itemType: LibraryItem.SONG,
            serverId: song?._serverId,
            size: 800,
        }) || null;
    const [clock, setClock] = useState(() => new Date());
    useEffect(() => {
        if (!open) return undefined;
        const t = window.setInterval(() => setClock(new Date()), 15000);
        return () => window.clearInterval(t);
    }, [open]);
    // the phone is on the TV: don't let it lock itself (asked again when the app comes back to the front)
    useEffect(() => {
        if (!open) return undefined;
        // the iPhone app keeps itself awake natively (the browser way isn't there on every iOS)
        if (isIosApp()) {
            sourMedia('keepAwake', { on: true }).catch(() => {});
            return () => {
                sourMedia('keepAwake', { on: false }).catch(() => {});
            };
        }
        if (!('wakeLock' in navigator)) return undefined;
        let lock: null | { release: () => Promise<void> } = null;
        const ask = () => {
            if (document.visibilityState !== 'visible') return;
            navigator.wakeLock
                .request('screen')
                .then((l) => {
                    lock = l;
                })
                .catch(() => {});
        };
        ask();
        document.addEventListener('visibilitychange', ask);
        return () => {
            document.removeEventListener('visibilitychange', ask);
            lock?.release().catch(() => {});
        };
    }, [open]);
    useEffect(() => {
        document.documentElement.classList.toggle('sour-tv-open', open);
        return () => document.documentElement.classList.remove('sour-tv-open');
    }, [open]);
    // the party ended (or this phone left it): the TV screen goes too
    useEffect(() => {
        if (open && (!state?.tv || state.ended || role !== 'host'))
            useSourTv.setState({ open: false });
    }, [open, role, state]);
    // the newest chat message pops up for 10 seconds (old messages don't, when the TV opens)
    const lastChat = state?.chat?.[state.chat.length - 1];
    const [chat, setChat] = useState<GroupChat | null>(null);
    const lastChatId = lastChat?.id;
    const lastChatRef = useRef(lastChat);
    lastChatRef.current = lastChat;
    useEffect(() => {
        const msg = lastChatRef.current;
        if (!msg || Date.now() + clockOffset - msg.at > 12000) return undefined;
        setChat(msg);
        const t = window.setTimeout(() => setChat(null), 10000);
        return () => {
            window.clearTimeout(t);
            setChat(null);
        };
    }, [clockOffset, lastChatId]);
    const here = profiles.filter((p) => state?.tv?.members.includes(p.id));
    if (!open || !state?.tv) return null;
    const upNext = state.queue.slice(state.index + 1, state.index + 4);
    const nowBy = state.queue[state.index]?.by;
    const duration = song?.duration ? song.duration / 1000 : 0;
    const player = usePlayerStoreBase.getState();
    return (
        <div className={styles.tv}>
            {cover && (
                <div className={styles.backdrop} style={{ backgroundImage: `url("${cover}")` }} />
            )}
            <header className={styles.top}>
                <div>
                    <div className={styles.brand}>Sour Player TV</div>
                    <div className={styles.event}>{state.tv.event}</div>
                </div>
                <div className={styles.clock}>
                    {clock.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                </div>
            </header>
            <main className={styles.main}>
                <div className={styles.cover}>
                    {cover ? <img alt="" src={cover} /> : <Icon icon="itemAlbum" size="5rem" />}
                </div>
                <div className={styles.info}>
                    <div className={styles.title}>{song?.name || 'Waiting for the first song'}</div>
                    {!song && (
                        <div className={styles.hint}>
                            Press Group Play to add songs. People you add can queue songs from their
                            phones too.
                        </div>
                    )}
                    <div className={styles.artist}>{song?.artistName || ''}</div>
                    {!!song && !!nowBy && <div className={styles.by}>Added by {nowBy}</div>}
                    {!!song && (
                        <>
                            <div className={styles.bar}>
                                <span
                                    style={{
                                        width: `${duration ? Math.min(100, (time / duration) * 100) : 0}%`,
                                    }}
                                />
                            </div>
                            <div className={styles.times}>
                                <span>{fmt(time)}</span>
                                <span>{duration ? fmt(duration) : ''}</span>
                            </div>
                        </>
                    )}
                    {showLyrics && <TvLyrics song={song} time={time} />}
                    {!!upNext.length && (
                        <div className={styles.next}>
                            <div className={styles.label}>Up next</div>
                            {upNext.map((x) => (
                                <div className={styles['next-row']} key={x.id}>
                                    <span>{x.title}</span>
                                    <span className={styles.dim}>
                                        {x.artist}
                                        {x.by ? ` - ${x.by}` : ''}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
            {chat && (
                <div className={styles.chat} key={chat.id}>
                    <b>{chat.by}</b> {chat.text}
                </div>
            )}
            <footer className={styles.bottom}>
                <div className={styles.faces}>
                    {here.slice(0, 12).map((p) => (
                        <span key={p.id} title={p.name}>
                            <ProfileAvatar profile={p} size={34} />
                        </span>
                    ))}
                    {here.length > 12 && <span className={styles.dim}>+{here.length - 12}</span>}
                </div>
                <div className={styles.controls}>
                    <button onClick={() => player.mediaPrevious(false)} type="button">
                        <Icon icon="mediaPrevious" size="lg" />
                    </button>
                    <button
                        className={styles.play}
                        onClick={() => player.mediaTogglePlayPause()}
                        type="button"
                    >
                        <Icon
                            icon={status === PlayerStatus.PLAYING ? 'mediaPause' : 'mediaPlay'}
                            size="xl"
                        />
                    </button>
                    <button onClick={() => player.mediaNext(false)} type="button">
                        <Icon icon="mediaNext" size="lg" />
                    </button>
                </div>
                <div className={styles.actions}>
                    <button
                        onClick={() => {
                            useSourTv.setState({ open: false });
                            useGroupPlayStore.setState({ panelOpen: true });
                        }}
                        type="button"
                    >
                        <Icon icon="queue" /> Group Play
                    </button>
                    <button
                        onClick={() => useSourTv.setState({ lyrics: !showLyrics })}
                        type="button"
                    >
                        <Icon icon="microphone" /> {showLyrics ? 'Hide lyrics' : 'Lyrics'}
                    </button>
                    <button onClick={openAddMembers} type="button">
                        <Icon icon="add" /> Add member
                    </button>
                    <button onClick={endParty} type="button">
                        End party
                    </button>
                    <button onClick={() => useSourTv.setState({ open: false })} type="button">
                        <Icon icon="x" />
                    </button>
                </div>
            </footer>
        </div>
    );
};

// Someone the host added to a Sour Player TV party: offer to join from their own phone, to add
// songs and react (watch-only, so their phone doesn't play the music the TV already plays).
// Asked once per party.
const offered = new Set<string>();
export const TvInvite = () => {
    const url = useHermesUrl();
    const me = useSourStore((s) => s.me);
    const profile = useMyProfile().data;
    const code = useGroupPlayStore((s) => s.code);
    const tv = profile?.tv;
    useEffect(() => {
        if (!url || !me || !profile || !tv?.code || tv.hosting || code === tv.code) return;
        if (offered.has(tv.code)) return;
        // another dialog is open (release notes, a sheet...): ask on the next profile check instead
        if (document.querySelector('.mantine-Modal-content')) return;
        offered.add(tv.code);
        void (async () => {
            const yes = await ask(
                `You're at ${tv.event}`,
                `${tv.host} added you to their Sour Player TV party. Join from this phone to add songs and send reactions? (The music stays on the TV.)`,
                'Join',
            );
            if (!yes || !tv.code) return;
            if (code && !(await leaveGroupFirst())) return;
            try {
                const res = await groupApi.join(url, tv.code, profile.name, me.id, true);
                const { actions } = useGroupPlayStore.getState();
                useGroupPlayStore.setState({ panelOpen: true, spectate: true });
                actions.setSession({ code: tv.code, member: res.member, role: 'member' });
                actions.setState(res.state);
            } catch (error) {
                toast.error({ message: (error as Error).message });
            }
        })();
    }, [code, me, profile, tv, url]);
    return null;
};
