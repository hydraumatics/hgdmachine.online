Ich schaue mir zuerst das Repository an.

Die Pipeline liegt in `deploy.yml`. Sie gehört nach `.github/workflows/deploy.yml` in dein Repo. Sie läuft in zwei Stufen:

1. **Tests** laufen bei jedem Push und jedem Pull Request auf `main`.
2. **Deploy** hängt per `needs: test` an den Tests und startet nur, wenn alle grün sind. Ein Push auf `main` geht nach Production. Pull Requests und andere Branches bekommen eine Preview-URL.

**Einmalig bei dir einrichten:**
- Lege in Cloudflare ein API-Token an (Rechte: *Account → Cloudflare Pages → Edit*) und trage es in GitHub unter *Settings → Secrets and variables → Actions* als `CLOUDFLARE_API_TOKEN` ein.
- Trage die Account-ID aus dem Cloudflare-Dashboard als `CLOUDFLARE_ACCOUNT_ID` ein.
- Lege das Pages-Projekt an, falls es noch nicht existiert (`npx wrangler pages project create hgdmachine-online`). Wenn dein Projekt anders heißt, ändere `--project-name`.
- Falls Cloudflare das Repo bisher selbst per Git-Integration baut, deaktiviere das. Sonst deployt es doppelt.

**Annahmen, die du prüfen musst (im File mit `ANPASSEN` markiert):**
- Dein Stack ist Node mit `npm ci`, `npm test` und `npm run build`.
- Das Build-Ergebnis liegt in `dist`. Bei einer reinen Static-Site ohne Build entfällt `npm run build`, und `dist` wird zum Ordner mit deinen HTML-Dateien, zum Beispiel `.`.
- Die Domain `hgdmachine.online` hängst du im Cloudflare-Dashboard unter *Pages → Custom domains* an das Projekt.

Wenn du mir kurz sagst, welchen Stack du nutzt (oder den Inhalt von `package.json` und dem Test-Ordner postest), passe ich die Datei exakt an. Dann kann ich auch Lint, Playwright-E2E-Tests oder einen Smoke-Test gegen die Preview-URL einbauen.



