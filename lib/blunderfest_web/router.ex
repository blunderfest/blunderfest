defmodule BlunderfestWeb.Router do
  use BlunderfestWeb, :router

  pipeline :api do
    plug(:accepts, ["json"])
    plug(Blunderfest.Middleware.Auth)
    plug(Blunderfest.Middleware.RateLimit)
  end

  scope "/api/v1", BlunderfestWeb do
    pipe_through(:api)

    get("/health", HealthController, :index)

    resources("/games", GameController, only: [:index, :show, :create, :update, :delete])
    get("/games/:id/pgn", GameController, :pgn)
    get("/games/:id/positions", GameController, :positions)

    get("/positions/:fen", PositionController, :show)
    post("/positions/search", PositionController, :search)
    get("/positions/:fen/games", PositionController, :games)
    get("/positions/:fen/similar", PositionController, :similar)
    get("/positions/:fen/transpositions", PositionController, :transpositions)

    get("/players", PlayerController, :index)
    get("/players/:id", PlayerController, :show)
    get("/players/:id/games", PlayerController, :games)
    get("/players/:id/stats", PlayerController, :stats)
    get("/players/:id1/vs/:id2", PlayerController, :head_to_head)

    get("/openings", OpeningController, :index)
    get("/openings/:eco", OpeningController, :show)
    get("/openings/:eco/tree", OpeningController, :tree)
    get("/openings/:eco/stats", OpeningController, :stats)

    post("/analysis", AnalysisController, :create)
    get("/analysis/:id", AnalysisController, :show)
    delete("/analysis/:id", AnalysisController, :cancel)

    post("/import/pgn", ImportController, :pgn)
    post("/export/pgn", ExportController, :pgn)
    get("/import/status/:id", ImportController, :status)
  end

  if Application.compile_env(:blunderfest, :dev_routes) do
    scope "/dev" do
    end
  end
end
