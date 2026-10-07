import { openModal } from '@mantine/modals';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';

import styles from './app-extras.module.css';

import { usePlayCountStore } from '/@/renderer/features/hermes-plays/store/play-count.store';
import { openPeople } from '/@/renderer/features/sour/components/people';
import { SongCover, usePlaySong } from '/@/renderer/features/sour/components/profile-bits';
import { openSourStudio } from '/@/renderer/features/sour/components/sour-studio';
import { toggleStage } from '/@/renderer/features/sour/stage/sour-stage';
import { type HistoryEntry, useSourStore } from '/@/renderer/features/sour/store/sour.store';
import { playSound } from '/@/renderer/features/sour/utils/sounds';
import { AppRoute } from '/@/renderer/router/routes';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

// ---------- queue history: everything played on this computer, newest first ----------
const dayLabel = (at: number) => {
    const d = new Date(at);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);
    if (d.toDateString() === today.toDateString()) return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', weekday: 'long' });
};

const History = () => {
    const history = useSourStore((s) => s.history);
    const play = usePlaySong();
    const groups: Array<[string, HistoryEntry[]]> = [];
    for (const h of history) {
        const label = dayLabel(h.at);
        const last = groups[groups.length - 1];
        if (last && last[0] === label) last[1].push(h);
        else groups.push([label, [h]]);
    }
    if (!history.length) return <Text isMuted>Nothing played yet on this computer.</Text>;
    return (
        <div className={styles.history}>
            {groups.map(([label, list]) => (
                <div key={label}>
                    <Text className={styles.day}>{label}</Text>
                    {list.map((h, i) => (
                        <button className={styles.historyRow} key={`${h.at}-${i}`} onClick={() => play(h.song)} type="button">
                            <SongCover size={34} song={h.song} />
                            <span className={styles.grow}>
                                <Text size="sm" truncate>
                                    {h.song.title}
                                </Text>
                                <Text isMuted size="xs" truncate>
                                    {h.song.artist}
                                </Text>
                            </span>
                            <span className={styles.time}>{new Date(h.at).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</span>
                        </button>
                    ))}
                </div>
            ))}
        </div>
    );
};

export const openQueueHistory = () => openModal({ children: <History />, size: 'lg', title: 'Played on this computer' });

// ---------- Sour commands for the command palette (Ctrl+K) ----------
export const sourCommands = (navigate: (to: string) => void) => [
    { label: 'Sour Stage (full screen now playing)', run: () => toggleStage(true) },
    { label: 'Sour Studio (skins, holidays, visualizers)', run: openSourStudio },
    { label: 'Sour Hub (feed, duels, gifts)', run: () => navigate(AppRoute.SOUR_HUB) },
    { label: 'Sour Library (cover wall, tools)', run: () => navigate(AppRoute.SOUR_LIBRARY) },
    { label: 'People and profiles', run: openPeople },
    { label: 'Queue history', run: openQueueHistory },
];

// ---------- startup splash ----------
export const Splash = () => {
    const splash = useSourStore((s) => s.look.splash && !s.look.reducedMotion);
    const [show, setShow] = useState(splash);
    useEffect(() => {
        if (!show) return undefined;
        const timer = setTimeout(() => setShow(false), 1500);
        return () => clearTimeout(timer);
    }, [show]);
    if (!show) return null;
    return (
        <div aria-hidden className={styles.splash}>
            <span className={styles.splashLemon}>{'\u{1F34B}'}</span>
            <span className={styles.splashName}>Sour Player</span>
        </div>
    );
};

// ---------- easter eggs: the Konami code (disco) and typing "sour" (lemon rain) ----------
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

export const EasterEggs = () => {
    const keys = useRef<string[]>([]);
    const [rain, setRain] = useState(0);
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            const el = e.target as HTMLElement | null;
            if (el && (/input|textarea|select/i.test(el.tagName) || el.isContentEditable)) return;
            keys.current = [...keys.current, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-10);
            const k = keys.current;
            if (KONAMI.every((key, i) => k[i] === key)) {
                keys.current = [];
                document.body.classList.add('sour-disco');
                playSound('lemon');
                toast.success({ message: 'Disco mode!' });
                window.setTimeout(() => document.body.classList.remove('sour-disco'), 10000);
            } else if (k.slice(-4).join('') === 'sour') {
                keys.current = [];
                setRain(Date.now());
                playSound('pop');
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, []);
    useEffect(() => {
        if (!rain) return undefined;
        const timer = setTimeout(() => setRain(0), 4500);
        return () => clearTimeout(timer);
    }, [rain]);
    if (!rain) return null;
    return (
        <div aria-hidden className={styles.rain}>
            {Array.from({ length: 36 }, (_, i) => (
                <span
                    key={i}
                    style={{
                        animationDelay: `${(i % 12) * 0.12}s`,
                        animationDuration: `${2.2 + (i % 5) * 0.3}s`,
                        left: `${(i * 37) % 100}%`,
                    }}
                >
                    {'\u{1F34B}'}
                </span>
            ))}
        </div>
    );
};

// ---------- milestone celebration: your 100th, 1000th, 10,000th play ----------
const THRESHOLDS = [100, 500, 1000, 2500, 5000, 10000, 25000];

export const MilestoneCelebration = () => {
    const days = usePlayCountStore((s) => s.days);
    const [show, setShow] = useState<null | number>(null);
    const total = Object.values(days).reduce((sum, d) => sum + Object.values(d).reduce((a, b) => a + b, 0), 0);
    useEffect(() => {
        const { seenMilestones, set } = useSourStore.getState();
        const reached = THRESHOLDS.filter((n) => total >= n);
        const primed = seenMilestones.includes('plays-primed');
        const fresh = reached.filter((n) => !seenMilestones.includes(`plays-${n}`));
        if (primed && !fresh.length) return;
        set({ seenMilestones: [...seenMilestones, ...fresh.map((n) => `plays-${n}`), ...(primed ? [] : ['plays-primed'])] });
        // the very first time, only remember what was already reached (no party for old milestones)
        if (primed && fresh.length) setShow(fresh[fresh.length - 1]);
    }, [total]);
    useEffect(() => {
        if (show === null) return undefined;
        playSound('lemon');
        const timer = setTimeout(() => setShow(null), 6000);
        return () => clearTimeout(timer);
    }, [show]);
    if (show === null) return null;
    return (
        <button className={styles.celebrate} onClick={() => setShow(null)} type="button">
            <span className={styles.celebrateNumber}>{show.toLocaleString()}</span>
            <span className={styles.celebrateText}>songs played on Sour Player!</span>
            <span className={styles.confetti}>
                {Array.from({ length: 40 }, (_, i) => (
                    <i key={i} style={{ animationDelay: `${(i % 10) * 0.1}s`, background: `hsl(${(i * 47) % 360} 85% 60%)`, left: `${(i * 29) % 100}%` }} />
                ))}
            </span>
        </button>
    );
};

// ---------- the history and command shortcuts ----------
export const ExtraShortcuts = () => {
    const navigate = useNavigate();
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (!e.ctrlKey || !e.altKey) return;
            const key = e.key.toLowerCase();
            if (key === 'h') openQueueHistory();
            else if (key === 'u') navigate(AppRoute.SOUR_HUB);
            else return;
            e.preventDefault();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [navigate]);
    return null;
};
