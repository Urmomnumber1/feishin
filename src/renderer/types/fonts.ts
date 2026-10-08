import { z } from 'zod';

export type Font = {
    label: string;
    // only Sour Player profiles with this perk (from Hermes Music) can pick it
    perk?: string;
    value: string;
};

export const FONT_OPTIONS: Font[] = [
    { label: 'Inter', value: 'Inter' },
    { label: 'Poppins', value: 'Poppins' },
    { label: 'Fredoka (Sour)', value: 'Sour Fredoka' },
    { label: 'Comfortaa (Sour)', value: 'Sour Comfortaa' },
    { label: 'Righteous (Sour)', value: 'Sour Righteous' },
    { label: 'Space Mono (Sour)', value: 'Sour Space Mono' },
    { label: 'Playfair Display (Sour)', value: 'Sour Playfair Display' },
    { label: 'Caveat (Sour)', value: 'Sour Caveat' },
    { label: 'VT323 (Sour)', value: 'Sour VT323' },
    { label: 'Determination (only yours)', perk: 'determination', value: 'Determination' },
];

// the app fonts this profile may pick (perk fonts only for whoever has them, or already uses them)
export const fontOptions = (perks: string[] = [], current?: string): Font[] =>
    FONT_OPTIONS.filter((f) => !f.perk || perks.includes(f.perk) || f.value === current).map(
        ({ label, value }) => ({ label, value }),
    );

export const FontValueSchema = z.enum(
    FONT_OPTIONS.map((option) => option.value) as [string, ...string[]],
);
