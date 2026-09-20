FROM rust:1.97-bookworm AS rust-builder
WORKDIR /src
COPY Cargo.toml Cargo.lock build.rs ./
COPY src ./src
RUN cargo build --release --locked

FROM node:22-bookworm-slim AS web-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN npm install --global corepack@latest \
    && corepack enable \
    && corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm run build:web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV TROID_BINARY=/usr/local/bin/troid
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN npm install --global corepack@latest \
    && corepack enable \
    && corepack pnpm install --prod --frozen-lockfile \
    && corepack pnpm store prune
COPY --from=web-builder /app/dist ./dist
COPY --from=web-builder /app/gallery ./gallery
COPY --from=rust-builder /src/target/release/troid /usr/local/bin/troid
CMD ["node", "dist/index.js"]
