# Öffentliche Dateien und private Konfiguration

Das Template enthält Quellcode, ein leeres Environment-Beispiel, das Datenbankschema und Screenshots mit erfundenen Managern. Es enthält keine bestehende Liga, Datenbank-Backups, Nutzerkonten, Git-Historie oder Deployment-Konfiguration.

## Was bleibt privat?

| Inhalt | Speicherort |
| --- | --- |
| Eigene Projektadresse und Publishable Key | `.env.local` oder Hosting-Umgebungsvariablen |
| Liga-Code und Setup-SQL | `.local/bootstrap.sql` |
| Importdateien | `.local/` |
| Secret / Service-role Key | ausschließlich Supabase Edge-Function-Secrets |
| Passwörter, Sitzungen, Datenbank-Backups | niemals ins Repository |

Der [Publishable Key](https://supabase.com/docs/guides/getting-started/api-keys) wird im Browser sichtbar. Die Zugriffsrechte kommen aus Authentifizierung und Row Level Security. Ein Secret Key umgeht RLS und darf deshalb weder im Browser noch im Repository landen.

Die Registrierung überprüft den Liga-Code in einem privaten Datenbankschema. Rollen und Liga-Zugehörigkeit stammen aus serverseitig gesetzten `app_metadata`. Der erste registrierte Manager wird Commissioner: Registriere deinen eigenen Account, bevor du den Code an andere weitergibst. Bestätigungs-E-Mails sind für die technischen Login-Adressen deaktiviert; Passwortzurücksetzung per E-Mail ist damit nicht eingerichtet.

## Vor einem Push

```bash
pnpm security:check
git status --short
git diff --cached
```

Die Prüfung untersucht Git-getrackte Dateien (ohne Git-Repository den aktuellen Quellordner). Lokale, ignorierte Konfiguration wird nicht veröffentlicht. Sie erkennt typische Schlüssel, Tokens, JWTs, private Dateien, eingebettete Zugangsdaten und persönliche Deployment-Adressen. Sie gibt nur Dateinamen und Kategorien aus. Sie ist ein Mustercheck, kein vollständiges Sicherheitsaudit; Bildinhalte müssen visuell geprüft werden. Für die gesamte Git-Historie zusätzlich [Gitleaks](https://github.com/gitleaks/gitleaks) einsetzen und GitHub Secret Scanning / Push Protection aktivieren, soweit verfügbar.

Falls ein echter Secret Key bereits veröffentlicht wurde: beim Anbieter widerrufen und ersetzen. Ein späterer Lösch-Commit entfernt ihn nicht aus alten Commits.

## Produktgrenzen

- Die Liga ist auf genau fünf Manager und eine Saison mit höchstens 38 Gameweeks ausgelegt.
- Saisonimport ist ein Snapshot. Spätere Anstoßzeiten und verschobene Spiele benötigen einen erneuten Import; Fixtures ohne Gameweek oder Anstoßzeit werden ausgelassen.
- Der Commissioner steuert den Gameweek-Status. Die Anwendung enthält keinen Scheduler, der Status oder Wertungen automatisch aktualisiert.
- Transferfenster, freie Spieler und bestehende Trades werden angezeigt; eine vollständige Trade-/Add-drop-Bedienung ist noch nicht vorhanden.
- Externe Wertungs- und Verletzungsimporte sind optionale Integrationen. Vor produktiver Nutzung Zugangs- und Nutzungsbedingungen des jeweiligen Datenanbieters klären. Ein öffentliches Code-Template erteilt keine Rechte an fremden Daten, Vereinswappen oder Marken.
- Kein Passwort-Reset, keine vollständige Saison-Neustart-Bedienung, kein Multi-League-Dashboard und keine automatische Bankeinwechslung.
