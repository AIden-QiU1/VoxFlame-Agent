#!/bin/bash
set -e

cd "$(dirname "${BASH_SOURCE[0]}")/.."

# 加载.env文件
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 激活venv环境
source /root/VoxFlame-Agent/venv/bin/activate

# 设置Python库路径
export TEN_PYTHON_LIB_PATH=/usr/lib/x86_64-linux-gnu/libpython3.10.so.1.0

# 设置环境变量
export PYTHONPATH=$(pwd)/ten_packages/system/ten_ai_base/interface:$PYTHONPATH
export LD_LIBRARY_PATH=$(pwd)/ten_packages/system/ten_runtime_go/lib:$(pwd)/ten_packages/system/ten_runtime/lib:$LD_LIBRARY_PATH

# 执行Go Runtime主程序
exec bin/main "$@"
