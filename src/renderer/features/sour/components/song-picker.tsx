import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import styles from './song-picker.module.css';

import { toGroupSong } from '/@/renderer/features/group-play/api/group-play-api';
import { type GroupSong } from '/@/renderer/features/group-play/store/group-play.store';
import { searchQueries } from '/@/renderer/features/search/api/search-api';
import { SongCover } from '/@/renderer/features/sour/components/profile-bits';
import { useCurrentServer, usePlayerSong } from '/@/renderer/store';
import { Button } from '/@/shared/components/button/button';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';

// Pick a song from the music server: search, or take the one that's playing.
export const SongPicker = ({
    onPick,
    picked,
}: {
    onPick: (song: GroupSong | null) => void;
    picked: GroupSong | null;
}) => {
    const server = useCurrentServer();
    const playing = usePlayerSong();
    const [text, setText] = useState('');
    const [term, setTerm] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => setTerm(text.trim()), 300);
        return () => clearTimeout(timer);
    }, [text]);
    const results = useQuery(
        searchQueries.search({
            options: { enabled: !!server?.id && term.length >= 2 },
            query: { albumArtistLimit: 0, albumLimit: 0, query: term, songLimit: 8 },
            serverId: server?.id || '',
        }),
    );

    if (picked) {
        return (
            <div className={styles.picked}>
                <SongCover size={40} song={picked} />
                <div className={styles.text}>
                    <Text fw={600} size="sm" truncate>
                        {picked.title}
                    </Text>
                    <Text isMuted size="xs" truncate>
                        {picked.artist}
                    </Text>
                </div>
                <Button onClick={() => onPick(null)} size="compact-xs" variant="subtle">
                    Change
                </Button>
            </div>
        );
    }

    return (
        <div className={styles.picker}>
            <div className={styles.row}>
                <TextInput
                    flex={1}
                    onChange={(e) => setText(e.currentTarget.value)}
                    placeholder="Search for a song"
                    size="xs"
                    value={text}
                />
                {playing && (
                    <Button onClick={() => onPick(toGroupSong(playing))} size="compact-xs" variant="default">
                        Playing now
                    </Button>
                )}
            </div>
            {term.length >= 2 && (
                <div className={styles.results}>
                    {(results.data?.songs ?? []).map((song) => {
                        const s = toGroupSong(song);
                        return (
                            <button className={styles.result} key={song.id} onClick={() => onPick(s)} type="button">
                                <SongCover size={30} song={s} />
                                <div className={styles.text}>
                                    <Text size="sm" truncate>
                                        {s.title}
                                    </Text>
                                    <Text isMuted size="xs" truncate>
                                        {s.artist}
                                    </Text>
                                </div>
                            </button>
                        );
                    })}
                    {results.isFetched && !results.data?.songs.length && (
                        <Text isMuted size="xs">
                            Nothing found
                        </Text>
                    )}
                </div>
            )}
        </div>
    );
};
