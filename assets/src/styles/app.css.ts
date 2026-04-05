import { style } from '@vanilla-extract/css';

export const container = style({
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: '#f5f5f5',
  fontFamily: 'system-ui, -apple-system, sans-serif',
});

export const title = style({
  fontSize: '2rem',
  fontWeight: 'bold',
  color: '#333',
  marginBottom: '1rem',
});
