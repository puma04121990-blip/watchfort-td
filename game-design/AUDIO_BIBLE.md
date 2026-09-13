# Watchfort — Audio bible v0.1

Звук **только после** первого pointerdown. Шины: music / sfx / ui.

## Клипы
| key | bus | loop | when |
|---|---|---|---|
| `bgm_menu` | music | yes | меню |
| `bgm_play` | music | yes | волна; fade 300 ms |
| `ui_click` | ui | no | кнопки |
| `ui_confirm` | ui | no | старт волны / апгрейд |
| `ui_error` | ui | no | нельзя поставить |
| `hook_level_start` | sfx | no | первая волна |
| `hook_level_complete` | sfx | no | 1.5–2.5 с |
| `hook_level_fail` | sfx | no | короткий |
| `sfx_place_tower` | sfx | no | постановка |
| `sfx_shot_arrow` | sfx | no | выстрел |
| `sfx_shot_cannon` | sfx | no | пушка |
| `sfx_hit` | sfx | no | попадание |
| `sfx_enemy_die` | sfx | no | смерть |
| `sfx_coin` | sfx | no | награда |
| `sfx_gate_hit` | sfx | no | враг у ворот |

Тембр: лёгкий martial / folk percussion, **не** оркестр каждую минуту. BPM меню ~90, плей ~110–120 groove.

Mute-all на hide/blur/ad.
