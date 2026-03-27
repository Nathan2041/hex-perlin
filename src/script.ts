let canvasSize = 500;
let hexagonSize = 20; // radius

import fragmentShaderSource from './fragment.glsl?raw'
import vertexShaderSource from './vertex.glsl?raw'

function randomNormalVector(): [number, number] {
	let array: [number, number] = [Math.random() * 2 - 1, Math.random() * 2 - 1];
	let magnitude: number = Math.sqrt(array[0] * array[0] + array[1] * array[1]);
	array = array.map((value) => { return value / magnitude }) as [number, number];
	return array
}

function pixelToHex(x: number, y: number): { column: number, row: number } {
	let q = (Math.sqrt(3) / 3 * x - 1 / 3 * y) / hexagonSize;
	let r = (2 / 3 * y) / hexagonSize;
	let s = -q - r;

	let rq = Math.round(q);
	let rr = Math.round(r);
	let rs = Math.round(s);

	let qDiff = Math.abs(rq - q);
	let rDiff = Math.abs(rr - r);
	let sDiff = Math.abs(rs - s);

	if (qDiff > rDiff && qDiff > sDiff) {
		rq = -rr - rs;
	} else if (rDiff > sDiff) {
		rr = -rq - rs;
	}

	let column = rq + (rr - (rr & 1)) / 2;
	let row = rr;

	return { column: column, row: row };
}

let canvas: HTMLCanvasElement = document.querySelector('canvas')!;
canvas.width = canvasSize;
canvas.height = canvasSize;
canvas.style.border = '1px solid black';

let gl: WebGLRenderingContext = canvas.getContext('webgl')!;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader {
	let shader: WebGLShader = gl.createShader(type)!;
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	return shader;
}

let vertexShader: WebGLShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
let fragmentShader: WebGLShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

let program: WebGLProgram = gl.createProgram()!;
gl.attachShader(program, vertexShader);
gl.attachShader(program, fragmentShader);
gl.linkProgram(program);
gl.useProgram(program);

let positionBuffer: WebGLBuffer = gl.createBuffer()!;
gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

let positions: Float32Array = new Float32Array([
	-1, -1,
	 1, -1,
	-1,  1,
	-1,  1,
	 1, -1,
	 1,  1,
]);

gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

let positionLocation: number = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

let hexagonSizeLocation: WebGLUniformLocation = gl.getUniformLocation(program, 'hexagonSize')!;
let hexagonalCoordsLocation: WebGLUniformLocation = gl.getUniformLocation(program, 'hexagonalCoords')!;
let resolutionLocation: WebGLUniformLocation = gl.getUniformLocation(program, 'u_resolution')!;
let vectorsLocation: WebGLUniformLocation = gl.getUniformLocation(program, 'u_vectors')!;

let vectors = new Float32Array(
	Array.from({ length: 6 }, () => randomNormalVector())
		.flatMap(([x, y]) => [x, y])
);

gl.uniform1f(hexagonSizeLocation, hexagonSize);
gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
gl.uniform2iv(hexagonalCoordsLocation, [0, 0]) // ): what to put here
gl.uniform2fv(vectorsLocation, vectors);

gl.clearColor(0, 0, 0, 1);
gl.clear(gl.COLOR_BUFFER_BIT);
gl.drawArrays(gl.TRIANGLES, 0, 6);

if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
	console.error("Link failed: " + gl.getProgramInfoLog(program));
	console.error("VS Log: " + gl.getShaderInfoLog(vertexShader));
	console.error("FS Log: " + gl.getShaderInfoLog(fragmentShader));
}