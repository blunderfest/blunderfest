import { Box } from "@blunderfest/design-system/styled-system/jsx";
import { square } from "@blunderfest/ui/recipes";
import PropTypes from "prop-types";

/**
 *
 * @param {{
 *    file: number,
 *    rank: number,
 * }} props
 * @returns
 */
export function Square(props) {
  const { file, rank } = props;

  const classes = square({
    color: file % 2 === rank % 2 ? "dark" : "light",
  });

  return (
    <Box className={classes.root} tabIndex={0} data-file={file} data-rank={rank}>
      <Box className={classes.overlay} tabIndex={-1}>
        {String.fromCharCode(65 + file)} {rank + 1}
      </Box>
      <Box className={classes.selected} tabIndex={-1}></Box>

      <Box className={classes.piece}>
        {(file === 4 || file === 1) && rank === 1 && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 45 45"
            width="100%"
            height="100%"
            pointerEvents="none"
            style={{
              cursor: "pointer",
              pointerEvents: "none",
            }}>
            <g
              pointerEvents="visible"
              fill="none"
              fillRule="evenodd"
              stroke="#000"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="1.5">
              <path strokeLinejoin="miter" d="M22.5 11.63V6M20 8h5" />
              <path
                fill="#fff"
                strokeLinecap="butt"
                strokeLinejoin="miter"
                d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
              />
              <path
                fill="#fff"
                d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
              />
              <path d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
            </g>
          </svg>
        )}
        {(file === 4 || file === 1) && rank === 7 && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 45 45"
            width="100%"
            height="100%"
            pointerEvents="none"
            style={{
              cursor: "pointer",
            }}>
            <g
              pointerEvents="visible"
              style={{
                fill: "none",
                fillOpacity: 1,
                fillRule: "evenodd",
                stroke: "#000",
                strokeWidth: 1.5,
                strokeLinecap: "round",
                strokeLinejoin: "round",
                strokeMiterlimit: 4,
                strokeDasharray: "none",
                strokeOpacity: 1,
              }}>
              <path
                d="M22.5 11.63V6"
                style={{
                  fill: "none",
                  stroke: "#000",
                  strokeLinejoin: "miter",
                }}
              />
              <path
                d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"
                style={{
                  fill: "#000",
                  fillOpacity: 1,
                  strokeLinecap: "butt",
                  strokeLinejoin: "miter",
                }}
              />
              <path
                d="M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7"
                style={{
                  fill: "#000",
                  stroke: "#000",
                }}
              />
              <path
                d="M20 8h5"
                style={{
                  fill: "none",
                  stroke: "#000",
                  strokeLinejoin: "miter",
                }}
              />
              <path
                d="M32 29.5s8.5-4 6.03-9.65C34.15 14 25 18 22.5 24.5v2.1-2.1C20 18 10.85 14 6.97 19.85 4.5 25.5 13 29.5 13 29.5"
                style={{
                  fill: "none",
                  stroke: "#fff",
                }}
              />
              <path
                d="M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0"
                style={{
                  fill: "none",
                  stroke: "#fff",
                }}
              />
            </g>
          </svg>
        )}
      </Box>
    </Box>
  );
}

Square.propTypes = {
  file: PropTypes.number.isRequired,
  rank: PropTypes.number.isRequired,
};
