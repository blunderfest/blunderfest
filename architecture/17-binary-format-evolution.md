# Binary Format Evolution

## Overview

This document addresses the binary format versioning, migration strategy, and backward compatibility plan that were identified as critical gaps in previous documents.

## Critical Issues Addressed

1. **No migration strategy** - Binary formats are hard to change
2. **No backward compatibility** - Version upgrades require careful planning
3. **Schema evolution rules** - When and how to evolve the format

## Version Strategy

### Semantic Versioning for Binary Format

```
Format: MAJOR.MINOR.PATCH

MAJOR - Breaking changes that require full reindex
MINOR - Backward-compatible additions
PATCH - Bug fixes, no format change
```

### Version History

| Version | Status | Breaking Changes |
|---------|--------|------------------|
| 1.0 | Current | Initial release |
| 1.1 | Planned | Additional index fields |
| 2.0 | Future | Major restructuring |

### Version Detection

```elixir
defmodule Blunderfest.Storage.Version do
  @moduledoc """
  Handle binary format version detection and migration.
  """
  
  @magic_bytes <<0x42, 0x43, 0x48, 0x53>>  # "BCHS"
  
  @spec detect_version(binary()) :: {:ok, major :: non_neg_integer(), minor :: non_neg_integer()}
                                | {:error, :invalid_magic | :invalid_header}
  def detect_version(<<@magic_bytes, major::16, minor::16, _::binary>>) do
    {:ok, major, minor}
  end
  def detect_version(<<@magic_bytes, _::binary>>) do
    {:error, :invalid_header}
  end
  def detect_version(_data) do
    {:error, :invalid_magic}
  end
  
  @spec compatible?(current :: {pos_integer(), pos_integer()},
                      required :: {pos_integer(), pos_integer()}) :: boolean()
  def compatible?({current_major, current_minor}, {required_major, _}) do
    # Current must be >= required, and major versions must match
    current_major == required_major and
      (current_major > required_major or current_minor >= required_minor)
  end
end
```

## Migration Strategy

### Migration Principles

1. **Never break read compatibility** - Old versions can always be read
2. **Write in latest version** - New writes always use current version
3. **Lazy migration** - Migrate data on access, not on upgrade
4. **Background compaction** - Full migration happens during compaction

### Migration Levels

```
Level 1: Read-compatible (same major version)
  - Old reader can read new format
  - New writer can read old format
  - No migration needed

Level 2: Additive (same major version, higher minor)
  - Add new optional fields
  - Old readers skip unknown fields
  - Migration optional

Level 3: Breaking (different major version)
  - Requires full reindex
  - Background migration during compaction
  - Old files remain readable until migration complete
```

### Migration Workflow

```
+------------------+
| Detect Version   | --> Read header, determine version
+------------------+
        |
        v
+------------------+
| Check Compatible | --> Can we read this version?
+------------------+
        |
   +----+----+
   |         |
Yes          No
   |         |
   v         v
+------------------+   +------------------+
| Read Directly    |   | Add to Migration |
+------------------+   | Queue            |
        |             +------------------+
        |                      |
        v                      v
+------------------+   +------------------+
| Return Data      |   | Background       |
+------------------+   | Migration        |
                      +------------------+
```

## Read Compatibility Layer

### Version Router

```elixir
defmodule Blunderfest.Storage.Reader do
  @moduledoc """
  Router that dispatches to version-specific readers.
  """
  
  @spec read_game(binary(), version :: {pos_integer(), pos_integer()}) ::
          {:ok, Blunderfest.Types.Game.t()} | {:error, term()}
  def read_game(data, {major, minor} = version) do
    if Version.compatible?({1, 0}, version) do
      # Use version 1.x reader
      Blunderfest.Storage.V1_Reader.read_game(data)
    else
      {:error, :unsupported_version}
    end
  end
  
  @spec read_game_record(binary(), version :: {pos_integer(), pos_integer()}) ::
          {:ok, map()} | {:error, term()}
  def read_game_record(data, {1, 0} = version) do
    Blunderfest.Storage.V1_Reader.read_record(data)
  end
  def read_game_record(data, {1, minor}) when minor >= 1 do
    Blunderfest.Storage.V1_Reader.read_record_v1_1(data)
  end
end
```

### Version 1.0 Reader

```elixir
defmodule Blunderfest.Storage.V1_Reader do
  @moduledoc """
  Reader for binary format version 1.0.
  """
  
  @spec read_game(binary()) :: {:ok, Blunderfest.Types.Game.t()}
  def read_game(<<
    game_id::32,
    white_id::32,
    black_id::32,
    event_id::16,
    site_id::16,
    date::32,
    round::16,
    result::8,
    eco::binary-3,
    move_count::16,
    flags::16,
    opening_offset::32,
    annotations_offset::32,
    ply_count::16,
    moves::binary,
    rest::binary
  >>) do
    {:ok, %Blunderfest.Types.Game{
      id: game_id,
      white_id: white_id,
      black_id: black_id,
      event_id: event_id,
      site_id: site_id,
      date: decode_date(date),
      round: round,
      result: decode_result(result),
      eco: eco,
      moves: decode_moves(moves, move_count),
      ply_count: ply_count
    }}
  end
  
  @spec read_record(binary()) :: {:ok, map()}
  def read_record(data) do
    # Core fields only (v1.0)
    {:ok, parse_record(data, [:id, :white_id, :black_id, :result, :eco, :moves])}
  end
  
  defp parse_record(data, fields) do
    # Binary pattern matching for each version
    Enum.reduce(fields, %{}, fn field, acc ->
      Map.put(acc, field, extract_field(data, field))
    end)
  end
  
  defp extract_field(data, :id), do: :binary.decode_unsigned(data, :little)
  # ... other field extractors
end
```

### Version 1.1 Reader (Additive)

```elixir
defmodule Blunderfest.Storage.V1_Reader do
  @moduledoc """
  Reader for binary format version 1.1 (backward-compatible with 1.0).
  """
  
  @spec read_record_v1_1(binary()) :: {:ok, map()}
  def read_record_v1_1(data) do
    # Read v1.0 fields
    base = parse_record(data, [:id, :white_id, :black_id, :result, :eco, :moves])
    
    # Check for extended fields (new in 1.1)
    # Extended fields are at the end of the record, after moves
    # Format: [moves][optional: extended_header][extended_data]
    extended = maybe_read_extended(data)
    
    Map.merge(base, extended)
  end
  
  defp maybe_read_extended(<<_moves::binary, magic::32, extended::binary>>)
       when magic == 0x45585444 do  # "EXTD"
    # Extended fields present
    parse_extended(extended)
  end
  defp maybe_read_extended(_data) do
    # No extended fields
    %{}
  end
  
  defp parse_extended(data) do
    # Read extended fields (all optional)
    %{
      accuracy: read_optional_float(data, :accuracy),
      time_control: read_optional_binary(data, :time_control),
      termination: read_optional_binary(data, :termination)
    }
    |> Enum.reject(fn {_, v} -> is_nil(v) end)
    |> Map.new()
  end
  
  defp read_optional_float(<<flag::8, rest::binary>>, :accuracy) do
    if flag == 1 do
      <<accuracy::float, _::binary>> = rest
      accuracy
    end
  end
end
```

## Write Compatibility

### Version-Aware Writer

```elixir
defmodule Blunderfest.Storage.Writer do
  @moduledoc """
  Writer that always writes in the latest version format.
  """
  
  @current_version {1, 1}
  
  @spec write_game(Blunderfest.Types.Game.t()) :: binary()
  def write_game(game) do
    write_game_record(game, @current_version)
  end
  
  @spec write_game_record(Blunderfest.Types.Game.t(), version :: {pos_integer(), pos_integer()}) :: binary()
  def write_game_record(game, {1, minor}) do
    base = encode_base_record(game)
    
    if minor >= 1 do
      extended = encode_extended(game)
      base <> <<0x45585444::32, extended::binary>>  # Magic + extended
    else
      base
    end
  end
  
  defp encode_base_record(game) do
    <<
      game.id::32,
      game.white_id::32,
      game.black_id::32,
      game.event_id::16,
      game.site_id::16,
      encode_date(game.date)::32,
      game.round::16,
      encode_result(game.result)::8,
      game.eco::binary,
      length(game.moves)::16,
      0::16,  # flags
      0::32,  # opening offset
      0::32,  # annotations offset
      game.ply_count::16,
      encode_moves(game.moves)::binary
    >>
  end
  
  defp encode_extended(game) do
    # Encode optional fields
    acc = <<>>
    
    acc = if game.accuracy do
      acc <> <<1::8, game.accuracy::float>>
    else
      acc <> <<0::8>>
    end
    
    acc <> encode_optional_binary(game.time_control)
  end
  
  defp encode_optional_binary(nil), do: <<0, 0::16>>
  defp encode_optional_binary(str) when is_binary(str) do
    <<1::8, byte_size(str)::16, str::binary>>
  end
end
```

## Migration Execution

### On-Demand Migration

```elixir
defmodule Blunderfest.Storage.OnDemandMigration do
  @moduledoc """
  Migrate data on access to avoid blocking on upgrades.
  """
  
  use GenServer
  
  defstruct [:queue, :migration_stats]
  
  @spec start_link(keyword()) :: GenServer.on_start()
  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end
  
  @impl true
  def init(_opts) do
    state = %__MODULE__{
      queue: :queue.new(),
      migration_stats: %{pending: 0, completed: 0, failed: 0}
    }
    
    schedule_migration_work()
    {:ok, state}
  end
  
  @spec request_migration(String.t(), pos_integer(), pos_integer()) :: :ok
  def request_migration(segment_id, from_version, to_version) do
    GenServer.cast(__MODULE__, {:request, segment_id, from_version, to_version})
  end
  
  @impl true
  def handle_cast({:request, segment_id, from, to}, state) do
    entry = %{segment_id: segment_id, from: from, to: to, added_at: now()}
    
    {:noreply, %{state | 
      queue: :queue.in(entry, state.queue),
      migration_stats: %{state.migration_stats | pending: state.migration_stats.pending + 1}
    }}
  end
  
  defp schedule_migration_work() do
    Process.send_after(self(), :do_migration, 10_000)  # Every 10 seconds
  end
  
  @impl true
  def handle_info(:do_migration, state) do
    state = case :queue.out(state.queue) do
      {{:value, entry}, new_queue} ->
        case migrate_segment(entry) do
          :ok ->
            %{state |
              queue: new_queue,
              migration_stats: %{state.migration_stats | 
                pending: state.migration_stats.pending - 1,
                completed: state.migration_stats.completed + 1
              }
            }
          {:error, reason} ->
            Logger.error("Migration failed: #{inspect(reason)}")
            %{state |
              queue: new_queue,
              migration_stats: %{state.migration_stats |
                pending: state.migration_stats.pending - 1,
                failed: state.migration_stats.failed + 1
              }
            }
        end
      {:empty, _} ->
        state
    end
    
    schedule_migration_work()
    {:noreply, state}
  end
  
  defp migrate_segment(entry) do
    # 1. Read old version
    with {:ok, segment} <- Segment.read(entry.segment_id),
         {:ok, migrated} <- migrate_data(segment, entry.from, entry.to),
         :ok <- Segment.write_v2(entry.segment_id, migrated) do
      :ok
    end
  end
  
  defp migrate_data(segment, {1, 0}, {1, 1}) do
    # Migrate from 1.0 to 1.1
    # Add new fields (accuracy, etc.) with nil values
    migrated_games = Enum.map(segment.games, fn game ->
      Map.put(game, :accuracy, nil)
    end)
    
    {:ok, %{segment | games: migrated_games, version: {1, 1}}}
  end
end
```

### Compaction Migration

```elixir
defmodule Blunderfest.Storage.Compaction do
  @moduledoc """
  Full migration during segment compaction.
  """
  
  @spec compact_and_migrate([segment()], target_version :: {pos_integer(), pos_integer()}) ::
          {:ok, segment()}
  def compact_and_migrate(segments, target_version) do
    # Read all segments
    all_games = Enum.flat_map(segments, &Segment.games/1)
    
    # Sort by game ID
    sorted = Enum.sort_by(all_games, & &1.id)
    
    # Write new compacted segment in target version
    {:ok, new_segment} = Segment.create(target_version)
    
    Enum.each(sorted, fn game ->
      :ok = Segment.append(new_segment, game)
    end)
    
    {:ok, new_segment}
  end
  
  @spec auto_upgrade_if_needed(segment()) :: {:ok, segment()}
  def auto_upgrade_if_needed(segment) do
    current = segment.version
    target = Writer.current_version()
    
    if current < target do
      Logger.info("Auto-migrating segment #{segment.id} from #{inspect(current)} to #{inspect(target)}")
      
      # Find all segments of old version
      candidates = find_candidates_for_compaction(current)
      
      if length(candidates) >= compaction_threshold() do
        # Batch compact
        {:ok, new_segment} = compact_and_migrate(candidates, target)
        delete_old_segments(candidates)
        {:ok, new_segment}
      else
        # Mark for lazy migration
        OnDemandMigration.request_migration(segment.id, current, target)
        {:ok, segment}
      end
    else
      {:ok, segment}
    end
  end
end
```

## Schema Evolution Rules

### Allowed Changes

| Change Type | Example | Backward Compatible |
|------------|---------|-------------------|
| Add optional field | Add accuracy to game | ✅ Yes |
| Add section at end | Extended header | ✅ Yes |
| Add new index | New bloom filter | ✅ Yes |
| Increase field size | u32 -> u64 for counts | ⚠️ Depends |
| Change encoding | Uncompressed -> compressed | ❌ No |
| Remove field | Delete unused field | ❌ No |
| Reorder fields | Change record layout | ❌ No |

### Breaking Changes Checklist

Before any major version bump, verify:

```elixir
defmodule Blunderfest.Storage.SchemaValidator do
  @moduledoc """
  Validate that a schema change is backward-compatible.
  """
  
  @spec validate_change(change :: map()) :: :ok | {:error, String.t()}
  def validate_change(change) do
    errors = []
    
    # Check for field removal
    if Map.has_key?(change, :removed_fields) and change.removed_fields != [] do
      errors = ["Cannot remove fields in minor version" | errors]
    end
    
    # Check for field reordering
    if Map.has_key?(change, :reordered_fields) and change.reordered_fields != [] do
      errors = ["Cannot reorder fields in minor version" | errors]
    end
    
    # Check new fields are optional
    if Map.has_key?(change, :new_fields) do
      non_optional = Enum.reject(change.new_fields, & &1.optional)
      if non_optional != [] do
        errors = ["New fields must be optional: #{inspect(non_optional)}" | errors]
      end
    end
    
    case errors do
      [] -> :ok
      _ -> {:error, Enum.join(errors, "\n")}
    end
  end
end
```

## Version Documentation

### Changelog Format

```markdown
# Binary Format Changelog

## [1.1.0] - 2025-XX-XX

### Added
- Extended game header with optional fields
  - `accuracy`: Float, engine accuracy score
  - `time_control`: Binary string, time control notation
  - `termination`: Binary string, termination reason
- Extended fields are optional and backward-compatible

### Format Change
```
[Game Record v1.1]
...
[0x45585444: Magic]     # "EXTD" marker if extended fields present
[flag: 1 byte]          # 1 if accuracy present
[accuracy: 8 bytes]      # Float if flag == 1
[flag: 1 byte]           # 1 if time_control present
[len: 2 bytes]           # Length of time_control string
[time_control: N bytes]  # String if flag == 1
...
```

### Migration
- Automatic: Games are migrated on first access
- Bulk: Compaction job migrates all games
- No reindexing required

## [1.0.0] - 2024-01-01

### Initial Release
- Basic game storage
- Position indexing
- Player and event indices
```

## Testing

### Version Compatibility Tests

```elixir
defmodule Blunderfest.Storage.VersionTest do
  use ExUnit.Case
  
  describe "version detection" do
    test "detects valid version" do
      data = <<0x42, 0x43, 0x48, 0x53, 1::16, 0::16, 0::binary>>
      assert {:ok, 1, 0} = Version.detect_version(data)
    end
    
    test "rejects invalid magic" do
      data = <<0x00, 0x00, 0x00, 0x00, 1::16, 0::16>>
      assert {:error, :invalid_magic} = Version.detect_version(data)
    end
  end
  
  describe "compatibility" do
    test "1.0 is compatible with 1.0" do
      assert Version.compatible?({1, 0}, {1, 0})
    end
    
    test "1.1 is compatible with 1.0" do
      assert Version.compatible?({1, 1}, {1, 0})
    end
    
    test "1.0 is NOT compatible with 1.1" do
      refute Version.compatible?({1, 0}, {1, 1})
    end
    
    test "2.0 is NOT compatible with 1.0" do
      refute Version.compatible?({2, 0}, {1, 0})
    end
  end
end
```

### Migration Tests

```elixir
defmodule Blunderfest.Storage.MigrationTest do
  use ExUnit.Case
  
  test "migrates 1.0 game to 1.1" do
    game_v1_0 = build_game_v1_0()
    serialized = V1_Writer.write_game(game_v1_0)
    
    {:ok, game_v1_1} = OnDemandMigration.migrate_game(serialized, {1, 0}, {1, 1})
    
    assert game_v1_1.id == game_v1_0.id
    assert game_v1_1.accuracy == nil  # Default value
  end
  
  test "reads 1.1 game in 1.0 compatible mode" do
    game_v1_1 = %{build_game_v1_1() | accuracy: 0.85}
    serialized = Writer.write_game(game_v1_1)
    
    # Read with v1.0 reader (should skip extended fields)
    {:ok, game_v1_0_compatible} = V1_Reader.read_game(serialized)
    
    assert game_v1_0_compatible.id == game_v1_1.id
    # accuracy field is nil because v1.0 reader doesn't know about it
  end
end
```

## Implementation Checklist

- [ ] Implement version detection in header reader
- [ ] Create version-specific reader modules
- [ ] Add backward-compatible writer
- [ ] Implement on-demand migration
- [ ] Add compaction migration
- [ ] Create schema validator
- [ ] Write migration tests
- [ ] Document all format changes

## References

- See `02-binary-format-specification.md` for current format
- See `15-storage-architecture.md` for segment management
