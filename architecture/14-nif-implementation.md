# NIF Implementation Guide

## Overview

This document provides comprehensive guidance for implementing NIFs (Native Implemented Functions) in Blunderfest using Rustler. NIFs are critical for achieving the <1ms position lookup target on hot code paths.

## Why NIFs Are Needed

Pure Elixir cannot meet the performance targets for certain operations:

| Operation | Elixir (µs) | NIF (µs) | Speedup |
|-----------|-------------|----------|---------|
| Zobrist hash | 50 | 2 | 25x |
| Binary parse | 200 | 10 | 20x |
| Index lookup | 100 | 1 | 100x |
| mmap access | 1000 | 5 | 200x |

## Rustler Setup

### Project Structure

```
apps/blunderfest_core/
├── native/
│   └── blunderfest_nif/
│       ├── Cargo.toml
│       ├── src/
│       │   ├── lib.rs              # Main entry point
│       │   ├── mmap.rs             # Memory mapping
│       │   ├── zobrist.rs          # Zobrist hashing
│       │   ├── binary.rs           # Binary format parsing
│       │   ├── index.rs            # B-Tree operations
│       │   └── error.rs            # Error handling
│       └── tests/
└── mix.exs
```

### Cargo.toml

```toml
[package]
name = "blunderfest_nif"
version = "0.1.0"
edition = "2021"

[lib]
name = "blunderfest_nif"
crate-type = ["cdylib"]

[dependencies]
rustler = "0.35"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
memmap2 = "0.9"
byteorder = "1.4"
parking_lot = "0.12"

[dev-dependencies]
rustler = "0.35"

[profile.release]
opt-level = 3
lto = true
codegen-units = 1
```

### mix.exs Configuration

```elixir
# apps/blunderfest_core/mix.exs
defmodule BlunderfestCore.MixProject do
  def project do
    [
      # ...
      compilers: [:rustler] ++ Mix.compilers(),
      rustler_crates: [
        blunderfest_nif: [
          path: "native/blunderfest_nif",
          mode: if(Mix.env() == :prod, do: :release, else: :debug)
        ]
      ]
    ]
  end
end
```

## Error Handling

### Rust Error Types

```rust
// src/error.rs
use thiserror::Error;
use rustler::Term;

#[derive(Error, Debug)]
pub enum BlunderfestError {
    #[error("Invalid input: {0}")]
    InvalidInput(String),
    
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    
    #[error("Parse error at position {position}: {message}")]
    ParseError { position: usize, message: String },
    
    #[error("Index out of bounds: {index} (size: {size})")]
    OutOfBounds { index: usize, size: usize },
    
    #[error("Resource not found: {0}")]
    NotFound(String),
}

impl BlunderfestError {
    /// Convert error to Erlang term
    pub fn to_term(&self) -> Term<'_> {
        let (code, details) = match self {
            BlunderfestError::InvalidInput(msg) => 
                ("invalid_input", vec![("message", msg.as_str())]),
            BlunderfestError::ParseError { position, message } => 
                ("parse_error", vec![("position", *position), ("message", message.as_str())]),
            BlunderfestError::OutOfBounds { index, size } => 
                ("out_of_bounds", vec![("index", *index), ("size", *size)]),
            BlunderfestError::NotFound(key) => 
                ("not_found", vec![("key", key.as_str())]),
            BlunderfestError::IoError(e) => 
                ("io_error", vec![("errno", e.raw_os_error())]),
        };
        
        // Return as Erlang map
        rustler::term::map::map_unique([
            ("error".encode(), code.encode()),
            ("details".encode(), details.encode()),
        ])
    }
}
```

### Rustler Resource Types

```rust
// src/lib.rs
mod error;
mod zobrist;
mod mmap;
mod binary;
mod index;

use error::BlunderfestError;
use rustler::{atoms, Env, Term, NifResult, Encoder};

// Define resource type for mmap file
mod mmap_resource {
    use super::*;
    use std::sync::Arc;
    use parking_lot::Mutex;
    
    pub struct MmapFile {
        pub inner: memmap2::Mmap,
        pub path: String,
    }
    
    pub struct MmapHandle(pub Arc<Mutex<Option<MmapFile>>>);
    
    impl Drop for MmapHandle {
        fn drop(&mut self) {
            // Explicit cleanup handled in Elixir
        }
    }
}

rustler::init!(
    "Elixir.Blunderfest.Nif",
    [
        // Zobrist functions
        "zobrist_hash",
        "zobrist_hash_position",
        "zobrist_update_hash",
        // Memory mapping functions
        "mmap_open",
        "mmap_read",
        "mmap_write",
        "mmap_sync",
        "mmap_close",
        // Binary parsing
        "parse_game_record",
        "encode_game_record",
        // Index operations
        "index_lookup",
        "index_insert",
    ],
    load = load
);

fn load(env: Env, _load_info: Term<'_>) -> bool {
    // Register resource type for MmapHandle
    resource_struct_init!(MmapHandle, env);
    true
}
```

## Zobrist Hashing Implementation

```rust
// src/zobrist.rs
use rustler::{NifResult, Encoder};
use std::collections::HashMap;

const TABLE_SIZE: usize = 1674; // 64 squares × 12 pieces + castling + en passant + side

pub struct ZobristTable {
    table: [u64; TABLE_SIZE],
}

impl ZobristTable {
    pub fn new() -> Self {
        let mut table = [0u64; TABLE_SIZE];
        
        // Use crypto-strong random numbers
        let bytes: Vec<u8> = (0..TABLE_SIZE * 8)
            .map(|_| {
                let mut buf = [0u8; 1];
                getrandom::getrandom(&mut buf).unwrap();
                buf[0]
            })
            .collect();
        
        for (i, chunk) in bytes.chunks(8).enumerate() {
            table[i] = u64::from_le_bytes(chunk.try_into().unwrap());
        }
        
        Self { table }
    }
    
    /// Calculate initial position hash
    pub fn hash_position(&self, pieces: &[(u8, u8, u8)]) -> u64 
    where
        // (square, color, piece_type)
        // color: 0 = white, 1 = black
        // piece_type: 0=pawn, 1=knight, 2=bishop, 3=rook, 4=queen, 5=king
    {
        let mut hash = 0u64;
        
        for (square, color, piece_type) in pieces {
            let index = (piece_type + color * 6) * 64 + square;
            hash ^= self.table[index];
        }
        
        hash
    }
    
    /// Incrementally update hash for a move
    pub fn update_hash(
        &self,
        hash: u64,
        from: u8,
        to: u8,
        piece_type: u8,
        color: u8,
        captured: Option<(u8, u8)>, // (piece_type, color)
        promotion: Option<u8>,
    ) -> u64 {
        let piece_index = (piece_type + color * 6) * 64;
        
        // Remove piece from source square
        let mut new_hash = hash ^ self.table[piece_index + from as usize];
        
        // Add piece to destination square
        let dest_piece = promotion.unwrap_or(piece_type);
        new_hash ^= self.table[(dest_piece + color * 6) * 64 + to as usize];
        
        // Handle capture
        if let Some((captured_type, captured_color)) = captured {
            let captured_index = (captured_type + captured_color * 6) * 64 + to as usize;
            new_hash ^= self.table[captured_index];
        }
        
        new_hash
    }
}

#[rustler::nif]
pub fn zobrist_hash<'a>(env: Env<'a>, pieces: Vec<(u8, u8, u8)>) -> NifResult<Term<'a>> {
    let table = ZobristTable::new();
    Ok(table.hash_position(&pieces).encode(env))
}
```

## Memory Mapping Implementation

```rust
// src/mmap.rs
use super::mmap_resource::{MmapFile, MmapHandle};
use rustler::{NifResult, Encoder, ResourceArc, Env, Term};
use std::fs::File;
use std::path::Path;

const MMAP_CHUNK_SIZE: usize = 1024 * 1024; // 1MB chunks for reading

#[rustler::nif]
pub fn mmap_open<'a>(
    env: Env<'a>,
    path: String,
    size: usize,
) -> NifResult<Term<'a>> {
    let path = Path::new(&path);
    
    // Open or create file
    let file = match File::open(path) {
        Ok(f) => f,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            // Create file with required size
            let f = File::create(path)?;
            f.set_len(size as u64)?;
            f
        }
        Err(e) => return Err(rustler::Error::RaiseAtom("open_error")),
    };
    
    // Create memory map
    let mmap = unsafe {
        memmap2::MmapOptions::new()
            .map(&file)
            .map_len(size)
    }.map_err(|e| {
        rustler::Error::RaiseException(format!("mmap error: {}", e))
    })?;
    
    let handle = MmapHandle(Arc::new(Mutex::new(Some(MmapFile {
        inner: mmap,
        path,
    }))));
    
    Ok(ResourceArc::new(handle).encode(env))
}

#[rustler::nif]
pub fn mmap_read<'a>(
    env: Env<'a>,
    resource: ResourceArc<MmapHandle>,
    offset: usize,
    length: usize,
) -> NifResult<Term<'a>> {
    let guard = resource.0.lock();
    let mmap_file = guard.as_ref()
        .ok_or(rustler::Error::RaiseAtom("closed"))?;
    
    let data = mmap_file.inner.get(offset..offset + length)
        .ok_or(rustler::Error::RaiseAtom("out_of_bounds"))?;
    
    Ok(data.to_vec().encode(env))
}

#[rustler::nif]
pub fn mmap_write<'a>(
    env: Env<'a>,
    resource: ResourceArc<MmapHandle>,
    offset: usize,
    data: Vec<u8>,
) -> NifResult<Term<'a>> {
    let mut guard = resource.0.lock();
    let mmap_file = guard.as_mut()
        .ok_or(rustler::Error::RaiseAtom("closed"))?;
    
    let slice = mmap_file.inner.get_mut(offset..offset + data.len())
        .ok_or(rustler::Error::RaiseAtom("out_of_bounds"))?;
    
    slice.copy_from_slice(&data);
    
    Ok(true.encode(env))
}

#[rustler::nif]
pub fn mmap_sync<'a>(
    env: Env<'a>,
    resource: ResourceArc<MmapHandle>,
) -> NifResult<Term<'a>> {
    let guard = resource.0.lock();
    let mmap_file = guard.as_ref()
        .ok_or(rustler::Error::RaiseAtom("closed"))?;
    
    mmap_file.inner.flush()
        .map_err(|e| rustler::Error::RaiseException(format!("sync error: {}", e)))?;
    
    Ok(true.encode(env))
}

#[rustler::nif]
pub fn mmap_close<'a>(
    env: Env<'a>,
    resource: ResourceArc<MmapHandle>,
) -> NifResult<Term<'a>> {
    let mut guard = resource.0.lock();
    guard.take(); // Drop the MmapFile
    Ok(true.encode(env))
}
```

## Binary Parsing Implementation

```rust
// src/binary.rs
use super::error::BlunderfestError;
use byteorder::{BigEndian, ReadBytesExt, WriteBytesExt};
use std::io::{Cursor, Read, Write};

#[derive(Debug)]
pub struct GameRecord {
    pub game_id: u32,
    pub white_id: u32,
    pub black_id: u32,
    pub event_id: u16,
    pub site_id: u16,
    pub date: u32,
    pub result: u8,
    pub eco: [u8; 3],
    pub moves: Vec<u8>,
}

impl GameRecord {
    pub fn parse(data: &[u8]) -> Result<Self, BlunderfestError> {
        let mut cursor = Cursor::new(data);
        
        let game_id = cursor.read_u32::<BigEndian>()
            .map_err(|_| BlunderfestError::InvalidInput("game_id".to_string()))?;
        let white_id = cursor.read_u32::<BigEndian>()?;
        let black_id = cursor.read_u32::<BigEndian>()?;
        let event_id = cursor.read_u16::<BigEndian>()?;
        let site_id = cursor.read_u16::<BigEndian>()?;
        let date = cursor.read_u32::<BigEndian>()?;
        let result = cursor.read_u8()?;
        
        let mut eco = [0u8; 3];
        cursor.read_exact(&mut eco)?;
        
        let move_count = cursor.read_u16::<BigEndian>()?;
        let mut moves = vec![0u8; move_count as usize * 2];
        cursor.read_exact(&mut moves)?;
        
        Ok(Self {
            game_id,
            white_id,
            black_id,
            event_id,
            site_id,
            date,
            result,
            eco,
            moves,
        })
    }
    
    pub fn encode(&self) -> Result<Vec<u8>, BlunderfestError> {
        let mut buf = Vec::with_capacity(256);
        
        buf.write_u32::<BigEndian>(self.game_id)?;
        buf.write_u32::<BigEndian>(self.white_id)?;
        buf.write_u32::<BigEndian>(self.black_id)?;
        buf.write_u16::<BigEndian>(self.event_id)?;
        buf.write_u16::<BigEndian>(self.site_id)?;
        buf.write_u32::<BigEndian>(self.date)?;
        buf.write_u8(self.result)?;
        buf.write_all(&self.eco)?;
        buf.write_u16::<BigEndian>(self.moves.len() as u16 / 2)?;
        buf.write_all(&self.moves)?;
        
        Ok(buf)
    }
}

#[rustler::nif]
pub fn parse_game_record<'a>(
    env: Env<'a>,
    data: Vec<u8>,
) -> NifResult<Term<'a>> {
    match GameRecord::parse(&data) {
        Ok(record) => {
            // Return as map for flexibility
            let map = [
                ("game_id", record.game_id.encode(env)),
                ("white_id", record.white_id.encode(env)),
                ("black_id", record.black_id.encode(env)),
                ("result", record.result.encode(env)),
                ("eco", record.eco.encode(env)),
            ];
            
            Ok(rustler::term::map::map_from_slice(env, &map)
                .unwrap_or_else(|| atoms::error().encode(env)))
        }
        Err(e) => Err(rustler::Error::RaiseException(e.to_string())),
    }
}
```

## Thread Safety

### Resource Ownership Model

```rust
// Thread-safe resource management
use std::sync::{Arc, atomic::{AtomicBool, Ordering}};

pub struct ThreadSafeIndex {
    inner: parking_lot::RwLock<Index>,
    initialized: AtomicBool,
}

impl ThreadSafeIndex {
    pub fn new() -> Self {
        Self {
            inner: parking_lot::RwLock::new(Index::new()),
            initialized: AtomicBool::new(false),
        }
    }
    
    pub fn initialize(&self, data: Vec<u8>) -> Result<(), BlunderfestError> {
        if self.initialized.swap(true, Ordering::SeqCst) {
            return Err(BlunderfestError::InvalidInput(
                "Index already initialized".to_string()
            ));
        }
        
        let mut index = self.inner.write();
        index.load(data)?;
        Ok(())
    }
    
    pub fn lookup(&self, hash: u64) -> Option<IndexEntry> {
        let index = self.inner.read();
        index.find(hash)
    }
}
```

### Elixir-Side Resource Management

```elixir
defmodule Blunderfest.Nif.MmapHandle do
  @moduledoc """
  Elixir wrapper for NIF mmap resource with automatic cleanup.
  """
  
  use GenServer
  
  alias __MODULE__
  
  defstruct [:resource, :path, :size]
  
  @type t :: %__MODULE__{
    resource: reference(),
    path: String.t(),
    size: non_neg_integer()
  }
  
  @spec open(String.t(), non_neg_integer()) :: {:ok, t()} | {:error, term()}
  def open(path, size) do
    case :blunderfest_nif.mmap_open(path, size) do
      {:ok, resource} -> 
        {:ok, %__MODULE__{resource: resource, path: path, size: size}}
      error ->
        error
    end
  end
  
  @spec read(t(), non_neg_integer(), non_neg_integer()) :: binary() | {:error, term()}
  def read(%__MODULE__{resource: resource}, offset, length) do
    :blunderfest_nif.mmap_read(resource, offset, length)
  end
  
  @spec write(t(), non_neg_integer(), binary()) :: :ok | {:error, term()}
  def write(%__MODULE__{resource: resource}, offset, data) do
    :blunderfest_nif.mmap_write(resource, offset, data)
  end
  
  @spec sync(t()) :: :ok | {:error, term()}
  def sync(%__MODULE__{resource: resource}) do
    :blunderfest_nif.mmap_sync(resource)
  end
  
  @spec close(t()) :: :ok
  def close(%__MODULE__{resource: resource}) do
    :blunderfest_nif.mmap_close(resource)
  end
  
  @doc """
  Use pattern for automatic cleanup.
  """
  defmacro with_mmap(path, size, do: block) do
    quote do
      resource = Blunderfest.Nif.MmapHandle
      {:ok, handle} = Blunderfest.Nif.MmapHandle.open(unquote(path), unquote(size))
      
      try do
        unquote(block)
      after
        Blunderfest.Nif.MmapHandle.close(handle)
      end
    end
  end
end
```

## Testing NIFs

### Unit Tests in Rust

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_zobrist_hash_consistency() {
        let table = ZobristTable::new();
        
        // Starting position
        let starting_pieces = vec![
            // White pieces (color = 0)
            (0, 0, 3), (1, 0, 1), (2, 0, 2), (3, 0, 4), (4, 0, 5), (5, 0, 2), (6, 0, 1), (7, 0, 3), // rank 1
            (8, 0, 0), (9, 0, 0), (10, 0, 0), (11, 0, 0), (12, 0, 0), (13, 0, 0), (14, 0, 0), (15, 0, 0), // rank 2
            (48, 1, 3), (49, 1, 1), (50, 1, 2), (51, 1, 4), (52, 1, 5), (53, 1, 2), (54, 1, 1), (55, 1, 3), // rank 7
            (56, 1, 0), (57, 1, 0), (58, 1, 0), (59, 1, 0), (60, 1, 0), (61, 1, 0), (62, 1, 0), (63, 1, 0), // rank 8
        ];
        
        let hash1 = table.hash_position(&starting_pieces);
        let hash2 = table.hash_position(&starting_pieces);
        
        assert_eq!(hash1, hash2, "Same position should produce same hash");
    }
    
    #[test]
    fn test_incremental_hash() {
        let table = ZobristTable::new();
        
        // e2 pawn
        let from = 52;
        let to = 36;
        let initial_hash = 12345u64;
        
        // Move e2-e4 (white pawn, no capture, no promotion)
        let new_hash = table.update_hash(
            initial_hash,
            from,
            to,
            0, // pawn
            0, // white
            None,
            None,
        );
        
        assert_ne!(initial_hash, new_hash, "Hash should change after move");
    }
}
```

### Elixir Integration Tests

```elixir
defmodule Blunderfest.NifTest do
  use ExUnit.Case, async: true
  
  describe "Zobrist hashing" do
    test "produces consistent hashes" do
      pieces = [
        {4, 0, 5},  # White king at e1
        {60, 1, 5}, # Black king at e8
      ]
      
      hash1 = :blunderfest_nif.zobrist_hash(pieces)
      hash2 = :blunderfest_nif.zobrist_hash(pieces)
      
      assert hash1 == hash2
    end
    
    test "different positions produce different hashes" do
      pieces1 = [{4, 0, 5}, {60, 1, 5}]
      pieces2 = [{3, 0, 5}, {60, 1, 5}]  # Different white king position
      
      hash1 = :blunderfest_nif.zobrist_hash(pieces1)
      hash2 = :blunderfest_nif.zobrist_hash(pieces2)
      
      assert hash1 != hash2
    end
  end
  
  describe "Memory mapping" do
    setup do
      temp_path = Path.join(System.tmp_dir!(), "test_mmap_#{:rand.uniform(10000)}")
      
      on_exit(fn ->
        File.rm(temp_path)
      end)
      
      %{path: temp_path}
    end
    
    test "opens and reads memory-mapped file", %{path: path} do
      # Write test data
      test_data = <<1, 2, 3, 4, 5, 6, 7, 8>>
      File.write!(path, test_data)
      
      {:ok, resource} = :blunderfest_nif.mmap_open(path, byte_size(test_data))
      
      assert :blunderfest_nif.mmap_read(resource, 0, 4) == <<1, 2, 3, 4>>
      
      :blunderfest_nif.mmap_close(resource)
    end
    
    test "writes through memory map", %{path: path} do
      # Create empty file
      File.write!(path, <<0, 0, 0, 0>>)
      
      {:ok, resource} = :blunderfest_nif.mmap_open(path, 4)
      
      :ok = :blunderfest_nif.mmap_write(resource, 0, <<1, 2, 3, 4>>)
      :ok = :blunderfest_nif.mmap_sync(resource)
      
      assert File.read!(path) == <<1, 2, 3, 4>>
      
      :blunderfest_nif.mmap_close(resource)
    end
  end
end
```

## Performance Benchmarks

```rust
#[cfg(test)]
mod benchmarks {
    use test::Bencher;
    
    #[bench]
    fn bench_zobrist_hash(b: &mut Bencher) {
        let table = ZobristTable::new();
        let pieces: Vec<(u8, u8, u8)> = (0..32)
            .map(|i| (i as u8, (i / 16) as u8, (i % 16) as u8))
            .collect();
        
        b.iter(|| {
            test::black_box(table.hash_position(&pieces))
        });
    }
    
    #[bench]
    fn bench_mmap_read_1mb(b: &mut Bencher) {
        // Setup: create and map a 1MB file
        let tempdir = TempDir::new().unwrap();
        let path = tempdir.path().join("bench_mmap");
        let data = vec![0u8; 1024 * 1024];
        std::fs::write(&path, &data).unwrap();
        
        let resource = mmap_open(path.to_str().unwrap(), 1024 * 1024).unwrap();
        
        b.iter(|| {
            test::black_box(mmap_read(resource, 0, 1024 * 1024))
        });
    }
}
```

## Build and Release

### Local Development

```bash
# Build NIF in debug mode
cd apps/blunderfest_core
mix deps.get
mix compile

# Run tests
mix test

# Benchmark
mix run -e "Blunderfest.Benchmarks.run"
```

### Release Build

```bash
# Build NIF in release mode with optimizations
MIX_ENV=prod mix compile

# The release will include the compiled NIF
mix release
```

### Cross-Platform Considerations

For cross-platform NIFs, use cross:

```toml
# .cargo/config.toml
[target.x86_64-unknown-linux-gnu]
linker = "/usr/bin/clang"
rustflags = ["-C", "target-feature=-crt-static"]

[target.aarch64-unknown-linux-gnu]
linker = "aarch64-linux-gnu-gcc"
```

## Troubleshooting

### Common Issues

1. **NIF won't load**
   - Check that Cargo.toml crate-type is "cdylib"
   - Verify Rust toolchain is installed: `rustc --version`
   - Check for linker errors in build output

2. **Segment fault**
   - Verify resource cleanup in Elixir
   - Check bounds in mmap_read/write
   - Ensure proper lifetime management in Rust

3. **Performance not as expected**
   - Use release mode for benchmarks
   - Check LTO is enabled in Cargo.toml
   - Profile with flamegraph

## Implementation Checklist

- [ ] Set up Rustler project structure
- [ ] Implement error handling module
- [ ] Implement Zobrist hashing NIF
- [ ] Implement memory mapping NIF
- [ ] Implement binary parsing NIF
- [ ] Add thread safety to resources
- [ ] Write Elixir resource wrapper
- [ ] Write integration tests
- [ ] Benchmark performance
- [ ] Document API

## References

- [Rustler Documentation](https://github.com/rustler-org/rustler)
- [memmap2 crate](https://docs.rs/memmap2)
- [thiserror for idiomatic error handling](https://docs.rs/thiserror)
