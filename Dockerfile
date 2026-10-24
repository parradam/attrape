# Build the web app.
FROM node:24-alpine AS web
WORKDIR /src/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Build a static Go binary with the web app embedded.
FROM golang:1.27-alpine AS server
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=web /src/web/dist web/dist
RUN CGO_ENABLED=0 go build -trimpath -ldflags="-s -w" -o /attrape ./cmd/server
# Owned by the nonroot user so a fresh named volume is writable.
RUN mkdir /data

FROM gcr.io/distroless/static-debian12:nonroot
COPY --from=server /attrape /attrape
COPY --from=server --chown=nonroot:nonroot /data /data
ENV ADDR=:8080 DB_PATH=/data/attrape.db
VOLUME /data
EXPOSE 8080
ENTRYPOINT ["/attrape"]
