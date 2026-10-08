import { useEffect, useRef } from 'react';

import styles from './sour-stage.module.css';

type Point = [number, number];

// The fold runs along x + y = d (x and y from 0 to 1 across the cover) and travels from the
// bottom-right corner (d = 2) to the top-left one (d = 0). What is still stuck down is x + y <= d;
// the peeled part is mirrored over the fold, so it lies folded back on top of the cover.
const stuckPart = (d: number): Point[] =>
    d >= 1
        ? [
              [0, 0],
              [1, 0],
              [1, d - 1],
              [d - 1, 1],
              [0, 1],
          ]
        : [
              [0, 0],
              [d, 0],
              [0, d],
          ];

const flapPart = (d: number): Point[] =>
    d >= 1
        ? [
              [1, d - 1],
              [d - 1, 1],
              [d - 1, d - 1],
          ]
        : [
              [d, 0],
              [d, d - 1],
              [d - 1, d - 1],
              [d - 1, d],
              [0, d],
          ];

const polygon = (points: Point[], map = (v: number) => v) =>
    `polygon(${points
        .map(([x, y]) => `${(map(x) * 100).toFixed(2)}% ${(map(y) * 100).toFixed(2)}%`)
        .join(', ')})`;

const LENGTH = 950;

// The cover of the song before peels off the new one like a sticker, from the bottom-right corner,
// showing the paper back of the sticker as it folds over.
export const PeelOff = ({ onDone, src }: { onDone: () => void; src: string }) => {
    const stuck = useRef<HTMLImageElement>(null);
    const flap = useRef<HTMLDivElement>(null);
    const done = useRef(onDone);
    done.current = onDone;

    useEffect(() => {
        const start = performance.now();
        let frame = 0;
        const step = (now: number) => {
            const t = Math.min(1, (now - start) / LENGTH);
            // slow to lift the corner, quick through the middle, gentle at the end
            const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const d = 2 - 2 * eased;
            if (stuck.current) stuck.current.style.clipPath = polygon(stuckPart(d));
            if (flap.current) {
                // the flap element is three times the cover's size, centred on it
                flap.current.style.clipPath = polygon(flapPart(d), (v) => (v + 1) / 3);
                const fold = ((d + 2) / 6) * 100;
                const tip = (d / 3) * 100;
                flap.current.style.background = `linear-gradient(135deg, #a9a296 ${tip}%, #e9e4da ${(tip + fold) / 2}%, #fffdf7 ${fold - 1.2}%, #8f897e ${fold}%)`;
                flap.current.style.opacity = String(Math.min(1, d * 5));
            }
            if (t < 1) frame = requestAnimationFrame(step);
            else done.current();
        };
        frame = requestAnimationFrame(step);
        return () => cancelAnimationFrame(frame);
    }, []);

    return (
        <div aria-hidden className={styles.peel}>
            <div className={styles.peelStuck}>
                <img alt="" ref={stuck} src={src} />
            </div>
            <div className={styles.peelShadow}>
                <div className={styles.peelFlap} ref={flap} />
            </div>
        </div>
    );
};
