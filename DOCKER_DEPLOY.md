# VoxFlame-Agent Docker Deployment Guide

This guide provides step-by-step instructions for deploying the VoxFlame-Agent project using Docker Compose, unifying the frontend, backend, and agent services with official images and best practices.

## 1. Prerequisites
- Docker and Docker Compose installed
- Clone this repository
- (Optional) Update `.env` with your environment variables

## 2. File Structure
```
VoxFlame-Agent/
├── docker-compose.yml
├── .env.example
├── frontend/
│   └── Dockerfile
├── backend/
│   └── Dockerfile
├── ten_agent/
│   ├── property.json
│   └── ten_packages/extension/
└── ...
```

## 3. Environment Variables
Copy `.env.example` to `.env` and fill in the required values for all services.

## 4. Build and Start All Services
```bash
docker compose up --build -d
```

- This will build the frontend and backend images, and start all services (frontend, backend, agent, qdrant, etc.)
- The agent uses the official TEN Agent Docker image, mounting your custom property.json and extension directory.

## 5. Service Overview
- **frontend**: Next.js app, served via Docker
- **backend**: Node.js/Express API
- **agent**: Official TEN Agent image, with custom config/extensions
- **qdrant**: Vector database for memory

## 6. Customization
- To update agent config, edit `ten_agent/property.json` or add extensions to `ten_agent/ten_packages/extension/` and restart the agent container.

## 7. Stopping Services
```bash
docker compose down
```

## 8. Troubleshooting
- Check logs: `docker compose logs <service>`
- Ensure all environment variables are set in `.env`
- For memory issues, verify Qdrant is running and accessible

## 9. References
- [Official TEN Agent Docker Image](https://hub.docker.com/r/tenapi/agent)
- [Qdrant Documentation](https://qdrant.tech/documentation/)

---

For further assistance, see the project README or contact the maintainers.
