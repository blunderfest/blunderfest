import PropTypes from "prop-types";

// million-ignore
export const BlackKnight = ({ title, titleId }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 45 45"
    aria-labelledby={titleId}
    width="100%"
    height="100%"
    pointerEvents="none"
    cursor="pointer">
    {title ? <title id={titleId}>{title}</title> : null}
    <g
      pointerEvents="visible"
      opacity={1}
      fill="none"
      fillOpacity={1}
      fillRule="evenodd"
      stroke="#000"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeMiterlimit={4}
      strokeDasharray="none"
      strokeOpacity={1}>
      <path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21" fill="#000" stroke="#000" transform="translate(0 .3)" />
      <path
        d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"
        fill="#000"
        stroke="#000"
        transform="translate(0 .3)"
      />
      <path d="M9.5 25.5a.5.5 0 1 1-1 0 .5.5 0 1 1 1 0z" fill="#fff" stroke="#fff" transform="translate(0 .3)" />
      <path d="M15 15.5a.5 1.5 0 1 1-1 0 .5 1.5 0 1 1 1 0z" fill="#fff" stroke="#fff" transform="rotate(30 13.94 15.65)" />
      <path
        stroke="none"
        d="m24.55 10.4-.45 1.45.5.15c3.15 1 5.65 2.49 7.9 6.75S35.75 29.06 35.25 39l-.05.5h2.25l.05-.5c.5-10.06-.88-16.85-3.25-21.34-2.37-4.49-5.79-6.64-9.19-7.16l-.51-.1z"
        fill="#fff"
        transform="translate(0 .3)"
      />
    </g>
  </svg>
);

BlackKnight.propTypes = {
  title: PropTypes.string.isRequired,
  titleId: PropTypes.string.isRequired,
};
