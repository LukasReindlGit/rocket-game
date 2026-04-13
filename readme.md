Für ein Messe-Event möchten wir ein Spiel haben:
Man startet die Zeit und muss nach exakt 10 s auf den Buzzer drücken. Ist wohl gerade ein Trend (bitte online prüfen).

Nachdem man gespielt hat, wird ein QR-Code angezeigt. Wenn man ihn mit dem Handy scannt, kommt man auf ein Formular, in dem man seinen Namen eingeben kann.
- Name
- E-Mail
- Nickname
- Die Bestzeit (wie weit man neben der 10-Sekunden-Marke lag) wird automatisch über den QR-Code übergeben.

Die Bestenliste wird auf der Seite des Spiels angezeigt.


## Technisch

Alles muss auf einem Webserver laufen. Das Leaderboard ist eine einfache CSV.
Der Server bietet die Endpunkte `/game` und `/survey?…`.

Das Spiel läuft in einem Browser im Vollbild an der Messe. Die Zeitberechnung läuft lokal, um das Internet nicht zu belasten.

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