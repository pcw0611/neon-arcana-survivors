# Neon Arcana: Cyber Rift — Art Style Guide

Give this file to any AI (Claude or ChatGPT) before asking for new art, so results stay consistent without needing a full spec every time.

## Mood
Dark cyberpunk city at night. Neon glow, not clean/corporate sci-fi. Slightly gritty, arcade-y, not photorealistic.

## Palette
- Magenta/pink (enemies, danger, hit effects): `#ff2794`, `#ff3a91`, `#f64eff`, `#ff4ea3`
- Cyan/electric blue (player, allies, UI accents): `#20dfff`, `#66dfff`, `#55f8ff`, `#4feeff`
- Purple (secondary accent, bosses): `#9c43ff`, `#d64dff`
- Gold (rare/treasure only — don't use elsewhere): `#ffd34e`, `#ffd65a`
- Background: near-black `#02030a` / `#03040d`, never pure black or white

## Characters
- "SD" (super-deformed/chibi) proportions — see `public/assets/astra-sd.png` (player) and `shade-sd.png` (enemy) as the reference proportions for any new character sprite.
- Sprite sheets are grid-based (columns × rows of equal-size frames); a new character sprite should follow the same grid convention if it needs animation frames.

## Objects / effects (missiles, orbs, ultimate FX, etc.)
- Isotropic (looks right from any angle) unless it's explicitly a directional weapon — most projectiles/orbs are drawn without rotation-matching in code, so keep them roughly radially symmetric.
- Strong glow/bloom core, dark crystalline or metallic shell fragments around it reads well (see `public/assets/enemy-missile.png` for a working example).
- No outlines/cel-shading — everything relies on glow instead of hard black outlines.

## Technical requirements (non-negotiable)
- Transparent PNG background (real alpha channel, not a gray/checkered placeholder — verify with actual pixel alpha, previews can be misleading).
- Generate large (512–1024px), then downscale for the actual in-game size (game sprites are typically 24–140px on screen).
- No text, no watermark, no signature anywhere in the image.
- Small-size legibility: the silhouette must read clearly even scaled down to ~2–3% of the generated size.

## What to avoid
- Photorealism, painterly/soft brush style, pastel colors, anything "cute" outside the SD character proportions, pure white backgrounds.
- Danger/telegraph shapes (hazard circles, warning lines) are intentionally kept as plain geometric vector shapes for gameplay readability — don't replace those with illustrated art.

## Reference resolution
Game renders on an HTML canvas that fills the viewport (no fixed base resolution — it's fully responsive), so assets should look good scaled to arbitrary sizes, not tied to one pixel grid.
