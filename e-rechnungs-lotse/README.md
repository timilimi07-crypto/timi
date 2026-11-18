# E-Rechnungs-Lotse

E-Rechnungen (XRechnung, ZUGFeRD/Factur-X) empfangen, prüfen, verständlich anzeigen, GoBD-konform archivieren
und an das Steuerbüro exportieren – für Handwerk und Kleinbetriebe.

```bash
cp .env.example .env
docker compose up --build      # web :3000, validator :8081, postgres :5432, minio :9000/:9001
pnpm install && pnpm test      # Unit-Tests packages/core
```

Regeln, Architektur und Befehle: [CLAUDE.md](./CLAUDE.md) · Doku: [docs/](./docs)
