# lolMiner Multi-Algorithm GPU Miner for SaladCloud
# Supports Autolykos2 (ERG), Etchash (ETC), KawPow (RVN), and more
FROM nvidia/cuda:12.2.0-runtime-ubuntu22.04

# Prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    ca-certificates \
    tar \
    && rm -rf /var/lib/apt/lists/*

# Create miner directory
RUN mkdir -p /miner

# Download lolMiner (latest release)
WORKDIR /miner
RUN wget -q https://github.com/Lolliedieb/lolMiner-releases/releases/download/1.98a/lolMiner_v1.98a_Lin64.tar.gz \
    && tar -xzf lolMiner_v1.98a_Lin64.tar.gz \
    && mv 1.98a/* . \
    && rm -rf 1.98a lolMiner_v1.98a_Lin64.tar.gz \
    && chmod +x lolMiner

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

WORKDIR /miner

# Expose API port
EXPOSE 4068

ENTRYPOINT ["/entrypoint.sh"]
