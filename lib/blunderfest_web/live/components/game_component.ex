defmodule BlunderfestWeb.Components.GameComponent do
  use BlunderfestWeb, :live_component

  def render(assigns) do
    ~H"""
    <li
      class={[@is_active && "active"]}
      phx-click="room/activate_game"
      phx-value-game_code={@game.game_code}
    >
      <%= @game.game_code %> The count is <%= @game.count %>
      <button phx-click="game/increment" phx-value-game_code={@game.game_code}>Increment</button>
    </li>
    """
  end
end
