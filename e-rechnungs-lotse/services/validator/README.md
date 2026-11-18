# Validator-Service (KoSIT)

Offizieller [KoSIT-Validator](https://github.com/itplr-kosit/validator) mit der
[XRechnung-Konfiguration](https://github.com/itplr-kosit/validator-configuration-xrechnung) im HTTP-Daemon-Modus.

| Build-Argument             | Standard     | Bedeutung                                      |
| -------------------------- | ------------ | ---------------------------------------------- |
| `VALIDATOR_VERSION`        | `1.6.3`      | Version des Validators (Maven Central)         |
| `XRECHNUNG_VERSION`        | `3.0.2`      | XRechnung-Standard der Konfiguration           |
| `XRECHNUNG_CONFIG_RELEASE` | `2026-08-31` | Release-Datum der Konfiguration                |
| `*_SHA256`                 | leer         | Optionale Prüfsummen der Downloads (empfohlen) |

Die Werte werden in `infra/docker-compose.yml` aus `.env` gelesen.

## Endpunkte

- `GET /server/health` – Health-Check
- `GET /server/config` – geladene Konfiguration
- `POST /` – XML im Body, Antwort: Prüfbericht (XML). Header `Accept: text/html` liefert HTML.

```bash
curl -s localhost:8081/server/health
curl -s -X POST --data-binary @rechnung.xml -H "Content-Type: application/xml" localhost:8081/
```

## Update auf neue Version

1. Neue Versionen in `.env` / `.env.example` eintragen (`VALIDATOR_VERSION`, `XRECHNUNG_*`).
2. `docker compose build validator && docker compose up -d validator`
3. Health-Check und Prüfung einer Testrechnung kontrollieren, `docs/architektur.md` aktualisieren.
