defmodule Blunderfest.Profiles.Name do
  @moduledoc """
  Server-generated display names like "Brave Otter 42".

  Names come from curated wordlists — there is no user input, so no moderation
  is needed.
  """

  @adjectives ~w(Brave Calm Clever Daring Elegant Fierce Gentle Happy Jolly Keen
    Kind Lively Mighty Nimble Proud Quick Rustic Serene Swift Valiant Wise)

  @animals ~w(Badger Beaver Bunny Cheetah Cobra Falcon Ferret Fox Gecko Hawk
    Heron Lynx Moose Otter Owl Panda Raven Rhino Skunk Tiger Turtle Wolf Zebra)

  def generate(taken \\ MapSet.new()) do
    name = "#{Enum.random(@adjectives)} #{Enum.random(@animals)} #{Enum.random(10..99)}"

    if MapSet.member?(taken, name) do
      generate(taken)
    else
      name
    end
  end
end
