defmodule BlunderfestWeb.RoomHTML do
  use BlunderfestWeb, :html

  def index(assigns) do
    ~H"""
    <!DOCTYPE html>
    <html lang="en" data-mode="dark" class="h-screen">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="csrf-token" content={get_csrf_token()} />

        <script>
          window.config = {
            userToken: "<%= assigns[:user_token] %>",
            userId: "<%= assigns[:user_id] %>",
            roomCode: "<%= assigns[:room_code] %>",
          };
        </script>

        <title>Blunderfest</title>

        <%= Vite.inlined_phx_manifest() %>
        <%= Vite.vite_client() %>
        <%= Vite.react_refresh_snippet() %>
        <%= Vite.vite_snippet("src/main.tsx") %>
      </head>

      <body class="flex min-h-full">
        <div id="root" class="flex grow bg-surface-1 text-surface-1"></div>
      </body>
    </html>
    """
  end
end
