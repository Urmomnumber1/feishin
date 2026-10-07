import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { type GroupSong } from '/@/renderer/features/group-play/store/group-play.store';
import { searchQueries } from '/@/renderer/features/search/api/search-api';
import { ItemCover } from '/@/renderer/features/sour/components/profile-bits';
import { useCurrentServer } from '/@/renderer/store';
import { Button } from '/@/shared/components/button/button';
import { Group } from '/@/shared/components/group/group';
import { Stack } from '/@/shared/components/stack/stack';
import { TextInput } from '/@/shared/components/text-input/text-input';
import { Text } from '/@/shared/components/text/text';

type AlbumEntry = GroupSong & { note?: string };

// Album of the week: pin one album to your profile with a line about why
export const AlbumOfWeekPicker = ({
    onChange,
    value,
}: {
    onChange: (value: AlbumEntry | null) => void;
    value: AlbumEntry | null;
}) => {
    const server = useCurrentServer();
    const [text, setText] = useState('');
    const [term, setTerm] = useState('');
    useEffect(() => {
        const t = setTimeout(() => setTerm(text.trim()), 300);
        return () => clearTimeout(t);
    }, [text]);
    const found = useQuery(
        searchQueries.search({
            options: { enabled: !!server?.id && term.length >= 2 },
            query: { albumArtistLimit: 0, albumLimit: 6, query: term, songLimit: 0 },
            serverId: server?.id || '',
        }),
    );
    return (
        <Stack gap={6}>
            <Text fw={700}>Album of the week</Text>
            {value ? (
                <>
                    <Group gap="sm" wrap="nowrap">
                        <div style={{ width: 56 }}>
                            <ItemCover entry={value} />
                        </div>
                        <Text flex={1} size="sm" truncate>
                            {value.title} - {value.artist}
                        </Text>
                        <Button onClick={() => onChange(null)} size="compact-xs" variant="subtle">
                            Remove
                        </Button>
                    </Group>
                    <TextInput
                        maxLength={200}
                        onChange={(e) => onChange({ ...value, note: e.currentTarget.value })}
                        placeholder="Why this one?"
                        size="xs"
                        value={value.note ?? ''}
                    />
                </>
            ) : (
                <>
                    <TextInput
                        onChange={(e) => setText(e.currentTarget.value)}
                        placeholder="Search for an album"
                        size="xs"
                        value={text}
                    />
                    {(found.data?.albums ?? []).map((a) => (
                        <Button
                            justify="flex-start"
                            key={a.id}
                            onClick={() =>
                                onChange({
                                    album: a.name,
                                    artist: a.albumArtistName,
                                    duration: 0,
                                    id: `album:${a.id}`,
                                    imageId: a.imageId ?? null,
                                    title: a.name,
                                })
                            }
                            size="compact-sm"
                            variant="subtle"
                        >
                            {a.name} - {a.albumArtistName}
                        </Button>
                    ))}
                </>
            )}
        </Stack>
    );
};
