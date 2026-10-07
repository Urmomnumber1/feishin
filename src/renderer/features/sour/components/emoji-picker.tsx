import { useMemo, useState } from 'react';

import styles from './emoji-picker.module.css';

import { ActionIcon } from '/@/shared/components/action-icon/action-icon';
import { Popover } from '/@/shared/components/popover/popover';
import { TextInput } from '/@/shared/components/text-input/text-input';

// Emoji are drawn with the bundled Twemoji font, so everyone sees the same ones (in colour) on
// Windows, Linux and macOS. Each entry: the emoji and a few words to search by.
const EMOJI: Record<string, Array<[string, string]>> = {
    Faces: [
        ['😀', 'grin happy smile'], ['😂', 'laugh tears lol'], ['🤣', 'rofl laugh'], ['😊', 'blush smile'],
        ['😍', 'love heart eyes'], ['🥰', 'love hearts'], ['😘', 'kiss'], ['😎', 'cool sunglasses'],
        ['🤩', 'star struck wow'], ['🥳', 'party'], ['😏', 'smirk'], ['😌', 'relieved calm'],
        ['😴', 'sleep tired'], ['🤔', 'thinking hmm'], ['🤨', 'raised eyebrow sus'], ['😐', 'neutral meh'],
        ['🙄', 'eye roll'], ['😬', 'grimace awkward'], ['😮', 'wow surprised'], ['😱', 'scream shock'],
        ['😭', 'cry sob'], ['😢', 'sad tear'], ['😤', 'huff angry'], ['😡', 'angry mad'],
        ['🤯', 'mind blown'], ['🥶', 'cold freezing'], ['🥵', 'hot'], ['🤢', 'sick gross'],
        ['🤠', 'cowboy'], ['🤡', 'clown'], ['👻', 'ghost boo'], ['💀', 'skull dead lmao'],
        ['👽', 'alien'], ['🤖', 'robot'], ['😈', 'devil'], ['🙃', 'upside down'],
        ['🫠', 'melting'], ['🫡', 'salute'], ['🤫', 'shh quiet'], ['🤭', 'oops giggle'],
    ],
    Gestures: [
        ['👍', 'thumbs up yes like'], ['👎', 'thumbs down no'], ['👏', 'clap'], ['🙌', 'hands up yay'],
        ['🙏', 'please thanks pray'], ['🤝', 'handshake deal'], ['✌️', 'peace'], ['🤘', 'rock on metal'],
        ['🤙', 'call me shaka'], ['👋', 'wave hi bye'], ['💪', 'strong flex'], ['🫶', 'heart hands'],
        ['👀', 'eyes look'], ['🫵', 'you point'], ['👑', 'crown king queen'], ['💅', 'nails sassy'],
        ['🕺', 'dance man'], ['💃', 'dance woman'], ['🎧', 'headphones music'], ['👨‍💻', 'coder laptop'],
    ],
    Hearts: [
        ['❤️', 'red heart love'], ['🧡', 'orange heart'], ['💛', 'yellow heart'], ['💚', 'green heart'],
        ['💙', 'blue heart'], ['💜', 'purple heart'], ['🖤', 'black heart'], ['🤍', 'white heart'],
        ['💖', 'sparkling heart'], ['💕', 'two hearts'], ['💔', 'broken heart'], ['❤️‍🔥', 'heart on fire'],
        ['💯', 'hundred'], ['✨', 'sparkles'], ['💫', 'dizzy star'], ['⭐', 'star'],
        ['🔥', 'fire lit'], ['💥', 'boom'], ['💤', 'zzz sleep'], ['💬', 'speech chat'],
    ],
    Music: [
        ['🎵', 'note music'], ['🎶', 'notes music'], ['🎤', 'mic sing karaoke'], ['🎸', 'guitar'],
        ['🎹', 'piano keys'], ['🥁', 'drum'], ['🎷', 'sax'], ['🎺', 'trumpet'],
        ['🎻', 'violin'], ['📻', 'radio'], ['💿', 'cd disc'], ['📀', 'dvd'],
        ['🔊', 'loud speaker'], ['🔇', 'mute'], ['🎚️', 'slider mixer'], ['🎛️', 'knobs dj'],
        ['🪩', 'disco ball'], ['🎉', 'party popper'], ['🎊', 'confetti'], ['🪗', 'accordion'],
    ],
    Food: [
        ['🍋', 'lemon sour'], ['🍋‍🟩', 'lime'], ['🍊', 'orange'], ['🍓', 'strawberry'],
        ['🍒', 'cherry'], ['🍑', 'peach'], ['🍍', 'pineapple'], ['🥑', 'avocado'],
        ['🍕', 'pizza'], ['🍔', 'burger'], ['🍟', 'fries'], ['🌮', 'taco'],
        ['🍜', 'ramen noodles'], ['🍣', 'sushi'], ['🍩', 'donut'], ['🍪', 'cookie'],
        ['🎂', 'cake birthday'], ['🍿', 'popcorn'], ['☕', 'coffee'], ['🧋', 'boba tea'],
    ],
    Nature: [
        ['🌸', 'blossom flower'], ['🌹', 'rose'], ['🌻', 'sunflower'], ['🌵', 'cactus'],
        ['🍀', 'clover luck'], ['🍁', 'maple leaf'], ['🌈', 'rainbow'], ['☀️', 'sun'],
        ['🌙', 'moon night'], ['⚡', 'lightning'], ['❄️', 'snow cold'], ['🌊', 'wave ocean'],
        ['🐶', 'dog'], ['🐱', 'cat'], ['🐸', 'frog'], ['🐧', 'penguin'],
        ['🦋', 'butterfly'], ['🐝', 'bee'], ['🦄', 'unicorn'], ['🐐', 'goat'],
    ],
    Fun: [
        ['🎮', 'game controller'], ['🕹️', 'joystick'], ['🎲', 'dice'], ['🏆', 'trophy win'],
        ['⚽', 'soccer football'], ['🏀', 'basketball'], ['🚗', 'car drive'], ['✈️', 'plane travel'],
        ['🚀', 'rocket'], ['🏝️', 'island beach'], ['🎃', 'pumpkin halloween'], ['🎄', 'tree christmas'],
        ['🎁', 'gift present'], ['🎈', 'balloon'], ['🧃', 'juice box'], ['🛹', 'skateboard'],
        ['📸', 'camera photo'], ['💡', 'idea'], ['📚', 'books study'], ['💻', 'laptop'],
    ],
};

const ALL = Object.values(EMOJI).flat();

// Takes the first emoji (or other character) whole, even ones made of several code points
export const firstGrapheme = (text: string) => {
    for (const part of new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)) {
        return part.segment;
    }
    return '';
};

export const EmojiPicker = ({ label = 'Add an emoji', onPick }: { label?: string; onPick: (emoji: string) => void }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const found = useMemo(() => {
        const q = search.trim().toLowerCase();
        return q ? ALL.filter(([, words]) => words.includes(q)) : null;
    }, [search]);
    const pick = (emoji: string) => {
        onPick(emoji);
        setOpen(false);
        setSearch('');
    };
    return (
        <Popover onChange={setOpen} opened={open} position="top" shadow="md" width={320} withinPortal>
            <Popover.Target>
                <ActionIcon
                    aria-label={label}
                    icon="smile"
                    onClick={() => setOpen((o) => !o)}
                    size="sm"
                    tooltip={{ label, openDelay: 300 }}
                    variant="subtle"
                />
            </Popover.Target>
            <Popover.Dropdown onClick={(e) => e.stopPropagation()}>
                <TextInput
                    autoFocus
                    mb={6}
                    onChange={(e) => setSearch(e.currentTarget.value)}
                    placeholder="Search emoji"
                    size="xs"
                    value={search}
                />
                <div className={styles.scroll}>
                    {found ? (
                        <div className={styles.grid}>
                            {found.map(([e, words]) => (
                                <button className={styles.emoji} key={e} onClick={() => pick(e)} title={words} type="button">
                                    {e}
                                </button>
                            ))}
                        </div>
                    ) : (
                        Object.entries(EMOJI).map(([group, list]) => (
                            <div key={group}>
                                <div className={styles.group}>{group}</div>
                                <div className={styles.grid}>
                                    {list.map(([e, words]) => (
                                        <button className={styles.emoji} key={e} onClick={() => pick(e)} title={words} type="button">
                                            {e}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Popover.Dropdown>
        </Popover>
    );
};
