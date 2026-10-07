// Why a song is in the queue ("From Jay's radio", "A gift from Mia"...), shown as a small chip in the
// Sour Stage and the player bar. Only songs Sour Player itself queued have a reason; kept for this
// session only.
const reasons = new Map<string, string>();

export const setReason = (songIds: string[], reason: string) => {
    for (const id of songIds) reasons.set(id, reason);
    if (reasons.size > 2000) {
        const drop = [...reasons.keys()].slice(0, 500);
        for (const id of drop) reasons.delete(id);
    }
};

export const getReason = (songId?: null | string) =>
    songId ? (reasons.get(songId) ?? null) : null;
