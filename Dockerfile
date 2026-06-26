FROM node:20-bookworm

RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
    libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 \
    libcairo2 libasound2 libatspi2.0-0 libnspr4 && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

RUN npx playwright install chromium

COPY . .

ENV BETTER_AUTH_SECRET="build-placeholder"
RUN npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter"
ENV OPENROUTER_API_KEY=""

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["app"]
