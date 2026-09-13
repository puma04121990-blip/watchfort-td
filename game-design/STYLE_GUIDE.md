# Watchfort — Art bible (Pixar-appeal 2D)

## Столпы / Pillars
1. **Appealing rounded silhouettes** — soft, readable shapes; no harsh pixels, no flat gray boxes  
2. **Soft top-left light + warm bounce fill** — volume via gradients; specular highlight blob top-left; subtle rim light  
3. **Clear color roles** — tower = role by hue (blue / orange / cyan / green); enemy threat marker stays red family  
4. **Contact shadows** — soft elliptical ground contact under towers, enemies, soldiers  
5. **Читаемый path** — sandy path with edge darkening vs soft grass tufts  

**NOT 3D CGI** — soft stylized **2D** (Kingdom-Rush-adjacent genre energy, Pixar *appeal* not render). Transparent backgrounds on all sprites.

## Камера / масштаб
Top-down. Logic tile `64×64`. Tower sprite ~56–64 px in cell. Enemy ~32–48 px. Keep gameplay sizes identical when regenerating art.

## Палитра — см. `palette_swatch.png`
14+ role colors. New tint only with a job (accent / light / dark of an existing role).

## Линия / свет
- Soft AA via supersample (2–4× draw → LANCZOS downscale)  
- Light from **top-left**; warm bounce from bottom-right  
- Specular highlight blob; subtle rim on opposite edge  
- Soft contour via shade in gradient — avoid hard 1px pixel outlines  

## Бюджет
| Класс | Правило |
|---|---|
| Tower | Rounded base, glossy barrel, friendly not military-grim; silhouette + role color readable in idle |
| Enemy | Cute proportions (big head/eyes for runner/swarm; tank chunky; brute imposing but cartoony); one threat hue family |
| Tile path/grass | Soft grass tufts; sandy path with edge darkening; seamless-ish 2–4 tones |
| Gate | Warm wood + gold frame, inviting |
| UI btn_play | Plump rounded CTA with gloss |
| Projectiles / FX | Soft glow blobs, tower-tinted |
| Contact shadow | Ellipse under units/towers, fill alpha ~0.25 |

## Вне границ
True pixel-art crunch, isometric, photoreal / 3D CGI, realistic blood, чужой IP (Kingdom Rush — жанр ок, копировать ассеты нельзя).

## Генератор
`pnpm gen:assets` → `scripts/gen-assets-pixar.py` (Pillow). Outputs `assets/` + `public/assets/`.

## Имена
`tower_arrow` · `tower_cannon` · `tower_frost` · `tower_barracks` · `enemy_runner` · `enemy_tank` · `enemy_brute` · `enemy_swarm` · `unit_soldier` · `tile_path` · `tile_grass` · `tile_gate` · `btn_play` · `fx_hit` · `projectile_*` · `ui_coin`
