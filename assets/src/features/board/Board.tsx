import { Square } from "./Square";

export function Board() {
  return (
    <div className="grid aspect-square w-2/5 grid-cols-8 grid-rows-8">
      <Square color="light" />
      <Square color="dark" selected highlighted />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />

      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />

      <Square color="light" />
      <Square color="dark" />
      <Square color="light" selected highlighted />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />

      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" highlighted />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />

      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" highlighted />
      <Square color="dark" />

      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />

      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" selected />
      <Square color="dark" />

      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" selected />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
      <Square color="dark" />
      <Square color="light" />
    </div>
  );
}
