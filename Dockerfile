# syntax=docker/dockerfile:1.7
FROM node:22-bookworm-slim AS build
WORKDIR /opt/senten
COPY . .
RUN npm install --ignore-scripts \
 && npm run build \
 && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
LABEL org.opencontainers.image.title="Senten" \
      org.opencontainers.image.description="Architecture for Living Software" \
      org.opencontainers.image.source="https://github.com/thomasdscx/senten" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production
WORKDIR /workspace
COPY --from=build /opt/senten/package.json /opt/senten/package.json
COPY --from=build /opt/senten/bin /opt/senten/bin
COPY --from=build /opt/senten/dist /opt/senten/dist
COPY --from=build /opt/senten/node_modules /opt/senten/node_modules
COPY --from=build /opt/senten/LICENSE /opt/senten/LICENSE
RUN chown -R node:node /workspace /opt/senten
USER node
ENTRYPOINT ["node", "/opt/senten/bin/senten.mjs"]
CMD ["--help"]
