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

const flowVert = /* glsl */ `
  attribute vec3 aFrom;
  attribute vec3 aTo;
  attribute float aStart;
  attribute float aDur;
  uniform float uClock;
  varying float vAlpha;
  void main() {
    float t = clamp((uClock - aStart) / aDur, 0.0, 1.0);
    float s = t * t * (3.0 - 2.0 * t);
    vec3 p = mix(aFrom, aTo, s);
    p.x += sin(s * 3.14159) * 0.05;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = clamp(6.0 * (165.0 / -mv.z), 1.5, 11.0);
    gl_Position = projectionMatrix * mv;
    float show = step(aStart - 0.02, uClock);
    vAlpha = show * smoothstep(0.0, 0.1, t) * (1.0 - smoothstep(0.8, 1.0, t));
  }
`;

const flowFrag = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r = dot(uv, uv);
    if (r > 1.0) discard;
    float core = exp(-r * 7.0);
    gl_FragColor = vec4(vec3(0.95, 0.8, 0.46), core * vAlpha);
  }
`;

const fileVert = /* glsl */ `
  attribute float aDelay;
  uniform float uClock;
  varying float vAlpha;
  void main() {
    float born = smoothstep(aDelay, aDelay + 0.16, uClock);
    float gone = 1.0 - smoothstep(1.05, 1.4, uClock);
    vAlpha = born * gone;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fileFrag = /* glsl */ `
  varying float vAlpha;
  void main() {
    gl_FragColor = vec4(vec3(0.86, 0.66, 0.3), vAlpha * 0.9);
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
  const caption = useRef<HTMLParagraphElement>(null);

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
    const lobe = (i: number, total: number): [number, number, number] => {
      const y = 1 - (i / Math.max(1, total - 1)) * 2;
      const ring = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = i * 2.399963;
      return fold(Math.cos(theta) * ring, y * 0.9, Math.sin(theta) * ring).p;
    };

    const rings = new THREE.Group();
    const ringGeos: THREE.BufferGeometry[] = [];
    const ringMats: THREE.Material[] = [];
    const addRing = (rx: number, ry: number, tilt: number, color: number, nodes: number) => {
      const linePos: number[] = [];
      const nodePos: number[] = [];
      const steps = 80;
      const every = Math.max(1, Math.floor(steps / nodes));
      for (let i = 0; i <= steps; i++) {
        const a = (i / steps) * Math.PI * 2;
        const x = Math.cos(a) * rx;
        const y = Math.sin(a) * ry;
        const z = Math.sin(a * 2) * 0.28;
        const cy = y * Math.cos(tilt) - z * Math.sin(tilt);
        const cz = y * Math.sin(tilt) + z * Math.cos(tilt);
        linePos.push(x, cy, cz);
        if (i % every === 0) nodePos.push(x, cy, cz);
      }
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute("position", new THREE.Float32BufferAttribute(linePos, 3));
      const lineMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.28 });
      rings.add(new THREE.Line(lineGeo, lineMat));
      const nodeGeo = new THREE.BufferGeometry();
      nodeGeo.setAttribute("position", new THREE.Float32BufferAttribute(nodePos, 3));
      const nodeMat = new THREE.PointsMaterial({
        color,
        size: 0.055,
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
        sizeAttenuation: true,
      });
      rings.add(new THREE.Points(nodeGeo, nodeMat));
      ringGeos.push(lineGeo, nodeGeo);
      ringMats.push(lineMat, nodeMat);
    };
    addRing(1.42, 1.05, 0.55, 0x3ecfc6, 16);
    addRing(1.62, 1.22, -0.7, 0xe2b15a, 18);
    addRing(1.15, 1.48, 1.15, 0x7ee7ef, 12);
    group.add(rings);

    const playStory = !assembled && !still;
    const flowCount = 168;
    const froms = new Float32Array(flowCount * 3);
    const tos = new Float32Array(flowCount * 3);
    const starts = new Float32Array(flowCount);
    const durs = new Float32Array(flowCount);
    for (let i = 0; i < flowCount; i++) {
      const brain = lobe(i, flowCount);
      const fileX = -0.5 + ((i * 0.173) % 1) * 1.0;
      const fileY = -1.22 + (i % 6) * 0.042;
      const o = i * 3;
      if (i < 108) {
        froms[o] = fileX;
        froms[o + 1] = fileY;
        froms[o + 2] = 0.04;
        tos[o] = brain[0];
        tos[o + 1] = brain[1];
        tos[o + 2] = brain[2];
        starts[i] = 0.15 + (i / 108) * 0.55;
        durs[i] = 0.5;
      } else if (i < 138) {
        froms[o] = brain[0];
        froms[o + 1] = brain[1];
        froms[o + 2] = brain[2];
        tos[o] = brain[0] + (i % 2 === 0 ? 0.95 : -0.95);
        tos[o + 1] = brain[1] + 0.62;
        tos[o + 2] = brain[2];
        starts[i] = 1.35 + ((i - 108) / 30) * 0.16;
        durs[i] = 0.42;
      } else {
        froms[o] = brain[0];
        froms[o + 1] = brain[1];
        froms[o + 2] = brain[2];
        tos[o] = fileX * 0.85;
        tos[o + 1] = fileY;
        tos[o + 2] = 0.04;
        starts[i] = 1.72 + ((i - 138) / 30) * 0.14;
        durs[i] = 0.42;
      }
    }
    const flowGeo = new THREE.BufferGeometry();
    flowGeo.setAttribute("aFrom", new THREE.BufferAttribute(froms, 3));
    flowGeo.setAttribute("aTo", new THREE.BufferAttribute(tos, 3));
    flowGeo.setAttribute("aStart", new THREE.BufferAttribute(starts, 1));
    flowGeo.setAttribute("aDur", new THREE.BufferAttribute(durs, 1));
    flowGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(flowCount * 3), 3));
    const flowMat = new THREE.ShaderMaterial({
      vertexShader: flowVert,
      fragmentShader: flowFrag,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uClock: { value: playStory ? 0 : 3 } },
    });
    const flow = new THREE.Points(flowGeo, flowMat);
    flow.visible = playStory;
    group.add(flow);

    const filePos: number[] = [];
    const fileDelay: number[] = [];
    for (let row = 0; row < 6; row++) {
      const y = -1.24 + row * 0.045;
      const half = 0.52 - row * 0.035;
      filePos.push(-half, y, 0.02, half, y, 0.02);
      fileDelay.push(row * 0.06, row * 0.06);
    }
    const fileGeo = new THREE.BufferGeometry();
    fileGeo.setAttribute("position", new THREE.Float32BufferAttribute(filePos, 3));
    fileGeo.setAttribute("aDelay", new THREE.Float32BufferAttribute(fileDelay, 1));
    const fileMat = new THREE.ShaderMaterial({
      vertexShader: fileVert,
      fragmentShader: fileFrag,
      transparent: true,
      depthWrite: false,
      uniforms: { uClock: { value: playStory ? 0 : 3 } },
    });
    const files = new THREE.LineSegments(fileGeo, fileMat);
    files.visible = playStory;
    group.add(files);

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
      const elapsed = (now - born) / 1000;
      const clock = !playStory ? 3 : Math.min(2.6, Math.max(0, elapsed - 0.55));
      const span = Math.min(1, Math.max(0, (clock - 0.2) / 1.05));
      const ease = span * span * (3 - 2 * span);
      easeUniform.value = ease;
      flowMat.uniforms.uClock!.value = clock;
      fileMat.uniforms.uClock!.value = clock;
      const t = still ? 0 : now * 0.001;
      sheet.classList.toggle("playing", playStory && clock < 2.45);
      const note = caption.current;
      if (note) {
        const elapsedNote = (now - born) / 1000;
        note.textContent =
          elapsedNote < 0.55
            ? ""
            : clock < 0.7
              ? "A project, being written"
              : clock < 1.35
                ? "Flowing up into the brain"
                : clock < 2.45
                  ? "Push. And pull."
                  : "";
      }
      sheet.style.setProperty("--ease", ease.toFixed(3));
      host.style.setProperty("--ease", ease.toFixed(3));
      host.style.setProperty("--yaw", `${Math.sin(drag.x) * 14}deg`);
      const idle = !playStory || clock >= 2.45;
      rings.rotation.y += ((drag.x + (idle && !still ? t * 0.35 : 0)) - rings.rotation.y) * 0.12;
      rings.rotation.x += (drag.y * 0.45 - rings.rotation.x) * 0.12;
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
      flowGeo.dispose();
      fileGeo.dispose();
      for (const geo of ringGeos) geo.dispose();
      flowMat.dispose();
      fileMat.dispose();
      for (const mat of ringMats) mat.dispose();
      renderer.dispose();
    };
  }, [assembled, count, soften]);

  return (
    <div className={className ?? "repo-brain"} ref={root}>
      <div className="repo" ref={repo}>
        <img className="cortex-shot" src="/cortex.jpg" alt="" />
        <div className="repo-bar">
          <span className="branch">fix/stale-session</span>
          <span className="path">src/auth/session.ts</span>
          <span className="status">Brain</span>
        </div>
        <span className="gutter" />
        <canvas ref={canvas} aria-hidden="true" />
        {!assembled ? <p className="flow-caption" ref={caption} /> : null}
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
