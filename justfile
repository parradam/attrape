# Run locally: Vite on :5173 proxies /api to the Go server on :8080
dev: deps
    trap 'kill 0' EXIT; (cd web && npm run dev) & go run ./cmd/server

# Run all tests
test: deps
    go test ./...
    cd web && npm test

# Production build: the web app, then the binary with it embedded
build: deps
    cd web && npm run build
    CGO_ENABLED=0 go build -o bin/attrape ./cmd/server

# Check formatting, lint rules and types for Go and the web app
lint: deps
    golangci-lint run
    cd web && npm run lint

# Fix formatting and auto-fixable lint issues
fmt: deps
    golangci-lint fmt
    cd web && npm run fmt

# Install web dependencies when the lockfile has changed
[private]
deps:
    [ web/node_modules/.package-lock.json -nt web/package-lock.json ] || (cd web && npm ci)
