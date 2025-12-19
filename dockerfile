FROM oven/bun:latest

WORKDIR /app

COPY . .

RUN bun install

RUN bun build src/index.ts --outdir dist --minify

EXPOSE 3003

CMD ["bun", "run", "dist/index.js"]
