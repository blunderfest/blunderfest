# Stress Testing and Chaos Engineering Strategy

## Overview

This document outlines the comprehensive strategy for stress testing and chaos engineering for Blunderfest, ensuring the system meets its performance and reliability targets under adverse conditions.

## Testing Philosophy

```
┌─────────────────────────────────────────────────────────────────┐
│                    Testing Pyramid                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         ▲                                        │
│                        /█\                                       │
│                       / █ \          Chaos Engineering           │
│                      /  █  \         (Production simulation)     │
│                     /───────\                                    │
│                    /    █    \      Stress Testing               │
│                   /     █     \     (Peak load simulation)      │
│                  /─────────────\                                 │
│                 /      █        \    Load Testing                │
│                /       █         \   (Sustained load)           │
│               /──────────────────\                               │
│              /        █            \  Integration Testing         │
│             /         █             \ (Component interaction)     │
│            /─────────────────────────\                            │
│           /          █               \ Unit Testing              │
│          /           █                \(Isolated functions)      │
│         ▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼▼                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Unit Testing (Foundation)

### Scope
- Individual functions and modules in isolation
- Pure functions with predictable inputs/outputs
- Chess rules engine validation

### Tools
- **Elixir**: ExUnit with property-based testing (StreamData)
- **TypeScript**: Jest with mocking

### Example: Chess Move Generation

```elixir
defmodule Blunderfest.Chess.MoveGeneratorTest do
  use ExUnit.Case, async: true
  
  property "all legal moves are generated" do
    forall board <- board_generator() do
      moves = MoveGenerator.generate_moves(board)
      
      # Every generated move must be legal
      Enum.all?(moves, fn move ->
        new_board = Board.apply_move(board, move)
        not KingInCheck.is_check?(new_board, board.side_to_move)
      end)
    end
  end
  
  property "no illegal moves are generated" do
    forall board <- board_generator() do
      legal_moves = MoveGenerator.generate_moves(board)
      illegal_moves = find_illegal_moves(board)
      
      Enum.empty?(illegal_moves)
    end
  end
end
```

## 2. Integration Testing

### Scope
- Component interactions
- Database operations
- API endpoints
- Cache coherency

### Tools
- **Elixir**: ExUnit with test containers
- **TypeScript**: Supertest for API testing

### Example: Game Lifecycle Integration

```elixir
defmodule Blunderfest.Integration.GameLifecycleTest do
  use ExUnit.Case, async: false
  
  setup do
    # Start isolated database for this test
    {:ok, db} = Blunderfest.Database.create(temp_path())
    
    on_exit(fn ->
      Blunderfest.Database.close(db)
      File.rm(temp_path())
    end)
    
    %{db: db}
  end
  
  test "full game lifecycle", %{db: db} do
    # Import
    {:ok, game_id} = Blunderfest.Game.add(db, valid_pgn())
    
    # Retrieve
    {:ok, game} = Blunderfest.Game.get(db, game_id)
    assert game.id == game_id
    
    # Position lookup
    {:ok, stats} = Blunderfest.Position.stats(db, starting_position_fen())
    assert stats.game_count >= 1
    
    # Search
    {:ok, games} = Blunderfest.Search.games(db, white: "Carlsen")
    assert length(games) >= 1
    
    # Delete
    :ok = Blunderfest.Game.delete(db, game_id)
    assert {:error, :not_found} = Blunderfest.Game.get(db, game_id)
  end
end
```

## 3. Load Testing

### Scope
- Sustained traffic at expected levels
- Gradual ramp-up testing
- Resource consumption validation

### Tools
- **k6** (Grafana) - Primary load testing tool
- **wrk** - Quick HTTP benchmarks
- **locust** - Python-based distributed testing

### k6 Configuration

```javascript
// k6/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const positionLookupDuration = new Trend('position_lookup_duration');
const gameSearchDuration = new Trend('game_search_duration');

export const options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 100 },   // Stay at 100 users
    { duration: '2m', target: 500 },   // Ramp up to 500 users
    { duration: '5m', target: 500 },   // Stay at 500 users
    { duration: '2m', target: 1000 },  // Ramp up to 1000 users
    { duration: '5m', target: 1000 },  // Stay at 1000 users
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    'errors': ['rate<0.01'],           // Less than 1% errors
    'position_lookup_duration': ['p95<100'],  // p95 < 100ms
    'game_search_duration': ['p95<500'],     // p95 < 500ms
    'http_req_duration': ['p95<1000'],      // p95 < 1s
  },
};

const BASE_URL = __ENV.API_URL || 'https://api.blunderfest.com/v1';

export default function() {
  // Test scenarios with weighted distribution
  const scenarios = [
    { weight: 60, fn: testPositionLookup },
    { weight: 25, fn: testGameSearch },
    { weight: 10, fn: testGameRetrieval },
    { weight: 5,  fn: testOpeningStats },
  ];
  
  const scenario = weightedChoice(scenarios);
  scenario.fn();
  
  sleep(1);
}

function testPositionLookup() {
  const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3:0:0';
  
  const start = Date.now();
  const res = http.get(`${BASE_URL}/positions/${encodeURIComponent(fen)}`);
  positionLookupDuration.add(Date.now() - start);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has game count': (r) => JSON.parse(r.body).game_count !== undefined,
  }) || errorRate.add(1);
}

function testGameSearch() {
  const start = Date.now();
  const res = http.get(`${BASE_URL}/games?white=Carlsen&limit=20`);
  gameSearchDuration.add(Date.now() - start);
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has games array': (r) => Array.isArray(JSON.parse(r.body).data),
  }) || errorRate.add(1);
}

function weightedChoice(choices) {
  const totalWeight = choices.reduce((sum, c) => sum + c.weight, 0);
  let random = Math.random() * totalWeight;
  
  for (const choice of choices) {
    random -= choice.weight;
    if (random <= 0) return choice;
  }
  return choices[choices.length - 1];
}
```

### Load Test Targets

| Metric | Target | Critical Threshold |
|--------|--------|-------------------|
| Requests/sec | 10,000 | 8,000 |
| Error rate | < 0.1% | 1% |
| Position lookup p95 | < 50ms | < 200ms |
| Game search p95 | < 200ms | < 1000ms |
| Memory usage | < 80% | > 95% |
| CPU usage | < 70% | > 90% |

## 4. Stress Testing

### Scope
- Peak load beyond normal capacity
- Resource exhaustion scenarios
- Timeout and backpressure behavior

### Stress Test Scenarios

```elixir
defmodule Blunderfest.StressTest do
  use ExUnit.Case
  
  @moduletag :stress
  
  describe "peak load stress test" do
    @tag :stress
    test "handles 10x normal load" do
      # Spawn 10x the normal concurrent requests
      tasks = for _ <- 1..1000 do
        Task.async(fn ->
          Blunderfest.Position.stats(db, random_fen())
        end)
      end
      
      # All should complete within timeout
      results = Task.yield_many(tasks, 30_000)
      
      # Verify completion
      Enum.each(results, fn
        {:ok, {:ok, _stats}} -> :ok
        {:ok, {:exit, reason}} -> flunk("Task exited: #{inspect(reason)}")
        {:exit, reason} -> flunk("Task crashed: #{inspect(reason)}")
      end)
    end
    
    test "memory exhaustion handling" do
      # Simulate memory pressure
      Process.flag(:memory_max, 1_000_000_000)  # 1GB limit
      
      # Large import should be handled gracefully
      assert {:error, :memory_exceeded} = 
        Blunderfest.Game.import_pgn(db, huge_pgn_file())
    end
  end
  
  describe "connection exhaustion" do
    test "handles connection pool exhaustion" do
      # Exhaust connection pool
      connections = for _ <- 1..100 do
        spawn(fn -> 
          {:ok, conn} = Postgrex.connect(connection_opts())
          conn  # Keep connection open
        end)
      end
      
      # Next request should queue or timeout gracefully
      result = Task.async(fn ->
        Blunderfest.Database.query(db, "SELECT 1", [], timeout: 1000)
      end)
      
      # Should not crash, should timeout or queue
      assert match?({:ok, _} | {:error, :timeout}, Task.await(result, 5000))
      
      # Clean up
      Enum.each(connections, &Process.exit(&1, :kill))
    end
  end
end
```

## 5. Chaos Engineering

### Principles

1. **Assume failures will happen** - Design for recovery
2. **Inject controlled failures** - Know your blast radius
3. **Measure resilience** - Validate SLOs under failure
4. **Automate experiments** - Run continuously in CI/CD

### Chaos Toolkit Configuration

```yaml
# chaos/experiments.yaml
apiVersion: chaosblade.io/v1alpha1
kind: ChaosExperiment
metadata:
  name: node-failure
  namespace: blunderfest
spec:
  scope:
    - node
  target:
    name: node
    provider:
      name: pod-kill
      # Kill API node
      mode: one
      params:
        namespace: blunderfest
        label: app=blunderfest,role=api
  chaos:
    type: experiment
    runner:
      ttl: 60
    resource:
      cpu: 1
      memory: 256Mi
  probe:
    - name: check-sla
      type: cmd
      cmd: curl -f http://api.blunderfest.com/health
      threshold: 1
```

### Experiment Catalog

| Experiment | Description | Expected Behavior | SLO |
|------------|-------------|------------------|-----|
| `node-failure` | Kill one API node | Traffic routes to other nodes | < 0.1% errors |
| `network-partition` | Isolate node for 30s | Requests timeout, retry | < 1% errors |
| `disk-saturation` | Fill disk to 95% | Write fails, reads continue | < 0.5% errors |
| `memory-pressure` | Allocate 90% RAM | Cache eviction, graceful degradation | No crashes |
| `database-connection-loss` | Kill PostgreSQL connection | WAL replay on reconnect | < 5s unavailability |
| `s3-unavailable` | Block S3 access | Cold reads fail, hot reads continue | Hot path unaffected |
| `engine-overload` | 100 concurrent analyses | Queue builds, requests queued | < 10s wait |

### Implementation with Litmus

```bash
# Install Litmus
helm install litmus litmuschaos/litmus-portal -n litmus

# Run chaos experiment
kubectl apply -f chaos/node-failure.yaml

# Monitor results
litmusctl get chaosexperiments
```

### Automated Chaos in CI/CD

```yaml
# .github/workflows/chaos.yml
name: Chaos Engineering

on:
  schedule:
    - cron: '0 2 * * *'  # Run nightly
  workflow_dispatch:

jobs:
  chaos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup k6
        uses: loadimpact/k6-action@v0.2
        
      - name: Setup Kubernetes
        uses: azure/setup-kubectl@v3
        
      - name: Install Litmus
        run: |
          helm repo add litmuschaos https://litmuschaos.github.io/litmus-helm
          helm install litmus litmuschaos/litmus-portal -n litmus --create-namespace
      
      - name: Baseline metrics
        run: k6 run baseline-load-test.js
      
      - name: Inject chaos - API node failure
        run: |
          kubectl apply -f chaos/api-node-failure.yaml
          kubectl wait --for=condition=complete chaosexperiment/api-node-failure -n blunderfest --timeout=120s
      
      - name: Measure during chaos
        run: k6 run load-test-during-chaos.js
      
      - name: Verify SLO
        run: |
          ./scripts/check-slo.sh
          ./scripts/check-metrics.sh
      
      - name: Report
        if: always()
        run: ./scripts/report-chaos-results.sh
```

## 6. Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO)

### Targets

| Scenario | RTO | RPO | Strategy |
|----------|-----|-----|----------|
| Single node failure | < 30s | 0 (replicated) | Automatic failover |
| Database corruption | < 5min | < 1 hour | WAL replay |
| Full cluster failure | < 30min | < 1 day | Daily backups |
| Data center outage | < 2hr | < 1 hour | Multi-region |
| S3 unavailable | 0 (hot path) | N/A | Local SSD cache |

### Recovery Testing

```elixir
defmodule Blunderfest.RecoveryTest do
  use ExUnit.Case
  
  describe "single node failure recovery" do
    @tag :chaos
    test "automatically recovers within RTO" do
      # Record start time
      start_time = System.monotonic_time(:millisecond)
      
      # Inject failure: terminate node
      :ok = KubernetesClient.delete_pod("blunderfest-api-0")
      
      # Monitor until healthy
      :ok = wait_until(fn ->
        HealthChecker.all_nodes_healthy?()
      end, max_wait: 30_000)
      
      # Verify RTO
      elapsed = System.monotonic_time(:millisecond) - start_time
      assert elapsed < 30_000, "RTO exceeded: #{elapsed}ms"
      
      # Verify no data loss
      assert Database.replication_lag() < 1000, "Replication lag too high"
    end
  end
  
  describe "database recovery" do
    @tag :chaos
    test "recovers from WAL" do
      # Get current WAL position
      wal_position = Database.get_wal_position(db)
      
      # Simulate crash (don't clean up)
      Process.exit(Process.whereis(Blunderfest.Database), :kill)
      
      # Restart
      {:ok, new_db} = Blunderfest.Database.recover(db_path)
      
      # Verify WAL replay
      new_position = Database.get_wal_position(new_db)
      assert new_position >= wal_position
      
      # Verify data integrity
      assert Database.verify_integrity(new_db) == :ok
    end
  end
end
```

## 7. Performance Regression Detection

### Baseline Metrics

```yaml
# benchmarks/baseline.yaml
version: "1.0"
created: "2024-01-15"
environment: production

metrics:
  position_lookup:
    p50: 0.5ms
    p95: 2ms
    p99: 5ms
    
  game_search:
    p50: 50ms
    p95: 150ms
    p99: 300ms
    
  game_retrieval:
    p50: 1ms
    p95: 5ms
    p99: 10ms
    
  import_throughput:
    games_per_second: 1500
    min_games_per_second: 1000

resources:
  memory_usage_mb: 16000
  cpu_percent: 60
  disk_io_mbps: 500
```

### Regression Detection Script

```bash
#!/bin/bash
# scripts/detect-regression.sh

BASELINE_FILE="benchmarks/baseline.yaml"
CURRENT_RESULTS="benchmarks/current.yaml"

# Run current benchmarks
echo "Running benchmarks..."
k6 run k6/load-test.js --out json=$CURRENT_RESULTS > /dev/null 2>&1

# Compare with baseline
echo "Comparing with baseline..."
if diff -q $BASELINE_FILE $CURRENT_RESULTS > /dev/null; then
  echo "✓ No regression detected"
  exit 0
else
  echo "✗ Regression detected!"
  echo ""
  echo "Differences:"
  diff $BASELINE_FILE $CURRENT_RESULTS || true
  exit 1
fi
```

## 8. Test Environment Strategy

### Environment Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│                    Production                                  │
│  - Real data (anonymized)                                    │
│  - Chaos experiments (restricted)                            │
│  - Continuous monitoring                                     │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Staging (1:1 mirror)                     │
│  - Synthetic data, realistic volumes                         │
│  - Full chaos experiments                                   │
│  - Pre-release validation                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Load Test Environment                     │
│  - Auto-scaling to peak load                                │
│  - Isolated network                                         │
│  - Synthetic data                                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    CI/CD Pipeline                            │
│  - Unit and integration tests                               │
│  - Smoke tests                                              │
│  - Quick performance checks                                 │
└─────────────────────────────────────────────────────────────┘
```

### Environment-Specific Configurations

```elixir
# config/test.exs
config :blunderfest, :stress_test,
  enabled: false,
  chaos_enabled: false,
  max_concurrent_requests: 100

# config/staging.exs
config :blunderfest, :stress_test,
  enabled: true,
  chaos_enabled: true,
  max_concurrent_requests: 5000

# config/prod.exs
config :blunderfest, :stress_test,
  enabled: false,  # Only run controlled experiments
  chaos_enabled: false,
  max_concurrent_requests: 10000
```

## 9. Monitoring During Tests

### Key Dashboards

1. **Load Test Dashboard** (Grafana)
   - Request rate
   - Error rate
   - Response times (p50, p95, p99)
   - Active connections

2. **Chaos Dashboard**
   - Experiment status
   - SLO violations
   - Recovery time
   - Affected services

3. **Resource Dashboard**
   - CPU utilization
   - Memory usage
   - Disk I/O
   - Network throughput

### Alert Thresholds

```yaml
alerts:
  - name: high_error_rate
    condition: error_rate > 1%
    severity: critical
    action: abort_test
  
  - name: high_latency
    condition: p95_latency > 1000ms
    severity: warning
    action: log_and_continue
  
  - name: memory_exhaustion
    condition: memory_usage > 95%
    severity: critical
    action: abort_test
    
  - name: replication_lag
    condition: lag_ms > 5000
    severity: warning
    action: investigate
```

## 10. Test Execution Schedule

| Test Type | Frequency | Duration | Environment |
|-----------|-----------|----------|-------------|
| Unit Tests | Every PR | ~5 min | CI |
| Integration Tests | Every PR | ~15 min | CI |
| Smoke Tests | Every commit | ~2 min | CI |
| Load Tests | Nightly | ~30 min | Load Test |
| Stress Tests | Weekly | ~2 hr | Staging |
| Chaos Experiments | Daily | ~1 hr | Staging |
| Full Chaos | Weekly | ~4 hr | Staging |

## 11. Success Criteria

### Load Testing

- [ ] 10,000 concurrent users sustained for 1 hour
- [ ] Error rate < 0.1%
- [ ] p95 latency < 100ms for position lookup
- [ ] No memory leaks after sustained load
- [ ] Cache hit rate > 80%

### Stress Testing

- [ ] System handles 2x peak load without crashing
- [ ] Graceful degradation under resource exhaustion
- [ ] No data corruption under stress
- [ ] Recovery within defined timeouts

### Chaos Engineering

- [ ] Single node failure: RTO < 30s, no data loss
- [ ] Network partition: Self-heals, minimal impact
- [ ] Database connection loss: WAL replay succeeds
- [ ] S3 unavailable: Hot path unaffected

## Implementation Checklist

- [ ] Set up k6 load testing infrastructure
- [ ] Create baseline benchmarks
- [ ] Implement integration test suite
- [ ] Configure Litmus chaos toolkit
- [ ] Define chaos experiments
- [ ] Set up monitoring dashboards
- [ ] Implement regression detection
- [ ] Document runbooks for each experiment
- [ ] Schedule automated test runs
- [ ] Train team on chaos engineering

## References

- [k6 Load Testing](https://k6.io/docs/)
- [Litmus Chaos](https://litmuschaos.io/)
- [Chaos Engineering Principles](https://principlesofchaos.org/)
- [Grafana Load Testing Dashboard](https://grafana.com/docs/grafana-cloud/)
