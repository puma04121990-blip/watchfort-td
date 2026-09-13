# Watchfort — Audio bible v0.2

Звук **только после** первого pointerdown/touch/keydown. Шины: `music` / `sfx` / `ui`. Mute-all на hide вкладки.

## Файлы
`public/assets/audio/{stem}.ogg` + `.m4a` (перегенерация: `pnpm gen:sfx`).

| key / stem | bus | loop | notes |
|---|---|---|---|
| click | ui | no | 80 ms |
| confirm | ui | no | 150 ms |
| error | ui | no | 150 ms |
| place | sfx | no | постановка башни |
| shot_arrow / shot_cannon / shot_frost | sfx | no | poly + cooldown |
| hit / die / coin / gate | sfx | no | |
| start | sfx | no | старт волны |
| complete / fail | sfx | no | 1.5s / 0.75s |
| bgm_menu | music | yes | ~10s loop, quieter |
| bgm_play | music | yes | ~8s loop |

Music quieter than sfx. Fade ~250–300 ms on track switch.
