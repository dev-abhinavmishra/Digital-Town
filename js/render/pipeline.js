// pipeline.js — cinematic post chain: HalfFloat + 4xMSAA composer target,
// RenderPass → GTAO → bloom → grade → OutputPass (tonemap/sRGB) → SMAA.
// SMAA runs after tonemapping where it is designed to operate (LDR image).
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { SMAAPass } from 'three/addons/postprocessing/SMAAPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';

/* Town bounds for the GTAO scene clip box — bounds the AO depth range so
   precision lands on the built area instead of spanning the far plane. */
const TOWN_CLIP = new THREE.Box3(
  new THREE.Vector3(-950, -30, -860),
  new THREE.Vector3( 950, 160,  860));

export function createPipeline(renderer, scene, camera, { time = 'day', ao = true, pixelRatio = 1, msaa = 4, skip = null } = {}) {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
    type: THREE.HalfFloatType,
    samples: msaa,
  });
  const composer = new EffectComposer(renderer, rt);

  composer.addPass(new RenderPass(scene, camera));

  let gtao = null;
  if (ao) {
    gtao = new GTAOPass(scene, camera, size.x, size.y);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.9;
    gtao.updateGtaoMaterial({
      radius: 12,            // world metres — contact-scale AO for a town scene
      distanceExponent: 1.2,
      thickness: 2,
      scale: 1.4,
      samples: 16,
      distanceFallOff: 1,
      screenSpaceRadius: false,
    });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2.5, normalPhi: 3.5 });
    gtao.setSceneClipBox(TOWN_CLIP);
    // Progressive AO on weak GPUs: while the camera moves the pass only
    // forwards the beauty buffer (orbit stays at no-AO framerate); once the
    // camera settles we rebuild the G-buffer once, then composite the cached
    // AO buffer every settled frame — refreshed periodically for moving props.
    const origRender = gtao.render.bind(gtao);
    // seed with the settled camera so the very first frame takes the rebuild
    // path — otherwise frame 1 presents with no AO and frame 2 visibly darkens
    camera.updateMatrixWorld();
    const lastCamMat = new Float32Array(camera.matrixWorld.elements);
    let aoFresh = false, settleN = 0;
    gtao.dirty = true;                       // external: set true on content change
    gtao.render = function (renderer2, writeBuffer, readBuffer) {
      const cm = this.camera.matrixWorld.elements;
      let moved = false;
      for (let i = 0; i < 16; i++)
        if (Math.abs(cm[i] - lastCamMat[i]) > 1e-4) { moved = true; break; }
      if (moved) {
        // camera in motion → forward beauty unmodified, AO rebuilds on settle
        lastCamMat.set(cm);
        settleN = 0;
        if (aoFresh) aoFresh = false;
        this._state = 'moving';
        this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
        this.copyMaterial.blending = THREE.NoBlending;
        this.renderPass(renderer2, this.copyMaterial,
          this.renderToScreen ? null : writeBuffer);
        return;
      }
      if (!aoFresh || this.dirty || (++settleN % 90 === 0)) {
        this._state = 'rebuild';
        origRender(renderer2, writeBuffer, readBuffer);   // full G-buffer + AO
        aoFresh = true;
        this.dirty = false;
        lastCamMat.set(cm);
        return;
      }
      this._state = 'cached';
      // settled + fresh → composite cached AO over the new beauty frame
      this.copyMaterial.uniforms.tDiffuse.value = readBuffer.texture;
      this.copyMaterial.blending = THREE.NoBlending;
      this.renderPass(renderer2, this.copyMaterial,
        this.renderToScreen ? null : writeBuffer);
      this.blendMaterial.uniforms.intensity.value = this.blendIntensity;
      this.blendMaterial.uniforms.tDiffuse.value = this.pdRenderTarget.texture;
      this.renderPass(renderer2, this.blendMaterial,
        this.renderToScreen ? null : writeBuffer);
    };
    composer.addPass(gtao);
  }

  const bloom = new UnrealBloomPass(new THREE.Vector2(size.x / 4, size.y / 4),
    time === 'golden' ? .22 : .12, .5, 1.02);
  if (!skip || !skip.has('bloom')) composer.addPass(bloom);

  // tiny tiling noise texture for film grain — a texture fetch is far cheaper
  // than sin/fract hash math on integrated GPUs
  const nz = document.createElement('canvas'); nz.width = nz.height = 256;
  const nx = nz.getContext('2d'); const ni = nx.createImageData(256, 256);
  for (let i = 0; i < ni.data.length; i += 4) {
    const v = 118 + (Math.random() - .5) * 255;
    ni.data[i] = ni.data[i + 1] = ni.data[i + 2] = v; ni.data[i + 3] = 255;
  }
  nx.putImageData(ni, 0, 0);
  const noiseTex = new THREE.CanvasTexture(nz);
  noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;

  // cinematic grade: vignette + grain + slight teal-shadow/warm-highlight + saturation
  const grade = new ShaderPass({
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uNoise: { value: noiseTex },
      uVig: { value: .28 }, uGrain: { value: .013 },
      uWarm: { value: time === 'golden' ? .07 : time === 'dusk' ? .09 : .025 },
      uSat: { value: time === 'golden' ? 1.12 : 1.07 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv;
      gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform sampler2D tDiffuse; uniform sampler2D uNoise;
      uniform float uTime,uVig,uGrain,uWarm,uSat;
      varying vec2 vUv;
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        // gentle S-curve — knee-faded to zero weight across the highlight
        // shoulder. This pass runs PRE-tonemap, so c.rgb is HDR: the raw
        // x*x*(3-2x) polynomial folds negative above ~1.35 and used to print
        // as RGB confetti on bright edges (snow ridges, sun glints).
        vec3 ct = clamp(c.rgb, 0.0, 1.0);
        vec3 cw = vec3(.22) * clamp(2.0 - 2.0 * c.rgb, 0.0, 1.0);
        c.rgb = mix(c.rgb, ct*ct*(3.0-2.0*ct), cw);
        // saturation lift + warm highlights / cool shadows (one shared luma)
        float l = dot(c.rgb, vec3(.299,.587,.114));
        c.rgb = mix(vec3(l), c.rgb, uSat);
        c.rgb += uWarm * vec3(l - .5) * vec3(1.0,.7,.35);
        c.rgb = max(c.rgb, vec3(0.0));
        // vignette
        float d = distance(vUv, vec2(.5));
        c.rgb *= smoothstep(.92, .38, d) * uVig + (1.0 - uVig);
        // film grain from a tiled noise texture (cheap fetch, no trig)
        float g = texture2D(uNoise, vUv * 7.0 + vec2(uTime * .61, uTime * .37)).r;
        c.rgb += (g - .463) * uGrain * 2.0;
        gl_FragColor = c;
      }`,
  });
  if (!skip || !skip.has('grade')) composer.addPass(grade);

  const smaa = new SMAAPass(innerWidth * pixelRatio, innerHeight * pixelRatio);
  if (!skip || !skip.has('smaa')) composer.addPass(smaa);
  composer.addPass(new OutputPass());          // tonemap + sRGB → screen

  composer._grade = grade;
  return { composer, gtao, bloom, grade, smaa };
}
