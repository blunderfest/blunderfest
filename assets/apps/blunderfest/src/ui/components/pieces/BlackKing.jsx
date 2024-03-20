import PropTypes from "prop-types";

// million-ignore
export const BlackKing = ({ title, titleId }) => (
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
      <path d="M22.5 11.63V6" fill="none" stroke="#000" strokeLinejoin="miter" />
      <path
        d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
        fill="#000"
        fillOpacity={1}
        strokeLinecap="butt"
        strokeLinejoin="miter"
      />
      <path
        d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
        fill="#000"
        stroke="#000"
      />
      <path d="M20 8h5" fill="none" stroke="#000" strokeLinejoin="miter" />
      <path
        d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5v2.1-2.1C20 18 10.85 14 6.97 19.85 4.5 25.5 13 29.5 13 29.5"
        fill="none"
        stroke="#fff"
      />
      <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" fill="none" stroke="#fff" />
    </g>
  </svg>
);

BlackKing.propTypes = {
  title: PropTypes.string.isRequired,
  titleId: PropTypes.string.isRequired,
};
