#!/bin/bash
set -e

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$BASE_DIR"

# 加载.env文件 - 使用更可靠的方式
if [ -f .env ]; then
    while IFS='=' read -r key value; do
        # 跳过注释和空行
        [[ $key =~ ^#.*$ ]] && continue
        [[ -z $key ]] && continue
        # 去除值中的空格和引号
        value=$(echo "$value" | xargs)
        export "$key=$value"
    done < .env
fi

VENV_PATH="$BASE_DIR/venv"
if [ ! -d "$VENV_PATH" ]; then
    python3 -m venv "$VENV_PATH"
fi
source "$VENV_PATH/bin/activate"

# 设置Python库路径（容器内为 /usr/local/lib）
export TEN_PYTHON_LIB_PATH=${TEN_PYTHON_LIB_PATH:-/usr/local/lib/libpython3.10.so.1.0}

# 设置环境变量
export PYTHONPATH="$BASE_DIR:$BASE_DIR/ten_packages:$BASE_DIR/ten_packages/extension:$BASE_DIR/ten_packages/system/ten_runtime_python/interface:$BASE_DIR/ten_packages/system/ten_ai_base/interface:$PYTHONPATH"
export LD_LIBRARY_PATH="$BASE_DIR/ten_packages/system/ten_runtime_go/lib:$BASE_DIR/ten_packages/system/ten_runtime/lib:$BASE_DIR/ten_packages/system/ten_runtime_python/lib:$LD_LIBRARY_PATH"
export LD_PRELOAD=/usr/local/lib/libpython3.10.so:$BASE_DIR/ten_packages/system/ten_runtime_python/lib/libten_runtime_python.so

# Force runtime to look in ten_packages
export TEN_PACKAGE_PATH="$BASE_DIR/ten_packages"

# 执行Go Runtime主程序
exec "$BASE_DIR/bin/main" -property "$BASE_DIR/property.json" "$@"
