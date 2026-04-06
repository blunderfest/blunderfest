# Data Retention Policy

## Overview

This document outlines the data retention strategy for Blunderfest, covering data lifecycle management, archival policies, GDPR compliance, and cost optimization for long-term storage.

## Data Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                     Data Categories                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │   Hot Data  │    │   Warm Data │    │  Cold Data  │       │
│  │  (0-30 days)│    │(30-365 days)│    │  (1+ years) │       │
│  └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │  Position   │    │  Game Data │    │  Archives   │       │
│  │   Index     │    │  Segments  │    │  & Exports  │       │
│  └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐       │
│  │ Player Index│    │   Events   │    │  Backups    │       │
│  └─────────────┘    └─────────────┘    └─────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1. Retention Tiers

### 1.1 Hot Storage (SSD)

| Data Type | Retention | Access Pattern | Storage |
|-----------|-----------|----------------|---------|
| Position Index | 30 days | Random read | Local SSD |
| Player Index | 90 days | Random read | Local SSD |
| Query Cache | 24 hours | Random read | Memory/SSD |
| Recent Games | 30 days | Random read | Local SSD |
| Analysis Cache | 7 days | Random read | Local SSD |

### 1.2 Warm Storage (S3 Standard)

| Data Type | Retention | Access Pattern | Storage |
|-----------|-----------|----------------|---------|
| Game Segments | 1 year | Sequential read | S3 Standard |
| Position Archive | 1 year | Rare access | S3 IA |
| Opening Statistics | Permanent | Periodic read | S3 Standard |
| Player Statistics | Permanent | Periodic read | S3 Standard |

### 1.3 Cold Storage (S3 Glacier)

| Data Type | Retention | Access Pattern | Storage |
|-----------|-----------|----------------|---------|
| Historical Games (>1yr) | 10 years | Very rare | S3 Glacier |
| Archives | 7 years | Audit only | S3 Glacier Deep Archive |
| Backups | 90 days | Recovery only | S3 Glacier |

## 2. Data Lifecycle Policy

### 2.1 Game Data Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                   Game Data Lifecycle                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Import ──▶ Hot ──▶ Warm ──▶ Cold ──▶ Archive ──▶ Delete      │
│    │         │        │        │         │         │          │
│    ▼         ▼        ▼        ▼         ▼         ▼          │
│  Index    Active   Mature   Rare     Audit    Cleanup         │
│  Position  Games    Games   Access   Only    (GDPR)            │
│                                                                  │
│  Day 0     Day 30   Day 365  Year 2  Year 7   Year 10          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Automated Transitions

```elixir
defmodule Blunderfest.Lifecycle.TierManager do
  @moduledoc """
  Manages data tier transitions based on access patterns.
  """
  
  use GenServer
  
  # Transition thresholds
  @hot_to_warm_accesses 1000  # Moves to warm after 1000 accesses in 30 days
  @warm_to_cold_accesses 10    # Moves to cold after <10 accesses in 90 days
  
  defstruct [:transition_queue, :access_counts]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(_opts) do
    state = %__MODULE__{
      transition_queue: :queue.new(),
      access_counts: :ets.new(:access_counts, [:set])
    }
    
    schedule_tier_check()
    {:ok, state}
  end
  
  @doc """
  Record an access for a game segment.
  """
  @spec record_access(String.t()) :: :ok
  def record_access(segment_id) do
    GenServer.cast(__MODULE__, {:record_access, segment_id})
  end
  
  @impl true
  def handle_cast({:record_access, segment_id}, state) do
    now = DateTime.utc_now()
    key = {segment_id, Date.to_iso8601(now, :date)}
    
    :ets.update_counter(state.access_counts, key, {2, 1}, {key, 0})
    
    {:noreply, state}
  end
  
  @doc """
  Check if a segment should transition tiers.
  """
  @spec check_transition(String.t()) :: {:ok, atom()} | {:error, :no_transition}
  def check_transition(segment_id) do
    GenServer.call(__MODULE__, {:check_transition, segment_id})
  end
  
  @impl true
  def handle_call({:check_transition, segment_id}, _from, state) do
    # Get access counts for last 30 days
    counts = get_access_counts(state.access_counts, segment_id, 30)
    
    result = cond do
      # Hot → Warm: High activity, age > 30 days
      counts > @hot_to_warm_accesses ->
        {:ok, :warm}
        
      # Warm → Cold: Low activity, age > 365 days
      counts < @warm_to_cold_accesses ->
        {:ok, :cold}
        
      true ->
        {:error, :no_transition}
    end
    
    {:reply, result, state}
  end
  
  defp get_access_counts(table, segment_id, days) do
    now = DateTime.utc_now()
    
    Enum.reduce(0..days, 0, fn day_offset, acc ->
      date = Date.add(now, -day_offset)
      key = {segment_id, Date.to_iso8601(date)}
      
      case :ets.lookup(table, key) do
        [{^key, count}] -> acc + count
        [] -> acc
      end
    end)
  end
  
  defp schedule_tier_check do
    # Run tier check daily at 2 AM
    Process.send_after(self(), :tier_check, delay_until(2, 0))
  end
  
  defp delay_until(hour, minute) do
    now = DateTime.utc_now()
    target = %{now | hour: hour, minute: minute, second: 0, microsecond: 0}
    
    if DateTime.compare(target, now) == :lt do
      DateTime.add(target, 86400) |> DateTime.diff(now) |> :timer.seconds() * 1000
    else
      DateTime.diff(target, now) |> :timer.seconds() * 1000
    end
  end
  
  @impl true
  def handle_info(:tier_check, state) do
    # Find segments eligible for transition
    eligible = find_eligible_segments(state.access_counts)
    
    # Queue transitions
    new_queue = Enum.reduce(eligible, state.transition_queue, fn seg, queue ->
      :queue.in({:transition, seg, :warm}, queue)
    end)
    
    # Process queue
    process_transition_queue(state)
    
    schedule_tier_check()
    {:noreply, %{state | transition_queue: new_queue}}
  end
end
```

### 2.3 S3 Lifecycle Configuration

```yaml
# s3-lifecycle.yaml
rules:
  # Hot → Warm transition for recent game segments
  - id: "hot-to-warm-games"
    status: "Enabled"
    filter:
      prefix: "segments/recent/"
    transitions:
      - days: 30
        storageClass: "STANDARD_IA"
    
  # Warm → Cold transition for old games
  - id: "warm-to-cold-games"
    status: "Enabled"
    filter:
      prefix: "segments/archive/"
    transitions:
      - days: 365
        storageClass: "GLACIER"
    
  # Cold → Archive for very old data
  - id: "cold-to-archive"
    status: "Enabled"
    filter:
      prefix: "segments/historical/"
    transitions:
      - days: 730
        storageClass: "GLACIER_DEEP_ARCHIVE"
    
  # Cleanup expired objects
  - id: "cleanup-deleted"
    status: "Enabled"
    filter:
      tag:
        key: "status"
        value: "deleted"
    expiration:
      days: 90
```

## 3. GDPR Compliance

### 3.1 Data Subject Rights

| Right | Implementation | Timeline |
|-------|---------------|----------|
| Right to Access | Export all data for a player | 30 days |
| Right to Rectification | Update player data | 7 days |
| Right to Erasure | Anonymize game data | 30 days |
| Right to Portability | Export in standard format | 30 days |
| Right to Object | Exclude from statistics | 7 days |

### 3.2 Anonymization Strategy

```elixir
defmodule Blunderfest.GDPR.Anonymizer do
  @moduledoc """
  Handles GDPR data subject requests.
  """
  
  @doc """
  Anonymize all data for a player (Right to Erasure).
  
  This replaces personal information with anonymous tokens
  while preserving statistical integrity.
  """
  @spec anonymize_player(String.t()) :: :ok | {:error, term()}
  def anonymize_player(player_id) do
    # Get all games for player
    games = Blunderfest.Player.games(player_id)
    
    # Create anonymous token
    token = generate_anonymous_token()
    
    # Update all games
    Enum.each(games, fn game ->
      anonymize_game(game, player_id, token)
    end)
    
    # Update player index
    Blunderfest.Player.update(player_id, %{
      name: "Anonymous #{token}",
      elo: nil,
      title: nil,
      country: nil,
      birth_year: nil,
      anonymized: true,
      original_id: player_id
    })
    
    # Clear search indices
    Blunderfest.Search.remove_player(player_id)
    
    Logger.info("Anonymized player #{player_id}")
    :ok
  end
  
  defp generate_anonymous_token do
    :crypto.strong_rand_bytes(8)
    |> Base.url_encode64(padding: false)
  end
  
  defp anonymize_game(game, player_id, token) do
    updated_game = %{game |
      white_id: if(game.white_id == player_id, do: token, else: game.white_id),
      black_id: if(game.black_id == player_id, do: token, else: game.black_id),
      tags: anonymize_tags(game.tags, player_id, token)
    }
    
    Blunderfest.Game.update(game.id, updated_game)
  end
  
  defp anonymize_tags(tags, player_id, token) do
    tags
    |> Map.update("White", nil, fn name ->
      if name =~ player_id, do: "Anonymous", else: name
    end)
    |> Map.update("Black", nil, fn name ->
      if name =~ player_id, do: "Anonymous", else: name
    end)
  end
end
```

### 3.3 Consent Management

```elixir
defmodule Blunderfest.GDPR.ConsentManager do
  @moduledoc """
  Manages user consent for data processing.
  """
  
  defstruct [:consents, :version]
  
  @consent_types [
    :data_processing,      # Basic game analysis
    :public_profile,       # Make player public
    :third_party_sharing,  # Share with partners
    :marketing             # Promotional emails
  ]
  
  @spec record_consent(String.t(), atom(), boolean()) :: :ok
  def record_consent(user_id, consent_type, granted) do
    unless consent_type in @consent_types do
      raise ArgumentError, "Invalid consent type: #{consent_type}"
    end
    
    consent_record = %{
      type: consent_type,
      granted: granted,
      timestamp: DateTime.utc_now(),
      ip_address: get_client_ip(),
      user_agent: get_client_user_agent()
    }
    
    # Store consent in PostgreSQL
    Postgrex.query!(
      pool(),
      """
      INSERT INTO user_consents (user_id, consent_type, granted, metadata, version)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (user_id, consent_type) DO UPDATE SET
        granted = EXCLUDED.granted,
        timestamp = EXCLUDED.timestamp,
        metadata = EXCLUDED.metadata,
        version = EXCLUDED.version
      """,
      [user_id, Atom.to_string(consent_type), granted, 
       Jason.encode!(consent_record), @consent_version]
    )
  end
  
  @spec has_consent?(String.t(), atom()) :: boolean()
  def has_consent?(user_id, consent_type) do
    case Postgrex.query!(
      pool(),
      "SELECT granted FROM user_consents WHERE user_id = $1 AND consent_type = $2",
      [user_id, Atom.to_string(consent_type)]
    ) do
      %{rows: [[granted]]} -> granted
      _ -> false
    end
  end
end
```

### 3.4 Data Processing Register

```yaml
# GDPR processing activities
processing_activities:
  - id: "game-import"
    name: "Chess game import and analysis"
    purpose: "Build chess database for research and analysis"
    legal_basis: "Legitimate interest"
    data_categories: ["games", "moves", "positions", "players"]
    retention: "10 years"
    recipients: ["internal", "researchers"]
    
  - id: "player-stats"
    name: "Player statistics calculation"
    purpose: "Provide aggregated player statistics"
    legal_basis: "Legitimate interest"
    data_categories: ["player_names", "elo_ratings", "game_results"]
    retention: "Permanent (anonymized)"
    recipients: ["public"]
    special_categories: false
    
  - id: "engine-analysis"
    name: "Chess engine analysis"
    purpose: "Provide position analysis for users"
    legal_basis: "Contract"
    data_categories: ["positions", "analysis_results"]
    retention: "7 days"
    recipients: ["internal"]
```

## 4. Archival Policy

### 4.1 What to Archive

| Data Type | Archive Format | Compression | Retention |
|-----------|--------------|-------------|-----------|
| Complete segments | .bchess | gzip | 10 years |
| Position index | Binary | zstd | 10 years |
| Player database | JSON | gzip | 10 years |
| Event database | JSON | gzip | 10 years |
| Opening statistics | JSON | gzip | Permanent |
| Statistical aggregates | Parquet | - | Permanent |

### 4.2 Archive Process

```elixir
defmodule Blunderfest.Lifecycle.Archiver do
  @moduledoc """
  Handles archiving of old data.
  """
  
  @spec archive_segment(String.t()) :: :ok | {:error, term()}
  def archive_segment(segment_id) do
    with {:ok, segment} <- Blunderfest.Segment.read(segment_id),
         :ok <- validate_for_archive(segment),
         compressed <- compress_segment(segment),
         metadata <- generate_archive_metadata(segment) do
      
      # Upload to S3 Glacier
      key = "archives/segments/#{segment_id}.bchess.gz"
      :ok = S3.upload(compressed, key, storage_class: :glacier)
      
      # Upload metadata
      metadata_key = "archives/metadata/#{segment_id}.json"
      :ok = S3.upload(Jason.encode!(metadata), metadata_key)
      
      # Delete from hot storage
      Blunderfest.Segment.delete(segment_id)
      
      Logger.info("Archived segment #{segment_id}")
      :ok
    end
  end
  
  defp compress_segment(segment) do
    segment
    |> :erlang.term_to_binary()
    |> :zstd.compress()
  end
  
  defp validate_for_archive(segment) do
    # Verify no pending GDPR deletions
    if segment.has_pending_deletions do
      {:error, :pending_gdpr_deletions}
    else
      :ok
    end
  end
  
  defp generate_archive_metadata(segment) do
    %{
      segment_id: segment.id,
      game_count: segment.game_count,
      position_count: segment.position_count,
      date_range: segment.date_range,
      archived_at: DateTime.utc_now(),
      checksum: :crypto.hash(:sha256, segment)
    }
  end
end
```

## 5. Compaction and Cleanup

### 5.1 Segment Compaction

```elixir
defmodule Blunderfest.Lifecycle.Compactor do
  @moduledoc """
  Compacts segments to remove deleted games and reclaim space.
  """
  
  @spec compact(String.t(), keyword()) :: {:ok, String.t()} | {:error, term()}
  def compact(segment_id, opts \\ []) do
    min_age = Keyword.get(opts, :min_age_days, 7)
    
    with {:ok, segment} <- Blunderfest.Segment.read(segment_id),
         true <- old_enough?(segment, min_age),
         {:ok, compacted} <- perform_compaction(segment) do
      
      # Write compacted segment
      new_id = Blunderfest.Segment.write(compacted)
      
      # Update references
      update_segment_references(segment_id, new_id)
      
      # Delete old segment
      Blunderfest.Segment.delete(segment_id)
      
      Logger.info("Compacted segment #{segment_id} → #{new_id}")
      {:ok, new_id}
    end
  end
  
  defp perform_compaction(segment) do
    # Filter out deleted games
    active_games = segment.games
    |> Enum.reject(& &1.deleted?)
    |> Enum.map(&strip_deleted_positions/1)
    
    %{segment | games: active_games}
  end
  
  defp strip_deleted_positions(game) do
    # Remove position hashes for deleted positions
    valid_positions = game.position_hashes
    |> Enum.reject(&PositionIndex.exists?/1)
    
    %{game | position_hashes: valid_positions}
  end
end
```

### 5.2 Scheduled Cleanup Jobs

```yaml
# config/jobs.exs
config :blunderfest, Blunderfest.Jobs,
  jobs: [
    # Clean up expired cache entries
    {"@hourly", {Blunderfest.Cache.Cleaner, :cleanup_expired, []}},
    
    # Check for tier transitions
    {"0 2 * * *", {Blunderfest.Lifecycle.TierManager, :check_tiers, []}},
    
    # Compact old segments
    {"0 3 * * 0", {Blunderfest.Lifecycle.Compactor, :compact_old, [min_age_days: 30]}},
    
    # Archive cold segments
    {"0 4 1 * *", {Blunderfest.Lifecycle.Archiver, :archive_cold, []}},
    
    # Verify backup integrity
    {"0 5 * * *", {Blunderfest.Backup.Verifier, :verify, []}},
    
    # GDPR cleanup (monthly)
    {"0 6 1 * *", {Blunderfest.GDPR.Processor, :process_deletions, []}}
  ]
```

## 6. Cost Optimization

### 6.1 Storage Cost Model

```
Monthly Storage Costs (us-east-1, 2024)

┌──────────────────────────────────────────────────────────────┐
│  Storage Type    │  $/GB/month  │  Typical Size  │  Monthly │
├──────────────────────────────────────────────────────────────┤
│  Hot (NVMe SSD) │     $0.10    │     100 GB     │   $10    │
│  Warm (S3 Std)  │     $0.023   │    1,000 GB    │   $23    │
│  Cold (Glacier)  │     $0.004   │   10,000 GB    │   $40    │
│  Archive         │    $0.00099  │  100,000 GB    │   $99    │
├──────────────────────────────────────────────────────────────┤
│  Total Storage Costs for 100M Games (estimated)              │
│  ≈ 50 TB hot + 200 TB warm + 500 TB cold + 1 PB archive   │
│  ≈ $8,500/month                                            │
└──────────────────────────────────────────────────────────────┘
```

### 6.2 Tiering Strategy

```elixir
defmodule Blunderfest.Lifecycle.TierOptimizer do
  @moduledoc """
  Optimizes storage tiering for cost efficiency.
  """
  
  @spec recommend_tier(String.t()) :: {:ok, atom()} | {:error, term()}
  def recommend_tier(data_id) do
    with {:ok, info} <- get_data_info(data_id),
         access_cost <- estimate_access_cost(info),
         storage_cost <- estimate_storage_cost(info),
         total_cost <- access_cost + storage_cost do
      
      # Choose tier with lowest total cost
      tiers = [
        {:hot, estimate_hot_cost(info)},
        {:warm, estimate_warm_cost(info)},
        {:cold, estimate_cold_cost(info)},
        {:archive, estimate_archive_cost(info)}
      ]
      
      {tier, _cost} = Enum.min_by(tiers, fn {_, cost} -> cost end)
      
      {:ok, tier, total_cost}
    end
  end
  
  defp estimate_access_cost(info) do
    # Cost per access varies by tier
    accesses_per_month = info.estimated_accesses
    
    hot_cost = accesses_per_month * 0.00001   # $10 per 1M accesses
    warm_cost = accesses_per_month * 0.0001   # $100 per 1M accesses
    cold_cost = accesses_per_month * 0.001    # $1,000 per 1M accesses (retrieval)
    
    min(hot_cost, warm_cost, cold_cost)
  end
  
  defp estimate_storage_cost(info) do
    size_gb = info.size_bytes / 1_073_741_824
    
    %{
      hot: size_gb * 0.10,
      warm: size_gb * 0.023,
      cold: size_gb * 0.004,
      archive: size_gb * 0.00099
    }
  end
end
```

### 6.3 S3 Intelligent Tiering

```yaml
# For objects with unpredictable access patterns
rules:
  - id: "intelligent-tiering"
    status: "Enabled"
    filter:
      prefix: "segments/archive/"
    transitions:
      - days: 30
        storageClass: "INTELLIGENT_TIERING"
```

## 7. Backup Strategy

### 7.1 Backup Tiers

| Tier | Frequency | Retention | Storage | Purpose |
|------|-----------|-----------|---------|---------|
| Continuous | Real-time | 24 hours | Local SSD | Crash recovery |
| Daily | Daily | 90 days | S3 Cross-Region | DR |
| Weekly | Weekly | 1 year | Glacier | Long-term |
| Monthly | Monthly | 7 years | Glacier Deep | Compliance |

### 7.2 Backup Verification

```elixir
defmodule Blunderfest.Backup.Verifier do
  @moduledoc """
  Verifies backup integrity.
  """
  
  @spec verify(String.t()) :: :ok | {:error, term()}
  def verify(backup_id) do
    with {:ok, backup} <- S3.get_backup_metadata(backup_id),
         {:ok, data} <- S3.download(backup_id),
         {:ok, expected_hash} <- verify_checksum(data, backup.checksum),
         {:ok, restored} <- Blunderfest.Database.verify(data) do
      
      Logger.info("Backup #{backup_id} verified successfully")
      :ok
    else
      {:error, reason} ->
        Logger.error("Backup #{backup_id} verification failed: #{inspect(reason)}")
        alert_backup_failure(backup_id, reason)
        {:error, reason}
    end
  end
  
  defp verify_checksum(data, expected) do
    actual = :crypto.hash(:sha256, data) |> Base.encode16()
    
    if actual == expected do
      {:ok, :valid}
    else
      {:error, :checksum_mismatch}
    end
  end
end
```

## 8. Monitoring and Reporting

### 8.1 Storage Metrics

```elixir
defmodule Blunderfest.Lifecycle.Metrics do
  @doc """
  Report storage tier distribution.
  """
  @spec report_storage_tiers() :: map()
  def report_storage_tiers do
    %{
      hot: S3.list_objects(prefix: "segments/recent/") |> Enum.count(),
      warm: S3.list_objects(prefix: "segments/archive/") |> Enum.count(),
      cold: S3.list_objects(prefix: "segments/historical/", storage_class: "GLACIER") |> Enum.count(),
      archive: S3.list_objects(prefix: "archives/", storage_class: "DEEP_ARCHIVE") |> Enum.count()
    }
  end
  
  @doc """
  Report estimated storage costs.
  """
  @spec report_storage_costs() :: map()
  def report_storage_costs do
    tiers = report_storage_tiers()
    
    %{
      hot_cost_monthly: tiers.hot * 0.10,
      warm_cost_monthly: tiers.warm * 0.023,
      cold_cost_monthly: tiers.cold * 0.004,
      archive_cost_monthly: tiers.archive * 0.00099,
      total_monthly: sum_costs(tiers)
    }
  end
  
  @doc """
  Report GDPR compliance status.
  """
  @spec report_gdpr_status() :: map()
  def report_gdpr_status do
    %{
      pending_deletions: Blunderfest.GDPR.pending_count(),
      anonymized_players: Blunderfest.Player.anonymized_count(),
      consent_coverage: Blunderfest.GDPR.consent_coverage()
    }
  end
end
```

### 8.2 Alerts

```yaml
# Monitoring alerts
alerts:
  - name: "storage_near_limit"
    condition: storage_used_gb > (storage_limit_gb * 0.9)
    severity: warning
    message: "Storage usage at 90%"
    
  - name: "cold_access_spike"
    condition: glacier_retrievals_per_hour > 1000
    severity: warning
    message: "High Glacier retrieval rate - possible optimization needed"
    
  - name: "gdpr_backlog"
    condition: pending_gdpr_requests > 100
    severity: critical
    message: "GDPR request backlog exceeds threshold"
    
  - name: "backup_failed"
    condition: backup_verification_failed == true
    severity: critical    message: "Backup verification failed"
```

## 9. Implementation Checklist

- [ ] Define retention tiers and policies
- [ ] Implement automated tier transitions
- [ ] Configure S3 lifecycle rules
- [ ] Implement GDPR anonymization
- [ ] Build consent management
- [ ] Create archival process
- [ ] Implement segment compaction
- [ ] Set up scheduled cleanup jobs
- [ ] Build cost optimization reports
- [ ] Configure backup verification
- [ ] Set up storage monitoring
- [ ] Document data processing register

## References

- See `15-storage-architecture.md` for storage layer details
- See `16-distributed-system-design.md` for backup coordination
- See `13-security-testing.md` for security compliance
