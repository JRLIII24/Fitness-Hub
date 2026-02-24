export function encodePolyline(
  points: Array<{ lat: number; lng: number }>
): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  const encodeValue = (value: number): string => {
    let v = Math.round(value * 1e5);
    v = v < 0 ? ~(v << 1) : v << 1;
    let result = "";
    while (v >= 0x20) {
      result += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    result += String.fromCharCode(v + 63);
    return result;
  };

  for (const point of points) {
    encoded += encodeValue(point.lat - prevLat);
    encoded += encodeValue(point.lng - prevLng);
    prevLat = point.lat;
    prevLng = point.lng;
  }

  return encoded;
}

export function decodePolyline(
  encoded: string
): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export function decimatePoints(
  points: Array<{ lat: number; lng: number }>,
  targetMaxPoints = 500
): Array<{ lat: number; lng: number }> {
  if (points.length <= targetMaxPoints) return points;
  const step = Math.floor(points.length / targetMaxPoints);
  return points.filter((_, i) => i % step === 0 || i === points.length - 1);
}
