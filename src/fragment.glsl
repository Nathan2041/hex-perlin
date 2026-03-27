precision mediump float;

uniform vec2 u_resolution;

uniform vec2 u_vectors[6];

uniform ivec2 hexagonalCoords;
uniform float hexagonSize;

const float PI = 3.1415926535;

float lerp(in float a, in float b, in float t) {
	return a * (1. - t) + (b * t);
}

float inverseLerp(in vec2 a, in vec2 b, in vec2 c) {
	return dot(c - a, b - a) / dot(b - a, b - a);
}

vec2 pointToLine(in vec2 point, in vec2[2] line) {
	vec2 AB = line[1] - line[0];
	vec2 AC = point - line[0];
	
	vec2 AD = AB * dot(AB, AC) / dot(AB, AB);
	return line[0] + AD;
}

float distanceInterpolator(in float _distance, in vec2[2] line) {
	float magnitude = distance(line[0], line[1]);
	return lerp(1., 0., _distance / (sqrt(3.) * magnitude / 2. * (1. - PI / 6.))); // interpB
}

vec2 pixelToRelative(in vec2 worldPixel) {
	float width = sqrt(3.) * hexagonSize;
	float verticalSpacing = 1.5 * hexagonSize;

	float centerX = float(hexagonalCoords.x) * width;
	float centerY = float(hexagonalCoords.y) * verticalSpacing;

	if (mod(float(hexagonalCoords.y), 2.) != 0.) {
		centerX += width * 0.5;
	}

	return worldPixel - vec2(centerX, centerY);
}

void main() {
	// vec2 st = gl_FragCoord.xy / u_resolution;
	
	vec2 relativePoint = pixelToRelative(gl_FragCoord.xy);
	
	vec2[6] lines;
	lines[0] = vec2(0., hexagonSize);
	lines[1] = vec2(0., -hexagonSize);                                    // up, down
	lines[2] vec2(sqrt(3.) / 2. * hexagonSize, 0.5 * hexagonSize);
	lines[3] = vec2(-sqrt(3.) / 2. * hexagonSize, -0.5 * hexagonSize); // up right, down left
	lines[4] = vec2(-sqrt(3.) / 2. * hexagonSize, 0.5 * hexagonSize);
	lines[5] = vec2(sqrt(3.) / 2. * hexagonSize, -0.5 * hexagonSize);  // up left, down right
	
	float[6] dotProducts;
	
	for (int i = 0; i < 6; i++) {
		dotProducts[i] = dot(u_vectors[i], lines[i] - relativePoint);
	}
	
	vec2[3] points;
	float[3] distances;
	float[3] values;
	float color = 0.;
	
	for (int i = 0; i < 3; i++) {
		points[i] = pointToLine(relativePoint, [lines[i], lines[i + 1]]);
		distances[i] = distance(points[i], relativePoint);
		float fraction = inverseLerp(lines[i], lines[i + 3], points[i]);
		values[i] = lerp(dotProducts[i], dotProducts[i + 3], fraction); // interpA
		color += distanceInterpolator(distances[i], lines[i]); // TODO: `value` not used?
	}
	
	gl_FragColor = vec4(vec3(color / 3.), 1.);
}