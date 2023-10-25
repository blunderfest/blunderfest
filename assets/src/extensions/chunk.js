/**
 * @template T
 * @param {T[]} array
 * @param {number} chunkSize
 */
export function chunk(array, chunkSize) {
  const length = Math.ceil(array.length / chunkSize);
  const chunks = new Array(length).fill(0);

  return chunks.map((_, index) => {
    const start = index * chunkSize;
    const end = (index + 1) * chunkSize;
    return array.slice(start, end);
  });
}
