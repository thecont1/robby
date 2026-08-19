FROM rust:1.97-bookworm AS rust-builder
WORKDIR /src
COPY Cargo.toml Cargo.lock build.rs ./
COPY src ./src
RUN cargo build --release --locked

FROM node:22-bookworm-slim AS web-builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install --global corepack@latest \
    && corepack enable \
    && corepack pnpm install --frozen-lockfile
COPY . .
RUN corepack pnpm run build:web

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV ROBBY_BINARY=/usr/local/bin/robby
COPY package.json pnpm-lock.yaml ./
RUN npm install --global corepack@latest \
    && corepack enable \
    && corepack pnpm install --prod --frozen-lockfile \
    && corepack pnpm store prune
COPY --from=web-builder /app/dist ./dist
COPY --from=web-builder /app/gallery ./gallery
COPY --from=rust-builder /src/target/release/robby /usr/local/bin/robby
CMD ["node", "dist/index.js"]
