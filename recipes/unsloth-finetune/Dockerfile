# New Salad-safe image based on official Unsloth
FROM unsloth/unsloth:stable

USER root

# Kelpie sync points
RUN mkdir -p /opt/checkpoints /opt/outputs /opt/assets \
    # Add the default Kelpie work dirs it tries to clear
 && mkdir -p /input /output /checkpoint \
 && chmod 777 /input /output /checkpoint


# Upgrade / add required Python packages (user-level; no root needed)
RUN pip install --upgrade --no-cache-dir unsloth unsloth_zoo


# Place helper script in home (no /opt usage)
COPY unsloth-cli.py /opt/unsloth-cli.py

# Download kelpie into user-local bin
ARG KELPIE_VERSION=0.6.1
RUN set -eux; \
    curl -fsSL --retry 5 --retry-connrefused --connect-timeout 30 --http1.1 \
        -o /usr/local/bin/kelpie \
        https://github.com/SaladTechnologies/kelpie/releases/download/${KELPIE_VERSION}/kelpie && \
    chmod +x /usr/local/bin/kelpie && \
    ln -sf /usr/local/bin/kelpie /kelpie

ENTRYPOINT ["kelpie"]
CMD []
