defmodule Blunderfest.Profiles.NameTest do
  use ExUnit.Case, async: true

  alias Blunderfest.Profiles.Name

  test "generates a name matching the Adjective Animal NN shape" do
    assert Name.generate() =~ ~r/^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/
  end

  test "avoids names already taken" do
    taken = MapSet.new(["Brave Otter 42"])
    refute Name.generate(taken) == "Brave Otter 42"
  end
end
