import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing';
import * as THREE from 'three';
import { useControls } from '../hooks/useControls';
import { BuildingData, PlayerState } from '../types';

// --- Constants ---
const FOG_COLOR = '#242038'; // Soft purple-black
const GROUND_COLOR = '#1f1e33';
const RAIN_COLOR = '#a9def9';

// --- Components ---

// 1. Rain Effect
const Rain = ({ count = 2000 }) => {
  const points = useRef<THREE.Points>(null);
  
  const particles = useMemo(() => {
    const temp = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      temp[i * 3] = (Math.random() - 0.5) * 300;     // x
      temp[i * 3 + 1] = Math.random() * 200;         // y
      temp[i * 3 + 2] = (Math.random() - 0.5) * 300; // z
    }
    return temp;
  }, [count]);

  useFrame((state, delta) => {
    if (!points.current) return;
    const positions = points.current.geometry.attributes.position.array as Float32Array;
    const speed = 40 * delta;
    
    for (let i = 1; i < positions.length; i += 3) {
      positions[i] -= speed; // Move down
      if (positions[i] < -20) {
        positions[i] = 100; // Reset height
      }
    }
    points.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.length / 3}
          array={particles}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.2}
        color={RAIN_COLOR}
        transparent
        opacity={0.4}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
};

// 2. City Rendering
const City = ({ buildings }: { buildings: BuildingData[] }) => {
  return (
    <group>
      {buildings.map((b, i) => (
        <group key={i} position={[b.x, b.height / 2 - 20, b.z]}>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[b.width, b.height, b.depth]} />
            <meshStandardMaterial 
              color={b.color} 
              emissive={b.color}
              emissiveIntensity={0.8} // Increased intensity since we removed the point lights
              roughness={0.2}
              metalness={0.5}
            />
          </mesh>
        </group>
      ))}
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -20, 0]}>
        <planeGeometry args={[600, 600]} />
        <meshStandardMaterial color={GROUND_COLOR} roughness={0.1} metalness={0.8} />
      </mesh>
      {/* Grid pattern on ground */}
      <gridHelper position={[0, -19.9, 0]} args={[600, 60, '#4a4e69', '#22223b']} />
    </group>
  );
};

// 3. NPC Flying Cars
const NpcCar = ({ 
  initialPos, 
  speed, 
  color,
  index,
  npcRefs 
}: { 
  initialPos: [number, number, number], 
  speed: number, 
  color: string,
  index: number,
  npcRefs: React.MutableRefObject<THREE.Vector3[]>
}) => {
  const ref = useRef<THREE.Group>(null);
  const offset = useRef(Math.random() * 100);

  useFrame((state, delta) => {
    if (!ref.current) return;
    
    // Move
    ref.current.position.z += speed * delta;
    ref.current.position.y += Math.sin(state.clock.elapsedTime + offset.current) * 0.02;

    // Loop
    if (ref.current.position.z > 200) ref.current.position.z = -200;
    if (ref.current.position.z < -200) ref.current.position.z = 200;

    // Update shared ref for collision detection
    npcRefs.current[index].copy(ref.current.position);
  });

  return (
    <group ref={ref} position={initialPos}>
      <mesh>
        <boxGeometry args={[1.5, 0.5, 3]} />
        <meshStandardMaterial color="#4a4e69" />
      </mesh>
      <mesh position={[0, 0, 1.5]}>
        <boxGeometry args={[1.4, 0.3, 0.1]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

// 4. Player Car with Physics
const Player = ({ 
  onUpdate, 
  buildings,
  npcRefs
}: { 
  onUpdate: (state: PlayerState) => void, 
  buildings: BuildingData[],
  npcRefs: React.MutableRefObject<THREE.Vector3[]>
}) => {
  const carRef = useRef<THREE.Group>(null);
  const controls = useControls();
  const speedRef = useRef(0);
  const { camera } = useThree();
  const impactRef = useRef(0); // Cooldown for impact shake

  useFrame((state, delta) => {
    if (!carRef.current) return;

    // -- Movement Physics --
    const maxSpeed = controls.boost ? 50 : 25;
    const accel = 20 * delta;
    const rotSpeed = 2.5 * delta;
    const friction = 0.97;

    if (controls.forward) speedRef.current = Math.min(speedRef.current + accel, maxSpeed);
    if (controls.backward) speedRef.current = Math.max(speedRef.current - accel, -maxSpeed / 2);
    
    if (!controls.forward && !controls.backward) {
      speedRef.current *= friction;
    }

    // Rotation
    if (Math.abs(speedRef.current) > 0.1) {
       if (controls.left) carRef.current.rotation.y += rotSpeed;
       if (controls.right) carRef.current.rotation.y -= rotSpeed;
    }

    // Altitude
    if (controls.up) carRef.current.position.y += 15 * delta;
    if (controls.down) carRef.current.position.y -= 15 * delta;
    
    // Ground/Ceiling Collision
    carRef.current.position.y = Math.max(-18, Math.min(carRef.current.position.y, 80));

    // Calculate Proposed Position
    const direction = new THREE.Vector3(0, 0, -1);
    direction.applyQuaternion(carRef.current.quaternion);
    const moveVector = direction.multiplyScalar(speedRef.current * delta);
    const nextPos = carRef.current.position.clone().add(moveVector);

    // -- Collision Detection --
    let collided = false;

    // 1. Buildings (AABB)
    // Car dimensions approx: 2x4
    const CAR_HW = 1.0;
    const CAR_HL = 2.0;

    for (const b of buildings) {
       // Building bounds
       const bMinX = b.x - b.width / 2 - CAR_HW;
       const bMaxX = b.x + b.width / 2 + CAR_HW;
       const bMinZ = b.z - b.depth / 2 - CAR_HL;
       const bMaxZ = b.z + b.depth / 2 + CAR_HL;
       const bMaxY = -20 + b.height + 1; // Top of building

       if (nextPos.x > bMinX && nextPos.x < bMaxX &&
           nextPos.z > bMinZ && nextPos.z < bMaxZ &&
           nextPos.y < bMaxY) {
           collided = true;
           break;
       }
    }

    // 2. NPCs (Radius check)
    if (!collided) {
        for (const npcPos of npcRefs.current) {
            // Check flat distance first for speed, then 3d
            if (Math.abs(npcPos.x - nextPos.x) < 4 && Math.abs(npcPos.z - nextPos.z) < 4) {
                 if (nextPos.distanceTo(npcPos) < 3.5) {
                     collided = true;
                     break;
                 }
            }
        }
    }

    if (collided) {
        speedRef.current *= -0.5; // Bounce back
        impactRef.current = 0.5; // Trigger screen shake
        // Push car back slightly to avoid sticking
        carRef.current.position.add(moveVector.multiplyScalar(-2));
    } else {
        carRef.current.position.copy(nextPos);
    }
    
    // Banking animation
    carRef.current.rotation.z = THREE.MathUtils.lerp(
        carRef.current.rotation.z, 
        (controls.left ? 0.35 : (controls.right ? -0.35 : 0)), 
        0.1
    );

    // -- Camera Follow & Shake --
    const cameraOffset = new THREE.Vector3(0, 4, 10);
    cameraOffset.applyQuaternion(carRef.current.quaternion);
    const targetPos = carRef.current.position.clone().add(cameraOffset);
    
    if (impactRef.current > 0) {
        targetPos.x += (Math.random() - 0.5) * impactRef.current;
        targetPos.y += (Math.random() - 0.5) * impactRef.current;
        targetPos.z += (Math.random() - 0.5) * impactRef.current;
        impactRef.current -= delta;
    }

    camera.position.lerp(targetPos, 0.1);
    camera.lookAt(carRef.current.position.clone().add(new THREE.Vector3(0, 0, -5).applyQuaternion(carRef.current.quaternion)));

    // -- Update App State --
    onUpdate({
        speed: Math.abs(Math.round(speedRef.current * 10)),
        altitude: Math.round(carRef.current.position.y + 20),
        position: [carRef.current.position.x, carRef.current.position.y, carRef.current.position.z],
        rotation: carRef.current.rotation.y
    });
  });

  return (
    <group ref={carRef}>
        {/* Car Body */}
        <mesh castShadow>
          <boxGeometry args={[1.8, 0.6, 4]} />
          <meshStandardMaterial color="#ff99c8" roughness={0.3} metalness={0.7} />
        </mesh>
        
        {/* Glass */}
        <mesh position={[0, 0.4, -0.5]}>
           <boxGeometry args={[1.4, 0.5, 2]} />
           <meshPhysicalMaterial 
             color="#a9def9"
             metalness={0.9} 
             roughness={0.0} 
             transmission={0.4} 
             transparent
           />
        </mesh>

        {/* Engines */}
        <mesh position={[0.8, 0, 1.8]}>
          <boxGeometry args={[0.4, 0.4, 0.8]} />
          <meshStandardMaterial color="#444" />
        </mesh>
        <mesh position={[-0.8, 0, 1.8]}>
          <boxGeometry args={[0.4, 0.4, 0.8]} />
          <meshStandardMaterial color="#444" />
        </mesh>

        {/* Thrusters */}
        <pointLight position={[0, 0.2, 2.2]} distance={5} intensity={1} color="#ff99c8" />
        <mesh position={[0, 0.2, 2.05]}>
            <planeGeometry args={[1.6, 0.3]} />
            <meshBasicMaterial color="#ff99c8" side={THREE.DoubleSide} />
        </mesh>
    </group>
  );
};

// 5. Main Canvas
export default function ThreeScene({ 
    onStatsUpdate,
    buildings
}: { 
    onStatsUpdate: (state: PlayerState) => void,
    buildings: BuildingData[]
}) {
  // Shared ref for NPC positions to allow O(1) read access in Player loop
  const npcRefs = useRef<THREE.Vector3[]>(new Array(30).fill(null).map(() => new THREE.Vector3(1000, 1000, 1000)));

  // Generate NPCs logic
  const npcs = useMemo(() => {
    return new Array(30).fill(0).map((_, i) => ({
      initialPos: [
        (Math.random() - 0.5) * 300,
        Math.random() * 40 - 10,
        (Math.random() - 0.5) * 300
      ] as [number, number, number],
      speed: (Math.random() * 20 + 15) * (Math.random() > 0.5 ? 1 : -1),
      color: ['#fcf6bd', '#ff99c8', '#a9def9'][Math.floor(Math.random() * 3)],
    }));
  }, []);

  return (
    <Canvas shadows dpr={[1, 1.5]} gl={{ antialias: false }}>
      <fogExp2 attach="fog" args={[FOG_COLOR, 0.012]} />
      <color attach="background" args={[FOG_COLOR]} />

      <ambientLight intensity={0.5} color="#d0f4de" />
      <directionalLight position={[50, 100, 20]} intensity={0.8} color="#e4c1f9" castShadow />
      
      <City buildings={buildings} />
      <Rain />

      {npcs.map((npc, i) => (
        <NpcCar key={i} index={i} npcRefs={npcRefs} {...npc} />
      ))}

      <Player onUpdate={onStatsUpdate} buildings={buildings} npcRefs={npcRefs} />

      <EffectComposer enableNormalPass={false}>
        <Bloom luminanceThreshold={0.5} mipmapBlur intensity={1.2} radius={0.5} />
        <Noise opacity={0.05} />
        <Vignette eskil={false} offset={0.1} darkness={1.0} />
      </EffectComposer>
    </Canvas>
  );
}