FROM docker.m.daocloud.io/library/python:3.10-slim

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    unzip \
    build-essential \
    libsndfile1 \
    libssl-dev \
    golang \
    && rm -rf /var/lib/apt/lists/*

# Install tman (Official TEN Manager)
# We need this to download the "Standard Library" of TEN extensions
RUN curl -fsSL https://raw.githubusercontent.com/TEN-framework/ten-framework/main/tools/tman/install_tman.sh | bash

WORKDIR /app

# -------------------------------------------------------------
# STEP 1: Install Remote Dependencies (The "Standard Library")
# -------------------------------------------------------------
# We copy ONLY manifest.json first. This allows cache reuse.
# These packages (aliyun_asr, openai, etc.) are downloaded from the registry.
COPY manifest.json /app/
RUN tman install

# -------------------------------------------------------------
# STEP 2: Install Local/Custom Extensions (Your Code)
# -------------------------------------------------------------
# 1. Copy the main application code
COPY . /app

# 2. OVERLAY your custom extensions into the runtime directory.
# Any folder in 'extension_src/' (e.g., 'your_new_extension')
# will be copied into 'ten_packages/extension/'.
# This makes them visible to the TEN Runtime.
RUN cp -r extension_src/* ten_packages/extension/

# Ensure CGO can find TEN runtime headers and shared libs during build
ENV CGO_CFLAGS="-I/app/ten_packages/system/ten_runtime_go/interface/ten_runtime -I/app/ten_packages/system/ten_runtime/include" \
    CGO_LDFLAGS="-L/app/ten_packages/system/ten_runtime_go/lib -L/app/ten_packages/system/ten_runtime/lib -lten_runtime_go -lten_runtime -lten_utils"

# Build Go runtime binary
RUN cd /app && go build -o bin/main

# Create venv and install Python deps from extensions
# IMPORTANT: Disable proxy inside container since we use Aliyun mirror
ENV http_proxy="" \
    https_proxy="" \
    HTTP_PROXY="" \
    HTTPS_PROXY="" \
    no_proxy="*"
RUN python3 -m venv /app/venv \
    && . /app/venv/bin/activate \
    && pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ \
    && pip config set global.trusted-host mirrors.aliyun.com \
    && export http_proxy="" && export https_proxy="" && export HTTP_PROXY="" && export HTTPS_PROXY="" \
    && pip install --upgrade pip --proxy="" \
    && pip install -r /app/ten_packages/system/ten_runtime_python/requirements.txt --proxy="" \
    && pip install /app/ten_packages/system/ten_runtime_python --proxy="" \
    && pip install -r /app/ten_packages/system/ten_ai_base/requirements.txt --proxy="" \
    && find /app/ten_packages/extension -name "requirements.txt" -print -exec pip install -r {} --proxy="" \; \
    && find /app/ten_packages/extension -maxdepth 1 -mindepth 1 -type d -print -exec pip install {} --proxy="" \; \
    && pip install --no-cache-dir pydantic==2.10.3 tenacity==8.3.0 --proxy=""

ENV PATH=/app/venv/bin:$PATH
ENV PYTHONPATH=/app:/app/ten_packages:/app/ten_packages/extension:/app/ten_packages/system/ten_runtime_python/interface:/app/ten_packages/system/ten_ai_base/interface:$PYTHONPATH
ENV LD_LIBRARY_PATH=/app/ten_packages/system/ten_runtime_go/lib:/app/ten_packages/system/ten_runtime/lib:/app/ten_packages/system/ten_runtime_python/lib:$LD_LIBRARY_PATH
ENV TEN_PYTHON_LIB_PATH=/usr/local/lib/libpython3.10.so.1.0

EXPOSE 8766

CMD ["/bin/bash", "-c", ". /app/venv/bin/activate && /app/scripts/start.sh"]
