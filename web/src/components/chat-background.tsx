"use client";

import { useEffect, useRef, useState } from "react";

const vertexShaderSource = `#version 300 es
precision mediump float;
in vec2 position;
uniform vec2 u_resolution;
out vec2 fragCoord;

void main() {
  float x = position.x;
  float y = position.y;
  gl_Position = vec4(x, y, 0.0, 1.0);
  fragCoord = (position.xy + vec2(1.0)) * 0.5 * u_resolution;
  fragCoord.y = u_resolution.y - fragCoord.y;
}
`;

const fragmentShaderSource = `#version 300 es
precision mediump float;
in vec2 fragCoord;

uniform float u_time;
uniform float u_opacities[10];
uniform vec3 u_colors[6];
uniform float u_total_size;
uniform float u_dot_size;
uniform vec2 u_resolution;
uniform int u_reverse;

out vec4 fragColor;

float PHI = 1.61803398874989484820459;

float random(vec2 xy) {
    return fract(tan(distance(xy * PHI, xy) * 0.5) * xy.x);
}

void main() {
    vec2 st = fragCoord.xy;

    st.x -= abs(floor((mod(u_resolution.x, u_total_size) - u_dot_size) * 0.5));
    st.y -= abs(floor((mod(u_resolution.y, u_total_size) - u_dot_size) * 0.5));

    float opacity = step(0.0, st.x);
    opacity *= step(0.0, st.y);

    vec2 st2 = vec2(int(st.x / u_total_size), int(st.y / u_total_size));

    float frequency = 5.0;
    float show_offset = random(st2);
    float rand = random(st2 * floor((u_time / frequency) + show_offset + frequency));

    opacity *= u_opacities[int(rand * 10.0)];
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.x / u_total_size));
    opacity *= 1.0 - step(u_dot_size / u_total_size, fract(st.y / u_total_size));

    vec3 color = u_colors[int(show_offset * 6.0)];

    float animation_speed_factor = 0.5;
    vec2 center_grid = u_resolution / 2.0 / u_total_size;
    float dist_from_center = distance(center_grid, st2);

    float timing_offset_intro = dist_from_center * 0.01 + (random(st2) * 0.15);
    float max_grid_dist = distance(center_grid, vec2(0.0, 0.0));
    float timing_offset_outro = (max_grid_dist - dist_from_center) * 0.02 + (random(st2 + 42.0) * 0.2);

    float current_timing_offset;
    if (u_reverse == 1) {
        current_timing_offset = timing_offset_outro;
        opacity *= 1.0 - step(current_timing_offset, u_time * animation_speed_factor);
        opacity *= clamp((step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
    } else {
        current_timing_offset = timing_offset_intro;
        opacity *= step(current_timing_offset, u_time * animation_speed_factor);
        opacity *= clamp((1.0 - step(current_timing_offset + 0.1, u_time * animation_speed_factor)) * 1.25, 1.0, 1.25);
    }

    fragColor = vec4(color, opacity);
    fragColor.rgb *= fragColor.a;
}
`;

const OPACITIES = [0.05, 0.1, 0.08, 0.15, 0.07, 0.12, 0.09, 0.11, 0.1, 0.06];
const COLORS = [
    0.8, 0.8, 0.8,
    0.7, 0.7, 0.7,
    0.6, 0.6, 0.6,
    0.65, 0.65, 0.65,
    0.75, 0.75, 0.75,
    0.8, 0.8, 0.8,
];

const compileShader = (
    gl: WebGL2RenderingContext,
    type: number,
    source: string
) => {
    const shader = gl.createShader(type);
    if (!shader) throw new Error("Failed to create shader");
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        const message = gl.getShaderInfoLog(shader) ?? "Unknown shader compile error";
        gl.deleteShader(shader);
        throw new Error(message);
    }
    return shader;
};

export function ChatBackground() {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const gl = canvas.getContext("webgl2", {
            alpha: true,
            antialias: false,
            premultipliedAlpha: true,
        });
        if (!gl) {
            console.warn("WebGL2 is unavailable; using static chat background fallback.");
            return;
        }

        let animationFrame: number | null = null;
        let positionBuffer: WebGLBuffer | null = null;
        let program: WebGLProgram | null = null;
        let vertexShader: WebGLShader | null = null;
        let fragmentShader: WebGLShader | null = null;

        try {
            const startTime = performance.now();

            vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
            fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);

            program = gl.createProgram();
            if (!program) throw new Error("Failed to create shader program");
            gl.attachShader(program, vertexShader);
            gl.attachShader(program, fragmentShader);
            gl.linkProgram(program);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw new Error(gl.getProgramInfoLog(program) ?? "Unknown shader link error");
            }

            positionBuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
            gl.bufferData(
                gl.ARRAY_BUFFER,
                new Float32Array([
                    -1, -1,
                    1, -1,
                    -1, 1,
                    -1, 1,
                    1, -1,
                    1, 1,
                ]),
                gl.STATIC_DRAW
            );

            gl.useProgram(program);

            const positionLocation = gl.getAttribLocation(program, "position");
            gl.enableVertexAttribArray(positionLocation);
            gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

            const resolutionLocation = gl.getUniformLocation(program, "u_resolution");
            const timeLocation = gl.getUniformLocation(program, "u_time");
            const opacitiesLocation = gl.getUniformLocation(program, "u_opacities[0]");
            const colorsLocation = gl.getUniformLocation(program, "u_colors[0]");
            const totalSizeLocation = gl.getUniformLocation(program, "u_total_size");
            const dotSizeLocation = gl.getUniformLocation(program, "u_dot_size");
            const reverseLocation = gl.getUniformLocation(program, "u_reverse");

            if (opacitiesLocation) gl.uniform1fv(opacitiesLocation, OPACITIES);
            if (colorsLocation) gl.uniform3fv(colorsLocation, COLORS);
            if (totalSizeLocation) gl.uniform1f(totalSizeLocation, 18.0);
            if (dotSizeLocation) gl.uniform1f(dotSizeLocation, 2.5);
            if (reverseLocation) gl.uniform1i(reverseLocation, 0);

            const resize = () => {
                const dpr = window.devicePixelRatio || 1;
                const width = Math.max(1, Math.floor(canvas.clientWidth * dpr));
                const height = Math.max(1, Math.floor(canvas.clientHeight * dpr));
                if (canvas.width !== width || canvas.height !== height) {
                    canvas.width = width;
                    canvas.height = height;
                }
                gl.viewport(0, 0, canvas.width, canvas.height);
            };

            const draw = () => {
                resize();
                gl.clearColor(0, 0, 0, 0);
                gl.clear(gl.COLOR_BUFFER_BIT);
                if (resolutionLocation) gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
                if (timeLocation) gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000);
                gl.drawArrays(gl.TRIANGLES, 0, 6);
                animationFrame = window.requestAnimationFrame(draw);
            };

            draw();
        } catch (error) {
            console.warn("Failed to initialize chat background shader; using fallback.", error);
        }

        return () => {
            if (animationFrame !== null) window.cancelAnimationFrame(animationFrame);
            if (positionBuffer) gl.deleteBuffer(positionBuffer);
            if (program) gl.deleteProgram(program);
            if (vertexShader) gl.deleteShader(vertexShader);
            if (fragmentShader) gl.deleteShader(fragmentShader);
        };
    }, []);

    return (
        <div className="relative h-full w-full bg-black" aria-hidden="true">
            <canvas 
                ref={canvasRef} 
                className="absolute inset-0 h-full w-full transition-all duration-300 ease-out" 
            />
        </div>
    );
}
