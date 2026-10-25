FROM node:24-alpine
WORKDIR /app
RUN apk add --no-cache font-dejavu
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev
COPY server/server.js server/orders.js server/order-domain.js server/order-workflow.js server/order-notifications.js server/telegram-bot.js server/invitation-links.js server/accounts.js server/collaborators.js server/validate.js server/payments.js server/invitation-access.js server/invitation-store.js server/share-image.js server/rate-limits.js ./
COPY public ./public
COPY assets/covers ./public/covers
ENV NODE_ENV=production
USER node
EXPOSE 3000
CMD ["node", "server.js"]
