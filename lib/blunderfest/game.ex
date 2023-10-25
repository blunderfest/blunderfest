defmodule Blunderfest.Game do
  use TypedStruct

  @derive {Jason.Encoder, []}
  typedstruct module: Square do
    field(:rank, Integer.t(), enforce: true)
    field(:file, String.t(), enforce: true)
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Move do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:promotion, String.t())
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Arrow do
    field(:from, Integer.t(), enforce: true)
    field(:to, Integer.t(), enforce: true)
    field(:color, String.t(), enforce: true)
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Position do
    field(:id, String.t(), enforce: true)
    field(:fen, String.t(), enforce: true)
    field(:ply, Integer.t(), enforce: true)
    field(:arrows, list(Arrow.t()), enforce: true)
    field(:marks, list(String.t()), enforce: true)
    field(:selectedSquareIndex, Integer.t())
  end

  @derive {Jason.Encoder, []}
  typedstruct module: Variation do
    field(:move, Move.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end

  @derive {Jason.Encoder, []}
  typedstruct do
    field(:id, String.t(), enforce: true)
    field(:position, Position.t(), enforce: true)
    field(:variations, list(Variation.t()))
  end

  alias Nanoid

  def new(game_id) do
    pos_1 = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
    pos_2 = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
    pos_3 = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    pos_3_2 =
      Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    pos_3_3 =
      Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    pos_4 = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")
    pos_5 = Nanoid.generate(12, "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ")

    %Blunderfest.Game{
      id: game_id,
      position: %{
        id: pos_1,
        fen: "4r3/2P3R1/R1N2k1P/5Np1/K1p1p3/1pr5/3P4/Bn3Q2 w - - 0 1",
        ply: 0,
        arrows: [],
        marks: [],
        selectedSquareIndex: nil
      },
      variations: [
        %{
          move: %{
            from: 1,
            to: 2
          },
          position: %{
            id: pos_2,
            fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
            ply: 1,
            arrows: [],
            marks: [],
            selectedSquareIndex: nil
          },
          variations: [
            %{
              move: %{
                from: 62,
                to: 63
              },
              position: %{
                id: pos_3,
                fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
                ply: 12,
                arrows: [],
                marks: [],
                selectedSquareIndex: nil
              },
              variations: [
                %{
                  move: %{
                    from: 63,
                    to: 7
                  },
                  position: %{
                    id: pos_3_2,
                    fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
                    ply: 122,
                    arrows: [],
                    marks: [],
                    selectedSquareIndex: nil
                  },
                  variations: []
                },
                %{
                  move: %{
                    from: 7,
                    to: 4
                  },
                  position: %{
                    id: pos_3_3,
                    fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
                    ply: 123,
                    arrows: [],
                    marks: [],
                    selectedSquareIndex: nil
                  },
                  variations: []
                }
              ]
            },
            %{
              move: %{
                from: 2,
                to: 99
              },
              position: %{
                id: pos_4,
                fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
                ply: 2,
                arrows: [],
                marks: [],
                selectedSquareIndex: nil
              },
              variations: []
            }
          ]
        },
        %{
          move: %{
            from: 1,
            to: 99
          },
          position: %{
            id: pos_5,
            fen: "4r3/2P3R1/R1N2k1P/5Np1/K1pPp3/1pr5/8/Bn3Q2 b - d3 0 1",
            ply: 666,
            arrows: [],
            marks: [],
            selectedSquareIndex: nil
          },
          variations: []
        }
      ]
    }
  end
end
