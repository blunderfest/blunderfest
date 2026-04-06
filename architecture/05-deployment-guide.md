# Deployment Guide

## Overview

This guide covers deploying Blunderfest in various environments, from single-node development setups to multi-node production clusters.

## Deployment Architectures

### 1. Development (Single Machine)

```
+------------------+
|   Development    |
|      Machine     |
|  +------------+  |
|  |  Blunder-  |  |
|  |    fest    |  |
|  |  (Single   |  |
|  |   Node)    |  |
|  +-----+------+  |
|        |         |
|  +-----v------+  |
|  |  SQLite/   |  |
|  |  File DB   |  |
|  +------------+  |
+------------------+
```

**Use Case**: Local development, testing, small personal databases

**Requirements**:
- 4 GB RAM minimum
- 2 CPU cores
- 50 GB disk space

### 2. Production (Single Node)

```
+------------------+
|   Production     |
|      Node        |
|  +------------+  |
|  |  Nginx     |  |
|  |  (SSL/     |  |
|  |  LB)       |  |
|  +-----+------+  |
|        |         |
|  +-----v------+  |
|  |  Blunder-  |  |
|  |    fest    |  |
|  |  (Single   |  |
|  |   Node)    |  |
|  +-----+------+  |
|        |         |
|  +-----v------+  |
|  |   Binary   |  |
|  |   Files    |  |
|  |  (NVMe)    |  |
|  +------------+  |
+------------------+
```

**Use Case**: Small to medium production deployments, single organization

**Requirements**:
- 32 GB RAM
- 8 CPU cores
- 1 TB NVMe SSD
- 1 Gbps network

### 3. Production (Cluster)

```
+------------------+
|   Load Balancer  |
|   (nginx/HAProxy)|
+--------+---------+
         |
    +----+----+
    |         |
+---v---+ +---v---+ +---v---+
| Node 1| | Node 2| | Node 3|
| (API) | | (API) | |(Anal.)|
+---+---+ +---+---+ +---+---+
    |         |         |
    +----+----+---------+
         |
    +----v----+
    | Shared  |
    | Storage |
    | (S3/    |
    | MinIO)  |
    +---------+
```

**Use Case**: Large-scale production, multi-tenant, high availability

**Requirements per node**:
- 32-64 GB RAM
- 8-16 CPU cores
- 500 GB NVMe SSD (cache)
- 10 Gbps network

## Docker Deployment

### Dockerfile

```dockerfile
# Build stage
FROM hexpm/elixir:1.17.3-erlang-27.1.2-debian-bullseye AS builder

RUN apt-get update && apt-get install -y \
    build-essential \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force && \
    mix local.rebar --force

COPY mix.exs mix.lock ./
RUN mix deps.get --only prod
COPY config config
COPY rel rel
COPY lib lib
COPY priv priv

RUN MIX_ENV=prod mix compile
RUN MIX_ENV=prod mix release

# Runtime stage
FROM debian:bullseye-slim

RUN apt-get update && apt-get install -y \
    ca-certificates \
    libncurses5 \
    libstdc++6 \
    openssl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY --from=builder /app/_build/prod/rel/blunderfest ./

ENV MIX_ENV=prod

EXPOSE 8080

CMD ["/app/bin/server", "foreground"]
```

### Docker Compose (Development)

```yaml
version: '3.8'

services:
  blunderfest:
    build: .
    ports:
      - "8080:8080"
    volumes:
      - ./data:/app/data
      - ./databases:/app/databases
    environment:
      - MIX_ENV=dev
      - DATABASE_PATH=/app/databases
      - CACHE_SIZE=1000000000  # 1 GB for dev

  # Optional: Redis for caching
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data

volumes:
  redis_data:
```

### Docker Compose (Production)

```yaml
version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./ssl:/etc/nginx/ssl
    depends_on:
      - api1
      - api2

  api1:
    image: blunderfest:latest
    ports:
      - "8081:8080"
    volumes:
      - ./data:/app/data
      - ./databases:/app/databases
    environment:
      - MIX_ENV=prod
      - DATABASE_PATH=/app/databases
      - CACHE_SIZE=8000000000  # 8 GB
      - NODE_NAME=api1@blunderfest
      - COOKIE_SECRET=your-secret-cookie
    deploy:
      resources:
        limits:
          memory: 32G
        reservations:
          memory: 16G

  api2:
    image: blunderfest:latest
    ports:
      - "8082:8080"
    volumes:
      - ./data:/app/data
      - ./databases:/app/databases
    environment:
      - MIX_ENV=prod
      - DATABASE_PATH=/app/databases
      - CACHE_SIZE=8000000000
      - NODE_NAME=api2@blunderfest
      - COOKIE_SECRET=your-secret-cookie
    deploy:
      resources:
        limits:
          memory: 32G
        reservations:
          memory: 16G

  analysis:
    image: blunderfest:latest
    command: /app/bin/server run Blunderfest.Analysis.Worker
    environment:
      - MIX_ENV=prod
      - NODE_NAME=analysis@blunderfest
      - COOKIE_SECRET=your-secret-cookie
      - ROLE=analysis
    deploy:
      replicas: 3
      resources:
        limits:
          memory: 16G

volumes:
  data:
  databases:
```

### Nginx Configuration

```nginx
upstream blunderfest_api {
    least_conn;
    server api1:8080 max_fails=3 fail_timeout=30s;
    server api2:8080 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    server_name api.blunderfest.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.blunderfest.com;

    ssl_certificate /etc/nginx/ssl/certificate.crt;
    ssl_certificate_key /etc/nginx/ssl/certificate.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 100M;

    location / {
        proxy_pass http://blunderfest_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts for long-running analysis
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    location /health {
        access_log off;
        return 200 "OK";
        add_header Content-Type text/plain;
    }
}
```

## Fly.io Deployment

### fly.toml Configuration

```toml
app = "blunderfest"
primary_region = "ams"

[build]
  dockerfile = "Dockerfile"

[env]
  PHX_HOST = "blunderfest.fly.dev"
  PORT = "8080"
  MIX_ENV = "prod"
  DATABASE_PATH = "/data/databases"
  CACHE_SIZE = "8000000000"

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = false
  auto_start_machines = true
  min_machines_running = 2
  processes = ["app"]

  [http_service.concurrency]
    type = "connections"
    hard_limit = 1000
    soft_limit = 500

[[vm]]
  cpu_kind = "performance"
  cpus = 4
  memory_mb = 16384

[[mounts]]
  source = "blunderfest_data"
  destination = "/data"
  initial_size = "100gb"

[deploy]
  strategy = "bluegreen"
  max_unavailable = 1
```

### Deployment Commands

```bash
# Initialize Fly.io app
fly apps create blunderfest

# Create persistent volume
fly volumes create blunderfest_data --region ams --size 100

# Deploy
fly deploy

# Scale
fly scale count 3
fly scale memory 16384

# View logs
fly logs

# Open console
fly ssh console
```

## Kubernetes Deployment

### Namespace and ConfigMap

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: blunderfest

---
apiVersion: v1
kind: ConfigMap
metadata:
  name: blunderfest-config
  namespace: blunderfest
data:
  MIX_ENV: "prod"
  DATABASE_PATH: "/data/databases"
  CACHE_SIZE: "8000000000"
  RELEASE_DISTRIBUTION: "name"
```

### StatefulSet for Database Nodes

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: blunderfest-db
  namespace: blunderfest
spec:
  serviceName: blunderfest-db
  replicas: 3
  selector:
    matchLabels:
      app: blunderfest
      role: database
  template:
    metadata:
      labels:
        app: blunderfest
        role: database
    spec:
      containers:
      - name: blunderfest
        image: blunderfest:latest
        ports:
        - containerPort: 8080
          name: http
        - containerPort: 4369
          name: epmd
        - containerPort: 9000
          name: dist
        env:
        - name: POD_NAME
          valueFrom:
            fieldRef:
              fieldPath: metadata.name
        - name: NODE_NAME
          value: "$(POD_NAME).blunderfest-db.blunderfest.svc.cluster.local"
        envFrom:
        - configMapRef:
            name: blunderfest-config
        volumeMounts:
        - name: data
          mountPath: /data
        resources:
          requests:
            memory: "16Gi"
            cpu: "4"
          limits:
            memory: "32Gi"
            cpu: "8"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "fast-ssd"
      resources:
        requests:
          storage: 500Gi
```

### Deployment for API Nodes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: blunderfest-api
  namespace: blunderfest
spec:
  replicas: 3
  selector:
    matchLabels:
      app: blunderfest
      role: api
  template:
    metadata:
      labels:
        app: blunderfest
        role: api
    spec:
      containers:
      - name: blunderfest
        image: blunderfest:latest
        ports:
        - containerPort: 8080
          name: http
        envFrom:
        - configMapRef:
            name: blunderfest-config
        env:
        - name: ROLE
          value: "api"
        resources:
          requests:
            memory: "8Gi"
            cpu: "2"
          limits:
            memory: "16Gi"
            cpu: "4"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
---
apiVersion: v1
kind: Service
metadata:
  name: blunderfest-api
  namespace: blunderfest
spec:
  selector:
    app: blunderfest
    role: api
  ports:
  - port: 80
    targetPort: 8080
  type: ClusterIP
```

## Environment Configuration

### Development

```elixir
# config/dev.exs
config :blunderfest,
  database_path: "data/databases",
  cache_size: 1_000_000_000,  # 1 GB
  max_workers: 20,
  log_level: :debug,
  enable_telemetry: true

config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: 8080],
  debug_errors: true,
  check_origin: false,
  watchers: [],
  live_view: [signing_salt: "development-salt"]
```

### Production

```elixir
# config/prod.exs
config :blunderfest,
  database_path: System.get_env("DATABASE_PATH", "/data/databases"),
  cache_size: System.get_env("CACHE_SIZE", "8000000000") |> String.to_integer(),
  max_workers: System.get_env("MAX_WORKERS", "200") |> String.to_integer(),
  log_level: :info,
  enable_telemetry: true

config :blunderfest, BlunderfestWeb.Endpoint,
  http: [ip: {0, 0, 0, 0}, port: System.get_env("PORT", "8080")],
  url: [scheme: "https", host: System.get_env("PHX_HOST", "localhost")],
  force_ssl: [rewrite_on: [:x_forwarded_proto]],
  cache_static_manifest: "priv/static/cache_manifest.json",
  server: true,
  root: ".",
  version: Application.spec(:blunderfest, :vsn)
```

### Runtime Configuration

```elixir
# config/runtime.exs
import Config

if System.get_env("RELEASE_NAME") do
  dist = System.get_env("RELEASE_DISTRIBUTION", "name")
  node = System.get_env("RELEASE_NODE", "blunderfest")
  
  config :elixir, :distributed,
    applications: [
      :kernel,
      :stdlib,
      :blunderfest,
      :blunderfest_web
    ],
    distance: 1,
    partitions: 1,
    sync_nodes_mandatory: [:"#{node}@127.0.0.1"],
    sync_nodes_optional: [],
    sync_nodes_timeout: 5000
end
```

## Monitoring and Observability

### Health Checks

```elixir
defmodule Blunderfest.Health do
  def check do
    %{
      status: "ok",
      version: Application.spec(:blunderfest, :vsn) |> to_string(),
      uptime: :erlang.system_info(:uptime),
      memory: format_memory(:erlang.memory()),
      database: check_database(),
      cache: check_cache()
    }
  end
  
  defp check_database do
    case Blunderfest.Database.info() do
      {:ok, info} -> %{status: "ok", game_count: info.game_count}
      {:error, reason} -> %{status: "error", reason: reason}
    end
  end
  
  defp check_cache do
    %{
      hit_rate: Blunderfest.Cache.hit_rate(),
      size: Blunderfest.Cache.size(),
      max_size: Blunderfest.Cache.max_size()
    }
  end
  
  defp format_memory([rss, epoch, system, code, atom]) do
    %{
      resident_set_size: rss,
      total_heap_size: epoch,
      system_memory: system,
      code_memory: code,
      atom_memory: atom
    }
  end
end
```

### Prometheus Metrics

```elixir
defmodule Blunderfest.Telemetry do
  def setup_metrics do
    :telemetry.attach(
      "blunderfest-query-handler",
      [:blunderfest, :query, :stop],
      &__MODULE__.handle_query/4,
      nil
    )
  end
  
  def handle_query(_event, measurements, metadata, _config) do
    duration = measurements.duration / 1_000_000_000 # Convert to seconds
    
    Prometheus.Model.counter_inc(
      :blunderfest_queries_total,
      [type: metadata.type, status: "ok"]
    )
    
    Prometheus.Model.histogram_observe(
      :blunderfest_query_duration_seconds,
      [type: metadata.type],
      duration
    )
  end
end
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Blunderfest",
    "panels": [
      {
        "title": "Query Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(blunderfest_queries_total[5m])",
            "legendFormat": "{{type}}"
          }
        ]
      },
      {
        "title": "Query Latency",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(blunderfest_query_duration_seconds_bucket[5m]))",
            "legendFormat": "p95"
          }
        ]
      },
      {
        "title": "Cache Hit Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "blunderfest_cache_hit_rate"
          }
        ]
      }
    ]
  }
}
```

## Backup and Recovery

### Backup Strategy

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups/blunderfest"
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Backup database files
tar -czf "$BACKUP_DIR/database_$DATE.tar.gz" \
    /data/databases/*.bchess \
    /data/databases/*.idx

# Backup configuration
tar -czf "$BACKUP_DIR/config_$DATE.tar.gz" \
    /app/config/*.exs

# Upload to S3
aws s3 cp "$BACKUP_DIR/database_$DATE.tar.gz" \
    s3://blunderfest-backups/databases/
aws s3 cp "$BACKUP_DIR/config_$DATE.tar.gz" \
    s3://blunderfest-backups/config/

# Clean up old backups (keep 7 days)
find "$BACKUP_DIR" -name "*.tar.gz" -mtime +7 -delete
```

### Recovery Procedure

```bash
#!/bin/bash
# restore.sh

BACKUP_FILE=$1

# Download from S3 if needed
if [[ $BACKUP_FILE == s3://* ]]; then
    aws s3 cp "$BACKUP_FILE" /tmp/backup.tar.gz
    BACKUP_FILE="/tmp/backup.tar.gz"
fi

# Extract backup
tar -xzf "$BACKUP_FILE" -C /data/databases

# Verify database integrity
/app/bin/server eval "Blunderfest.Database.verify('/data/databases/*.bchess')"

# Restart service
systemctl restart blunderfest
```

## Security Considerations

### Firewall Rules

```bash
# Allow HTTP/HTTPS
iptables -A INPUT -p tcp --dport 80 -j ACCEPT
iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# Allow SSH (restrict to specific IPs)
iptables -A INPUT -p tcp --dport 22 -s 10.0.0.0/8 -j ACCEPT

# Allow Erlang distribution (internal only)
iptables -A INPUT -p tcp --dport 4369 -s 10.0.0.0/8 -j ACCEPT
iptables -A INPUT -p tcp --dport 9000-9999 -s 10.0.0.0/8 -j ACCEPT

# Drop all other incoming
iptables -A INPUT -j DROP
```

### SSL/TLS Configuration

```nginx
# /etc/nginx/ssl/ssl-params.conf
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
ssl_session_cache shared:SSL:10m;
ssl_session_timeout 10m;
ssl_session_tickets off;

# HSTS
add_header Strict-Transport-Security "max-age=31536000" always;
```

### API Security

```elixir
# Rate limiting
defmodule BlunderfestWeb.RateLimiter do
  use GenServer
  
  @limits %{
    free: %{requests_per_minute: 60, requests_per_day: 1000},
    basic: %{requests_per_minute: 300, requests_per_day: 10000},
    pro: %{requests_per_minute: 1000, requests_per_day: 100000}
  }
  
  def check_limit(api_key) do
    tier = get_tier(api_key)
    limits = @limits[tier]
    
    case get_usage(api_key) do
      %{minute: minute_count, day: day_count} ->
        cond do
          minute_count >= limits.requests_per_minute -> {:error, :rate_limited}
          day_count >= limits.requests_per_day -> {:error, :daily_limit}
          true -> :ok
        end
    end
  end
end
```

## Troubleshooting

### Common Issues

**High Memory Usage**:
```bash
# Check memory breakdown
/app/bin/server eval "IO.inspect(:erlang.memory(), label: \"Memory\")"

# Check ETS tables
/app/bin/server eval "IO.inspect(:ets.info(), label: \"ETS\")"
```

**Slow Queries**:
```bash
# Enable query logging
export BLUNDERFEST_LOG_QUERIES=true

# Check cache hit rate
/app/bin/server eval "IO.puts(\"Cache hit rate: #{Blunderfest.Cache.hit_rate()}\")"
```

**Database Corruption**:
```bash
# Verify database
/app/bin/server eval "Blunderfest.Database.verify(\"/data/databases/main.bchess\")"

# Rebuild index
/app/bin/server eval "Blunderfest.Database.rebuild_index(\"/data/databases/main.bchess\")"
```

### Log Locations

```
/var/log/blunderfest/          # Application logs
/var/log/nginx/                # Nginx logs
/data/databases/*.log          # Database operation logs
```

### Debug Mode

```bash
# Start with debug logging
export MIX_ENV=prod
export BLUNDERFEST_LOG_LEVEL=debug
/app/bin/server foreground