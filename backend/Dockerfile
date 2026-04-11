# ---- Build Stage ----
FROM golang:1.26-alpine AS builder

WORKDIR /app
COPY go.mod ./
RUN go mod download

COPY . .
RUN go build -o server ./cmd/server

# ---- Runtime Stage ----
FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache bash curl

RUN curl -L https://github.com/golang-migrate/migrate/releases/latest/download/migrate.linux-amd64.tar.gz \
    | tar -xz && \
    mv migrate /usr/local/bin/migrate

COPY --from=builder /app/server .
COPY migrations ./migrations
COPY scripts ./scripts
COPY entrypoint.sh .

RUN chmod +x /app/scripts/migrate.sh
RUN chmod +x entrypoint.sh

EXPOSE 8080

CMD ["./server"]