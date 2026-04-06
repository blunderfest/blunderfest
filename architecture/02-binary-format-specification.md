# Binary Format Specification

## Overview

Blunderfest uses a custom binary format (.bchess) optimized for chess game storage and fast position lookup. The format is designed for:

- **Compactness**: ~100 bytes per game (compressed)
- **Speed**: Memory-mapped access for fast queries
- **Scalability**: Support for 100M+ games per file
- **Extensibility**: Version-based evolution

## File Structure

```
+------------------+
|    File Header   |  (64 bytes)
+------------------+
|   String Table   |  (variable)
+------------------+
|   Player Index   |  (variable)
+------------------+
|   Event Index    |  (variable)
+------------------+
|  Position Index  |  (variable)
+------------------+
|   Opening Index  |  (variable)
+------------------+
|    Game Data     |  (variable)
+------------------+
|     Footer       |  (32 bytes)
+------------------+
```

## File Header (64 bytes)

```
Offset  Size    Field           Description
------  ----    -----           -----------
0       4       Magic           "BCHS" (0x42434853)
4       2       Version         Format version (major.minor)
6       2       Flags           Feature flags
8       8       Created         Creation timestamp (Unix epoch)
16      8       Modified        Last modification timestamp
24      8       Game Count      Total number of games
32      8       Position Count  Total unique positions
40      8       Player Count    Total unique players
48      8       String Table Off Offset to string table
56      8       Footer Offset   Offset to footer
```

### Flags

```
Bit 0:    Has player index (1 = yes)
Bit 1:    Has event index (1 = yes)
Bit 2:    Has position index (1 = yes)
Bit 3:    Has opening index (1 = yes)
Bit 4:    Compressed games (1 = yes)
Bit 5-63: Reserved for future use
```

## String Table

A deduplicated string storage for player names, event names, sites, etc.

```
+------------------+
|  Entry Count     |  (4 bytes, uint32)
+------------------+
|  Entry 1         |
|  - Length        |  (2 bytes, uint16)
|  - String        |  (variable, UTF-8)
+------------------+
|  Entry 2         |
|  ...             |
+------------------+
```

## Player Index

Maps player IDs to their game participation.

```
+------------------+
|  Entry Count     |  (4 bytes, uint32)
+------------------+
|  Player 1        |
|  - Name Offset   |  (4 bytes, offset into string table)
|  - Game Count    |  (4 bytes, uint32)
|  - First Game ID |  (4 bytes, uint32)
|  - Games Offset  |  (4 bytes, offset to game ID array)
+------------------+
|  Player 2        |
|  ...             |
+------------------+
```

## Event Index

Maps event IDs to their games.

```
+------------------+
|  Entry Count     |  (4 bytes, uint32)
+------------------+
|  Event 1         |
|  - Name Offset   |  (4 bytes, offset into string table)
|  - Site Offset   |  (4 bytes, offset into string table)
|  - Game Count    |  (4 bytes, uint32)
|  - Games Offset  |  (4 bytes, offset to game ID array)
+------------------+
|  Event 2         |
|  ...             |
+------------------+
```

## Position Index

The core of fast position lookup. Uses Zobrist hashing.

```
+------------------+
|  Entry Count     |  (4 bytes, uint32)
+------------------+
|  Hash Table      |  (Entry Count × 24 bytes)
|  +-----------+   |
|  | Entry 1   |   |
|  | - Hash    |   |  (8 bytes, Zobrist hash)
|  | - Offset  |   |  (4 bytes, file offset of first occurrence)
|  | - Count   |   |  (4 bytes, number of occurrences)
|  | - Stats   |   |  (4 bytes, packed win/loss/draw)
|  | - GamesOff|   |  (4 bytes, offset to game ID array)
|  +-----------+   |
|  ...             |
+------------------+
```

### Position Statistics (4 bytes, packed)

```
Bits 0-10:   White wins (0-2047)
Bits 11-21:  Black wins (0-2047)
Bits 22-31:  Draws (0-1023, scaled)
```

## Opening Index

Maps ECO codes to positions and statistics.

```
+------------------+
|  Entry Count     |  (4 bytes, uint32)
+------------------+
|  Opening 1       |
|  - ECO Code      |  (3 bytes, e.g., "B90")
|  - Position Hash |  (8 bytes, Zobrist hash of key position)
|  - Game Count    |  (4 bytes, uint32)
|  - Win Rate      |  (2 bytes, white win percentage × 100)
|  - Draw Rate     |  (2 bytes, draw percentage × 100)
|  - Games Offset  |  (4 bytes, offset to game ID array)
+------------------+
|  Opening 2       |
|  ...             |
+------------------+
```

## Game Data

Each game is stored as a self-contained record.

```
+------------------+
|  Game Record 1   |
|  - Length        |  (4 bytes, uint32)
|  - Game Data     |  (variable)
+------------------+
|  Game Record 2   |
|  ...             |
+------------------+
```

### Game Record Structure

```
Offset  Size    Field           Description
------  ----    -----           -----------
0       4       Game ID         Unique game identifier
4       4       White Player ID Player ID (index into player index)
8       4       Black Player ID Player ID
12      2       Event ID        Event ID (index into event index)
14      2       Site ID         Site ID (string table offset)
16      4       Date            Packed date (YYYYMMDD format)
20      2       Round           Round number
22      1       Result          0=*, 1=1-0, 2=0-1, 3=1/2
23      3       ECO Code        ECO classification (e.g., "B90")
26      2       Move Count      Number of moves
28      2       Flags           Game flags (see below)
30      4       Opening Offset  Offset to opening index entry
34      4       Annotations Off Offset to annotations (0 if none)
38      2       ply Count       Total half-moves

--- Move Data ---
40      var     Moves           Compressed move sequence

--- Position Hashes ---
var     var     Position Hashes Array of 64-bit Zobrist hashes
                (one per position in the game)
```

### Game Flags

```
Bit 0:    Has variations (1 = yes)
Bit 1:    Has comments (1 = yes)
Bit 2:    Has NAG symbols (1 = yes)
Bit 3:    Has analysis (1 = yes)
Bit 4:    Is computer game (1 = yes)
Bit 5:    Is correspondence (1 = yes)
Bit 6-15: Reserved
```

## Move Encoding

### Standard Move (2 bytes)

```
Bits 0-5:   From square (0-63)
Bits 6-11:  To square (0-63)
Bits 12-14: Promotion piece (0=none, 1=Q, 2=R, 3=B, 4=N)
Bit 15:     Special flag (castling/en passant)
```

### Square Encoding

```
Square = rank × 8 + file
where rank 0 = rank 1 (white's side), file 0 = a-file

Example: e2 = 1×8 + 4 = 12
         e4 = 3×8 + 4 = 28
```

### Compressed Move Sequence

For games without annotations, moves are stored as a packed array:

```
+------------------+
|  Move Count      |  (2 bytes, uint16)
+------------------+
|  Move 1          |  (2 bytes)
|  Move 2          |  (2 bytes)
|  ...             |
+------------------+
```

### Annotated Moves

For games with annotations, a more complex structure is used:

```
+------------------+
|  Move Records    |
|  +-----------+   |
|  | Move 1    |   |
|  | - Move    |   |  (2 bytes)
|  | - Flags   |   |  (1 byte: has_comment, has_nag, has_variation)
|  | - Comment |   |  (variable, length-prefixed)
|  | - NAG     |   |  (1 byte, if present)
|  | - Variations| |  (variable, if present)
|  +-----------+   |
|  ...             |
+------------------+
```

## Annotations

Annotations are stored separately and referenced by offset.

```
+------------------+
|  Header          |
|  - Size          |  (4 bytes)
|  - Entry Count   |  (4 bytes)
+------------------+
|  Entries         |
|  +-----------+   |
|  | Entry 1   |   |
|  | - ply     |   |  (2 bytes, half-move number)
|  | - Type    |   |  (1 byte: comment/nag/glyph)
|  | - Length  |   |  (2 bytes)
|  | - Data    |   |  (variable)
|  +-----------+   |
|  ...             |
+------------------+
```

## Footer (32 bytes)

```
Offset  Size    Field           Description
------  ----    -----           -----------
0       4       Magic           "BCHF" (0x42434846)
4       4       CRC32           CRC32 of entire file (excluding footer)
8       8       Game Data Size  Size of game data section
16      8       Index Size      Size of all indices
24      8       Reserved        Future use
```

## Version History

### Version 1.0 (Initial)

- Basic game storage
- Position indexing with Zobrist hashing
- PGN import/export
- ECO classification

### Future Versions

- **1.1**: Enhanced compression algorithms
- **1.2**: Encrypted game storage
- **2.0**: Distributed database support

## Compression

### Move Compression

For large databases, moves can be further compressed:

1. **Run-length encoding** for repeated patterns
2. **Huffman coding** for common move sequences
3. **Dictionary encoding** for common openings

### Index Compression

- **Delta encoding** for game ID arrays
- **Bit packing** for boolean flags
- **Variable-length integers** for counts and offsets

## Error Detection

- **CRC32** checksum for entire file
- **Magic bytes** for file validation
- **Version checking** for format compatibility
- **Index validation** on open

## Example: Reading a Game

```
1. Read file header
2. Validate magic bytes and version
3. Seek to game data section
4. Read game record header
5. Decode move sequence
6. Look up player names from string table
7. Return Game struct
```

## Example: Position Lookup

```
1. Parse FEN string
2. Calculate Zobrist hash
3. Binary search position index
4. If found:
   - Read position statistics
   - Fetch game IDs
   - Return results
5. If not found:
   - Return empty result set
```

## File Size Estimates

For a database with 1 million games:

```
Component           Size
---------           ----
File Header         64 bytes
String Table        ~5 MB (player/event names)
Player Index        ~20 MB (100K players)
Event Index         ~5 MB (50K events)
Position Index      ~500 MB (50M unique positions)
Opening Index       ~1 MB (500 ECO codes)
Game Data           ~100 MB (1M games × 100 bytes)
Footer              32 bytes
---------           ----
Total               ~630 MB
```

For 100 million games:

```
Total               ~63 GB
```

## Implementation Notes

- Use **memory-mapped files** for indices
- **Lazy load** game data on demand
- **Cache** frequently accessed positions
- **Batch** writes for better performance
- **Validate** CRC32 on file open