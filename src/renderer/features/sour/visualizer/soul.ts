import { BINS, type Levels } from '/@/renderer/features/sour/visualizer/levels';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';

// The Soul visualizer (an admin extra): an Undertale battle box. Bones rise from the floor and hang
// from the ceiling with the music and slide across; the red SOUL dodges them by itself, or you steer
// it (Sour Stage > Play as the SOUL: arrow keys or WASD). Getting hit only makes it blink. Save-point
// stars twinkle around the box and the HP bar underneath is the song (it drains as the song plays).
// While the music is paused the SOUL breaks in two, and mends when it plays again.

// the SOUL, 16x16 pixels
const HEART = [
    '0011100000011100',
    '0111110000111110',
    '1111111001111111',
    '1111111001111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '1111111111111111',
    '0011111111111100',
    '0011111111111100',
    '0000111111110000',
    '0000111111110000',
    '0000001111000000',
    '0000001111000000',
];
// the broken SOUL, 20x16 pixels
const BROKEN = [
    '00110000000000001100',
    '01111100000000111110',
    '11111110000001111111',
    '11111110000001111111',
    '11111111000011111111',
    '11111111100001111111',
    '11111111100001111111',
    '11111111000011111111',
    '11111111000011111111',
    '11111111100001111111',
    '00111111100001111100',
    '00111111000011111100',
    '00001111000011110000',
    '00001111000011110000',
    '00000011000011000000',
    '00000011000011000000',
];
// the save-point star, 5x5 pixels
const STAR = ['00100', '01110', '11111', '01110', '00100'];

export interface SoulState {
    broken: number;
    flash: number;
    // frames left of blinking after a hit
    hurt: number;
    scroll: number;
    stars: Star[];
    // where the SOUL is in the box (0-1 from the left / top), -1 before it's placed
    x: number;
    y: number;
}

interface Star {
    life: number;
    size: number;
    x: number;
    y: number;
}

export const makeSoul = (): SoulState => ({
    broken: 0,
    flash: 0,
    hurt: 0,
    scroll: 0,
    stars: [],
    x: -1,
    y: -1,
});

// ---------- steering the SOUL yourself ----------
const held = new Set<string>();
const KEYS: Record<string, [number, number]> = {
    a: [-1, 0],
    arrowdown: [0, 1],
    arrowleft: [-1, 0],
    arrowright: [1, 0],
    arrowup: [0, -1],
    d: [1, 0],
    s: [0, 1],
    w: [0, -1],
};
const typing = (e: KeyboardEvent) =>
    e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
const onDown = (e: KeyboardEvent) => {
    const key = e.key.toLowerCase();
    if (!KEYS[key] || typing(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    held.add(key);
    e.preventDefault();
    e.stopPropagation();
};
const onUp = (e: KeyboardEvent) => held.delete(e.key.toLowerCase());
const onBlur = () => held.clear();
let steering = 0;
// turns the arrow keys / WASD into SOUL controls (counted, so two visualizers can't fight over it)
export const steerSoul = (on: boolean) => {
    steering += on ? 1 : -1;
    if (on && steering === 1) {
        window.addEventListener('keydown', onDown, true);
        window.addEventListener('keyup', onUp, true);
        window.addEventListener('blur', onBlur);
    }
    if (!on && steering === 0) {
        window.removeEventListener('keydown', onDown, true);
        window.removeEventListener('keyup', onUp, true);
        window.removeEventListener('blur', onBlur);
        held.clear();
    }
};

const clock = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

const pixels = (
    ctx: CanvasRenderingContext2D,
    rows: string[],
    x: number,
    y: number,
    cell: number,
) => {
    rows.forEach((row, r) => {
        for (let col = 0; col < row.length; col++) {
            if (row[col] === '1') ctx.fillRect(x + col * cell, y + r * cell, cell, cell);
        }
    });
};

const bone = (
    ctx: CanvasRenderingContext2D,
    x: number,
    from: number,
    to: number,
    width: number,
) => {
    const top = Math.min(from, to);
    const length = Math.abs(to - from);
    const knob = width * 0.85;
    ctx.fillRect(x - width / 2, top, width, length);
    for (const end of [from, to]) {
        ctx.beginPath();
        ctx.arc(x - knob * 0.55, end, knob, 0, Math.PI * 2);
        ctx.arc(x + knob * 0.55, end, knob, 0, Math.PI * 2);
        ctx.fill();
    }
};

interface Bone {
    // how far it reaches into the box (0-1 of its height)
    reach: number;
    top: boolean;
    x: number;
}

export const drawSoul = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    levels: Levels,
    soul: SoulState,
    playing: boolean,
    dt: number,
    now: number,
    play = false,
) => {
    const { bins, energy, kick } = levels;
    // the battle box, with room for the HP line under it
    let boxW = Math.min(W * 0.7, H * 1.5);
    let boxH = boxW * 0.42;
    const rowH = boxH * 0.3;
    if (boxH + rowH > H * 0.86) {
        const fit = (H * 0.86) / (boxH + rowH);
        boxW *= fit;
        boxH *= fit;
    }
    const line = Math.max(2, Math.round(boxW / 110));
    const cx = W / 2;
    const cy = H / 2 - rowH / 2;
    const bw = Math.round(boxW * (1 + kick * 0.035));
    const bx = Math.round(cx - bw / 2);
    const by = Math.round(cy - boxH / 2);
    const inner = { h: boxH - line * 2, w: bw - line * 2, x: bx + line, y: by + line };

    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(bx, by, bw, boxH);

    // bones, sliding left faster when the song is busy; they never close the gap completely, so
    // there's always room to slip through
    if (playing) soul.scroll += dt * (0.6 + energy * 3.5) * (inner.w / 400);
    const count = 16;
    const gap = inner.w / count;
    const width = Math.max(2, Math.round(line * 0.9));
    const bones: Bone[] = [];
    for (let i = 0; i < count; i++) {
        const x = inner.x + ((((i * gap - soul.scroll) % inner.w) + inner.w) % inner.w);
        const low = bins[Math.floor((i / count) * BINS * 0.7)];
        const high = bins[Math.min(BINS - 1, Math.floor(BINS * 0.3 + (i / count) * BINS * 0.7))];
        bones.push({ reach: 0.05 + low * 0.4, top: false, x });
        bones.push({
            reach: 0.03 + high * 0.22,
            top: true,
            x: inner.x + ((x - inner.x + gap / 2) % inner.w),
        });
    }

    // the SOUL
    const cell = Math.max(1, Math.round((inner.h * 0.15) / 16));
    const size = 16 * cell;
    const fx = size / inner.w;
    const fy = size / inner.h;
    if (soul.x < 0) {
        soul.x = 0.5 - fx / 2;
        soul.y = 0.5 - fy / 2;
    }
    soul.broken += ((playing ? 0 : 1) - soul.broken) * Math.min(1, 0.12 * dt);
    if (playing) {
        if (play) {
            // you steer: a calm pace, like the real thing
            let mx = 0;
            let my = 0;
            for (const key of held) {
                mx += KEYS[key][0];
                my += KEYS[key][1];
            }
            soul.x += Math.sign(mx) * 0.009 * dt;
            soul.y += Math.sign(my) * 0.02 * dt;
        } else {
            // it dodges by itself: drift along, and head for the middle of the gap the bones leave
            // just ahead of it
            const tx = 0.42 + Math.sin(now / 4200) * 0.16;
            soul.x += Math.max(-0.006 * dt, Math.min(0.006 * dt, tx - soul.x));
            const left = inner.x + soul.x * inner.w - width * 2;
            const right = left + size + width * 4 + inner.w * 0.14;
            let floorReach = 0;
            let ceilingReach = 0;
            for (const b of bones) {
                if (b.x < left || b.x > right) continue;
                if (b.top) ceilingReach = Math.max(ceilingReach, b.reach);
                else floorReach = Math.max(floorReach, b.reach);
            }
            const ty = (ceilingReach + (1 - floorReach)) / 2 - fy / 2;
            soul.y += Math.max(-0.045 * dt, Math.min(0.045 * dt, ty - soul.y));
        }
        soul.x = Math.min(1 - fx, Math.max(0, soul.x));
        soul.y = Math.min(1 - fy, Math.max(0, soul.y));
    }
    const hx = Math.round(inner.x + soul.x * inner.w);
    const hy = Math.round(inner.y + soul.y * inner.h);

    // a hit: blink for a moment (it doesn't do anything else)
    if (soul.hurt > 0) soul.hurt -= dt;
    else if (playing) {
        const pad = size * 0.22; // forgiving: only the middle of the SOUL counts
        const hl = hx + pad;
        const hr = hx + size - pad;
        const ht = hy + pad;
        const hb = hy + size - pad;
        const knob = width * 1.4;
        const hit = bones.some((b) => {
            if (b.x + knob < hl || b.x - knob > hr) return false;
            return b.top
                ? inner.y + b.reach * inner.h + knob > ht
                : inner.y + inner.h - b.reach * inner.h - knob < hb;
        });
        if (hit) soul.hurt = 60;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    ctx.fillStyle = '#fff';
    for (const b of bones) {
        if (b.top) bone(ctx, b.x, inner.y - width, inner.y + b.reach * inner.h, width);
        else
            bone(ctx, b.x, inner.y + inner.h + width, inner.y + inner.h - b.reach * inner.h, width);
    }
    if (levels.beat && playing) soul.flash = 1;
    soul.flash *= Math.pow(0.86, dt);
    const tint = Math.round(soul.flash * 110);
    ctx.fillStyle = `rgb(255 ${tint} ${tint})`;
    const blinkOff = soul.hurt > 0 && Math.floor(soul.hurt / 5) % 2 === 1;
    if (!blinkOff) {
        if (soul.broken > 0.5) pixels(ctx, BROKEN, hx - 2 * cell, hy, cell);
        else pixels(ctx, HEART, hx, hy, cell);
    }
    ctx.restore();

    // the box border (drawn last so bones slide under it)
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = line;
    ctx.strokeRect(bx + line / 2, by + line / 2, bw - line, boxH - line);

    // save-point stars around the box
    if (levels.beat && playing && soul.stars.length < 14) {
        for (let n = 0; n < 2; n++) {
            const side = Math.random() < 0.5 ? -1 : 1;
            soul.stars.push({
                life: 1,
                size: Math.max(1, Math.round(cell * (0.8 + Math.random() * 0.6))),
                x: cx + side * (bw / 2 + Math.random() * Math.max(10, (W - bw) / 2 - 10)),
                y: by + Math.random() * (boxH + rowH),
            });
        }
    }
    soul.stars = soul.stars.filter((s) => (s.life -= 0.02 * dt) > 0);
    for (const s of soul.stars) {
        ctx.globalAlpha = Math.min(1, s.life * 1.6);
        ctx.fillStyle = '#ffd400';
        pixels(ctx, STAR, Math.round(s.x - s.size * 2.5), Math.round(s.y - s.size * 2.5), s.size);
    }
    ctx.globalAlpha = 1;

    // HP = the song: yellow drains as it plays
    const song = usePlayerStoreBase.getState().getCurrentSong();
    const total = song?.duration ? song.duration / 1000 : 0;
    const at = Math.min(total, useTimestampStoreBase.getState().timestamp);
    const font = Math.max(8, Math.round(rowH * 0.42));
    const y = by + boxH + rowH * 0.55;
    ctx.font = `${font}px Determination, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    const label = 'HP';
    const lw = ctx.measureText(label).width;
    const barW = Math.round(boxW * 0.32);
    const text = total ? `${clock(total - at)} / ${clock(total)}` : '-- / --';
    const tw = ctx.measureText(text).width;
    const left = Math.round(cx - (lw + font * 0.6 + barW + font * 0.6 + tw) / 2);
    ctx.fillText(label, left, y);
    const barX = left + lw + font * 0.6;
    const barH = Math.round(font * 0.9);
    ctx.fillStyle = '#c40000';
    ctx.fillRect(barX, Math.round(y - barH / 2), barW, barH);
    ctx.fillStyle = '#ffff00';
    ctx.fillRect(
        barX,
        Math.round(y - barH / 2),
        Math.round(barW * (total ? 1 - at / total : 1)),
        barH,
    );
    ctx.fillStyle = '#fff';
    ctx.fillText(text, barX + barW + font * 0.6, y);
    if (play) {
        ctx.font = `${Math.max(7, Math.round(font * 0.7))}px Determination, monospace`;
        ctx.fillStyle = 'rgb(255 255 255 / 60%)';
        ctx.textAlign = 'center';
        ctx.fillText('arrow keys or WASD', cx, by - font * 0.7);
    }
};
