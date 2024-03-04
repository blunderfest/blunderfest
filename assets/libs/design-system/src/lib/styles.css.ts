import { style } from '@vanilla-extract/css';
import ColorsHsl from 'open-props/src/props.colors-hsl';

export const container = style({
  padding: 10,
  backgroundColor: `hsl(${ColorsHsl['--choco-10-hsl']})`,
});

export const button = style({
  border: 1,
  fontSize: 'x-large',
});
