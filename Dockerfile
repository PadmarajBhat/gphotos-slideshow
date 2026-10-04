# The photo helper for Cloud Run. Dependency-free Node, so there is no
# npm install step and nothing from node_modules in the image.
FROM node:22-slim
WORKDIR /app
COPY server/ ./server/
ENV NODE_ENV=production \
    STORE=firestore
USER node
CMD ["node", "server/index.mjs"]
