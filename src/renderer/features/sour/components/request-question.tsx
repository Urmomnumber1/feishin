import { closeModal, openModal } from '@mantine/modals';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import styles from './request-question.module.css';

import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { requestApi, type RequestGuess } from '/@/renderer/features/sour/api/sour-api';
import { Button } from '/@/shared/components/button/button';
import { Text } from '/@/shared/components/text/text';
import { toast } from '/@/shared/components/toast/toast';

// "Is this the song?": Hermes Music wasn't sure which song a request meant, so it asks, one guess at a
// time. Yes downloads it; no shows the next guess.
export const RequestQuestion = ({
    ask,
    id,
    onDone,
}: {
    ask: RequestGuess;
    id: string;
    onDone?: () => void;
}) => {
    const url = useHermesUrl();
    const queryClient = useQueryClient();
    const [guess, setGuess] = useState(ask);
    const [busy, setBusy] = useState(false);
    const [answered, setAnswered] = useState('');

    const answer = async (yes: boolean) => {
        setBusy(true);
        try {
            const r = await requestApi.answer(url, id, yes);
            if (r.queued) {
                setAnswered(`Downloading ${guess.title} - ${guess.artist}`);
                onDone?.();
            } else if (r.next) {
                setGuess({ ...r.next, left: Math.max(1, (guess.left ?? 2) - 1) });
            } else {
                setAnswered("No more guesses - try again with the artist's name");
                onDone?.();
            }
            queryClient.invalidateQueries({ queryKey: ['hermes-requests', url] });
            queryClient.invalidateQueries({ queryKey: ['sour-requests-tracker', url] });
        } catch (error) {
            toast.error({ message: (error as Error).message });
        } finally {
            setBusy(false);
        }
    };

    if (answered) {
        return (
            <Text isMuted size="sm">
                {answered}
            </Text>
        );
    }
    return (
        <div className={styles.question}>
            {guess.cover ? (
                <img alt="" className={styles.cover} src={guess.cover} />
            ) : (
                <span className={styles.cover} />
            )}
            <div className={styles.text}>
                <Text isMuted size="xs">
                    Is this the song?
                </Text>
                <Text fw={700} size="sm" truncate>
                    {guess.title}
                </Text>
                <Text isMuted size="xs" truncate>
                    {guess.artist}
                    {guess.album ? ` - ${guess.album}` : ''}
                </Text>
            </div>
            <Button disabled={busy} onClick={() => answer(true)} size="compact-sm" variant="filled">
                Yes
            </Button>
            <Button
                disabled={busy}
                onClick={() => answer(false)}
                size="compact-sm"
                variant="default"
            >
                {(guess.left ?? 1) > 1 ? 'No, next' : 'No'}
            </Button>
        </div>
    );
};

// pops the question up (for your own requests, from the background watcher)
export const openRequestQuestion = (id: string, query: string, ask: RequestGuess) => {
    const modalId = `request-question-${id}`;
    openModal({
        children: (
            <RequestQuestion
                ask={ask}
                id={id}
                onDone={() => window.setTimeout(() => closeModal(modalId), 1600)}
            />
        ),
        modalId,
        title: `Hermes Music, about "${query}"`,
    });
};
