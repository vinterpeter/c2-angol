# C2 Angol — szókincs, szinonimák, frázisok, katonai angol

**Élőben:** https://vinterpeter.github.io/c2-angol/

Offline tanulóoldal. Nyisd meg az `index.html`-t duplakattintással, vagy látogasd meg a fenti élő oldalt — az oldalsávban az **Offline letöltés** gombbal egyetlen önálló HTML-fájlként mentheted a gépedre, ami attól kezdve internet nélkül is teljesen működik (a haladás is megmarad benne, csak böngészőnként/másolatonként külön-külön).

## Modulok

- **Szavak** — 1021 szó B2–C2 szinten, 16 témában (jellem, érvelés, absztrakt, társadalom, érzelem, tudomány, gazdaság, jog, média, környezet, egészség, kultúra, munka, oktatás, hétköznapi, technológia). Minden szónál: IPA, angol definíció, magyar jelentés, 3–5 szinonima, ellentét, példamondat, kollokációk, CEFR-szint. Keresés szóra/jelentésre/szinonimára, szűrés téma, szint (B2/C1/C2) és tanulási állapot szerint. 🔊 = brit kiejtés (macOS beépített hang).
- **Kártyák** — Leitner-rendszerű ismétlés mindhárom forrásra (szavak / frázisok / katonai), EN→HU vagy HU→EN irányban, szint szerint is szűrhető. Helyes válasz: 1 → 3 → 7 → 14 → 30 nap múlva jön újra; hibás: vissza az elejére. „Esedékes + új" módban az app maga adagolja, mi jön.
- **Szinonima kvíz** — 5 feladattípus: szó→szinonima, szinonima→szó, definíció→szó, magyar→beírás, szó→ellentét. Témakör és szint szerint szűrhető.
- **Frázisok** — 417 idióma, kollokáció, kötőelem, phrasal verb, latin/francia kifejezés, közmondás. Böngészés (típus + szint szűrővel) + **Hiányos mondat** (a kulcsszó kitakarva) + **Jelentés-kvíz**.
- **Katonai** — 455 kifejezés 17 kategóriában (rendfokozat, egység, művelet, harcászat, fegyver, híradás, logisztika, vezénylés, rövidítés, haditengerészet, légierő, hírszerzés, egészségügy, navigáció, hadijog, kiber, parancsformátum, kiképzés) + NATO betűző ábécé betűzési gyakorlattal.
- **Statisztika** — doboz-eloszlás modulonként, napi ismétlés-diagram, kvíz-pontosság, sorozat. JSON export/import/törlés.

## Billentyűk

| Hol | Billentyű | Mit csinál |
|---|---|---|
| Kártyák | `Space` / `J` / `F` / `H` | felfed / tudtam / nem tudtam / kiejtés |
| Kvízek | `1`–`4` / `Enter` | válasz / tovább |

## Adatok

Minden tartalom a `data.js`-ben van (`window.C2_DATA.WORDS / PHRASES / MIL / NATO`) — sima JS-objektumok, kézzel bővíthetők.

Mezők:
- `WORDS`: `{w, pos, ipa, lvl, en, hu, syn, ant, ex, col, tag}` — `lvl` a CEFR-szint (`B2`/`C1`/`C2`).
- `PHRASES`: `{p, type, lvl, en, hu, ex, key, reg}` — `type`: `idiom` | `phrasal` | `collocation` | `expression` | `latin` | `proverb`; `key` egy szó, ami szó szerint szerepel az `ex` mondatban (ezt takarja ki a Hiányos mondat kvíz).
- `MIL`: `{t, cat, hu, en, ex, abbr}`.

A haladás a böngésző `localStorage`-ában él (`c2angol.v1` kulcs), az Export gombbal menthető, Importtal visszatölthető.

## Ellenőrzés

Headless Playwright end-to-end teszt fut `file://`-n: 24 lépés (minden fül, minden kvízmód, kártya-drill mindkét irányban, perzisztencia újratöltés után, mobil nézet) — 0 konzolhiba a teljes ~1900 tételes adatbázissal.
