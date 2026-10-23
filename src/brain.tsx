import { useEffect, useRef } from "react";
import * as THREE from "three";

function cortex(x: number, y: number, z: number): [number, number, number] {
  const r = Math.hypot(x, y, z) || 1;
  const nx = x / r;
  const ny = y / r;
  const nz = z / r;
  const theta = Math.atan2(nz, nx);
  const phi = Math.acos(Math.max(-1, Math.min(1, ny)));
  const g =
    1 +
    0.045 * Math.sin(theta * 5 + phi * 2) +
    0.038 * Math.sin(phi * 4.5) +
    0.02 * Math.sin(theta * 9 + phi * 3);
  const lobe = nx >= 0 ? 1 : -1;
  let px = nx * 0.9 * g + lobe * 0.1;
  let py = ny * 0.98 * g * (ny < -0.05 ? 0.84 : 1);
  let pz = nz * 0.76 * g;
  if (py < 0.08 && pz > 0.05) py -= 0.07;
  const fiss = Math.exp(-px * px * 36) * 0.045;
  px += Math.sign(px || lobe) * fiss;
  py -= fiss * 0.35;
  return [px, py, pz];
}

const pointVert = /* glsl */ `
  attribute float aSeed;
  attribute float aRind;
  uniform float uTime;
  uniform float uEase;
  uniform float uSoft;
  varying float vAlpha;
  varying float vRind;
  void main() {
    vRind = aRind;
    float row = fract(aSeed * 11.0);
    float indent = fract(aSeed * 5.0);
    vec3 line = vec3(-0.72 + indent * 1.35, (row - 0.5) * 2.05, 0.02);
    vec3 p = mix(line, position, uEase);
    float pulse = 0.9 + 0.1 * sin(uTime * (0.45 + aSeed) + aSeed * 14.0);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    float alpha = (0.45 + uEase * 0.55) * pulse * (aRind > 1.5 ? 0.55 : 1.0);
    float size = aRind > 1.5 ? 34.0 : mix(3.4, 7.2, aRind);
    gl_PointSize = clamp(size * pulse * (190.0 / -mv.z), 1.0, aRind > 1.5 ? 60.0 : 11.0);
    gl_Position = projectionMatrix * mv;
    float ndcY = gl_Position.y / gl_Position.w;
    float low = smoothstep(0.2, -0.95, ndcY);
    vAlpha = alpha * mix(1.0, 0.22, low * uSoft);
  }
`;

const pointFrag = /* glsl */ `
  varying float vAlpha;
  varying float vRind;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;
    float core = exp(-r * 8.0);
    float halo = exp(-r * 2.2);
    vec3 ivory = vec3(0.98, 0.92, 0.74);
    vec3 neural = vec3(0.78, 0.55, 0.16);
    vec3 col = mix(neural, ivory, core * mix(0.35, 0.85, vRind));
    gl_FragColor = vec4(col, (core * 0.62 + halo * 0.2) * vAlpha);
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
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    camera.position.z = 3.7;
    const group = new THREE.Group();
    scene.add(group);

    const easeUniform = { value: assembled || still ? 1 : 0 };
    const n = Math.min(count, 1500);
    const positions = new Float32Array((n + 2) * 3);
    const seeds = new Float32Array(n + 2);
    const rinds = new Float32Array(n + 2);
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963;
      const rind = i % 5 === 0;
      const p = cortex(Math.cos(theta) * ring, y, Math.sin(theta) * ring);
      const depth = rind ? 1.02 : 0.9 + ((i * 0.17) % 1) * 0.08;
      positions[i * 3] = p[0] * depth;
      positions[i * 3 + 1] = p[1] * depth;
      positions[i * 3 + 2] = p[2] * depth;
      seeds[i] = (i * 0.618) % 1;
      rinds[i] = rind ? 1 : 0;
    }
    positions[n * 3] = -0.42;
    positions[n * 3 + 1] = 0.05;
    positions[n * 3 + 2] = 0.1;
    positions[(n + 1) * 3] = 0.42;
    positions[(n + 1) * 3 + 1] = 0.05;
    positions[(n + 1) * 3 + 2] = 0.1;
    rinds[n] = 2;
    rinds[n + 1] = 2;
    seeds[n] = 0.2;
    seeds[n + 1] = 0.8;
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    pointsGeo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    pointsGeo.setAttribute("aRind", new THREE.BufferAttribute(rinds, 1));
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

    const tractPos: number[] = [];
    for (let t = 0; t < 16; t++) {
      const a = (t * 53) % n;
      const b = (t * 91 + 20) % n;
      if (positions[a * 3]! * positions[b * 3]! > 0 && t % 2 === 0) continue;
      for (let s = 0; s < 12; s++) {
        const u0 = s / 12;
        const u1 = (s + 1) / 12;
        const lift = (u: number) => Math.sin(u * Math.PI) * 0.08;
        tractPos.push(
          positions[a * 3]! + (positions[b * 3]! - positions[a * 3]!) * u0,
          positions[a * 3 + 1]! + (positions[b * 3 + 1]! - positions[a * 3 + 1]!) * u0 + lift(u0),
          positions[a * 3 + 2]! + (positions[b * 3 + 2]! - positions[a * 3 + 2]!) * u0,
          positions[a * 3]! + (positions[b * 3]! - positions[a * 3]!) * u1,
          positions[a * 3 + 1]! + (positions[b * 3 + 1]! - positions[a * 3 + 1]!) * u1 + lift(u1),
          positions[a * 3 + 2]! + (positions[b * 3 + 2]! - positions[a * 3 + 2]!) * u1,
        );
      }
    }
    const tractGeo = new THREE.BufferGeometry();
    tractGeo.setAttribute("position", new THREE.Float32BufferAttribute(tractPos, 3));
    const tractMat = new THREE.LineBasicMaterial({
      color: 0xd4b06a,
      transparent: true,
      opacity: 0.28,
    });
    group.add(new THREE.LineSegments(tractGeo, tractMat));

    const drag = { x: 0.5, y: 0.12 };
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
      const dpr = Math.min(window.devicePixelRatio || 1, w < 700 ? 1.5 : 2);
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
      pointMat.uniforms.uTime!.value = still ? 0 : now * 0.001;
      tractMat.opacity = 0.3 * ease;
      sheet.style.setProperty("--ease", ease.toFixed(3));
      host.style.setProperty("--ease", ease.toFixed(3));
      host.style.setProperty("--yaw", `${(drag.x - 0.5) * 0.45}rad`);
      group.rotation.y += ((drag.x + (still ? 0 : now * 0.00008)) - group.rotation.y) * 0.12;
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
        drag.y = Math.max(-0.55, Math.min(0.55, origin.pitch + dy * 0.003));
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
      pointsGeo.dispose();
      tractGeo.dispose();
      pointMat.dispose();
      tractMat.dispose();
      renderer.dispose();
    };
  }, [assembled, count, soften]);

  return (
    <div className={className ?? "repo-brain"} ref={root}>
      <img className="brain-plate" src="/gold-brain.jpg" alt="" />
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
