defmodule BlunderfestWeb.CoreComponents do
  use Phoenix.Component

  def theme_toggle(assigns) do
    ~H"""
    <button
      class="theme-toggle"
      id="theme-toggle"
      title="Toggles light and dark"
      aria-label="auto"
      aria-live="polite"
    >
      <svg class="sun-and-moon" aria-hidden="true" width="24" height="24" viewBox="0 0 24 24">
        <mask class="moon" id="moon-mask">
          <rect x="0" y="0" width="100%" height="100%" fill="white" />
          <circle cx="24" cy="10" r="6" fill="black" />
        </mask>
        <circle class="sun" cx="12" cy="12" r="6" mask="url(#moon-mask)" fill="currentColor" />
        <g class="sun-beams" stroke="currentColor">
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </g>
      </svg>
    </button>
    """
  end

  attr(:text, :string)

  def my_first_atom(assigns) do
    ~H"""
    <p><%= @text %></p>
    """
  end

  attr(:title, :string)
  attr(:text, :string)

  def my_first_molecule(assigns) do
    ~H"""
    <h1><%= @title %></h1>
    <.my_first_atom text={@text} />
    """
  end

  attr(:title, :string)
  attr(:text, :string)

  def my_first_organism(assigns) do
    ~H"""
    <div class="organism">
      <.my_first_molecule title={@title} text={@text} />
    </div>
    """
  end
end
