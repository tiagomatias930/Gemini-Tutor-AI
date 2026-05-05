import React, { useRef, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useTexture, Float, PerspectiveCamera, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarProps {
  gesture?: string | null;
}

const AvatarPlane: React.FC<AvatarProps> = ({ gesture }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  // Use try-catch or safe loading for texture
  const texture = useTexture('/avatar.png');

  useFrame((state) => {
    if (!meshRef.current) return;
    const t = state.clock.getElapsedTime();
    
    // Subtle idle floating
    meshRef.current.position.y = Math.sin(t) * 0.1;
    
    // Reaction based on gesture
    if (gesture === 'explaining') {
      meshRef.current.rotation.z = Math.sin(t * 10) * 0.05;
      meshRef.current.scale.setScalar(1 + Math.sin(t * 12) * 0.02);
    } else if (gesture === 'listening') {
      meshRef.current.rotation.y = Math.sin(t * 2) * 0.1;
    } else {
      meshRef.current.rotation.z = Math.sin(t * 0.5) * 0.02;
    }
  });

  return (
    <mesh ref={meshRef}>
      <planeGeometry args={[3.2, 4.5]} />
      <meshBasicMaterial map={texture} transparent={true} side={THREE.DoubleSide} />
    </mesh>
  );
};

export const SignLanguageAvatar: React.FC<AvatarProps> = ({ gesture = 'idle' }) => {
  return (
    <div className="w-full h-full min-h-[300px] bg-gradient-to-b from-blue-500/10 to-purple-500/10 rounded-3xl overflow-hidden border border-white/20 shadow-2xl backdrop-blur-sm relative group">
      <Suspense fallback={<div className="w-full h-full flex items-center justify-center text-white/50 text-xs">Loading Avatar...</div>}>
        <Canvas alpha camera={{ position: [0, 0, 5], fov: 45 }}>
          <Environment preset="city" />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={1} />
          
          <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
            <AvatarPlane gesture={gesture} />
          </Float>
          
          <ContactShadows opacity={0.4} scale={10} blur={2.5} far={4} resolution={256} color="#000000" />
        </Canvas>
      </Suspense>
    </div>
  );
};
