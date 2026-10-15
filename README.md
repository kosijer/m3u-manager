# M3U Studio

Alat za pravljenje i uređivanje `.m3u` plejlisti internet radio stanica. Statična aplikacija (Vite, čist JavaScript, bez frameworka), radi na GitHub Pages.

Šta zamenjuje: ručno traženje loga, smanjivanje na 600x600, uploadovanje na hosting za slike, kopiranje linka u fajl i ručno slaganje redosleda.

## Šta radi

- **Dodavanje stanice:** naziv, link ka streamu i logo.
- **Kropper za logo:** slika se prevuče, izabere ili nalepi (Ctrl+V). Pomera se prevlačenjem, zumira točkićem ili klizačem. Izlaz je uvek PNG 600x600, sa providnom, belom ili crnom pozadinom. Dugme "Kropuj" pored polja za link učitava sliku sa linka (radi samo ako sajt dozvoljava CORS).
- **Automatski upload loga** na ImgBB (ili Imgur) posle potvrde. Dobijeni link ide u `tvg-logo`.
- **Lista stanica** sa prevlačenjem za promenu redosleda. Ručka ima i tastaturu (strelice gore i dole kad je fokusirana). Klik na stanicu otvara izmenu, sa poljem "Mesto u listi" i brisanjem.
- **Preslušavanje:** dugme ▶ na svakoj stanici pušta stream (jedna stanica u isto vreme). Leva kolona je harmonika: otvorena je ili forma (dok se dodaje ili menja stanica) ili veliki pregled trenutne stanice u punoj veličini 600x600, poravnat uz dno ekrana; zatvoren pregled ostaje kao traka sa nazivom stanice i dugmetom ▶. Kad se pređe mišem preko loga, uz donju ivicu slike se pojave kontrole prethodna / pusti-zaustavi / sledeća i dugme za ceo ekran. Na celom ekranu se vidi samo logo, a kontrole se pojave kad se pomeri miš. Tastatura: **razmak** pušta i zaustavlja, **← / →** prelaze na prethodnu i sledeću stanicu, **F** uključuje i isključuje ceo ekran, **Esc** izlazi (sve dok je kursor van polja za unos). Rade i multimedijalni tasteri na tastaturi (play/pause, next, previous).
- **Naziv pesme:** dok stanica svira, u zaglavlju pregleda (i na celom ekranu) piše pesma koja trenutno ide, ako je stanica šalje. Potreban je mali Cloudflare Worker, vidi [Naziv pesme](#naziv-pesme-cloudflare-worker).
- **Istorija pesama:** u gornjoj navigaciji su **Plejlista** i **Istorija**. Svaka nova pesma se upisuje sa nazivom stanice i vremenom (poslednjih 500, čuva se u pregledaču). Pesme su grupisane po danima, mogu da se pretražuju, a uz svaku su zvezdica (omiljene) i linkovi za YouTube i Spotify. Omiljene se pamte po nazivu pesme i ostaju i posle brisanja istorije. Cela istorija se preuzima kao CSV ili briše.
- **Video:** ako stream ima i sliku (npr. HLS TV kanal), u pregledu se umesto loga prikazuje video, i na celom ekranu. Ništa ne treba označavati u plejlisti, prepoznaje se samo. Pazi na protok: video stream troši mnogo više podataka nego radio (primer `https://origin.streamnerd.nl/operator/operator/chunks.m3u8` oko 2 GB na sat), i to i kad je pregled zatvoren, jer su zvuk i slika u istom streamu.
- **Instalacija kao aplikacija (PWA):** svoj prozor, ikonica, rad bez interneta, otvaranje `.m3u` fajlova dvoklikom. Vidi [Instalacija kao aplikacija](#instalacija-kao-aplikacija-pwa).
- **Poruke** (greške, potvrde) se pojavljuju kao snackbar u donjem desnom uglu; klik ga zatvara. HLS (`.m3u8`) radi i u Chrome-u i Firefox-u preko `hls.js`, koji se učitava tek kad zatreba. Na https sajtu (GitHub Pages) browser blokira `http://` streamove, a za HLS server mora da dozvoli CORS.
- **Više plejlisti:** u redu iznad liste je padajući meni (Lista), polje za ime fajla i **Traži** (filtrira stanice po nazivu ili linku). **+** otvara novu listu, **×** zatvara tekuću; ako ima stanica koje nisu sačuvane u fajl, traži se drugi klik. Tačka (•) pored imena u meniju znači da lista nije sačuvana u fajl. Stanica koja svira nastavlja da svira i kad se pređe na drugu listu.
- **Uvoz postojećeg `.m3u`** (dugme ili prevlačenje fajla na desni panel). Ako tekuća plejlista nije prazna, bira se: nova lista, zameni listu ili dodaj na kraj. Više fajlova odjednom otvara svaki u svojoj listi. Dodatni atributi (`tvg-id`, `group-title`...) i `#EXTVLCOPT` linije se čuvaju pri izvozu.
- **Čuvanje:** sve plejliste se automatski čuvaju u pregledaču (`localStorage`) i vraćaju pri sledećem otvaranju. Ikona preuzimanja pored imena fajla čuva tekuću listu kao `.m3u`; dok to nije urađeno posle poslednje izmene, u meniju stoji •, a gore piše "Nije sačuvano u fajl". M3U tekst se pregleda i kopira iz donjeg bloka "M3U tekst".

Izlazni format:

```
#EXTM3U
#EXTINF:-1 tvg-logo="https://i.ibb.co/xxxx/logo.png",LYL Lyon
https://radio.lyl.live/hls/aac_hifi.m3u8
```

## Stanice za probu

| Stanica | Link | Format |
|---|---|---|
| LYL Lyon | `https://radio.lyl.live/hls/aac_hifi.m3u8` | HLS (AAC) |
| Radio Paradise | `https://stream.radioparadise.com/mp3-128` | MP3 128 kbps |

Kao `.m3u` fajl (sačuvaj kao `proba.m3u` i uvezi ga u aplikaciju):

```
#EXTM3U
#EXTINF:-1,LYL Lyon
https://radio.lyl.live/hls/aac_hifi.m3u8
#EXTINF:-1,Radio Paradise
https://stream.radioparadise.com/mp3-128
```

## Pokretanje

Potreban je Node.js 20.19 ili noviji.

```bash
npm install
npm run dev       # razvojni server sa automatskim osvežavanjem
npm test          # testovi (parser, pomoćne funkcije)
npm run build     # produkcioni build u dist/
npm run preview   # lokalni pregled build-a
```

## API ključ i `.env`

Ključ za upload slika može da se zada na dva načina:

1. **U aplikaciji** (ikonica zupčanika gore desno). Čuva se samo u tom browseru (`localStorage`). Ovo je preporučeno za javni sajt.
2. **U `.env` fajlu**, za lokalni rad:

   ```bash
   cp .env.example .env
   # pa upiši VITE_IMGBB_API_KEY=...
   ```

Ključ unet u aplikaciji ima prednost. Ako je polje u aplikaciji prazno, koristi se ključ iz `.env`.

**Važno:** Vite ugrađuje sve `VITE_*` vrednosti u JavaScript koji se šalje browseru. Ako ključ iz `.env` uđe u build koji ide na GitHub Pages, svako ko otvori sajt može da ga pročita (i da uploaduje slike na tvoj nalog). Zato `.env` nije u repou (`.gitignore`), a GitHub Actions workflow podrazumevano ne ubacuje ključ u build.

| Promenljiva | Značenje |
|---|---|
| `VITE_UPLOAD_PROVIDER` | `imgbb` (podrazumevano) ili `imgur` |
| `VITE_IMGBB_API_KEY` | ImgBB API ključ |
| `VITE_IMGUR_CLIENT_ID` | Imgur Client ID |
| `VITE_NOWPLAYING_URL` | Adresa Workera za naziv pesme (nije tajna) |

## Deploy na GitHub Pages

Workflow `.github/workflows/deploy.yml` na svaki push na `main` pokreće testove, pravi build i objavljuje `dist/`.

Jednom podesi na GitHub-u: **Settings, Pages, Build and deployment, Source: GitHub Actions**. Posle sledećeg pusha sajt je na `https://<korisnik>.github.io/m3u-manager/`.

Ako ipak želiš ključ ugrađen u javni build: dodaj ga u **Settings, Secrets and variables, Actions** kao `VITE_IMGBB_API_KEY` i otkomentariši odgovarajuću liniju u workflow-u. Podrazumevani servis može da se zada kao repo varijabla `VITE_UPLOAD_PROVIDER`.

Aplikacija koristi relativne putanje (`base: './'` u `vite.config.js`), pa radi i na Vercel-u, Netlify-ju ili bilo kom statičnom hostingu (Build Command `npm run build`, Output Directory `dist`).

## Instalacija kao aplikacija (PWA)

Sajt može da se instalira kao aplikacija: dobija svoj prozor (bez adresne trake i tabova pregledača), ikonicu u Dock-u / Start meniju / na početnom ekranu telefona, i otvara se i bez interneta (plejliste mogu da se menjaju; streamovi, upload i naziv pesme, naravno, traže mrežu).

- **Chrome / Edge (računar, Android):** dugme **Instaliraj** u gornjoj traci (pojavi se kad pregledač dozvoli instalaciju) ili ikonica za instalaciju u adresnoj traci.
- **Safari na Mac-u:** **File, Add to Dock**.
- **iPhone / iPad:** u Safari-ju **Podeli, Dodaj na početni ekran**.

Posle instalacije u Chrome-u i Edge-u na računaru, `.m3u` fajlovi mogu da se otvaraju dvoklikom ili sa "Otvori pomoću" (M3U Studio). Na Androidu se aplikacija pojavljuje u meniju **Podeli**: podeljen link stanice upisuje se u formu za novu stanicu.

Nova verzija sajta stiže čim se aplikacija otvori sa internetom (stranica se uvek prvo traži sa mreže, a keš je rezerva bez mreže). Service worker se pravi samo pri build-u (`dist/sw.js`); `npm run dev` ga ne koristi, da se izmene odmah vide.

## Naziv pesme (Cloudflare Worker)

Stanice šalju naziv pesme na dva načina, a Worker u folderu `worker/` čita oba:

- **ICY** (Icecast/Shoutcast, MP3 i AAC streamovi): naziv je ubačen u sam stream, npr. Radio Paradise.
- **ID3** (HLS, `.m3u8`): naziv je u segmentima, npr. LYL Lyon.

Browser to ne može sam (CORS, a stream bi se skidao dvaput), pa aplikacija na svakih 20 sekundi pita Worker: `https://…workers.dev/?url=<link stanice>`. Worker pročita samo par desetina KB streama i vrati `{ "track": "Izvođač - Pesma", "source": "icy" }`. Ako stanica ne šalje naziv, aplikacija prestaje da pita za nju. Besplatan Cloudflare plan (100.000 zahteva dnevno) je više nego dovoljan.

### Postavljanje (jednom, oko 5 minuta)

Treba ti Cloudflare nalog i ovaj repo na računaru. Komande se kucaju u terminalu, u folderu projekta.

1. **Prijava na Cloudflare iz terminala:**

   ```bash
   npx wrangler login
   ```

   Otvoriće se browser; prijavi se i klikni **Allow**. Ako `npx` pita da li da instalira `wrangler`, odgovori `y`.

2. **Objavi Worker:**

   ```bash
   npm run worker:deploy
   ```

   Ako nalog još nema `workers.dev` poddomen, wrangler će tražiti da ga izabereš (npr. `kosijer`); to je deo adrese i bira se samo jednom. Na kraju ispiše adresu Workera, na primer:

   ```
   https://m3u-now-playing.kosijer.workers.dev
   ```

3. **Proveri da radi:** otvori u browseru (adresa iz koraka 2):

   ```
   https://m3u-now-playing.kosijer.workers.dev/?url=https://stream.radioparadise.com/mp3-128
   ```

   Treba da vidiš nešto kao `{"track":"Neil Young - Like a Hurricane","source":"icy"}`.

4. **Lokalno:** u `.env` dodaj liniju sa svojom adresom i ponovo pokreni `npm run dev`:

   ```
   VITE_NOWPLAYING_URL=https://m3u-now-playing.kosijer.workers.dev
   ```

5. **Na GitHub Pages:** na GitHub-u otvori repo, pa **Settings, Secrets and variables, Actions**, karticu **Variables**, **New repository variable**: ime `VITE_NOWPLAYING_URL`, vrednost adresa Workera. Zatim pokreni deploy ponovo (novi push, ili **Actions, Deploy na GitHub Pages, Run workflow**).

Adresa Workera nije tajna: Worker odgovara samo sajtovima navedenim u `ALLOWED_ORIGINS` u `worker/wrangler.toml` (tvoj GitHub Pages i lokalni razvoj). Ako sajt preseliš na drugi domen, dodaj ga tamo i ponovo pokreni `npm run worker:deploy`.

### Korisno

- `npm run worker:dev` pokreće Worker lokalno na `http://localhost:8787` (za probu izmena u `worker/src/`).
- `npx wrangler tail --config worker/wrangler.toml` prikazuje greške Workera uživo.
- Na mreži koja presreće HTTPS (korporativni proxy, npr. Netskope) lokalni `worker:dev` ne može da otvori neke stanice, jer ne veruje sertifikatu proxyja. Objavljen Worker radi na Cloudflare mreži, pa ga to ne pogađa.
- Neke stanice ne šalju naziv pesme; tada se u zaglavlju i dalje vidi samo "Uživo".

## Kako napraviti ImgBB API ključ

ImgBB je besplatan hosting za slike sa API-jem. Ključ je potreban samo za automatski upload loga.

1. Otvori **https://imgbb.com** i napravi nalog (**Sign up**), ili se prijavi ako ga već imaš. Za registraciju treba e-mail adresa.
2. Otvori **https://api.imgbb.com/**.
3. Klikni **Get API key**. Ako nisi prijavljen, tražiće prijavu.
4. Kopiraj ključ (dugačak niz slova i brojeva).
5. U M3U Studiju klikni zupčanik (gore desno), izaberi **ImgBB**, nalepi ključ u polje i klikni **Sačuvaj**. (Ili ga upiši u `.env`, vidi gore.)

Odmah probaj: dodaj stanicu sa slikom. Ako se u listi pojavi logo bez oznake "Upload ↻", upload radi.

Napomene:
- Aplikacija ne šalje parametar za istek, pa uploadovane slike ostaju na ImgBB-u dok ih ti ne obrišeš sa svog naloga.
- Ključ je vezan za tvoj nalog. Ne deli ga i ne stavljaj u javni repo. Ako procuri, na stranici api.imgbb.com možeš da ga zameniš novim.
- ImgBB servis i njegova ograničenja (veličina fajla, brzina, pravila) menjaju se nezavisno od ove aplikacije, pa proveri aktuelne uslove na njihovom sajtu.

### Imgur (alternativa)

1. Prijavi se na imgur.com.
2. Registruj aplikaciju na **https://api.imgur.com/oauth2/addclient**. Tip: *Anonymous usage without user authorization*, bez callback adrese.
3. Kopiraj **Client ID**.
4. U aplikaciji: zupčanik → servis **Imgur**, nalepi Client ID.

Imgur ima stroža ograničenja i neke mreže ga blokiraju, pa je ImgBB podrazumevan izbor.

### Postimages

Postimages.org nema javni API, zato nije ugrađen. Ručni tok: u kropperu klikni ikonicu **Preuzmi PNG** (600x600), uploaduj ga na postimages.org, a dobijeni direktan link nalepi u polje **Link logotipa**.

## Problemi

**Sajt na GitHub Pages je prazan ili nema poslednjih izmena**
U **Settings, Pages** izvor mora biti **GitHub Actions**. Ako je ostao "Deploy from a branch", na svaki push idu dva deploya i onaj iz grane (sirovi fajlovi, bez build-a) ponekad pregazi pravi. Posle promene pokreni deploy ponovo (**Actions, Deploy na GitHub Pages, Run workflow** ili novi push).

**Naziv pesme se ne pojavljuje**
Otvori `https://<adresa-workera>/?url=<link stanice>` u browseru. Ako tu ima naziva, proveri da je `VITE_NOWPLAYING_URL` podešen (lokalno u `.env`, za sajt kao repo varijabla) i da je posle toga urađen novi build. Ako odgovor ima `"source":null`, stanica ne šalje naziv pesme. Odmah posle prvog `worker:deploy` adresa može par minuta da ne radi dok Cloudflare ne izda sertifikat za novi poddomen.

**"Upload nije uspeo: nema veze sa servisom"**
Zahtev je blokiran ili nema mreže. Proveri internet i ad-blocker.

**"Upload nije uspeo: servis ne odgovara"**
Servis nije odgovorio za 30 sekundi. Pokušaj ponovo klikom na oznaku "Upload ↻" na stanici.

**Stanica je dodata, ali je logo označen "Upload ↻"**
Ključ nije unet ili upload nije prošao. Podesi ključ pa klikni oznaku na stanici za novi pokušaj. Pri čuvanju plejliste aplikacija će te upozoriti na sve logotipe koji još nisu uploadovani (nisu u fajlu dok ne prođu).

**"Taj sajt ne dozvoljava da se slika učita u pregledač"**
Dugme "Kropuj" radi samo za slike sa sajtova koji dozvoljavaju CORS. Sačuvaj sliku na računar (desni klik, Save image as) i prevuci je u polje za logo.

**Instalirana aplikacija prikazuje staru verziju**
Zatvori i ponovo otvori aplikaciju dok si na internetu. Ako i dalje ne pomaže, u pregledaču otvori sajt, pa **DevTools, Application, Service workers, Unregister** i osveži stranicu.

**Nestale plejliste**
Plejliste se čuvaju samo u pregledaču u kome su napravljene (drugi pregledač ili računar ih ne vidi). U privatnom prozoru ili posle brisanja podataka sajta se ne pamte; tada uvezi `.m3u` fajl ponovo. Ako pregledač nema mesta (mnogo logotipa koji čekaju upload), aplikacija to javlja porukom i pita pre zatvaranja stranice.

## Struktura koda

```
index.html                 markup
public/                    favicon, ikonice aplikacije, manifest.webmanifest (PWA)
vite.config.js             build; pravi dist/sw.js sa spiskom fajlova
src/
  sw.js                    service worker (keš za rad bez interneta)
  main.js                  pokretanje: vraća podešavanja i plejliste, vezuje događaje
  config.js                .env vrednosti i konstante
  state.js                 stanje aplikacije, više plejlisti, podešavanje upload-a
  storage.js               localStorage (bez grešaka u privatnom režimu)
  styles.css
  lib/                     čiste funkcije, bez DOM-a (imaju testove)
    m3u.js                 parseM3U, serializeM3U, parseAttrs
    station.js             model stanice, createStation, normalizeStation
    text.js                množina, ime fajla, validacija linka...
    history.js             istorija pesama: dodavanje bez duplikata, pretraga, CSV
    playlists.js           model plejliste, jedinstveno ime fajla
    blob.js                data URL u Blob, preuzimanje fajla
  services/
    upload.js              upload na ImgBB / Imgur (novi servis = nova funkcija u UPLOADERS)
    player.js              preslušavanje streama (audio + hls.js)
    track.js               naziv pesme: pita Worker dok stanica svira
  ui/
    dom.js                 els (svi elementi sa id-jem), toast, dugme sa potvrdom
    status.js              gornja traka, brojač, odloženo čuvanje plejlisti
    tabs.js                padajući meni plejlisti: izbor, nova, zatvaranje
    pwa.js                 instalacija, otvaranje .m3u iz sistema, link iz menija "Podeli"
    accordion.js           leva kolona: otvorena je forma ili pregled stanice
    form.js                forma za dodavanje i izmenu stanice
    cropper.js             kropper za logo (600x600 PNG)
    list.js                lista stanica i promena redosleda
    now-playing.js         veliki pregled stanice, kontrole i prečice na tastaturi
    history.js             prikaz istorije pesama i prekidač Plejlista / Istorija
    icons.js               SVG ikonice (play, pauza, prethodna, sledeća)
    playlist.js            uvoz (nova lista, zamena, dodavanje), čuvanje u fajl, kopiranje
    uploads.js             ponovni upload logotipa koji čekaju
    settings-dialog.js     dijalog "Upload slika"
worker/                    Cloudflare Worker za naziv pesme
  wrangler.toml            ime Workera i dozvoljeni sajtovi (ALLOWED_ORIGINS)
  src/index.js             HTTP: /?url=<stream> vraća { track, source }
  src/meta.js              čitanje ICY, ID3 i MPEG-TS (ima testove)
```

Model stanice:

```js
{ id, name, url, dur: '-1', logo: '', pending: '', attrs: [[k, v]], extras: ['#EXTVLCOPT:...'] }
```

`logo` je uploadovan URL, `pending` je data URL slike koja čeka upload, `attrs` su ostali atributi iz `#EXTINF`, `extras` su dodatne `#` linije između `#EXTINF` i linka.

Ključevi u `localStorage`: `m3ustudio.playlists.v1` (sve plejliste), `m3ustudio.settings.v1` (servis i ključ), `m3ustudio.history.v1` (istorija pesama) i `m3ustudio.favorites.v1` (omiljene pesme). Nacrt iz verzije sa jednom plejlistom (`m3ustudio.draft.v1`) se pri prvom otvaranju prebacuje u prvu listu.
