für ein messe event möchten wir ein spiel haben: 
man startet die zeit und muss nach exakt 10sec auf den buzzer drücken. ist wohl gerade ein trend. (bitte online prüfen).

nachdem man gespielt hat, wird er QR code angezeigt. wenn man ihn mit dem handy scannt, kommt man auf einen form in dem man seinen namen eingeben kann. 
- name
- email
- nickname
- die Bestzeit (wie weit man neben der 10sec marke lag) wird automatisch über den QR code übergeben.


Bestenliste wird auf der seite des spiels angezeigt.


## Technisch

alles muss auf einem webserver laufen. leaderboard ist eine einfache csv.
der server bietet die endpunkte "game" und "survey?time=13".

Das spiel läuft in einem browser in fullscreen an der messe. die zeitberechnung läuft lokal um das internet nicht zu belasten.

Der Buzzer ist ein **physisches USB-Gerät** und verhält sich meist wie eine **Tastatur**: ein Tastendruck (typisch **Leertaste** oder **Enter**) = Buzzer. Im Frontend per Keyboard-Events abfangen.

Design orientiert sich an der salesfive website. CI, LOGO etc wird verwendet.

## Start (Implementierung)

```bash
npm install
npm start
```

Wenn **Port 3000 schon belegt** ist (z. B. alter `node server.js`), startet der Server automatisch auf **3001** … **3010** — URL steht in der Konsole. Festen Port erzwingen: `PORT=3001 npm start`.

- Spiel: `http://localhost:3000/game` (Redirect von `/`) — bei Fallback den Port aus der Terminal-Ausgabe nehmen
- Formular: `http://localhost:3000/survey?time=47&elapsed=10047`
- Leaderboard-Daten: `data/leaderboard.csv` (wird beim Start angelegt)

API: `GET /api/leaderboard`, `POST /api/submit` (JSON), `GET /api/qr?u=` (PNG-QR für eine URL).