# syntax=docker/dockerfile:1
# KoSIT-Validator (offizielles Prüfwerkzeug) im Daemon-/HTTP-Modus mit XRechnung-Konfiguration.
# Versionen sind Build-Argumente – für ein Update nur diese Werte (und ggf. Prüfsummen) anpassen.
#   Validator:     https://repo1.maven.org/maven2/org/kosit/validator/
#   Konfiguration: https://github.com/itplr-kosit/validator-configuration-xrechnung/releases

ARG JAVA_IMAGE=eclipse-temurin:21-jre

FROM ${JAVA_IMAGE} AS download
ARG VALIDATOR_VERSION=1.6.3
ARG XRECHNUNG_VERSION=3.0.2
ARG XRECHNUNG_CONFIG_RELEASE=2026-08-31
# Optional: SHA-256 der Downloads. Wenn gesetzt, wird geprüft.
ARG VALIDATOR_SHA256=""
ARG XRECHNUNG_CONFIG_SHA256=""
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl unzip ca-certificates \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /opt/validator
# Optional: zusätzliche CA (z. B. TLS-prüfender Firmen-Proxy) per BuildKit-Secret "extra_ca".
RUN --mount=type=secret,id=extra_ca,required=false set -eux; \
    if [ -s /run/secrets/extra_ca ]; then \
      cat /etc/ssl/certs/ca-certificates.crt /run/secrets/extra_ca > /tmp/ca.pem; export CURL_CA_BUNDLE=/tmp/ca.pem; \
    fi; \
    curl -fsSL -o validator.jar \
      "https://repo1.maven.org/maven2/org/kosit/validator/${VALIDATOR_VERSION}/validator-${VALIDATOR_VERSION}-standalone.jar"; \
    curl -fsSL -o config.zip \
      "https://github.com/itplr-kosit/validator-configuration-xrechnung/releases/download/v${XRECHNUNG_CONFIG_RELEASE}/xrechnung-${XRECHNUNG_VERSION}-validator-configuration-${XRECHNUNG_CONFIG_RELEASE}.zip"; \
    if [ -n "${VALIDATOR_SHA256}" ]; then echo "${VALIDATOR_SHA256}  validator.jar" | sha256sum -c -; fi; \
    if [ -n "${XRECHNUNG_CONFIG_SHA256}" ]; then echo "${XRECHNUNG_CONFIG_SHA256}  config.zip" | sha256sum -c -; fi; \
    mkdir config && unzip -q config.zip -d config && rm config.zip; \
    test -f config/scenarios.xml

FROM ${JAVA_IMAGE}
ARG VALIDATOR_VERSION=1.6.3
ARG XRECHNUNG_VERSION=3.0.2
ARG XRECHNUNG_CONFIG_RELEASE=2026-08-31
LABEL org.opencontainers.image.title="erl-validator" \
      de.erl.validator.version="${VALIDATOR_VERSION}" \
      de.erl.xrechnung.version="${XRECHNUNG_VERSION}" \
      de.erl.xrechnung.config-release="${XRECHNUNG_CONFIG_RELEASE}"
ENV VALIDATOR_VERSION=${VALIDATOR_VERSION} \
    XRECHNUNG_VERSION=${XRECHNUNG_VERSION} \
    XRECHNUNG_CONFIG_RELEASE=${XRECHNUNG_CONFIG_RELEASE} \
    VALIDATOR_PORT=8080 \
    JAVA_OPTS="-Xmx512m"
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 validator
COPY --from=download /opt/validator /opt/validator
USER validator
WORKDIR /opt/validator
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD curl -fsS "http://localhost:${VALIDATOR_PORT}/server/health" || exit 1
# -D = Daemon-Modus (HTTP). POST / mit dem XML im Body liefert den Prüfbericht.
CMD ["sh", "-c", "exec java $JAVA_OPTS -jar validator.jar -s config/scenarios.xml -r config -D -H 0.0.0.0 -P ${VALIDATOR_PORT}"]
