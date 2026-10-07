import styles from '../components/hub.module.css';

import { NativeScrollArea } from '/@/renderer/components/native-scroll-area/native-scroll-area';
import { LibraryTools } from '/@/renderer/features/sour/components/library-tools';
import { CoverWall, SmartFolders, Timeline } from '/@/renderer/features/sour/components/library-views';
import { SourSafe } from '/@/renderer/features/sour/components/sour-safe';
import { Tabs } from '/@/shared/components/tabs/tabs';

// The Sour Library: the whole library as a colour wall or a record shelf, a timeline by year, smart
// folders and Hermes Music's tools for keeping the library tidy.
const SourLibraryRoute = () => (
    <NativeScrollArea>
        <div className={styles.page}>
            <h1 className={styles.title}>Sour Library</h1>
            <Tabs defaultValue="wall" keepMounted={false}>
                <Tabs.List>
                    <Tabs.Tab value="wall">Wall and shelf</Tabs.Tab>
                    <Tabs.Tab value="timeline">Timeline</Tabs.Tab>
                    <Tabs.Tab value="folders">Smart folders</Tabs.Tab>
                    <Tabs.Tab value="tools">Tools</Tabs.Tab>
                </Tabs.List>
                <Tabs.Panel pt="md" value="wall">
                    <SourSafe name="cover wall">
                        <CoverWall />
                    </SourSafe>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="timeline">
                    <SourSafe name="timeline">
                        <Timeline />
                    </SourSafe>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="folders">
                    <SourSafe name="smart folders">
                        <SmartFolders />
                    </SourSafe>
                </Tabs.Panel>
                <Tabs.Panel pt="md" value="tools">
                    <SourSafe name="library tools">
                        <LibraryTools />
                    </SourSafe>
                </Tabs.Panel>
            </Tabs>
        </div>
    </NativeScrollArea>
);

export default SourLibraryRoute;
