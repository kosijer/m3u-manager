# M3U Studio

Alat za pravljenje i uređivanje `.m3u` plejlisti internet radio stanica. Cela aplikacija je jedan fajl, `index.html`, bez build koraka i bez zavisnosti (osim Google Fonts, koji su opcioni).

Šta zamenjuje: ručno traženje loga, smanjivanje na 300x300, uploadovanje na hosting za slike, kopiranje linka u fajl i ručno slaganje redosleda.

## Šta radi

- **Dodavanje stanice:** naziv, link ka streamu i logo.
- **Kropper za logo:** slika se prevuče, izabere ili nalepi (Ctrl+V). Pomera se prevlačenjem, zumira točkićem ili klizačem. Izlaz je uvek PNG 300x300, sa providnom, belom ili crnom pozadinom. Dugme "Kropuj" pored polja za link učitava sliku sa linka (radi samo ako sajt dozvoljava CORS).
- **Automatski upload loga** na ImgBB (ili Imgur) posle potvrde. Dobijeni link ide u `tvg-logo`.
- **Lista stanica** sa prevlačenjem za promenu redosleda. Ručka ima i tastaturu (strelice gore i dole kad je fokusirana). Klik na stanicu otvara izmenu, sa poljem "Mesto u listi" i brisanjem.
- **Uvoz postojećeg `.m3u`** (dugme ili prevlačenje fajla na desni panel). Dodatni atributi (`tvg-id`, `group-title`...) i `#EXTVLCOPT` linije se čuvaju pri izvozu.
- **Čuvanje:** dugme "Sačuvaj plejlistu" preuzima fajl. Postoje i kopiranje teksta i pregled M3U teksta.
- **Automatski nacrt:** nesačuvan rad se pamti u `localStorage` i vraća pri sledećem otvaranju.

Izlazni format:

```
#EXTM3U
#EXTINF:-1 tvg-logo="https://i.ibb.co/xxxx/logo.png",LYL Lyon
https://radio.lyl.live/hls/aac_hifi.m3u8
```

## Pokretanje

### Lokalno

Dvoklik na `index.html` (Chrome, Edge ili Firefox). Ako upload ne radi iz fajla (pogledaj "Problemi"), pokreni lokalni server:

```bash
npx serve .
# ili
python3 -m http.server 8080
```

pa otvori adresu koju ispiše.

### Vercel (ako lokalno ne radi, ili za deljenje)

Aplikacija je statična, nema build koraka.

1. Stavi `index.html` (i ovaj README) u GitHub repo, `index.html` u korenu.
2. Na vercel.com: **Add New, Project**, izaberi repo.
3. **Framework Preset:** `Other`. **Build Command** i **Output Directory** ostavi prazne.
4. **Deploy.**

Posle refaktora u više fajlova (ili sa bundlerom) podesi Build Command i Output Directory prema alatu koji koristiš (npr. Vite: `npm run build` i `dist`).

Bitno: **API ključ nikad ne ide u kod ni u repo.** Svako ga unosi u aplikaciji, a čuva se samo u njegovom browseru (`localStorage`).

## Kako napraviti ImgBB API ključ

ImgBB je besplatan hosting za slike sa API-jem. Ključ je potreban samo za automatski upload loga.

1. Otvori **https://imgbb.com** i napravi nalog (**Sign up**), ili se prijavi ako ga već imaš. Za registraciju treba e-mail adresa.
2. Otvori **https://api.imgbb.com/**.
3. Klikni **Get API key**. Ako nisi prijavljen, tražiće prijavu.
4. Kopiraj ključ (dugačak niz slova i brojeva).
5. U M3U Studiju klikni **Upload slika** (gore desno), izaberi **ImgBB**, nalepi ključ u polje i klikni **Sačuvaj**.

Odmah probaj: dodaj stanicu sa slikom. Ako se u listi pojavi logo bez oznake "Upload ↻", upload radi.

Napomene:
- Aplikacija ne šalje parametar za istek, pa uploadovane slike ostaju na ImgBB-u dok ih ti ne obrišeš sa svog naloga.
- Ključ je vezan za tvoj nalog. Ne deli ga i ne stavljaj u javni repo. Ako procuri, na stranici api.imgbb.com možeš da ga zameniš novim (ime opcije može da se razlikuje, pogledaj stranicu).
- ImgBB servis i njegova ograničenja (veličina fajla, brzina, pravila) menjaju se nezavisno od ove aplikacije, pa proveri aktuelne uslove na njihovom sajtu.

### Imgur (alternativa)

1. Prijavi se na imgur.com.
2. Registruj aplikaciju na **https://api.imgur.com/oauth2/addclient**. Tip: *Anonymous usage without user authorization*, bez callback adrese.
3. Kopiraj **Client ID**.
4. U aplikaciji: **Upload slika**, servis **Imgur**, nalepi Client ID.

Imgur ima stroža ograničenja i neke mreže ga blokiraju, pa je ImgBB podrazumevan izbor.

### Postimages

Postimages.org nema javni API koji sam uspeo da potvrdim, zato nije ugrađen. Ako želiš ručni tok: u kropperu klikni **Preuzmi PNG** (300x300), uploaduj ga na postimages.org, a dobijeni direktan link nalepi u polje **Link logotipa**.

## Problemi

**"Upload nije uspeo: nema veze sa servisom"**
Zahtev je blokiran ili nema mreže. Proveri internet i ad-blocker. Ako se otvara kao `file://`, probaj preko lokalnog servera ili Vercel-a, jer neki servisi ne vole zahteve sa `file://` adrese.

**Stanica je dodata, ali je logo označen "Upload ↻"**
Ključ nije unet ili upload nije prošao. Podesi ključ pa klikni oznaku na stanici za novi pokušaj. Pri čuvanju plejliste aplikacija će te upozoriti na sve logotipe koji još nisu uploadovani (nisu u fajlu dok ne prođu).

**"Taj sajt ne dozvoljava da se slika učita u pregledač"**
Dugme "Kropuj" radi samo za slike sa sajtova koji dozvoljavaju CORS. Sačuvaj sliku na računar (desni klik, Save image as) i prevuci je u polje za logo.

**Nestala lista posle zatvaranja taba**
Nacrt se vraća automatski samo ako je lista imala nesačuvane izmene. Ako je sačuvana, uvezi fajl ponovo. U privatnom prozoru ili sa obrisanim podacima sajta nacrt se ne pamti.

## Za refaktor

Sve je u `index.html` (CSS, markup i jedna skripta). Mesta koja su već odvojena:

- **Čiste funkcije** (bez DOM-a, lako se izdvajaju i testiraju), označene komentarima `// <pure>` i `// </pure>`: `parseAttrs`, `makeStation`, `parseM3U`, `serializeList`.
- **Stanje:** objekat `S` (`stations`, `header`, `filename`, `selectedId`, `dirty`, `busy`) i `settings` (`provider`, `imgbb`, `imgur`).
- **Model stanice:**
  ```js
  { id, name, url, dur: '-1', logo: '', pending: '', attrs: [[k, v]], extras: ['#EXTVLCOPT:...'] }
  ```
  `logo` je uploadovan URL, `pending` je data URL slike koja čeka upload, `attrs` su ostali atributi iz `#EXTINF`, `extras` su dodatne `#` linije između `#EXTINF` i linka.
- **Upload:** funkcija `uploadLogo(blob)` vraća URL slike. Novi servis se dodaje kao još jedna grana u njoj, plus opcija u dijalogu za podešavanje.
- **Kropper:** objekat `crop` i funkcije `drawCrop`, `clampCrop`, `exportCrop`. Isti `drawCrop` crta pregled (600x600) i izvoz (300x300).
- **Prevlačenje redosleda:** `startDrag` (pointer događaji, radi i na touch uređajima).
- **Čuvanje u browseru:** ključevi `m3ustudio.draft.v1` (nacrt) i `m3ustudio.settings.v1` (servis i ključ).

Predlog podele: `parser.js` (čiste funkcije), `cropper.js`, `upload.js`, `state.js`, `ui.js`, `styles.css`.

## Licenca

Po tvom izboru.
