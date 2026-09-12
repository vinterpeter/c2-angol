# STANAG 2222 Angol — szókincs, katonai angol, válságövezetek

**Élőben:** https://vinterpeter.github.io/c2-angol/

Offline tanulóoldal a NATO STANAG 6001 SLP 2222 (Level 2 / Functional) katonai szaknyelvi nyelvvizsgára. Nyisd meg az `index.html`-t duplakattintással, vagy látogasd meg a fenti élő oldalt — az oldalsávban az **Offline letöltés** gombbal egyetlen önálló HTML-fájlként mentheted a gépedre, ami attól kezdve internet nélkül is teljesen működik.

## Modulok

- **Szavak** — 571 szó, kizárólag a szóbeli vizsga hivatalos 14 témakörében (témánként ~37–44 szó, minden alpontra lefedve) (Family, Jobs, Education, Housing, Leisure and entertainment, Shopping, Health, Sport, Holidays and celebrations, Travelling, Public transport, Food and meals, Society, Environment), szigorúan B2/STANAG-2 (Functional) szinten. Minden szónál: IPA, angol definíció, magyar jelentés, 3–5 szinonima, ellentét, **angol példamondat + magyar fordítása**, kollokációk. Keresés + témakör szerinti szűrés.
- **Kártyák** — Leitner-rendszerű ismétlés mindhárom forrásra (szavak / frázisok / katonai — külön-külön vagy "Minden" összevonva), EN→HU vagy HU→EN irányban. Egyszerűsített felület: csak "Miből?" és "Milyen irányban?" chipek + Indítás gomb; a kiválasztás módja (esedékes+új / csak új / gyenge / mind) és a kártyák száma egy összecsukható "További beállítások" alatt van, alapértelmezés jó a legtöbb esethez. Helyes válasz: 1 → 3 → 7 → 14 → 30 nap múlva jön újra; hibás: vissza az elejére.
- **Frázisok** — 157 phrasal verb Quizlet-módban: kártya-flip animáció, Angol→Magyar / Magyar→Angol irány, értékelés (tudtam / nem tudtam), eredménykijelző. Billentyűk: Space forgat, J tudtam, F nem tudtam, H kiejtés.
- **Katonai** — 360 kifejezés (az eredeti szélesebb anyagból B2/Functional szintre szűkítve — a törzsmunka-keretrendszerek, hadijogi és kiberhadviselési szakzsargon nagy része túl elvont volt a 2. szinthez, ezért kimaradt) 18 kategóriában + NATO betűző ábécé.
- **Válságövezetek** — a szóbeli vizsga 3. feladatához (aktuális válságövezet megvitatása): 11 térség (Afghanistan, Bosnia and Herzegovina, Cyprus, Iran, Israeli-Palestinian conflict, Kosovo, Mali/Sahel, North Korea, Taiwan, Ukraine, Yemen), mindegyikhez az 5 szokásos kérdésre (miért forró pont, kik érintettek, mi a háttere, mi a jelenlegi helyzet, mi a lehetséges jövője) STANAG-2 szintű, semleges, tényszerű mintaválasz angolul + magyarul, kulcsszavakkal. Tanulás/gyakorlás mód (válaszok elrejtve, önellenőrzésre). Minden térséghez egy kis közeli térkép (a régió kiemelve), az oldal alján pedig egy világtérkép mind a 11 pontjelölővel — kattintásra megnyitja a hozzá tartozó leírást.
- **Statisztika** — doboz-eloszlás modulonként, napi ismétlés-diagram, kvíz-pontosság, sorozat. JSON export/import/törlés.

## Billentyűk

| Hol | Billentyű | Mit csinál |
|---|---|---|
| Kártyák | `Space` / `J` / `F` / `H` | felfed / tudtam / nem tudtam / kiejtés |
| Kvízek | `1`–`4` / `Enter` | válasz / tovább |

## Adatok

Minden tartalom a `data.js`-ben (`window.C2_DATA.WORDS / PHRASES / MIL / NATO`), a `crisis.js`-ben (`window.C2_DATA.CRISIS`) és a `worldmap.js`-ben (`window.C2_DATA.WORLD_MAP`) van — sima JS-objektumok, kézzel bővíthetők.

Mezők:
- `WORDS`: `{w, pos, ipa, lvl, en, hu, syn, ant, ex, ex_hu, col, tag}` — `tag` a 14 hivatalos szóbeli témakör egyike (család, munka, oktatás, lakhatás, szabadidő, vásárlás, egészség, sport, ünnepek, utazás, közlekedés, étkezés, társadalom, környezet).
- `PHRASES`: `{p, type, lvl, en, hu, ex, ex_hu, key, reg}` — `key` egy szó, ami szó szerint szerepel az `ex` mondatban.
- `MIL`: `{t, cat, hu, en, ex, ex_hu, abbr, lvl}`.
- `CRISIS`: `{id, en, hu, asOf, sources, mapKey, qa:[{q,en,hu}×5], vocab:[{en,hu}]}` — `mapKey` az ISO 3166-1 alpha-2 országkód (vagy `xk` Koszovóra, aminek nincs saját útvonala a térképen, ezért kézzel becsült pont jelöli), ami a `WORLD_MAP.countries`/`.highlights` bejegyzésre mutat.
- `WORLD_MAP`: `{viewBox, svg, countries: {ISO: {x,y,width,height,cx,cy}}, highlights: {ISO: {tag,d}}}` — egyetlen megosztott világtérkép-SVG (180 ország/terület körvonala), amit minden kis térkép és a nagy áttekintő térkép is újrahasznosít `<use>`-zal, hogy ne kelljen sokszor lemásolni.

A haladás a böngésző `localStorage`-ában él (`c2angol.v1` kulcs), az Export gombbal menthető, Importtal visszatölthető.

## Térkép attribúció

A világtérkép alapja a [Simple World Map](https://github.com/flekschas/simple-world-map) (eredeti szerző: Al MacDonald, szerkesztette: Fritz Lekschas), CC BY-SA 3.0 licenc alatt. Az alkalmazás ezt egészíti ki a válságövezetek kiemelésével és a saját pontjelölőivel.

## Ellenőrzés

Headless Playwright end-to-end teszt fut `file://`-n és a saját szerveren is: 24 lépés (minden fül, minden kvízmód, kártya-drill mindkét irányban, válságövezet tanulás/gyakorlás mód, perzisztencia újratöltés után, mobil nézet) — 0 konzolhiba.
