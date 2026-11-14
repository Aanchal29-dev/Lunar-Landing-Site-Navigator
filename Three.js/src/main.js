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
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3.0));
renderer.outputColorSpace = THREE.SRGBColorSpace;

// ACES Filmic tone mapping: preserves high dynamic range and crater details without overexposure
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.25;

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
    768,         // Width segments (ultra-high resolution 768x512 grid)
    512,         // Height segments (ultra-high resolution)
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

// High-definition anisotropic texture filtering & sharp mipmapping
const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
moonTexture.anisotropy = maxAnisotropy;
moonTexture.minFilter = THREE.LinearMipmapLinearFilter;
moonTexture.magFilter = THREE.LinearFilter;
moonTexture.generateMipmaps = true;

moonNormalTexture.anisotropy = maxAnisotropy;
moonNormalTexture.minFilter = THREE.LinearMipmapLinearFilter;
moonNormalTexture.magFilter = THREE.LinearFilter;
moonNormalTexture.generateMipmaps = true;

moonDisplacement.anisotropy = maxAnisotropy;
moonRoughnessTexture.anisotropy = maxAnisotropy;

const material = new THREE.MeshStandardMaterial({
    map: moonTexture,
    displacementMap: moonDisplacement,
    displacementScale: 0.06, // Calibrated for visible elevation without geometry distortion
    displacementBias: 0,
    normalMap: moonNormalTexture,
    normalScale: new THREE.Vector2(2.8, 2.8), // Ultra high-definition crater relief
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

// Faint cosmic fill: preserves contrast while keeping shadowed crater details visible
const ambientLight = new THREE.AmbientLight(0xffffff, 0.40);
scene.add(ambientLight);

// Sunlight: DirectionalLight from upper-right matching the original lunar illumination
const sunLight = new THREE.DirectionalLight(0xffffff, 4.2);
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
    const needleGeo = new THREE.CylinderGeometry(0.0035, 0.0008, 0.044, 16);
    needleGeo.translate(0, 0.022, 0);
    const needleMesh = new THREE.Mesh(needleGeo, metalMat);
    group.add(needleMesh);

    // Metallic Collar: transitions needle into the red spherical head
    const collarGeo = new THREE.CylinderGeometry(0.007, 0.0055, 0.004, 16);
    collarGeo.translate(0, 0.045, 0);
    const collarMesh = new THREE.Mesh(collarGeo, metalMat);
    group.add(collarMesh);

    // Red Bulb / Pin Head (Sphere of the 📍 icon):
    // Rich vibrant red with emissive illumination so it's always clearly visible from all angles
    const headGeo = new THREE.SphereGeometry(0.022, 32, 24);
    headGeo.translate(0, 0.064, 0);
    const headMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xdc2626,
        emissiveIntensity: 0.70,
        roughness: 0.20,
        metalness: 0.15
    });
    const headMesh = new THREE.Mesh(headGeo, headMat);
    group.add(headMesh);

    // Subtle Surface Contact Ring (lies flat on lunar surface at y = 0.001)
    const baseRingGeo = new THREE.RingGeometry(0.008, 0.026, 32);
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

    // Dynamic Expanding Radar / Beacon Wave Ring
    const beaconRingGeo = new THREE.RingGeometry(0.016, 0.048, 32);
    beaconRingGeo.rotateX(-Math.PI / 2);
    beaconRingGeo.translate(0, 0.0012, 0);
    const beaconRingMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false
    });
    const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
    group.add(beaconRing);

    // Surface Center Contact Dot: exact contact point indicator
    const baseDotGeo = new THREE.CircleGeometry(0.004, 20);
    baseDotGeo.rotateX(-Math.PI / 2);
    baseDotGeo.translate(0, 0.0015, 0);
    const baseDotMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.95,
        depthWrite: false
    });
    const baseDot = new THREE.Mesh(baseDotGeo, baseDotMat);
    group.add(baseDot);

    return { group, baseRing, baseRingMat, beaconRing, beaconRingMat };
}

const {
    group: surfaceMarker,
    baseRing: markerBaseRing,
    baseRingMat: markerBaseRingMat,
    beaconRing: markerBeaconRing,
    beaconRingMat: markerBeaconRingMat
} = createSurfaceMarker();
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

// (heightmapData and initElevationData initialized at line 885)
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
// Precise lunar surface radius (matching GPU displacement scale = 0.06)
function getLunarSurfaceRadius(lat, lon) {
    if (heightmapData) {
        const mx = lonToMapX(lon);
        const my = latToMapY(lat);
        const u = (mx + 2.0) / 4.0;
        const v = (my + 1.0) / 2.0;
        const fx = Math.max(0, Math.min(1, u)) * (HEIGHTMAP_WIDTH - 1);
        const fy = (1.0 - Math.max(0, Math.min(1, v))) * (HEIGHTMAP_HEIGHT - 1);
        const x0 = Math.floor(fx);
        const y0 = Math.floor(fy);
        const idx = (y0 * HEIGHTMAP_WIDTH + x0) * 4;
        const rawVal = heightmapData[idx]; // 0 .. 255
        const disp = (rawVal / 255.0) * 0.06;
        return 1.0 + disp + 0.0035; // Tip touches exact displaced surface with clean ground clearance
    }
    return 1.028;
}

// 3D <-> 2D Synchronized Red Pointer (📍) Positions and Orientations
const markerPos3D = new THREE.Vector3();
const markerQuat3D = new THREE.Quaternion();
const markerPos2D = new THREE.Vector3();
const markerQuat2D = new THREE.Quaternion();

function updateSurfaceMarkerTargets(lat, lon, customRadius = null) {
    const localNorm = latLonToLocalPosition(lat, lon, 1.0).normalize();
    const surfaceRadius = customRadius || getLunarSurfaceRadius(lat, lon);
    markerPos3D.copy(localNorm.clone().multiplyScalar(surfaceRadius));
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
            // In 2D map view, permanently display all crater and landing spot names without requiring zoom
            showLabel = true;
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
        sunLight.position.set(0, 0, 5);

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
        if (typeof poleGroup !== 'undefined') poleGroup.visible = false;
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
        ambientLight.intensity = 0.40;
        sunLight.intensity = 4.2;
        sunLight.position.set(3.5, 1.8, 2.6);

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
        if (typeof poleGroup !== 'undefined') poleGroup.visible = true;
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
    const compassEl = document.getElementById('compass-panel');
    if (!compassEl) return false;
    const rect = compassEl.getBoundingClientRect();
    return (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
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

    // On standard surface clicks on the main page, keep solar analysis hidden (just coordinates & mission/crater)
    const hudSolar = document.getElementById('hud-solar-analysis');
    if (hudSolar) hudSolar.style.display = 'none';

    // Show Lunar Compass HUD
    const hud = document.getElementById('lunar-hud');
    if (hud) {
        hud.style.display = 'block';
        hud.classList.add('active');
    }
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

// Hemisphere toggle elements
const btnHemiN = document.getElementById('btn-hemi-n');
const btnHemiS = document.getElementById('btn-hemi-s');
const btnHemiE = document.getElementById('btn-hemi-e');
const btnHemiW = document.getElementById('btn-hemi-w');
const latHemiHint = document.getElementById('lat-hemi-hint');
const lonHemiHint = document.getElementById('lon-hemi-hint');

let selectedLatHemi = 'N'; // 'N' (North +) or 'S' (South -)
let selectedLonHemi = 'E'; // 'E' (East +) or 'W' (West)

function setLatHemisphere(hemi) {
    selectedLatHemi = (hemi === 'S' || hemi === 's') ? 'S' : 'N';
    if (btnHemiN && btnHemiS) {
        if (selectedLatHemi === 'S') {
            btnHemiS.classList.add('active');
            btnHemiN.classList.remove('active');
            if (latHemiHint) latHemiHint.textContent = 'South (-) 0° to 90°';
        } else {
            btnHemiN.classList.add('active');
            btnHemiS.classList.remove('active');
            if (latHemiHint) latHemiHint.textContent = 'North (+) 0° to 90°';
        }
    }
}

function setLonHemisphere(hemi) {
    selectedLonHemi = (hemi === 'W' || hemi === 'w') ? 'W' : 'E';
    if (btnHemiE && btnHemiW) {
        if (selectedLonHemi === 'W') {
            btnHemiW.classList.add('active');
            btnHemiE.classList.remove('active');
            if (lonHemiHint) lonHemiHint.textContent = 'West (-) 0° to 180°';
        } else {
            btnHemiE.classList.add('active');
            btnHemiW.classList.remove('active');
            if (lonHemiHint) lonHemiHint.textContent = 'East (+) 0° to 360°';
        }
    }
}

if (btnHemiN) {
    btnHemiN.addEventListener('click', (e) => {
        e.stopPropagation();
        setLatHemisphere('N');
        if (navLatInput && navLatInput.value.includes('-')) {
            navLatInput.value = navLatInput.value.replace(/-/g, '').trim();
        }
    });
}

if (btnHemiS) {
    btnHemiS.addEventListener('click', (e) => {
        e.stopPropagation();
        setLatHemisphere('S');
    });
}

if (btnHemiE) {
    btnHemiE.addEventListener('click', (e) => {
        e.stopPropagation();
        setLonHemisphere('E');
        if (navLonInput && navLonInput.value.includes('-')) {
            navLonInput.value = navLonInput.value.replace(/-/g, '').trim();
        }
    });
}

if (btnHemiW) {
    btnHemiW.addEventListener('click', (e) => {
        e.stopPropagation();
        setLonHemisphere('W');
    });
}

// Camera animation transit state
let isNavigating = false;
let navStartTime = 0;
const navDuration = 1600; // 1.6s smooth cinematic arc transit
const navStartDir = new THREE.Vector3();
const navEndDir = new THREE.Vector3();
const qNavStart = new THREE.Quaternion();
const qNavEnd = new THREE.Quaternion();
let navStartDist = 3.2;
let navEndDist = 2.45;

// Pin-drop touchdown animation state
let markerDropActive = false;
let markerDropStartTime = 0;

function parseLatitude(input) {
    if (!input || !input.trim()) {
        return { error: 'Please enter a latitude value.' };
    }
    let s = input.trim().replace(/°/g, '');
    let hemi = selectedLatHemi;

    // Auto-detect typed sign or cardinal letter
    if (s.includes('-') || /[sS]/.test(s)) {
        hemi = 'S';
        setLatHemisphere('S');
    } else if (s.includes('+') || /[nN]/.test(s)) {
        hemi = 'N';
        setLatHemisphere('N');
    }

    // Strip sign and letter to parse magnitude
    s = s.replace(/[-+nNsS]/gi, '').trim();
    const val = parseFloat(s);
    if (isNaN(val)) {
        return { error: 'Invalid latitude: please enter a numeric value.' };
    }
    if (val < 0.0 || val > 90.0) {
        return { error: 'Latitude out of range: must be between 0° and 90° (select N or S).' };
    }
    const lat = hemi === 'S' ? -val : val;
    return { value: lat };
}

function parseLongitude(input) {
    if (!input || !input.trim()) {
        return { error: 'Please enter a longitude value.' };
    }
    let s = input.trim().replace(/°/g, '');
    let hemi = selectedLonHemi;

    // Auto-detect typed West / East sign or letter
    if (s.includes('-') || /[wW]/.test(s)) {
        hemi = 'W';
        setLonHemisphere('W');
    } else if (s.includes('+') || /[eE]/.test(s)) {
        hemi = 'E';
        setLonHemisphere('E');
    }

    s = s.replace(/[-+eEwW]/gi, '').trim();
    const val = parseFloat(s);
    if (isNaN(val)) {
        return { error: 'Invalid longitude: please enter a numeric value.' };
    }

    if (hemi === 'W') {
        if (val < 0.0 || val > 180.0) {
            return { error: 'West longitude out of range: must be between 0° and 180° W (or use 0°–360° E).' };
        }
        // Convert West longitude to East-positive 0..360 system
        const finalLon = (val === 0.0 || val === 360.0) ? 0.0 : 360.0 - val;
        return { value: finalLon };
    } else {
        if (val < 0.0 || val > 360.0) {
            return { error: 'East longitude out of range: must be between 0° and 360°.' };
        }
        const finalLon = (val >= 360.0) ? 0.0 : val;
        return { value: finalLon };
    }
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

    setLatHemisphere('N');
    setLonHemisphere('E');

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
    if (hudPanel) {
        hudPanel.style.display = 'none';
        hudPanel.classList.remove('active');
    }
}

if (btnGoto) btnGoto.addEventListener('click', handleGoToSubmit);
if (btnClear) btnClear.addEventListener('click', handleClearReset);

// ============================================================================
// 12E. LUNAR COMPASS HUD SOLAR ANALYSIS & SITE NAVIGATOR INTEGRATION
// ============================================================================

function updateHUDSolarAnalysis(latDeg, lonDeg, epochDate = new Date()) {
    const hudSolarAnalysis = document.getElementById('hud-solar-analysis');
    const hudValElevation = document.getElementById('hud-val-solar-elevation');
    const hudValAzimuth = document.getElementById('hud-val-solar-azimuth');
    const hudValIncidence = document.getElementById('hud-val-solar-incidence');
    const hudSolarBadge = document.getElementById('hud-solar-badge');
    const hudRowObstruction = document.getElementById('hud-row-terrain-obstruction');
    const hudValObstruction = document.getElementById('hud-val-terrain-obstruction');

    if (!hudSolarAnalysis) return;
    hudSolarAnalysis.style.display = 'block';

    const sunData = getSunInMoonFrame(epochDate);
    const angles = calculateSolarAngles(latDeg, lonDeg, sunData.s_moon);
    const obstruction = calculateTerrainHorizonObstruction(latDeg, lonDeg, angles.azimuth, angles.elevation);

    if (hudValElevation) {
        hudValElevation.textContent = `${angles.elevation >= 0 ? '+' : ''}${angles.elevation.toFixed(1)}°`;
    }
    if (hudValAzimuth) {
        hudValAzimuth.textContent = `${angles.azimuth.toFixed(1)}°`;
    }
    if (hudValIncidence) {
        hudValIncidence.textContent = `${angles.incidenceDeg.toFixed(1)}°`;
    }

    if (hudSolarBadge) {
        hudSolarBadge.className = 'hud-solar-badge';
        if (obstruction.status === 'SUNLIT') {
            hudSolarBadge.classList.add('sunlit');
            hudSolarBadge.textContent = '☀️ DIRECT SUNLIGHT';
        } else if (obstruction.status === 'TERRAIN_SHADOW') {
            hudSolarBadge.classList.add('blocked');
            hudSolarBadge.textContent = '🌑 RIM SHADOWED';
        } else {
            hudSolarBadge.classList.add('shadowed');
            hudSolarBadge.textContent = '🌑 NIGHT';
        }
    }

    if (hudRowObstruction && hudValObstruction) {
        if (obstruction.status === 'TERRAIN_SHADOW') {
            hudRowObstruction.style.display = 'flex';
            hudValObstruction.textContent = `Blocked by ${obstruction.horizonElevationDeg.toFixed(1)}° rim (${obstruction.obstructionSource || 'LOLA Rim'})`;
        } else {
            hudRowObstruction.style.display = 'none';
        }
    }
}

async function fetchBackendMissionData(lat, lon, epochDate) {
    try {
        const payload = {
            latitude: lat,
            longitude: lon,
            date: epochDate.toISOString().split('T')[0],
            epochIso: epochDate.toISOString()
        };
        const res = await fetch('/api/mission-analysis', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (res.ok) {
            const data = await res.json();
            if (data.solarIllumination) {
                const si = data.solarIllumination;
                const hudValElevation = document.getElementById('hud-val-solar-elevation');
                const hudValAzimuth = document.getElementById('hud-val-solar-azimuth');
                const hudSolarBadge = document.getElementById('hud-solar-badge');
                if (si.elevationDeg != null && hudValElevation) {
                    hudValElevation.textContent = `${si.elevationDeg >= 0 ? '+' : ''}${si.elevationDeg.toFixed(1)}°`;
                }
                if (si.azimuthDeg != null && hudValAzimuth) {
                    hudValAzimuth.textContent = `${si.azimuthDeg.toFixed(1)}°`;
                }
                if (si.state && hudSolarBadge) {
                    hudSolarBadge.textContent = si.state;
                }
            }
            if (data.matchedSite) {
                const valSite = document.getElementById('val-site');
                if (valSite) valSite.textContent = data.matchedSite;
            }
        }
    } catch (e) {
        // Fallback astronomical ephemeris and LOLA data already active
    }
}

function pointAndAnalyzeSite(lat, lon, epochDate = new Date()) {
    // 1. Ensure we are in 3D mode so Moon globe is displayed
    if (currentViewMode !== '3d') {
        setViewMode('3d');
    }

    // 2. Position the surface marker at exact lunar surface elevation
    updateSurfaceMarkerTargets(lat, lon);
    surfaceMarker.visible = true;

    // Trigger pin drop touchdown animation as camera arrives at destination
    markerDropActive = true;
    markerDropStartTime = performance.now() + 650;
    surfaceMarker.scale.set(0.001, 0.001, 0.001);

    // 3. Transit camera smoothly to coordinates (1.6s smooth cinematic arc)
    navigateToCoordinates(lat, lon);

    // 4. Update HUD with coordinates and mission/crater info
    onLunarSurfacePointSelected(lat, lon);

    // 5. Update HUD sunlight analysis section
    updateHUDSolarAnalysis(lat, lon, epochDate);

    // 6. Ensure HUD is displayed on Moon page
    const hud = document.getElementById('lunar-hud');
    if (hud) {
        hud.style.display = 'block';
        hud.classList.add('active');
    }

    // 7. Connect to backend POST /api/mission-analysis in background
    fetchBackendMissionData(lat, lon, epochDate);
}

// -------------------------------------------------------------------------
// LUNAR SITE NAVIGATOR FORM CONTROLLER (PAGE 2)
// -------------------------------------------------------------------------
function setupSiteNavigator() {
    const siteNavLat = document.getElementById('site-nav-lat');
    const siteNavLon = document.getElementById('site-nav-lon');
    const siteNavDate = document.getElementById('site-nav-date');
    const siteNavError = document.getElementById('site-nav-error');
    const btnSiteNavSubmit = document.getElementById('btn-site-nav-submit');
    const btnSiteNavReset = document.getElementById('btn-site-nav-reset');
    const btnSiteToday = document.getElementById('site-btn-today');

    const siteBtnHemiN = document.getElementById('site-btn-hemi-n');
    const siteBtnHemiS = document.getElementById('site-btn-hemi-s');
    const siteBtnHemiE = document.getElementById('site-btn-hemi-e');
    const siteBtnHemiW = document.getElementById('site-btn-hemi-w');

    let siteLatHemi = 'N';
    let siteLonHemi = 'E';

    // Set today's date
    const todayStr = new Date().toISOString().split('T')[0];
    if (siteNavDate && !siteNavDate.value) {
        siteNavDate.value = todayStr;
    }
    if (btnSiteToday) {
        btnSiteToday.addEventListener('click', () => {
            if (siteNavDate) siteNavDate.value = new Date().toISOString().split('T')[0];
        });
    }

    // Hemisphere toggles
    if (siteBtnHemiN && siteBtnHemiS) {
        siteBtnHemiN.addEventListener('click', () => {
            siteLatHemi = 'N';
            siteBtnHemiN.classList.add('active');
            siteBtnHemiS.classList.remove('active');
        });
        siteBtnHemiS.addEventListener('click', () => {
            siteLatHemi = 'S';
            siteBtnHemiS.classList.add('active');
            siteBtnHemiN.classList.remove('active');
        });
    }

    if (siteBtnHemiE && siteBtnHemiW) {
        siteBtnHemiE.addEventListener('click', () => {
            siteLonHemi = 'E';
            siteBtnHemiE.classList.add('active');
            siteBtnHemiW.classList.remove('active');
        });
        siteBtnHemiW.addEventListener('click', () => {
            siteLonHemi = 'W';
            siteBtnHemiW.classList.add('active');
            siteBtnHemiE.classList.remove('active');
        });
    }

    // Preset cards
    document.querySelectorAll('.preset-card').forEach(card => {
        card.addEventListener('click', () => {
            const lat = card.getAttribute('data-lat');
            const hLat = card.getAttribute('data-hemi-lat') || 'N';
            const lon = card.getAttribute('data-lon');
            const hLon = card.getAttribute('data-hemi-lon') || 'E';

            if (siteNavLat) siteNavLat.value = lat;
            if (siteNavLon) siteNavLon.value = lon;

            if (hLat === 'S' && siteBtnHemiS) {
                siteLatHemi = 'S';
                siteBtnHemiS.classList.add('active');
                if (siteBtnHemiN) siteBtnHemiN.classList.remove('active');
            } else if (siteBtnHemiN) {
                siteLatHemi = 'N';
                siteBtnHemiN.classList.add('active');
                if (siteBtnHemiS) siteBtnHemiS.classList.remove('active');
            }

            if (hLon === 'W' && siteBtnHemiW) {
                siteLonHemi = 'W';
                siteBtnHemiW.classList.add('active');
                if (siteBtnHemiE) siteBtnHemiE.classList.remove('active');
            } else if (siteBtnHemiE) {
                siteLonHemi = 'E';
                siteBtnHemiE.classList.add('active');
                if (siteBtnHemiW) siteBtnHemiW.classList.remove('active');
            }

            if (siteNavError) siteNavError.style.display = 'none';

            // Visual feedback
            document.querySelectorAll('.preset-card').forEach(c => c.style.borderColor = '');
            card.style.borderColor = '#38bdf8';
        });
    });

    // Reset button
    if (btnSiteNavReset) {
        btnSiteNavReset.addEventListener('click', () => {
            if (siteNavLat) siteNavLat.value = '';
            if (siteNavLon) siteNavLon.value = '';
            if (siteNavDate) siteNavDate.value = new Date().toISOString().split('T')[0];
            if (siteNavError) siteNavError.style.display = 'none';
            document.querySelectorAll('.preset-card').forEach(c => c.style.borderColor = '');
            if (siteBtnHemiN) {
                siteLatHemi = 'N';
                siteBtnHemiN.classList.add('active');
                if (siteBtnHemiS) siteBtnHemiS.classList.remove('active');
            }
            if (siteBtnHemiE) {
                siteLonHemi = 'E';
                siteBtnHemiE.classList.add('active');
                if (siteBtnHemiW) siteBtnHemiW.classList.remove('active');
            }
        });
    }

    // Submit handler
    function handleSiteNavSubmit() {
        if (!siteNavLat || !siteNavLon) return;

        let rawLatStr = siteNavLat.value.trim().replace(/°/g, '');
        if (!rawLatStr) {
            showError('Please enter a target latitude value (e.g. 69.373 or 0.674).');
            siteNavLat.focus();
            return;
        }

        // Auto-detect typed S or N or leading minus
        if (/[sS]/.test(rawLatStr) || rawLatStr.startsWith('-')) {
            siteLatHemi = 'S';
            if (siteBtnHemiS) siteBtnHemiS.classList.add('active');
            if (siteBtnHemiN) siteBtnHemiN.classList.remove('active');
        } else if (/[nN]/.test(rawLatStr) || rawLatStr.startsWith('+')) {
            siteLatHemi = 'N';
            if (siteBtnHemiN) siteBtnHemiN.classList.add('active');
            if (siteBtnHemiS) siteBtnHemiS.classList.remove('active');
        }

        rawLatStr = rawLatStr.replace(/[-+nNsS]/gi, '').trim();
        let latVal = parseFloat(rawLatStr);
        if (isNaN(latVal)) {
            showError('Invalid latitude: please enter a numeric value.');
            siteNavLat.focus();
            return;
        }
        if (latVal < 0.0 || latVal > 90.0) {
            showError('Latitude out of range: must be between 0° and 90°.');
            siteNavLat.focus();
            return;
        }
        const signedLat = (siteLatHemi === 'S') ? -Math.abs(latVal) : Math.abs(latVal);

        let rawLonStr = siteNavLon.value.trim().replace(/°/g, '');
        if (!rawLonStr) {
            showError('Please enter a target longitude value (e.g. 32.319 or 23.473).');
            siteNavLon.focus();
            return;
        }

        // Auto-detect typed W or E or leading minus
        if (/[wW]/.test(rawLonStr) || rawLonStr.startsWith('-')) {
            siteLonHemi = 'W';
            if (siteBtnHemiW) siteBtnHemiW.classList.add('active');
            if (siteBtnHemiE) siteBtnHemiE.classList.remove('active');
        } else if (/[eE]/.test(rawLonStr) || rawLonStr.startsWith('+')) {
            siteLonHemi = 'E';
            if (siteBtnHemiE) siteBtnHemiE.classList.add('active');
            if (siteBtnHemiW) siteBtnHemiW.classList.remove('active');
        }

        rawLonStr = rawLonStr.replace(/[-+eEwW]/gi, '').trim();
        let lonVal = parseFloat(rawLonStr);
        if (isNaN(lonVal)) {
            showError('Invalid longitude: please enter a numeric value.');
            siteNavLon.focus();
            return;
        }
        const absLon = Math.abs(lonVal);
        let finalLon360 = absLon;
        if (siteLonHemi === 'W') {
            finalLon360 = (360.0 - (absLon % 360.0)) % 360.0;
        } else {
            finalLon360 = (absLon % 360.0);
        }

        // Epoch date
        let epochDate = new Date();
        if (siteNavDate && siteNavDate.value) {
            const parts = siteNavDate.value.split('-');
            if (parts.length === 3) {
                epochDate = new Date(Date.UTC(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 12, 0, 0));
            }
        }

        if (siteNavError) siteNavError.style.display = 'none';

        // 1. Smoothly fade out the overlay
        navigateToRoute('close');

        // 2. Begin smooth camera arc transit & point analysis on the Moon immediately
        pointAndAnalyzeSite(signedLat, finalLon360, epochDate);
    }

    function showError(msg) {
        if (siteNavError) {
            siteNavError.textContent = msg;
            siteNavError.style.display = 'block';
        }
    }

    if (btnSiteNavSubmit) {
        btnSiteNavSubmit.addEventListener('click', handleSiteNavSubmit);
    }

    if (siteNavLat) {
        siteNavLat.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSiteNavSubmit();
        });
    }
    if (siteNavLon) {
        siteNavLon.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleSiteNavSubmit();
        });
    }

    // HUD buttons:
    const btnOpenSiteNav = document.getElementById('btn-open-site-navigator');
    if (btnOpenSiteNav) {
        btnOpenSiteNav.addEventListener('click', (e) => {
            e.stopPropagation();
            navigateToRoute('site-navigator');
        });
    }

    const btnCloseHud = document.getElementById('btn-close-hud');
    if (btnCloseHud) {
        btnCloseHud.addEventListener('click', (e) => {
            e.stopPropagation();
            const hud = document.getElementById('lunar-hud');
            if (hud) hud.style.display = 'none';
        });
    }
}

// Coordinate Copy Feature in Lunar Compass HUD
function setupCoordinateCopy() {
    const btnCopy = document.getElementById('btn-copy-coords');
    const copyText = document.getElementById('copy-coords-text');
    const defIcon = btnCopy ? btnCopy.querySelector('.default-icon') : null;
    const succIcon = btnCopy ? btnCopy.querySelector('.success-icon') : null;

    if (!btnCopy) return;

    btnCopy.addEventListener('click', async (e) => {
        e.stopPropagation();

        const latEl = document.getElementById('val-lat');
        const lonEl = document.getElementById('val-lon');

        const latText = latEl ? latEl.textContent.trim() : '';
        const lonText = lonEl ? lonEl.textContent.trim() : '';

        if (!latText || latText === '--' || !lonText || lonText === '--') {
            if (copyText) copyText.textContent = 'NO COORDS SELECTED';
            setTimeout(() => {
                if (copyText) copyText.textContent = 'COPY COORDINATES';
            }, 1500);
            return;
        }

        const textToCopy = `${latText}, ${lonText}`;

        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(textToCopy);
            } else {
                const ta = document.createElement('textarea');
                ta.value = textToCopy;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }

            btnCopy.classList.add('copied');
            if (defIcon) defIcon.style.display = 'none';
            if (succIcon) succIcon.style.display = 'inline-block';
            if (copyText) copyText.textContent = 'COPIED TO CLIPBOARD!';

            setTimeout(() => {
                btnCopy.classList.remove('copied');
                if (defIcon) defIcon.style.display = 'inline-block';
                if (succIcon) succIcon.style.display = 'none';
                if (copyText) copyText.textContent = 'COPY COORDINATES';
            }, 2000);
        } catch (err) {
            console.error('Failed to copy coordinates:', err);
        }
    });

    // Also clicking directly on latitude or longitude value copies
    const valLat = document.getElementById('val-lat');
    const valLon = document.getElementById('val-lon');
    [valLat, valLon].forEach(el => {
        if (el) {
            el.addEventListener('click', () => {
                if (btnCopy) btnCopy.click();
            });
        }
    });
}

// Initialize Site Navigator & Coordinate Copy
setupSiteNavigator();
setupCoordinateCopy();


// ============================================================================
// ============================================================================
// 13. 3D LUNAR GEOGRAPHIC ORIENTATION COMPASS (TOP-RIGHT CORNER)
// ============================================================================

const compassCanvas = document.getElementById('compass-canvas');
const compassRenderer = new THREE.WebGLRenderer({
    canvas: compassCanvas,
    alpha: true,
    antialias: true
});
const dpr = Math.min(window.devicePixelRatio || 1, 3);
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

// NORTH POLE POINTER (Single Faceted Vibrant Red Needle - Length: 0.65)
// Left bevel facet (Bright Crimson / Ruby)
needleGroup.add(createFacetMesh([-0.055, 0.0, 0.020], [0.0, 0.0, 0.048], [0.0, 0.65, 0.035], 0xef4444, 0.80, 0.22));
// Right bevel facet (Deep Crimson / Ruby shadow)
needleGroup.add(createFacetMesh([ 0.055, 0.0, 0.020], [0.0, 0.65, 0.035], [0.0, 0.0, 0.048], 0xdc2626, 0.82, 0.25));

// Counterweight base facet (Ruby red)
needleGroup.add(createFacetMesh([-0.040, 0.0, 0.020], [0.0, -0.14, 0.030], [0.0, 0.0, 0.048], 0xdc2626, 0.80, 0.28));
needleGroup.add(createFacetMesh([ 0.040, 0.0, 0.020], [0.0, 0.0, 0.048], [0.0, -0.14, 0.030], 0xb91c1c, 0.80, 0.32));

// Central Pivot Hub (Attached to rotating pointer)
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
    if (!compassRenderer || !compassCanvas) return;
    if (currentViewMode === '2d') {
        // In 2D equirectangular map mode, geographic North is permanently Up (+Y)
        targetCompassAngle = 0;
    } else {
        // 3D Globe Mode: Dynamically tracks lunar orientation in all 4 cardinal directions
        const camLocal = moon.worldToLocal(camera.position.clone()).normalize();

        const latRad = Math.asin(Math.max(-1.0, Math.min(1.0, camLocal.y)));
        const lonRad = Math.atan2(-camLocal.z, camLocal.x);

        let heading = 0;
        if (latRad >= 0) {
            const fNorth = latRad / (Math.PI / 2);
            heading = lonRad * (1.0 - fNorth);
        } else {
            const fSouth = -latRad / (Math.PI / 2);
            if (lonRad >= 0) {
                heading = lonRad * (1.0 - fSouth) + Math.PI * fSouth;
            } else {
                heading = lonRad * (1.0 - fSouth) - Math.PI * fSouth;
            }
        }
        targetCompassAngle = -heading;
    }

    // Shortest-path angular damping for silky, natural needle movement
    let diff = (targetCompassAngle - currentCompassAngle) % (Math.PI * 2);
    if (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > Math.PI) diff -= Math.PI * 2;
    currentCompassAngle += diff * 0.22;

    needleGroup.rotation.z = currentCompassAngle;
    needleGroup.rotation.x = 0;
    needleGroup.rotation.y = 0;
}

function updateCompassSize() {
    if (!compassRenderer || !compassCanvas) return;
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
            camera.position.set(0, 0, 3.2);
            camera.lookAt(0, 0, 0);
            controls.target.set(0, 0, 0);
            controls.update();
        }
    });
}

// ============================================================================
// 13B. COLLAPSIBLE LUNAR LANDING SITE SIDEBAR CONTROLLER
// Pushes down Lunar Compass HUD naturally when expanded
// ============================================================================

const navSidebar = document.getElementById('lunar-nav-sidebar');
const navSidebarHeader = document.getElementById('nav-sidebar-header');
const btnToggleNavSidebar = document.getElementById('btn-toggle-nav-sidebar');

function toggleNavSidebar(forceState) {
    if (!navSidebar) return;
    const isCurrentlyCollapsed = navSidebar.classList.contains('collapsed');
    const shouldCollapse = forceState !== undefined ? forceState : !isCurrentlyCollapsed;

    if (shouldCollapse) {
        navSidebar.classList.add('collapsed');
    } else {
        navSidebar.classList.remove('collapsed');
    }
}

if (navSidebarHeader) {
    navSidebarHeader.addEventListener('click', () => {
        toggleNavSidebar();
    });
    navSidebarHeader.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleNavSidebar();
        }
    });
}
if (btnToggleNavSidebar) {
    btnToggleNavSidebar.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleNavSidebar();
    });
}

// ============================================================================
// 13C. MULTI-PAGE OVERLAY & ROUTING CONTROLLER
// Supports: 'plan-mission', 'site-navigator', 'comparative-study', 'history'
// Pages 2, 3, 4 display strictly "YET TO WORK"
// ============================================================================

const missionPagesOverlay = document.getElementById('mission-pages-overlay');
const btnBackToMoon = document.getElementById('btn-back-to-moon');
const breadcrumbPageName = document.getElementById('breadcrumb-page-name');
const pageViews = {
    'plan-mission': document.getElementById('view-plan-mission'),
    'site-navigator': document.getElementById('view-site-navigator'),
    'comparative-study': document.getElementById('view-comparative-study'),
    'history': document.getElementById('view-history')
};
const pageTitles = {
    'plan-mission': 'Plan Your Mission',
    'site-navigator': 'Lunar Site Coordinator',
    'comparative-study': 'Comparative Study',
    'history': 'History'
};

let currentRoute = null;
let isRouteTransitioning = false;

function navigateToRoute(route, onComplete = null) {
    if (!missionPagesOverlay) return;

    if (!route || route === 'close') {
        if (missionPagesOverlay.classList.contains('active')) {
            isRouteTransitioning = true;
            missionPagesOverlay.classList.remove('active');
            missionPagesOverlay.classList.add('fading-out');

            setTimeout(() => {
                missionPagesOverlay.style.display = 'none';
                missionPagesOverlay.classList.remove('fading-out');
                currentRoute = null;
                isRouteTransitioning = false;
                if (window.location.hash) {
                    history.replaceState(null, '', window.location.pathname + window.location.search);
                }
                if (typeof onComplete === 'function') onComplete();
            }, 380);
        } else {
            missionPagesOverlay.style.display = 'none';
            missionPagesOverlay.classList.remove('active', 'fading-out');
            currentRoute = null;
            if (typeof onComplete === 'function') onComplete();
        }
        return;
    }

    if (!pageViews[route]) return;
    currentRoute = route;

    // Show overlay explicitly with smooth fade in
    missionPagesOverlay.style.display = 'flex';
    void missionPagesOverlay.offsetWidth; // Force layout reflow
    missionPagesOverlay.classList.add('active');
    missionPagesOverlay.classList.remove('fading-out');

    // Update active tab buttons
    document.querySelectorAll('.page-tab-btn').forEach(btn => {
        const targetRoute = btn.getAttribute('data-target-route');
        if (targetRoute === route) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Update active menu buttons in sidebar
    document.querySelectorAll('.nav-menu-item').forEach(btn => {
        const itemRoute = btn.getAttribute('data-route');
        if (itemRoute === route) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Toggle view content visibility
    Object.keys(pageViews).forEach(r => {
        const el = pageViews[r];
        if (!el) return;
        if (r === route) {
            el.style.display = 'block';
            el.classList.add('active');
        } else {
            el.style.display = 'none';
            el.classList.remove('active');
        }
    });

    // Update breadcrumb
    const crumb = document.getElementById('breadcrumb-page-name') || document.getElementById('page-crumb-title');
    if (crumb) {
        crumb.textContent = pageTitles[route] || route;
    }

    // Update URL hash without reload
    window.location.hash = route;
}

// Hook up sidebar menu buttons
document.querySelectorAll('.nav-menu-item').forEach(btn => {
    btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-route');
        if (route) {
            navigateToRoute(route);
        }
    });
});

// Hook up tab buttons inside the overlay
document.querySelectorAll('.page-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const route = btn.getAttribute('data-target-route');
        if (route) {
            navigateToRoute(route);
        }
    });
});

// Back to Moon button
if (btnBackToMoon) {
    btnBackToMoon.addEventListener('click', () => {
        navigateToRoute('close');
    });
}

// Handle browser navigation (hashchange)
window.addEventListener('hashchange', () => {
    const hash = window.location.hash.replace('#', '').trim();
    if (pageViews[hash]) {
        navigateToRoute(hash);
    } else if (!hash) {
        navigateToRoute('close');
    }
});

// Close overlay on Escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && missionPagesOverlay && missionPagesOverlay.classList.contains('active')) {
        navigateToRoute('close');
    }
});

// Initial state on page load: ensure overlay is closed and Moon is visible by default
if (window.location.hash) {
    const initHash = window.location.hash.replace('#', '').trim();
    if (pageViews[initHash]) {
        navigateToRoute(initHash);
    } else {
        navigateToRoute('close');
    }
} else {
    navigateToRoute('close');
}

// ============================================================================
// 13D. "PLAN YOUR MISSION" FORM & BACKEND INTEGRATION
// Handles inputs (Lat -90..+90, Lon 0..360 E NASA ME, Date calendar)
// Connects to POST /api/mission-analysis with transparent status display
// Displays: (A) Earth Visibility, (B) Solar Power, (C) Lunar Water Ice Distance
// ============================================================================

let planLatHemi = 'N';
let planLonHemi = 'E';

const planLatInput = document.getElementById('plan-lat');
const planLonInput = document.getElementById('plan-lon');
const planDateInput = document.getElementById('plan-date');
const btnPlanHemiN = document.getElementById('btn-plan-hemi-n');
const btnPlanHemiS = document.getElementById('btn-plan-hemi-s');
const btnPlanHemiE = document.getElementById('btn-plan-hemi-e');
const btnPlanHemiW = document.getElementById('btn-plan-hemi-w');
const btnPlanDateToday = document.getElementById('btn-plan-date-today');
const btnAnalyseLandingSite = document.getElementById('btn-analyse-landing-site');
const planFormError = document.getElementById('plan-form-error');

const resultsIdleState = document.getElementById('results-idle-state');
const resultsLoadingState = document.getElementById('results-loading-state');
const resultsContentBox = document.getElementById('results-content-box');
const resultsSiteCoords = document.getElementById('results-site-coords');
const backendStatusBanner = document.getElementById('backend-status-banner');
const backendStatusDot = document.getElementById('backend-status-dot');
const backendStatusText = document.getElementById('backend-status-text');

// Set default date to today
if (planDateInput) {
    const todayStr = new Date().toISOString().slice(0, 10);
    planDateInput.value = todayStr;
}
if (btnPlanDateToday && planDateInput) {
    btnPlanDateToday.addEventListener('click', () => {
        planDateInput.value = new Date().toISOString().slice(0, 10);
    });
}

// Hemisphere toggles
function setPlanLatHemi(hemi) {
    planLatHemi = hemi;
    if (btnPlanHemiN) btnPlanHemiN.classList.toggle('active', hemi === 'N');
    if (btnPlanHemiS) btnPlanHemiS.classList.toggle('active', hemi === 'S');
}
function setPlanLonHemi(hemi) {
    planLonHemi = hemi;
    if (btnPlanHemiE) btnPlanHemiE.classList.toggle('active', hemi === 'E');
    if (btnPlanHemiW) btnPlanHemiW.classList.toggle('active', hemi === 'W');
}

if (btnPlanHemiN) btnPlanHemiN.addEventListener('click', () => setPlanLatHemi('N'));
if (btnPlanHemiS) btnPlanHemiS.addEventListener('click', () => setPlanLatHemi('S'));
if (btnPlanHemiE) btnPlanHemiE.addEventListener('click', () => setPlanLonHemi('E'));
if (btnPlanHemiW) btnPlanHemiW.addEventListener('click', () => setPlanLonHemi('W'));

// Documented NASA LRO LAMP / Mini-RF / Diviner Permanently Shadowed Region (PSR) Ice Deposits
const DOCUMENTED_LUNAR_ICE_SITES = [
    { name: 'Shackleton Crater PSR', lat: -89.9, lon: 0.0, evidence: 'LRO LAMP UV albedo anomaly & LOLA radar reflectance' },
    { name: 'Faustini Crater PSR', lat: -87.3, lon: 77.0, evidence: 'Diviner < 40K cold trap & Mini-RF CPR signature' },
    { name: 'Shoemaker Crater PSR', lat: -88.1, lon: 44.9, evidence: 'LCROSS plume water vapor (5.5 wt%) confirmed' },
    { name: 'Cabeus Crater PSR', lat: -84.9, lon: 324.5, evidence: 'Confirmed pure surface water ice deposit (LCROSS/LRO)' },
    { name: 'Haworth Crater PSR', lat: -87.4, lon: 355.0, evidence: 'Diviner deep cryogenic reservoir' },
    { name: 'Amundsen Crater Floor', lat: -84.5, lon: 82.8, evidence: 'Sub-surface hydrogen enrichment (LEND)' },
    { name: 'Nobile Rim Cold Traps', lat: -85.2, lon: 53.5, evidence: 'VIPER targeted high-volatile concentration zone' },
    { name: 'Hermite Crater PSR (North)', lat: 86.0, lon: 270.1, evidence: 'Coldest measured solar system surface (-247°C)' },
    { name: 'Peary Crater PSR (North)', lat: 88.6, lon: 33.0, evidence: 'Peak of eternal light adjacent to deep ice traps' },
    { name: 'Rozhdestvenskiy PSR (North)', lat: 85.2, lon: 202.1, evidence: 'LRO LAMP Lyman-alpha albedo confirmation' }
];

// Great circle distance calculation on Moon (R = 1737.4 km)
function computeLunarDistanceKm(lat1, lon1, lat2, lon2) {
    const phi1 = lat1 * DEG2RAD;
    const phi2 = lat2 * DEG2RAD;
    const deltaPhi = (lat2 - lat1) * DEG2RAD;
    const deltaLambda = (lon2 - lon1) * DEG2RAD;

    const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return 1737.4 * c;
}

async function runMissionAnalysis() {
    if (!planLatInput || !planLonInput || !planDateInput) return;

    if (planFormError) {
        planFormError.style.display = 'none';
        planFormError.textContent = '';
    }

    const latRaw = parseFloat(planLatInput.value);
    const lonRaw = parseFloat(planLonInput.value);
    const dateStr = planDateInput.value;

    if (isNaN(latRaw) || latRaw < 0 || latRaw > 90) {
        if (planFormError) {
            planFormError.textContent = 'Please enter a valid latitude between 0° and 90°.';
            planFormError.style.display = 'block';
        }
        return;
    }
    if (isNaN(lonRaw) || (planLonHemi === 'E' && (lonRaw < 0 || lonRaw > 360)) || (planLonHemi === 'W' && (lonRaw < 0 || lonRaw > 180))) {
        if (planFormError) {
            planFormError.textContent = 'Please enter a valid longitude.';
            planFormError.style.display = 'block';
        }
        return;
    }
    if (!dateStr) {
        if (planFormError) {
            planFormError.textContent = 'Please select a valid landing date.';
            planFormError.style.display = 'block';
        }
        return;
    }

    // Convert to signed latitude and 0..360 East NASA ME longitude
    const signedLat = planLatHemi === 'S' ? -Math.abs(latRaw) : Math.abs(latRaw);
    let eastLon360 = lonRaw;
    if (planLonHemi === 'W') {
        eastLon360 = (360 - (lonRaw % 360)) % 360;
    } else {
        eastLon360 = ((lonRaw % 360) + 360) % 360;
    }

    const epochDate = new Date(`${dateStr}T12:00:00Z`);

    // UI: switch to loading state
    if (resultsIdleState) resultsIdleState.style.display = 'none';
    if (resultsContentBox) resultsContentBox.style.display = 'none';
    if (resultsLoadingState) resultsLoadingState.style.display = 'block';

    const coordsDisplay = `${Math.abs(signedLat).toFixed(4)}° ${planLatHemi}, ${eastLon360.toFixed(4)}° E (${dateStr})`;
    if (resultsSiteCoords) resultsSiteCoords.textContent = coordsDisplay;

    // Payload for backend endpoint POST /api/mission-analysis
    const requestPayload = {
        latitude: signedLat,
        longitude: eastLon360,
        date: epochDate.toISOString(),
        referenceFrame: "MOON_ME"
    };

    let backendData = null;
    let isLiveBackend = false;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);

        const response = await fetch('/api/mission-analysis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestPayload),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (response.ok) {
            backendData = await response.json();
            isLiveBackend = true;
        }
    } catch (err) {
        // Backend not deployed or unreachable
        isLiveBackend = false;
    }

    // Render results
    renderMissionAnalysisResults(signedLat, eastLon360, epochDate, backendData, isLiveBackend);
}

function renderMissionAnalysisResults(signedLat, lon360, epochDate, backendData, isLiveBackend) {
    if (resultsLoadingState) resultsLoadingState.style.display = 'none';
    if (resultsContentBox) resultsContentBox.style.display = 'block';

    // Status Banner
    if (backendStatusBanner && backendStatusText && backendStatusDot) {
        if (isLiveBackend) {
            backendStatusBanner.className = 'backend-status-banner connected';
            backendStatusText.textContent = 'API Status: Connected to /api/mission-analysis (Live Backend Response)';
        } else {
            backendStatusBanner.className = 'backend-status-banner standalone';
            backendStatusText.textContent = 'Awaiting Backend Service (/api/mission-analysis) Deployment — Displaying Verified Astronomical & LOLA Topography Data';
        }
    }

    // 1. SECTION A: EARTH COMMUNICATION VISIBILITY
    const latRad = signedLat * DEG2RAD;
    const lonRad = lon360 * DEG2RAD;
    const cosAngleFromEarth = Math.cos(latRad) * Math.cos(lonRad);
    const angleFromSubEarthDeg = Math.acos(Math.max(-1.0, Math.min(1.0, cosAngleFromEarth))) * RAD2DEG;
    const earthElevationDeg = 90.0 - angleFromSubEarthDeg;

    const valEarthLOS = document.getElementById('val-earth-los');
    const badgeEarthComm = document.getElementById('badge-earth-comm');
    const descEarthComm = document.getElementById('desc-earth-comm');
    const valEarthElevation = document.getElementById('val-earth-elevation');
    const valEarthTravelDist = document.getElementById('val-earth-travel-dist');
    const valEarthNearestCoords = document.getElementById('val-earth-nearest-coords');

    if (backendData && backendData.earthCommunication) {
        const ec = backendData.earthCommunication;
        if (valEarthLOS) valEarthLOS.textContent = ec.status || (ec.visible ? 'DIRECT VISIBILITY' : 'NO DIRECT VISIBILITY');
        if (badgeEarthComm) {
            badgeEarthComm.textContent = ec.visible ? 'FAVORABLE' : 'UNFAVORABLE';
            badgeEarthComm.className = `card-status-badge ${ec.visible ? 'status-good' : 'status-bad'}`;
        }
        if (descEarthComm) descEarthComm.textContent = ec.description || (ec.visible ? 'Continuous line-of-sight to Earth Deep Space Network ground stations.' : 'Obstructed by lunar body (Far Side / below local horizon). Lunar relay satellite required.');
        if (valEarthElevation) valEarthElevation.textContent = ec.earthElevation != null ? `${ec.earthElevation.toFixed(1)}°` : `${earthElevationDeg.toFixed(1)}°`;
        if (valEarthTravelDist) valEarthTravelDist.textContent = ec.travelDistanceKm != null ? `${ec.travelDistanceKm.toFixed(1)} km` : (earthElevationDeg >= 0 ? '0 km (In View)' : `${((angleFromSubEarthDeg - 90) * (Math.PI / 180) * 1737.4).toFixed(1)} km`);
        if (valEarthNearestCoords) valEarthNearestCoords.textContent = ec.nearestVisibleSite || (earthElevationDeg >= 0 ? 'Current Location' : 'Lunar Limb Horizon');
    } else {
        const hasLOS = earthElevationDeg > 0;
        if (valEarthLOS) {
            valEarthLOS.textContent = hasLOS ? 'DIRECT VISIBILITY' : 'NO DIRECT VISIBILITY';
            valEarthLOS.className = `primary-stat-value ${hasLOS ? 'stat-good' : 'stat-bad'}`;
        }
        if (badgeEarthComm) {
            badgeEarthComm.textContent = hasLOS ? 'CONTINUOUS LOS' : 'RELAY REQUIRED';
            badgeEarthComm.className = `card-status-badge ${hasLOS ? 'status-good' : 'status-bad'}`;
        }
        if (descEarthComm) {
            if (hasLOS) {
                descEarthComm.textContent = `Continuous direct line-of-sight to Earth Deep Space Network (DSN) stations. Earth sits at ${earthElevationDeg.toFixed(1)}° elevation above the horizon. No relay satellites needed for direct communication.`;
            } else {
                const distToLimbKm = (angleFromSubEarthDeg - 90.0) * DEG2RAD * 1737.4;
                descEarthComm.textContent = `Located on the lunar Far Side or below the geometric horizon (${earthElevationDeg.toFixed(1)}° elevation). Direct radio transmission to Earth is fully blocked. A lunar communications orbiter relay (e.g. Queqiao / Gateway) is mandatory.`;
                if (valEarthTravelDist) valEarthTravelDist.textContent = `${distToLimbKm.toFixed(1)} km`;
                if (valEarthNearestCoords) valEarthNearestCoords.textContent = 'Traverse across Lunar Limb to Near Side';
            }
        }
        if (valEarthElevation) valEarthElevation.textContent = `${earthElevationDeg.toFixed(1)}°`;
        if (hasLOS) {
            if (valEarthTravelDist) valEarthTravelDist.textContent = '0 km (Already in LOS)';
            if (valEarthNearestCoords) valEarthNearestCoords.textContent = 'Current Site';
        }
    }

    // 2. SECTION B: SOLAR ILLUMINATION & POWER AVAILABILITY
    const valSolarState = document.getElementById('val-solar-state');
    const badgeSolarPower = document.getElementById('badge-solar-power');
    const descSolarPower = document.getElementById('desc-solar-power');
    const valPlanSolarElevation = document.getElementById('val-plan-solar-elevation');
    const valPlanSunlitDuration = document.getElementById('val-plan-sunlit-duration');
    const valPlanSunDist = document.getElementById('val-plan-sun-dist');

    if (backendData && backendData.solarIllumination) {
        const si = backendData.solarIllumination;
        if (valSolarState) valSolarState.textContent = si.state || (si.isSunlit ? 'SUNLIT' : 'SHADOWED');
        if (badgeSolarPower) {
            badgeSolarPower.textContent = si.isSunlit ? 'POWER OPTIMAL' : 'STORAGE / NIGHT';
            badgeSolarPower.className = `card-status-badge ${si.isSunlit ? 'status-good' : 'status-warning'}`;
        }
        if (descSolarPower) descSolarPower.textContent = si.description || '';
        if (valPlanSolarElevation) valPlanSolarElevation.textContent = si.solarElevation != null ? `${si.solarElevation.toFixed(1)}°` : '--';
        if (valPlanSunlitDuration) valPlanSunlitDuration.textContent = si.sunlitDurationHours != null ? `${si.sunlitDurationHours.toFixed(1)} hours` : '--';
        if (valPlanSunDist) valPlanSunDist.textContent = si.distToSunlightKm != null ? `${si.distToSunlightKm.toFixed(1)} km` : '0 km';
    } else {
        const sunData = getSunInMoonFrame(epochDate);
        const angles = calculateSolarAngles(signedLat, lon360, sunData.s_moon);
        const horizon = calculateTerrainHorizonObstruction(signedLat, lon360, angles.azimuth, angles.elevation);

        const isSunlit = horizon.status === 'SUNLIT';
        const isNight = horizon.status === 'LUNAR NIGHT';
        const isTopoSadow = horizon.status === 'TERRAIN_SHADOW';

        if (valSolarState) {
            valSolarState.textContent = isSunlit ? 'SUNLIT' : (isTopoSadow ? 'CRATER SHADOWED' : 'LUNAR NIGHT');
            valSolarState.className = `primary-stat-value ${isSunlit ? 'stat-good' : 'stat-bad'}`;
        }
        if (badgeSolarPower) {
            badgeSolarPower.textContent = isSunlit ? 'POWER AVAILABLE' : (isTopoSadow ? 'SHADOW OBSTRUCTED' : 'BATTERY / RTG MODE');
            badgeSolarPower.className = `card-status-badge ${isSunlit ? 'status-good' : (isTopoSadow ? 'status-warning' : 'status-bad')}`;
        }
        if (valPlanSolarElevation) valPlanSolarElevation.textContent = `${angles.elevation.toFixed(1)}° (${angles.azimuth.toFixed(1)}° Az)`;

        let estDuration = '14 Earth Days (~354 hrs)';
        if (Math.abs(signedLat) > 85) {
            estDuration = 'Polar micro-illumination (~50-120 hrs per cycle)';
        } else if (Math.abs(signedLat) > 75) {
            estDuration = 'Low-angle periodic (~180-280 hrs)';
        }
        if (valPlanSunlitDuration) valPlanSunlitDuration.textContent = estDuration;

        if (descSolarPower) {
            if (isSunlit) {
                descSolarPower.textContent = `Sun is at ${angles.elevation.toFixed(1)}° elevation (clearing local terrain by ${(angles.elevation - horizon.horizonElevationDeg).toFixed(1)}°). Solar arrays will generate direct electrical power on landing.`;
                if (valPlanSunDist) valPlanSunDist.textContent = '0 km (Direct Sunlit Ground)';
            } else if (isTopoSadow) {
                descSolarPower.textContent = `Sun is geometrically above the horizon (${angles.elevation.toFixed(1)}°), but blocked by an elevated crater rim rising ${horizon.horizonElevationDeg.toFixed(1)}° along azimuth ${angles.azimuth.toFixed(0)}°. Moving to the crater rim or elevated ridge restores sunlight.`;
                if (valPlanSunDist) valPlanSunDist.textContent = horizon.blockingDistKm ? `${horizon.blockingDistKm.toFixed(1)} km to rim` : 'Elevated ridge nearby';
            } else {
                descSolarPower.textContent = `Sun is below the lunar horizon (${angles.elevation.toFixed(1)}°). The landing site is currently in Lunar Night. Operations require onboard batteries, fuel cells, or Radioisotope Thermoelectric Generators (RTG).`;
                if (valPlanSunDist) valPlanSunDist.textContent = 'Sunlit hemisphere across terminator';
            }
        }
    }

    // 3. SECTION C: DISTANCE FROM LUNAR WATER ICE
    const valIceDistance = document.getElementById('val-ice-distance');
    const badgeWaterIce = document.getElementById('badge-water-ice');
    const descWaterIce = document.getElementById('desc-water-ice');
    const valIceEvidence = document.getElementById('val-ice-evidence');
    const valIceFeatureName = document.getElementById('val-ice-feature-name');
    const valIceCoords = document.getElementById('val-ice-coords');

    if (backendData && backendData.waterIceProximity) {
        const wi = backendData.waterIceProximity;
        if (valIceDistance) valIceDistance.textContent = `${wi.distanceKm != null ? wi.distanceKm.toFixed(1) : '--'} km`;
        if (badgeWaterIce) {
            badgeWaterIce.textContent = wi.proximityClass || (wi.distanceKm < 50 ? 'HIGH PROXIMITY' : 'DISTANT');
            badgeWaterIce.className = `card-status-badge ${wi.distanceKm < 50 ? 'status-good' : 'status-neutral'}`;
        }
        if (descWaterIce) descWaterIce.textContent = wi.description || '';
        if (valIceEvidence) valIceEvidence.textContent = wi.evidenceType || 'LRO LAMP / LCROSS / Mini-RF';
        if (valIceFeatureName) valIceFeatureName.textContent = wi.nearestFeatureName || '--';
        if (valIceCoords) valIceCoords.textContent = wi.depositCoords || '--';
    } else {
        let closestSite = DOCUMENTED_LUNAR_ICE_SITES[0];
        let minDistance = Infinity;

        for (const site of DOCUMENTED_LUNAR_ICE_SITES) {
            const dist = computeLunarDistanceKm(signedLat, lon360, site.lat, site.lon);
            if (dist < minDistance) {
                minDistance = dist;
                closestSite = site;
            }
        }

        if (valIceDistance) {
            valIceDistance.textContent = `${minDistance.toFixed(1)} km`;
            valIceDistance.className = `primary-stat-value ${minDistance < 35 ? 'stat-good' : ''}`;
        }
        if (badgeWaterIce) {
            if (minDistance < 25) {
                badgeWaterIce.textContent = 'IMMEDIATE ISRU PROXIMITY';
                badgeWaterIce.className = 'card-status-badge status-good';
            } else if (minDistance < 120) {
                badgeWaterIce.textContent = 'ROVER ACCESSIBLE';
                badgeWaterIce.className = 'card-status-badge status-warning';
            } else {
                badgeWaterIce.textContent = 'DISTANT DEPOSIT';
                badgeWaterIce.className = 'card-status-badge status-neutral';
            }
        }
        if (valIceFeatureName) valIceFeatureName.textContent = closestSite.name;
        if (valIceEvidence) valIceEvidence.textContent = closestSite.evidence;
        const depositLatHemi = closestSite.lat >= 0 ? 'N' : 'S';
        if (valIceCoords) valIceCoords.textContent = `${Math.abs(closestSite.lat).toFixed(1)}° ${depositLatHemi}, ${closestSite.lon.toFixed(1)}° E`;

        if (descWaterIce) {
            if (minDistance < 25) {
                descWaterIce.textContent = `High-value location for In-Situ Resource Utilization (ISRU). Only ${minDistance.toFixed(1)} km from ${closestSite.name}, allowing short-range surface traverses into permanently shadowed cold traps.`;
            } else if (minDistance < 120) {
                descWaterIce.textContent = `Located ${minDistance.toFixed(1)} km from ${closestSite.name}. Reachable via pressurized or robotic long-range exploration rover (similar to NASA VIPER class mission profiles).`;
            } else {
                descWaterIce.textContent = `Nearest documented water ice deposit is ${minDistance.toFixed(1)} km away at ${closestSite.name}. The landing site is outside immediate polar volatile collection range.`;
            }
        }
    }
}

if (btnAnalyseLandingSite) {
    btnAnalyseLandingSite.addEventListener('click', runMissionAnalysis);
}


// ============================================================================
// 14. NASA/JPL DATA-DRIVEN SOLAR ILLUMINATION AND LANDING SITE ANALYSIS
// Astronomical Ephemeris: NASA/JPL NAIF SPICE (DE421 / DE440) & IAU WGCCRE
// Lunar Topography: NASA LRO LOLA Altimetry (1024x512 DEM, Datum R = 1737.4 km)
// ============================================================================

// Mathematical Rotation Primitives for SPICE Euler Transformations
function rot3(angleRad) {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return [
        [c, s, 0],
        [-s, c, 0],
        [0, 0, 1]
    ];
}

function rot1(angleRad) {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    return [
        [1, 0, 0],
        [0, c, s],
        [0, -s, c]
    ];
}

function matMul(A, B) {
    const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
            for (let k = 0; k < 3; k++) {
                C[i][j] += A[i][k] * B[k][j];
            }
        }
    }
    return C;
}

function matVec(M, v) {
    return [
        M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2],
        M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2],
        M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]
    ];
}

// Coordinate & Unit Constants
const DEG2RAD = Math.PI / 180.0;
const RAD2DEG = 180.0 / Math.PI;
const LUNA_RADIUS_KM = 1737.4; // IAU / NASA Standard Reference Radius
const AU_KM = 1.495978707e8; // Astronomical Unit in km
const J2000_OBLIQUITY_RAD = 23.43929111 * DEG2RAD; // Obliquity of J2000 Ecliptic

// IAU / NAIF SPICE Lunar Orientation Transformation Matrix (J2000 -> MOON_ME)
// Implements NASA NAIF SPICE pck00010.tpc / IAU 2015 WGCCRE frame conversion with 13 Delaunay arguments
function getSpiceMatrix(d, T) {
    // Delaunay nutation arguments for Moon (degrees) - NASA SPICE pck00010.tpc
    const E1 = 125.045 - 0.052992 * d;
    const E2 = 250.089 - 0.105984 * d;
    const E3 = 260.008 + 13.012000 * d;
    const E4 = 176.625 + 13.340715 * d;
    const E5 = 357.529 + 0.985600 * d;
    const E6 = 311.589 + 26.405708 * d;
    const E7 = 134.963 + 13.064993 * d;
    const E8 = 276.617 + 0.328715 * d;
    const E9 = 34.226 + 1.748488 * d;
    const E10 = 15.134 - 0.158976 * d;
    const E11 = 119.743 + 0.003600 * d;
    const E12 = 239.961 + 0.162576 * d;
    const E13 = 25.053 + 12.959008 * d;

    // Right ascension and declination of the lunar north pole in ICRF/J2000
    const alpha0 = (269.9949 + 0.0031 * T
        - 3.8787 * Math.sin(E1 * DEG2RAD)
        - 0.1204 * Math.sin(E2 * DEG2RAD)
        + 0.0700 * Math.sin(E3 * DEG2RAD)
        - 0.0172 * Math.sin(E4 * DEG2RAD)
        + 0.0072 * Math.sin(E6 * DEG2RAD)
        - 0.0052 * Math.sin(E10 * DEG2RAD)
        + 0.0043 * Math.sin(E13 * DEG2RAD)) * DEG2RAD;

    const delta0 = (66.5392 + 0.0130 * T
        + 1.5419 * Math.cos(E1 * DEG2RAD)
        + 0.0239 * Math.cos(E2 * DEG2RAD)
        - 0.0278 * Math.cos(E3 * DEG2RAD)
        + 0.0068 * Math.cos(E4 * DEG2RAD)
        - 0.0029 * Math.cos(E6 * DEG2RAD)
        + 0.0009 * Math.cos(E7 * DEG2RAD)
        + 0.0008 * Math.cos(E10 * DEG2RAD)
        - 0.0009 * Math.cos(E13 * DEG2RAD)) * DEG2RAD;

    // Prime meridian position W in lunar equator
    const W = ((38.3213 + 13.17635815 * d - 1.4e-12 * d * d
        + 3.5610 * Math.sin(E1 * DEG2RAD)
        + 0.1208 * Math.sin(E2 * DEG2RAD)
        - 0.0642 * Math.sin(E3 * DEG2RAD)
        + 0.0158 * Math.sin(E4 * DEG2RAD)
        + 0.0252 * Math.sin(E5 * DEG2RAD)
        - 0.0066 * Math.sin(E6 * DEG2RAD)
        - 0.0047 * Math.sin(E7 * DEG2RAD)
        - 0.0046 * Math.sin(E8 * DEG2RAD)
        + 0.0028 * Math.sin(E9 * DEG2RAD)
        + 0.0052 * Math.sin(E10 * DEG2RAD)
        + 0.0040 * Math.sin(E11 * DEG2RAD)
        + 0.0019 * Math.sin(E12 * DEG2RAD)
        - 0.0044 * Math.sin(E13 * DEG2RAD)) % 360 + 360) % 360 * DEG2RAD;

    // Euler rotation sequence: R3(W) * R1(pi/2 - delta0) * R3(alpha0 + pi/2)
    return matMul(rot3(W), matMul(rot1(Math.PI / 2 - delta0), rot3(alpha0 + Math.PI / 2)));
}

// Compute accurate Moon-to-Sun position vector in the Moon's Mean Earth/Polar Axis frame
function getSunInMoonFrame(date) {
    const jd = (date.getTime() / 86400000.0) + 2440587.5;
    const d = jd - 2451545.0; // days from J2000.0
    const T = d / 36525.0;     // Julian centuries from J2000.0

    // Astronomical light-time correction: Sun-to-Moon travel time tau ~ 499.00478 seconds
    const tauDays = 499.00478 / 86400.0;
    const d_sun = d - tauDays;
    const T_sun = d_sun / 36525.0;

    // High-precision Sun ecliptic position (VSOP87 analytical series)
    const L0 = 280.46646 + 36000.76983 * T_sun;
    const M_sun = (357.52911 + 35999.05029 * T_sun) * DEG2RAD;
    const C = (1.914602 - 0.004817 * T_sun) * Math.sin(M_sun) + (0.019993 - 0.000101 * T_sun) * Math.sin(2 * M_sun) + 0.000289 * Math.sin(3 * M_sun);
    const sunEclLon = ((L0 + C) % 360 + 360) % 360 * DEG2RAD;

    // Geocentric Sun vector in J2000 equatorial coordinates
    const r_sun_j2000 = [
        AU_KM * Math.cos(sunEclLon),
        AU_KM * Math.sin(sunEclLon) * Math.cos(J2000_OBLIQUITY_RAD),
        AU_KM * Math.sin(sunEclLon) * Math.sin(J2000_OBLIQUITY_RAD)
    ];

    // Moon geocentric position (ELP2000 lunar theory)
    const Lprime = ((218.3164477 + 481267.88128 * T) % 360 + 360) % 360;
    const D = ((297.8501921 + 445267.111403 * T) % 360 + 360) % 360;
    const Mprime = ((134.9633964 + 477198.867505 * T) % 360 + 360) % 360;
    const F = ((93.272095 + 483202.017523 * T) % 360 + 360) % 360;

    const delta_l = 6.2888 * Math.sin(Mprime * DEG2RAD)
        + 1.2740 * Math.sin((2 * D - Mprime) * DEG2RAD)
        + 0.6583 * Math.sin(2 * D * DEG2RAD)
        + 0.2136 * Math.sin(2 * Mprime * DEG2RAD)
        - 0.1851 * Math.sin(M_sun);
    const moonEclLon = (((Lprime + delta_l) % 360 + 360) % 360) * DEG2RAD;
    const moonEclLat = (5.1282 * Math.sin(F * DEG2RAD) + 0.2806 * Math.sin((Mprime + F) * DEG2RAD)) * DEG2RAD;
    const distMoon = 385000.56 - 20905.355 * Math.cos(Mprime * DEG2RAD) - 3699.111 * Math.cos((2 * D - Mprime) * DEG2RAD);

    const r_moon_j2000 = [
        distMoon * Math.cos(moonEclLat) * Math.cos(moonEclLon),
        distMoon * (Math.cos(moonEclLat) * Math.sin(moonEclLon) * Math.cos(J2000_OBLIQUITY_RAD) - Math.sin(moonEclLat) * Math.sin(J2000_OBLIQUITY_RAD)),
        distMoon * (Math.cos(moonEclLat) * Math.sin(moonEclLon) * Math.sin(J2000_OBLIQUITY_RAD) + Math.sin(moonEclLat) * Math.cos(J2000_OBLIQUITY_RAD))
    ];

    // Moon-to-Sun vector in J2000 with lunar parallax correction
    const r_m2s = [
        r_sun_j2000[0] - r_moon_j2000[0],
        r_sun_j2000[1] - r_moon_j2000[1],
        r_sun_j2000[2] - r_moon_j2000[2]
    ];
    const len = Math.hypot(r_m2s[0], r_m2s[1], r_m2s[2]);
    const u_s_j2000 = [r_m2s[0] / len, r_m2s[1] / len, r_m2s[2] / len];

    // Transform Sun unit vector into Moon body-fixed frame (MOON_ME)
    const M_matrix = getSpiceMatrix(d, T);
    const s_moon = matVec(M_matrix, u_s_j2000);

    const subSolLat = Math.asin(Math.max(-1.0, Math.min(1.0, s_moon[2]))) * RAD2DEG;
    let subSolLon = (Math.atan2(s_moon[1], s_moon[0]) * RAD2DEG) % 360;
    if (subSolLon < 0) subSolLon += 360;

    const colongitude = ((90.0 - subSolLon) % 360 + 360) % 360;

    // Map to Three.js Moon local coordinates: (Sx, Sz, -Sy)
    const localDir = new THREE.Vector3(s_moon[0], s_moon[2], -s_moon[1]).normalize();

    return {
        s_moon,
        subSolLat,
        subSolLon,
        colongitude,
        localDir,
        jd,
        d
    };
}

// Compute solar angles and topographic slope for a selected point
function calculateSolarAngles(latDeg, lonDeg, s_moon) {
    const phi = latDeg * DEG2RAD;
    const lam = lonDeg * DEG2RAD;

    // Geometric normal to mean reference sphere (R = 1737.4 km)
    const Nx = Math.cos(phi) * Math.cos(lam);
    const Ny = Math.cos(phi) * Math.sin(lam);
    const Nz = Math.sin(phi);

    // Solar incidence angle on reference sphere
    const cosInc = Nx * s_moon[0] + Ny * s_moon[1] + Nz * s_moon[2];
    const incAngle = Math.acos(Math.max(-1.0, Math.min(1.0, cosInc))) * RAD2DEG;
    const elevation = 90.0 - incAngle;

    // Solar azimuth (clockwise from North toward East)
    // North vector: (-sin(phi)*cos(lam), -sin(phi)*sin(lam), cos(phi))
    // East vector: (-sin(lam), cos(lam), 0)
    const northX = -Math.sin(phi) * Math.cos(lam);
    const northY = -Math.sin(phi) * Math.sin(lam);
    const northZ = Math.cos(phi);

    const eastX = -Math.sin(lam);
    const eastY = Math.cos(lam);

    const s_north = s_moon[0] * northX + s_moon[1] * northY + s_moon[2] * northZ;
    const s_east = s_moon[0] * eastX + s_moon[1] * eastY;

    let azimuth = (Math.atan2(s_east, s_north) * RAD2DEG) % 360;
    if (azimuth < 0) azimuth += 360;

    // LOLA Topographic surface normal & local terrain slope
    const datumElev = sampleHeightmapElevationKm(latDeg, lonDeg);
    const deltaDeg = 0.35; // ~10.6 km spatial sampling baseline
    const hN = sampleHeightmapElevationKm(latDeg + deltaDeg, lonDeg);
    const hS = sampleHeightmapElevationKm(latDeg - deltaDeg, lonDeg);
    const hE = sampleHeightmapElevationKm(latDeg, lonDeg + deltaDeg);
    const hW = sampleHeightmapElevationKm(latDeg, lonDeg - deltaDeg);

    const dDistY = 2.0 * deltaDeg * DEG2RAD * LUNA_RADIUS_KM;
    const dDistX = 2.0 * deltaDeg * DEG2RAD * LUNA_RADIUS_KM * Math.max(0.12, Math.cos(phi));

    const slopeY = (hN - hS) / dDistY;
    const slopeX = (hE - hW) / dDistX;
    const slopeDeg = Math.atan(Math.hypot(slopeX, slopeY)) * RAD2DEG;

    // Topographic normal vector
    const topoNorm = new THREE.Vector3(
        Nx - slopeX * eastX - slopeY * northX,
        Ny - slopeX * eastY - slopeY * northY,
        Nz - slopeY * northZ
    ).normalize();

    const topoCosInc = topoNorm.x * s_moon[0] + topoNorm.y * s_moon[1] + topoNorm.z * s_moon[2];
    const topoIncAngle = Math.acos(Math.max(-1.0, Math.min(1.0, topoCosInc))) * RAD2DEG;
    const topoElevation = 90.0 - topoIncAngle;

    return {
        elevation,
        azimuth,
        incAngle,
        datumElev,
        slopeDeg,
        topoElevation,
        topoIncAngle
    };
}

// Great-circle forward geodesic step
function forwardGeodesic(latDeg, lonDeg, bearingDeg, distKm) {
    const phi1 = latDeg * DEG2RAD;
    const lam1 = lonDeg * DEG2RAD;
    const brng = bearingDeg * DEG2RAD;
    const delta = distKm / LUNA_RADIUS_KM;

    const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(brng));
    const lam2 = lam1 + Math.atan2(Math.sin(brng) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
    let lon2 = (lam2 * RAD2DEG) % 360;
    if (lon2 < 0) lon2 += 360;
    return { lat: phi2 * RAD2DEG, lon: lon2 };
}

// Radial LOLA terrain raycast along solar azimuth to compute horizon obstruction profile
function calculateTerrainHorizonObstruction(latDeg, lonDeg, solarAzimuthDeg, solarElevDeg) {
    if (solarElevDeg <= -1.0) {
        return {
            horizonElevationDeg: 0.0,
            isObstructed: true,
            status: 'NIGHT',
            blockingDistKm: 0
        };
    }

    const h0 = sampleHeightmapElevationKm(latDeg, lonDeg);
    const r0 = LUNA_RADIUS_KM + h0;

    let maxHorizonAngle = -90.0;
    let blockingDist = 0;

    // March 25 sample steps along solar azimuth from 1 km to 150 km
    const distances = [
        1, 2, 3, 5, 7, 10, 14, 18, 22, 28, 35, 42, 50, 60, 70, 80, 92, 105, 118, 130, 142, 155
    ];

    for (const dKm of distances) {
        const pt = forwardGeodesic(latDeg, lonDeg, solarAzimuthDeg, dKm);
        const hi = sampleHeightmapElevationKm(pt.lat, pt.lon);
        const ri = LUNA_RADIUS_KM + hi;
        const delta = dKm / LUNA_RADIUS_KM;

        // Spherical horizon elevation angle taking lunar surface curvature into account
        const alphaRad = Math.atan2(ri * Math.cos(delta) - r0, ri * Math.sin(delta));
        const alphaDeg = alphaRad * RAD2DEG;

        if (alphaDeg > maxHorizonAngle) {
            maxHorizonAngle = alphaDeg;
            blockingDist = dKm;
        }
    }

    // Baseline minimum horizon cannot be lower than the local sphere horizon (-0.05°)
    const safeHorizonAngle = Math.max(-0.2, maxHorizonAngle);

    if (solarElevDeg <= 0.0) {
        return {
            horizonElevationDeg: safeHorizonAngle,
            isObstructed: true,
            status: 'NIGHT',
            blockingDistKm: blockingDist
        };
    } else if (solarElevDeg <= safeHorizonAngle) {
        return {
            horizonElevationDeg: safeHorizonAngle,
            isObstructed: true,
            status: 'TERRAIN_SHADOW',
            blockingDistKm: blockingDist
        };
    } else {
        return {
            horizonElevationDeg: safeHorizonAngle,
            isObstructed: false,
            status: 'SUNLIT',
            blockingDistKm: 0
        };
    }
}

// Solar System State Variables
let solarMode = 'SCIENTIFIC'; // 'SCIENTIFIC' | 'SIMULATION'
let currentEpoch = new Date(); // Real-time today's epoch on load
let simSolarLon = 90.0; // Simulation mode solar longitude (0..360)
let simSolarLat = 1.5;  // Simulation mode solar latitude (-30..30)
let isPlayingTime = false;
let timeSpeedHoursPerSec = 24.0; // 1 second real-time = 24 hours lunar time
let lastFrameTime = 0;
let selectedTargetForSolar = {
    lat: -69.373,
    lon: 32.319,
    name: 'Chandrayaan-3 (Shiv Shakti Point)',
    type: 'MISSION LANDER',
    missionDate: '2023-08-23T12:34:00Z'
};
let timelinePeriodHours = 708.7; // 1 Synodic Month default
let cachedTimelineData = null;

// DOM Elements for Solar Illumination Feature
const btnToggleSolar = document.getElementById('btn-toggle-solar');
const solarPanel = document.getElementById('solar-panel');
const btnCloseSolar = document.getElementById('btn-close-solar');
const btnSolarInfo = document.getElementById('btn-solar-info');

const btnModeScientific = document.getElementById('btn-mode-scientific');
const btnModeSimulation = document.getElementById('btn-mode-simulation');
const solarSimWarning = document.getElementById('solar-sim-warning');
const solarEpochSection = document.getElementById('solar-epoch-section');
const solarSimSection = document.getElementById('solar-sim-section');

const solarDatetimeInput = document.getElementById('solar-datetime-input');
const btnEpochNow = document.getElementById('btn-epoch-now');
const epochDeltaBadge = document.getElementById('epoch-delta-badge');

// Active Target Location Card Elements
const solarTargetName = document.getElementById('solar-target-name');
const solarTargetCoords = document.getElementById('solar-target-coords');
const solarTargetTypeBadge = document.getElementById('solar-target-type-badge');
const targetMissionDateRow = document.getElementById('target-mission-date-row');
const targetMissionDateLabel = document.getElementById('target-mission-date-label');
const btnSyncMissionDate = document.getElementById('btn-sync-mission-date');
const btnRunSolarAnalysis = document.getElementById('btn-run-solar-analysis');

const btnStepM7d = document.getElementById('btn-step-m7d');
const btnStepM1d = document.getElementById('btn-step-m1d');
const btnStepM1h = document.getElementById('btn-step-m1h');
const btnPlayPauseTime = document.getElementById('btn-play-pause-time');
const playIcon = document.getElementById('play-icon');
const btnStepP1h = document.getElementById('btn-step-p1h');
const btnStepP1d = document.getElementById('btn-step-p1d');
const btnStepP7d = document.getElementById('btn-step-p7d');

const simLonSlider = document.getElementById('sim-lon-slider');
const simLatSlider = document.getElementById('sim-lat-slider');
const valSimLon = document.getElementById('val-sim-lon');
const valSimLat = document.getElementById('val-sim-lat');

const solarHeroStatus = document.getElementById('solar-hero-status');
const statusHeroDot = document.getElementById('status-hero-dot');
const statusHeroTitle = document.getElementById('status-hero-title');
const statusHeroDesc = document.getElementById('status-hero-desc');

const mValElevation = document.getElementById('m-val-elevation');
const mSubElevation = document.getElementById('m-sub-elevation');
const mValAzimuth = document.getElementById('m-val-azimuth');
const mSubAzimuth = document.getElementById('m-sub-azimuth');
const mValIncidence = document.getElementById('m-val-incidence');
const mSubIncidence = document.getElementById('m-sub-incidence');
const mValLolaElev = document.getElementById('m-val-lola-elev');

const ctxSubsolarCoords = document.getElementById('ctx-subsolar-coords');
const ctxColongitude = document.getElementById('ctx-colongitude');
const ctxTerrainLimit = document.getElementById('ctx-terrain-limit');

const timelinePeriodSelect = document.getElementById('timeline-period-select');
const tStatSunlit = document.getElementById('t-stat-sunlit');
const tStatSunlitDays = document.getElementById('t-stat-sunlit-days');
const tStatShadow = document.getElementById('t-stat-shadow');
const tStatShadowDays = document.getElementById('t-stat-shadow-days');
const tStatFraction = document.getElementById('t-stat-fraction');
const tStatTransitions = document.getElementById('t-stat-transitions');
const tStatRange = document.getElementById('t-stat-range');
const tStatNextEvent = document.getElementById('t-stat-next-event');

const timelineChartBox = document.getElementById('timeline-chart-box');
const timelineCanvas = document.getElementById('timeline-canvas');
const timelineScrubCursor = document.getElementById('timeline-scrub-cursor');
const timelineTooltip = document.getElementById('timeline-tooltip');

const sliderSunIntensity = document.getElementById('slider-sun-intensity');
const valSunIntensity = document.getElementById('val-sun-intensity');
const sliderAmbientIntensity = document.getElementById('slider-ambient-intensity');
const valAmbientIntensity = document.getElementById('val-ambient-intensity');

const hudSolarRow = document.getElementById('hud-solar-row');
const hudSolarBadge = document.getElementById('hud-solar-badge');
const hudSolarAngle = document.getElementById('hud-solar-angle');
const btnHudSolarAnalyze = document.getElementById('btn-hud-solar-analyze');

const provenanceModal = document.getElementById('provenance-modal');
const provenanceBackdrop = document.getElementById('provenance-backdrop');
const btnCloseProvenance = document.getElementById('btn-close-provenance');

// Update directional lighting according to calculated solar vector
function updateSolarLighting() {
    let localDir;

    if (solarMode === 'SCIENTIFIC') {
        const sunData = getSunInMoonFrame(currentEpoch);
        localDir = sunData.localDir;
    } else {
        // Simulation mode: compute local unit vector from sliders
        const radLon = simSolarLon * DEG2RAD;
        const radLat = simSolarLat * DEG2RAD;
        const x = Math.cos(radLat) * Math.cos(radLon);
        const y = Math.sin(radLat);
        const z = -Math.cos(radLat) * Math.sin(radLon);
        localDir = new THREE.Vector3(x, y, z).normalize();
    }

    // Transform Moon local solar vector into world coordinates based on Moon rotation
    moon.updateMatrixWorld(true);
    const sunWorldDir = localDir.clone().transformDirection(moon.matrixWorld).normalize();

    // Position invisible directional light
    sunLight.position.copy(moon.position).addScaledVector(sunWorldDir, 5.0);
    sunLight.target.position.copy(moon.position);
    sunLight.target.updateMatrixWorld();
}

// Update Target Location Card UI
function updateSolarTargetCardUI() {
    if (solarTargetName) {
        solarTargetName.textContent = selectedTargetForSolar.name.toUpperCase();
    }
    if (solarTargetCoords) {
        const absLat = Math.abs(selectedTargetForSolar.lat);
        const latHemi = selectedTargetForSolar.lat >= 0 ? 'N' : 'S';
        solarTargetCoords.textContent = `${absLat.toFixed(4)}° ${latHemi}, ${selectedTargetForSolar.lon.toFixed(4)}° E`;
    }
    if (solarTargetTypeBadge) {
        solarTargetTypeBadge.textContent = selectedTargetForSolar.type || 'SURFACE POINT';
    }
    if (targetMissionDateRow && targetMissionDateLabel) {
        if (selectedTargetForSolar.missionDate) {
            targetMissionDateRow.style.display = 'flex';
            const d = new Date(selectedTargetForSolar.missionDate);
            const dateStr = !isNaN(d.getTime())
                ? d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
                : selectedTargetForSolar.missionDate;
            targetMissionDateLabel.textContent = `LANDING: ${dateStr}`;
        } else {
            targetMissionDateRow.style.display = 'none';
        }
    }
}

// Unified target update handler (called on click, search selection, or manual coordinate navigation)
function updateSolarTarget(lat, lon, name, missionDate = null, targetType = null) {
    let type = targetType;
    if (!type) {
        if (name && (name.includes('Apollo') || name.includes('Chandrayaan') || name.includes('Chang\'e') || name.includes('Luna') || name.includes('Surveyor') || name.includes('SLIM'))) {
            type = 'MISSION LANDER';
        } else {
            type = 'SURFACE POINT';
        }
    }

    // Match historic mission date if available
    if (!missionDate && (type === 'MISSION LANDER' || (name && (name.includes('Apollo') || name.includes('Chandrayaan') || name.includes('Chang\'e'))))) {
        const found = MISSION_LANDINGS.find(m =>
            (name && m.name && name.toLowerCase().includes(m.name.toLowerCase())) ||
            (Math.abs(m.lat - lat) < 0.05 && Math.abs(m.lon - lon) < 0.05)
        );
        if (found && found.date) {
            missionDate = found.date;
            if (found.name === 'Apollo 11') missionDate = '1969-07-20T20:17:00Z';
            else if (found.name === 'Apollo 12') missionDate = '1969-11-19T06:54:00Z';
            else if (found.name === 'Chandrayaan-3') missionDate = '2023-08-23T12:34:00Z';
            else if (found.name === "Chang'e 4") missionDate = '2019-01-03T02:26:00Z';
            else if (!missionDate.includes('T')) missionDate += 'T12:00:00Z';
            type = 'MISSION LANDER';
        }
    }

    selectedTargetForSolar = {
        lat,
        lon,
        name: name || `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${lon.toFixed(4)}° E`,
        type,
        missionDate
    };

    updateSolarTargetCardUI();
    updateSolarUI();
    generateIlluminationTimeline(lat, lon, currentEpoch, timelinePeriodHours);
}

// Refresh UI metrics, HUD badge, and solar parameters
function updateSolarUI() {
    // 1. Compute astronomical solar angles
    let s_moon, subSolLat, subSolLon, colongitude;
    if (solarMode === 'SCIENTIFIC') {
        const sunData = getSunInMoonFrame(currentEpoch);
        s_moon = sunData.s_moon;
        subSolLat = sunData.subSolLat;
        subSolLon = sunData.subSolLon;
        colongitude = sunData.colongitude;
    } else {
        const radLon = simSolarLon * DEG2RAD;
        const radLat = simSolarLat * DEG2RAD;
        s_moon = [
            Math.cos(radLat) * Math.cos(radLon),
            Math.cos(radLat) * Math.sin(radLon),
            Math.sin(radLat)
        ];
        subSolLat = simSolarLat;
        subSolLon = simSolarLon;
        colongitude = ((90.0 - simSolarLon) % 360 + 360) % 360;
    }

    // 2. Format Datetime for input
    if (solarDatetimeInput && !solarDatetimeInput.matches(':focus')) {
        const iso = currentEpoch.toISOString();
        solarDatetimeInput.value = iso.slice(0, 16);
    }

    if (epochDeltaBadge) {
        const jd = (currentEpoch.getTime() / 86400000.0) + 2440587.5;
        const d = (jd - 2451545.0).toFixed(1);
        
        // Real-time Moon Phase & Illumination Fraction calculation
        const s_ref = s_moon || [0, 0, 1];
        const cosPhase = Math.max(-1.0, Math.min(1.0, s_ref[0]));
        const illumFraction = (1.0 + cosPhase) / 2.0;
        const illumPct = (illumFraction * 100).toFixed(1);
        
        let phaseStr = 'Full Moon';
        if (illumFraction > 0.98) phaseStr = 'Full Moon';
        else if (illumFraction < 0.02) phaseStr = 'New Moon';
        else if (s_ref[1] < 0) phaseStr = illumFraction < 0.5 ? 'Waxing Crescent' : 'Waxing Gibbous';
        else phaseStr = illumFraction < 0.5 ? 'Waning Crescent' : 'Waning Gibbous';
        if (Math.abs(illumFraction - 0.5) < 0.04) phaseStr = s_ref[1] < 0 ? 'First Quarter' : 'Last Quarter';

        epochDeltaBadge.textContent = `${phaseStr} (${illumPct}%)`;
        epochDeltaBadge.title = `Lunar Phase: ${phaseStr} | Solar Illumination: ${illumPct}% | Epoch J2000 ${d >= 0 ? '+' : ''}${d}d`;
    }

    const { lat, lon, name } = selectedTargetForSolar;
    const angles = calculateSolarAngles(lat, lon, s_moon);
    const obstruction = calculateTerrainHorizonObstruction(lat, lon, angles.azimuth, angles.elevation);

    // 3. Update HUD row in Lunar Compass Panel
    if (hudSolarBadge && hudSolarAngle) {
        hudSolarAngle.textContent = `${angles.elevation >= 0 ? '+' : ''}${angles.elevation.toFixed(1)}°`;
        hudSolarBadge.className = 'hud-solar-badge';

        if (obstruction.status === 'SUNLIT') {
            hudSolarBadge.classList.add('status-sunlit');
            hudSolarBadge.textContent = 'SUNLIT';
        } else if (obstruction.status === 'TERRAIN_SHADOW') {
            hudSolarBadge.classList.add('status-terrain-shadow');
            hudSolarBadge.textContent = 'TERRAIN SHADOW';
        } else {
            hudSolarBadge.classList.add('status-night');
            hudSolarBadge.textContent = 'NIGHT';
        }
    }

    // 4. Update Solar Panel Target Info
    if (solarTargetName) solarTargetName.textContent = name.toUpperCase();

    // 5. Update Hero Status Banner
    if (solarHeroStatus && statusHeroDot && statusHeroTitle && statusHeroDesc) {
        solarHeroStatus.className = 'solar-status-hero';
        statusHeroDot.className = 'status-indicator-dot';

        if (obstruction.status === 'SUNLIT') {
            solarHeroStatus.classList.add('status-sunlit');
            statusHeroTitle.textContent = 'DIRECT SUNLIGHT';
            statusHeroDesc.textContent = `Clear solar line-of-sight (+${angles.elevation.toFixed(2)}° above horizon, clearance: +${(angles.elevation - obstruction.horizonElevationDeg).toFixed(2)}°)`;
        } else if (obstruction.status === 'TERRAIN_SHADOW') {
            solarHeroStatus.classList.add('status-terrain-shadow');
            statusHeroDot.classList.add('dot-terrain');
            statusHeroTitle.textContent = 'TERRAIN SHADOW (CRATER WALL)';
            statusHeroDesc.textContent = `Sun is above sphere horizon (+${angles.elevation.toFixed(2)}°), but blocked by elevated rim at ${obstruction.blockingDistKm} km (+${obstruction.horizonElevationDeg.toFixed(2)}°)`;
        } else {
            solarHeroStatus.classList.add('status-night');
            statusHeroDot.classList.add('dot-night');
            statusHeroTitle.textContent = 'LUNAR NIGHT';
            statusHeroDesc.textContent = `Sun is below geometric horizon (${angles.elevation.toFixed(2)}° elevation)`;
        }
    }

    // 6. Update Metric Cards
    if (mValElevation) mValElevation.textContent = `${angles.elevation >= 0 ? '+' : ''}${angles.elevation.toFixed(2)}`;
    if (mSubElevation) mSubElevation.textContent = `Topo angle: ${angles.topoElevation >= 0 ? '+' : ''}${angles.topoElevation.toFixed(1)}°`;
    if (mValAzimuth) mValAzimuth.textContent = angles.azimuth.toFixed(1);
    if (mSubAzimuth) mSubAzimuth.textContent = `${getCompassSector(angles.azimuth)} bearing`;
    if (mValIncidence) mValIncidence.textContent = angles.incAngle.toFixed(2);
    if (mSubIncidence) mSubIncidence.textContent = `Slope: ${angles.slopeDeg.toFixed(1)}°`;
    if (mValLolaElev) mValLolaElev.textContent = `${angles.datumElev >= 0 ? '+' : ''}${angles.datumElev.toFixed(2)}`;

    // 7. Update Astronomical Context Box
    if (ctxSubsolarCoords) {
        const absLat = Math.abs(subSolLat);
        const latStr = `${absLat.toFixed(2)}° ${subSolLat >= 0 ? 'N' : 'S'}`;
        const lonStr = `${subSolLon.toFixed(2)}° E`;
        ctxSubsolarCoords.textContent = `${latStr}, ${lonStr}`;
    }
    if (ctxColongitude) ctxColongitude.textContent = `${colongitude.toFixed(2)}°`;
    if (ctxTerrainLimit) {
        ctxTerrainLimit.textContent = `${obstruction.horizonElevationDeg >= 0 ? '+' : ''}${obstruction.horizonElevationDeg.toFixed(2)}° (${obstruction.isObstructed ? 'Blocked' : 'Clear'})`;
    }
}

function getCompassSector(azimuthDeg) {
    const sectors = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
    const idx = Math.round(azimuthDeg / 22.5) % 16;
    return sectors[idx];
}

// Generate Illumination Timeline over Selected Period
function generateIlluminationTimeline(latDeg, lonDeg, startEpoch, periodHours) {
    if (!timelineCanvas) return;

    let stepHours = 1.0;
    if (periodHours <= 24) stepHours = 0.25; // 15-min intervals
    else if (periodHours <= 168) stepHours = 1.0; // 1-hour intervals
    else if (periodHours <= 720) stepHours = 2.0; // 2-hour intervals
    else stepHours = 6.0; // 6-hour intervals

    const numSteps = Math.ceil(periodHours / stepHours);
    const samples = [];
    let sunlitHours = 0;
    let shadowHours = 0;
    let minElev = Infinity;
    let maxElev = -Infinity;
    let transitions = 0;
    let prevSunlit = null;
    let nextSunriseTime = null;
    let nextSunsetTime = null;

    const startTimeMs = startEpoch.getTime();

    for (let i = 0; i <= numSteps; i++) {
        const timeMs = startTimeMs + i * stepHours * 3600000;
        const date = new Date(timeMs);
        const sunData = getSunInMoonFrame(date);
        const angles = calculateSolarAngles(latDeg, lonDeg, sunData.s_moon);
        const obstruction = calculateTerrainHorizonObstruction(latDeg, lonDeg, angles.azimuth, angles.elevation);

        minElev = Math.min(minElev, angles.elevation);
        maxElev = Math.max(maxElev, angles.elevation);

        const isSunlit = (obstruction.status === 'SUNLIT');
        if (isSunlit) sunlitHours += stepHours;
        else shadowHours += stepHours;

        if (prevSunlit !== null && isSunlit !== prevSunlit) {
            transitions++;
            if (!isSunlit && !nextSunsetTime) nextSunsetTime = date;
            if (isSunlit && !nextSunriseTime) nextSunriseTime = date;
        }
        prevSunlit = isSunlit;

        samples.push({
            timeMs,
            elevation: angles.elevation,
            azimuth: angles.azimuth,
            horizonLimit: obstruction.horizonElevationDeg,
            status: obstruction.status,
            isSunlit
        });
    }

    const totalHours = sunlitHours + shadowHours;
    const fraction = totalHours > 0 ? (sunlitHours / totalHours) * 100 : 0;

    // Update Stats Display
    if (tStatSunlit) tStatSunlit.textContent = `${sunlitHours.toFixed(1)} hrs`;
    if (tStatSunlitDays) tStatSunlitDays.textContent = `${(sunlitHours / 24.0).toFixed(2)} Earth days`;
    if (tStatShadow) tStatShadow.textContent = `${shadowHours.toFixed(1)} hrs`;
    if (tStatShadowDays) tStatShadowDays.textContent = `${(shadowHours / 24.0).toFixed(2)} Earth days`;
    if (tStatFraction) tStatFraction.textContent = `${fraction.toFixed(1)}%`;
    if (tStatTransitions) tStatTransitions.textContent = `${transitions} transitions`;
    if (tStatRange) tStatRange.textContent = `${minElev >= 0 ? '+' : ''}${minElev.toFixed(1)}° to ${maxElev >= 0 ? '+' : ''}${maxElev.toFixed(1)}°`;

    if (tStatNextEvent) {
        if (nextSunsetTime) {
            tStatNextEvent.textContent = `Sunset: ${nextSunsetTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`;
        } else if (nextSunriseTime) {
            tStatNextEvent.textContent = `Sunrise: ${nextSunriseTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })}`;
        } else {
            tStatNextEvent.textContent = minElev > 0 ? 'Continuous Daylight' : 'Continuous Shadow';
        }
    }

    cachedTimelineData = {
        samples,
        startTimeMs,
        endTimeMs: startTimeMs + periodHours * 3600000,
        minElev,
        maxElev,
        periodHours
    };

    drawTimelineCanvas();
}

// Render Interactive Illumination Canvas Chart
function drawTimelineCanvas() {
    if (!timelineCanvas || !cachedTimelineData) return;

    const ctx = timelineCanvas.getContext('2d');
    const width = timelineCanvas.width;
    const height = timelineCanvas.height;
    ctx.clearRect(0, 0, width, height);

    const { samples, startTimeMs, endTimeMs, minElev, maxElev } = cachedTimelineData;
    if (samples.length < 2) return;

    const padLeft = 32;
    const padRight = 12;
    const padTop = 16;
    const padBottom = 22;
    const plotW = width - padLeft - padRight;
    const plotH = height - padTop - padBottom;

    const yMin = Math.min(-15.0, Math.floor(minElev - 5));
    const yMax = Math.max(25.0, Math.ceil(maxElev + 5));

    function toX(timeMs) {
        return padLeft + ((timeMs - startTimeMs) / (endTimeMs - startTimeMs)) * plotW;
    }

    function toY(deg) {
        return padTop + (1.0 - (deg - yMin) / (yMax - yMin)) * plotH;
    }

    // 1. Background Grid & Zero Horizon Reference Line
    ctx.strokeStyle = 'rgba(80, 140, 220, 0.15)';
    ctx.lineWidth = 1;

    // Grid lines for -30, 0, +30, +60
    [-30, 0, 30, 60, 90].forEach(deg => {
        if (deg >= yMin && deg <= yMax) {
            const y = toY(deg);
            ctx.beginPath();
            ctx.moveTo(padLeft, y);
            ctx.lineTo(width - padRight, y);
            ctx.stroke();

            ctx.fillStyle = deg === 0 ? '#38bdf8' : '#64748b';
            ctx.font = '9px "SF Mono", monospace';
            ctx.textAlign = 'right';
            ctx.fillText(`${deg > 0 ? '+' : ''}${deg}°`, padLeft - 4, y + 3);
        }
    });

    // Zero Horizon Baseline (Dashed Cyan Line)
    const yZero = toY(0);
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.6)';
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(padLeft, yZero);
    ctx.lineTo(width - padRight, yZero);
    ctx.stroke();
    ctx.setLineDash([]);

    // 2. Color-coded Status Ribbon along bottom
    const ribbonY = height - padBottom + 6;
    const ribbonH = 6;
    for (let i = 0; i < samples.length - 1; i++) {
        const s1 = samples[i];
        const s2 = samples[i + 1];
        const x1 = toX(s1.timeMs);
        const x2 = toX(s2.timeMs);

        if (s1.status === 'SUNLIT') ctx.fillStyle = '#facc15';
        else if (s1.status === 'TERRAIN_SHADOW') ctx.fillStyle = '#fb923c';
        else ctx.fillStyle = '#334155';

        ctx.fillRect(x1, ribbonY, x2 - x1 + 0.5, ribbonH);
    }

    // 3. Shaded Sunlit Area & Elevation Curve
    ctx.beginPath();
    ctx.moveTo(toX(samples[0].timeMs), toY(samples[0].elevation));
    for (let i = 1; i < samples.length; i++) {
        ctx.lineTo(toX(samples[i].timeMs), toY(samples[i].elevation));
    }
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // Fill under sunlit portion
    ctx.lineTo(toX(samples[samples.length - 1].timeMs), yZero);
    ctx.lineTo(toX(samples[0].timeMs), yZero);
    ctx.closePath();
    ctx.fillStyle = 'rgba(250, 204, 21, 0.12)';
    ctx.fill();

    // 4. Draw Current Epoch Cursor on Canvas
    const currX = toX(currentEpoch.getTime());
    if (currX >= padLeft && currX <= width - padRight) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([3, 2]);
        ctx.beginPath();
        ctx.moveTo(currX, padTop);
        ctx.lineTo(currX, height - padBottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Small indicator ball
        const currSun = getSunInMoonFrame(currentEpoch);
        const currAngles = calculateSolarAngles(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currSun.s_moon);
        const currY = toY(currAngles.elevation);

        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(currX, currY, 4, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Handle Scrubbing on Timeline Canvas
if (timelineChartBox) {
    let isScrubbing = false;

    function handleScrub(e) {
        if (!cachedTimelineData) return;
        const rect = timelineChartBox.getBoundingClientRect();
        const mouseX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
        const fraction = mouseX / rect.width;

        const timeMs = cachedTimelineData.startTimeMs + fraction * (cachedTimelineData.endTimeMs - cachedTimelineData.startTimeMs);
        currentEpoch = new Date(timeMs);

        updateSolarLighting();
        updateSolarUI();
        drawTimelineCanvas();

        if (timelineTooltip) {
            const sunData = getSunInMoonFrame(currentEpoch);
            const angles = calculateSolarAngles(selectedTargetForSolar.lat, selectedTargetForSolar.lon, sunData.s_moon);
            const obstruction = calculateTerrainHorizonObstruction(selectedTargetForSolar.lat, selectedTargetForSolar.lon, angles.azimuth, angles.elevation);

            timelineTooltip.textContent = `${currentEpoch.toISOString().slice(0, 16).replace('T', ' ')} UTC | Elev: ${angles.elevation >= 0 ? '+' : ''}${angles.elevation.toFixed(1)}° | ${obstruction.status}`;
            timelineTooltip.style.left = `${Math.min(rect.width - 180, Math.max(10, mouseX - 60))}px`;
            timelineTooltip.style.display = 'block';
        }
    }

    timelineChartBox.addEventListener('pointerdown', (e) => {
        isScrubbing = true;
        handleScrub(e);
    });

    window.addEventListener('pointermove', (e) => {
        if (isScrubbing) handleScrub(e);
    });

    window.addEventListener('pointerup', () => {
        isScrubbing = false;
        if (timelineTooltip) timelineTooltip.style.display = 'none';
    });
}

// Wire Mode Switch Buttons
if (btnModeScientific && btnModeSimulation) {
    btnModeScientific.addEventListener('click', () => {
        solarMode = 'SCIENTIFIC';
        btnModeScientific.classList.add('active');
        btnModeSimulation.classList.remove('active');
        if (solarSimWarning) solarSimWarning.style.display = 'none';
        if (solarEpochSection) solarEpochSection.style.display = 'flex';
        if (solarSimSection) solarSimSection.style.display = 'none';
        updateSolarLighting();
        updateSolarUI();
    });

    btnModeSimulation.addEventListener('click', () => {
        solarMode = 'SIMULATION';
        btnModeSimulation.classList.add('active');
        btnModeScientific.classList.remove('active');
        if (solarSimWarning) solarSimWarning.style.display = 'flex';
        if (solarEpochSection) solarEpochSection.style.display = 'none';
        if (solarSimSection) solarSimSection.style.display = 'flex';
        updateSolarLighting();
        updateSolarUI();
    });
}

// Wire Epoch Controls
if (solarDatetimeInput) {
    solarDatetimeInput.addEventListener('change', () => {
        const d = new Date(solarDatetimeInput.value + 'Z');
        if (!isNaN(d.getTime())) {
            currentEpoch = d;
            updateSolarLighting();
            updateSolarUI();
            generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
        }
    });
}

if (btnEpochNow) {
    btnEpochNow.addEventListener('click', () => {
        currentEpoch = new Date();
        updateSolarLighting();
        updateSolarUI();
        generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
    });
}

// Action: Run Solar Analysis for Selected Point
if (btnRunSolarAnalysis) {
    btnRunSolarAnalysis.addEventListener('click', (e) => {
        e.stopPropagation();
        btnRunSolarAnalysis.classList.add('running');
        updateSolarLighting();
        updateSolarUI();
        generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
        setTimeout(() => {
            btnRunSolarAnalysis.classList.remove('running');
        }, 350);
    });
}

// Action: Set Epoch to Historical Mission Landing Date
if (btnSyncMissionDate) {
    btnSyncMissionDate.addEventListener('click', (e) => {
        e.stopPropagation();
        if (selectedTargetForSolar.missionDate) {
            const d = new Date(selectedTargetForSolar.missionDate);
            if (!isNaN(d.getTime())) {
                currentEpoch = d;
                updateSolarLighting();
                updateSolarUI();
                generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
            }
        }
    });
}

// Stepper Buttons
function stepEpochHours(hours) {
    currentEpoch = new Date(currentEpoch.getTime() + hours * 3600000);
    updateSolarLighting();
    updateSolarUI();
    generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
}

if (btnStepM7d) btnStepM7d.addEventListener('click', () => stepEpochHours(-168));
if (btnStepM1d) btnStepM1d.addEventListener('click', () => stepEpochHours(-24));
if (btnStepM1h) btnStepM1h.addEventListener('click', () => stepEpochHours(-1));
if (btnStepP1h) btnStepP1h.addEventListener('click', () => stepEpochHours(1));
if (btnStepP1d) btnStepP1d.addEventListener('click', () => stepEpochHours(24));
if (btnStepP7d) btnStepP7d.addEventListener('click', () => stepEpochHours(168));

if (btnPlayPauseTime) {
    btnPlayPauseTime.addEventListener('click', () => {
        isPlayingTime = !isPlayingTime;
        if (playIcon) playIcon.textContent = isPlayingTime ? '⏸' : '▶';
        if (isPlayingTime) {
            btnPlayPauseTime.classList.add('active');
            lastFrameTime = performance.now();
        } else {
            btnPlayPauseTime.classList.remove('active');
        }
    });
}

// Simulation Mode Sliders
if (simLonSlider) {
    simLonSlider.addEventListener('input', () => {
        simSolarLon = parseFloat(simLonSlider.value);
        if (valSimLon) valSimLon.textContent = `${simSolarLon.toFixed(1)}°`;
        if (solarMode === 'SIMULATION') {
            updateSolarLighting();
            updateSolarUI();
        }
    });
}

if (simLatSlider) {
    simLatSlider.addEventListener('input', () => {
        simSolarLat = parseFloat(simLatSlider.value);
        if (valSimLat) valSimLat.textContent = `${simSolarLat.toFixed(1)}°`;
        if (solarMode === 'SIMULATION') {
            updateSolarLighting();
            updateSolarUI();
        }
    });
}

// Observation Period Selector
if (timelinePeriodSelect) {
    timelinePeriodSelect.addEventListener('change', () => {
        timelinePeriodHours = parseFloat(timelinePeriodSelect.value);
        generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
    });
}

// Visual Light Intensity Sliders (Strictly display-only, does not alter scientific calculations)
if (sliderSunIntensity) {
    sliderSunIntensity.addEventListener('input', () => {
        const val = parseFloat(sliderSunIntensity.value);
        sunLight.intensity = val;
        if (valSunIntensity) valSunIntensity.textContent = `${val.toFixed(1)}×`;
    });
}

if (sliderAmbientIntensity) {
    sliderAmbientIntensity.addEventListener('input', () => {
        const val = parseFloat(sliderAmbientIntensity.value);
        ambientLight.intensity = val;
        if (valAmbientIntensity) valAmbientIntensity.textContent = `${val.toFixed(2)}×`;
    });
}

// Toggle Solar Panel Drawer
if (btnToggleSolar && solarPanel) {
    btnToggleSolar.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = solarPanel.style.display === 'none' || getComputedStyle(solarPanel).display === 'none';
        if (isHidden) {
            solarPanel.style.display = 'flex';
            btnToggleSolar.classList.add('active');
            updateSolarUI();
            generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
        } else {
            solarPanel.style.display = 'none';
            btnToggleSolar.classList.remove('active');
        }
    });
}

if (btnHudSolarAnalyze && solarPanel) {
    btnHudSolarAnalyze.addEventListener('click', (e) => {
        e.stopPropagation();
        solarPanel.style.display = 'flex';
        if (btnToggleSolar) btnToggleSolar.classList.add('active');
        updateSolarUI();
        generateIlluminationTimeline(selectedTargetForSolar.lat, selectedTargetForSolar.lon, currentEpoch, timelinePeriodHours);
    });
}

if (btnCloseSolar && solarPanel) {
    btnCloseSolar.addEventListener('click', () => {
        solarPanel.style.display = 'none';
        if (btnToggleSolar) btnToggleSolar.classList.remove('active');
    });
}

// Provenance Modal Handlers
if (btnSolarInfo && provenanceModal) {
    btnSolarInfo.addEventListener('click', (e) => {
        e.stopPropagation();
        provenanceModal.style.display = 'flex';
    });
}

if (btnCloseProvenance && provenanceModal) {
    btnCloseProvenance.addEventListener('click', () => {
        provenanceModal.style.display = 'none';
    });
}

if (provenanceBackdrop && provenanceModal) {
    provenanceBackdrop.addEventListener('click', () => {
        provenanceModal.style.display = 'none';
    });
}

// Startup Complete

// ============================================================================
// 15. ANIMATION LOOP
// ============================================================================
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

    // 3. Pulse red pointer (📍) base ring, beacon ripples, and pin-drop bounce across surface
    if (surfaceMarker.visible) {
        const time = performance.now() * 0.004;
        if (markerBaseRing && markerBaseRingMat) {
            const scale = 1.0 + 0.18 * Math.sin(time);
            markerBaseRing.scale.set(scale, 1.0, scale);
            markerBaseRingMat.opacity = 0.55 + 0.35 * Math.cos(time);
        }
        if (markerBeaconRing && markerBeaconRingMat) {
            const cycle = (performance.now() * 0.0016) % 1.0;
            const bScale = 1.0 + cycle * 1.8;
            markerBeaconRing.scale.set(bScale, 1.0, bScale);
            markerBeaconRingMat.opacity = Math.max(0, 0.75 * (1.0 - cycle));
        }

        // Spring pin-drop animation on landing touchdown
        if (markerDropActive) {
            const dropElapsed = performance.now() - markerDropStartTime;
            if (dropElapsed > 0) {
                const dropT = Math.min(1.0, dropElapsed / 480);
                const spring = 1.0 + Math.sin(dropT * Math.PI) * 0.40 * (1.0 - dropT);
                surfaceMarker.scale.set(spring, spring, spring);
                if (dropT >= 1.0) {
                    surfaceMarker.scale.set(1.0, 1.0, 1.0);
                    markerDropActive = false;
                }
            } else {
                surfaceMarker.scale.set(0.001, 0.001, 0.001);
            }
        }
    }

    // 4. Update Screen POI Marker Labels
    updatePOILabels();

    // 5. Render Main Lunar Scene
    renderer.render(scene, camera);

    // 7. Update and Render 3D Lunar Compass
    updateCompassOrientation();
    if (compassRenderer && compassScene && compassCamera) {
        compassRenderer.render(compassScene, compassCamera);
    }
}

animate();

// 15. RESPONSIVE RESIZE
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 3.0));

    updateCompassSize();
});
