#!/bin/sh
# A canned UCI engine for tests: answers the handshake and emits a fixed
# score with a deeper line first (so depth-last-wins is exercised).
while IFS= read -r line; do
  case "$line" in
    uci)
      echo 'id name FakeFish'
      echo 'uciok'
      ;;
    isready)
      echo 'readyok'
      ;;
    go*)
      echo 'info depth 9 score cp 15 pv e2e4'
      echo 'info depth 12 score cp 42 pv e2e4 e7e5 g1f3'
      echo 'bestmove e2e4'
      ;;
    quit)
      exit 0
      ;;
  esac
done
