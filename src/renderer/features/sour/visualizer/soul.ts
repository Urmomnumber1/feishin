import { BINS, type Levels } from '/@/renderer/features/sour/visualizer/levels';
import { usePlayerStoreBase } from '/@/renderer/store/player.store';
import { useTimestampStoreBase } from '/@/renderer/store/timestamp.store';

// The Soul visualizer (a perk): an Undertale battle box. Bones rise from the floor and hang from the
// ceiling with the music and slide across, the red SOUL hops over them on the beat, save-point stars
// twinkle around the box and the HP bar underneath is the song (it drains as the song plays). While
// the music is paused the SOUL cracks in two, and mends when it plays again.

// the SOUL, 13x11 pixels
const HEART = [
    '0011100011100',
    '0111110111110',
    '1111111111111',
    '1111111111111',
    '1111111111111',
    '0111111111110',
    '0011111111100',
    '0001111111000',
    '0000111110000',
    '0000011100000',
    '0000001000000',
];
// where the crack runs on each row when the SOUL breaks
const CRACK = [6, 6, 7, 6, 5, 6, 7, 6, 5, 6, 6];
// the save-point star, 5x5 pixels
const STAR = ['00100', '01110', '11111', '01110', '00100'];

export interface SoulState {
    broken: number;
    flash: number;
    scroll: number;
    stars: Star[];
    vy: number;
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
    scroll: 0,
    stars: [],
    vy: 0,
    y: 0,
});

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
    keep?: (col: number, row: number) => boolean,
) => {
    rows.forEach((row, r) => {
        for (let col = 0; col < row.length; col++) {
            if (row[col] === '1' && (!keep || keep(col, r))) {
                ctx.fillRect(x + col * cell, y + r * cell, cell, cell);
            }
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

export const drawSoul = (
    ctx: CanvasRenderingContext2D,
    W: number,
    H: number,
    levels: Levels,
    soul: SoulState,
    playing: boolean,
    dt: number,
    now: number,
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

    // bones, sliding left faster when the song is busy
    ctx.save();
    ctx.beginPath();
    ctx.rect(inner.x, inner.y, inner.w, inner.h);
    ctx.clip();
    if (playing) soul.scroll += dt * (0.6 + energy * 3.5) * (inner.w / 400);
    const count = 18;
    const gap = inner.w / count;
    const width = Math.max(2, Math.round(line * 0.9));
    ctx.fillStyle = '#fff';
    for (let i = 0; i < count; i++) {
        const x = inner.x + ((((i * gap - soul.scroll) % inner.w) + inner.w) % inner.w);
        const low = bins[Math.floor((i / count) * BINS * 0.7)];
        const high = bins[Math.min(BINS - 1, Math.floor(BINS * 0.3 + (i / count) * BINS * 0.7))];
        const up = inner.h * (0.06 + low * 0.5);
        const down = inner.h * (0.03 + high * 0.3);
        bone(ctx, x, inner.y + inner.h + width, inner.y + inner.h - up, width);
        bone(ctx, x + gap / 2, inner.y - width, inner.y + down, width);
    }

    // the SOUL: hops on the beat (and falls back), drifts from side to side, cracks while paused
    const cell = Math.max(1, Math.round((inner.h * 0.2) / 11));
    const floor = inner.y + inner.h * 0.62 - (11 * cell) / 2;
    if (!soul.y) soul.y = floor;
    if (levels.beat && playing && soul.y >= floor - cell)
        soul.vy = -inner.h * (0.035 + kick * 0.02);
    soul.vy += inner.h * 0.0035 * dt;
    soul.y = Math.min(floor, soul.y + soul.vy * dt);
    if (soul.y >= floor) soul.vy = 0;
    soul.broken += ((playing ? 0 : 1) - soul.broken) * Math.min(1, 0.12 * dt);
    const hx = Math.round(cx + Math.sin(now / 1900) * inner.w * 0.22 - (13 * cell) / 2);
    const hy = Math.round(soul.y);
    if (levels.beat && playing) soul.flash = 1;
    soul.flash *= Math.pow(0.86, dt);
    const tint = Math.round(soul.flash * 120);
    ctx.fillStyle = `rgb(255 ${tint} ${tint})`;
    if (soul.broken < 0.03) {
        pixels(ctx, HEART, hx, hy, cell);
    } else {
        const split = Math.round(soul.broken * cell * 1.6);
        pixels(ctx, HEART, hx - split, hy, cell, (col, row) => col < CRACK[row]);
        pixels(ctx, HEART, hx + split, hy, cell, (col, row) => col >= CRACK[row]);
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
                size: Math.max(1, Math.round(cell * (0.6 + Math.random() * 0.6))),
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
    const size = Math.max(8, Math.round(rowH * 0.42));
    const y = by + boxH + rowH * 0.55;
    ctx.font = `${size}px Determination, monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    const label = 'HP';
    const lw = ctx.measureText(label).width;
    const barW = Math.round(boxW * 0.32);
    const text = total ? `${clock(total - at)} / ${clock(total)}` : '-- / --';
    const tw = ctx.measureText(text).width;
    const left = Math.round(cx - (lw + size * 0.6 + barW + size * 0.6 + tw) / 2);
    ctx.fillText(label, left, y);
    const barX = left + lw + size * 0.6;
    const barH = Math.round(size * 0.9);
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
    ctx.fillText(text, barX + barW + size * 0.6, y);
};
