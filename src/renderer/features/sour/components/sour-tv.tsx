import { useEffect } from 'react';

import { groupApi } from '/@/renderer/features/group-play/api/group-play-api';
import { useGroupPlayStore } from '/@/renderer/features/group-play/store/group-play.store';
import { useHermesUrl } from '/@/renderer/features/hermes-video/store/hermes-video.store';
import { useMyProfile, useSourStore } from '/@/renderer/features/sour/store/sour.store';
import { ask, leaveGroupFirst } from '/@/renderer/features/sour/utils/switching';
import { toast } from '/@/shared/components/toast/toast';

// Sour Player TV is its own app (an admin's phone on the TV, at Hermes Music's /tv/). Sour Player only has
// the guest side: friends see "on Sour Player TV" on profiles, can't listen along, and people the admin
// adds get asked to join from their phone.
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
