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
    vec3 origin = vec3(0.0, -1.16, 0.06);
    vec3 p = mix(origin, settled, uEase);
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
    float gone = 1.0 - smoothstep(1.25, 1.7, uClock);
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

    const playStory = !assembled && !still;
    const flowCount = 168;
    const froms = new Float32Array(flowCount * 3);
    const tos = new Float32Array(flowCount * 3);
    const starts = new Float32Array(flowCount);
    const durs = new Float32Array(flowCount);
    for (let i = 0; i < flowCount; i++) {
      const src = (i * 29) % pos.count;
      const shaped = fold(base[src * 3]!, base[src * 3 + 1]!, base[src * 3 + 2]!);
      const brain = shaped.p;
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
        starts[i] = 0.22 + (i / 108) * 0.72;
        durs[i] = 0.58;
      } else if (i < 138) {
        froms[o] = brain[0];
        froms[o + 1] = brain[1];
        froms[o + 2] = brain[2];
        tos[o] = brain[0] + (i % 2 === 0 ? 0.95 : -0.95);
        tos[o + 1] = brain[1] + 0.62;
        tos[o + 2] = brain[2];
        starts[i] = 1.62 + ((i - 108) / 30) * 0.22;
        durs[i] = 0.48;
      } else {
        froms[o] = brain[0];
        froms[o + 1] = brain[1];
        froms[o + 2] = brain[2];
        tos[o] = fileX * 0.85;
        tos[o + 1] = fileY;
        tos[o + 2] = 0.04;
        starts[i] = 2.05 + ((i - 138) / 30) * 0.18;
        durs[i] = 0.5;
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
      const clock = !playStory ? 3 : Math.min(3, Math.max(0, (now - born) / 1000));
      const span = Math.min(1, Math.max(0, (clock - 0.32) / 1.2));
      const ease = span * span * (3 - 2 * span);
      easeUniform.value = ease;
      flowMat.uniforms.uClock!.value = clock;
      fileMat.uniforms.uClock!.value = clock;
      const t = still ? 0 : now * 0.001;
      shellMat.uniforms.uTime!.value = t;
      pointMat.uniforms.uTime!.value = t;
      sheet.classList.toggle("playing", playStory && clock < 2.95);
      const note = caption.current;
      if (note) {
        note.textContent =
          clock < 0.95 ? "A project, being written" : clock < 1.7 ? "Flowing up into the brain" : clock < 2.95 ? "Push. And pull." : "";
      }
      sheet.style.setProperty("--ease", ease.toFixed(3));
      const idle = !playStory || clock >= 2.95;
      group.rotation.y += ((drag.x + (idle && !still ? now * 0.00006 : 0)) - group.rotation.y) * 0.12;
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
      flowGeo.dispose();
      fileGeo.dispose();
      shellMat.dispose();
      pointMat.dispose();
      flowMat.dispose();
      fileMat.dispose();
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
