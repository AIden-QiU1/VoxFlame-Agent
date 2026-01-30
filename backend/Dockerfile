# Backend Dockerfile for VoxFlame
# 使用 DaoCloud Node 镜像 + 国内镜像源加速

FROM docker.m.daocloud.io/library/node:20-alpine

WORKDIR /app

# 配置阿里云 Alpine 源
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories

# 配置 npm 阿里云镜像源
RUN npm config set registry https://registry.npmmirror.com

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# Create logs directory
RUN mkdir -p /app/logs && chmod 777 /app/logs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})" || exit 1

# Start server with log redirection
CMD ["sh", "-c", "npm start 2>&1 | tee -a /app/logs/backend.log"]
