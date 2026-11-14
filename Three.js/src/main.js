import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// 1. CREATE SCENE WITH AUTHENTIC BLACKISH-BLUE DEEP SPACE BACKGROUND
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02050e); // Deep blackish-blue cosmic space void

// 2. CREATE CAMERA
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);
// Framing at 3.2 units so the Moon is prominently displayed in space
camera.position.set(0, 0, 3.2);

// 3. CREATE RENDERER
const canvas = document.getElementById('lunar-canvas');
const renderer = new THREE.WebGLRenderer({
    canvas: canvas,
    antialias: true
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ACES Filmic tone mapping: preserves high dynamic range and crater details without overexposure
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

// Enable realistic soft shadow mapping
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// 4. CREATE ORBIT CONTROLS
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enableZoom = true;
controls.enablePan = true;
controls.rotateSpeed = 0.8;
controls.minDistance = 1.4;
controls.maxDistance = 10;
controls.autoRotate = false; // Only moves according to user directions

// 5. NATURAL SPACE STARFIELD (2,500 sharp, pinpoint stars in deep space)
const starsGeometry = new THREE.BufferGeometry();
const starCount = 2500;
const starPositions = new Float32Array(starCount * 3);
const starColors = new Float32Array(starCount * 3);

for (let i = 0; i < starCount; i++) {
    // Distribute stars on a wide spherical shell around the scene
    const radius = 60 + Math.random() * 60;
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const sinPhi = Math.sin(phi);

    starPositions[i * 3] = radius * sinPhi * Math.cos(theta);
    starPositions[i * 3 + 1] = radius * sinPhi * Math.sin(theta);
    starPositions[i * 3 + 2] = radius * Math.cos(phi);

    // Natural stellar brightness variations
    const brightness = 0.35 + Math.random() * 0.65;
    const tint = Math.random();
    if (tint < 0.72) {
        // Pure white
        starColors[i * 3] = brightness;
        starColors[i * 3 + 1] = brightness;
        starColors[i * 3 + 2] = brightness;
    } else if (tint < 0.86) {
        // Subtle cool blue starlight
        starColors[i * 3] = brightness * 0.85;
        starColors[i * 3 + 1] = brightness * 0.92;
        starColors[i * 3 + 2] = brightness;
    } else {
        // Subtle warm white starlight
        starColors[i * 3] = brightness;
        starColors[i * 3 + 1] = brightness * 0.90;
        starColors[i * 3 + 2] = brightness * 0.80;
    }
}

starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
starsGeometry.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

const starsMaterial = new THREE.PointsMaterial({
    size: 0.55,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
});

const starfield = new THREE.Points(starsGeometry, starsMaterial);
scene.add(starfield);

// 6. CREATE SPHERE GEOMETRY WITH UNROLLING FLAT MAP MORPH TARGET
const geometry = new THREE.SphereGeometry(
    1,           // Radius
    256,         // Width segments
    256,         // Height segments
    0,           // Phi start
    Math.PI * 2, // Full horizontal coverage
    0,           // Theta start
    Math.PI      // Full vertical coverage
);
geometry.computeTangents(); // Computes tangent attribute for sharp normal mapping

// Generate seamless GPU morph targets: unrolls spherical mesh into 2D equirectangular cartographic plane
const vertexCount = geometry.attributes.position.count;
const uvAttr = geometry.attributes.uv;
const planePositions = new Float32Array(vertexCount * 3);
const planeNormals = new Float32Array(vertexCount * 3);

for (let i = 0; i < vertexCount; i++) {
    const u = uvAttr.getX(i);
    const v = uvAttr.getY(i);
    // Equirectangular plane: width = 4.0, height = 2.0, centered at (0, 0, 0)
    planePositions[i * 3]     = (u - 0.5) * 4.0;
    planePositions[i * 3 + 1] = (v - 0.5) * 2.0;
    planePositions[i * 3 + 2] = 0.0;

    planeNormals[i * 3]     = 0.0;
    planeNormals[i * 3 + 1] = 0.0;
    planeNormals[i * 3 + 2] = 1.0;
}

geometry.morphAttributes.position = [ new THREE.BufferAttribute(planePositions, 3) ];
geometry.morphAttributes.normal = [ new THREE.BufferAttribute(planeNormals, 3) ];

// 7. LOAD NASA DATASETS & MAPS
const textureLoader = new THREE.TextureLoader();
const moonTexture = textureLoader.load('/moon.jpg');
const moonDisplacement = textureLoader.load('/moon-height.jpg');
const moonNormalTexture = textureLoader.load('/moon-normal.jpg');
const moonRoughnessTexture = textureLoader.load('/moon-roughness.jpg');

// Set sRGB color space on base color texture
moonTexture.colorSpace = THREE.SRGBColorSpace;

// CREATE MOON MATERIAL
const material = new THREE.MeshStandardMaterial({
    map: moonTexture,
    displacementMap: moonDisplacement,
    displacementScale: 0.06, // Calibrated for visible elevation without geometry distortion
    displacementBias: 0,
    normalMap: moonNormalTexture,
    normalScale: new THREE.Vector2(2.0, 2.0), // Enhanced crater relief
    roughnessMap: moonRoughnessTexture,
    roughness: 1,
    metalness: 0 // Realistic non-glossy lunar regolith
});

// 8. CREATE MOON MESH & SET INITIAL ORIENTATION
const moon = new THREE.Mesh(geometry, material);
moon.castShadow = true;
moon.receiveShadow = true;
moon.morphTargetInfluences = [0.0]; // 0.0 = 3D Sphere, 1.0 = 2D Flat Map

// Rotate -90 degrees so the iconic Near Side (Mare Imbrium, Oceanus Procellarum, Apollo sites)
// directly faces the camera at startup, matching NASA visualizations and reference imagery
moon.rotation.y = -Math.PI / 2;

scene.add(moon);

// 9. REALISTIC LUNAR LIGHTING & SHADOW SYSTEM

// Faint earthshine / cosmic fill: preserves stark contrast while keeping night side readable
const ambientLight = new THREE.AmbientLight(0xffffff, 0.08);
scene.add(ambientLight);

// Sunlight: DirectionalLight from upper-right matching the reference image illumination
const sunLight = new THREE.DirectionalLight(0xffffff, 3.6);
sunLight.position.set(3.5, 1.8, 2.6);

// Shadow mapping configuration
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 2048;
sunLight.shadow.mapSize.height = 2048;
sunLight.shadow.camera.near = 0.5;
sunLight.shadow.camera.far = 10;

// Tight shadow frustum fitted to the Moon sphere
const shadowBound = 1.35;
sunLight.shadow.camera.left = -shadowBound;
sunLight.shadow.camera.right = shadowBound;
sunLight.shadow.camera.top = shadowBound;
sunLight.shadow.camera.bottom = -shadowBound;

// Prevent shadow acne across displaced geometry
sunLight.shadow.bias = -0.0005;

scene.add(sunLight);

// Subtle space rim light from behind-left: outlines the dark side silhouette so it never merges into the background
const rimLight = new THREE.DirectionalLight(0x283b54, 0.45);
rimLight.position.set(-3.5, -0.8, -2.0);
scene.add(rimLight);

// 10. 3D RED POINTER (📍) SURFACE MARKER (Child of Moon so it maintains exact surface attachment across rotations)
function createSurfaceMarker() {
    const group = new THREE.Group();
    group.visible = false;

    // Metallic material for pin shaft and collar
    const metalMat = new THREE.MeshStandardMaterial({
        color: 0xd8e2ec,
        metalness: 0.88,
        roughness: 0.22
    });

    // Sharp Needle / Shaft: tapered cylinder pointing straight down to (0, 0, 0)
    // Tip rests exactly at local y = 0
    const needleGeo = new THREE.CylinderGeometry(0.003, 0.0006, 0.034, 16);
    needleGeo.translate(0, 0.017, 0);
    const needleMesh = new THREE.Mesh(needleGeo, metalMat);
    group.add(needleMesh);

    // Metallic Collar: transitions needle into the red spherical head
    const collarGeo = new THREE.CylinderGeometry(0.006, 0.005, 0.003, 16);
    collarGeo.translate(0, 0.0355, 0);
    const collarMesh = new THREE.Mesh(collarGeo, metalMat);
    group.add(collarMesh);

    // Red Bulb / Pin Head (Sphere of the 📍 icon):
    // Rich vibrant red with emissive illumination so it's always clearly visible from all angles
    const headGeo = new THREE.SphereGeometry(0.018, 32, 24);
    headGeo.translate(0, 0.051, 0);
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0x991b1b,
        emissiveIntensity: 0.45,
        roughness: 0.25,
        metalness: 0.15
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    group.add(headMesh);

    // Subtle Surface Contact Ring (lies flat on lunar surface at y = 0.001)
    const baseRingGeo = new THREE.RingGeometry(0.006, 0.020, 32);
    baseRingGeo.rotateX(-Math.PI / 2);
    baseRingGeo.translate(0, 0.001, 0);
    const baseRingMat = new THREE.MeshBasicMaterial({
        color: 0xef4444,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.75,
        depthWrite: false
    });
    const baseRing = new THREE.Mesh(baseRingGeo, baseRingMat);
    group.add(baseRing);

    // Surface Center Contact Dot: exact contact point indicator
    const baseDotGeo = new THREE.CircleGeometry(0.0032, 20);
    baseDotGeo.rotateX(-Math.PI / 2);
    baseDotGeo.translate(0, 0.0012, 0);
    const baseDotMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.9,
        depthWrite: false
    });
    const baseDot = new THREE.Mesh(baseDotGeo, baseDotMat);
    group.add(baseDot);

    return { group, baseRing, baseRingMat };
}

const { group: surfaceMarker, baseRing: markerBaseRing, baseRingMat: markerBaseRingMat } = createSurfaceMarker();
moon.add(surfaceMarker);

// 11. AUTHORITATIVE NASA / USGS LUNAR POINTS OF INTEREST DATABASE
// All coordinates rigorously verified against NASA NSSDC, NASA LROC, and USGS / IAU records
// Coordinate convention: NASA LRO Mean Earth / Polar Axis (ME) frame (Planetocentric, East-positive 0–360°)
const LUNAR_RADIUS_KM = 1737.4;
const MISSION_PROXIMITY_THRESHOLD_KM = 50.0; // Scientifically justified landing site proximity radius

// ============================================================================
// CATEGORY A: NASA & INTERNATIONAL LUNAR MISSION LANDING SITES
// Documented touchdown locations (Lunar Modules, Soft Landers, Sample Returns)
// ============================================================================
const MISSION_LANDINGS = [
    // --- Apollo Program (NASA NSSDC / LRO LROC - Lunar Module Touchdown Sites) ---
    {
        name: 'Apollo 11',
        site: 'Tranquility Base (Mare Tranquillitatis)',
        lat: 0.67416,
        lon: 23.47314,
        date: '1969-07-20',
        category: 'mission',
        type: 'Manned Landing (LM Eagle)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Apollo 12',
        site: 'Oceanus Procellarum',
        lat: -3.01280,
        lon: 336.57810, // 23.4219° W
        date: '1969-11-19',
        category: 'mission',
        type: 'Manned Landing (LM Intrepid)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Apollo 14',
        site: 'Fra Mauro',
        lat: -3.64589,
        lon: 342.52806, // 17.47194° W
        date: '1971-02-05',
        category: 'mission',
        type: 'Manned Landing (LM Antares)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Apollo 15',
        site: 'Hadley-Apennine',
        lat: 26.13239,
        lon: 3.63330,
        date: '1971-07-30',
        category: 'mission',
        type: 'Manned Landing (LM Falcon)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Apollo 16',
        site: 'Descartes Highlands',
        lat: -8.97340,
        lon: 15.50110,
        date: '1972-04-21',
        category: 'mission',
        type: 'Manned Landing (LM Orion)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Apollo 17',
        site: 'Taurus-Littrow',
        lat: 20.19110,
        lon: 30.77230,
        date: '1972-12-11',
        category: 'mission',
        type: 'Manned Landing (LM Challenger)',
        major: true,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },

    // --- Surveyor Program (NASA NSSDC / LRO LROC) ---
    {
        name: 'Surveyor 1',
        site: 'Flamsteed / Oceanus Procellarum',
        lat: -2.47450,
        lon: 316.66020, // 43.3398° W
        date: '1966-06-02',
        category: 'mission',
        type: 'Robotic Soft Lander',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Surveyor 3',
        site: 'Oceanus Procellarum',
        lat: -3.01620,
        lon: 336.58200, // 23.4180° W
        date: '1967-04-20',
        category: 'mission',
        type: 'Robotic Soft Lander',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Surveyor 5',
        site: 'Mare Tranquillitatis',
        lat: 1.45510,
        lon: 23.19430,
        date: '1967-09-11',
        category: 'mission',
        type: 'Robotic Soft Lander',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Surveyor 6',
        site: 'Sinus Medii',
        lat: 0.47420,
        lon: 358.57250,
        date: '1967-11-10',
        category: 'mission',
        type: 'Robotic Soft Lander',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Surveyor 7',
        site: 'Tycho Crater Rim',
        lat: -40.98120,
        lon: 348.48730, // 11.5127° W
        date: '1968-01-10',
        category: 'mission',
        type: 'Robotic Soft Lander',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },

    // --- Luna Program (NASA NSSDC / Soviet Space Program) ---
    {
        name: 'Luna 2',
        site: 'Palus Putredinis',
        lat: 29.10000,
        lon: 0.00000,
        date: '1959-09-14',
        category: 'mission',
        type: 'First Human Impact on Moon',
        major: true,
        source: 'NASA NSSDC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 9',
        site: 'Oceanus Procellarum',
        lat: 7.08000,
        lon: 295.63000, // 64.37° W
        date: '1966-02-03',
        category: 'mission',
        type: 'First Soft Landing on Moon',
        major: true,
        source: 'NASA NSSDC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 16',
        site: 'Mare Fecunditatis',
        lat: -0.51300,
        lon: 56.36300,
        date: '1970-09-20',
        category: 'mission',
        type: 'Robotic Sample Return',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 17',
        site: 'Mare Imbrium (Lunokhod 1)',
        lat: 38.23730,
        lon: 324.99200, // 35.0080° W
        date: '1970-11-17',
        category: 'mission',
        type: 'First Robotic Lunar Rover',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 20',
        site: 'Apollonius Highlands',
        lat: 3.78600,
        lon: 56.62600,
        date: '1972-02-21',
        category: 'mission',
        type: 'Robotic Sample Return',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 21',
        site: 'Le Monnier Crater (Lunokhod 2)',
        lat: 25.85000,
        lon: 30.45000,
        date: '1973-01-15',
        category: 'mission',
        type: 'Robotic Lunar Rover',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Luna 24',
        site: 'Mare Crisium',
        lat: 12.71450,
        lon: 62.20290,
        date: '1976-08-18',
        category: 'mission',
        type: 'Robotic Sample Return',
        major: false,
        source: 'NASA NSSDC / LROC',
        sourceUrl: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_sites.html',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },

    // --- Chang'e Program (CNSA / NASA LROC) ---
    {
        name: "Chang'e 3",
        site: 'Mare Imbrium',
        lat: 44.12140,
        lon: 340.48840, // 19.5116° W
        date: '2013-12-14',
        category: 'mission',
        type: 'Lander & Yutu Rover',
        major: false,
        source: 'CNSA / NASA LROC',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: "Chang'e 4",
        site: 'Von Kármán Crater (Far Side)',
        lat: -45.44460,
        lon: 177.59910,
        date: '2019-01-03',
        category: 'mission',
        type: 'First Far Side Landing',
        major: true,
        source: 'CNSA / NASA LROC',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: "Chang'e 5",
        site: 'Mons Rümker / Oceanus Procellarum',
        lat: 43.05760,
        lon: 308.08390, // 51.9161° W
        date: '2020-12-01',
        category: 'mission',
        type: 'Robotic Sample Return',
        major: false,
        source: 'CNSA / NASA LROC',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: "Chang'e 6",
        site: 'Apollo Basin (Far Side)',
        lat: -41.62510,
        lon: 206.02240, // 153.9776° W
        date: '2024-06-01',
        category: 'mission',
        type: 'First Far Side Sample Return',
        major: true,
        source: 'CNSA / Official Mission Records',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },

    // --- International Landers (ISRO / JAXA / NASA LROC) ---
    {
        name: 'Chandrayaan-3',
        site: 'Shiv Shakti Point (South Polar Region)',
        lat: -69.37300,
        lon: 32.31900,
        date: '2023-08-23',
        category: 'mission',
        type: 'Vikram Lander & Pragyan Rover',
        major: true,
        source: 'ISRO / NASA LROC',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'SLIM',
        site: 'Shioli Crater Rim',
        lat: -13.31600,
        lon: 25.25100,
        date: '2024-01-19',
        category: 'mission',
        type: 'Pinpoint Robotic Lander',
        major: false,
        source: 'JAXA / NASA LROC',
        sourceUrl: 'https://science.nasa.gov/resource/moon-landing-sites/',
        coordSystem: 'NASA LRO Mean Earth / Polar Axis (ME)'
    }
];

// Alias for proximity detection in coordinate HUD
const LUNAR_MISSIONS = MISSION_LANDINGS;

// ============================================================================
// CATEGORY B: FAMOUS LUNAR CRATERS
// Official records from the USGS Gazetteer of Planetary Nomenclature / IAU
// ============================================================================
const FAMOUS_CRATERS = [
    {
        name: 'Tycho',
        lat: -43.3100,
        lon: 348.6400, // 11.36° W
        diameter: 85.29,
        category: 'crater',
        type: 'Impact Crater (Prominent Ray System)',
        major: true,
        featureId: 6162,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/6162',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Copernicus',
        lat: 9.6200,
        lon: 339.9200, // 20.08° W
        diameter: 96.07,
        category: 'crater',
        type: 'Impact Crater (Terraced Walls & Central Peaks)',
        major: true,
        featureId: 1300,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/1300',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Kepler',
        lat: 8.1200,
        lon: 321.9900, // 38.01° W
        diameter: 29.49,
        category: 'crater',
        type: 'Impact Crater (Prominent Ray System)',
        major: false,
        featureId: 3020,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/3020',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Aristarchus',
        lat: 23.7300,
        lon: 312.5100, // 47.49° W
        diameter: 39.99,
        category: 'crater',
        type: 'Impact Crater (Brightest Lunar Albedo Feature)',
        major: true,
        featureId: 369,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/369',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Plato',
        lat: 51.6200,
        lon: 350.6200, // 9.38° W
        diameter: 100.68,
        category: 'crater',
        type: 'Impact Crater (Dark Basalt-Filled Floor)',
        major: true,
        featureId: 4758,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/4758',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Clavius',
        lat: -58.6200,
        lon: 345.5100, // 14.49° W
        diameter: 230.77,
        category: 'crater',
        type: 'Impact Crater (Massive Ancient Crater)',
        major: true,
        featureId: 1243,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/1243',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Theophilus',
        lat: -11.4500,
        lon: 26.2800,
        diameter: 98.59,
        category: 'crater',
        type: 'Impact Crater (Prominent Triple Central Peak)',
        major: false,
        featureId: 5965,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/5965',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Langrenus',
        lat: -8.8600,
        lon: 61.0400,
        diameter: 131.98,
        category: 'crater',
        type: 'Impact Crater (Prominent Eastern Rim)',
        major: false,
        featureId: 3273,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/3273',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Tsiolkovskiy',
        lat: -20.3800,
        lon: 129.1000,
        diameter: 184.39,
        category: 'crater',
        type: 'Far Side Crater (Dark Mare Floor & Bright Peak)',
        major: true,
        featureId: 6108,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/6108',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    },
    {
        name: 'Jackson',
        lat: 22.0500,
        lon: 196.6800, // 163.32° W
        diameter: 71.38,
        category: 'crater',
        type: 'Far Side Crater (Vast Bright Ray System)',
        major: false,
        featureId: 2781,
        source: 'USGS / IAU Planetary Gazetteer',
        sourceUrl: 'https://planetarynames.wr.usgs.gov/Feature/2781',
        coordSystem: 'Mean Earth / Polar Axis (ME)'
    }
];

// Great-circle spherical distance on the Moon in kilometers
function calculateGreatCircleDistanceKm(lat1, lon1, lat2, lon2) {
    const toRad = Math.PI / 180.0;
    const phi1 = lat1 * toRad;
    const phi2 = lat2 * toRad;
    const deltaLambda = (lon2 - lon1) * toRad;

    const cosD = Math.sin(phi1) * Math.sin(phi2) + Math.cos(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);
    const clampedCosD = Math.max(-1.0, Math.min(1.0, cosD));
    return LUNAR_RADIUS_KM * Math.acos(clampedCosD);
}

// Proximity-based mission identification for surface raycasting
function identifyLunarMission(lat, lon) {
    let closestMission = null;
    let minDistanceKm = Infinity;

    for (const mission of LUNAR_MISSIONS) {
        const distKm = calculateGreatCircleDistanceKm(lat, lon, mission.lat, mission.lon);
        if (distKm < minDistanceKm) {
            minDistanceKm = distKm;
            closestMission = mission;
        }
    }

    if (closestMission && minDistanceKm <= MISSION_PROXIMITY_THRESHOLD_KM) {
        let displayStr = closestMission.name;
        if (minDistanceKm >= 0.1) {
            displayStr += minDistanceKm < 1.0 
                ? ` (${Math.round(minDistanceKm * 1000)} m)` 
                : ` (${minDistanceKm.toFixed(1)} km)`;
        }
        return {
            found: true,
            text: displayStr,
            mission: closestMission,
            distanceKm: minDistanceKm
        };
    }

    return {
        found: false,
        text: 'No nearby verified landing site',
        mission: null,
        distanceKm: minDistanceKm
    };
}

// Helper: Convert NASA LRO ME lat/lon (degrees) into local 3D vector on Moon sphere
function latLonToLocalPosition(latDeg, lonDeg, radius = 1.018) {
    const phi = (latDeg * Math.PI) / 180.0;
    const lambda = (lonDeg * Math.PI) / 180.0;
    const cosPhi = Math.cos(phi);
    const x = radius * cosPhi * Math.cos(lambda);
    const y = radius * Math.sin(phi);
    const z = -radius * cosPhi * Math.sin(lambda);
    return new THREE.Vector3(x, y, z);
}

// ============================================================================
// SHARED LUNAR GEOGRAPHIC DATA MODEL & 2D EQUIRECTANGULAR COORDINATE CONVERSION
// Shared between 3D Globe and 2D Flat Map modes (NASA LRO ME Frame)
// ============================================================================

let currentViewMode = '3d'; // '3d' or '2d'
let selectedCoords = null; // Preserved shared geographic coordinates { lat, lon }

// Equirectangular Map Plane: width = 4.0, height = 2.0, centered at (0, 0, 0)
// Longitude: 0° is Prime Meridian (center, x = 0).
// East is positive x (0° to 180° -> x: 0 to +2.0).
// West is negative x (180° to 360° -> x: -2.0 to 0).
function lonToMapX(lonDeg) {
    let lon = lonDeg % 360.0;
    if (lon < 0) lon += 360.0;
    if (lon <= 180.0) {
        return lon / 90.0;
    } else {
        return (lon - 360.0) / 90.0;
    }
}

function mapXToLon(x) {
    const clampedX = Math.max(-2.0, Math.min(2.0, x));
    let lon = clampedX * 90.0;
    if (lon < 0) lon += 360.0;
    if (lon >= 360.0) lon -= 360.0;
    return lon;
}

function latToMapY(latDeg) {
    const clampedLat = Math.max(-90.0, Math.min(90.0, latDeg));
    return clampedLat / 90.0;
}

function mapYToLat(y) {
    const clampedY = Math.max(-1.0, Math.min(1.0, y));
    return clampedY * 90.0;
}

// 3D <-> 2D Synchronized Red Pointer (📍) Positions and Orientations
const markerPos3D = new THREE.Vector3();
const markerQuat3D = new THREE.Quaternion();
const markerPos2D = new THREE.Vector3();
const markerQuat2D = new THREE.Quaternion();

function updateSurfaceMarkerTargets(lat, lon) {
    const localNorm = latLonToLocalPosition(lat, lon, 1.0).normalize();
    markerPos3D.copy(localNorm.clone().multiplyScalar(1.002));
    markerQuat3D.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localNorm);

    const mx = lonToMapX(lon);
    const my = latToMapY(lat);
    markerPos2D.set(mx, my, 0.02);
    markerQuat2D.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

    if (currentViewMode === '2d') {
        surfaceMarker.position.copy(markerPos2D);
        surfaceMarker.quaternion.copy(markerQuat2D);
    } else {
        surfaceMarker.position.copy(markerPos3D);
        surfaceMarker.quaternion.copy(markerQuat3D);
    }
    surfaceMarker.visible = true;
}

// ============================================================================
// 12. 3D INTERACTIVE LUNAR POINTS OF INTEREST (POI) SYSTEM
// ============================================================================

// Shared POI pin geometries for high GPU efficiency
const poiStemGeo = new THREE.ConeGeometry(0.007, 0.022, 16);
poiStemGeo.rotateX(Math.PI);
poiStemGeo.translate(0, 0.011, 0); // Stem apex at y=0, top at y=0.022

const poiHeadGeo = new THREE.CylinderGeometry(0.016, 0.010, 0.008, 24);
poiHeadGeo.translate(0, 0.026, 0); // Bezel head sitting atop stem

const poiCoreGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.0085, 24);
poiCoreGeo.translate(0, 0.0265, 0); // Inner core

const poiBeaconGeo = new THREE.SphereGeometry(0.0055, 12, 8);
poiBeaconGeo.translate(0, 0.029, 0); // Center illuminated beacon

const poiHitGeo = new THREE.SphereGeometry(0.038, 12, 8);
poiHitGeo.translate(0, 0.022, 0); // Invisible hit sphere for easy clicking/touching

// Category A: Mission Materials (Navy / Cyan illumination)
const missionBezelMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.85,
    roughness: 0.25
});
const missionCoreMat = new THREE.MeshStandardMaterial({
    color: 0x0c2438,
    metalness: 0.6,
    roughness: 0.4
});
const missionBeaconMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x38bdf8,
    emissiveIntensity: 1.8,
    roughness: 0.2
});

// Category B: Crater Materials (Slate / Silver-white illumination)
const craterBezelMat = new THREE.MeshStandardMaterial({
    color: 0x1e2229,
    metalness: 0.85,
    roughness: 0.3
});
const craterCoreMat = new THREE.MeshStandardMaterial({
    color: 0x11161d,
    metalness: 0.5,
    roughness: 0.5
});
const craterBeaconMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    emissive: 0xcbd5e1,
    emissiveIntensity: 1.2,
    roughness: 0.3
});

// Invisible hit sphere material
const poiHitMat = new THREE.MeshBasicMaterial({ visible: false });

const poiEntries = [];
const poiHitMeshes = [];
let selectedPOI = null;

// DOM references for unified Lunar Compass Information Panel
const poiLabelsContainer = document.getElementById('poi-labels-container');
const hudBadge = document.getElementById('hud-badge');
const latEl = document.getElementById('val-lat');
const lonEl = document.getElementById('val-lon');
const labelMission = document.getElementById('label-mission');
const valMission = document.getElementById('val-mission');
const hudExtra = document.getElementById('hud-extra');
const labelSite = document.getElementById('label-site');
const valSite = document.getElementById('val-site');
const labelExtra1 = document.getElementById('label-extra1');
const valExtra1 = document.getElementById('val-extra1');
const labelExtra2 = document.getElementById('label-extra2');
const valExtra2 = document.getElementById('val-extra2');
const hudPanel = document.getElementById('lunar-hud');

// Unified HUD update handler
function updateLunarHUD({
    latFormatted,
    lonFormatted,
    badgeText = 'LRO ME',
    badgeType = 'default',
    missionLabel = 'MOON MISSION',
    missionValue = 'No nearby verified landing site',
    isMatched = false,
    showExtra = false,
    siteLabel = 'LANDING SITE',
    siteValue = '',
    extra1Label = 'LANDING DATE',
    extra1Value = '',
    extra2Label = 'FEATURE TYPE',
    extra2Value = ''
}) {
    if (latEl) latEl.textContent = latFormatted;
    if (lonEl) lonEl.textContent = lonFormatted;

    if (hudBadge) {
        hudBadge.textContent = badgeText;
        hudBadge.className = 'hud-badge';
        if (badgeType === 'mission') hudBadge.classList.add('mission-badge');
        else if (badgeType === 'crater') hudBadge.classList.add('crater-badge');
    }

    if (labelMission) labelMission.textContent = missionLabel;
    if (valMission) {
        valMission.textContent = missionValue;
        valMission.classList.remove('matched', 'matched-mission', 'matched-crater');
        if (isMatched) {
            valMission.classList.add('matched');
            if (badgeType === 'mission') {
                valMission.classList.add('matched-mission');
            } else if (badgeType === 'crater') {
                valMission.classList.add('matched-crater');
            }
        }
    }

    if (hudExtra) {
        if (showExtra) {
            hudExtra.style.display = 'flex';
            if (labelSite) labelSite.textContent = siteLabel;
            if (valSite) valSite.textContent = siteValue;
            if (labelExtra1) labelExtra1.textContent = extra1Label;
            if (valExtra1) valExtra1.textContent = extra1Value;
            if (labelExtra2) labelExtra2.textContent = extra2Label;
            if (valExtra2) valExtra2.textContent = extra2Value;
        } else {
            hudExtra.style.display = 'none';
        }
    }

    if (hudPanel) {
        hudPanel.classList.add('active');
    }
}

function createPOIMapPin(poi) {
    const isMission = poi.category === 'mission';
    const pinGroup = new THREE.Group();

    const bezelMat = isMission ? missionBezelMat : craterBezelMat;
    const coreMat = isMission ? missionCoreMat : craterCoreMat;
    const beaconMat = isMission ? missionBeaconMat : craterBeaconMat;

    const stemMesh = new THREE.Mesh(poiStemGeo, bezelMat);
    const headMesh = new THREE.Mesh(poiHeadGeo, bezelMat);
    const coreMesh = new THREE.Mesh(poiCoreGeo, coreMat);
    const beaconMesh = new THREE.Mesh(poiBeaconGeo, beaconMat);
    const hitMesh = new THREE.Mesh(poiHitGeo, poiHitMat);

    hitMesh.userData = { poi, pinGroup };

    pinGroup.add(stemMesh);
    pinGroup.add(headMesh);
    pinGroup.add(coreMesh);
    pinGroup.add(beaconMesh);
    pinGroup.add(hitMesh);

    return { pinGroup, hitMesh };
}

function initPOISystem() {
    const allPOIs = [...MISSION_LANDINGS, ...FAMOUS_CRATERS];

    for (const poi of allPOIs) {
        const { pinGroup, hitMesh } = createPOIMapPin(poi);

        // Position pin precisely on surface according to NASA LRO ME frame
        const localNorm = latLonToLocalPosition(poi.lat, poi.lon, 1.0).normalize();
        const pos3D = localNorm.clone().multiplyScalar(1.018);
        const quat3D = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), localNorm);

        // 2D equirectangular cartographic position on unrolled plane
        const mapX = lonToMapX(poi.lon);
        const mapY = latToMapY(poi.lat);
        const pos2D = new THREE.Vector3(mapX, mapY, 0.018);
        const quat2D = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);

        pinGroup.position.copy(pos3D);
        pinGroup.quaternion.copy(quat3D);

        // Add pin as child of Moon so it rotates and unrolls seamlessly with the Moon mesh
        moon.add(pinGroup);
        poiHitMeshes.push(hitMesh);

        // Create 2D screen projected label
        let labelEl = null;
        if (poiLabelsContainer) {
            labelEl = document.createElement('div');
            labelEl.className = `poi-label ${poi.category === 'mission' ? 'mission-label' : 'crater-label'}`;
            labelEl.innerHTML = `
                <span class="poi-label-dot"></span>
                <span class="poi-label-text">${poi.name}</span>
            `;
            labelEl.style.display = 'none';

            // Click label to display in unified Lunar Compass box
            labelEl.addEventListener('pointerdown', (e) => e.stopPropagation());
            labelEl.addEventListener('click', (e) => {
                e.stopPropagation();
                selectPOI(poi);
            });

            poiLabelsContainer.appendChild(labelEl);
        }

        poiEntries.push({ poi, pinGroup, hitMesh, labelEl, localNorm, pos3D, quat3D, pos2D, quat2D, mapX, mapY });
    }
}

initPOISystem();

// Select and display details for a Lunar POI directly inside the Lunar Compass box
function selectPOI(poi) {
    selectedPOI = poi;
    selectedCoords = { lat: poi.lat, lon: poi.lon };

    // Auto-expand HUD if it was collapsed so user sees the details
    setHUDCollapsed(false);

    const absLat = Math.abs(poi.lat);
    const latFormatted = absLat < 0.00005 
        ? '0.0000°' 
        : `${absLat.toFixed(4)}° ${poi.lat > 0 ? 'N' : 'S'}`;
    const lonFormatted = `${poi.lon.toFixed(4)}° E`;

    if (poi.category === 'mission') {
        updateLunarHUD({
            latFormatted,
            lonFormatted,
            badgeText: 'MISSION',
            badgeType: 'mission',
            missionLabel: 'MOON MISSION',
            missionValue: poi.name,
            isMatched: true,
            showExtra: true,
            siteLabel: 'LANDING SITE',
            siteValue: poi.site,
            extra1Label: 'LANDING DATE',
            extra1Value: poi.date || 'N/A',
            extra2Label: 'FEATURE TYPE',
            extra2Value: poi.type || 'Manned / Robotic Lander',
            sourceText: poi.source,
            sourceUrl: poi.sourceUrl
        });
    } else {
        updateLunarHUD({
            latFormatted,
            lonFormatted,
            badgeText: 'CRATER',
            badgeType: 'crater',
            missionLabel: 'CRATER NAME',
            missionValue: poi.name,
            isMatched: true,
            showExtra: true,
            siteLabel: 'GAZETTEER REF',
            siteValue: `USGS Feature #${poi.featureId} • IAU Recognized`,
            extra1Label: 'DIAMETER',
            extra1Value: poi.diameter ? `${poi.diameter.toFixed(1)} km` : 'N/A',
            extra2Label: 'FEATURE TYPE',
            extra2Value: poi.type || 'Impact Crater',
            sourceText: poi.source,
            sourceUrl: poi.sourceUrl
        });
    }

    // Attach synchronized red pointer (📍) to the selected POI
    updateSurfaceMarkerTargets(poi.lat, poi.lon);

    // Smooth navigation based on active view mode
    if (currentViewMode === '2d') {
        pan2DMapTo(lonToMapX(poi.lon), latToMapY(poi.lat), 1.8);
    }
}

// Reusable scratch vectors for frame-by-frame POI label projection
const _tempWorldPos = new THREE.Vector3();
const _tempNormal = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _moonWorldPos = new THREE.Vector3();

function updatePOILabels() {
    const camDist = camera.position.distanceTo(controls.target);
    moon.getWorldPosition(_moonWorldPos);
    _toCam.copy(camera.position).sub(_moonWorldPos).normalize();

    const halfW = window.innerWidth * 0.5;
    const halfH = window.innerHeight * 0.5;

    for (const item of poiEntries) {
        const { poi, pinGroup, labelEl } = item;
        if (!labelEl) continue;

        // In 3D globe mode: occlusion test against lunar horizon / limb
        if (currentViewMode === '3d' && !isModeTransitioning) {
            pinGroup.getWorldPosition(_tempWorldPos);
            _tempNormal.copy(_tempWorldPos).sub(_moonWorldPos).normalize();
            const facingDot = _tempNormal.dot(_toCam);
            if (facingDot <= 0.08) {
                pinGroup.visible = false;
                labelEl.style.display = 'none';
                continue;
            }
        }

        pinGroup.visible = true;

        // Zoom-dependent LOD for labels
        let showLabel = false;
        if (selectedPOI === poi) {
            showLabel = true;
        } else if (currentViewMode === '2d') {
            if (camera.position.z <= 2.6) {
                showLabel = true;
            } else {
                showLabel = poi.major === true;
            }
        } else {
            // 3D globe mode
            if (camDist <= 3.8) {
                showLabel = true;
            } else if (camDist <= 5.8) {
                showLabel = poi.major === true;
            } else {
                showLabel = false;
            }
        }

        if (!showLabel) {
            labelEl.style.display = 'none';
            continue;
        }

        // Project pin head position into 2D screen coordinates
        pinGroup.getWorldPosition(_tempWorldPos);

        let labelPos;
        if (currentViewMode === '2d') {
            labelPos = _tempWorldPos.clone().add(new THREE.Vector3(0, 0.035, 0));
        } else {
            _tempNormal.copy(_tempWorldPos).sub(_moonWorldPos).normalize();
            labelPos = _tempWorldPos.clone().addScaledVector(_tempNormal, 0.036);
        }
        labelPos.project(camera);

        // Discard points behind camera near plane
        if (labelPos.z >= 1.0) {
            labelEl.style.display = 'none';
            continue;
        }

        const screenX = (labelPos.x * halfW) + halfW;
        const screenY = -(labelPos.y * halfH) + halfH;

        // Viewport bounds check with 60px margin
        if (screenX < -60 || screenX > window.innerWidth + 60 || screenY < -60 || screenY > window.innerHeight + 60) {
            labelEl.style.display = 'none';
            continue;
        }

        labelEl.style.display = 'flex';
        labelEl.style.left = `${screenX.toFixed(1)}px`;
        labelEl.style.top = `${screenY.toFixed(1)}px`;
    }
}

// ============================================================================
// 12B. INTERACTIVE 2D FLAT MOON MAP MODE (EQUIRECTANGULAR CARTOGRAPHIC PROJECTION)
// Displays the exact same lunar surface, elevation relief, coordinate grid and POIs
// ============================================================================

// 1. Generate High-Resolution Cartographic Graticule Texture (4096 x 2048)
function createGraticuleTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 4096;
    canvas.height = 2048;
    const ctx = canvas.getContext('2d');
    const cw = 4096;
    const ch = 2048;

    ctx.clearRect(0, 0, cw, ch);

    // Minor / Intermediate Grid lines
    for (let deg = -180; deg <= 180; deg += 15) {
        const px = Math.round(((deg + 180) / 360) * cw);
        const isPrime = (deg === 0);
        const isMajor = (deg % 30 === 0);

        ctx.strokeStyle = isPrime 
            ? 'rgba(56, 189, 248, 0.70)' 
            : isMajor 
                ? 'rgba(80, 140, 220, 0.40)' 
                : 'rgba(100, 120, 150, 0.18)';
        ctx.lineWidth = isPrime ? 3.5 : (isMajor ? 2.0 : 1.2);

        ctx.beginPath();
        ctx.moveTo(px, 0);
        ctx.lineTo(px, ch);
        ctx.stroke();
    }

    // Latitude parallels every 15°
    for (let lat = -90; lat <= 90; lat += 15) {
        const py = Math.round(((90 - lat) / 180) * ch);
        const isEquator = (lat === 0);
        const isMajor = (lat % 30 === 0);

        ctx.strokeStyle = isEquator 
            ? 'rgba(56, 189, 248, 0.70)' 
            : isMajor 
                ? 'rgba(80, 140, 220, 0.40)' 
                : 'rgba(100, 120, 150, 0.18)';
        ctx.lineWidth = isEquator ? 3.5 : (isMajor ? 2.0 : 1.2);

        ctx.beginPath();
        ctx.moveTo(0, py);
        ctx.lineTo(cw, py);
        ctx.stroke();
    }

    // Outer cartographic frame
    ctx.strokeStyle = 'rgba(80, 140, 220, 0.75)';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, cw - 6, ch - 6);

    // Typography setup
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Polar Annotations
    ctx.font = 'bold 34px "SF Mono", Consolas, monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('LUNAR NORTH POLE (+90° LATITUDE)', 2048, 42);
    ctx.fillText('LUNAR SOUTH POLE (-90° LATITUDE)', 2048, ch - 42);

    // Major Hemisphere Annotations
    ctx.font = 'bold 42px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.fillText('NEAR SIDE • EARTH-FACING HEMISPHERE', 2048, 180);
    ctx.fillText('FAR SIDE • WESTERN HEMISPHERE', 1024, 180);
    ctx.fillText('FAR SIDE • EASTERN HEMISPHERE', 3072, 180);

    // Longitude Tick Labels along Top and Bottom
    ctx.font = 'bold 26px "SF Mono", Consolas, monospace';
    const lonLabels = [
        { deg: -180, text: '180°' },
        { deg: -150, text: '210° E (150° W)' },
        { deg: -120, text: '240° E (120° W)' },
        { deg: -90,  text: '270° E (90° W)' },
        { deg: -60,  text: '300° E (60° W)' },
        { deg: -30,  text: '330° E (30° W)' },
        { deg: 0,    text: '0° PRIME MERIDIAN' },
        { deg: 30,   text: '30° E' },
        { deg: 60,   text: '60° E' },
        { deg: 90,   text: '90° E' },
        { deg: 120,  text: '120° E' },
        { deg: 150,  text: '150° E' },
        { deg: 180,  text: '180°' }
    ];

    lonLabels.forEach(lbl => {
        const px = Math.round(((lbl.deg + 180) / 360) * cw);
        ctx.fillStyle = lbl.deg === 0 ? '#38bdf8' : '#94a3b8';
        ctx.fillText(lbl.text, px, 85);
        ctx.fillText(lbl.text, px, ch - 85);
    });

    // Latitude Tick Labels along Prime Meridian and limbs
    const latLabels = [
        { lat: 75,  text: '+75° N' },
        { lat: 60,  text: '+60° N' },
        { lat: 45,  text: '+45° N' },
        { lat: 30,  text: '+30° N' },
        { lat: 15,  text: '+15° N' },
        { lat: 0,   text: '0° EQUATOR' },
        { lat: -15, text: '-15° S' },
        { lat: -30, text: '-30° S' },
        { lat: -45, text: '-45° S' },
        { lat: -60, text: '-60° S' },
        { lat: -75, text: '-75° S' }
    ];

    latLabels.forEach(lbl => {
        const py = Math.round(((90 - lbl.lat) / 180) * ch);
        ctx.fillStyle = lbl.lat === 0 ? '#38bdf8' : '#94a3b8';
        ctx.fillText(lbl.text, 2048, py - (lbl.lat === 0 ? 22 : 0));
        ctx.fillText(lbl.text, 88, py);
        ctx.fillText(lbl.text, cw - 88, py);
    });

    // Major Lunar Mare and Basin Labels (subtle cartographic relief typography)
    ctx.font = 'italic 28px "SF Mono", Georgia, serif';
    ctx.fillStyle = 'rgba(186, 230, 253, 0.40)';
    ctx.fillText('OCEANUS PROCELLARUM', 1700, 890);
    ctx.fillText('MARE IMBRIUM', 1880, 720);
    ctx.fillText('MARE SERENITATIS', 2300, 750);
    ctx.fillText('MARE TRANQUILLITATIS', 2420, 960);
    ctx.fillText('MARE CRISIUM', 2760, 890);
    ctx.fillText('MARE FECUNDITATIS', 2680, 1140);
    ctx.fillText('SOUTH POLE-AITKEN BASIN', 2200, 1620);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// 2. Graticule & Cartographic Annotation Overlay Mesh
// Directly attached as child of Moon: lies flat across the unrolled surface in 2D
const graticuleGeo = new THREE.PlaneGeometry(4.0, 2.0);
const graticuleMat = new THREE.MeshBasicMaterial({
    map: createGraticuleTexture(),
    transparent: true,
    opacity: 0.0,
    depthWrite: false
});
const graticuleMesh = new THREE.Mesh(graticuleGeo, graticuleMat);
graticuleMesh.position.z = 0.008;
graticuleMesh.visible = false;
moon.add(graticuleMesh);

// 3. Lunar Compass Information Panel Collapsible Controller
const btnCollapseHUD = document.getElementById('btn-collapse-hud');
const collapseIcon = document.getElementById('collapse-icon');

function setHUDCollapsed(collapsed) {
    if (!hudPanel) return;
    if (collapsed) {
        hudPanel.classList.add('collapsed');
        if (collapseIcon) {
            collapseIcon.innerHTML = `
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
            `;
        }
        if (btnCollapseHUD) {
            btnCollapseHUD.title = 'Expand Information Panel';
            btnCollapseHUD.setAttribute('aria-label', 'Expand');
        }
    } else {
        hudPanel.classList.remove('collapsed');
        if (collapseIcon) {
            collapseIcon.innerHTML = `
                <line x1="5" y1="12" x2="19" y2="12"></line>
            `;
        }
        if (btnCollapseHUD) {
            btnCollapseHUD.title = 'Minimize Information Panel';
            btnCollapseHUD.setAttribute('aria-label', 'Minimize');
        }
    }
}

if (btnCollapseHUD) {
    btnCollapseHUD.addEventListener('click', (e) => {
        e.stopPropagation();
        const isCollapsed = hudPanel.classList.contains('collapsed');
        setHUDCollapsed(!isCollapsed);
    });
}

const hudHeaderEl = document.querySelector('#lunar-hud .hud-header');
if (hudHeaderEl) {
    hudHeaderEl.addEventListener('click', () => {
        if (hudPanel.classList.contains('collapsed')) {
            setHUDCollapsed(false);
        }
    });
}

// 4. 2D Map Smooth Camera Navigation State
let is2DNavigating = false;
let nav2DStartTime = 0;
const nav2DDuration = 850;
const nav2DStartPos = new THREE.Vector3();
const nav2DEndPos = new THREE.Vector3();
const nav2DStartTarget = new THREE.Vector3();
const nav2DEndTarget = new THREE.Vector3();

function pan2DMapTo(targetX, targetY, targetZ = 1.8) {
    if (isModeTransitioning) return;
    nav2DStartPos.copy(camera.position);
    nav2DEndPos.set(targetX, targetY, Math.min(camera.position.z, targetZ));
    nav2DStartTarget.copy(controls.target);
    nav2DEndTarget.set(targetX, targetY, 0);
    nav2DStartTime = performance.now();
    is2DNavigating = true;
}

// 5. Silky-Smooth Cinematic Physical Unrolling / Wrapping Morph Transition State
let isModeTransitioning = false;
let modeTransitionStart = 0;
const modeTransitionDuration = 1400; // 1.4s smooth physical morph
// ============================================================================
// 12B. VIEW MODE SWITCHER (3D GLOBE <-> 2D FLAT MAP)
// Clean, instant toggle between 3D Globe and 2D Flat Map modes
// ============================================================================

function setViewMode(mode) {
    if (mode === currentViewMode) return;
    currentViewMode = mode;

    const btn3d = document.getElementById('btn-mode-3d');
    const btn2d = document.getElementById('btn-mode-2d');
    const toolbar2D = document.getElementById('mode-2d-toolbar');

    isNavigating = false;
    is2DNavigating = false;

    if (mode === '2d') {
        if (btn3d) btn3d.classList.remove('active');
        if (btn2d) btn2d.classList.add('active');
        if (toolbar2D) toolbar2D.style.display = 'inline-flex';
        hudPanel.classList.add('mode-2d-hud');

        // Instant 2D configuration: flat equirectangular projection
        moon.morphTargetInfluences[0] = 1.0;
        moon.rotation.set(0, 0, 0);

        graticuleMesh.visible = true;
        graticuleMat.opacity = 0.95;

        starsMaterial.opacity = 0.0;
        ambientLight.intensity = 0.45;
        sunLight.intensity = 2.4;

        // Position POI markers on 2D map
        for (const item of poiEntries) {
            item.pinGroup.position.copy(item.pos2D);
            item.pinGroup.quaternion.copy(item.quat2D);
        }

        // Set controls for 2D pan/zoom
        controls.enableRotate = false;
        controls.screenSpacePanning = true;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        controls.minDistance = 0.5;
        controls.maxDistance = 6.0;

        if (selectedCoords) {
            const mx = lonToMapX(selectedCoords.lon);
            const my = latToMapY(selectedCoords.lat);
            surfaceMarker.position.copy(markerPos2D);
            surfaceMarker.quaternion.copy(markerQuat2D);
            surfaceMarker.visible = true;
            camera.position.set(mx, my, 2.0);
            controls.target.set(mx, my, 0);
        } else {
            camera.position.set(0.25, 0, 2.9);
            controls.target.set(0.25, 0, 0);
        }
        controls.update();
    } else {
        // Exit any active 2D distance measurement
        exitMeasurementMode();

        if (btn2d) btn2d.classList.remove('active');
        if (btn3d) btn3d.classList.add('active');
        if (toolbar2D) toolbar2D.style.display = 'none';
        hudPanel.classList.remove('mode-2d-hud');

        // Instant 3D configuration: spherical Moon globe
        moon.morphTargetInfluences[0] = 0.0;
        moon.rotation.set(0, -Math.PI / 2, 0);

        graticuleMesh.visible = false;
        graticuleMat.opacity = 0.0;

        starsMaterial.opacity = 0.85;
        ambientLight.intensity = 0.08;
        sunLight.intensity = 3.6;

        // Position POI markers on 3D sphere
        for (const item of poiEntries) {
            item.pinGroup.position.copy(item.pos3D);
            item.pinGroup.quaternion.copy(item.quat3D);
        }

        // Restore 3D OrbitControls
        controls.enableRotate = true;
        controls.screenSpacePanning = false;
        controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN
        };
        controls.minDistance = 1.4;
        controls.maxDistance = 10.0;

        if (selectedCoords) {
            const localNorm = latLonToLocalPosition(selectedCoords.lat, selectedCoords.lon, 1.0).normalize();
            surfaceMarker.position.copy(markerPos3D);
            surfaceMarker.quaternion.copy(markerQuat3D);
            surfaceMarker.visible = true;

            const worldDir = localNorm.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2);
            camera.position.copy(worldDir.multiplyScalar(3.0));
            controls.target.set(0, 0, 0);
        } else {
            camera.position.set(0, 0, 3.2);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
        }
        controls.update();
    }
}

// ============================================================================
// 12C. 2D FLAT MAP ONLY: INTERACTIVE LUNAR DISTANCE MEASUREMENT TOOL
// NASA LOLA Altimetry (1024x512) + Haversine Great Circle Geodesic Integration
// ============================================================================

let measureState = 'IDLE'; // 'IDLE' | 'SELECTING_START' | 'DRAWING' | 'COMPLETED'
let measureStartCoords = null; // { lat, lon }
let measureEndCoords = null;   // { lat, lon }
let isDraggingMeasure = false;

// LOLA Altimetry Data Store (1024 x 512 Equirectangular elevation data)
let heightmapData = null;
const HEIGHTMAP_WIDTH = 1024;
const HEIGHTMAP_HEIGHT = 512;

function initElevationData() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = '/moon-height.jpg';
    img.onload = () => {
        const c = document.createElement('canvas');
        c.width = HEIGHTMAP_WIDTH;
        c.height = HEIGHTMAP_HEIGHT;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT);
        try {
            heightmapData = ctx.getImageData(0, 0, HEIGHTMAP_WIDTH, HEIGHTMAP_HEIGHT).data;
        } catch (e) {
            console.warn('Heightmap canvas read warning:', e);
        }
    };
}
initElevationData();

// Bilinear lunar elevation sampling relative to datum R = 1737.4 km
function sampleHeightmapElevationKm(lat, lon) {
    if (!heightmapData) return 0.0;

    const mx = lonToMapX(lon);
    const my = latToMapY(lat);

    const u = (mx + 2.0) / 4.0;
    const v = (my + 1.0) / 2.0;

    const fx = Math.max(0, Math.min(1, u)) * (HEIGHTMAP_WIDTH - 1);
    const fy = (1.0 - Math.max(0, Math.min(1, v))) * (HEIGHTMAP_HEIGHT - 1);

    const x0 = Math.floor(fx);
    const x1 = Math.min(HEIGHTMAP_WIDTH - 1, x0 + 1);
    const y0 = Math.floor(fy);
    const y1 = Math.min(HEIGHTMAP_HEIGHT - 1, y0 + 1);

    const wx = fx - x0;
    const wy = fy - y0;

    const i00 = (y0 * HEIGHTMAP_WIDTH + x0) * 4;
    const i10 = (y0 * HEIGHTMAP_WIDTH + x1) * 4;
    const i01 = (y1 * HEIGHTMAP_WIDTH + x0) * 4;
    const i11 = (y1 * HEIGHTMAP_WIDTH + x1) * 4;

    const v00 = heightmapData[i00];
    const v10 = heightmapData[i10];
    const v01 = heightmapData[i01];
    const v11 = heightmapData[i11];

    const top = v00 * (1 - wx) + v10 * wx;
    const bottom = v01 * (1 - wx) + v11 * wx;
    const rawVal = top * (1 - wy) + bottom * wy;

    // LOLA lunar elevation scale: -9.1 km to +10.8 km
    return -9.1 + (rawVal / 255.0) * 19.9;
}

// Compute great-circle path points with seam-crossing protection
function getGreatCircleSegments(lat1, lon1, lat2, lon2, numSteps = 80) {
    const toRad = Math.PI / 180;
    const phi1 = lat1 * toRad;
    const lam1 = lon1 * toRad;
    const phi2 = lat2 * toRad;
    const lam2 = lon2 * toRad;

    const v1 = new THREE.Vector3(Math.cos(phi1) * Math.cos(lam1), Math.sin(phi1), -Math.cos(phi1) * Math.sin(lam1));
    const v2 = new THREE.Vector3(Math.cos(phi2) * Math.cos(lam2), Math.sin(phi2), -Math.cos(phi2) * Math.sin(lam2));

    const dot = Math.max(-1, Math.min(1, v1.dot(v2)));
    const omega = Math.acos(dot);

    const segments = [];
    let currentSegment = [];

    if (omega < 1e-6) {
        const x = lonToMapX(lon1);
        const y = latToMapY(lat1);
        return [[[new THREE.Vector3(x, y, 0.016), new THREE.Vector3(x, y, 0.016)]]];
    }

    const sinOmega = Math.sin(omega);

    for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        const s1 = Math.sin((1 - t) * omega) / sinOmega;
        const s2 = Math.sin(t * omega) / sinOmega;

        const vx = s1 * v1.x + s2 * v2.x;
        const vy = s1 * v1.y + s2 * v2.y;
        const vz = s1 * v1.z + s2 * v2.z;

        const lat = Math.asin(Math.max(-1, Math.min(1, vy))) / toRad;
        let lon = Math.atan2(-vz, vx) / toRad;
        if (lon < 0) lon += 360;

        const mx = lonToMapX(lon);
        const my = latToMapY(lat);
        const pt = new THREE.Vector3(mx, my, 0.016);

        if (currentSegment.length > 0) {
            const prev = currentSegment[currentSegment.length - 1];
            // Seam wrap test: jump across map from left to right (> 2.0 in map coordinate space)
            if (Math.abs(mx - prev.x) > 2.0) {
                segments.push(currentSegment);
                currentSegment = [];
            }
        }
        currentSegment.push(pt);
    }

    if (currentSegment.length > 0) {
        segments.push(currentSegment);
    }
    return segments;
}

// Scientific Distance Calculations (Great Circle Sphere + LOLA Terrain Elevation)
function calculateLunarDistance(lat1, lon1, lat2, lon2, numSamples = 80) {
    const toRad = Math.PI / 180;
    const phi1 = lat1 * toRad;
    const lam1 = lon1 * toRad;
    const phi2 = lat2 * toRad;
    const lam2 = lon2 * toRad;

    // Haversine Great Circle Distance (Reference Sphere R = 1737.4 km)
    const dPhi = phi2 - phi1;
    let dLam = lam2 - lam1;
    dLam = ((dLam + Math.PI) % (Math.PI * 2)) - Math.PI;

    const sinHalfPhi = Math.sin(dPhi * 0.5);
    const sinHalfLam = Math.sin(dLam * 0.5);
    const haversineA = sinHalfPhi * sinHalfPhi + Math.cos(phi1) * Math.cos(phi2) * sinHalfLam * sinHalfLam;
    const centralAngleRad = 2.0 * Math.asin(Math.min(1.0, Math.sqrt(haversineA)));

    const R_LUNA_KM = 1737.4;
    const sphereDistKm = R_LUNA_KM * centralAngleRad;

    if (centralAngleRad < 1e-6) {
        const e = sampleHeightmapElevationKm(lat1, lon1);
        return {
            sphereDistKm: 0,
            terrainDistKm: 0,
            centralAngleDeg: 0,
            elevDifferenceKm: 0,
            minElevationKm: e,
            maxElevationKm: e,
            elevationGainKm: 0,
            elevationLossKm: 0
        };
    }

    // Terrain-following geodesic integration
    const v1 = new THREE.Vector3(Math.cos(phi1) * Math.cos(lam1), Math.sin(phi1), -Math.cos(phi1) * Math.sin(lam1));
    const v2 = new THREE.Vector3(Math.cos(phi2) * Math.cos(lam2), Math.sin(phi2), -Math.cos(phi2) * Math.sin(lam2));
    const sinOmega = Math.sin(centralAngleRad);

    let terrainDistKm = 0;
    let minElev = Infinity;
    let maxElev = -Infinity;
    let prevPoint3D = null;
    let totalGain = 0;
    let totalLoss = 0;
    let prevElev = 0;

    for (let i = 0; i <= numSamples; i++) {
        const t = i / numSamples;
        const s1 = Math.sin((1 - t) * centralAngleRad) / sinOmega;
        const s2 = Math.sin(t * centralAngleRad) / sinOmega;

        const vx = s1 * v1.x + s2 * v2.x;
        const vy = s1 * v1.y + s2 * v2.y;
        const vz = s1 * v1.z + s2 * v2.z;

        const sLat = Math.asin(Math.max(-1, Math.min(1, vy))) / toRad;
        let sLon = Math.atan2(-vz, vx) / toRad;
        if (sLon < 0) sLon += 360;

        const elevKm = sampleHeightmapElevationKm(sLat, sLon);
        minElev = Math.min(minElev, elevKm);
        maxElev = Math.max(maxElev, elevKm);

        const rEff = R_LUNA_KM + elevKm;
        const normLen = Math.hypot(vx, vy, vz);
        const point3D = new THREE.Vector3(
            rEff * (vx / normLen),
            rEff * (vy / normLen),
            rEff * (vz / normLen)
        );

        if (prevPoint3D) {
            terrainDistKm += point3D.distanceTo(prevPoint3D);
            const diff = elevKm - prevElev;
            if (diff > 0) totalGain += diff;
            else totalLoss += Math.abs(diff);
        }

        prevPoint3D = point3D;
        prevElev = elevKm;
    }

    return {
        sphereDistKm,
        terrainDistKm: Math.max(sphereDistKm, terrainDistKm),
        centralAngleDeg: (centralAngleRad * 180) / Math.PI,
        elevDifferenceKm: maxElev - minElev,
        minElevationKm: minElev,
        maxElevationKm: maxElev,
        elevationGainKm: totalGain,
        elevationLossKm: totalLoss
    };
}

// 3D Object Group for Measurement Markers & Paths
const measureGroup = new THREE.Group();
measureGroup.visible = false;
moon.add(measureGroup);

function createMeasureMarker(letter, colorHex, coreColorHex) {
    const grp = new THREE.Group();
    grp.visible = false;

    // Outer pulsing ring
    const ringGeo = new THREE.RingGeometry(0.016, 0.026, 32);
    const ringMat = new THREE.MeshBasicMaterial({
        color: colorHex,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    grp.add(ring);

    // Inner core disc
    const coreGeo = new THREE.CircleGeometry(0.015, 32);
    const coreMat = new THREE.MeshBasicMaterial({
        color: coreColorHex,
        side: THREE.DoubleSide,
        depthWrite: false
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.z = 0.001;
    grp.add(core);

    // Letter label ("A" or "B")
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px "SF Mono", Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(letter, 32, 34);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const labelGeo = new THREE.PlaneGeometry(0.022, 0.022);
    const labelMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false
    });
    const labelMesh = new THREE.Mesh(labelGeo, labelMat);
    labelMesh.position.z = 0.002;
    grp.add(labelMesh);

    return { grp, ring, ringMat };
}

const markerA = createMeasureMarker('A', 0x38bdf8, 0x082f49);
const markerB = createMeasureMarker('B', 0x10b981, 0x064e3b);
measureGroup.add(markerA.grp);
measureGroup.add(markerB.grp);

const previewLineGroup = new THREE.Group();
measureGroup.add(previewLineGroup);

const confirmedPathGroup = new THREE.Group();
measureGroup.add(confirmedPathGroup);

function clearPreviewLine() {
    while (previewLineGroup.children.length > 0) {
        const child = previewLineGroup.children.pop();
        if (child.geometry) child.geometry.dispose();
    }
}

function updatePreviewPath(startLat, startLon, endLat, endLon) {
    clearPreviewLine();
    const segments = getGreatCircleSegments(startLat, startLon, endLat, endLon, 48);
    const lineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
    });

    for (const seg of segments) {
        if (seg.length < 2) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(seg);
        const line = new THREE.Line(geo, lineMat);
        previewLineGroup.add(line);
    }
}

function clearConfirmedPath() {
    while (confirmedPathGroup.children.length > 0) {
        const child = confirmedPathGroup.children.pop();
        if (child.geometry) child.geometry.dispose();
    }
}

function renderConfirmedPath(startLat, startLon, endLat, endLon) {
    clearConfirmedPath();
    const segments = getGreatCircleSegments(startLat, startLon, endLat, endLon, 80);
    const dashedMat = new THREE.LineDashedMaterial({
        color: 0x38bdf8,
        dashSize: 0.035,
        gapSize: 0.02,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    });

    const beadGeo = new THREE.CircleGeometry(0.004, 16);
    const beadMat = new THREE.MeshBasicMaterial({
        color: 0xe0f2fe,
        side: THREE.DoubleSide,
        depthWrite: false
    });

    for (const seg of segments) {
        if (seg.length < 2) continue;
        const geo = new THREE.BufferGeometry().setFromPoints(seg);
        const line = new THREE.Line(geo, dashedMat);
        line.computeLineDistances();
        confirmedPathGroup.add(line);

        for (let i = 0; i < seg.length; i += 8) {
            const bead = new THREE.Mesh(beadGeo, beadMat);
            bead.position.set(seg[i].x, seg[i].y, 0.017);
            confirmedPathGroup.add(bead);
        }
    }
}

// UI Elements & State Controllers
const btnMeasureDistance = document.getElementById('btn-measure-distance');
const measureGuidePill = document.getElementById('measure-guide-pill');
const measureGuideText = document.getElementById('measure-guide-text');
const btnCancelMeasure = document.getElementById('btn-cancel-measure');
const measureCursorTag = document.getElementById('measure-cursor-tag');
const measureInfoPanel = document.getElementById('measure-info-panel');
const btnCloseMeasurePanel = document.getElementById('btn-close-measure-panel');
const btnMeasureAgain = document.getElementById('btn-measure-again');
const btnMeasureClear = document.getElementById('btn-measure-clear');
const btnMeasureExit = document.getElementById('btn-measure-exit');

function enterMeasurementMode() {
    if (currentViewMode !== '2d') return;
    measureState = 'SELECTING_START';
    measureStartCoords = null;
    measureEndCoords = null;
    isDraggingMeasure = false;

    markerA.grp.visible = false;
    markerB.grp.visible = false;
    clearPreviewLine();
    clearConfirmedPath();
    measureGroup.visible = true;

    if (btnMeasureDistance) btnMeasureDistance.classList.add('active');
    if (measureGuidePill) {
        measureGuidePill.style.display = 'flex';
        if (measureGuideText) measureGuideText.textContent = 'CLICK STARTING POINT ON MOON';
    }
    if (measureInfoPanel) measureInfoPanel.style.display = 'none';
    if (measureCursorTag) measureCursorTag.style.display = 'none';

    renderer.domElement.style.cursor = 'crosshair';
}

function exitMeasurementMode() {
    measureState = 'IDLE';
    measureStartCoords = null;
    measureEndCoords = null;
    isDraggingMeasure = false;

    markerA.grp.visible = false;
    markerB.grp.visible = false;
    clearPreviewLine();
    clearConfirmedPath();
    measureGroup.visible = false;

    if (btnMeasureDistance) btnMeasureDistance.classList.remove('active');
    if (measureGuidePill) measureGuidePill.style.display = 'none';
    if (measureInfoPanel) measureInfoPanel.style.display = 'none';
    if (measureCursorTag) measureCursorTag.style.display = 'none';

    renderer.domElement.style.cursor = 'default';
}

function displayMeasurementResults(startLat, startLon, endLat, endLon) {
    const results = calculateLunarDistance(startLat, startLon, endLat, endLon, 80);

    const valTerrain = document.getElementById('measure-val-terrain');
    const valSphere = document.getElementById('measure-val-sphere');
    const valAngle = document.getElementById('measure-val-angle');
    const valDelta = document.getElementById('measure-val-delta');
    const valElevRange = document.getElementById('measure-val-elev-range');
    const startCoordsEl = document.getElementById('measure-start-coords');
    const endCoordsEl = document.getElementById('measure-end-coords');

    if (valTerrain) valTerrain.textContent = results.terrainDistKm.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    if (valSphere) valSphere.textContent = `${results.sphereDistKm.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
    if (valAngle) valAngle.textContent = `${results.centralAngleDeg.toFixed(2)}°`;

    const deltaKm = results.terrainDistKm - results.sphereDistKm;
    if (valDelta) valDelta.textContent = `+${deltaKm.toFixed(2)} km (+${((deltaKm / Math.max(1, results.sphereDistKm)) * 100).toFixed(2)}%)`;

    const minSign = results.minElevationKm >= 0 ? '+' : '';
    const maxSign = results.maxElevationKm >= 0 ? '+' : '';
    if (valElevRange) valElevRange.textContent = `${minSign}${results.minElevationKm.toFixed(1)} to ${maxSign}${results.maxElevationKm.toFixed(1)} km`;

    const formatPair = (lat, lon) => {
        const absLat = Math.abs(lat);
        const latStr = absLat < 0.00005 ? '0.0000°' : `${absLat.toFixed(4)}° ${lat > 0 ? 'N' : 'S'}`;
        const finalLon = (lon >= 359.99995 || lon < 0.00005) ? 0 : lon;
        const lonStr = `${finalLon.toFixed(4)}° E`;
        return `${latStr}, ${lonStr}`;
    };

    if (startCoordsEl) startCoordsEl.textContent = formatPair(startLat, startLon);
    if (endCoordsEl) endCoordsEl.textContent = formatPair(endLat, endLon);

    if (measureInfoPanel) measureInfoPanel.style.display = 'block';
    if (measureGuidePill) measureGuidePill.style.display = 'none';
    if (measureCursorTag) measureCursorTag.style.display = 'none';
    renderer.domElement.style.cursor = 'default';
}

if (btnMeasureDistance) {
    btnMeasureDistance.addEventListener('click', (e) => {
        e.stopPropagation();
        if (measureState === 'IDLE') {
            enterMeasurementMode();
        } else {
            exitMeasurementMode();
        }
    });
}

if (btnCancelMeasure) btnCancelMeasure.addEventListener('click', (e) => { e.stopPropagation(); exitMeasurementMode(); });
if (btnCloseMeasurePanel) btnCloseMeasurePanel.addEventListener('click', (e) => { e.stopPropagation(); exitMeasurementMode(); });
if (btnMeasureExit) btnMeasureExit.addEventListener('click', (e) => { e.stopPropagation(); exitMeasurementMode(); });

if (btnMeasureAgain) {
    btnMeasureAgain.addEventListener('click', (e) => {
        e.stopPropagation();
        enterMeasurementMode();
    });
}

if (btnMeasureClear) {
    btnMeasureClear.addEventListener('click', (e) => {
        e.stopPropagation();
        markerA.grp.visible = false;
        markerB.grp.visible = false;
        clearPreviewLine();
        clearConfirmedPath();
        if (measureInfoPanel) measureInfoPanel.style.display = 'none';
        measureState = 'SELECTING_START';
        if (measureGuidePill) {
            measureGuidePill.style.display = 'flex';
            if (measureGuideText) measureGuideText.textContent = 'CLICK STARTING POINT ON MOON';
        }
        renderer.domElement.style.cursor = 'crosshair';
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && measureState !== 'IDLE') {
        exitMeasurementMode();
    }
});

// Hook up View Mode switcher buttons & map reset button
const btnMode3D = document.getElementById('btn-mode-3d');
const btnMode2D = document.getElementById('btn-mode-2d');
const btnResetMap = document.getElementById('btn-reset-map');

if (btnMode3D) btnMode3D.addEventListener('click', () => setViewMode('3d'));
if (btnMode2D) btnMode2D.addEventListener('click', () => setViewMode('2d'));
if (btnResetMap) btnResetMap.addEventListener('click', () => {
    if (currentViewMode === '2d') {
        pan2DMapTo(0.25, 0, 2.9);
    }
});

// Raycaster & Precision Coordinate Detection (NASA LRO Mean Earth / Polar Axis)
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

let pointerDownPos = { x: 0, y: 0 };
let pointerDownTime = 0;

renderer.domElement.addEventListener('pointerdown', (e) => {
    isNavigating = false; // User took manual control
    is2DNavigating = false;
    pointerDownPos = { x: e.clientX, y: e.clientY };
    pointerDownTime = performance.now();

    if (isPointerOverCompass(e.clientX, e.clientY)) return;

    // Measurement Mode Handlers (2D Only)
    if (currentViewMode === '2d' && measureState !== 'IDLE') {
        const rect = renderer.domElement.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);

        const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hitPoint = new THREE.Vector3();

        if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
            if (hitPoint.x >= -2.0 && hitPoint.x <= 2.0 && hitPoint.y >= -1.0 && hitPoint.y <= 1.0) {
                const lat = mapYToLat(hitPoint.y);
                const lon = mapXToLon(hitPoint.x);

                if (measureState === 'SELECTING_START') {
                    measureStartCoords = { lat, lon };
                    markerA.grp.position.set(hitPoint.x, hitPoint.y, 0.018);
                    markerA.grp.visible = true;
                    markerB.grp.visible = false;
                    clearPreviewLine();
                    clearConfirmedPath();
                    measureState = 'DRAWING';
                    isDraggingMeasure = true;
                    controls.enablePan = false;

                    if (measureGuideText) measureGuideText.textContent = 'DRAG OR CLICK TO PIN ENDPOINT (B)';
                    if (measureCursorTag) measureCursorTag.style.display = 'block';
                } else if (measureState === 'DRAWING') {
                    isDraggingMeasure = true;
                    controls.enablePan = false;
                }
            }
        }
    }
});

function isPointerOverCompass(clientX, clientY) {
    const isMobile = window.innerWidth < 640;
    const compassSize = isMobile ? 92 : 112;
    const margin = isMobile ? 16 : 24;
    return (
        clientX >= window.innerWidth - compassSize - margin &&
        clientY <= compassSize + margin
    );
}

// Hover cursor indication and interactive measurement drawing
renderer.domElement.addEventListener('pointermove', (e) => {
    if (isPointerOverCompass(e.clientX, e.clientY)) {
        renderer.domElement.style.cursor = 'pointer';
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);

    // 2D Distance Measurement Mode Handling
    if (currentViewMode === '2d' && measureState !== 'IDLE') {
        if (measureState === 'DRAWING' && measureStartCoords) {
            const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
            const hitPoint = new THREE.Vector3();
            if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
                const clampedX = Math.max(-2.0, Math.min(2.0, hitPoint.x));
                const clampedY = Math.max(-1.0, Math.min(1.0, hitPoint.y));
                const currLat = mapYToLat(clampedY);
                const currLon = mapXToLon(clampedX);

                updatePreviewPath(measureStartCoords.lat, measureStartCoords.lon, currLat, currLon);

                const d = calculateLunarDistance(measureStartCoords.lat, measureStartCoords.lon, currLat, currLon, 16);
                if (measureCursorTag) {
                    measureCursorTag.textContent = `${Math.round(d.sphereDistKm).toLocaleString()} km`;
                    measureCursorTag.style.left = `${e.clientX + 16}px`;
                    measureCursorTag.style.top = `${e.clientY - 28}px`;
                    measureCursorTag.style.display = 'block';
                }

                // Natural map panning when dragging near viewport edges
                if (isDraggingMeasure) {
                    const margin = 70;
                    let edgePanX = 0;
                    let edgePanY = 0;
                    const zoomFactor = Math.max(0.4, camera.position.z / 2.5);

                    if (e.clientX < margin) {
                        edgePanX = -((margin - e.clientX) / margin) * 0.04 * zoomFactor;
                    } else if (e.clientX > window.innerWidth - margin) {
                        edgePanX = ((e.clientX - (window.innerWidth - margin)) / margin) * 0.04 * zoomFactor;
                    }

                    if (e.clientY < margin) {
                        edgePanY = ((margin - e.clientY) / margin) * 0.04 * zoomFactor;
                    } else if (e.clientY > window.innerHeight - margin) {
                        edgePanY = -((e.clientY - (window.innerHeight - margin)) / margin) * 0.04 * zoomFactor;
                    }

                    if (edgePanX !== 0 || edgePanY !== 0) {
                        camera.position.x += edgePanX;
                        camera.position.y += edgePanY;
                        controls.target.x += edgePanX;
                        controls.target.y += edgePanY;
                    }
                }
            }
            renderer.domElement.style.cursor = 'crosshair';
            return;
        } else if (measureState === 'SELECTING_START') {
            renderer.domElement.style.cursor = 'crosshair';
            return;
        } else if (measureState === 'COMPLETED') {
            renderer.domElement.style.cursor = 'default';
            return;
        }
    }

    // Normal Hover Checks (POI and Moon surface)
    // Check if hovering over any POI marker hit sphere in 3D or 2D
    const poiIntersects = raycaster.intersectObjects(poiHitMeshes, false);
    if (poiIntersects.length > 0) {
        renderer.domElement.style.cursor = 'pointer';
        return;
    }

    if (currentViewMode === '2d') {
        const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
            if (hitPoint.x >= -2.0 && hitPoint.x <= 2.0 && hitPoint.y >= -1.0 && hitPoint.y <= 1.0) {
                renderer.domElement.style.cursor = 'crosshair';
                return;
            }
        }
        renderer.domElement.style.cursor = 'default';
        return;
    }

    // Check if hovering over Moon surface in 3D
    const moonIntersects = raycaster.intersectObject(moon, false);
    renderer.domElement.style.cursor = moonIntersects.length > 0 ? 'crosshair' : 'default';
});

renderer.domElement.addEventListener('pointerup', (e) => {
    // Only primary button (left click)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    // Ignore surface raycasting if compass was clicked
    if (isPointerOverCompass(e.clientX, e.clientY)) {
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // ========================================================================
    // MEASUREMENT MODE HANDLING (2D FLAT MAP ONLY)
    // ========================================================================
    if (currentViewMode === '2d' && measureState !== 'IDLE') {
        controls.enablePan = true;
        const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hitPoint = new THREE.Vector3();

        if (measureState === 'SELECTING_START') {
            if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
                if (hitPoint.x >= -2.0 && hitPoint.x <= 2.0 && hitPoint.y >= -1.0 && hitPoint.y <= 1.0) {
                    const lat = mapYToLat(hitPoint.y);
                    const lon = mapXToLon(hitPoint.x);
                    measureStartCoords = { lat, lon };
                    markerA.grp.position.set(hitPoint.x, hitPoint.y, 0.018);
                    markerA.grp.visible = true;
                    markerB.grp.visible = false;
                    clearPreviewLine();
                    clearConfirmedPath();
                    measureState = 'DRAWING';
                    isDraggingMeasure = false;
                    if (measureGuideText) measureGuideText.textContent = 'CLICK OR DRAG TO PIN DESTINATION (B)';
                    if (measureCursorTag) measureCursorTag.style.display = 'block';
                }
            }
            return;
        }

        if (measureState === 'DRAWING' && measureStartCoords) {
            if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
                const clampedX = Math.max(-2.0, Math.min(2.0, hitPoint.x));
                const clampedY = Math.max(-1.0, Math.min(1.0, hitPoint.y));
                const endLat = mapYToLat(clampedY);
                const endLon = mapXToLon(clampedX);

                const dx = e.clientX - pointerDownPos.x;
                const dy = e.clientY - pointerDownPos.y;
                const screenDist = Math.hypot(dx, dy);
                const dKm = calculateGreatCircleDistanceKm(measureStartCoords.lat, measureStartCoords.lon, endLat, endLon);

                if (screenDist > 6 || !isDraggingMeasure || dKm > 3) {
                    measureEndCoords = { lat: endLat, lon: endLon };
                    markerB.grp.position.set(clampedX, clampedY, 0.018);
                    markerB.grp.visible = true;

                    clearPreviewLine();
                    renderConfirmedPath(measureStartCoords.lat, measureStartCoords.lon, endLat, endLon);
                    displayMeasurementResults(measureStartCoords.lat, measureStartCoords.lon, endLat, endLon);

                    measureState = 'COMPLETED';
                    isDraggingMeasure = false;
                    return;
                }
            }
            isDraggingMeasure = false;
            return;
        }

        if (measureState === 'COMPLETED') {
            isDraggingMeasure = false;
            return;
        }
    }

    // Disambiguate click from OrbitControls drag/orbit
    const dx = e.clientX - pointerDownPos.x;
    const dy = e.clientY - pointerDownPos.y;
    const dist = Math.hypot(dx, dy);
    const duration = performance.now() - pointerDownTime;

    if (dist > 5 || duration > 500) {
        return; // User was dragging/orbiting the camera
    }

    // 1. Raycast POI markers FIRST in both 2D and 3D: disambiguates marker clicks from general surface
    const poiIntersects = raycaster.intersectObjects(poiHitMeshes, false);
    if (poiIntersects.length > 0) {
        const hitObj = poiIntersects[0].object;
        if (hitObj.userData && hitObj.userData.poi) {
            selectPOI(hitObj.userData.poi);
            return;
        }
    }

    // 2. 2D Map Surface Click Detection
    if (currentViewMode === '2d') {
        const flatPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const hitPoint = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(flatPlane, hitPoint)) {
            if (hitPoint.x >= -2.0 && hitPoint.x <= 2.0 && hitPoint.y >= -1.0 && hitPoint.y <= 1.0) {
                const lat = mapYToLat(hitPoint.y);
                const lon = mapXToLon(hitPoint.x);
                onLunarSurfacePointSelected(lat, lon);
            }
        }
        return;
    }

    // 3. 3D Globe Surface Click Detection
    onLunarSurfaceClick(e.clientX, e.clientY);
});

window.addEventListener('pointercancel', () => {
    isDraggingMeasure = false;
    if (controls) controls.enablePan = true;
});

// Single unified handler for lunar coordinate selection across 3D and 2D
function onLunarSurfacePointSelected(lat, lon) {
    selectedCoords = { lat, lon };

    const absLat = Math.abs(lat);
    let latFormatted = absLat < 0.00005 ? '0.0000°' : `${absLat.toFixed(4)}° ${lat > 0 ? 'N' : 'S'}`;
    let finalLon = (lon >= 359.99995 || lon < 0.00005) ? 0 : lon;
    const lonFormatted = `${finalLon.toFixed(4)}° E`;

    // Proximity check for verified missions
    const missionResult = identifyLunarMission(lat, finalLon);

    // Proximity check for famous craters
    let matchedCrater = null;
    for (const c of FAMOUS_CRATERS) {
        const d = calculateGreatCircleDistanceKm(lat, finalLon, c.lat, c.lon);
        if (d <= Math.max(c.diameter / 2, 25)) {
            matchedCrater = c;
            break;
        }
    }

    if (missionResult.found && missionResult.mission) {
        const m = missionResult.mission;
        selectedPOI = m;
        updateLunarHUD({
            latFormatted,
            lonFormatted,
            badgeText: 'MISSION',
            badgeType: 'mission',
            missionLabel: 'MOON MISSION',
            missionValue: missionResult.text,
            isMatched: true,
            showExtra: true,
            siteLabel: 'LANDING SITE',
            siteValue: m.site,
            extra1Label: 'LANDING DATE',
            extra1Value: m.date || 'N/A',
            extra2Label: 'FEATURE TYPE',
            extra2Value: m.type || 'Manned / Robotic Lander',
            sourceText: m.source,
            sourceUrl: m.sourceUrl
        });
    } else if (matchedCrater) {
        selectedPOI = matchedCrater;
        updateLunarHUD({
            latFormatted,
            lonFormatted,
            badgeText: 'CRATER',
            badgeType: 'crater',
            missionLabel: 'CRATER NAME',
            missionValue: matchedCrater.name,
            isMatched: true,
            showExtra: true,
            siteLabel: 'GAZETTEER REF',
            siteValue: `USGS Feature #${matchedCrater.featureId} • IAU Recognized`,
            extra1Label: 'DIAMETER',
            extra1Value: `${matchedCrater.diameter.toFixed(1)} km`,
            extra2Label: 'FEATURE TYPE',
            extra2Value: matchedCrater.type,
            sourceText: matchedCrater.source,
            sourceUrl: matchedCrater.sourceUrl
        });
    } else {
        selectedPOI = null;
        updateLunarHUD({
            latFormatted,
            lonFormatted,
            badgeText: 'LRO ME',
            badgeType: 'default',
            missionLabel: 'MOON MISSION',
            missionValue: 'No nearby verified landing site',
            isMatched: false,
            showExtra: false
        });
    }

    // Attach synchronized red pointer (📍) to surface
    updateSurfaceMarkerTargets(lat, finalLon);
}

function onLunarSurfaceClick(clientX, clientY) {
    if (isPointerOverCompass(clientX, clientY)) {
        return;
    }

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(moon, false);

    if (intersects.length > 0) {
        const hit = intersects[0];

        // Calculate 3D surface intersection in Moon's local coordinate frame
        const localHit = moon.worldToLocal(hit.point.clone());
        const localNorm = localHit.clone().normalize();

        // Scientific planetocentric coordinate conversion (NASA LRO Mean Earth/Polar Axis)
        const latRad = Math.asin(Math.max(-1.0, Math.min(1.0, localNorm.y)));
        let lat = (latRad * 180.0) / Math.PI;

        const lonRad = Math.atan2(-localNorm.z, localNorm.x);
        let lon = (lonRad * 180.0) / Math.PI;

        if (lon < 0) lon += 360.0;
        if (lon >= 360.0) lon -= 360.0;

        onLunarSurfacePointSelected(lat, lon);
    }
}

// ============================================================================
// 13. MANUAL LUNAR COORDINATE NAVIGATION ("GO TO COORDINATES")
// ============================================================================

const navLatInput = document.getElementById('nav-lat');
const navLonInput = document.getElementById('nav-lon');
const navErrorEl = document.getElementById('nav-error');
const btnGoto = document.getElementById('btn-goto');
const btnClear = document.getElementById('btn-clear');

// Camera animation transit state
let isNavigating = false;
let navStartTime = 0;
const navDuration = 1200; // 1.2s smooth transit
const navStartDir = new THREE.Vector3();
const navEndDir = new THREE.Vector3();
const qNavStart = new THREE.Quaternion();
const qNavEnd = new THREE.Quaternion();
let navStartDist = 3.2;
let navEndDist = 2.7;

function parseLatitude(input) {
    if (!input || !input.trim()) {
        return { error: 'Please enter a latitude value.' };
    }
    let s = input.trim().replace(/°/g, '');
    let mult = 1;
    if (/[sS]$/.test(s)) {
        mult = -1;
        s = s.replace(/[sS]$/, '').trim();
    } else if (/[nN]$/.test(s)) {
        mult = 1;
        s = s.replace(/[nN]$/, '').trim();
    }
    const val = parseFloat(s);
    if (isNaN(val)) {
        return { error: 'Invalid latitude: please enter a numeric value.' };
    }
    const lat = val * mult;
    if (lat < -90.0 || lat > 90.0) {
        return { error: 'Latitude out of range: must be between -90° and +90°.' };
    }
    return { value: lat };
}

function parseLongitude(input) {
    if (!input || !input.trim()) {
        return { error: 'Please enter a longitude value.' };
    }
    let s = input.trim().replace(/°/g, '').replace(/[eE]$/, '').trim();
    const val = parseFloat(s);
    if (isNaN(val)) {
        return { error: 'Invalid longitude: please enter a numeric value.' };
    }
    if (val < 0.0 || val > 360.0) {
        return { error: 'Longitude out of range: must be between 0° and 360° (East-positive).' };
    }
    return { value: val };
}

function navigateToCoordinates(lat, lon) {
    onLunarSurfacePointSelected(lat, lon);

    // Smooth Camera Transit based on active view mode
    if (currentViewMode === '2d') {
        const mx = lonToMapX(lon);
        const my = latToMapY(lat);
        pan2DMapTo(mx, my, 1.8);
    } else {
        const localNorm = latLonToLocalPosition(lat, lon, 1.0).normalize();
        moon.updateMatrixWorld(true);
        let targetWorldNorm = localNorm.clone().transformDirection(moon.matrixWorld).normalize();

        // Polar singularity avoidance (if aligned with camera up vector)
        if (Math.abs(targetWorldNorm.y) > 0.9995) {
            targetWorldNorm.x += 0.005;
            targetWorldNorm.normalize();
        }

        const currentDist = camera.position.length();
        const targetDist = Math.max(2.2, Math.min(3.0, currentDist));

        navStartDir.copy(camera.position).normalize();
        navEndDir.copy(targetWorldNorm);

        qNavStart.setFromUnitVectors(new THREE.Vector3(0, 0, 1), navStartDir);
        qNavEnd.setFromUnitVectors(new THREE.Vector3(0, 0, 1), navEndDir);

        navStartDist = currentDist;
        navEndDist = targetDist;
        navStartTime = performance.now();
        isNavigating = true;
    }
}

function handleGoToSubmit() {
    if (!navLatInput || !navLonInput) return;

    const latRes = parseLatitude(navLatInput.value);
    if (latRes.error) {
        if (navErrorEl) {
            navErrorEl.textContent = latRes.error;
            navErrorEl.style.display = 'block';
        }
        navLatInput.focus();
        return;
    }

    const lonRes = parseLongitude(navLonInput.value);
    if (lonRes.error) {
        if (navErrorEl) {
            navErrorEl.textContent = lonRes.error;
            navErrorEl.style.display = 'block';
        }
        navLonInput.focus();
        return;
    }

    if (navErrorEl) {
        navErrorEl.style.display = 'none';
    }

    navigateToCoordinates(latRes.value, lonRes.value);
}

function handleClearReset() {
    if (navLatInput) navLatInput.value = '';
    if (navLonInput) navLonInput.value = '';
    if (navErrorEl) navErrorEl.style.display = 'none';

    surfaceMarker.visible = false;
    selectedCoords = null;
    selectedPOI = null;
    isNavigating = false;
    is2DNavigating = false;

    // Reset HUD to default unselected state
    updateLunarHUD({
        latFormatted: '--',
        lonFormatted: '--',
        badgeText: 'LRO ME',
        badgeType: 'default',
        missionLabel: 'MOON MISSION',
        missionValue: 'No nearby verified landing site',
        isMatched: false,
        showExtra: false
    });

    const hudPanel = document.getElementById('lunar-hud');
    if (hudPanel) hudPanel.classList.remove('active');
}

if (btnGoto) btnGoto.addEventListener('click', handleGoToSubmit);
if (btnClear) btnClear.addEventListener('click', handleClearReset);

// Toggle "Go to Coordinates" box from button inside Lunar Compass HUD
const btnToggleNav = document.getElementById('btn-toggle-nav');
const lunarNavPanel = document.getElementById('lunar-nav');

if (btnToggleNav && lunarNavPanel) {
    btnToggleNav.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = lunarNavPanel.style.display === 'none' || getComputedStyle(lunarNavPanel).display === 'none';
        if (isHidden) {
            lunarNavPanel.style.display = 'block';
            btnToggleNav.classList.add('active');
            if (navLatInput) {
                setTimeout(() => navLatInput.focus(), 60);
            }
        } else {
            lunarNavPanel.style.display = 'none';
            btnToggleNav.classList.remove('active');
        }
    });
}

if (navLatInput) {
    navLatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleGoToSubmit();
    });
    navLatInput.addEventListener('pointerdown', (e) => e.stopPropagation());
}

if (navLonInput) {
    navLonInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleGoToSubmit();
    });
    navLonInput.addEventListener('pointerdown', (e) => e.stopPropagation());
}


// ============================================================================
// 13. 3D LUNAR GEOGRAPHIC ORIENTATION COMPASS (TOP-RIGHT CORNER)
// ============================================================================

const compassCanvas = document.getElementById('compass-canvas');
const compassRenderer = new THREE.WebGLRenderer({
    canvas: compassCanvas,
    alpha: true,
    antialias: true
});
const dpr = Math.min(window.devicePixelRatio || 1, 2);
compassRenderer.setPixelRatio(dpr);
compassRenderer.setSize(112, 112, false);
compassRenderer.toneMapping = THREE.ACESFilmicToneMapping;
compassRenderer.toneMappingExposure = 1.15;

const compassScene = new THREE.Scene();
compassScene.background = null;

const compassCamera = new THREE.OrthographicCamera(-1.18, 1.18, 1.18, -1.18, 0.1, 10);
compassCamera.position.set(0, 0, 3.0);
compassCamera.lookAt(0, 0, 0);

// Compass Lighting: Independent illumination ensures clear instrument visibility
const compassAmbLight = new THREE.AmbientLight(0xd0e2ff, 1.2);
compassScene.add(compassAmbLight);

const compassKeyLight = new THREE.DirectionalLight(0xffffff, 2.6);
compassKeyLight.position.set(-2.0, 3.0, 4.0);
compassScene.add(compassKeyLight);

const compassRimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
compassRimLight.position.set(2.0, -2.5, 2.5);
compassScene.add(compassRimLight);

// Compass Root Group (Stationary in screen space)
const compassRoot = new THREE.Group();
compassScene.add(compassRoot);

// 1. Circular Compass Base Plate
const compassBaseGeo = new THREE.CylinderGeometry(1.08, 1.12, 0.08, 64);
compassBaseGeo.rotateX(Math.PI / 2);
const compassBaseMat = new THREE.MeshStandardMaterial({
    color: 0x070e1b,
    metalness: 0.82,
    roughness: 0.38
});
const compassBaseMesh = new THREE.Mesh(compassBaseGeo, compassBaseMat);
compassBaseMesh.position.z = -0.05;
compassRoot.add(compassBaseMesh);

// 2. Raised Metallic Beveled Outer Ring (Bezel)
const bezelGeo = new THREE.TorusGeometry(1.03, 0.052, 16, 64);
const bezelMat = new THREE.MeshStandardMaterial({
    color: 0x5a6d85,
    metalness: 0.92,
    roughness: 0.22
});
const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
bezelMesh.position.z = -0.01;
compassRoot.add(bezelMesh);

// 3. Inner Retaining Metallic Rim
const lipGeo = new THREE.TorusGeometry(0.96, 0.02, 16, 64);
const lipMat = new THREE.MeshStandardMaterial({
    color: 0x88a2c0,
    metalness: 0.95,
    roughness: 0.18
});
const lipMesh = new THREE.Mesh(lipGeo, lipMat);
lipMesh.position.z = 0.02;
compassRoot.add(lipMesh);

// --- STATIONARY COMPASS DIAL (N, E, S, W stay fixed in place) ---
// Generate crisp, high-resolution (512x512) dial face with all four cardinal directions: N, E, S, W
function createCompassDialTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');

    // 1. Dial background: Deep space navy radial gradient
    const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 250);
    grad.addColorStop(0, '#0a1628');
    grad.addColorStop(0.65, '#050d1a');
    grad.addColorStop(1, '#020610');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(256, 256, 248, 0, Math.PI * 2);
    ctx.fill();

    // 2. Concentric calibration track rings
    ctx.strokeStyle = 'rgba(80, 140, 220, 0.40)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(256, 256, 242, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(256, 256, 206, 0, Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(40, 80, 140, 0.25)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(256, 256, 138, 0, Math.PI * 2);
    ctx.stroke();

    // 3. Subtle degree ticks (72 ticks every 5°)
    for (let deg = 0; deg < 360; deg += 5) {
        if (deg % 90 === 0) continue; // Skip cardinals (handled by bold labels)

        const rad = (deg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        let innerR, outerR, stroke, w;
        if (deg % 30 === 0) {
            innerR = 212;
            outerR = 238;
            stroke = 'rgba(203, 213, 225, 0.85)'; // Major tick: Muted silver
            w = 3.0;
        } else if (deg % 10 === 0) {
            innerR = 220;
            outerR = 236;
            stroke = 'rgba(100, 116, 139, 0.70)'; // Mid tick: Steel
            w = 2.0;
        } else {
            innerR = 226;
            outerR = 234;
            stroke = 'rgba(51, 65, 85, 0.60)';  // Minor tick: Slate
            w = 1.2;
        }

        ctx.strokeStyle = stroke;
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(256 + innerR * sin, 256 - innerR * cos);
        ctx.lineTo(256 + outerR * sin, 256 - outerR * cos);
        ctx.stroke();
    }

    // 4. Subtle intermediate cardinal pips (NE, SE, SW, NW at 45°, 135°, 225°, 315°)
    [45, 135, 225, 315].forEach(deg => {
        const rad = (deg * Math.PI) / 180;
        const r = 188;
        ctx.fillStyle = 'rgba(80, 140, 220, 0.45)';
        ctx.beginPath();
        ctx.arc(256 + r * Math.sin(rad), 256 - r * Math.cos(rad), 2.5, 0, Math.PI * 2);
        ctx.fill();
    });

    // 5. North Arrowhead Pip (Stationary at top)
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(256, 18);
    ctx.lineTo(249, 33);
    ctx.lineTo(263, 33);
    ctx.closePath();
    ctx.fill();

    // 6. ALL FOUR CARDINAL LABELS (Stationary: N=Top, E=Right, S=Bottom, W=Left)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // North (N) - Soft cyan highlight with subtle glow (permanently at top)
    ctx.font = 'bold 44px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SF Mono", monospace';
    ctx.shadowColor = 'rgba(56, 189, 248, 0.85)';
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#38bdf8';
    ctx.fillText('N', 256, 58);

    // Muted silver for E, S, W
    ctx.shadowBlur = 0;
    ctx.font = 'bold 38px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "SF Mono", monospace';
    ctx.fillStyle = '#cbd5e1';

    // East (E) - Permanently at right (90°)
    ctx.fillText('E', 454, 256);

    // South (S) - Permanently at bottom (180°)
    ctx.fillText('S', 256, 454);

    // West (W) - Permanently at left (270°)
    ctx.fillText('W', 58, 256);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
}

// 4. Inner Compass Dial Face with high-resolution cardinal texture (STATIONARY)
const dialPlateGeo = new THREE.CircleGeometry(0.95, 64);
const dialPlateMat = new THREE.MeshStandardMaterial({
    map: createCompassDialTexture(),
    metalness: 0.45,
    roughness: 0.35
});
const dialPlate = new THREE.Mesh(dialPlateGeo, dialPlateMat);
dialPlate.position.z = 0.005;
compassRoot.add(dialPlate);

// 5. ROTATING 3D COMPASS POINTER / NEEDLE (Moves in direction of the Moon)
const needleGroup = new THREE.Group();
needleGroup.position.z = 0.01;
compassRoot.add(needleGroup);

function createFacetMesh(p1, p2, p3, color, metalness = 0.85, roughness = 0.25) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([...p1, ...p2, ...p3]), 3));
    geo.computeVertexNormals();
    return new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, metalness, roughness }));
}

// -------------------------------------------------------------------------
// NORTH POLE POINTER (Single Faceted Vibrant Red Needle - Length: 0.65)
// -------------------------------------------------------------------------
// Left bevel facet (Bright Crimson / Ruby)
needleGroup.add(createFacetMesh([-0.055, 0.0, 0.020], [0.0, 0.0, 0.048], [0.0, 0.65, 0.035], 0xef4444, 0.80, 0.22));
// Right bevel facet (Deep Crimson / Ruby shadow)
needleGroup.add(createFacetMesh([ 0.055, 0.0, 0.020], [0.0, 0.65, 0.035], [0.0, 0.0, 0.048], 0xdc2626, 0.82, 0.25));

// Counterweight base facet (Ruby red)
needleGroup.add(createFacetMesh([-0.040, 0.0, 0.020], [0.0, -0.14, 0.030], [0.0, 0.0, 0.048], 0xdc2626, 0.80, 0.28));
needleGroup.add(createFacetMesh([ 0.040, 0.0, 0.020], [0.0, 0.0, 0.048], [0.0, -0.14, 0.030], 0xb91c1c, 0.80, 0.32));

// -------------------------------------------------------------------------
// 6. Central Pivot Hub (Attached to rotating pointer)
// -------------------------------------------------------------------------
const pivotCollarGeo = new THREE.CylinderGeometry(0.09, 0.11, 0.03, 32);
pivotCollarGeo.rotateX(Math.PI / 2);
const pivotCollarMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    metalness: 0.92,
    roughness: 0.22
});
const pivotCollar = new THREE.Mesh(pivotCollarGeo, pivotCollarMat);
pivotCollar.position.z = 0.048;
needleGroup.add(pivotCollar);

const pivotDomeGeo = new THREE.SphereGeometry(0.065, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
const pivotDomeMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.96,
    roughness: 0.15
});
const pivotDome = new THREE.Mesh(pivotDomeGeo, pivotDomeMat);
pivotDome.position.z = 0.055;
needleGroup.add(pivotDome);

const centerCapGeo = new THREE.SphereGeometry(0.024, 16, 16);
const centerCapMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    metalness: 0.70,
    roughness: 0.25
});
const centerCap = new THREE.Mesh(centerCapGeo, centerCapMat);
centerCap.position.z = 0.075;
needleGroup.add(centerCap);

// Expose Moon instance on window for testing and manual rotation
window.moon = moon;

// --- COMPASS DYNAMIC UPDATE (SINGLE NEEDLE TRACKS N, S, E, W DYNAMICALLY) ---
let currentCompassAngle = 0;
let targetCompassAngle = 0;

function updateCompassOrientation() {
    if (currentViewMode === '2d') {
        // In 2D equirectangular map mode, geographic North is permanently Up (+Y)
        targetCompassAngle = 0;
    } else {
        // 3D Globe Mode: Dynamically tracks lunar orientation in all 4 cardinal directions:
        // - Turn East -> needle points to East (E)
        // - Turn West -> needle points to West (W)
        // - Rotate towards North Pole -> needle indicates North (N)
        // - Rotate towards South Pole -> needle indicates South (S)
        // - Startup (Near Side equator) -> needle is in center and points towards North (N)
        const camLocal = moon.worldToLocal(camera.position.clone()).normalize();

        const latRad = Math.asin(Math.max(-1.0, Math.min(1.0, camLocal.y)));
        const lonRad = Math.atan2(-camLocal.z, camLocal.x);

        let heading = 0;
        if (latRad >= 0) {
            // Northern hemisphere: blends from horizontal longitude heading towards North (0 rad)
            const fNorth = latRad / (Math.PI / 2);
            heading = lonRad * (1.0 - fNorth);
        } else {
            // Southern hemisphere: blends from horizontal longitude heading towards South (PI rad)
            const fSouth = -latRad / (Math.PI / 2);
            if (lonRad >= 0) {
                heading = lonRad * (1.0 - fSouth) + Math.PI * fSouth;
            } else {
                heading = lonRad * (1.0 - fSouth) - Math.PI * fSouth;
            }
        }

        // On the compass dial: N is Top (0 rad), E is Right (-PI/2 in Three.js Z-rotation),
        // S is Bottom (PI rad), W is Left (+PI/2 in Three.js Z-rotation)
        targetCompassAngle = -heading;
    }

    // Shortest-path angular damping for silky, natural needle movement
    let diff = (targetCompassAngle - currentCompassAngle) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    currentCompassAngle += diff * 0.22;

    // Rotate ONLY the needle; the dial face (N, E, S, W) and bezel remain 100% stationary
    needleGroup.rotation.z = currentCompassAngle;
    needleGroup.rotation.x = 0;
    needleGroup.rotation.y = 0;
}

function updateCompassSize() {
    const isMobile = window.innerWidth < 640;
    const size = isMobile ? 92 : 112;
    compassRenderer.setSize(size, size, false);
}
updateCompassSize();

// Interactive North-Up reset on compass click
const compassPanelEl = document.getElementById('compass-panel');
if (compassPanelEl) {
    compassPanelEl.addEventListener('click', (e) => {
        e.stopPropagation();
        if (currentViewMode === '2d') {
            pan2DMapTo(0.25, 0, 2.9);
        } else {
            // Reset camera and controls to standard Near Side North-Up view
            camera.position.set(0, 0, 3.2);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();
        }
    });
}

// 14. ANIMATION LOOP
function animate() {
    requestAnimationFrame(animate);

    // Pulse measurement beacon rings in 2D mode
    if (measureGroup.visible) {
        const t = performance.now() * 0.005;
        if (markerA.grp.visible && markerA.ring) {
            const sA = 1.0 + 0.22 * Math.sin(t);
            markerA.ring.scale.set(sA, sA, 1.0);
            markerA.ringMat.opacity = 0.55 + 0.35 * Math.cos(t);
        }
        if (markerB.grp.visible && markerB.ring) {
            const sB = 1.0 + 0.22 * Math.sin(t + Math.PI);
            markerB.ring.scale.set(sB, sB, 1.0);
            markerB.ringMat.opacity = 0.55 + 0.35 * Math.cos(t + Math.PI);
        }
    }

    // 1. Smooth 3D camera arc navigation during "Go to Coordinates"
    if (isNavigating && currentViewMode === '3d') {
        const elapsed = performance.now() - navStartTime;
        const rawT = Math.min(1.0, elapsed / navDuration);
        const t = rawT < 0.5 
            ? 4 * rawT * rawT * rawT 
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        const currentQ = qNavStart.clone().slerp(qNavEnd, t);
        const currentDist = THREE.MathUtils.lerp(navStartDist, navEndDist, t);

        camera.position.set(0, 0, currentDist).applyQuaternion(currentQ);
        camera.lookAt(0, 0, 0);
        controls.target.set(0, 0, 0);

        if (rawT >= 1.0) {
            isNavigating = false;
        }
    }

    // 2. Smooth 2D camera pan navigation during "Go to Coordinates" / Reset
    if (is2DNavigating && currentViewMode === '2d') {
        const elapsed = performance.now() - nav2DStartTime;
        const rawT = Math.min(1.0, elapsed / nav2DDuration);
        const t = rawT < 0.5 
            ? 4 * rawT * rawT * rawT 
            : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        camera.position.lerpVectors(nav2DStartPos, nav2DEndPos, t);
        controls.target.lerpVectors(nav2DStartTarget, nav2DEndTarget, t);

        if (rawT >= 1.0) {
            is2DNavigating = false;
        }
    }

    // Updates camera position based on user mouse / touch drag
    controls.update();

    // 3. Pulse red pointer (📍) base ring across surface
    if (surfaceMarker.visible && markerBaseRing) {
        const time = performance.now() * 0.004;
        const scale = 1.0 + 0.22 * Math.sin(time);
        markerBaseRing.scale.set(scale, 1.0, scale);
        if (markerBaseRingMat) {
            markerBaseRingMat.opacity = 0.55 + 0.35 * Math.cos(time);
        }
    }

    // 4. Update Screen POI Marker Labels
    updatePOILabels();

    // 5. Render Main Lunar Scene
    renderer.render(scene, camera);

    // 6. Update and Render 3D Lunar Compass
    updateCompassOrientation();
    compassRenderer.render(compassScene, compassCamera);
}

animate();

// 15. RESPONSIVE RESIZE
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    updateCompassSize();
});
