# TEN Agent Dockerfile - 优化的国内镜像源配置
# 使用 DaoCloud 镜像 + 国内 apt/pip 源加速

FROM docker.m.daocloud.io/library/python:3.10-slim

# 接收 docker-compose 传递的代理参数（构建时禁用代理）
ARG http_proxy
ARG https_proxy
ARG HTTP_PROXY
ARG HTTPS_PROXY
ARG no_proxy

# 不设置代理环境变量（让 Docker Compose 传入的 ARG 只用于构建时）
# 运行时完全禁用代理

# =============================================
# STEP 1: 配置国内镜像源（apt + pip）
# =============================================

# 使用阿里云 Debian 源
RUN sed -i 's/deb.debian.org/mirrors.aliyun.com/g' /etc/apt/sources.list.d/debian.sources || \
    (echo "deb https://mirrors.aliyun.com/debian/ bookworm main contrib non-free non-free-firmware" > /etc/apt/sources.list && \
     echo "deb https://mirrors.aliyun.com/debian/ bookworm-updates main contrib non-free non-free-firmware" >> /etc/apt/sources.list)

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    wget \
    unzip \
    build-essential \
    libsndfile1 \
    libssl-dev \
    golang \
    git \
    && rm -rf /var/lib/apt/lists/*

# 配置 pip 使用阿里云镜像源
RUN pip config set global.index-url https://mirrors.aliyun.com/pypi/simple/ && \
    pip config set global.trusted-host mirrors.aliyun.com

# =============================================
# STEP 2: 安装 tman (TEN Package Manager)
# =============================================

# 直接从 GitHub 安装 tman（不使用国内代理，因为 ghproxy 不可用）
RUN curl -fsSL https://raw.githubusercontent.com/TEN-framework/ten-framework/main/tools/tman/install_tman.sh | bash

# 确保 tman 在 PATH 中（安装到 ~/.local/bin）
ENV PATH="/root/.local/bin:${PATH}" \
    # 禁用代理
    http_proxy= \
    https_proxy= \
    HTTP_PROXY= \
    HTTPS_PROXY= \
    no_proxy="*"

WORKDIR /app

# =============================================
# STEP 3: 配置 tman 使用中国 Registry
# =============================================

# 配置 tman 使用中国官方 registry (v3 API)
RUN mkdir -p ~/.tman && \
    echo '{"registry":{"default":{"index":"https://registry-ten.rtcdeveloper.cn/api/ten-cloud-store/v3/packages"}},"enable_package_cache":false}' > ~/.tman/config.json

# 先复制 manifest.json，利用 Docker 缓存
COPY manifest.json /app/

# 安装 TEN 依赖包（从中国 registry）
# 明确禁用代理环境变量，避免 Go 程序解析错误
RUN unset http_proxy https_proxy HTTP_PROXY HTTPS_PROXY && tman install

# =============================================
# STEP 4: 安装本地扩展
# =============================================

COPY . /app
RUN cp -r extension_src/* ten_packages/extension/

# =============================================
# STEP 5: 编译 Go Runtime
# =============================================

# 配置 CGO 编译环境
ENV CGO_CFLAGS="-I/app/ten_packages/system/ten_runtime_go/interface/ten_runtime -I/app/ten_packages/system/ten_runtime/include" \
    CGO_LDFLAGS="-L/app/ten_packages/system/ten_runtime_go/lib -L/app/ten_packages/system/ten_runtime/lib -lten_runtime_go -lten_runtime -lten_utils"

RUN cd /app && go build -o bin/main

# =============================================
# STEP 6: 安装 Python 依赖
# =============================================

# 创建虚拟环境并安装 Python 包
RUN python3 -m venv /app/venv && \
    . /app/venv/bin/activate && \
    pip install --upgrade pip && \
    pip install -r /app/ten_packages/system/ten_runtime_python/requirements.txt && \
    pip install /app/ten_packages/system/ten_runtime_python && \
    pip install -r /app/ten_packages/system/ten_ai_base/requirements.txt && \
    find /app/ten_packages/extension -name "requirements.txt" -print -exec pip install -r {} \; && \
    find /app/ten_packages/extension -maxdepth 1 -mindepth 1 -type d -print -exec pip install {} \; && \
    pip install --no-cache-dir pydantic==2.10.3 tenacity==8.3.0

# =============================================
# STEP 7: 运行时配置
# =============================================

ENV PATH=/app/venv/bin:$PATH \
    PYTHONPATH=/app:/app/ten_packages:/app/ten_packages/extension:/app/ten_packages/system/ten_runtime_python/interface:/app/ten_packages/system/ten_ai_base/interface:$PYTHONPATH \
    LD_LIBRARY_PATH=/app/ten_packages/system/ten_runtime_go/lib:/app/ten_packages/system/ten_runtime/lib:/app/ten_packages/system/ten_runtime_python/lib:$LD_LIBRARY_PATH \
    TEN_PYTHON_LIB_PATH=/usr/local/lib/libpython3.10.so.1.0 \
    # 禁用代理
    http_proxy= \
    https_proxy= \
    HTTP_PROXY= \
    HTTPS_PROXY= \
    no_proxy="*"

EXPOSE 8766

CMD ["/bin/bash", "-c", ". /app/venv/bin/activate && /app/scripts/start.sh"]
