import PropTypes from "prop-types";

// million-ignore
export const BlackPawn = ({ title, titleId }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" aria-labelledby={titleId} pointerEvents="none" cursor="grab">
    {title ? <title id={titleId}>{title}</title> : null}
    <path
      pointerEvents="visible"
      d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
      opacity={1}
      fill="#000"
      fillOpacity={1}
      fillRule="nonzero"
      stroke="#000"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="miter"
      strokeMiterlimit={4}
      strokeDasharray="none"
      strokeOpacity={1}
    />
  </svg>
);

BlackPawn.propTypes = {
  title: PropTypes.string.isRequired,
  titleId: PropTypes.string.isRequired,
};
