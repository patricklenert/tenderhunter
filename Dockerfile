FROM node:20-bookworm

# Browser rendering runs in the shared Obscura CDP container; the app only
# needs the playwright client library, so browser downloads are skipped.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .

ENV BETTER_AUTH_SECRET="build-placeholder"
ENV NEXT_PUBLIC_SITE_URL="https://palemaz.com"
RUN nice -n 19 npm run build

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DATABASE_URL="postgresql://tenderhunter:tenderhunter@localhost:5432/tenderhunter"
ENV OPENROUTER_API_KEY=""

EXPOSE 3000

COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["app"]
