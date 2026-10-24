# Run locally
dev:
    go run ./cmd/server

# Run all tests
test:
    go test ./...

# Production build
build:
    CGO_ENABLED=0 go build -o bin/attrape ./cmd/server
