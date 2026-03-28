let aValues        = [2, -2.5, -5000, -20000, 100, 1000];
let hexagonSize    = 16.935;
let driftSpeed     = 0.4;
let gridPadding    = 3;

import fragmentShaderSource from './fragment.glsl?raw'
import vertexShaderSource from './vertex.glsl?raw'

function randomNormalVector(): [number, number] {
	let v: [number, number] = [Math.random() * 2 - 1, Math.random() * 2 - 1];
	let magnitude = Math.sqrt(v[0] ** 2 + v[1] ** 2);
	return [v[0] / magnitude, v[1] / magnitude];
}

function pixelToHex(x: number, y: number): { column: number, row: number } {
	let q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / hexagonSize;
	let r = (2 / 3 * y) / hexagonSize;
	let s = -q - r;
	let rq = Math.round(q), rr = Math.round(r), rs = Math.round(s);
	let qDiff = Math.abs(rq - q), rDiff = Math.abs(rr - r), sDiff = Math.abs(rs - s);
	if (qDiff > rDiff && qDiff > sDiff) rq = -rr - rs;
	else if (rDiff > sDiff) rr = -rq - rs;
	return { column: rq + (rr - (rr & 1)) / 2, row: rr };
}

function hexCenter(col: number, row: number): [number, number] {
	let width = Math.sqrt(3) * hexagonSize;
	let cx = col * width;
	let cy = row * 1.5 * hexagonSize;
	if (row % 2 !== 0) cx += width * 0.5;
	return [cx, cy];
}

function vertexKey(wx: number, wy: number): string {
	return `${Math.round(wx / hexagonSize * 1000)},${Math.round(wy / hexagonSize * 1000)}`;
}

let vertexOffsets: [number, number][] = [
	[0, 1], [0, -1],
	[Math.sqrt(3) / 2, 0.5],  [-Math.sqrt(3) / 2, -0.5],
	[-Math.sqrt(3) / 2, 0.5], [Math.sqrt(3) / 2,  -0.5],
];

let canvas: HTMLCanvasElement = document.querySelector('canvas')!;
canvas.style.display  = 'block';
canvas.style.position = 'fixed';
canvas.style.top      = '0';
canvas.style.left     = '0';
canvas.style.width    = '100vw';
canvas.style.height   = '100vh';
document.body.style.margin   = '0';
document.body.style.overflow = 'hidden';

let gl = canvas.getContext('webgl2')!;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	let shader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

let vertexShader   = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
let fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
let program        = gl.createProgram()!;
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

let positionBuffer = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
let positionLocation = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

let hexagonSizeLocation  = gl.getUniformLocation(program, 'hexagonSize')!;
let resolutionLocation   = gl.getUniformLocation(program, 'u_resolution')!;
let vectorsLocation      = gl.getUniformLocation(program, 'u_vectors')!;
let gridOriginLocation   = gl.getUniformLocation(program, 'u_gridOrigin')!;
let numColsLocation      = gl.getUniformLocation(program, 'u_numCols')!;
let totalVectorsLocation = gl.getUniformLocation(program, 'u_totalVectors')!;
let aLocation            = gl.getUniformLocation(program, 'a')!;

gl.uniform1f(hexagonSizeLocation, hexagonSize);
gl.uniform1i(vectorsLocation, 0);

let gradientMap   = new Map<string, [number, number]>();
let driftMap      = new Map<string, number>();
let driftSpeedMap = new Map<string, number>();

let gridMin    = [0, 0];
let gridMax    = [0, 0];
let numCols    = 0;
let numRows    = 0;
let totalVectors = 0;
let vectorData: Float32Array = new Float32Array(0);
let vectorTexture: WebGLTexture = gl.createTexture()!;

function buildGrid() {
	let w = canvas.width, h = canvas.height;
	let worldCorners: [number, number][] = [
		[0, 0],
		[w, 0],
		[0, h],
		[w, h],
	];
	let hexCorners = worldCorners.map(([x, y]) => pixelToHex(x, y));
	let minCol = Math.min(...hexCorners.map(h => h.column)) - gridPadding;
	let minRow = Math.min(...hexCorners.map(h => h.row)) - gridPadding;
	let maxCol = Math.max(...hexCorners.map(h => h.column)) + gridPadding;
	let maxRow = Math.max(...hexCorners.map(h => h.row)) + gridPadding;

	gridMin = [minCol, minRow];
	gridMax = [maxCol, maxRow];
	numCols      = maxCol - minCol + 1;
	numRows      = maxRow - minRow + 1;
	totalVectors = numCols * numRows * 6;
	vectorData   = new Float32Array(totalVectors * 2);

	for (let row = minRow; row <= maxRow; row++) {
		for (let col = minCol; col <= maxCol; col++) {
			let center   = hexCenter(col, row);
			let hexIndex = (row - minRow) * numCols + (col - minCol);
			for (let v = 0; v < 6; v++) {
				let wx  = center[0] + vertexOffsets[v][0] * hexagonSize;
				let wy  = center[1] + vertexOffsets[v][1] * hexagonSize;
				let key = vertexKey(wx, wy);
				if (!gradientMap.has(key)) {
					gradientMap.set(key, randomNormalVector());
					driftSpeedMap.set(key, (Math.random() - 0.5) * driftSpeed);
					driftMap.set(key, 0);
				}
				let g = gradientMap.get(key)!;
				let i = (hexIndex * 6 + v) * 2;
				vectorData[i]     = g[0];
				vectorData[i + 1] = g[1];
			}
		}
	}

	gl.bindTexture(gl.TEXTURE_2D, vectorTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, totalVectors, 1, 0, gl.RG, gl.FLOAT, vectorData);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	gl.uniform2i(gridOriginLocation, minCol, minRow);
	gl.uniform1i(numColsLocation, numCols);
	gl.uniform1i(totalVectorsLocation, totalVectors);
}

function updateVectorDrift(dt: number) {
	for (let row = gridMin[1]; row <= gridMax[1]; row++) {
		for (let col = gridMin[0]; col <= gridMax[0]; col++) {
			let center   = hexCenter(col, row);
			let hexIndex = (row - gridMin[1]) * numCols + (col - gridMin[0]);
			for (let v = 0; v < 6; v++) {
				let wx    = center[0] + vertexOffsets[v][0] * hexagonSize;
				let wy    = center[1] + vertexOffsets[v][1] * hexagonSize;
				let key   = vertexKey(wx, wy);
				let base  = gradientMap.get(key)!;
				let speed = driftSpeedMap.get(key)!;
				let drift = (driftMap.get(key) ?? 0) + speed * dt;
				driftMap.set(key, drift);
				let cos = Math.cos(drift), sin = Math.sin(drift);
				let i   = (hexIndex * 6 + v) * 2;
				vectorData[i]     = base[0] * cos - base[1] * sin;
				vectorData[i + 1] = base[0] * sin + base[1] * cos;
			}
		}
	}
	gl.bindTexture(gl.TEXTURE_2D, vectorTexture);
	gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, totalVectors, 1, gl.RG, gl.FLOAT, vectorData);
}

function smoothstep(t: number): number {
	return t * t * (3 - 2 * t);
}

let aValue = aValues[Math.floor(Math.random() * aValues.length)];

canvas.width  = window.innerWidth;
canvas.height = window.innerHeight;
gl.viewport(0, 0, canvas.width, canvas.height);
gl.uniform2f(resolutionLocation, canvas.width, canvas.height);

buildGrid();

let lastTime = 0;

function render(timestamp: number) {
	let dt = Math.min((timestamp - lastTime) / 1000, 0.1);
	lastTime = timestamp;

	updateVectorDrift(dt);

	gl.uniform1f(aLocation, aValue);

	gl.clear(gl.COLOR_BUFFER_BIT);
	gl.drawArrays(gl.TRIANGLES, 0, 6);

	requestAnimationFrame(render);
}

requestAnimationFrame(render);