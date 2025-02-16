import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { GammaCorrectionShader } from 'three/addons/shaders/GammaCorrectionShader.js';

let scene, camera, renderer, controls, particleSystem;
const numParticles = 20000;
const clock = new THREE.Clock();
let targetPositions = [];
let animationProgress = 1;
const animationDuration = 1.5;
let composer, bloomPass;
let trailTexture, trailScene, trailCamera, trailComposer;

const params = {
  particleSize: 0.035,
  particleColor: 0xff5900,
  rotationSpeed: 0.1,
  bloomStrength: 0.4,
  bloomRadius: 0.5,
  bloomThreshold: 0.85,
  ambientLightIntensity: 0.6,
  directionalLightIntensity: 1,
  motionTrail: 0.3
};

// Счётчик кликов по фигуре
let heartClickCount = 0;

init();
animate();

function init() {
  initScenes();
  initLights();
  initComposers();
  initControls();
  createParticleSystem();
  initEventListeners();
}

function initScenes() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050505);
  scene.fog = new THREE.Fog(0x050505, 10, 50);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = 5;

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  document.getElementById('container').appendChild(renderer.domElement);

  // Создаём дополнительную сцену для эффекта trail (следа)
  trailScene = new THREE.Scene();
  trailCamera = camera.clone();
  trailTexture = new THREE.WebGLRenderTarget(
    window.innerWidth,
    window.innerHeight,
    {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    }
  );
}

function initLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, params.ambientLightIntensity);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, params.directionalLightIntensity);
  directionalLight.position.set(1, 3, 2);
  directionalLight.castShadow = true;
  scene.add(directionalLight);
}

function initComposers() {
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);

  bloomPass = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    params.bloomStrength,
    params.bloomRadius,
    params.bloomThreshold
  );
  composer.addPass(bloomPass);

  const gammaCorrectionPass = new ShaderPass(GammaCorrectionShader);
  composer.addPass(gammaCorrectionPass);

  trailComposer = new EffectComposer(renderer, trailTexture);
  const trailRenderPass = new RenderPass(trailScene, trailCamera);
  trailComposer.addPass(trailRenderPass);
}

function initControls() {
  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.1;
  controls.rotateSpeed = 0.5;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  
  controls.addEventListener('start', () => {
    document.body.style.cursor = 'grabbing';
  });
  
  controls.addEventListener('end', () => {
    document.body.style.cursor = 'grab';
  });
}

// Функция создания фигуры "сердца"
function createHeartShape() {
  const vertices = [];
  const numPoints = 200;
  const scale = 0.1;
  let xs = [];
  let ys = [];
  for (let i = 0; i < numPoints; i++) {
    let t = (i / numPoints) * Math.PI * 2;
    // Параметрические уравнения для сердца
    let x = 16 * Math.pow(Math.sin(t), 3);
    let y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    xs.push(x);
    ys.push(y);
    vertices.push(new THREE.Vector3(x, y, 0));
  }
  // Центрируем фигуру
  let minX = Math.min(...xs);
  let maxX = Math.max(...xs);
  let minY = Math.min(...ys);
  let maxY = Math.max(...ys);
  let centerX = (minX + maxX) / 2;
  let centerY = (minY + maxY) / 2;
  for (let i = 0; i < vertices.length; i++) {
    vertices[i].x = (vertices[i].x - centerX) * scale;
    vertices[i].y = (vertices[i].y - centerY) * scale;
  }
  return vertices;
}

// Морфинг всех частиц в форму сердца (перезапуск анимации морфинга)
function morphToHeart() {
  const targetVertices = createHeartShape();
  for (let i = 0; i < numParticles; i++) {
    const vertexIndex = i % targetVertices.length;
    const targetVertex = targetVertices[vertexIndex];
    targetPositions[i * 3] = targetVertex.x;
    targetPositions[i * 3 + 1] = targetVertex.y;
    targetPositions[i * 3 + 2] = targetVertex.z;
  }
  animationProgress = 0;
}

function createParticleSystem() {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(numParticles * 3);
  const colors = new Float32Array(numParticles * 3);
  const sizes = new Float32Array(numParticles);

  targetPositions = new Float32Array(numParticles * 3);

  // Изначальное расположение частиц на сфере
  for (let i = 0; i < numParticles; i++) {
    const phi = Math.acos(-1 + (2 * i) / numParticles);
    const theta = Math.sqrt(numParticles * Math.PI) * phi;
    const x = Math.sin(phi) * Math.cos(theta);
    const y = Math.sin(phi) * Math.sin(theta);
    const z = Math.cos(phi);

    positions[i * 3] = x * 1.5;
    positions[i * 3 + 1] = y * 1.5;
    positions[i * 3 + 2] = z * 1.5;

    // Начальные targetPositions равны текущим позициям
    targetPositions[i * 3] = positions[i * 3];
    targetPositions[i * 3 + 1] = positions[i * 3 + 1];
    targetPositions[i * 3 + 2] = positions[i * 3 + 2];

    const color = new THREE.Color(params.particleColor);
    color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;

    sizes[i] = params.particleSize * (0.8 + Math.random() * 0.4);
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const material = new THREE.PointsMaterial({
    size: params.particleSize,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
    depthTest: true,
    depthWrite: false,
    transparent: true,
    opacity: 0.9,
    sizeAttenuation: true
  });

  particleSystem = new THREE.Points(geometry, material);
  scene.add(particleSystem);

  // Для эффекта trail добавляем клон частиц
  const trailParticles = particleSystem.clone();
  trailScene.add(trailParticles);

  // При запуске морфим частицы в сердце
  morphToHeart();
}

function updateParticleSystem() {
  if (!particleSystem) return;
  const colors = particleSystem.geometry.attributes.color.array;
  const sizes = particleSystem.geometry.attributes.size.array;
  for (let i = 0; i < numParticles; i++) {
    const color = new THREE.Color(params.particleColor);
    color.offsetHSL(0, 0, (Math.random() - 0.5) * 0.5);
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
    sizes[i] = params.particleSize * (0.8 + Math.random() * 0.4);
  }
  particleSystem.geometry.attributes.color.needsUpdate = true;
  particleSystem.geometry.attributes.size.needsUpdate = true;
  particleSystem.material.size = params.particleSize;
}

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
  trailTexture.setSize(window.innerWidth, window.innerHeight);
  trailComposer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();
  if (particleSystem) {
    particleSystem.rotation.y += delta * params.rotationSpeed;
    if (animationProgress < 1) {
      animationProgress += delta / animationDuration;
      animationProgress = Math.min(animationProgress, 1);
      const positions = particleSystem.geometry.attributes.position.array;
      for (let i = 0; i < numParticles * 3; i++) {
        positions[i] += (targetPositions[i] - positions[i]) * (delta / animationDuration);
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }
    // Если морфинг завершён, применяем эффект пульсации
    if (animationProgress >= 1) {
      const pulse = 1 + 0.1 * Math.sin(clock.getElapsedTime() * 2 * Math.PI);
      particleSystem.scale.set(pulse, pulse, pulse);
    }
  }
  renderer.setRenderTarget(trailTexture);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  controls.update();
  composer.render();
}

function initEventListeners() {
  window.addEventListener('resize', onWindowResize, false);
  renderer.domElement.addEventListener('dblclick', () => {
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    controls.reset();
  });

  // Добавляем обработчик клика по области рендера (фигуре)
  renderer.domElement.addEventListener('click', () => {
    // Меняем случайный цвет частиц
    const randomColor = new THREE.Color(Math.random(), Math.random(), Math.random());
    params.particleColor = randomColor.getHex();
    updateParticleSystem();

    heartClickCount++;
    if (heartClickCount < 3) {
      // Перезапуск морфинга (обновляем targetPositions)
      morphToHeart();
    } else {
      // После 3-го клика выполняем полную реинициализацию
      heartClickCount = 0;
      // Удаляем старую систему частиц и освобождаем память
      scene.remove(particleSystem);
      particleSystem.geometry.dispose();
      particleSystem.material.dispose();
      // Создаём новую систему частиц (которая автоматически запускает морфинг)
      createParticleSystem();
    }
  });
}
