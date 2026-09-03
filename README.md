# STANAG 2222 Angol — szókincs, katonai angol, válságövezetek

**Élőben:** https://vinterpeter.github.io/c2-angol/

Offline tanulóoldal a NATO STANAG 6001 SLP 2222 (Level 2 / Functional) katonai szaknyelvi nyelvvizsgára. Nyisd meg az `index.html`-t duplakattintással, vagy látogasd meg a fenti élő oldalt — az oldalsávban az **Offline letöltés** gombbal egyetlen önálló HTML-fájlként mentheted a gépedre, ami attól kezdve internet nélkül is teljesen működik.

## Modulok

- **Szavak** — 571 szó, kizárólag a szóbeli vizsga hivatalos 14 témakörében (témánként ~37–44 szó, minden alpontra lefedve) (Family, Jobs, Education, Housing, Leisure and entertainment, Shopping, Health, Sport, Holidays and celebrations, Travelling, Public transport, Food and meals, Society, Environment), szigorúan B2/STANAG-2 (Functional) szinten. Minden szónál: IPA, angol definíció, magyar jelentés, 3–5 szinonima, ellentét, **angol példamondat + magyar fordítása**, kollokációk. Keresés + témakör szerinti szűrés.
- **Kártyák** — Leitner-rendszerű ismétlés mindhárom forrásra (szavak / frázisok / katonai — külön-külön vagy "Minden" összevonva), EN→HU vagy HU→EN irányban. Egyszerűsített felület: csak "Miből?" és "Milyen irányban?" chipek + Indítás gomb; a kiválasztás módja (esedékes+új / csak új / gyenge / mind) és a kártyák száma egy összecsukható "További beállítások" alatt van, alapértelmezés jó a legtöbb esethez. Helyes válasz: 1 → 3 → 7 → 14 → 30 nap múlva jön újra; hibás: vissza az elejére.
- **Frázisok** — 147 idióma, kollokáció, kötőelem, phrasal verb, latin/francia kifejezés, közmondás — mind B2/STANAG-2 szinten, angol példamondattal + magyar fordítással. Böngészés + **Hiányos mondat** (a kulcsszó kitakarva) + **Jelentés-kvíz**.
- **Katonai** — 360 kifejezés (az eredeti szélesebb anyagból B2/Functional szintre szűkítve — a törzsmunka-keretrendszerek, hadijogi és kiberhadviselési szakzsargon nagy része túl elvont volt a 2. szinthez, ezért kimaradt) 18 kategóriában + NATO betűző ábécé.
- **Válságövezetek** — a szóbeli vizsga 3. feladatához (aktuális válságövezet megvitatása): 11 térség (Afghanistan, Bosnia and Herzegovina, Cyprus, Iran, Israeli-Palestinian conflict, Kosovo, Mali/Sahel, North Korea, Taiwan, Ukraine, Yemen), mindegyikhez az 5 szokásos kérdésre (miért forró pont, kik érintettek, mi a háttere, mi a jelenlegi helyzet, mi a lehetséges jövője) STANAG-2 szintű, semleges, tényszerű mintaválasz angolul + magyarul, kulcsszavakkal. Tanulás/gyakorlás mód (válaszok elrejtve, önellenőrzésre).
- **Statisztika** — doboz-eloszlás modulonként, napi ismétlés-diagram, kvíz-pontosság, sorozat. JSON export/import/törlés.

## Billentyűk

| Hol | Billentyű | Mit csinál |
|---|---|---|
| Kártyák | `Space` / `J` / `F` / `H` | felfed / tudtam / nem tudtam / kiejtés |
| Kvízek | `1`–`4` / `Enter` | válasz / tovább |

## Adatok

Minden tartalom a `data.js`-ben (`window.C2_DATA.WORDS / PHRASES / MIL / NATO`) és a `crisis.js`-ben (`window.C2_DATA.CRISIS`) van — sima JS-objektumok, kézzel bővíthetők.

Mezők:
- `WORDS`: `{w, pos, ipa, lvl, en, hu, syn, ant, ex, ex_hu, col, tag}` — `tag` a 14 hivatalos szóbeli témakör egyike (család, munka, oktatás, lakhatás, szabadidő, vásárlás, egészség, sport, ünnepek, utazás, közlekedés, étkezés, társadalom, környezet).
- `PHRASES`: `{p, type, lvl, en, hu, ex, ex_hu, key, reg}` — `key` egy szó, ami szó szerint szerepel az `ex` mondatban.
- `MIL`: `{t, cat, hu, en, ex, ex_hu, abbr, lvl}`.
- `CRISIS`: `{id, en, hu, asOf, sources, qa:[{q,en,hu}×5], vocab:[{en,hu}]}`.

A haladás a böngésző `localStorage`-ában él (`c2angol.v1` kulcs), az Export gombbal menthető, Importtal visszatölthető.

## Ellenőrzés

Headless Playwright end-to-end teszt fut `file://`-n és a saját szerveren is: 24 lépés (minden fül, minden kvízmód, kártya-drill mindkét irányban, válságövezet tanulás/gyakorlás mód, perzisztencia újratöltés után, mobil nézet) — 0 konzolhiba.
