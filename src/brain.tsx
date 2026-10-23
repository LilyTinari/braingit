import { useEffect, useRef } from "react";
import * as THREE from "three";

function fold(x: number, y: number, z: number): { p: [number, number, number]; ridge: number } {
  const r = Math.hypot(x, y, z) || 1;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;
  const lobe = nx >= 0 ? 1 : -1;
  const band = Math.sin(ny * 16 + nx * 2.4);
  const cross = Math.sin(nz * 9 + nx * lobe * 4);
  const ridge = Math.pow(Math.abs(band), 0.55) * (0.65 + 0.35 * Math.abs(cross));
  const g = 1 + 0.05 * band + 0.022 * cross;
  let px = nx * 0.9 * g + lobe * 0.1;
  let py = ny * 0.84 * g * (ny < -0.15 ? 0.9 : 1);
  let pz = nz * 0.6 * g;
  const fiss = Math.exp(-px * px * 55) * 0.06;
  px += Math.sign(px || lobe) * fiss;
  if (ny < -0.28 && nz > 0.05) {
    const k = Math.min(1, (-0.28 - ny) * 2.2);
    py -= 0.1 * k;
    pz += 0.1 * k;
    px *= 1 - 0.18 * k;
  }
  return { p: [px, py, pz], ridge };
}

const cortexVert = /* glsl */ `
  attribute float aRidge;
  uniform float uTime;
  uniform float uEase;
  varying float vRidge;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vRidge = aRidge;
    vec3 n = normalize(normal);
    float breath = sin(uTime * 0.55 + position.y * 4.0) * 0.01 * uEase;
    vec3 settled = position + n * breath;
    vec3 line = vec3(position.x * 1.15, position.y, 0.0);
    vec3 p = mix(line, settled, uEase);
    vec4 world = modelMatrix * vec4(p, 1.0);
    vWorld = world.xyz;
    vN = normalize(normalMatrix * n);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const cortexFrag = /* glsl */ `
  varying float vRidge;
  varying vec3 vN;
  varying vec3 vWorld;
  void main() {
    vec3 n = normalize(vN);
    vec3 viewDir = normalize(cameraPosition - vWorld);
    float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 1.65);
    float lamp = clamp(dot(n, normalize(vec3(-0.25, 0.8, 0.45))) * 0.55 + 0.45, 0.0, 1.0);
    vec3 ink = vec3(0.035, 0.025, 0.015);
    vec3 gold = vec3(0.83, 0.6, 0.24);
    vec3 body = mix(ink, vec3(0.28, 0.17, 0.05), lamp);
    body = mix(body, gold, vRidge * lamp * 0.8);
    vec3 col = body + gold * fres * (0.25 + vRidge * 0.85);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const pointVert = /* glsl */ `
  attribute float aSeed;
  uniform float uTime;
  uniform float uEase;
  uniform float uSoft;
  varying float vAlpha;
  void main() {
    float row = fract(aSeed * 13.0);
    float indent = fract(aSeed * 7.0);
    vec3 line = vec3(-0.7 + indent * 1.4, (row - 0.5) * 1.7, 0.0);
    vec3 p = mix(line, position, uEase);
    float pulse = 0.85 + 0.15 * sin(uTime * (0.4 + aSeed) + aSeed * 12.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp((2.2 + aSeed * 2.4) * pulse * (160.0 / -mv.z), 1.0, 7.0);
    gl_Position = projectionMatrix * mv;
    float ndcY = gl_Position.y / gl_Position.w;
    float low = smoothstep(0.15, -0.9, ndcY);
    vAlpha = (0.25 + uEase * 0.55) * pulse * mix(1.0, 0.2, low * uSoft);
  }
`;

const pointFrag = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;
    float core = exp(-r * 10.0);
    vec3 gold = vec3(0.93, 0.78, 0.42);
    gl_FragColor = vec4(gold, core * vAlpha);
  }
`;

export function RepoBrain({
  className,
  count = 900,
  assembled = false,
  hint = false,
  soften = false,
}: {
  className?: string;
  count?: number;
  assembled?: boolean;
  hint?: boolean;
  soften?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const repo = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const view = canvas.current;
    const host = root.current;
    const sheet = repo.current;
    if (!view || !host || !sheet) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({
      canvas: view,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(0x000000, 0);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 20);
    camera.position.z = 3.35;
    const group = new THREE.Group();
    scene.add(group);

    const easeUniform = { value: assembled || still ? 1 : 0 };
    const shell = new THREE.IcosahedronGeometry(1, 4);
    const pos = shell.attributes.position as THREE.BufferAttribute;
    const base = new Float32Array(pos.array);
    const ridges = new Float32Array(pos.count);
    for (let i = 0; i < pos.count; i++) {
      const shaped = fold(base[i * 3]!, base[i * 3 + 1]!, base[i * 3 + 2]!);
      pos.setXYZ(i, shaped.p[0], shaped.p[1], shaped.p[2]);
      ridges[i] = shaped.ridge;
    }
    shell.setAttribute("aRidge", new THREE.BufferAttribute(ridges, 1));
    shell.computeVertexNormals();
    const shellMat = new THREE.ShaderMaterial({
      vertexShader: cortexVert,
      fragmentShader: cortexFrag,
      side: THREE.FrontSide,
      uniforms: {
        uTime: { value: 0 },
        uEase: easeUniform,
      },
    });
    group.add(new THREE.Mesh(shell, shellMat));

    const n = Math.min(Math.round(count * 0.28), 320);
    const positions = new Float32Array(n * 3);
    const seeds = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const src = (i * 17) % pos.count;
      const shaped = fold(base[src * 3]!, base[src * 3 + 1]!, base[src * 3 + 2]!);
      const lift = shaped.ridge > 0.45 ? 1.03 : 0.96;
      positions[i * 3] = shaped.p[0] * lift;
      positions[i * 3 + 1] = shaped.p[1] * lift;
      positions[i * 3 + 2] = shaped.p[2] * lift;
      seeds[i] = (i * 0.618) % 1;
    }
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    const pointMat = new THREE.ShaderMaterial({
      vertexShader: pointVert,
      fragmentShader: pointFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uEase: easeUniform,
        uSoft: { value: soften ? 1 : 0 },
      },
    });
    group.add(new THREE.Points(pointsGeo, pointMat));

    const drag = { x: 0.35, y: 0.08 };
    const born = performance.now();
    let alive = true;
    let frame = 0;
    let visible = true;
    let pointer = 0;
    let axis: "" | "x" | "y" = "";
    let origin = { x: 0, y: 0, yaw: drag.x, pitch: drag.y };

    const resize = () => {
      const w = view.clientWidth;
      const h = view.clientHeight;
      if (w < 2 || h < 2) return;
      const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 1.75);
      renderer.setPixelRatio(dpr);
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const observed = new ResizeObserver(resize);
    observed.observe(view);
    const seen = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) frame = requestAnimationFrame(draw);
    });
    seen.observe(host);

    const draw = (now: number) => {
      if (!alive) return;
      const raw = still || assembled ? 1 : Math.min(1, Math.max(0, (now - born - 600) / 1800));
      const ease = raw * raw * (3 - 2 * raw);
      easeUniform.value = ease;
      const t = still ? 0 : now * 0.001;
      shellMat.uniforms.uTime!.value = t;
      pointMat.uniforms.uTime!.value = t;
      sheet.style.setProperty("--ease", ease.toFixed(3));
      group.rotation.y += ((drag.x + (still ? 0 : now * 0.00006)) - group.rotation.y) * 0.12;
      group.rotation.x += (drag.y - group.rotation.x) * 0.12;
      renderer.render(scene, camera);
      if (visible) frame = requestAnimationFrame(draw);
    };

    const onDown = (event: PointerEvent) => {
      pointer = event.pointerId;
      axis = "";
      origin = { x: event.clientX, y: event.clientY, yaw: drag.x, pitch: drag.y };
    };
    const onMove = (event: PointerEvent) => {
      if (pointer !== event.pointerId) return;
      if (event.pointerType === "mouse" && event.buttons === 0) return;
      const dx = event.clientX - origin.x;
      const dy = event.clientY - origin.y;
      if (!axis) {
        if (Math.hypot(dx, dy) < 10) return;
        axis = Math.abs(dx) > Math.abs(dy) * 1.25 ? "x" : "y";
        if (axis === "y") {
          pointer = 0;
          return;
        }
        sheet.classList.add("turned");
        try {
          view.setPointerCapture(event.pointerId);
        } catch {
          /* the repo still turns without capture */
        }
      }
      if (axis !== "x") return;
      drag.x = origin.yaw + dx * 0.008;
      if (event.pointerType !== "touch") {
        drag.y = Math.max(-0.45, Math.min(0.45, origin.pitch + dy * 0.003));
      }
    };
    const onUp = () => {
      pointer = 0;
      axis = "";
    };
    view.addEventListener("pointerdown", onDown);
    view.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    frame = requestAnimationFrame(draw);

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observed.disconnect();
      seen.disconnect();
      view.removeEventListener("pointerdown", onDown);
      view.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      shell.dispose();
      pointsGeo.dispose();
      shellMat.dispose();
      pointMat.dispose();
      renderer.dispose();
    };
  }, [assembled, count, soften]);

  return (
    <div className={className ?? "repo-brain"} ref={root}>
      <div className="repo" ref={repo}>
        <div className="repo-bar">
          <span className="branch">fix/stale-session</span>
          <span className="path">src/auth/session.ts</span>
          <span className="status">Brain</span>
        </div>
        <span className="gutter" />
        <canvas ref={canvas} aria-hidden="true" />
        {hint ? (
          <p className="turn-hint">
            <span className="chev" aria-hidden="true">
              ←
            </span>
            Drag to turn
            <span className="chev" aria-hidden="true">
              →
            </span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function Mark() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden="true">
      <ellipse cx="8" cy="11" rx="4.2" ry="5.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <ellipse cx="14" cy="11" rx="4.2" ry="5.4" fill="none" stroke="currentColor" strokeWidth="1.2" />
      <path d="M8 8.5c1.2.4 2 .4 3 0M8 13.5c1.2-.4 2-.4 3 0" fill="none" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}
