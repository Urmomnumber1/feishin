import { useMediaQuery } from '@mantine/hooks';

import { useMiniStore } from '/@/renderer/features/sour/store/mini.store';

export const useIsMobile = () => {
    const isMobile = useMediaQuery('(max-width: 768px)');
    // Sour Player's mini player makes the window tiny on purpose: stay on the desktop layout
    const mini = useMiniStore((state) => state.on);
    return isMobile && !mini;
};
