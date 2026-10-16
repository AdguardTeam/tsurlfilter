# Review — PR #22

**PR:** [AdGuardSoftwareLimited/ext-tsurlfilter#22](https://github.com/AdGuardSoftwareLimited/ext-tsurlfilter/pull/22) · **Jira:** [AG-54561](https://jira.int.agrd.dev/browse/AG-54561)

**Ветка:** [`feature/AG-54561`](https://github.com/AdGuardSoftwareLimited/ext-tsurlfilter/tree/feature/AG-54561) (`484af1a4c`) → `fix/AG-52477`

**Ревью:** maximtop (CHANGES_REQUESTED ×3: 07, 18, 25.09), 105th (CHANGES_REQUESTED ×2: 22, 28.09), techi9 (APPROVED, 29.09). 97 комментариев в 54 тредах: все 54 закрыты; CI не найден (`gh pr checks`: no checks reported).

---

## Итог

- Все группы закрыты: комменты 7 (`$url`-исключения, `bc24cd6fa`), 8+9 (root-URL-хелпер + манифест, `50bd6ae89`; билд-часть — `d5d1698f7` в #14), 10+11 (хеш/punycode, `0ad86621b`; JSDoc формата в билде — `b86a015ac`), 12–18 (ретраи/getRegistered/sync — `613a443f1`, кэш провалов хеша — `84fa20f01`, curated entry — `cba73ea15`; билд-часть — `78526b2c5` в #14) и 19–29 (тексты/логи/README/CHANGELOG — `7e46a481a`) сделаны.

- Спорное / требует решения: `$document`/`$jsinject` — в #22 только задокументировано (JSDoc + README, `7e46a481a`), реализация в AG-54564 (коммент 28).

- Закрыто решением (без кода в #22): embeds на allowlisted сайтах — вынесено в [AG-60054](https://jira.int.agrd.dev/browse/AG-60054) (ancestorOrigins-гейт; описание — `browser-extension/.ai/task-preregistered-embed-gate.md`), тред [r4105427711](https://github.com/AdGuardSoftwareLimited/ext-tsurlfilter/pull/22#discussion_r4105427711) зарезолвлен.

- Блокирующее: пунктов не осталось — все три закрыты (embeds решением, coverage `513a2a8ef`, `$path` в opaque `7b6592657`); все 51 тредов зарезолвлены. Два ревьюера в CHANGES_REQUESTED — ждём их ре-ревью.

- Фоллоу-ап 15.10: 6 новых комментов maximtop (3 ответа в закрытых тредах + 3 новых) — исправлены коммитом `484af1a4c`: Known limitations про embeds на allowlisted сайтах (JSDoc + README, AG-60054), комментарии про «регистрации переживают апдейт» (registrations-reader, hasher ×2), `retryFailedBatches` → `SyncScriptsResult`, утечки тестовой изоляции (top-level `afterEach` восстанавливает дефолты моков; shuffle зелёный), CHANGELOG → `/build-contract`, smoke-тест импортирует `root-request`. Все 6 отвечены, 3 треда зарезолвлены → 54/54.

- Решённые треды: 51 из 51 (36 устаревших) — все комментарии обработаны. Ранние блокирующие пункты закрыты: changelog в релизной секции, парсер хоста с userinfo, устаревший coverage после clear (`4f6e80cda`). Группы coverage (`513a2a8ef`, 4 треда), `$path`-в-opaque (`7b6592657`, 1 тред), `$url`-исключения (`bc24cd6fa`, 1 тред), root-URL + манифест (`50bd6ae89` + `d5d1698f7`, 2 треда), хеш/punycode (`0ad86621b` + `b86a015ac`, 2 треда), ретраи/кэш/экспорты (`613a443f1` + `84fa20f01` + `cba73ea15` + `78526b2c5`, 7 тредов) и тексты/логи (`7e46a481a`, 11 тредов) закрыты кодом. Stage 5 описания PR поправлен.

- Фоллоу-ап 16.10: аудит остатков опровергнутого предположения «регистрации переживают апдейт». Функциональной логики под него в tsurlfilter нет — boot-snapshot/`preExistingDocument`/восстановление покрытия из `js`-списков и diff-sync обслуживают рестарты браузера/SW (регистрации реально переживают их в пределах версии), частичные сбои sync и прунинг при апдейтах фильтров. Поправлены только устаревшие формулировки (3 файла, +10/−11): `app-context.ts` (тот самый комментарий из ретракции maximtop), `init` («an update may have removed it» убрано), «survive forever» → «keep firing across browser sessions», контракт манифеста (убран хвост про extra bookkeeping fields — след retention). eslint/268 тестов/tsc зелёные; ждёт коммита.
