FROM nvidia/cuda:12.3.2-devel-ubuntu22.04

ARG CUDA_ARCH_GENCODE="arch=compute_89,code=sm_89"

ENV DEBIAN_FRONTEND=noninteractive \
    CUDA_HOME=/usr/local/cuda \
    NVCC_PREPEND_FLAGS="-gencode ${CUDA_ARCH_GENCODE}" \
    RUSTUP_HOME=/root/.rustup \
    CARGO_HOME=/root/.cargo \
    RZUP_HOME=/root/.risc0 \
    LIBCLANG_PATH=/usr/lib/llvm-14/lib

# Base dependencies for Rust + CUDA proving.
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        curl \
        build-essential \
        ca-certificates \
        clang-14 \
        git \
        libclang-14-dev \
        libssl-dev \
        pkg-config \
        protobuf-compiler \
        python3 \
        python3-pip \
        unzip \
        wget && \
    rm -rf /var/lib/apt/lists/*

# Install Rust toolchain (rustup) for the host crates.
RUN curl https://sh.rustup.rs -sSf | sh -s -- -y --profile minimal && \
    . "$CARGO_HOME/env" && \
    rustup toolchain install 1.90 --component rustfmt --component clippy

ENV PATH="${CARGO_HOME}/bin:${PATH}"

# Install rzup + default RISC Zero toolchains (rust, cargo-risczero, r0vm).
RUN curl -L https://risczero.com/install | bash && \
    "$RZUP_HOME/bin/rzup" install rust && \
    "$RZUP_HOME/bin/rzup" install cargo-risczero && \
    "$RZUP_HOME/bin/rzup" install r0vm

ENV PATH="${RZUP_HOME}/toolchains/v1.90.0-rust-x86_64-unknown-linux-gnu/bin:${RZUP_HOME}/bin:${CARGO_HOME}/bin:${CUDA_HOME}/bin:${PATH}"
ENV LD_LIBRARY_PATH="${CUDA_HOME}/lib64:${CUDA_HOME}/nvvm/lib64:${LD_LIBRARY_PATH}"

# Clone the full RISC Zero repo so examples + dependencies exist even without a bind mount.
RUN git clone --depth 1 https://github.com/risc0/risc0.git /opt/risc0 && \
    chmod -R a+rw /opt/risc0

# Copy the current repo into the image.
WORKDIR /opt/risc0

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