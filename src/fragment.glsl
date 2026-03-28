#version 300 es
precision mediump float;

uniform float a; // cool ahh variable
uniform vec2 u_resolution;
uniform float hexagonSize;
uniform sampler2D u_vectors;
uniform ivec2 u_gridOrigin;
uniform int u_numCols;
uniform int u_totalVectors;

out vec4 fragColor;

const float PI = 3.1415926535;

float s3(in float t) {
	return t * t * (3. - 2. * t);
}

float s5(in float t) {
	return t * t * t * (t * (t * 6. - 15.) + 10.);
}

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

vec2 getGradient(in ivec2 hexCoord, in int vertexIndex) {
	int col = hexCoord.x - u_gridOrigin.x;
	int row = hexCoord.y - u_gridOrigin.y;
	int vectorIndex = (row * u_numCols + col) * 6 + vertexIndex;
	float u = (float(vectorIndex) + 0.5) / float(u_totalVectors);
	return texture(u_vectors, vec2(u, 0.5)).rg;
}

ivec2 pixelToHex(in vec2 pixel) {
	float q = (sqrt(3.) / 3. * pixel.x - 1. / 3. * pixel.y) / hexagonSize;
	float r = (2. / 3. * pixel.y) / hexagonSize;
	float s = -q - r;

	float rq = round(q);
	float rr = round(r);
	float rs = round(s);

	float qDiff = abs(rq - q);
	float rDiff = abs(rr - r);
	float sDiff = abs(rs - s);

	if (qDiff > rDiff && qDiff > sDiff) {
		rq = -rr - rs;
	} else if (rDiff > sDiff) {
		rr = -rq - rs;
	}

	int column = int(rq) + (int(rr) - (int(rr) & 1)) / 2;
	int row = int(rr);

	return ivec2(column, row);
}

vec2 pixelToRelative(in vec2 worldPixel, in ivec2 hexCoord) {
	float width = sqrt(3.) * hexagonSize;
	float verticalSpacing = 1.5 * hexagonSize;

	float centerX = float(hexCoord.x) * width;
	float centerY = float(hexCoord.y) * verticalSpacing;

	if (mod(float(hexCoord.y), 2.) != 0.) {
		centerX += width * 0.5;
	}

	return worldPixel - vec2(centerX, centerY);
}

void main() {
	vec2 worldPixel = gl_FragCoord.xy;

	ivec2 hexCoord = pixelToHex(worldPixel);
	vec2 relativePoint = pixelToRelative(worldPixel, hexCoord);
	
	vec2[6] lines;
	lines[0] = vec2(0., hexagonSize);
	lines[1] = vec2(0., -hexagonSize);
	lines[2] = vec2(sqrt(3.) / 2. * hexagonSize, 0.5 * hexagonSize);
	lines[3] = vec2(-sqrt(3.) / 2. * hexagonSize, -0.5 * hexagonSize);
	lines[4] = vec2(-sqrt(3.) / 2. * hexagonSize, 0.5 * hexagonSize);
	lines[5] = vec2(sqrt(3.) / 2. * hexagonSize, -0.5 * hexagonSize);
	
	float[6] dotProducts;
	
	for (int i = 0; i < 6; i++) {
		dotProducts[i] = dot(getGradient(hexCoord, i), lines[i] - relativePoint);
	}
	
	float color = 0.;
	float totalWeight = 0.;
	
	for (int i = 0; i < 3; i++) {
		int a = i * 2;
		int b = i * 2 + 1;
		vec2[2] axis;
		axis[0] = lines[a];
		axis[1] = lines[b];
		vec2 proj = pointToLine(relativePoint, axis);
		float dist = distance(proj, relativePoint);
		float fraction = s5(clamp(inverseLerp(lines[a], lines[b], proj), 0., 1.));
		float value = lerp(dotProducts[a], dotProducts[b], fraction);
		float weight = s5(clamp(1. - dist / (sqrt(3.) / 2. * hexagonSize), 0., 1.));
		color += value * weight;
		totalWeight += weight;
	}
	
	color = totalWeight > 0. ? color / totalWeight : 0.;
	color = pow(color, a) / (pow(color, a) + pow(1.0 - color, a));
	fragColor = vec4(vec3(color * 0.5 + 0.5), 1.);
}