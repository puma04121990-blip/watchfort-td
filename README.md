# Watchfort / Сторожевой форт

Top-down stylized casual tower defense for GamePush.

## Stack

- **TypeScript 5.x** (strict)
- **Phaser 4.2.1**
- **Vite 6** (`base: './'` for local / relative deploy)
- **pnpm**
- GamePush SDK via `window.onGPInit`, with a ~4.5s **NullGp** fallback

## Quick start

```bash
cd /workspace/watchfort-td
pnpm install
pnpm gen:assets   # regenerate placeholder PNGs
pnpm dev          # http://localhost:5173
pnpm build        # typecheck + production bundle → dist/
```

Open the Vite URL and play in the browser.

## Playable P0 loop

1. **Menu** — title «Сторожевой форт» / Watchfort, Play, RU|EN toggle
2. **Place** — tap grass **adjacent to the dirt path** (not on the path, not occupied)
3. **Towers** — Arrow (blue DPS), Cannon (orange splash), Frost (cyan slow)
4. **Start Wave** — enemies walk the polyline toward the gate
5. **Win** after 3 cleared waves (gate HP > 0) → `hookLevelComplete` stub
6. **Fail** if gate HP hits 0 → `hookLevelFail` stub

## GamePush

- `Phaser.Game` starts only after `window.onGPInit` **or** ~4.5s NullGp fallback
- NullGp: ads no-op, saves via `localStorage`
- Env: copy `.env.example` → `.env` and set `VITE_GP_PROJECT_ID`, `VITE_GP_PUBLIC_TOKEN`

## Palette

Grass `#4A7C59`, Path `#C4A574`, TowerBlue `#3B82C4`, Cannon `#F97316`, Frost `#22D3EE`, EnemyRed `#D64545`, Gold `#E8B84A`, Panel `#111827`, Text `#F3F4F6`, Shade `#1F2933`.

## Audio

`AudioBus` stays silent until the first pointer/key. Buses: **music / sfx / ui**. Mute-all on `visibilitychange`.
