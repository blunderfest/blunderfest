defmodule Blunderfest.Storage do
  @moduledoc """
  Storage module for managing hot/cold storage.
  """

  use GenServer

  alias Blunderfest.Storage.{PositionIndex, Segment}

  @type t :: %__MODULE__{
    hot_path: String.t(),
    cold_path: String.t(),
    cache_size: non_neg_integer()
  }

  defstruct [:hot_path, :cold_path, :cache_size, :position_index]

  def start_link(opts \\ []) do
    GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  end

  def init(opts) do
    hot_path = Keyword.get(opts, :hot_path, "/var/lib/blunderfest/hot")
    cold_path = Keyword.get(opts, :cold_path, "s3://blunderfest-cold")
    cache_size = Keyword.get(opts, :cache_size, 8_000_000_000)

    File.mkdir_p!(hot_path)

    state = %__MODULE__{
      hot_path: hot_path,
      cold_path: cold_path,
      cache_size: cache_size,
      position_index: nil
    }

    {:ok, state}
  end

  def get_position_index do
    GenServer.call(__MODULE__, :get_position_index)
  end

  def lookup_position(hash) do
    GenServer.call(__MODULE__, {:lookup_position, hash})
  end

  def index_position(hash, game_id, stats) do
    GenServer.cast(__MODULE__, {:index_position, hash, game_id, stats})
  end

  def get_segment(segment_id) do
    GenServer.call(__MODULE__, {:get_segment, segment_id})
  end

  def append_to_segment(segment_id, game_data) do
    GenServer.call(__MODULE__, {:append_to_segment, segment_id, game_data})
  end

  @impl true
  def handle_call(:get_position_index, _from, state) do
    {:reply, state.position_index, state}
  end

  @impl true
  def handle_call({:lookup_position, hash}, _from, state) do
    result = PositionIndex.lookup(state.position_index, hash)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:get_segment, segment_id}, _from, state) do
    result = Segment.read(segment_id, state.hot_path)
    {:reply, result, state}
  end

  @impl true
  def handle_call({:append_to_segment, segment_id, game_data}, _from, state) do
    result = Segment.append(segment_id, game_data, state.hot_path)
    {:reply, result, state}
  end

  @impl true
  def handle_cast({:index_position, hash, game_id, stats}, state) do
    PositionIndex.insert(state.position_index, hash, game_id, stats)
    {:noreply, state}
  end
end
